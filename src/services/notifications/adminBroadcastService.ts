/**
 * SKM Admin Broadcast Service
 *
 * Architecture (Spark plan — no Cloud Functions):
 *
 *   Admin types: notify: Hello everyone
 *         ↓
 *   executeBroadcast()
 *         ↓
 *   1. Query Firestore → collect all user FCM tokens
 *   2. POST /api/send-notification (Vercel serverless)
 *         ↓
 *   Vercel function → FCM Legacy HTTP API (server key)
 *         ↓
 *   Real push notification on every Android device
 *         ↓
 *   3. Write notification docs to Firestore (in-app history)
 *   4. Write broadcast log entry
 *
 * Supported commands:
 *   notify: <message>               → all users
 *   notify game: <message>          → game players
 *   notify protein: <message>       → protein tracker users
 *   notify uid:<uid> <message>      → one specific user
 *   notify topic:<topic> <message>  → named topic group
 */

import {
  collection, getDocs, addDoc, serverTimestamp, query,
  where, doc, getDoc,
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
  ok:             boolean;
  recipientCount: number;
  successCount:   number;
  failureCount:   number;
  error?:         string;
  logId?:         string;
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
  if (!trimmed.toLowerCase().startsWith('notify')) return null;

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
    case 'uid':     return `User: ${target.uid}`;
    case 'topic':   return `Topic: ${target.topic}`;
  }
}

// ─── Resolve FCM tokens for target ───────────────────────────────────────────

interface UserToken {
  uid:      string;
  fcmToken: string;
}

async function resolveTokens(target: BroadcastTarget): Promise<UserToken[]> {
  switch (target.kind) {

    case 'all': {
      // All users that have registered an FCM token
      const snap = await getDocs(
        query(collection(db, 'users'), where('fcmToken', '!=', null))
      );
      const tokens: UserToken[] = [];
      snap.forEach(d => {
        const token = d.data().fcmToken as string | undefined;
        if (token && token.trim()) tokens.push({ uid: d.id, fcmToken: token });
      });
      return tokens;
    }

    case 'uid': {
      const userDoc = await getDoc(doc(db, 'users', target.uid));
      const token   = userDoc.data()?.fcmToken as string | undefined;
      if (token && token.trim()) return [{ uid: target.uid, fcmToken: token }];
      return [];
    }

    case 'game': {
      // Users who have at least one game_stats document AND have an FCM token
      const gameSnap = await getDocs(collection(db, 'game_stats'));
      const gameUids = gameSnap.docs.map(d => d.id);
      return resolveTokensForUids(gameUids);
    }

    case 'protein': {
      // Users who have daily_stats AND have an FCM token
      const statsSnap = await getDocs(collection(db, 'daily_stats'));
      const proteinUids = [...new Set(statsSnap.docs.map(d => d.id))];
      return resolveTokensForUids(proteinUids);
    }

    case 'topic': {
      // For now, topic = all users with token (topic subscription not implemented client-side yet)
      const snap = await getDocs(
        query(collection(db, 'users'), where('fcmToken', '!=', null))
      );
      const tokens: UserToken[] = [];
      snap.forEach(d => {
        const token = d.data().fcmToken as string | undefined;
        if (token && token.trim()) tokens.push({ uid: d.id, fcmToken: token });
      });
      return tokens;
    }

    default:
      return [];
  }
}

// Fetch fcmToken for a list of UIDs in parallel batches
async function resolveTokensForUids(uids: string[]): Promise<UserToken[]> {
  const results: UserToken[] = [];
  const BATCH = 20;
  for (let i = 0; i < uids.length; i += BATCH) {
    const chunk = uids.slice(i, i + BATCH);
    const docs  = await Promise.all(chunk.map(uid => getDoc(doc(db, 'users', uid))));
    docs.forEach((d, idx) => {
      const token = d.data()?.fcmToken as string | undefined;
      if (token && token.trim()) results.push({ uid: chunk[idx], fcmToken: token });
    });
  }
  return results;
}

// ─── Send via Vercel API route ────────────────────────────────────────────────

async function sendViaPushAPI(
  tokens: string[],
  title:  string,
  body:   string,
  data:   Record<string, string>
): Promise<{ success: number; failure: number }> {
  if (tokens.length === 0) return { success: 0, failure: 0 };

  try {
    const resp = await fetch('/api/send-notification', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, title, body, data }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      console.error('[Broadcast] API error:', resp.status, errText);
      return { success: 0, failure: tokens.length };
    }

    const result = await resp.json();
    return {
      success: result.success ?? 0,
      failure: result.failure ?? tokens.length,
    };
  } catch (err) {
    console.error('[Broadcast] fetch error:', err);
    return { success: 0, failure: tokens.length };
  }
}

// ─── Execute broadcast ────────────────────────────────────────────────────────

export async function executeBroadcast(
  parsed:  ParsedNotifyCommand,
  adminId: string
): Promise<BroadcastResult> {
  const title = 'SKM Announcement';
  const type: NotificationType = 'admin_announcement';

  try {
    // 1. Resolve FCM tokens for the target group
    const userTokens = await resolveTokens(parsed.target);

    if (userTokens.length === 0) {
      return {
        ok: false, recipientCount: 0, successCount: 0, failureCount: 0,
        error: 'No devices with push notifications registered. Users need to open the app first to register their device.',
      };
    }

    const fcmTokens = userTokens.map(u => u.fcmToken);

    // 2. Send real push via Vercel API → FCM Legacy HTTP
    const { success, failure } = await sendViaPushAPI(
      fcmTokens,
      title,
      parsed.message,
      {
        type,
        adminId,
        command: parsed.raw,
        target:  targetLabel(parsed.target),
      }
    );

    // 3. Write in-app notification docs to Firestore (notification history)
    //    Only for specific-user or small groups — skip for "all" to avoid 1000s of writes
    if (parsed.target.kind === 'uid') {
      await addDoc(collection(db, 'notifications'), {
        userId:    parsed.target.uid,
        title,
        message:   parsed.message,
        type,
        priority:  'high',
        read:      false,
        targetAll: false,
        metadata:  { adminId, command: parsed.raw, target: targetLabel(parsed.target) },
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }

    // 4. Write broadcast log
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

    return {
      ok:             success > 0 || failure === 0,
      recipientCount: userTokens.length,
      successCount:   success,
      failureCount:   failure,
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
