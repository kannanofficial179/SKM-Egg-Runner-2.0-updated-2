/**
 * SKM PROTEIN TRACKER — Core Service v2
 *
 * Firestore collections:
 *   protein_logs/{uid}/entries/{entryId}       — log entries
 *   daily_stats/{uid}/days/{YYYY-MM-DD}        — daily aggregates
 *   tracker_achievements/{uid}/list/{id}       — achievements
 *   tracker_challenges/{uid}/list/{id}         — challenges
 *   tracker_leaderboard/{uid}                  — leaderboard records
 *   tracker_rewards/{uid}                      — reward wallet
 *   tracker_settings/{uid}                     — goals & prefs
 *   users/{uid}                                — streak + lifetime fields
 */

import {
  doc, collection,
  getDoc, getDocs, setDoc, updateDoc, addDoc, deleteDoc,
  serverTimestamp, Timestamp,
  query, orderBy, limit, where,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
// Shared utilities — single source of truth
import {
  todayKey as _todayKey,
  dateKeyFor as _dateKeyFor,
  dayLabel as _dayLabel,
  getLast7Days as _getLast7Days,
  getLast30Days as _getLast30Days,
  getWeekKey as _getWeekKey,
  getMonthKey as _getMonthKey,
} from '../../utils/dateHelpers';
import {
  PROTEIN_PER_EGG as _PROTEIN_PER_EGG,
  CALORIES_PER_EGG as _CALORIES_PER_EGG,
  DEFAULT_DAILY_GOAL as _DEFAULT_DAILY_GOAL,
  XP_PER_EGG as _XP_PER_EGG,
  XP_PER_GOAL as _XP_PER_GOAL,
  XP_PER_STREAK_DAY as _XP_PER_STREAK_DAY,
  COINS_PER_EGG as _COINS_PER_EGG,
  COINS_PER_GOAL as _COINS_PER_GOAL,
} from '../../constants/tracker';

// ─────────────────────────────────────────────────────────────
// CONSTANTS — re-exported for backward compatibility
// (all callers import from here; the values live in constants/tracker.ts)
// ─────────────────────────────────────────────────────────────

export const PROTEIN_PER_EGG   = _PROTEIN_PER_EGG;
export const CALORIES_PER_EGG  = _CALORIES_PER_EGG;
export const DEFAULT_DAILY_GOAL = _DEFAULT_DAILY_GOAL;
export const XP_PER_EGG         = _XP_PER_EGG;
export const XP_PER_GOAL        = _XP_PER_GOAL;
export const XP_PER_STREAK_DAY  = _XP_PER_STREAK_DAY;
export const COINS_PER_EGG      = _COINS_PER_EGG;
export const COINS_PER_GOAL     = _COINS_PER_GOAL;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface ProteinLogEntry {
  id:        string;
  uid:       string;
  type:      'qr_scan' | 'manual';
  foodName:  string;
  protein:   number;
  calories:  number;
  quantity:  number;
  meal:      'breakfast' | 'lunch' | 'dinner' | 'snack';
  dateKey:   string;
  loggedAt:  Timestamp;
  qrCode?:   string;
  category?: string;
}

export interface DailyStats {
  uid:           string;
  dateKey:       string;
  totalProtein:  number;
  totalCalories: number;
  totalEggs:     number;
  goal:          number;
  entries:       number;
  goalMet:       boolean;
  updatedAt:     Timestamp;
}

export interface TrackerSettings {
  uid:             string;
  dailyGoal:       number;
  reminderEnabled: boolean;
  reminderTimes:   string[];
  age?:            number;
  gender?:         string;
  height?:         number;
  weight?:         number;
  goalWeight?:     number;
  updatedAt:       Timestamp;
}

export interface StreakInfo {
  currentStreak:  number;
  bestStreak:     number;
  lastActiveDate: string;
}

export interface WeeklyData {
  dateKey:      string;
  dayLabel:     string;
  totalProtein: number;
  totalEggs:    number;
  goalMet:      boolean;
  goal:         number;
}

export interface TrackerAchievement {
  id:          string;
  title:       string;
  description: string;
  target:      number;
  progress:    number;
  unlocked:    boolean;
  xpReward:    number;
  coinReward:  number;
  unlockedAt?: Timestamp;
}

export interface Challenge {
  id:          string;
  title:       string;
  description: string;
  type:        'daily' | 'weekly' | 'monthly';
  target:      number;
  progress:    number;
  completed:   boolean;
  claimed:     boolean;
  xpReward:    number;
  coinReward:  number;
  dateKey:     string;
  expiresAt:   string;
}

export interface LeaderboardEntry {
  uid:          string;
  playerName:   string;
  photoURL:     string;
  totalEggs:    number;
  totalProtein: number;
  currentStreak:number;
  xp:           number;
  level:        number;
  rank?:        number;
  updatedAt:    Timestamp;
}

export interface RewardWallet {
  uid:           string;
  coins:         number;
  totalXP:       number;
  level:         number;
  levelTitle:    string;
  updatedAt:     Timestamp;
}

// ─────────────────────────────────────────────────────────────
// DATE HELPERS — re-exported from utils/dateHelpers for backward compat
// All callers that import these from proteinTrackerService continue to work.
// ─────────────────────────────────────────────────────────────

export const todayKey     = _todayKey;
export const dateKeyFor   = _dateKeyFor;
export const dayLabel     = _dayLabel;
export const getLast7Days = _getLast7Days;
export const getLast30Days = _getLast30Days;
export const getWeekKey   = _getWeekKey;
export const getMonthKey  = _getMonthKey;

// ─────────────────────────────────────────────────────────────
// TRACKER SETTINGS
// ─────────────────────────────────────────────────────────────

export async function getTrackerSettings(uid: string): Promise<TrackerSettings> {
  const ref  = doc(db, 'tracker_settings', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as TrackerSettings;
  const defaults: TrackerSettings = {
    uid,
    dailyGoal:       DEFAULT_DAILY_GOAL,
    reminderEnabled: true,
    reminderTimes:   ['08:00', '13:00', '20:00'],
    updatedAt:       serverTimestamp() as Timestamp,
  };
  await setDoc(ref, defaults);
  return defaults;
}

export async function saveTrackerSettings(uid: string, data: Partial<TrackerSettings>): Promise<void> {
  await setDoc(doc(db, 'tracker_settings', uid), { uid, ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// ─────────────────────────────────────────────────────────────
// REWARD WALLET
// ─────────────────────────────────────────────────────────────

export async function getRewardWallet(uid: string): Promise<RewardWallet> {
  const ref  = doc(db, 'tracker_rewards', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as RewardWallet;
  const defaults: RewardWallet = {
    uid, coins: 0, totalXP: 0, level: 1, levelTitle: 'Beginner',
    updatedAt: serverTimestamp() as Timestamp,
  };
  await setDoc(ref, defaults);
  return defaults;
}

export async function addRewards(uid: string, xp: number, coins: number): Promise<RewardWallet> {
  const ref  = doc(db, 'tracker_rewards', uid);
  const snap = await getDoc(ref);
  const curr = snap.exists() ? (snap.data() as RewardWallet) : { coins: 0, totalXP: 0 };
  const newXP    = (curr.totalXP ?? 0) + xp;
  const newCoins = (curr.coins   ?? 0) + coins;
  const lvInfo   = calcLevel(newXP);
  const updated: Partial<RewardWallet> = {
    uid, coins: newCoins, totalXP: newXP,
    level: lvInfo.level, levelTitle: lvInfo.title,
    updatedAt: serverTimestamp() as Timestamp,
  };
  await setDoc(ref, updated, { merge: true });
  return { ...(curr as RewardWallet), ...updated };
}

// ─────────────────────────────────────────────────────────────
// LOG AN EGG (QR scan)
// ─────────────────────────────────────────────────────────────

export async function logEggScan(uid: string, qrCode: string): Promise<{
  entry: ProteinLogEntry; streak: StreakInfo; xpEarned: number; coinsEarned: number;
}> {
  const dateKey = todayKey();
  const entry: Omit<ProteinLogEntry, 'id'> = {
    uid, type: 'qr_scan', foodName: 'SKM Egg',
    protein: PROTEIN_PER_EGG, calories: CALORIES_PER_EGG,
    quantity: 1, meal: getMealByTime(), dateKey,
    loggedAt: serverTimestamp() as Timestamp, qrCode,
    category: 'Eggs',
  };
  const colRef = collection(db, 'protein_logs', uid, 'entries');
  const docRef = await addDoc(colRef, entry);
  await updateDailyStats(uid, dateKey, entry.protein, entry.calories, 1);
  const streakInfo = await updateStreak(uid, dateKey);
  await addRewards(uid, XP_PER_EGG, COINS_PER_EGG);
  await updateChallengeProgress(uid, 'scan_egg', 1);
  return {
    entry: { ...entry, id: docRef.id },
    streak: streakInfo,
    xpEarned: XP_PER_EGG,
    coinsEarned: COINS_PER_EGG,
  };
}

// ─────────────────────────────────────────────────────────────
// LOG MANUAL FOOD ENTRY
// ─────────────────────────────────────────────────────────────

export async function logManualEntry(
  uid: string,
  data: { foodName: string; protein: number; calories: number; quantity: number; meal: ProteinLogEntry['meal']; category?: string }
): Promise<ProteinLogEntry> {
  const dateKey = todayKey();
  const entry: Omit<ProteinLogEntry, 'id'> = {
    uid, type: 'manual', dateKey,
    loggedAt: serverTimestamp() as Timestamp, ...data,
  };
  const colRef = collection(db, 'protein_logs', uid, 'entries');
  const docRef = await addDoc(colRef, entry);
  await updateDailyStats(uid, dateKey, data.protein * data.quantity, data.calories * data.quantity, 0);
  await updateChallengeProgress(uid, 'reach_goal', 0); // triggers goal check
  return { ...entry, id: docRef.id };
}

// ─────────────────────────────────────────────────────────────
// DELETE LOG ENTRY
// ─────────────────────────────────────────────────────────────

export async function deleteLogEntry(uid: string, entryId: string, protein: number, calories: number, isEgg: boolean): Promise<void> {
  await deleteDoc(doc(db, 'protein_logs', uid, 'entries', entryId));
  const dateKey = todayKey();
  const ref  = doc(db, 'daily_stats', uid, 'days', dateKey);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const d = snap.data() as DailyStats;
    await updateDoc(ref, {
      totalProtein:  Math.max(0, d.totalProtein - protein),
      totalCalories: Math.max(0, d.totalCalories - calories),
      totalEggs:     isEgg ? Math.max(0, d.totalEggs - 1) : d.totalEggs,
      entries:       Math.max(0, d.entries - 1),
      updatedAt:     serverTimestamp(),
    });
  }
}

// ─────────────────────────────────────────────────────────────
// QUERY ENTRIES
// ─────────────────────────────────────────────────────────────

export async function getTodayEntries(uid: string): Promise<ProteinLogEntry[]> {
  const q = query(
    collection(db, 'protein_logs', uid, 'entries'),
    where('dateKey', '==', todayKey()),
    orderBy('loggedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProteinLogEntry));
}

export async function getEntriesForDateRange(uid: string, startDate: string, endDate: string): Promise<ProteinLogEntry[]> {
  const q = query(
    collection(db, 'protein_logs', uid, 'entries'),
    where('dateKey', '>=', startDate),
    where('dateKey', '<=', endDate),
    orderBy('dateKey', 'asc'), orderBy('loggedAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProteinLogEntry));
}

export async function getRecentEntries(uid: string, count = 10): Promise<ProteinLogEntry[]> {
  const q = query(
    collection(db, 'protein_logs', uid, 'entries'),
    orderBy('loggedAt', 'desc'), limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProteinLogEntry));
}

// ─────────────────────────────────────────────────────────────
// DAILY STATS
// ─────────────────────────────────────────────────────────────

async function updateDailyStats(uid: string, dateKey: string, protein: number, calories: number, eggs: number): Promise<void> {
  const ref  = doc(db, 'daily_stats', uid, 'days', dateKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const settings = await getTrackerSettings(uid);
    await setDoc(ref, {
      uid, dateKey,
      totalProtein: protein, totalCalories: calories, totalEggs: eggs,
      goal: settings.dailyGoal, entries: 1,
      goalMet: protein >= settings.dailyGoal,
      updatedAt: serverTimestamp(),
    });
  } else {
    const d       = snap.data() as DailyStats;
    const newP    = d.totalProtein + protein;
    const goalMet = newP >= d.goal;
    const wasGoalMet = d.goalMet;
    await updateDoc(ref, {
      totalProtein: newP, totalCalories: d.totalCalories + calories,
      totalEggs: d.totalEggs + eggs, entries: d.entries + 1,
      goalMet, updatedAt: serverTimestamp(),
    });
    // Award bonus if goal was just crossed
    if (goalMet && !wasGoalMet) {
      await addRewards(uid, XP_PER_GOAL, COINS_PER_GOAL);
    }
  }
}

export async function getDailyStats(uid: string, dateKey: string): Promise<DailyStats | null> {
  const snap = await getDoc(doc(db, 'daily_stats', uid, 'days', dateKey));
  return snap.exists() ? (snap.data() as DailyStats) : null;
}

export async function getTodayStats(uid: string): Promise<DailyStats | null> {
  return getDailyStats(uid, todayKey());
}

// ─────────────────────────────────────────────────────────────
// CHART DATA
// ─────────────────────────────────────────────────────────────

export async function getWeeklyData(uid: string): Promise<WeeklyData[]> {
  const days = getLast7Days();
  const goal = (await getTrackerSettings(uid)).dailyGoal;
  const result: WeeklyData[] = [];
  for (const dateKey of days) {
    const stats = await getDailyStats(uid, dateKey);
    result.push({ dateKey, dayLabel: dayLabel(dateKey), totalProtein: stats?.totalProtein ?? 0, totalEggs: stats?.totalEggs ?? 0, goalMet: stats?.goalMet ?? false, goal });
  }
  return result;
}

export async function getMonthlyData(uid: string): Promise<WeeklyData[]> {
  const days = getLast30Days();
  const goal = (await getTrackerSettings(uid)).dailyGoal;
  const result: WeeklyData[] = [];
  for (const dateKey of days) {
    const stats = await getDailyStats(uid, dateKey);
    result.push({
      dateKey,
      dayLabel: new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      totalProtein: stats?.totalProtein ?? 0, totalEggs: stats?.totalEggs ?? 0,
      goalMet: stats?.goalMet ?? false, goal,
    });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// STREAK
// ─────────────────────────────────────────────────────────────

export async function updateStreak(uid: string, dateKey: string): Promise<StreakInfo> {
  const userRef = doc(db, 'users', uid);
  const snap    = await getDoc(userRef);
  if (!snap.exists()) return { currentStreak: 0, bestStreak: 0, lastActiveDate: dateKey };

  const data    = snap.data();
  const current = data.currentConsumptionStreak ?? 0;
  const best    = data.bestConsumptionStreak    ?? 0;
  const lastDate = data.lastConsumptionDate     ?? '';

  const yesterday = new Date(dateKey + 'T12:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = dateKeyFor(yesterday);

  let newStreak = current;
  if      (lastDate === dateKey) { /* already logged today */ }
  else if (lastDate === yKey)    { newStreak = current + 1; }
  else                           { newStreak = 1; }

  const newBest = Math.max(best, newStreak);
  await updateDoc(userRef, {
    currentConsumptionStreak: newStreak,
    bestConsumptionStreak:    newBest,
    lastConsumptionDate:      dateKey,
    lifetimeConsumption:      increment(1),
    totalQRCodesScanned:      increment(1),
    updatedAt:                serverTimestamp(),
  });
  return { currentStreak: newStreak, bestStreak: newBest, lastActiveDate: dateKey };
}

export async function getStreakInfo(uid: string): Promise<StreakInfo> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return { currentStreak: 0, bestStreak: 0, lastActiveDate: '' };
  const d        = snap.data();
  const lastDate = d.lastConsumptionDate ?? '';
  const today    = todayKey();
  const yday     = dateKeyFor((() => { const x = new Date(); x.setDate(x.getDate() - 1); return x; })());
  const isActive = lastDate === today || lastDate === yday;
  return {
    currentStreak:  isActive ? (d.currentConsumptionStreak ?? 0) : 0,
    bestStreak:     d.bestConsumptionStreak ?? 0,
    lastActiveDate: lastDate,
  };
}

// ─────────────────────────────────────────────────────────────
// ACHIEVEMENTS
// ─────────────────────────────────────────────────────────────

export const TRACKER_ACHIEVEMENTS: Omit<TrackerAchievement, 'progress' | 'unlocked' | 'unlockedAt'>[] = [
  { id: 'first_egg',      title: 'First Bite',          description: 'Log your first SKM egg',        target: 1,    xpReward: 50,   coinReward: 10  },
  { id: 'eggs_10',        title: 'Getting Started',     description: 'Log 10 eggs total',             target: 10,   xpReward: 100,  coinReward: 20  },
  { id: 'eggs_50',        title: 'Egg Enthusiast',      description: 'Log 50 eggs total',             target: 50,   xpReward: 250,  coinReward: 50  },
  { id: 'eggs_100',       title: 'Centurion',           description: 'Log 100 eggs total',            target: 100,  xpReward: 500,  coinReward: 100 },
  { id: 'eggs_500',       title: 'Egg Champion',        description: 'Log 500 eggs total',            target: 500,  xpReward: 1500, coinReward: 300 },
  { id: 'eggs_1000',      title: 'SKM Legend',          description: 'Log 1000 eggs total',           target: 1000, xpReward: 5000, coinReward: 1000},
  { id: 'streak_3',       title: '3-Day Streak',        description: 'Log eggs 3 days in a row',      target: 3,    xpReward: 75,   coinReward: 15  },
  { id: 'streak_7',       title: 'Week Warrior',        description: 'Log eggs 7 days in a row',      target: 7,    xpReward: 200,  coinReward: 40  },
  { id: 'streak_14',      title: 'Fortnight Strong',    description: 'Log eggs 14 days in a row',     target: 14,   xpReward: 400,  coinReward: 80  },
  { id: 'streak_30',      title: 'Monthly Champion',    description: 'Log eggs 30 days in a row',     target: 30,   xpReward: 1000, coinReward: 200 },
  { id: 'streak_100',     title: 'Iron Streak',         description: 'Log eggs 100 days in a row',    target: 100,  xpReward: 5000, coinReward: 1000},
  { id: 'goal_met_1',     title: 'Goal Getter',         description: 'Meet your daily protein goal',  target: 1,    xpReward: 50,   coinReward: 10  },
  { id: 'goal_met_7',     title: 'Consistent',          description: 'Meet daily goal 7 times',       target: 7,    xpReward: 200,  coinReward: 40  },
  { id: 'goal_met_30',    title: 'Protein Master',      description: 'Meet daily goal 30 times',      target: 30,   xpReward: 1000, coinReward: 200 },
  { id: 'qr_first',       title: 'QR Pioneer',          description: 'Complete your first QR scan',   target: 1,    xpReward: 50,   coinReward: 10  },
  { id: 'qr_50',          title: 'QR Expert',           description: 'Scan 50 QR eggs',               target: 50,   xpReward: 300,  coinReward: 60  },
];

export async function getTrackerAchievements(uid: string): Promise<TrackerAchievement[]> {
  const snap     = await getDocs(collection(db, 'tracker_achievements', uid, 'list'));
  const existing = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() } as TrackerAchievement]));
  const result: TrackerAchievement[] = [];
  for (const def of TRACKER_ACHIEVEMENTS) {
    if (existing.has(def.id)) {
      result.push(existing.get(def.id)!);
    } else {
      const a: TrackerAchievement = { ...def, progress: 0, unlocked: false };
      await setDoc(doc(db, 'tracker_achievements', uid, 'list', def.id), a);
      result.push(a);
    }
  }
  return result;
}

export async function updateTrackerAchievements(uid: string, userDoc: Record<string, unknown>): Promise<string[]> {
  const lifetime = (userDoc.lifetimeConsumption      as number) ?? 0;
  const streak   = (userDoc.currentConsumptionStreak as number) ?? 0;
  const qrScans  = (userDoc.totalQRCodesScanned      as number) ?? 0;

  const achievements   = await getTrackerAchievements(uid);
  const newlyUnlocked: string[] = [];

  for (const ach of achievements) {
    if (ach.unlocked) continue;
    let progress = 0;
    switch (ach.id) {
      case 'first_egg':   progress = Math.min(lifetime, 1);    break;
      case 'eggs_10':     progress = Math.min(lifetime, 10);   break;
      case 'eggs_50':     progress = Math.min(lifetime, 50);   break;
      case 'eggs_100':    progress = Math.min(lifetime, 100);  break;
      case 'eggs_500':    progress = Math.min(lifetime, 500);  break;
      case 'eggs_1000':   progress = Math.min(lifetime, 1000); break;
      case 'streak_3':    progress = Math.min(streak, 3);      break;
      case 'streak_7':    progress = Math.min(streak, 7);      break;
      case 'streak_14':   progress = Math.min(streak, 14);     break;
      case 'streak_30':   progress = Math.min(streak, 30);     break;
      case 'streak_100':  progress = Math.min(streak, 100);    break;
      case 'qr_first':    progress = Math.min(qrScans, 1);     break;
      case 'qr_50':       progress = Math.min(qrScans, 50);    break;
      default:            progress = ach.progress;
    }
    const unlocked = progress >= ach.target;
    if (progress !== ach.progress || unlocked !== ach.unlocked) {
      await setDoc(doc(db, 'tracker_achievements', uid, 'list', ach.id), {
        ...ach, progress, unlocked,
        ...(unlocked && !ach.unlocked ? { unlockedAt: serverTimestamp() } : {}),
      });
      if (unlocked) {
        newlyUnlocked.push(ach.id);
        await addRewards(uid, ach.xpReward, ach.coinReward);
      }
    }
  }
  return newlyUnlocked;
}

// ─────────────────────────────────────────────────────────────
// CHALLENGES
// ─────────────────────────────────────────────────────────────

const CHALLENGE_DEFINITIONS = [
  { id: 'daily_scan',     title: 'Daily Scan',          description: 'Scan 1 SKM egg today',          type: 'daily'   as const, target: 1,   xpReward: 30,  coinReward: 10 },
  { id: 'daily_goal',     title: 'Reach Your Goal',     description: 'Reach your protein goal today', type: 'daily'   as const, target: 1,   xpReward: 50,  coinReward: 20 },
  { id: 'daily_open',     title: 'Daily Check-in',      description: 'Open the app today',            type: 'daily'   as const, target: 1,   xpReward: 10,  coinReward: 5  },
  { id: 'weekly_eggs',    title: 'Weekly Egg Challenge', description: 'Log 10 eggs this week',        type: 'weekly'  as const, target: 10,  xpReward: 200, coinReward: 75 },
  { id: 'weekly_protein', title: 'Protein Week',        description: 'Reach 200g protein this week',  type: 'weekly'  as const, target: 200, xpReward: 300, coinReward: 100},
  { id: 'monthly_streak', title: 'Streak Month',        description: 'Maintain 20-day streak',        type: 'monthly' as const, target: 20,  xpReward: 1000,coinReward: 300},
  { id: 'monthly_goal',   title: 'Monthly Goal Master', description: 'Meet goal 20 days this month',  type: 'monthly' as const, target: 20,  xpReward: 800, coinReward: 250},
];

function getChallengeExpiry(type: 'daily' | 'weekly' | 'monthly'): string {
  const d = new Date();
  if (type === 'daily') {
    d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0);
  } else if (type === 'weekly') {
    const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilMonday); d.setHours(0, 0, 0, 0);
  } else {
    d.setMonth(d.getMonth() + 1); d.setDate(1); d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
}

export async function getChallenges(uid: string): Promise<Challenge[]> {
  const today = todayKey();
  const weekKey  = getWeekKey();
  const monthKey = getMonthKey();

  const snap   = await getDocs(collection(db, 'tracker_challenges', uid, 'list'));
  const stored = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Challenge]));

  const result: Challenge[] = [];
  for (const def of CHALLENGE_DEFINITIONS) {
    const periodKey = def.type === 'daily' ? today : def.type === 'weekly' ? weekKey : monthKey;
    const existing  = stored.get(def.id);

    // If challenge exists and is for current period, use it
    if (existing && existing.dateKey === periodKey) {
      result.push(existing);
      continue;
    }

    // Create fresh challenge for current period
    const fresh: Challenge = {
      ...def,
      progress: 0, completed: false, claimed: false,
      dateKey: periodKey,
      expiresAt: getChallengeExpiry(def.type),
    };
    await setDoc(doc(db, 'tracker_challenges', uid, 'list', def.id), fresh);
    result.push(fresh);
  }
  return result;
}

export async function updateChallengeProgress(uid: string, triggerType: string, value: number): Promise<void> {
  const challenges = await getChallenges(uid);
  const today      = todayKey();
  const weekKey    = getWeekKey();
  const monthKey   = getMonthKey();

  for (const ch of challenges) {
    if (ch.completed) continue;
    let shouldUpdate = false;
    let newProgress  = ch.progress;

    switch (ch.id) {
      case 'daily_scan':
        if (triggerType === 'scan_egg' && ch.dateKey === today) {
          newProgress = Math.min(1, ch.progress + 1); shouldUpdate = true;
        }
        break;
      case 'daily_open':
        if (triggerType === 'app_open' && ch.dateKey === today) {
          newProgress = 1; shouldUpdate = true;
        }
        break;
      case 'weekly_eggs':
        if (triggerType === 'scan_egg' && ch.dateKey === weekKey) {
          newProgress = Math.min(10, ch.progress + 1); shouldUpdate = true;
        }
        break;
    }

    if (shouldUpdate) {
      const completed = newProgress >= ch.target;
      await setDoc(doc(db, 'tracker_challenges', uid, 'list', ch.id), {
        ...ch, progress: newProgress, completed,
      }, { merge: true });
    }
  }
}

export async function claimChallenge(uid: string, challengeId: string): Promise<{ xp: number; coins: number }> {
  const ref  = doc(db, 'tracker_challenges', uid, 'list', challengeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { xp: 0, coins: 0 };
  const ch = snap.data() as Challenge;
  if (!ch.completed || ch.claimed) return { xp: 0, coins: 0 };
  await updateDoc(ref, { claimed: true });
  await addRewards(uid, ch.xpReward, ch.coinReward);
  return { xp: ch.xpReward, coins: ch.coinReward };
}

// ─────────────────────────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────────────────────────

export async function updateLeaderboard(uid: string, playerName: string, photoURL: string): Promise<void> {
  const [streakInfo, wallet, userSnap] = await Promise.all([
    getStreakInfo(uid),
    getRewardWallet(uid),
    getDoc(doc(db, 'users', uid)),
  ]);
  const userData = userSnap.exists() ? userSnap.data() : {};
  await setDoc(doc(db, 'tracker_leaderboard', uid), {
    uid, playerName, photoURL,
    totalEggs:     userData.lifetimeConsumption ?? 0,
    totalProtein:  (userData.lifetimeConsumption ?? 0) * PROTEIN_PER_EGG,
    currentStreak: streakInfo.currentStreak,
    xp:            wallet.totalXP,
    level:         wallet.level,
    updatedAt:     serverTimestamp(),
  });
}

export async function getLeaderboard(rankBy: 'totalEggs' | 'totalProtein' | 'currentStreak' | 'xp' = 'totalEggs'): Promise<LeaderboardEntry[]> {
  const q    = query(collection(db, 'tracker_leaderboard'), orderBy(rankBy, 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({ id: d.id, rank: i + 1, ...d.data() } as LeaderboardEntry & { id: string }));
}

// ─────────────────────────────────────────────────────────────
// XP / LEVEL SYSTEM
// ─────────────────────────────────────────────────────────────

export function calcXP(lifetime: number, streak: number, goalsMetCount: number): number {
  return lifetime * XP_PER_EGG + streak * XP_PER_STREAK_DAY + goalsMetCount * XP_PER_GOAL;
}

export function calcLevel(xp: number): { level: number; title: string; nextLevelXP: number; currentLevelXP: number } {
  const levels = [
    { xp: 0,     title: 'Beginner'           },
    { xp: 100,   title: 'Egg Starter'        },
    { xp: 250,   title: 'Protein Seeker'     },
    { xp: 500,   title: 'Daily Tracker'      },
    { xp: 1000,  title: 'Nutrition Explorer' },
    { xp: 2000,  title: 'Health Enthusiast'  },
    { xp: 3500,  title: 'Protein Pro'        },
    { xp: 5000,  title: 'Streak Hunter'      },
    { xp: 7500,  title: 'Nutrition Champion' },
    { xp: 10000, title: 'Protein Master'     },
    { xp: 15000, title: 'Egg Legend'         },
    { xp: 25000, title: 'SKM Legend'         },
  ];
  let lvIdx = 0;
  for (let i = levels.length - 1; i >= 0; i--) {
    if (xp >= levels[i].xp) { lvIdx = i; break; }
  }
  return {
    level:         lvIdx + 1,
    title:         levels[lvIdx].title,
    currentLevelXP: levels[lvIdx].xp,
    nextLevelXP:   lvIdx < levels.length - 1 ? levels[lvIdx + 1].xp : levels[lvIdx].xp,
  };
}

// ─────────────────────────────────────────────────────────────
// FOOD DATABASE
// ─────────────────────────────────────────────────────────────

export interface FoodItem {
  name:     string;
  protein:  number;
  calories: number;
  category: string;
  serving:  string;
}

export const FOOD_DATABASE: FoodItem[] = [
  { name: 'SKM Egg (Boiled)',   protein: 6,  calories: 78,  category: 'Eggs',          serving: '1 egg' },
  { name: 'SKM Egg (Fried)',    protein: 6,  calories: 90,  category: 'Eggs',          serving: '1 egg' },
  { name: 'SKM Egg (Scrambled)',protein: 6,  calories: 91,  category: 'Eggs',          serving: '1 egg' },
  { name: 'Egg White',          protein: 4,  calories: 17,  category: 'Eggs',          serving: '1 white' },
  { name: 'Chicken Breast',     protein: 31, calories: 165, category: 'Chicken',       serving: '100g' },
  { name: 'Chicken Thigh',      protein: 26, calories: 209, category: 'Chicken',       serving: '100g' },
  { name: 'Grilled Chicken',    protein: 30, calories: 150, category: 'Chicken',       serving: '100g' },
  { name: 'Salmon',             protein: 25, calories: 208, category: 'Fish',          serving: '100g' },
  { name: 'Tuna',               protein: 30, calories: 132, category: 'Fish',          serving: '100g' },
  { name: 'Milk (Full Fat)',     protein: 8,  calories: 149, category: 'Dairy',         serving: '240ml' },
  { name: 'Paneer',             protein: 18, calories: 265, category: 'Dairy',         serving: '100g' },
  { name: 'Greek Yogurt',       protein: 10, calories: 100, category: 'Dairy',         serving: '100g' },
  { name: 'Whey Protein',       protein: 25, calories: 130, category: 'Supplements',   serving: '1 scoop' },
  { name: 'Almonds',            protein: 6,  calories: 164, category: 'Nuts',          serving: '28g' },
  { name: 'Peanut Butter',      protein: 8,  calories: 188, category: 'Nuts',          serving: '2 tbsp' },
  { name: 'Lentils (Dal)',      protein: 9,  calories: 116, category: 'Legumes',       serving: '100g' },
  { name: 'Chickpeas',          protein: 9,  calories: 164, category: 'Legumes',       serving: '100g' },
  { name: 'Tofu',               protein: 8,  calories: 76,  category: 'Plant Protein', serving: '100g' },
  { name: 'Soya Chunks',        protein: 52, calories: 336, category: 'Plant Protein', serving: '100g dry' },
];

export const FOOD_CATEGORIES = ['All', 'Eggs', 'Chicken', 'Fish', 'Dairy', 'Supplements', 'Nuts', 'Legumes', 'Plant Protein'];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function getMealByTime(): ProteinLogEntry['meal'] {
  const h = new Date().getHours();
  if (h < 11)  return 'breakfast';
  if (h < 15)  return 'lunch';
  if (h < 18)  return 'snack';
  return 'dinner';
}

export function formatProtein(g: number): string {
  return `${g.toFixed(0)}g`;
}

export function getMotivationalMessage(name: string, pct: number): string {
  if (pct === 0)  return `Ready to fuel up, ${name}? Log your first SKM egg today.`;
  if (pct < 25)   return `Good start, ${name}. Keep building your protein intake.`;
  if (pct < 50)   return `On track, ${name}. You are making great progress.`;
  if (pct < 75)   return `Excellent work, ${name}! You are ${Math.round(pct)}% towards today's goal.`;
  if (pct < 100)  return `Almost there, ${name}! Just a little more protein to complete your goal.`;
  return `Outstanding, ${name}! You have reached your protein goal today.`;
}
