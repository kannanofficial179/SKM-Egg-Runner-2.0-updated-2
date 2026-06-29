/**
 * SKM Notification Service
 * Handles all Firestore CRUD, real-time listeners, and notification helpers.
 */

import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp, getDocs, writeBatch,
  getDoc, setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import type {
  AppNotification,
  NotificationType,
  NotificationPriority,
  NotificationAction,
  NotificationSettings,
  ReminderState,
} from '../../types/notifications';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../types/notifications';

const NOTIFICATIONS_COL = 'notifications';
const NOTIF_SETTINGS_COL = 'notification_settings';
const REMINDER_STATE_COL = 'reminder_state';
const PAGE_SIZE = 20;

// ─── Helpers ───────────────────────────────────────────────────────────────

function firestoreDocToNotification(id: string, data: Record<string, any>): AppNotification {
  return {
    id,
    userId: data.userId ?? '',
    title: data.title ?? '',
    message: data.message ?? '',
    type: data.type as NotificationType,
    priority: (data.priority ?? 'normal') as NotificationPriority,
    read: data.read ?? false,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt ?? Date.now()),
    expiresAt: data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : undefined,
    actionUrl: data.actionUrl,
    actions: data.actions,
    metadata: data.metadata,
    targetAll: data.targetAll,
  };
}

// ─── Create ────────────────────────────────────────────────────────────────

export interface CreateNotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  actionUrl?: string;
  actions?: NotificationAction[];
  metadata?: Record<string, string | number | boolean>;
  expiresAt?: Date;
  targetAll?: boolean;
}

export async function createNotification(payload: CreateNotificationPayload): Promise<string> {
  const ref = await addDoc(collection(db, NOTIFICATIONS_COL), {
    userId: payload.userId,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    priority: payload.priority ?? 'normal',
    read: false,
    createdAt: serverTimestamp(),
    expiresAt: payload.expiresAt ? Timestamp.fromDate(payload.expiresAt) : null,
    actionUrl: payload.actionUrl ?? null,
    actions: payload.actions ?? null,
    metadata: payload.metadata ?? null,
    targetAll: payload.targetAll ?? false,
  });
  return ref.id;
}

// ─── Read (one-shot) ────────────────────────────────────────────────────────

export async function fetchNotifications(
  userId: string,
  options: { unreadOnly?: boolean; pageSize?: number } = {}
): Promise<AppNotification[]> {
  const constraints: any[] = [
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(options.pageSize ?? PAGE_SIZE),
  ];
  if (options.unreadOnly) constraints.push(where('read', '==', false));

  const q = query(collection(db, NOTIFICATIONS_COL), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => firestoreDocToNotification(d.id, d.data()));
}

// ─── Real-time listener ─────────────────────────────────────────────────────

export function subscribeToNotifications(
  userId: string,
  onUpdate: (notifications: AppNotification[]) => void
): () => void {
  const q = query(
    collection(db, NOTIFICATIONS_COL),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snap) => {
    const notifications = snap.docs.map(d => firestoreDocToNotification(d.id, d.data()));
    onUpdate(notifications);
  }, () => {
    // Firestore permission error (e.g. user not allowed) — silently no-op
  });
}

// ─── Mark as read ───────────────────────────────────────────────────────────

export async function markAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS_COL, notificationId), { read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, NOTIFICATIONS_COL),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, NOTIFICATIONS_COL, notificationId));
}

export async function clearAllNotifications(userId: string): Promise<void> {
  const q = query(collection(db, NOTIFICATIONS_COL), where('userId', '==', userId));
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  const ref = doc(db, NOTIF_SETTINGS_COL, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ...DEFAULT_NOTIFICATION_SETTINGS };
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...snap.data() } as NotificationSettings;
}

export async function saveNotificationSettings(userId: string, settings: NotificationSettings): Promise<void> {
  await setDoc(doc(db, NOTIF_SETTINGS_COL, userId), settings, { merge: true });
}

// ─── Reminder state ──────────────────────────────────────────────────────────

