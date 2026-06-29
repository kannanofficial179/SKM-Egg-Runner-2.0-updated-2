/**
 * SKM Reminder Service
 * Smart reminders: max 2 protein reminders/day, 1 game reminder/day.
 * All reminder logic is client-side (no Cloud Functions needed).
 */

import { createNotification, getReminderState, saveReminderState } from './notificationService';
import { getTodayStats, getStreakInfo } from '../protein/proteinTrackerService';
import { todayKey } from '../../utils/dateHelpers';
import type { NotificationSettings } from '../../types/notifications';

const MAX_PROTEIN_REMINDERS = 2;
const MAX_GAME_REMINDERS = 1;

function currentHour(): number {
  return new Date().getHours();
}

export async function checkAndSendReminders(
  userId: string,
  settings: NotificationSettings
): Promise<void> {
  const today = todayKey();
  const hour = currentHour();

  try {
    const reminderState = await getReminderState(userId);

    // Reset counters if it's a new day
    const isNewDayForProtein = reminderState.lastProteinReminder !== today;
    const isNewDayForGame    = reminderState.lastGameReminder    !== today;

    const proteinRemindersToday = isNewDayForProtein ? 0 : reminderState.proteinRemindersToday;
    const gameRemindersToday    = isNewDayForGame    ? 0 : reminderState.gameRemindersToday;

    // ── Protein Reminder ──────────────────────────────────────────────────
    if (settings.proteinReminders && proteinRemindersToday < MAX_PROTEIN_REMINDERS) {
      const stats = await getTodayStats(userId);
      const totalProtein = stats?.totalProtein ?? 0;

      // First reminder: 10 AM if no protein yet
      const shouldRemindAt10 = hour >= 10 && hour < 13 && totalProtein === 0 && proteinRemindersToday === 0;
      // Second reminder: 7 PM if still no protein
      const shouldRemindAt7  = hour >= 19 && hour < 21 && totalProtein === 0 && proteinRemindersToday < 2;

      if (shouldRemindAt10 || shouldRemindAt7) {
        const message = shouldRemindAt10
          ? "Don't forget today's protein. Scan an SKM Egg and earn +6g protein."
          : "Still waiting for today's SKM Egg. Don't miss your daily protein!";

        await createNotification({
          userId,
          title: "Time to Fuel Your Day!",
          message,
          type: 'protein_reminder',
          priority: 'normal',
          actions: [{ label: 'Scan QR', actionType: 'scan_qr' }],
        });

        await saveReminderState(userId, {
          lastProteinReminder: today,
          proteinRemindersToday: proteinRemindersToday + 1,
        });
      }
    }

    // ── Daily Goal Reminder ───────────────────────────────────────────────
    if (settings.proteinReminders && hour >= 15 && hour < 18) {
      const stats = await getTodayStats(userId);
      if (stats && stats.totalProtein > 0 && stats.totalProtein < (stats as any).goal) {
        const remaining = ((stats as any).goal ?? 60) - stats.totalProtein;
        if (remaining > 0 && remaining <= 30) {
          await createNotification({
            userId,
            title: 'Almost There!',
            message: `You're only ${remaining}g away from today's protein goal. You've got this!`,
            type: 'daily_goal_reminder',
            priority: 'normal',
            actions: [{ label: 'Scan QR', actionType: 'scan_qr' }],
          });
        }
      }
    }

    // ── Streak Reminder ───────────────────────────────────────────────────
    if (settings.streakReminders) {
      const streakInfo = await getStreakInfo(userId);
      if (streakInfo.currentStreak >= 3) {
        // Warn at 9 PM if no protein today
        if (hour >= 21 && hour < 23) {
          const stats = await getTodayStats(userId);
          if ((stats?.totalProtein ?? 0) === 0) {
            await createNotification({
              userId,
              title: `Don't Lose Your ${streakInfo.currentStreak}-Day Streak!`,
              message: `Record today's egg before midnight to keep your streak alive!`,
              type: 'streak_reminder',
              priority: 'high',
              actions: [{ label: 'Scan QR', actionType: 'scan_qr' }],
              metadata: { streak: streakInfo.currentStreak },
            });
          }
        }
      }
    }

    // ── Game Reminder ─────────────────────────────────────────────────────
    if (settings.gameReminders && gameRemindersToday < MAX_GAME_REMINDERS) {
      if (hour >= 18 && hour < 20) {
        await createNotification({
          userId,
          title: 'Ready for Another Run?',
          message: 'Your chicken is warmed up and ready to race. Tap to play!',
          type: 'game_reminder',
          priority: 'low',
          actions: [{ label: 'Play Game', actionType: 'play_game' }],
        });

        await saveReminderState(userId, {
          lastGameReminder: today,
          gameRemindersToday: gameRemindersToday + 1,
        });
      }
    }

  } catch (err) {
    // Reminders are non-fatal — silently skip on error
    console.warn('[ReminderService] Non-fatal error:', err);
  }
}

export async function sendDailySummaryIfNeeded(
  userId: string,
  settings: NotificationSettings,
  protein: number,
  runs: number,
  streak: number
): Promise<void> {
  if (!settings.dailySummary) return;
  const hour = currentHour();
  if (hour < 20 || hour > 23) return;

  try {
    const today = todayKey();
    const state = await getReminderState(userId);
    if ((state as any).lastDailySummary === today) return;

    await createNotification({
      userId,
      title: "Today's Summary",
      message: `Protein: ${protein}g · Runs: ${runs} · Streak: ${streak} days. Keep it up!`,
      type: 'daily_summary',
      priority: 'low',
      metadata: { protein, runs, streak },
    });

    await saveReminderState(userId, { ...state, lastDailySummary: today } as any);
  } catch {
    /* non-fatal */
  }
}
