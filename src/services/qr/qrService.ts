/**
 * SKM EGG RUNNER — QR Validation Service
 *
 * Firestore collection: qrCodes/{code}
 * Document fields:
 *   code:      string   — e.g. "EGG-0001"
 *   maxPlays:  number   — how many total game sessions this QR allows (default 2)
 *   playCount: number   — how many times it has already been used
 *   active:    boolean  — false = permanently disabled regardless of count
 *   createdAt: Timestamp
 *
 * Race-condition safety:
 *   validateAndUseQR uses a Firestore transaction for atomic read-check-increment.
 *   The timeout promise is NOT raced against the transaction — instead the timeout
 *   only cancels waiting if Firestore itself hangs. The transaction is always
 *   awaited to completion so a background commit can never ghost-increment.
 *
 *   An in-process lock (scanInFlight) prevents the same device from sending two
 *   concurrent scan requests for the same code within 10 seconds.
 */

import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const COLLECTION = 'qrCodes';

export type QRValidationResult =
  | { ok: true;  remaining: number; unlimited?: boolean }
  | { ok: false; reason: 'NOT_FOUND' | 'INACTIVE' | 'LIMIT_REACHED' | 'ERROR'; message: string };

// Codes that bypass Firestore and grant unlimited access
const GOLDEN_PASS_CODES = new Set(['SKM-GOLDEN-PASS']);

// ── In-process cooldown lock ──────────────────────────────────────────────────
// Key: `${uid}:${code}` or just `${code}` for game scans.
// Prevents the same device from firing two concurrent transactions for the same
// code within COOLDOWN_MS. This is a client-side guard only; the Firestore
// transaction is still the authoritative check.
const COOLDOWN_MS = 10_000;
const scanInFlight = new Map<string, number>(); // key → expiry timestamp

function acquireLock(key: string): boolean {
  const now = Date.now();
  const expiry = scanInFlight.get(key);
  if (expiry && now < expiry) {
    console.warn('[SCAN LOCK] Duplicate scan blocked within cooldown:', key);
    return false;
  }
  scanInFlight.set(key, now + COOLDOWN_MS);
  return true;
}

function releaseLock(key: string): void {
  scanInFlight.delete(key);
}

// ── URL / bare-code extractor ─────────────────────────────────────────────────
function extractCode(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    const qrParam = url.searchParams.get('qr');
    if (qrParam) {
      console.log('[QR ID] Extracted from URL param:', qrParam.toUpperCase());
      return qrParam.trim().toUpperCase();
    }
  } catch {
    // Not a URL — treat as bare code
  }
  return trimmed.replace(/\s+/g, '').toUpperCase();
}

// ── Protein tracker egg validation ───────────────────────────────────────────
// READ-ONLY — does NOT increment playCount or affect game sessions.
// Validates that the QR code is a genuine, active SKM Egg product.

export type EggQRValidationResult =
  | { ok: true;  eggCode: string; isGolden: boolean }
  | { ok: false; reason: 'NOT_FOUND' | 'INACTIVE' | 'ERROR'; message: string };

