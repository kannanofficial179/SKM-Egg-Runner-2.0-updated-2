/**
 * SKM EGG RUNNER — Developer Config Service
 * Reads/writes live game-balance config from the `gameConfig` Firestore collection.
 * Mirrors the existing LiveConfig interface from liveConfig.ts.
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
import { LiveConfig, DEFAULT_LIVE_CONFIG } from '../../liveConfig';

// ─────────────────────────────────────────────
// Firestore schema — gameConfig/active
// Single document; developers push updates here.
// ─────────────────────────────────────────────

export interface FirestoreGameConfig extends LiveConfig {
  updatedAt: Timestamp | null;
}

// Validation bounds — prevents destructive values from being stored
const CONFIG_BOUNDS: Record<keyof Pick<
  LiveConfig,
  | 'feedSpawnRate' | 'obstacleSpawnRate' | 'vehicleSpawnRate'
  | 'runSpeedMultiplier' | 'crystalEggRewards' | 'missionRewards'
  | 'achievementRewards' | 'envRotationRate' | 'obstacleDensity'
  | 'trafficDensity'
>, [number, number]> = {
  feedSpawnRate:       [0.1, 5.0],
  obstacleSpawnRate:   [0.1, 5.0],
  vehicleSpawnRate:    [0.1, 5.0],
  runSpeedMultiplier:  [0.5, 3.0],
  crystalEggRewards:   [0.1, 10.0],
  missionRewards:      [0.1, 10.0],
  achievementRewards:  [0.1, 10.0],
  envRotationRate:     [0.1, 5.0],
  obstacleDensity:     [0.1, 5.0],
  trafficDensity:      [0.1, 5.0],
};

const DOC_REF = () => doc(db, 'gameConfig', 'active');

// ─────────────────────────────────────────────
// getGameConfig — returns active config or defaults
// ─────────────────────────────────────────────

export async function getGameConfig(): Promise<LiveConfig> {
  try {
    const snap = await getDoc(DOC_REF());
    if (!snap.exists()) {
      // First-time: seed the document with defaults
      await setDoc(DOC_REF(), {
        ...DEFAULT_LIVE_CONFIG,
        updatedAt: serverTimestamp(),
      });
      return { ...DEFAULT_LIVE_CONFIG };
    }

    const data = snap.data() as FirestoreGameConfig;
    const { updatedAt: _ts, ...config } = data;
    return config as LiveConfig;
  } catch (err) {
    console.error('[configService] getGameConfig failed — using defaults:', err);
    return { ...DEFAULT_LIVE_CONFIG };
  }
}

// ─────────────────────────────────────────────
// updateGameConfig — partial update, validated before write
// ─────────────────────────────────────────────

export async function updateGameConfig(
  fields: Partial<LiveConfig>,
  updatedBy = 'DEVELOPER'
): Promise<void> {
  const validated = validateConfig(fields);
  if (!validated.valid) {
    throw new Error(`[configService] Invalid config values: ${validated.errors.join(', ')}`);
  }

  try {
    await updateDoc(DOC_REF(), {
      ...fields,
      updatedBy,
      lastUpdated: new Date().toISOString().split('T')[0],
      updatedAt:   serverTimestamp(),
    });
  } catch (err) {
    console.error('[configService] updateGameConfig failed:', err);
    throw err;
  }
}

// ─────────────────────────────────────────────
// validateConfig — checks numeric fields are within safe bounds
// ─────────────────────────────────────────────

export function validateConfig(
  config: Partial<LiveConfig>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [key, [min, max]] of Object.entries(CONFIG_BOUNDS)) {
    const k   = key as keyof typeof CONFIG_BOUNDS;
    const val = config[k];
    if (val === undefined) continue;
    if (typeof val !== 'number' || isNaN(val)) {
      errors.push(`${key} must be a number`);
    } else if (val < min || val > max) {
      errors.push(`${key} must be between ${min} and ${max} (got ${val})`);
    }
  }

  if (config.stage1EvolutionReq !== undefined) {
    if (config.stage1EvolutionReq < 10 || config.stage1EvolutionReq > 1000) {
      errors.push('stage1EvolutionReq must be between 10 and 1000');
    }
  }
  if (config.stage2EvolutionReq !== undefined) {
    if (config.stage2EvolutionReq < 50 || config.stage2EvolutionReq > 5000) {
      errors.push('stage2EvolutionReq must be between 50 and 5000');
    }
  }

  return { valid: errors.length === 0, errors };
}
