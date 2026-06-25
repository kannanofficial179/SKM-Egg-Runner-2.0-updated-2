/**
 * SKM EGG RUNNER — QR Validation Service
 *
 * Firestore collection: qrCodes/{code}
 * Document fields:
 *   code:      string   — e.g. "EGG-0001"
 *   maxPlays:  number   — total plays allowed (default 2)
 *   playCount: number   — plays consumed so far; incremented once per play start
 *   active:    boolean  — false = permanently disabled
 *   createdAt: Timestamp
 *
 * Business rule: 1 QR = maxPlays TOTAL PLAYS (not scans).
 *
 *   validateQR(rawCode)
 *     Called at scan time. Read-only — never increments playCount.
 *     Checks active + playCount < maxPlays. Stores the resolved code in
 *     sessionStorage ('skm_qr_code') so the game can consume it later.
 *
 *   consumeOnePlay(rawCode)
 *     Called every time a game run starts (including retries).
 *     Atomically reads playCount, blocks if >= maxPlays, otherwise
 *     increments by 1 and returns the remaining count.
 *     This is the authoritative gate — sessionStorage is never the source
 *     of truth for play allowance.
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
const COOLDOWN_MS = 10_000;
const scanInFlight = new Map<string, number>(); // key → expiry timestamp

function acquireLock(key: string): boolean {
  const now = Date.now();
  const expiry = scanInFlight.get(key);
  if (expiry && now < expiry) {
    console.warn('[SCAN LOCK] Duplicate blocked within cooldown:', key);
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

// ─────────────────────────────────────────────────────────────────────────────
// validateQR — scan-time read-only check
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Called when the player scans a QR code. Does NOT increment playCount.
 * Only checks that the code exists, is active, and still has plays remaining.
 * On success, stores the resolved code in sessionStorage for consumeOnePlay.
 */
