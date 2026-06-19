/**
 * SKM EGG RUNNER — Settings Service
 * Persists per-player sound/vibration preferences to Firestore.
 * Collection: settings/{uid}
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

// ─────────────────────────────────────────────
// Firestore schema — settings/{uid}
// ─────────────────────────────────────────────

export interface PlayerSettings {
  musicEnabled:     boolean;
  sfxEnabled:       boolean;
  vibrationEnabled: boolean;
}

export interface FirestoreSettings extends PlayerSettings {
  uid:       string;
  updatedAt: Timestamp | null;
}

const DEFAULT_SETTINGS: PlayerSettings = {
  musicEnabled:     true,
  sfxEnabled:       true,
  vibrationEnabled: true,
};

// ─────────────────────────────────────────────
// saveSettings — upsert settings for a player
// ─────────────────────────────────────────────

export async function saveSettings(
  uid: string,
  settings: Partial<PlayerSettings>
): Promise<void> {
  try {
    const ref  = doc(db, 'settings', uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      await updateDoc(ref, { ...settings, updatedAt: serverTimestamp() });
    } else {
      await setDoc(ref, {
        uid,
        ...DEFAULT_SETTINGS,
        ...settings,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('[settingsService] saveSettings failed:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────
// loadSettings — returns stored settings or defaults
// ─────────────────────────────────────────────

export async function loadSettings(uid: string): Promise<PlayerSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', uid));
    if (!snap.exists()) return { ...DEFAULT_SETTINGS };

    const data = snap.data() as FirestoreSettings;
    return {
      musicEnabled:     data.musicEnabled     ?? true,
      sfxEnabled:       data.sfxEnabled       ?? true,
      vibrationEnabled: data.vibrationEnabled ?? true,
    };
  } catch (err) {
    console.error('[settingsService] loadSettings failed:', err);
    return { ...DEFAULT_SETTINGS };
  }
}
