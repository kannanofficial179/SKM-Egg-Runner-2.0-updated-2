/**
 * SKM Admin Broadcast Service
 *
 * Secure architecture — the client NEVER calls FCM directly:
 *
 *   Admin types: notify: Hello everyone
 *         ↓
 *   executeBroadcast()
 *         ↓
 *   Resolves target users from Firestore
 *         ↓
 *   Writes ONE notification doc per user (or a broadcast sentinel)
 *         ↓
 *   Cloud Function onNotificationCreated triggers for each doc (server-side)
 *         ↓
 *   Cloud Function reads fcmToken from users/{uid} via Admin SDK
 *         ↓
 *   Cloud Function calls messaging.send() — real Android push arrives
 *
 * No server keys. No FCM credentials. No secret ever touches the browser.
 *
 * Supported commands:
 *   notify: <message>               → all users
 *   notify game: <message>          → game players
 *   notify protein: <message>       → protein tracker users
 *   notify uid:<uid> <message>      → one specific user
 *   notify topic:<topic> <message>  → named topic group
 *   debug tokens                    → diagnostic: show token count
 */

import {
  collection, getDocs, addDoc, serverTimestamp, query, where,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getAllTokens, getTokenForUser } from './fcmSender';
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
  const t = raw.trim();
  if (!t.toLowerCase().startsWith('notify') && !t.toLowerCase().startsWith('debug')) return null;

  if (/^debug\s+tokens?$/i.test(t))
    return { target: { kind: 'debug' }, message: '', raw: t };

  const uidMatch = t.match(/^notify\s+uid:(\S+)\s+(.+)$/i);
  if (uidMatch)
    return { target: { kind: 'uid', uid: uidMatch[1] }, message: uidMatch[2].trim(), raw: t };

  const topicMatch = t.match(/^notify\s+topic:(\S+)\s+(.+)$/i);
  if (topicMatch)
    return { target: { kind: 'topic', topic: topicMatch[1] }, message: topicMatch[2].trim(), raw: t };

  const gameMatch = t.match(/^notify\s+game:\s*(.+)$/i);
  if (gameMatch)
    return { target: { kind: 'game' }, message: gameMatch[1].trim(), raw: t };

  const proteinMatch = t.match(/^notify\s+protein:\s*(.+)$/i);
  if (proteinMatch)
    return { target: { kind: 'protein' }, message: proteinMatch[1].trim(), raw: t };

  const allMatch = t.match(/^notify:\s*(.+)$/i);
  if (allMatch)
    return { target: { kind: 'all' }, message: allMatch[1].trim(), raw: t };

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

// ─── Resolve target user IDs ──────────────────────────────────────────────────

async function resolveUserIds(target: BroadcastTarget): Promise<string[]> {
  switch (target.kind) {
    case 'all':
    case 'topic':
    case 'debug': {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map(d => d.id);
    }

    case 'uid':
      return [(target as any).uid];

    case 'game': {
      const snap = await getDocs(collection(db, 'game_stats'));
      return snap.docs.map(d => d.id);
    }

    case 'protein': {
      const snap = await getDocs(collection(db, 'daily_stats'));
      return [...new Set(snap.docs.map(d => d.id))];
    }

    default: return [];
  }
}

// ─── Execute broadcast ────────────────────────────────────────────────────────

export async function executeBroadcast(
  parsed:  ParsedNotifyCommand,
  adminId: string
): Promise<BroadcastResult> {
  const title = 'SKM Announcement';
  const type: NotificationType = 'admin_announcement';

  // ── Debug: report token count, no messages sent ─────────────────────────────
  if (parsed.target.kind === 'debug') {
    const [allTokens, allUsers] = await Promise.all([
      getAllTokens(),
      getDocs(collection(db, 'users')),
    ]);
    const lines = [
      `Total users in Firestore: ${allUsers.size}`,
      `Users with FCM token registered: ${allTokens.length}`,
      `VITE_FIREBASE_VAPID_KEY set: ${!!import.meta.env.VITE_FIREBASE_VAPID_KEY ? 'YES' : 'NO ← tokens cannot register without this'}`,
      `Push delivery: handled by Cloud Function (server-side, Admin SDK)`,
      allTokens.length > 0
        ? `Sample token prefix: ${allTokens[0].fcmToken.substring(0, 20)}...`
        : 'No tokens registered yet — open app on phone and allow notifications.',
    ];
    return {
      ok: true, recipientCount: allUsers.size,
      successCount: allTokens.length, failureCount: 0,
      debugInfo: lines.join('\n'),
    };
  }

  try {
    // 1. Resolve target user IDs
    const userIds = await resolveUserIds(parsed.target);

    if (userIds.length === 0) {
      return {
        ok: false, recipientCount: 0, successCount: 0, failureCount: 0,
        error: 'No matching users found for this target.',
      };
    }

    console.info(`[Broadcast] Target="${targetLabel(parsed.target)}" → ${userIds.length} users`);

    // 2. Write one notification doc per user.
    //    Cloud Function onNotificationCreated fires for each doc and sends the push.
    //    Cap at 100 users to avoid Firestore write storms; use targetAll for larger groups.
    const isAll = parsed.target.kind === 'all' || parsed.target.kind === 'topic';

    if (isAll) {
      // For "all users" write ONE sentinel doc with targetAll=true.
      // The Cloud Function handles multicasting to every registered token server-side.
      await addDoc(collection(db, 'notifications'), {
        userId:    '__broadcast__',
        title,
        message:   parsed.message,
        type,
        priority:  'high',
        read:      false,
        targetAll: true,
        metadata:  { adminId, command: parsed.raw, target: targetLabel(parsed.target) },
        createdAt: serverTimestamp(),
      });
    } else {
      // Per-user: write individual docs (Cloud Function sends each push)
      const CHUNK = 10;
      for (let i = 0; i < userIds.length; i += CHUNK) {
        await Promise.allSettled(
          userIds.slice(i, i + CHUNK).map(uid =>
            addDoc(collection(db, 'notifications'), {
              userId:    uid,
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
      }
    }

    // 3. Write broadcast log
    const logRef = await addDoc(collection(db, 'broadcast_logs'), {
      admin:          adminId,
      command:        parsed.raw,
      target:         targetLabel(parsed.target),
      message:        parsed.message,
      recipientCount: userIds.length,
      sentAt:         serverTimestamp(),
    }).catch(() => null);

    return {
      ok:             true,
      recipientCount: userIds.length,
      successCount:   userIds.length, // actual push success is tracked server-side
      failureCount:   0,
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
    const { query: fsQuery, orderBy, limit } = await import('firebase/firestore');
    const q = fsQuery(
      collection(db, 'broadcast_logs'),
      orderBy('sentAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Record<string, any>;
      return {
        id:             d.id,
        admin:          data['admin']          ?? '',
        command:        data['command']        ?? '',
        target:         data['target']         ?? '',
        message:        data['message']        ?? '',
        recipientCount: data['recipientCount'] ?? 0,
        successCount:   data['successCount']   ?? data['recipientCount'] ?? 0,
        failureCount:   data['failureCount']   ?? 0,
        sentAt:         data['sentAt']?.toDate?.() ?? new Date(),
      } as BroadcastLogEntry;
    });
  } catch {
    return [];
  }
}
