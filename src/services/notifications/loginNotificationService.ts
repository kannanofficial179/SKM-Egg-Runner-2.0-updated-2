/**
 * SKM Login Notification Service
 *
 * Verifies steps 5–7 of the FCM pipeline:
 *   STEP 5 — Write notification doc to Firestore
 *   STEP 6 — Cloud Function triggers (server-side)
 *   STEP 7 — messaging.send() delivers push to device
 *
 * Steps 6 and 7 happen server-side in Cloud Functions.
 * The client logs "STEP 5 complete" and monitors Firestore for
 * the Cloud Function's delivery confirmation.
 *
 * Config:
 *   VITE_ENABLE_LOGIN_NOTIFICATION=true   (default — testing)
 *   VITE_ENABLE_LOGIN_NOTIFICATION=false  (production)
 */

import {
  collection, addDoc, serverTimestamp,
  doc, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { getTokenForUser } from './fcmSender';

const ENABLE = import.meta.env.VITE_ENABLE_LOGIN_NOTIFICATION !== 'false';

// One send per browser session per uid
const _sentThisSession = new Set<string>();

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

  console.info('[FCM] ── Login Notification Pipeline ─────────────────────────');
  console.info('[FCM] uid:', uid, '| email:', email ?? '—');

  // Confirm token exists before writing (avoids pointless Firestore write)
  console.info('[FCM] Checking FCM token exists in Firestore...');
  const token = await getTokenForUser(uid);

  if (!token) {
    console.error('[FCM] STEP 5 BLOCKED — No FCM token in Firestore for uid:', uid);
    console.error('[FCM]   → User must open app, allow notifications, and reload once.');
    console.error('[FCM]   → VAPID key must be set in .env: VITE_FIREBASE_VAPID_KEY=Bxxx...');
    return;
  }

  console.info('[FCM] Token confirmed in Firestore ✓ (prefix:', token.substring(0, 20) + '...)');

  // STEP 5 — Write notification doc → triggers Cloud Function
  console.info('[FCM] STEP 5 — Writing notification document to Firestore...');
  let docRef;
  try {
    docRef = await addDoc(collection(db, 'notifications'), {
      userId:    uid,
      title:     '👋 Welcome Back!',
      message:   'Welcome back to SKM. Your account has been successfully signed in. Have a productive and healthy day!',
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
    console.info('[FCM] STEP 5 — Notification Document Created ✓ id:', docRef.id);
  } catch (err: any) {
    console.error('[FCM] STEP 5 FAILED — Could not write notification doc:');
    console.error('[FCM]   error:', err?.message ?? String(err));
    console.error('[FCM]   Check Firestore rules allow create on notifications/ for authenticated users.');
    return;
  }

  // STEP 6 + 7 — Monitor Cloud Function delivery
  // The Cloud Function onNotificationCreated adds a 'delivered' field once it calls messaging.send().
  // We watch for up to 15 seconds.
  console.info('[FCM] STEP 6 — Waiting for Cloud Function to trigger...');
  console.info('[FCM]   (Check Firebase Console → Functions → Logs if this step never appears)');

  const notifDocRef = doc(db, 'notifications', docRef.id);
  const timeoutMs   = 15_000;
  let   resolved    = false;

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (!resolved) {
        console.warn('[FCM] STEP 6 TIMEOUT — Cloud Function did not respond within 15s.');
        console.warn('[FCM]   Possible causes:');
        console.warn('[FCM]   1. Cloud Functions not deployed → run: cd functions && npm run build && firebase deploy --only functions');
        console.warn('[FCM]   2. Firebase project is on Spark plan (free) → Cloud Functions require Blaze plan');
        console.warn('[FCM]   3. Function crashed → check Firebase Console → Functions → Logs');
        console.warn('[FCM]   4. Firestore trigger not matching "notifications/{notifId}"');
        resolve();
      }
    }, timeoutMs);

    const unsub = onSnapshot(notifDocRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() ?? {};

      if (data['fcmDelivered'] === true) {
        resolved = true;
        clearTimeout(timer);
        unsub();
        console.info('[FCM] STEP 6 — Cloud Function Triggered ✓');
        console.info('[FCM] STEP 7 — Push Notification Sent ✓');
        console.info('[FCM] ── Pipeline Complete ✓ ─────────────────────────────');
      } else if (data['fcmError']) {
        resolved = true;
        clearTimeout(timer);
        unsub();
        console.error('[FCM] STEP 7 FAILED — Cloud Function reported error:', data['fcmError']);
      }
    }, (err) => {
      console.warn('[FCM] STEP 6 — Could not watch notification doc (non-fatal):', err?.message);
      clearTimeout(timer);
      resolve();
    });
  });
}