export async function validateQR(rawCode: string): Promise<QRValidationResult> {
  console.log('[QR SCAN] raw input:', rawCode.slice(0, 80));

  const code = extractCode(rawCode);
  console.log('[QR ID]', code);

  if (GOLDEN_PASS_CODES.has(code)) {
    console.log('[QR] GOLDEN PASS detected — unlimited access');
    sessionStorage.setItem('skm_qr_code', code);
    sessionStorage.setItem('skm_golden_qr', 'true');
    return { ok: true, remaining: 999, unlimited: true };
  }

  sessionStorage.removeItem('skm_golden_qr');

  const ref = doc(db, COLLECTION, code);
  console.log('[QR SCAN] Firestore read start →', `qrCodes/${code}`);

  try {
    const snap = await getDoc(ref);
    console.log('[QR SCAN] exists=', snap.exists());

    if (!snap.exists()) {
      console.warn('[QR SCAN] NOT_FOUND:', code);
      return { ok: false, reason: 'NOT_FOUND', message: 'QR Invalid. Please scan a valid SKM QR code.' };
    }

    const data      = snap.data();
    const active    = data.active    ?? true  as boolean;
    const playCount = data.playCount ?? 0     as number;
    const maxPlays  = data.maxPlays  ?? 2     as number;

    console.log(`[QR SCAN] id=${code} | active=${active} | playCount=${playCount} | maxPlays=${maxPlays}`);

    if (!active) {
      console.warn('[QR SCAN] INACTIVE:', code);
      return { ok: false, reason: 'INACTIVE', message: 'This QR code has been disabled.' };
    }

    if (playCount >= maxPlays) {
      console.warn(`[QR SCAN] LIMIT_REACHED: ${playCount}/${maxPlays} — QR fully used`);
      return {
        ok:      false,
        reason:  'LIMIT_REACHED',
        message: 'This QR code has already been fully used.\nPlease scan a new QR code.',
      };
    }

    // Store resolved code — consumeOnePlay reads this at game start
    sessionStorage.setItem('skm_qr_code', code);

    const remaining = maxPlays - playCount;
    console.log(`[QR SCAN] GRANTED — ${remaining} play(s) available`);
    return { ok: true, remaining };

  } catch (err: any) {
    const firebaseCode: string = err?.code    ?? '';
    const rawMessage:   string = err?.message ?? String(err);
    console.error('[QR SCAN] Firestore error:', { code, firebaseCode, rawMessage });

    if (firebaseCode === 'permission-denied') {
      return { ok: false, reason: 'ERROR', message: 'Scan failed — rules may not be deployed yet. Try again shortly.' };
    }
    if (firebaseCode === 'unavailable' || firebaseCode === 'deadline-exceeded') {
      return { ok: false, reason: 'ERROR', message: 'Firebase unavailable. Check your connection and try again.' };
    }
    return { ok: false, reason: 'ERROR', message: rawMessage || 'Unknown error. Please try again.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// consumeOnePlay — called at every game start (including retries)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Atomically increments playCount by 1 in Firestore.
 * Called at game start AND on every retry — Firestore is the source of truth.
 * Blocks if playCount >= maxPlays (QR exhausted).
 *
 * Returns remaining plays AFTER this consumption (0 means this was the last one).
 */
export async function consumeOnePlay(rawCode: string): Promise<QRValidationResult> {
  const code = extractCode(rawCode);
  console.log('[QR PLAY] consumeOnePlay →', code);

  if (GOLDEN_PASS_CODES.has(code)) {
    console.log('[QR PLAY] GOLDEN PASS — unlimited, no increment');
    return { ok: true, remaining: 999, unlimited: true };
  }

  const lockKey = `play:${code}`;
  if (!acquireLock(lockKey)) {
    return { ok: false, reason: 'ERROR', message: 'Play already in progress. Please wait a moment.' };
  }

  const ref = doc(db, COLLECTION, code);

  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        console.warn('[QR PLAY] NOT_FOUND:', code);
        return { ok: false as const, reason: 'NOT_FOUND' as const, message: 'QR not found. Please scan again.' };
      }

      const data      = snap.data();
      const active    = data.active    ?? true  as boolean;
      const playCount = data.playCount ?? 0     as number;
      const maxPlays  = data.maxPlays  ?? 2     as number;

      console.log(`[QR PLAY] id=${code} | active=${active} | playCount=${playCount} | maxPlays=${maxPlays}`);

      if (!active) {
        console.warn('[QR PLAY] INACTIVE:', code);
        return { ok: false as const, reason: 'INACTIVE' as const, message: 'This QR code has been disabled.' };
      }

      if (playCount >= maxPlays) {
        console.warn(`[QR PLAY] LIMIT_REACHED: ${playCount}/${maxPlays} — all QR plays used`);
        return {
          ok:      false as const,
          reason:  'LIMIT_REACHED' as const,
          message: 'All QR Plays Used.\nPlease scan a new QR code.',
        };
      }

      // Atomically commit the increment
      // Plain integer (not FieldValue.increment) so Security Rules can verify
      // request.resource.data.playCount == resource.data.playCount + 1
      const newPlayCount = playCount + 1;
      const today        = new Date().toISOString().slice(0, 10);
      const prevDaily    = (data.dailyScans as Record<string, number>)?.[today] ?? 0;

      tx.update(ref, {
        playCount:               newPlayCount,
        [`dailyScans.${today}`]: prevDaily + 1,
        lastScannedAt:           new Date(),
      });

      const remaining = maxPlays - newPlayCount;
      const unlimited = maxPlays >= 999999;

      console.log(`[QR PLAY CONSUMED] id=${code} | playCount=${newPlayCount} | maxPlays=${maxPlays} | remainingPlays=${unlimited ? '∞' : remaining}`);

      return { ok: true as const, remaining, unlimited: unlimited || undefined };
    });

    console.log('[QR PLAY]', result.ok ? 'GRANTED' : 'DENIED', result.ok ? '' : (result as any).reason);
    return result;

  } catch (err: any) {
    const firebaseCode: string = err?.code    ?? '';
    const rawMessage:   string = err?.message ?? String(err);
    console.error('[QR PLAY] Transaction error:', { code, firebaseCode, rawMessage });

    // Release lock on error so the player can retry
    releaseLock(lockKey);

    if (firebaseCode === 'permission-denied') {
      return { ok: false, reason: 'ERROR', message: 'Play failed — rules may not be deployed yet. Try again shortly.' };
    }
    if (firebaseCode === 'unavailable' || firebaseCode === 'deadline-exceeded') {
      return { ok: false, reason: 'ERROR', message: 'Firebase unavailable. Check your connection and try again.' };
    }
    return { ok: false, reason: 'ERROR', message: rawMessage || 'Unknown error. Please try again.' };
  }
}

/**
 * Protein-scan specific: atomic dedup check + write in a single transaction.
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
        return;
      }
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
    releaseLock(lockKey);
    throw err;
  }
}
