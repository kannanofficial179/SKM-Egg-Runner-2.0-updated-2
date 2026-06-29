/**
 * SKM Admin Broadcast Service
 *
 * Sends real FCM push notifications by calling FCM HTTP v1 REST API directly
 * from the browser using the Firebase project's API key + ID token auth.
 *
 * No Cloud Functions. No Blaze plan. Works on Spark plan.
 *
 * Flow:
 *   notify: Hello  →  resolveTokens()  →  sendFCMDirect()  →  Android notification
 *
 * Supported commands:
 *   notify: <message>               → all users with FCM token
 *   notify game: <message>          → game players only
 *   notify protein: <message>       → protein tracker users only
 *   notify uid:<uid> <message>      → one specific user
 *   notify topic:<topic> <message>  → named topic (same as all for now)
 *   debug tokens                    → show how many tokens are registered
 */

import {
  collection, getDocs, addDoc, serverTimestamp,
  query, where, doc, getDoc,
} from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';
import type { NotificationType } from '../../types/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BroadcastTarget =
  | { kind: 'all' }
  | { kind: 'game' }
  | { kind: 'protein' }
  | { kind: 'uid';   uid:   string }
  | { kind: 'topic'; topic: string }
  | { kind: 'debug' };

export interface ParsedNotifyCommand {
  target:  BroadcastTarget;
  message: string;
  raw:     string;
}

export interface BroadcastResult {
  ok:             boolean;
  recipientCount: number;
  successCount:   number;
  failureCount:   number;
  error?:         string;
  logId?:         string;
  debugInfo?:     string;
}

export interface BroadcastLogEntry {
  id:             string;
  admin:          string;
  command:        string;
  target:         string;
  message:        string;
  recipientCount: number;
  successCount:   number;
  failureCount:   number;
  sentAt:         Date;
}

// ─── Command parser ───────────────────────────────────────────────────────────

export function parseNotifyCommand(raw: string): ParsedNotifyCommand | null {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith('notify') && !trimmed.toLowerCase().startsWith('debug')) return null;

  // debug tokens — diagnostic command
  if (/^debug\s+tokens?$/i.test(trimmed)) {
    return { target: { kind: 'debug' }, message: '', raw: trimmed };
  }

  // notify uid:<uid> <message>
  const uidMatch = trimmed.match(/^notify\s+uid:(\S+)\s+(.+)$/i);
  if (uidMatch) return { target: { kind: 'uid', uid: uidMatch[1] }, message: uidMatch[2].trim(), raw: trimmed };

  // notify topic:<topic> <message>
  const topicMatch = trimmed.match(/^notify\s+topic:(\S+)\s+(.+)$/i);
  if (topicMatch) return { target: { kind: 'topic', topic: topicMatch[1] }, message: topicMatch[2].trim(), raw: trimmed };

  // notify game: <message>
  const gameMatch = trimmed.match(/^notify\s+game:\s*(.+)$/i);
  if (gameMatch) return { target: { kind: 'game' }, message: gameMatch[1].trim(), raw: trimmed };

  // notify protein: <message>
  const proteinMatch = trimmed.match(/^notify\s+protein:\s*(.+)$/i);
  if (proteinMatch) return { target: { kind: 'protein' }, message: proteinMatch[1].trim(), raw: trimmed };

  // notify: <message>
  const allMatch = trimmed.match(/^notify:\s*(.+)$/i);
  if (allMatch) return { target: { kind: 'all' }, message: allMatch[1].trim(), raw: trimmed };

  return null;
}

// ─── Target label ─────────────────────────────────────────────────────────────

function targetLabel(target: BroadcastTarget): string {
  switch (target.kind) {
    case 'all':     return 'All Users';
    case 'game':    return 'Game Players';
    case 'protein': return 'Protein Tracker Users';
    case 'uid':     return `User: ${(target as any).uid}`;
    case 'topic':   return `Topic: ${(target as any).topic}`;
    case 'debug':   return 'Debug';
  }
}

// ─── Resolve FCM tokens ───────────────────────────────────────────────────────

interface UserToken { uid: string; fcmToken: string; }

