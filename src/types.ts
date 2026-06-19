/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CurrencyType = 'feeds' | 'gems' | 'eggs';

export interface Skin {
  id: string;
  name: string;
  description?: string;
  cost: number;
  currency: CurrencyType;
  unlocked: boolean;
  color: string;
  accentColor: string;
  trailColor?: string;
  effect?: 'none' | 'golden-glow' | 'robo-neon' | 'rainbow-shift' | 'feather-cloud';
  multiplierBonus: number; // e.g. 1.2x score
  rarity?: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'SPECIAL EVENT';
}

export interface PlayerStats {
  totalFeeds: number;
  totalGems: number;
  totalEggs: number;
  highscore: number;
  level: number;
  xp: number;
  unlockedSkins: string[];
  activeSkinId: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
  lastDailyRewardClaim?: string; // ISO date
  dailyRewardStreak: number;
}

export interface ActiveGameStats {
  score: number;
  feeds: number;
  gems: number;
  eggs: number;
  distance: number;
  speed: number;
  multiplier: number;
}

export interface Mission {
  id: string;
  text: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  rewardType: 'feeds' | 'gems' | 'xp';
  rewardValue: number;
  type?: 'running' | 'feeds' | 'evolution' | 'obstacles' | 'crystal_eggs' | 'stage_missions';
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD' | 'SPECIAL';
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  rewardType: 'feeds' | 'gems';
  rewardValue: number;
}

export enum PowerUpType {
  MAGNET = 'magnet',
  DOUBLE_SCORE = 'double_score',
  SPEED_BOOST = 'speed_boost',
  SHIELD = 'shield',
  FLYING_MODE = 'flying_mode',
}

export interface PowerUpState {
  type: PowerUpType;
  timeLeft: number; // milliseconds or seconds
  duration: number; // total length
}

export type ThemeType =
  | 'POULTRY_FARM'
  | 'CORN_FIELDS'
  | 'WHEAT_FIELDS'
  | 'SKM_FACTORY'
  | 'WAREHOUSE'
  | 'RIVER_AREA'
  | 'VILLAGE_ROADS'
  | 'NIGHT_FARM'
  | 'RAINY_SEASON'
  | 'CITY_DISTRICT';

export interface LeaderboardEntry {
  name: string;
  score: number;
  feeds: number;
  distance: number;
  date: string;
  eggs?: number;
  isPlayer?: boolean;
}
