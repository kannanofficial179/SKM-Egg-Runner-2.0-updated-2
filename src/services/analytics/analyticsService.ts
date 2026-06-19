/**
 * SKM EGG RUNNER — Analytics Service
 * Wraps Firebase Analytics logEvent calls.
 * All events are no-ops if analytics is not supported (e.g. ad-blockers, SSR).
 */

import { logEvent } from 'firebase/analytics';
import { analytics } from '../firebase/firebase';

// ─────────────────────────────────────────────
// Internal helper — safely log, never throws
// ─────────────────────────────────────────────

function log(event: string, params?: Record<string, unknown>): void {
  if (!analytics) return;
  try {
    logEvent(analytics, event, params);
  } catch (err) {
    // Silently swallow — analytics should never break the game
    console.warn('[analyticsService] logEvent failed:', err);
  }
}

// ─────────────────────────────────────────────
// Run Events
// ─────────────────────────────────────────────

export function trackRunStarted(uid: string, skinId: string): void {
  log('run_started', { uid, skin_id: skinId });
}

export function trackRunEnded(params: {
  uid:        string;
  score:      number;
  distance:   number;
  feeds:      number;
  crystalEggs: number;
  stage:      string;
  durationMs: number;
}): void {
  log('run_ended', {
    uid:           params.uid,
    score:         params.score,
    distance_m:    params.distance,
    feeds:         params.feeds,
    crystal_eggs:  params.crystalEggs,
    stage:         params.stage,
    duration_ms:   params.durationMs,
  });
}

export function trackRunCrashed(uid: string, distance: number, score: number): void {
  log('run_crashed', { uid, distance_m: distance, score });
}

export function trackReviveUsed(uid: string, gemsSpent: number): void {
  log('revive_used', { uid, gems_spent: gemsSpent });
}

// ─────────────────────────────────────────────
// Feed & Egg Tracking
// ─────────────────────────────────────────────

export function trackFeedsCollected(uid: string, amount: number, isGolden: boolean): void {
  log('feeds_collected', { uid, amount, is_golden: isGolden });
}

export function trackCrystalEggCollected(uid: string): void {
  log('crystal_egg_collected', { uid });
}

export function trackBrownEggLaid(uid: string, totalLaid: number): void {
  log('brown_egg_laid', { uid, total_laid: totalLaid });
}

// ─────────────────────────────────────────────
// Stage Progression
// ─────────────────────────────────────────────

export function trackStageEvolved(
  uid: string,
  from: 'EGG' | 'CHICK',
  to:   'CHICK' | 'ADULT',
  grainsAtEvolution: number
): void {
  log('stage_evolved', { uid, from_stage: from, to_stage: to, grains: grainsAtEvolution });
}

export function trackStage2Entered(uid: string): void {
  log('stage2_entered', { uid });
}

// ─────────────────────────────────────────────
// Economy
// ─────────────────────────────────────────────

export function trackSkinPurchased(uid: string, skinId: string, cost: number, currency: string): void {
  log('skin_purchased', { uid, skin_id: skinId, cost, currency });
}

export function trackMissionClaimed(uid: string, missionId: string, rewardType: string, rewardValue: number): void {
  log('mission_claimed', { uid, mission_id: missionId, reward_type: rewardType, reward_value: rewardValue });
}

export function trackAchievementClaimed(uid: string, achievementId: string, rewardType: string, rewardValue: number): void {
  log('achievement_claimed', { uid, achievement_id: achievementId, reward_type: rewardType, reward_value: rewardValue });
}

export function trackDailyRewardClaimed(uid: string, day: number, rewardType: string, rewardValue: number): void {
  log('daily_reward_claimed', { uid, day, reward_type: rewardType, reward_value: rewardValue });
}

// ─────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────

export function trackSessionStarted(uid: string): void {
  log('session_started', { uid });
}

export function trackSessionEnded(uid: string, totalRunsThisSession: number): void {
  log('session_ended', { uid, runs_this_session: totalRunsThisSession });
}

export function trackNewHighScore(uid: string, score: number): void {
  log('new_high_score', { uid, score });
}
