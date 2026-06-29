/**
 * SKM EGG RUNNER — Firebase Cloud Functions
 *
 * Trigger: onDocumentCreated('notifications/{notifId}')
 *   → reads the new notification document
 *   → looks up the target user's FCM token from users/{uid}
 *   → sends a push notification via FCM Admin SDK
 *
 * Security: Only Cloud Functions can call the FCM Admin API.
 * No client-side code can send push notifications directly.
 *
 * Deploy:
 *   cd functions && npm install && npm run build
 *   firebase deploy --only functions --project skm-egg-runner
 */

import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import type { Message, MulticastMessage } from 'firebase-admin/messaging';

admin.initializeApp();

const db        = admin.firestore();
const messaging = admin.messaging();

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationDoc {
  userId:    string;
  title:     string;
  message:   string;
  type:      string;
  priority:  'low' | 'normal' | 'high' | 'urgent';
  read:      boolean;
  targetAll?: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

// ─── Helper: resolve click-action URL from notification type ──────────────────

function clickActionFor(type: string, actionUrl?: string): string {
  if (actionUrl) return `https://skm-egg-runner.web.app${actionUrl.startsWith('/') ? actionUrl : '/' + actionUrl}`;

  switch (type) {
    case 'protein_added':
    case 'protein_goal_complete':
    case 'protein_goal_missed':
    case 'protein_reminder':
    case 'daily_goal_reminder':
    case 'protein_duplicate':
    case 'golden_egg_scanned':
    case 'protein_streak_increased':
    case 'streak_reminder':
    case 'daily_summary':
      return 'https://skm-egg-runner.web.app/?tab=tracker';

    case 'run_completed':
    case 'new_high_score':
    case 'game_reminder':
    case 'mission_complete':
    case 'qr_validated':
    case 'daily_reward_available':
      return 'https://skm-egg-runner.web.app/?tab=game';

    case 'achievement_unlocked':
    case 'level_up':
    case 'protein_milestone':
    case 'streak_milestone':
    case 'champion_rank_improved':
      return 'https://skm-egg-runner.web.app/?tab=profile';

    default:
      return 'https://skm-egg-runner.web.app/';
  }
}

// ─── Helper: FCM Android config by priority ───────────────────────────────────

function androidConfig(priority: string): admin.messaging.AndroidConfig {
  return {
    priority: (priority === 'urgent' || priority === 'high') ? 'high' : 'normal',
    notification: {
      icon:  'ic_notification',
      color: '#D71920',
      channelId: priority === 'urgent' ? 'skm_urgent' : 'skm_default',
      defaultVibrateTimings: true,
    },
  };
}

// ─── Trigger: new notification document created ───────────────────────────────

export const onNotificationCreated = onDocumentCreated(
  'notifications/{notifId}',
  async (event) => {
    const notifId = event.params.notifId;
    const data    = event.data?.data() as NotificationDoc | undefined;

    if (!data) {
      logger.warn('[FCM] onNotificationCreated: no data for notifId', notifId);
      return;
    }

    const { userId, title, message, type, priority, targetAll, actionUrl, metadata } = data;
    const clickAction = clickActionFor(type, actionUrl);

    try {
      if (targetAll) {
        // ── Broadcast to ALL users ─────────────────────────────────────────
        // Fetch all users that have an FCM token. Process in chunks of 500
        // (FCM multicast limit).
        const snap = await db.collection('users')
          .where('fcmToken', '!=', null)
          .select('fcmToken')
          .get();

        const tokens: string[] = [];
        snap.forEach(doc => {
          const token = doc.data().fcmToken as string | null;
          if (token) tokens.push(token);
        });

        if (tokens.length === 0) {
          logger.info('[FCM] Broadcast: no registered tokens.');
          return;
        }

        logger.info(`[FCM] Broadcasting to ${tokens.length} tokens.`);

        // Process in chunks of 500 (FCM multicast limit)
        const CHUNK = 500;
        for (let i = 0; i < tokens.length; i += CHUNK) {
          const chunk = tokens.slice(i, i + CHUNK);
          const multicast: MulticastMessage = {
            tokens: chunk,
            notification: { title, body: message },
            data: {
              type,
              notifId,
              clickAction,
              priority,
              ...(metadata ? flattenMetadata(metadata) : {}),
            },
            android: androidConfig(priority),
            webpush: {
              notification: {
                title,
                body:  message,
                icon:  '/THUMBS_POSE__Egg_-removebg-preview.png',
                badge: '/skm-badge-96.png',
                requireInteraction: priority === 'urgent' || priority === 'high',
              },
              fcmOptions: { link: clickAction },
            },
          };

          const response = await messaging.sendEachForMulticast(multicast);
          logger.info(`[FCM] Broadcast chunk ${i / CHUNK + 1}: success=${response.successCount} fail=${response.failureCount}`);

          // Clean up invalid tokens
          await cleanupInvalidTokens(response, chunk);
        }

      } else {
        // ── Send to specific user ──────────────────────────────────────────
        if (!userId) {
          logger.warn('[FCM] No userId on notification', notifId);
          return;
        }

        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
          logger.info('[FCM] User doc not found for uid:', userId);
          return;
        }

        const fcmToken = userDoc.data()?.fcmToken as string | undefined;
        if (!fcmToken) {
          logger.info('[FCM] No FCM token for uid:', userId, '— push skipped.');
          return;
        }

        const msg: Message = {
          token: fcmToken,
          notification: { title, body: message },
          data: {
            type,
            notifId,
            clickAction,
            priority,
            ...(metadata ? flattenMetadata(metadata) : {}),
          },
          android: androidConfig(priority),
          webpush: {
            notification: {
              title,
              body:  message,
              icon:  '/THUMBS_POSE__Egg_-removebg-preview.png',
              badge: '/skm-badge-96.png',
              requireInteraction: priority === 'urgent' || priority === 'high',
            },
            fcmOptions: { link: clickAction },
          },
        };

        await messaging.send(msg);
        logger.info('[FCM] Push sent to uid:', userId, 'type:', type);
      }

    } catch (err) {
      logger.error('[FCM] Failed to send push notification:', err, { notifId, userId, type });
    }
  }
);