export async function getReminderState(userId: string): Promise<ReminderState> {
  const ref = doc(db, REMINDER_STATE_COL, userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { proteinRemindersToday: 0, gameRemindersToday: 0 };
  return snap.data() as ReminderState;
}

export async function saveReminderState(userId: string, state: Partial<ReminderState>): Promise<void> {
  await setDoc(doc(db, REMINDER_STATE_COL, userId), state, { merge: true });
}

// ─── Convenience creators ────────────────────────────────────────────────────

export async function notifyProteinAdded(userId: string, grams: number, total: number): Promise<void> {
  await createNotification({
    userId,
    title: `+${grams}g Protein Added`,
    message: `Your daily protein is now ${total}g. Keep it up!`,
    type: 'protein_added',
    priority: 'normal',
    actionUrl: 'dashboard',
    actions: [{ label: 'View Dashboard', actionType: 'view_dashboard' }],
    metadata: { grams, total },
  });
}

export async function notifyProteinGoalComplete(userId: string, goal: number): Promise<void> {
  await createNotification({
    userId,
    title: 'Daily Protein Goal Reached!',
    message: `Congratulations! You hit ${goal}g today. You're on fire!`,
    type: 'protein_goal_complete',
    priority: 'high',
    actionUrl: 'dashboard',
    actions: [{ label: 'View Stats', actionType: 'view_dashboard' }],
    metadata: { goal },
  });
}

export async function notifyDuplicateEgg(userId: string): Promise<void> {
  await createNotification({
    userId,
    title: 'Duplicate Egg Detected',
    message: 'This egg has already been consumed today.',
    type: 'protein_duplicate',
    priority: 'normal',
    actions: [{ label: 'Scan New QR', actionType: 'scan_qr' }],
  });
}

export async function notifyGoldenEgg(userId: string): Promise<void> {
  await createNotification({
    userId,
    title: 'Golden Egg Scanned!',
    message: 'You found a Golden Egg. Unlimited plays unlocked!',
    type: 'golden_egg_scanned',
    priority: 'high',
    actionUrl: 'game',
    actions: [{ label: 'Play Game', actionType: 'play_game' }],
  });
}

export async function notifyStreakMilestone(userId: string, days: number): Promise<void> {
  await createNotification({
    userId,
    title: `${days}-Day Streak!`,
    message: `You've maintained your protein streak for ${days} days straight. Incredible!`,
    type: 'streak_milestone',
    priority: 'high',
    metadata: { days },
  });
}

export async function notifyProteinMilestone(userId: string, total: number): Promise<void> {
  await createNotification({
    userId,
    title: `${total}g Protein Milestone!`,
    message: `You've consumed ${total}g of protein total. Champion!`,
    type: 'protein_milestone',
    priority: 'high',
    metadata: { total },
  });
}

export async function notifyChampionRank(userId: string, rank: number): Promise<void> {
  await createNotification({
    userId,
    title: 'Champion Hall Rank Improved!',
    message: `Your ranking has improved to #${rank} in the Champion Hall.`,
    type: 'champion_rank_improved',
    priority: 'normal',
    actionUrl: 'leaderboard',
    metadata: { rank },
  });
}

export async function notifyNewHighScore(userId: string, score: number): Promise<void> {
  await createNotification({
    userId,
    title: 'New High Score!',
    message: `You set a new personal best of ${score.toLocaleString()} points!`,
    type: 'new_high_score',
    priority: 'high',
    metadata: { score },
  });
}

export async function notifyMissionComplete(userId: string, missionName: string): Promise<void> {
  await createNotification({
    userId,
    title: 'Mission Complete!',
    message: `You completed "${missionName}". Claim your reward!`,
    type: 'mission_complete',
    priority: 'normal',
    actions: [{ label: 'View Missions', actionType: 'view_achievement' }],
    metadata: { missionName },
  });
}

export async function notifyQRValidated(userId: string, plays: number): Promise<void> {
  await createNotification({
    userId,
    title: 'QR Code Validated',
    message: `Access granted! You have ${plays} play${plays !== 1 ? 's' : ''} available.`,
    type: 'qr_validated',
    priority: 'normal',
    actions: [{ label: 'Play Game', actionType: 'play_game' }],
    metadata: { plays },
  });
}

export async function sendAdminAnnouncement(
  targetUserId: string,
  title: string,
  message: string,
  targetAll = false
): Promise<void> {
  await createNotification({
    userId: targetUserId,
    title,
    message,
    type: 'admin_announcement',
    priority: 'high',
    targetAll,
  });
}

export async function notifyDailySummary(
  userId: string,
  protein: number,
  runs: number,
  streak: number,
  rank?: number
): Promise<void> {
  const rankLine = rank ? ` · Rank #${rank}` : '';
  await createNotification({
    userId,
    title: "Today's Summary",
    message: `Protein: ${protein}g · Runs: ${runs} · Streak: ${streak} days${rankLine}`,
    type: 'daily_summary',
    priority: 'low',
    metadata: { protein, runs, streak, rank: rank ?? 0 },
  });
}
