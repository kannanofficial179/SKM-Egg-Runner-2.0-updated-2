/**
 * SKM Egg Streak Service
 *
 * Reads from existing users/{uid} streak fields written by updateStreak().
 * Adds streakHistory/{uid}/days/{YYYY-MM-DD} for calendar view.
 * Computes batch/weekly system purely from streak data.
 */

import {
  doc, collection, getDoc, getDocs, setDoc, query,
  orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { todayKey, dateKeyFor } from '../../utils/dateHelpers';

// ─── Types ────────────────────────────────────────────────────

export interface EggStreakData {
  currentStreak:   number;
  bestStreak:      number;
  lastActiveDate:  string;
  totalEggDays:    number;
  todayCompleted:  boolean;
  todayTime?:      string;
  currentBatch:    number;
  completedBatches: number;
  batchProgress:   number; // days completed in current batch (0-7)
  completionPct:   number; // overall completion %
}

export interface StreakDayRecord {
  dateKey:   string;
  completed: boolean;
  time?:     string; // HH:MM when egg was scanned
}

export interface BatchInfo {
  batchNumber: number;
  startDay:    number; // day index 1-based
  endDay:      number;
  days:        { dateKey: string; completed: boolean }[];
  isComplete:  boolean;
  isLocked:    boolean;
  isCurrent:   boolean;
}

// ─── Emoji / milestone helpers ────────────────────────────────

export function getStreakEmoji(days: number): string {
  if (days >= 365) return '🥇';
  if (days >= 180) return '🌟';
  if (days >= 100) return '🏆';
  if (days >= 75)  return '🚀';
  if (days >= 50)  return '💎';
  if (days >= 30)  return '👑';
  if (days >= 21)  return '⭐';
  if (days >= 14)  return '🔥🔥';
  if (days >= 7)   return '🔥';
  if (days >= 5)   return '🔥';
  if (days >= 3)   return '🐣';
  if (days >= 1)   return '🥚';
  return '🥚';
}

export function getStreakTitle(days: number): string {
  if (days >= 365) return 'SKM Legend';
  if (days >= 180) return 'Elite';
  if (days >= 100) return 'Century Streak';
  if (days >= 75)  return 'Unstoppable';
  if (days >= 50)  return 'Diamond Egg';
  if (days >= 30)  return 'Egg Master';
  if (days >= 21)  return 'Consistent';
  if (days >= 14)  return 'Double Fire';
  if (days >= 7)   return 'On Fire';
  if (days >= 3)   return 'Growing';
  if (days >= 1)   return 'Beginner';
  return 'Start Today';
}

export function getStreakFireLevel(days: number): number {
  // Returns 0-3 for fire animation intensity
  if (days >= 20) return 3;
  if (days >= 10) return 2;
  if (days >= 5)  return 1;
  return 0;
}

export function getMotivationalMessage(days: number, todayDone: boolean): string {
  if (!todayDone) {
    if (days === 0) return "Start your first streak today. One egg changes everything.";
    if (days >= 30) return `Don't lose your ${days}-day streak! Scan today's egg before midnight.`;
    if (days >= 7)  return `You're on a ${days}-day streak! Scan today's egg to keep it alive.`;
    return `${days} days strong! Today's egg is waiting for you.`;
  }
  if (days >= 100) return "100+ days! You are an absolute SKM Legend. Keep going!";
  if (days >= 30)  return `${days} days! You're building an unbreakable healthy habit.`;
  if (days >= 7)   return `${days} days in a row! The habit is forming — you're doing amazing.`;
  if (days >= 3)   return "You're on a roll! Keep the momentum going tomorrow.";
  return "Great start! Come back tomorrow to build your streak.";
}

export function getBatchRewardLabel(batchNum: number): string {
  if (batchNum >= 50) return '🏆 SKM Legend';
  if (batchNum >= 25) return '💎 Diamond Collector';
  if (batchNum >= 10) return '👑 Egg Master';
  if (batchNum >= 5)  return '⭐ Consistency Champion';
  if (batchNum >= 1)  return '🎉 Great Start!';
  return '';
}

// ─── Record a day as completed (called from QRScanScreen after logEggScan) ──

export async function recordStreakDay(uid: string, time?: string): Promise<void> {
  const today = todayKey();
  const ref   = doc(db, 'streakHistory', uid, 'days', today);
  const snap  = await getDoc(ref);
  if (snap.exists()) return; // already recorded today
  await setDoc(ref, {
    dateKey:   today,
    completed: true,
    time:      time ?? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
    recordedAt: serverTimestamp(),
  });
}

// ─── Load streak history (last N days for calendar) ──────────

export async function getStreakHistory(uid: string, days = 60): Promise<StreakDayRecord[]> {
  const ref = collection(db, 'streakHistory', uid, 'days');
  const q   = query(ref, orderBy('dateKey', 'desc'), limit(days));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as StreakDayRecord);
}

