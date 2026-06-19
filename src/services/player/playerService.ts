/**
 * SKM EGG RUNNER — Player Service
 * CRUD operations for the `users` Firestore collection.
 * Mirrors the frontend PlayerStats shape plus server-side fields.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import type { PlayerStats } from '../../types';

// ─────────────────────────────────────────────
// Firestore schema — users/{uid}
// ─────────────────────────────────────────────

export interface FirestorePlayer {
  uid:              string;
  playerName:       string;
  bestScore:        number;
  bestDistance:     number;
  currentStage:     'EGG' | 'CHICK' | 'ADULT';
  totalRuns:        number;
  totalFeeds:       number;
  totalCrystalEggs: number;   // gems wallet
  totalBrownEggs:   number;   // stage-2 country eggs
  totalTrays:       number;   // floor(brownEggs / 30)
  totalBatches:     number;   // floor(trays / 10)
  level:            number;
  xp:               number;
  unlockedSkins:    string[];
  activeSkinId:     string;
  dailyRewardStreak: number;
  lastDailyRewardClaim: string | null;
  createdAt:        Timestamp | null;
  updatedAt:        Timestamp | null;
}

// Partial used for patch operations
export type PlayerUpdate = Partial<Omit<FirestorePlayer, 'uid' | 'createdAt'>>;

const USERS = 'users';

// ─────────────────────────────────────────────
// createPlayer — called once on first registration
// ─────────────────────────────────────────────

export async function createPlayer(
  uid: string,
  playerName: string
): Promise<void> {
  const ref = doc(db, USERS, uid);

  const initial: FirestorePlayer = {
    uid,
    playerName:          playerName.trim(),
    bestScore:           0,
    bestDistance:        0,
    currentStage:        'EGG',
    totalRuns:           0,
    totalFeeds:          150,   // starter gift
    totalCrystalEggs:    8,     // enough for one revive
    totalBrownEggs:      0,
    totalTrays:          0,
    totalBatches:        0,
    level:               1,
    xp:                  0,
    unlockedSkins:       ['skin_classic'],
    activeSkinId:        'skin_classic',
    dailyRewardStreak:   0,
    lastDailyRewardClaim: null,
    createdAt:           null,   // will be set by serverTimestamp below
    updatedAt:           null,
  };

  await setDoc(ref, {
    ...initial,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// getPlayer — returns null if document doesn't exist
// ─────────────────────────────────────────────

export async function getPlayer(uid: string): Promise<FirestorePlayer | null> {
  try {
    const snap: DocumentSnapshot = await getDoc(doc(db, USERS, uid));
    if (!snap.exists()) return null;
    return snap.data() as FirestorePlayer;
  } catch (err) {
    console.error('[playerService] getPlayer failed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────
// updatePlayer — merges partial fields into the document
// ─────────────────────────────────────────────

export async function updatePlayer(
  uid: string,
  fields: PlayerUpdate
): Promise<void> {
  try {
    const ref = doc(db, USERS, uid);
    await updateDoc(ref, {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[playerService] updatePlayer failed:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────
// saveGameProgress — syncs full frontend PlayerStats → Firestore
// ─────────────────────────────────────────────

export async function saveGameProgress(
  uid: string,
  stats: PlayerStats,
  currentStage: 'EGG' | 'CHICK' | 'ADULT' = 'EGG',
  totalBrownEggs = 0
): Promise<void> {
  const totalTrays   = Math.floor(totalBrownEggs / 30);
  const totalBatches = Math.floor(totalTrays / 10);

  await updatePlayer(uid, {
    totalFeeds:       stats.totalFeeds,
    totalCrystalEggs: stats.totalGems,
    bestScore:        stats.highscore,
    level:            stats.level,
    xp:               stats.xp,
    unlockedSkins:    stats.unlockedSkins,
    activeSkinId:     stats.activeSkinId,
    dailyRewardStreak: stats.dailyRewardStreak,
    lastDailyRewardClaim: stats.lastDailyRewardClaim ?? null,
    currentStage,
    totalBrownEggs,
    totalTrays,
    totalBatches,
  });
}

// ─────────────────────────────────────────────
// loadGameProgress — converts Firestore doc → frontend PlayerStats
// ─────────────────────────────────────────────

export async function loadGameProgress(uid: string): Promise<PlayerStats | null> {
  const player = await getPlayer(uid);
  if (!player) return null;

  return {
    totalFeeds:          player.totalFeeds,
    totalGems:           player.totalCrystalEggs,
    totalEggs:           player.totalBrownEggs,
    highscore:           player.bestScore,
    level:               player.level,
    xp:                  player.xp,
    unlockedSkins:       player.unlockedSkins,
    activeSkinId:        player.activeSkinId,
    soundEnabled:        true,   // loaded separately from settingsService
    musicEnabled:        true,
    dailyRewardStreak:   player.dailyRewardStreak,
    lastDailyRewardClaim: player.lastDailyRewardClaim ?? undefined,
  };
}

// ─────────────────────────────────────────────
// Granular update helpers
// ─────────────────────────────────────────────

export async function updateDistance(
  uid: string,
  distance: number
): Promise<void> {
  const player = await getPlayer(uid);
  if (!player) return;

  if (distance > player.bestDistance) {
    await updatePlayer(uid, { bestDistance: distance });
  }
}

export async function updateScore(
  uid: string,
  score: number
): Promise<void> {
  const player = await getPlayer(uid);
  if (!player) return;

  if (score > player.bestScore) {
    await updatePlayer(uid, { bestScore: score });
  }
}

export async function updateStage(
  uid: string,
  stage: 'EGG' | 'CHICK' | 'ADULT'
): Promise<void> {
  await updatePlayer(uid, { currentStage: stage });
}

export async function incrementTotalRuns(uid: string): Promise<void> {
  const player = await getPlayer(uid);
  if (!player) return;
  await updatePlayer(uid, { totalRuns: player.totalRuns + 1 });
}
