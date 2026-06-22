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
 */

import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const COLLECTION = 'qrCodes';

export type QRValidationResult =
  | { ok: true;  remaining: number; unlimited?: boolean }
  | { ok: false; reason: 'NOT_FOUND' | 'INACTIVE' | 'LIMIT_REACHED' | 'ERROR'; message: string };

// Codes that bypass Firestore and grant unlimited access
const GOLDEN_PASS_CODES = new Set(['SKM-GOLDEN-PASS']);

// ── Protein tracker egg validation ───────────────────────────────────────────
// READ-ONLY — does NOT increment playCount or affect game sessions.
// Validates that the QR code is a genuine, active SKM Egg product.
// The protein tracker has no play-count limit; any valid egg code can be
// scanned for protein as many times as the user physically buys eggs.

export type EggQRValidationResult =
  | { ok: true;  eggCode: string; isGolden: boolean }
  | { ok: false; reason: 'NOT_FOUND' | 'INACTIVE' | 'ERROR'; message: string };

export async function validateEggForProtein(rawCode: string): Promise<EggQRValidationResult> {
  const code = rawCode.trim().replace(/\s+/g, '').toUpperCase();
  console.log('[SCAN] QR detected:', code);

  // Golden pass codes are always valid for protein tracking
  if (GOLDEN_PASS_CODES.has(code)) {
    console.log('[SCAN] Golden pass code — protein scan approved');
    return { ok: true, eggCode: code, isGolden: true };
  }

  // Any code starting with known SKM prefixes is a valid egg product
  // even if its game plays are exhausted — the product still exists.
  const SKM_PREFIXES = ['SKM-', 'EGG-', 'SKMEG-', 'SKM_'];
  const looksLikeSKMCode = SKM_PREFIXES.some(p => code.startsWith(p));

  try {
    const snap = await getDoc(doc(db, COLLECTION, code));
    console.log('[SCAN] Firestore lookup result: exists=', snap.exists());

    if (!snap.exists()) {
      // If it looks like a real SKM code format but isn't in Firestore yet,
      // still allow it — some QR codes may not be seeded yet.
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

    // maxPlays / playCount are irrelevant for protein tracking — only game sessions are limited.
    console.log('[SCAN] QR validated for protein scan:', code);
    return { ok: true, eggCode: code, isGolden: false };
  } catch (err: unknown) {
    const msg = (err as { message?: string }).message ?? String(err);
    console.error('[SCAN] Firestore error during egg validation:', msg);
    // On network error, if the code format looks right, allow offline logging
    if (looksLikeSKMCode) {
      console.log('[SCAN] Network error but code looks valid — allowing offline');
      return { ok: true, eggCode: code, isGolden: false };
    }
    return { ok: false, reason: 'ERROR', message: 'Network error. Please check your connection and try again.' };
  }
}

/**
 * Validates a scanned QR code against Firestore and atomically increments
 * playCount if the code is valid and under its maxPlays limit.
 */
export async function validateAndUseQR(rawCode: string): Promise<QRValidationResult> {
  const code = rawCode.trim().replace(/\s+/g, '').toUpperCase();

  // ── Golden Pass — unlimited access, no Firestore read or write ───────────
  if (GOLDEN_PASS_CODES.has(code)) {
    console.log(`[QR] GOLDEN PASS detected — unlimited access granted`);
    return { ok: true, remaining: -1, unlimited: true };
  }

  const ref  = doc(db, COLLECTION, code);

  console.log(`[QR] Collection : ${COLLECTION}`);
  console.log(`[QR] Document ID: ${code}`);

  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        console.warn(`[QR] Document NOT found → qrCodes/${code}`);
        return {
          ok:     false as const,
          reason: 'NOT_FOUND' as const,
          message: 'Invalid QR Code. Please scan a valid SKM QR.',
        };
      }

      const data      = snap.data();
      const active:    boolean = data.active    ?? true;
      const playCount: number  = data.playCount ?? 0;
      const maxPlays:  number  = data.maxPlays  ?? 2;

      console.log(`[QR] Document found → qrCodes/${code}`);
      console.log(`[QR] active    : ${active}`);
      console.log(`[QR] playCount : ${playCount}`);
      console.log(`[QR] maxPlays  : ${maxPlays}`);

      if (!active) {
        console.warn(`[QR] BLOCKED — code is inactive`);
        return {
          ok:     false as const,
          reason: 'INACTIVE' as const,
          message: 'This QR code has been disabled.',
        };
      }

      if (playCount >= maxPlays) {
        console.warn(`[QR] BLOCKED — limit reached (${playCount}/${maxPlays})`);
        return {
          ok:     false as const,
          reason: 'LIMIT_REACHED' as const,
          message: `QR Already Used. Maximum usage limit reached (${playCount}/${maxPlays}).`,
        };
      }

      // Atomically increment playCount
      tx.update(ref, { playCount: playCount + 1 });

      const remaining = maxPlays - (playCount + 1);
      console.log(`[QR] ALLOWED — playCount incremented to ${playCount + 1}/${maxPlays}, remaining: ${remaining}`);

      return { ok: true as const, remaining };
    });

    return result;
  } catch (err: any) {
    console.error('[QR] Firestore error:', err?.message ?? err);
    return {
      ok:     false,
      reason: 'ERROR',
      message: 'Network error. Please check your connection and try again.',
    };
  }
}