// ─── Main streak data loader ──────────────────────────────────

export async function getEggStreakData(uid: string): Promise<EggStreakData> {
  const userSnap = await getDoc(doc(db, 'users', uid));
  const userData = userSnap.exists() ? userSnap.data() : {};

  const today     = todayKey();
  const yesterday = dateKeyFor((() => { const x = new Date(); x.setDate(x.getDate() - 1); return x; })());

  const rawStreak    = userData.currentConsumptionStreak ?? 0;
  const bestStreak   = userData.bestConsumptionStreak    ?? 0;
  const lastDate     = userData.lastConsumptionDate      ?? '';
  const totalEggDays = userData.lifetimeConsumption      ?? 0;

  const todayCompleted  = lastDate === today;
  const yesterdayActive = lastDate === yesterday;
  const isActive        = todayCompleted || yesterdayActive;
  const currentStreak   = isActive ? rawStreak : 0;

  // Today's scan time from streakHistory
  let todayTime: string | undefined;
  if (todayCompleted) {
    const daySnap = await getDoc(doc(db, 'streakHistory', uid, 'days', today));
    if (daySnap.exists()) todayTime = daySnap.data().time;
  }

  // Batch calculation — each batch is 7 consecutive days in the streak
  // currentBatch = which batch we're in (1-based)
  // batchProgress = how many days done in current batch
  const completedBatches = Math.floor(currentStreak / 7);
  const batchProgress    = currentStreak % 7;
  const currentBatch     = completedBatches + 1;

  // Completion % based on best streak relative to milestones
  const milestones      = [7, 14, 21, 30, 50, 75, 100, 180, 365];
  const nextMilestone   = milestones.find(m => m > currentStreak) ?? 365;
  const prevMilestone   = milestones.filter(m => m <= currentStreak).at(-1) ?? 0;
  const range           = nextMilestone - prevMilestone;
  const completionPct   = range > 0
    ? Math.round(((currentStreak - prevMilestone) / range) * 100)
    : 100;

  return {
    currentStreak,
    bestStreak,
    lastActiveDate: lastDate,
    totalEggDays,
    todayCompleted,
    todayTime,
    currentBatch,
    completedBatches,
    batchProgress,
    completionPct,
  };
}

// ─── Build batch list for the weekly batch UI ────────────────

export function buildBatches(currentStreak: number, completedBatches: number): BatchInfo[] {
  const batches: BatchInfo[] = [];
  const totalBatchesToShow   = Math.max(completedBatches + 2, 3);

  for (let b = 1; b <= totalBatchesToShow; b++) {
    const startDay   = (b - 1) * 7 + 1;
    const endDay     = b * 7;
    const isComplete = b <= completedBatches;
    const isCurrent  = b === completedBatches + 1;
    const isLocked   = b > completedBatches + 1;

    const days: { dateKey: string; completed: boolean }[] = [];
    for (let d = startDay; d <= endDay; d++) {
      days.push({ dateKey: '', completed: d <= currentStreak });
    }

    batches.push({ batchNumber: b, startDay, endDay, days, isComplete, isCurrent, isLocked });
  }
  return batches;
}