// ─── Helper: flatten metadata to string map (FCM data must be string values) ──

function flattenMetadata(metadata: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata)) {
    result[k] = String(v);
  }
  return result;
}

// ─── Helper: remove invalid/expired FCM tokens from Firestore ────────────────

async function cleanupInvalidTokens(
  response: admin.messaging.BatchResponse,
  tokens: string[]
): Promise<void> {
  const invalidTokens: string[] = [];

  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const code = resp.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });

  if (invalidTokens.length === 0) return;

  logger.info(`[FCM] Cleaning up ${invalidTokens.length} invalid tokens.`);

  // Find and clear fcmToken field for each stale token
  const batch = db.batch();
  for (const token of invalidTokens) {
    const snap = await db.collection('users')
      .where('fcmToken', '==', token)
      .limit(1)
      .get();
    snap.forEach(docSnap => {
      batch.update(docSnap.ref, { fcmToken: admin.firestore.FieldValue.delete() });
    });
  }
  await batch.commit();
}

// ─── Scheduled: daily summary push at 8 PM ───────────────────────────────────

export const scheduledDailySummary = onDocumentCreated(
  // Triggered when a daily_summary notification is created (from client reminder logic)
  // The Cloud Function amplifies it to a push — no separate scheduler needed here.
  // For a true cron-based daily push, use firebase-functions v2 scheduler (requires Blaze plan):
  //   import { onSchedule } from 'firebase-functions/v2/scheduler';
  // We keep it trigger-based to avoid Blaze-only requirements for initial setup.
  'daily_summary_triggers/{docId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    logger.info('[FCM] daily_summary_triggers fired:', event.params.docId);
    // The trigger doc contains { userId, protein, runs, streak }
    // The main notification has already been written to /notifications by the client.
    // This function is a no-op placeholder — actual push is handled by onNotificationCreated.
  }
);
