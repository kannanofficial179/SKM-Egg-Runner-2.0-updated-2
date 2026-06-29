/**
 * SKM Login Notification Service
 *
 * Sends a push notification on every successful login — used to verify
 * the FCM pipeline is working end-to-end.
 *
 * Architecture (secure):
 *   Client writes notification doc to Firestore
 *     → Cloud Function onNotificationCreated triggers (server-side, Admin SDK)
 *     → Cloud Function reads user's fcmToken from Firestore
 *     → Cloud Function calls FCM via Admin SDK
 *     → Android notification appears on device
 *
 * The client NEVER touches FCM or server keys directly.
 *
 * Config flag:
 *   VITE_ENABLE_LOGIN_NOTIFICATION=true   → active (development / testing)
 *   VITE_ENABLE_LOGIN_NOTIFICATION=false  → disabled (production)
 *
 * Default: true — change to false in production .env to suppress login pings.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getTokenForUser } from './fcmSender';

const ENABLE = import.meta.env.VITE_ENABLE_LOGIN_NOTIFICATION !== 'false';

// Dedup: only send once per browser session per uid
const _sentThisSession = new Set<string>();

/**
 * Call after login + FCM token is confirmed saved to Firestore.
 * Writes a notification document — the Cloud Function delivers the push.
 */
export async function sendLoginNotification(uid: string, email?: string): Promise<void> {
  if (!ENABLE) {
    console.info('[FCM] Login notification disabled (VITE_ENABLE_LOGIN_NOTIFICATION=false).');
    return;
  }

  if (_sentThisSession.has(uid)) {
    console.info('[FCM] Login notification already sent this session, uid:', uid);
    return;
  }
  _sentThisSession.add(uid);

  console.info('[FCM] Login notification triggered. uid:', uid, '| email:', email ?? '—');

  try {
    // Confirm the token exists — if not, the CF push would be a no-op anyway
    const token = await getTokenForUser(uid);
    if (!token) {
      console.warn('[FCM] No FCM token for uid:', uid,
        '— user must allow notifications and reload to register device.');
      return;
    }

    console.info('[FCM] Token confirmed for uid:', uid, '| prefix:', token.substring(0, 20) + '...');

    // Write to Firestore → Cloud Function picks it up and sends the real push
    const ref = await addDoc(collection(db, 'notifications'), {
      userId:    uid,
      title:     '👋 Welcome Back!',
      message:   'Welcome back to SKM.\nYour account has been successfully signed in.\nHave a productive and healthy day!',
      type:      'system_update',
      priority:  'normal',
      read:      false,
      targetAll: false,
      actionUrl: '/',
      metadata: {
        trigger: 'login',
        email:   email ?? '',
      },
      createdAt: serverTimestamp(),
    });

    console.info('[FCM] Login notification doc written. id:', ref.id,
      '→ Cloud Function will deliver the push.');

  } catch (err: any) {
    console.error('[FCM] Login notification error:', err?.message ?? err);
  }
}
