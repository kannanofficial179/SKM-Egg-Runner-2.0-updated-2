/**
 * SKM EGG RUNNER — Achievement Service
 * Manages per-player achievements in Firestore.
 * Collection: achievements/{uid}/list/{achievementId}
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import type { Achievement } from '../../types';

// ─────────────────────────────────────────────
// Firestore schema — achievements/{uid}/list/{id}
// ─────────────────────────────────────────────

export interface FirestoreAchievement extends Achievement {
  uid:       string;
  updatedAt: Timestamp | null;
}

// Default achievement templates (mirrors App.tsx DEFAULT_ACHIEVEMENTS)
const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id:          'a1',
    name:        'Industrial Mogul',
    description: 'Collect 1,000 feed bags across all runs',
    progress:    0,
    target:      1000,
    completed:   false,
    claimed:     false,
    rewardType:  'feeds',
    rewardValue: 500,
  },
  {
    id:          'a2',
    name:        'Countryside Voyager',
    description: 'Run a total of 15,000 meters across all runs',
    progress:    0,
    target:      15000,
    completed:   false,
    claimed:     false,
    rewardType:  'gems',
    rewardValue: 30,
  },
  {
    id:          'a3',
    name:        'Runway Star',
    description: 'Unlock 3 distinct chicken skins',
    progress:    1,
    target:      3,
    completed:   false,
    claimed:     false,
    rewardType:  'feeds',
    rewardValue: 800,
  },
];

function achPath(uid: string): string {
  return `achievements/${uid}/list`;
}

// ─────────────────────────────────────────────
// initPlayerAchievements — seed defaults for a new player
// ─────────────────────────────────────────────

export async function initPlayerAchievements(uid: string): Promise<void> {
  try {
    const ops = DEFAULT_ACHIEVEMENTS.map(async (a) => {
      const ref = doc(db, achPath(uid), a.id);
      const snap = await getDoc(ref);
      if (snap.exists()) return; // already seeded

      const record: FirestoreAchievement = {
        ...a,
        uid,
        updatedAt: null,
      };
      await setDoc(ref, { ...record, updatedAt: serverTimestamp() });
    });
    await Promise.all(ops);
  } catch (err) {
    console.error('[achievementService] initPlayerAchievements failed:', err);
  }
}

// ─────────────────────────────────────────────
// checkAchievements — load and return all achievements for the player
// ─────────────────────────────────────────────

export async function checkAchievements(uid: string): Promise<Achievement[]> {
  try {
    const snap = await getDocs(collection(db, achPath(uid)));
    if (snap.empty) {
      await initPlayerAchievements(uid);
      return DEFAULT_ACHIEVEMENTS;
    }
    return snap.docs.map(d => {
      const { uid: _u, updatedAt: _ua, ...ach } = d.data() as FirestoreAchievement;
      return ach as Achievement;
    });
  } catch (err) {
    console.error('[achievementService] checkAchievements failed:', err);
    return [];
  }
}

// ─────────────────────────────────────────────
// updateAchievementProgress — add to cumulative progress
// ─────────────────────────────────────────────

export async function updateAchievementProgress(
  uid: string,
  achievementId: string,
  amount: number
): Promise<void> {
  try {
    const ref  = doc(db, achPath(uid), achievementId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data     = snap.data() as FirestoreAchievement;
    if (data.claimed) return;

    const progress = Math.min(data.target, data.progress + amount);
    await updateDoc(ref, {
      progress,
      completed: progress >= data.target,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[achievementService] updateAchievementProgress failed:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────
// claimAchievement — mark a completed achievement as claimed
// Returns the updated achievement or throws on invalid claim
// ─────────────────────────────────────────────

export async function claimAchievement(
  uid: string,
  achievementId: string
): Promise<Achievement | null> {
  try {
    const ref  = doc(db, achPath(uid), achievementId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data() as FirestoreAchievement;
    if (!data.completed) {
      throw new Error('[achievementService] Cannot claim an incomplete achievement.');
    }
    if (data.claimed) {
      throw new Error('[achievementService] Achievement already claimed.');
    }

    await updateDoc(ref, {
      claimed:   true,
      updatedAt: serverTimestamp(),
    });

    return { ...data, claimed: true } as Achievement;
  } catch (err) {
    console.error('[achievementService] claimAchievement failed:', err);
    throw err;
  }
}
