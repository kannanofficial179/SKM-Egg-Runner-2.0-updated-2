/**
 * SKM Admin Broadcast Service
 *
 * Parses developer notify commands and creates Firestore notification documents.
 * The Cloud Function (functions/src/index.ts onNotificationCreated) picks up each
 * new document and dispatches the real FCM push to every target device.
 *
 * Supported commands
 * ──────────────────
 *   notify: <message>                → all users
 *   notify game: <message>           → users who have played a game
 *   notify protein: <message>        → users who have used protein tracker
 *   notify uid:<uid> <message>       → one specific user
 *   notify topic:<topic> <message>   → a named topic group
 *
 * Flow
 * ────
 *   Admin types command
 *     → parseNotifyCommand()
 *     → executeBroadcast()
 *     → createNotification() per user (or targetAll flag)
 *     → Cloud Function reads FCM token → sends push
 *     → broadcastLog entry written to Firestore
 */

import {
  collection, getDocs, addDoc, serverTimestamp, query, where,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import type { NotificationType } from '../../types/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BroadcastTarget =
  | { kind: 'all' }
  | { kind: 'game' }
  | { kind: 'protein' }
  | { kind: 'uid';   uid:   string }
  | { kind: 'topic'; topic: string };

export interface ParsedNotifyCommand {
  target:  BroadcastTarget;
  message: string;
  raw:     string;
}

export interface BroadcastResult {
  ok:           boolean;
  recipientCount: number;
  successCount:  number;
  failureCount:  number;
  error?:        string;
  logId?:        string;
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

/**
 * Parse a raw notify command string.
 * Returns null if the syntax doesn't match any supported pattern.
 *
 * Examples:
 *   "notify: Hello everyone"          → { target: { kind: 'all' }, message: 'Hello everyone' }
 *   "notify game: New challenge!"     → { target: { kind: 'game' }, message: 'New challenge!' }
 *   "notify protein: Check your goal" → { target: { kind: 'protein' }, message: 'Check your goal' }
 *   "notify uid:abc123 Test"          → { target: { kind: 'uid', uid: 'abc123' }, message: 'Test' }
 *   "notify topic:golden Golden event"→ { target: { kind: 'topic', topic: 'golden' }, message: 'Golden event' }
 */
export function parseNotifyCommand(raw: string): ParsedNotifyCommand | null {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith('notify')) return null;

  // notify uid:<uid> <message>
  const uidMatch = trimmed.match(/^notify\s+uid:(\S+)\s+(.+)$/i);
  if (uidMatch) {
    return {
      target:  { kind: 'uid', uid: uidMatch[1] },
      message: uidMatch[2].trim(),
      raw:     trimmed,
    };
  }

  // notify topic:<topic> <message>
  const topicMatch = trimmed.match(/^notify\s+topic:(\S+)\s+(.+)$/i);
  if (topicMatch) {
    return {
      target:  { kind: 'topic', topic: topicMatch[1] },
      message: topicMatch[2].trim(),
      raw:     trimmed,
    };
  }

  // notify game: <message>
  const gameMatch = trimmed.match(/^notify\s+game:\s*(.+)$/i);
  if (gameMatch) {
    return {
      target:  { kind: 'game' },
      message: gameMatch[1].trim(),
      raw:     trimmed,
    };
  }

  // notify protein: <message>
  const proteinMatch = trimmed.match(/^notify\s+protein:\s*(.+)$/i);
  if (proteinMatch) {
    return {
      target:  { kind: 'protein' },
      message: proteinMatch[1].trim(),
      raw:     trimmed,
    };
  }

  // notify: <message>  (all users)
  const allMatch = trimmed.match(/^notify:\s*(.+)$/i);
  if (allMatch) {
    return {
      target:  { kind: 'all' },
      message: allMatch[1].trim(),
      raw:     trimmed,
    };
  }

  return null;
}

// ─── Resolve target user IDs ──────────────────────────────────────────────────

async function resolveTargetUserIds(target: BroadcastTarget): Promise<string[]> {
  switch (target.kind) {
    case 'all': {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map(d => d.id);
    }

    case 'uid':
      return [target.uid];

    case 'game': {
      // Users who have at least one game_stats document
      const snap = await getDocs(collection(db, 'game_stats'));
      return snap.docs.map(d => d.id);
    }

    case 'protein': {
      // Users who have a protein_logs collection (at least one entry)
      // We query the top-level protein_logs collection for unique parent UIDs
      const snap = await getDocs(collection(db, 'daily_stats'));
      const uids = new Set<string>(snap.docs.map(d => d.id));
      return Array.from(uids);
    }

    case 'topic': {
      // For topics we send to all users but tag it — the Cloud Function or FCM handles topic routing
      // For simplicity we resolve to all users here and let the notification metadata carry the topic
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map(d => d.id);
    }

    default:
      return [];
  }
}

function targetLabel(target: BroadcastTarget): string {
  switch (target.kind) {
    case 'all':     return 'All Users';
    case 'game':    return 'Game Players';
    case 'protein': return 'Protein Tracker Users';
    case 'uid':     return `User: ${target.uid}`;
    case 'topic':   return `Topic: ${target.topic}`;
  }
}

// ─── Execute broadcast ────────────────────────────────────────────────────────

/**
 * Execute a parsed notify command.
 * Creates one Firestore notification document per target user.
 * The Cloud Function onNotificationCreated fires for each document
 * and dispatches the real FCM push.
 *
 * @param parsed  - Result of parseNotifyCommand()
 * @param adminId - UID of the admin sending the broadcast
 */
export async function executeBroadcast(
  parsed: ParsedNotifyCommand,
  adminId: string
): Promise<BroadcastResult> {
  const title   = 'SKM Announcement';
  const type: NotificationType = 'admin_announcement';

  try {
    // 1. Resolve target users
    const userIds = await resolveTargetUserIds(parsed.target);

    if (userIds.length === 0) {
      return { ok: false, recipientCount: 0, successCount: 0, failureCount: 0, error: 'No matching users found.' };
    }

    // 2. Create notification documents — Cloud Function picks each up and sends push
    const isTargetAll = parsed.target.kind === 'all';
    let successCount  = 0;
    let failureCount  = 0;

    // For "all" broadcasts, create ONE sentinel document with targetAll=true.
    // The Cloud Function queries all fcmTokens and multicasts in one pass.
    if (isTargetAll) {
      await addDoc(collection(db, 'notifications'), {
        userId:    '__broadcast__',
        title,
        message:   parsed.message,
        type,
        priority:  'high',
        read:      false,
        targetAll: true,
        metadata:  {
          adminId,
          command:   parsed.raw,
          target:    targetLabel(parsed.target),
        },
        createdAt: serverTimestamp(),
      });
      successCount = userIds.length;
    } else {
      // Per-user: batch in chunks of 10 concurrent writes
      const CHUNK = 10;
      for (let i = 0; i < userIds.length; i += CHUNK) {
        const chunk = userIds.slice(i, i + CHUNK);
        const results = await Promise.allSettled(
          chunk.map(uid =>
            addDoc(collection(db, 'notifications'), {
              userId:    uid,
              title,
              message:   parsed.message,
              type,
              priority:  'high',
              read:      false,
              targetAll: false,
              metadata:  {
                adminId,
                command:   parsed.raw,
                target:    targetLabel(parsed.target),
                ...(parsed.target.kind === 'topic' ? { topic: parsed.target.topic } : {}),
              },
              createdAt: serverTimestamp(),
            })
          )
        );
        results.forEach(r => {
          if (r.status === 'fulfilled') successCount++;
          else failureCount++;
        });
      }
    }

    // 3. Write broadcast log to Firestore
    const logRef = await addDoc(collection(db, 'broadcast_logs'), {
      admin:          adminId,
      command:        parsed.raw,
      target:         targetLabel(parsed.target),
      message:        parsed.message,
      recipientCount: userIds.length,
      successCount,
      failureCount,
      sentAt:         serverTimestamp(),
    });

    return {
      ok:             true,
      recipientCount: userIds.length,
      successCount,
      failureCount,
      logId:          logRef.id,
    };

  } catch (err: any) {
    console.error('[AdminBroadcast] executeBroadcast error:', err);
    return {
      ok:             false,
      recipientCount: 0,
      successCount:   0,
      failureCount:   0,
      error:          err?.message ?? String(err),
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