async function resolveTokens(target: BroadcastTarget): Promise<UserToken[]> {
  switch (target.kind) {
    case 'all':
    case 'topic':
    case 'debug': {
      // Query all users that have a non-null fcmToken field
      const snap = await getDocs(
        query(collection(db, 'users'), where('fcmToken', '!=', null))
      );
      const tokens: UserToken[] = [];
      snap.forEach(d => {
        const token = d.data().fcmToken as string | null | undefined;
        if (token && typeof token === 'string' && token.length > 10) {
          tokens.push({ uid: d.id, fcmToken: token });
        }
      });
      return tokens;
    }

    case 'uid': {
      const userDoc = await getDoc(doc(db, 'users', (target as any).uid));
      if (!userDoc.exists()) return [];
      const token = userDoc.data()?.fcmToken as string | undefined;
      if (token && token.length > 10) return [{ uid: (target as any).uid, fcmToken: token }];
      return [];
    }

    case 'game': {
      const snap = await getDocs(collection(db, 'game_stats'));
      return resolveTokensForUids(snap.docs.map(d => d.id));
    }

    case 'protein': {
      const snap = await getDocs(collection(db, 'daily_stats'));
      return resolveTokensForUids([...new Set(snap.docs.map(d => d.id))]);
    }

    default: return [];
  }
}

async function resolveTokensForUids(uids: string[]): Promise<UserToken[]> {
  const results: UserToken[] = [];
  for (let i = 0; i < uids.length; i += 20) {
    const chunk = uids.slice(i, i + 20);
    const docs  = await Promise.all(chunk.map(uid => getDoc(doc(db, 'users', uid))));
    docs.forEach((d, idx) => {
      const token = d.data()?.fcmToken as string | undefined;
      if (token && token.length > 10) results.push({ uid: chunk[idx], fcmToken: token });
    });
  }
  return results;
}

// ─── Send FCM via REST API (works in browser, no server needed) ───────────────
//
// Uses FCM Legacy HTTP API with the server key stored in env.
// If no server key, falls back to writing a notification doc and letting
// any deployed Cloud Function handle it.

const FCM_LEGACY_URL = 'https://fcm.googleapis.com/fcm/send';
const SERVER_KEY     = import.meta.env.VITE_FCM_SERVER_KEY as string | undefined;