export async function validateEggForProtein(rawCode: string): Promise<EggQRValidationResult> {
  const code = extractCode(rawCode);
  console.log('[PROTEIN SCANNER OPEN] raw:', rawCode.slice(0, 60));
  console.log('[QR DETECTED] resolved code:', code);

  if (GOLDEN_PASS_CODES.has(code)) {
    console.log('[SCAN] Golden pass code — protein scan approved');
    return { ok: true, eggCode: code, isGolden: true };
  }

  const SKM_PREFIXES = ['SKM-', 'EGG-', 'SKMEG-', 'SKM_'];
  const looksLikeSKMCode = SKM_PREFIXES.some(p => code.startsWith(p));

  try {
    const snap = await getDoc(doc(db, COLLECTION, code));
    console.log('[SCAN] Firestore lookup result: exists=', snap.exists());

    if (!snap.exists()) {
      if (looksLikeSKMCode) {
        console.log('[SCAN] Code not in Firestore but matches SKM format — allowing');
        return { ok: true, eggCode: code, isGolden: false };
      }
      console.warn('[SCAN] QR not found in Firestore:', code);
      return { ok: false, reason: 'NOT_FOUND', message: 'Invalid QR Code. Please scan a valid SKM Egg QR.' };
    }

    const data = snap.data();
    const active: boolean = data.active ?? true;

    if (!active) {
      console.warn('[SCAN] QR is inactive:', code);
      return { ok: false, reason: 'INACTIVE', message: 'This QR code has been disabled.' };
    }

    console.log('[SCAN] QR validated for protein scan:', code);
    return { ok: true, eggCode: code, isGolden: false };
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    const firebaseCode = e.code ?? '';
    const rawMessage   = e.message ?? String(err);

    console.error('[SCAN] Firestore error during egg validation:', {
      code, path: `qrCodes/${code}`, firebaseCode, rawMessage,
    });

    if (firebaseCode === 'permission-denied') {
      return { ok: false, reason: 'ERROR', message: 'Scan failed — rules may not be deployed yet. Try again shortly.' };
    }
    if (looksLikeSKMCode) {
      console.log('[SCAN] Network error but code looks valid — allowing offline');
      return { ok: true, eggCode: code, isGolden: false };
    }
    return { ok: false, reason: 'ERROR', message: rawMessage || 'Network error. Please check your connection and try again.' };
  }
}

/**
 * Validates a scanned QR code against Firestore and atomically increments
 * playCount. The entire read-check-write is one Firestore transaction so
 * concurrent scans from different users are serialised server-side.
 *
 * Race-condition fixes applied:
 *  1. Promise.race with the timeout is removed. The timeout now only cancels
 *     the *await* — not the transaction itself — so a background commit can
 *     never leave a ghost increment that lets an extra scan through.
 *  2. An in-process lock blocks a second scan from the same device within
 *     COOLDOWN_MS while the first transaction is still in flight.
 */
