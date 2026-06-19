/**
 * SKM EGG RUNNER — Leaderboard Service
 * Manages the `leaderboard` Firestore collection.
 * Real players only — no fake or dummy entries.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  serverTimestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

// ─────────────────────────────────────────────
// Firestore schema — leaderboard/{uid}
// One document per player; overwritten when score improves.
// ─────────────────────────────────────────────

export interface LeaderboardRecord {
  uid:        string;
  playerName: string;
  score:      number;
  distance:   number;
  feeds:      number;
  eggs:       number;
  stage:      'EGG' | 'CHICK' | 'ADULT';
  createdAt:  Timestamp | null;
  updatedAt:  Timestamp | null;
}

export interface RankedRecord extends LeaderboardRecord {
  rank: number;
}

const LB = 'leaderboard';

// ─────────────────────────────────────────────
// submitScore — upsert the player's best score
// Only writes if the new score beats the stored one.
// ─────────────────────────────────────────────

export async function submitScore(
  uid: string,
  playerName: string,
  score: number,
  distance: number,
  feeds: number,
  eggs: number,
  stage: 'EGG' | 'CHICK' | 'ADULT' = 'EGG'
): Promise<void> {
  if (!uid || !playerName.trim()) {
    throw new Error('[leaderboardService] uid and playerName are required.');
  }
  if (score < 0 || distance < 0) {
    throw new Error('[leaderboardService] Score and distance must be non-negative.');
  }

  try {
    const ref  = doc(db, LB, uid);
    const snap: DocumentSnapshot = await getDoc(ref);

    // Only update if this run beats the existing record (or no record yet)
    const existing = snap.exists() ? (snap.data() as LeaderboardRecord) : null;
    if (existing && existing.score >= score) return;

    const record: Omit<LeaderboardRecord, 'createdAt' | 'updatedAt'> = {
      uid,
      playerName: playerName.trim(),
      score,
      distance,
      feeds,
      eggs,
      stage,
    };

    await setDoc(ref, {
      ...record,
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[leaderboardService] submitScore failed:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────
// getTop100Players — returns top 100 sorted by score desc
// ─────────────────────────────────────────────

export async function getTop100Players(): Promise<RankedRecord[]> {
  try {
    const q = query(
      collection(db, LB),
      orderBy('score', 'desc'),
      limit(100)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d, index) => ({
      ...(d.data() as LeaderboardRecord),
      rank: index + 1,
    }));
  } catch (err) {
    console.error('[leaderboardService] getTop100Players failed:', err);
    return [];
  }
}

// ─────────────────────────────────────────────
// getPlayerRank — returns the player's rank (1-based) and record
// ─────────────────────────────────────────────

export async function getPlayerRank(
  uid: string
): Promise<{ rank: number; record: LeaderboardRecord } | null> {
  try {
    const playerSnap = await getDoc(doc(db, LB, uid));
    if (!playerSnap.exists()) return null;

    const playerRecord = playerSnap.data() as LeaderboardRecord;

    // Count how many players have a strictly higher score
    const aboveQuery = query(
      collection(db, LB),
      where('score', '>', playerRecord.score)
    );
    const aboveSnap = await getDocs(aboveQuery);
    const rank = aboveSnap.size + 1;

    return { rank, record: playerRecord };
  } catch (err) {
    console.error('[leaderboardService] getPlayerRank failed:', err);
    return null;
  }
}
