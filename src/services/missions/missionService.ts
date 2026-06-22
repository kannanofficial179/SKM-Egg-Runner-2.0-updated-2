/**
 * SKM EGG RUNNER — Mission Service
 * Manages per-player missions in Firestore.
 * Uses the same MISSION_POOL from the existing missionGenerator.ts.
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
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import type { Mission } from '../../types';
import { generateDailyMissions } from '../../missionGenerator';
import { todayKey } from '../../utils/dateHelpers';

// ─────────────────────────────────────────────
// Firestore schema — missions/{uid}/daily/{missionId}
// ─────────────────────────────────────────────

export interface FirestoreMission extends Mission {
  uid:         string;
  dateKey:     string;     // YYYY-MM-DD — which day the mission was generated
  generatedAt: Timestamp | null;
  updatedAt:   Timestamp | null;
}

function missionPath(uid: string): string {
  return `missions/${uid}/daily`;
}

// ─────────────────────────────────────────────
// generateDailyMissions (Firestore-backed)
// If today's missions already exist → return them.
// Otherwise generate fresh ones and write to Firestore.
// ─────────────────────────────────────────────

export async function generateAndStoreDailyMissions(uid: string): Promise<Mission[]> {
  try {
    const dateKey  = todayKey();
    const colRef   = collection(db, missionPath(uid));
    const existing = query(colRef, where('dateKey', '==', dateKey));
    const snap     = await getDocs(existing);

    if (!snap.empty) {
      // Already generated today — return from Firestore
      return snap.docs.map(d => {
        const data = d.data() as FirestoreMission;
        // Strip server-only fields for the frontend
        const { uid: _uid, dateKey: _dk, generatedAt: _ga, updatedAt: _ua, ...mission } = data;
        return mission as Mission;
      });
    }

    // Generate fresh missions using the existing local generator
    const fresh: Mission[] = generateDailyMissions();

    // Write to Firestore
    const batch = fresh.map(async (m) => {
      const ref = doc(colRef, m.id);
      const record: FirestoreMission = {
        ...m,
        uid,
        dateKey,
        generatedAt: null,   // serverTimestamp set below
        updatedAt:   null,
      };
      await setDoc(ref, {
        ...record,
        generatedAt: serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
    });
    await Promise.all(batch);

    return fresh;
  } catch (err) {
    console.error('[missionService] generateAndStoreDailyMissions failed:', err);
    // Graceful fallback: use the local generator
    return generateDailyMissions();
  }
}

// ─────────────────────────────────────────────
// getPlayerMissions — load today's missions from Firestore
// ─────────────────────────────────────────────

export async function getPlayerMissions(uid: string): Promise<Mission[]> {
  try {
    const dateKey = todayKey();
    const q       = query(
      collection(db, missionPath(uid)),
      where('dateKey', '==', dateKey)
    );
    const snap = await getDocs(q);
    if (snap.empty) return generateAndStoreDailyMissions(uid);

    return snap.docs.map(d => {
      const { uid: _u, dateKey: _d, generatedAt: _g, updatedAt: _up, ...m } = d.data() as FirestoreMission;
      return m as Mission;
    });
  } catch (err) {
    console.error('[missionService] getPlayerMissions failed:', err);
    return [];
  }
}

// ─────────────────────────────────────────────
// updateMissionProgress — writes updated progress back to Firestore
// ─────────────────────────────────────────────

export async function updateMissionProgress(
  uid: string,
  missionId: string,
  progress: number
): Promise<void> {
  try {
    const ref = doc(db, missionPath(uid), missionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data   = snap.data() as FirestoreMission;
    const capped = Math.min(data.target, Math.max(0, progress));

    await updateDoc(ref, {
      progress:  capped,
      completed: capped >= data.target,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[missionService] updateMissionProgress failed:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────
// claimMissionReward — mark a completed mission as claimed
// ─────────────────────────────────────────────

export async function claimMissionReward(
  uid: string,
  missionId: string
): Promise<Mission | null> {
  try {
    const ref  = doc(db, missionPath(uid), missionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data() as FirestoreMission;
    if (!data.completed) {
      throw new Error('[missionService] Cannot claim an incomplete mission.');
    }
    if (data.claimed) {
      throw new Error('[missionService] Mission reward already claimed.');
    }

    await updateDoc(ref, {
      claimed:   true,
      updatedAt: serverTimestamp(),
    });

    return { ...data, claimed: true } as Mission;
  } catch (err) {
    console.error('[missionService] claimMissionReward failed:', err);
    throw err;
  }
}