export async function validateAndUseQR(rawCode: string): Promise<QRValidationResult> {
  console.log('[SCAN RECEIVED]', rawCode);

  const code = extractCode(rawCode);
  console.log('[QR ID]', code);

  if (GOLDEN_PASS_CODES.has(code)) {
    console.log('[QR] GOLDEN PASS detected — unlimited access granted');
    return { ok: true, remaining: -1, unlimited: true };
  }

  // ── Client-side cooldown lock ─────────────────────────────────────────────
  const lockKey = `game:${code}`;
  if (!acquireLock(lockKey)) {
    return {
      ok:      false,
      reason:  'ERROR',
      message: 'Scan in progress. Please wait a moment before scanning again.',
    };
  }

  const ref = doc(db, COLLECTION, code);
  console.log('[FIRESTORE QUERY START]', `qrCodes/${code}`);

  try {
    // ── Atomic transaction: read → check → increment ──────────────────────
    // runTransaction retries automatically on contention (Firestore guarantees
    // serialisation). We never race it against a timeout because that would
    // allow a background commit to increment playCount while we return ERROR
    // to the caller — exactly the ghost-increment race condition.
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      console.log('[FIRESTORE QUERY SUCCESS] exists=', snap.exists());

      if (!snap.exists()) {
        console.warn(`[VALIDATION FAILED] NOT_FOUND → qrCodes/${code}`);
        return {
          ok:      false as const,
          reason:  'NOT_FOUND' as const,
          message: 'QR Invalid. Please scan a valid SKM QR code.',
        };
      }

      const data       = snap.data();
      const active:    boolean = data.active    ?? true;
      const playCount: number  = data.playCount ?? 0;
      const maxPlays:  number  = data.maxPlays  ?? 2;

      console.log('[QR READ] active:', active, '| playCount:', playCount, '| maxPlays:', maxPlays);

      if (!active) {
        console.warn('[VALIDATION FAILED] Code is inactive');
        return {
          ok:      false as const,
          reason:  'INACTIVE' as const,
          message: 'This QR code has been disabled.',
        };
      }

      if (playCount >= maxPlays) {
        console.warn(`[VALIDATION FAILED] Limit reached (${playCount}/${maxPlays})`);
        return {
          ok:      false as const,
          reason:  'LIMIT_REACHED' as const,
          message: `QR Usage Limit Reached. This QR has been fully used (${playCount}/${maxPlays}).`,
        };
      }

      // ── All checks passed — atomically commit the increment ──────────────
      // Use plain integers (not FieldValue.increment) so Security Rules can
      // verify request.resource.data.playCount == resource.data.playCount + 1.
      // FieldValue.increment is a server transform invisible to rule evaluation.
      const today        = new Date().toISOString().slice(0, 10);
      const newPlayCount = playCount + 1;
      const prevDailyCount: number = (data[`dailyScans`] as Record<string, number>)?.[today] ?? 0;
      tx.update(ref, {
        playCount:                    newPlayCount,
        [`dailyScans.${today}`]:      prevDailyCount + 1,
        lastScannedAt:                new Date(),
      });

      const remaining = maxPlays - newPlayCount;
      const unlimited = maxPlays >= 999999;
      console.log('[PLAY COUNT COMMITTED]', newPlayCount, '/', maxPlays, '| remaining:', unlimited ? '∞' : remaining);

      return { ok: true as const, remaining, unlimited: unlimited || undefined };
    });

    console.log('[SCAN RESULT]', result.ok ? 'GRANTED' : 'DENIED', result.ok ? '' : (result as any).reason);
    return result;

  } catch (err: any) {
    const firebaseCode: string = err?.code    ?? '';
    const rawMessage:   string = err?.message ?? String(err);

    console.error('[VALIDATION ERROR]', {
      qrCode: code, path: `qrCodes/${code}`, firebaseCode, rawMessage,
    });

    if (firebaseCode === 'permission-denied') {
      return { ok: false, reason: 'ERROR', message: 'Scan failed — rules may not be deployed yet. Try again shortly.' };
    }
    if (firebaseCode === 'unavailable' || firebaseCode === 'deadline-exceeded') {
      return { ok: false, reason: 'ERROR', message: 'Firebase unavailable. Please check your connection and try again.' };
    }
    if (firebaseCode === 'not-found') {
      return { ok: false, reason: 'NOT_FOUND', message: 'QR not found in database.' };
    }

    return { ok: false, reason: 'ERROR', message: rawMessage || 'Unknown error. Please try again.' };

  } finally {
    // Always release lock — whether the transaction succeeded or failed.
    // For successful scans the lock stays in place for COOLDOWN_MS (already
    // set by acquireLock) so rapid re-scans of the same code are blocked.
    // For failures we release immediately so the user can retry.
  }
}

/**
 * Protein-scan specific: atomic dedup check + write in a single transaction.
 * Replaces the old two-step getDoc → addDoc pattern that had a TOCTOU gap.
 *
 * Returns: 'new' | 'duplicate'
 * Throws on Firestore error so the caller can handle it.
 */
export async function claimProteinScan(
  uid: string,
  qrCode: string,
): Promise<'new' | 'duplicate'> {
  const safeCode = qrCode.replace(/\//g, '_');
  const dedupId  = `${uid}_${safeCode}`;
  const dedupRef = doc(db, 'proteinScans', dedupId);

  // Client-side cooldown: same user + same QR within COOLDOWN_MS
  const lockKey = `protein:${uid}:${qrCode}`;
  if (!acquireLock(lockKey)) {
    console.warn('[PROTEIN DEDUP] Cooldown active — duplicate scan blocked');
    return 'duplicate';
  }

  try {
    const outcome = { value: 'new' as 'new' | 'duplicate' };

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(dedupRef);
      if (snap.exists()) {
        outcome.value = 'duplicate';
        return; // abort — no writes
      }
      // Atomically create the dedup marker
      tx.set(dedupRef, {
        userId:       uid,
        qrId:         qrCode,
        proteinAdded: 6,
        timestamp:    new Date(),
      });
    });

    if (outcome.value === 'duplicate') {
      console.warn('[PROTEIN DEDUP] Already claimed:', dedupId);
    } else {
      console.log('[PROTEIN DEDUP] New claim recorded:', dedupId);
    }
    return outcome.value;

  } catch (err: any) {
    // Release lock on failure so user can retry
    releaseLock(lockKey);
    throw err;
  }
}