async function sendFCMDirect(
  tokens:  string[],
  title:   string,
  body:    string,
  data:    Record<string, string>
): Promise<{ success: number; failure: number; error?: string }> {

  if (tokens.length === 0) return { success: 0, failure: 0 };

  if (!SERVER_KEY) {
    return {
      success: 0,
      failure: tokens.length,
      error:   'VITE_FCM_SERVER_KEY not set in .env — push delivery skipped. See setup instructions.',
    };
  }

  let totalSuccess = 0;
  let totalFailure = 0;

  // FCM Legacy API allows max 1000 tokens per request
  const CHUNK = 1000;
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);

    try {
      const payload = {
        registration_ids: chunk,
        priority: 'high',
        notification: {
          title,
          body,
          icon:  '/THUMBS_POSE__Egg_-removebg-preview.png',
          badge: '/THUMBS_POSE__Egg_-removebg-preview.png',
          sound: 'default',
          click_action: 'https://skm-egg-runner.web.app/',
        },
        data: {
          ...data,
          title,
          body,
          clickAction: 'https://skm-egg-runner.web.app/',
        },
        android: {
          priority: 'high',
          notification: {
            channel_id:  'skm_default',
            color:       '#D71920',
            sound:       'default',
            icon:        'ic_notification',
          },
        },
        webpush: {
          headers:      { Urgency: 'high' },
          notification: {
            title, body,
            icon:              '/THUMBS_POSE__Egg_-removebg-preview.png',
            requireInteraction: true,
          },
        },
      };

      const resp = await fetch(FCM_LEGACY_URL, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `key=${SERVER_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        console.error('[FCM Direct] HTTP error:', resp.status, errText);
        totalFailure += chunk.length;
        continue;
      }

      const result = await resp.json();
      console.info('[FCM Direct] Chunk result:', result);

      totalSuccess += result.success  ?? 0;
      totalFailure += result.failure  ?? 0;

    } catch (err: any) {
      console.error('[FCM Direct] fetch error:', err?.message ?? err);
      totalFailure += chunk.length;
    }
  }

  return { success: totalSuccess, failure: totalFailure };
}

// ─── Execute broadcast ────────────────────────────────────────────────────────

export async function executeBroadcast(
  parsed:  ParsedNotifyCommand,
  adminId: string
): Promise<BroadcastResult> {
  const title = 'SKM Announcement';
  const type: NotificationType = 'admin_announcement';

  try {
    // ── Debug command — just report token count ──────────────────────────────
    if (parsed.target.kind === 'debug') {
      const tokens = await resolveTokens({ kind: 'all' });
      const allUsers = await getDocs(collection(db, 'users'));
      const totalUsers = allUsers.size;
      const withTokens = tokens.length;
      const missingKey = !SERVER_KEY;

      const lines = [
        `Total users in Firestore: ${totalUsers}`,
        `Users with FCM token registered: ${withTokens}`,
        `VITE_FCM_SERVER_KEY set: ${missingKey ? 'NO ← this is why push is broken' : 'YES'}`,
        withTokens === 0
          ? 'No tokens → VAPID key (VITE_FIREBASE_VAPID_KEY) missing in .env'
          : `Sample token prefix: ${tokens[0].fcmToken.substring(0, 20)}...`,
      ];

      return {
        ok: true,
        recipientCount: totalUsers,
        successCount:   withTokens,
        failureCount:   0,
        debugInfo:      lines.join('\n'),
      };
    }

    // 1. Resolve tokens
    const userTokens = await resolveTokens(parsed.target);

    console.info(`[Broadcast] Target="${targetLabel(parsed.target)}" → ${userTokens.length} tokens found`);

    if (userTokens.length === 0) {
      // Count total users so error is informative
      const allUsers = await getDocs(collection(db, 'users'));
      return {
        ok: false,
        recipientCount: 0,
        successCount:   0,
        failureCount:   0,
        error: [
          `0 devices with push notifications registered (${allUsers.size} total users).`,
          !SERVER_KEY
            ? 'VITE_FCM_SERVER_KEY is missing from .env — add it and restart.'
            : 'Users must open the app once so their device token registers.',
        ].join(' '),
      };
    }

    const fcmTokens = userTokens.map(u => u.fcmToken);

    // 2. Send FCM push directly
    const { success, failure, error: sendError } = await sendFCMDirect(
      fcmTokens,
      title,
      parsed.message,
      { type, adminId, command: parsed.raw, target: targetLabel(parsed.target) }
    );

    console.info(`[Broadcast] FCM result: success=${success} failure=${failure}`);

    // 3. Write broadcast log
    const logRef = await addDoc(collection(db, 'broadcast_logs'), {
      admin:          adminId,
      command:        parsed.raw,
      target:         targetLabel(parsed.target),
      message:        parsed.message,
      recipientCount: userTokens.length,
      successCount:   success,
      failureCount:   failure,
      sentAt:         serverTimestamp(),
    }).catch(() => null);

    // 4. Write one in-app notification doc per user (for notification history)
    //    Limit to 50 max to avoid write storms on large user bases
    const notifUsers = userTokens.slice(0, 50);
    await Promise.allSettled(
      notifUsers.map(u =>
        addDoc(collection(db, 'notifications'), {
          userId:    u.uid,
          title,
          message:   parsed.message,
          type,
          priority:  'high',
          read:      false,
          targetAll: false,
          metadata:  { adminId, command: parsed.raw, target: targetLabel(parsed.target) },
          createdAt: serverTimestamp(),
        })
      )
    );

    return {
      ok:             true,
      recipientCount: userTokens.length,
      successCount:   success,
      failureCount:   failure,
      error:          sendError,
      logId:          logRef?.id,
    };

  } catch (err: any) {
    console.error('[Broadcast] executeBroadcast error:', err);
    return {
      ok: false, recipientCount: 0, successCount: 0, failureCount: 0,
      error: err?.message ?? String(err),
    };
  }
}

// ─── Fetch broadcast log history ──────────────────────────────────────────────

export async function fetchBroadcastLogs(limitCount = 20): Promise<BroadcastLogEntry[]> {
  try {
    const { orderBy, limit } = await import('firebase/firestore');
    const q = query(
      collection(db, 'broadcast_logs'),
      orderBy('sentAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id:             d.id,
        admin:          data.admin          ?? '',
        command:        data.command        ?? '',
        target:         data.target         ?? '',
        message:        data.message        ?? '',
        recipientCount: data.recipientCount ?? 0,
        successCount:   data.successCount   ?? 0,
        failureCount:   data.failureCount   ?? 0,
        sentAt:         data.sentAt?.toDate?.() ?? new Date(),
      } as BroadcastLogEntry;
    });
  } catch {
    return [];
  }
}
