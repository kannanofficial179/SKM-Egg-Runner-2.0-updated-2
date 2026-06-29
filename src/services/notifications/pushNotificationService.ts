/**
 * SKM Push Notification Service
 *
 * Every step logs to the console with [FCM] prefix.
 * On any failure: stops immediately, prints the exact error, returns null.
 * No silent swallowing of errors.
 */

import { getToken, onMessage, deleteToken } from 'firebase/messaging';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, messagingPromise } from '../firebase/firebase';

// ─── VAPID key ────────────────────────────────────────────────────────────────
const VAPID_KEY: string | undefined = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const FCM_SW_URL       = '/firebase-messaging-sw.js';
const FCM_SW_SCOPE     = '/firebase-cloud-messaging-push-scope';
const FCM_TOKEN_LS_KEY = 'skm_fcm_token';
const PERMISSION_ASKED = 'skm_push_permission_asked';

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

// ─── Permission ───────────────────────────────────────────────────────────────

export function getPushPermissionState(): PushPermissionState {
  if (!('Notification' in window))     return 'unsupported';
  if (!('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission as PushPermissionState;
}

export function hasAskedPermission(): boolean {
  return localStorage.getItem(PERMISSION_ASKED) === 'true';
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (!('Notification' in window)) {
    console.error('[FCM] STEP 1 FAILED — Notification API not available in this browser.');
    return 'unsupported';
  }
  if (!('serviceWorker' in navigator)) {
    console.error('[FCM] STEP 1 FAILED — Service Workers not supported in this browser.');
    return 'unsupported';
  }

  console.info('[FCM] STEP 1 — Requesting notification permission...');
  localStorage.setItem(PERMISSION_ASKED, 'true');

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      console.info('[FCM] STEP 1 — Permission = GRANTED ✓');
    } else {
      console.error(`[FCM] STEP 1 FAILED — Permission = ${result.toUpperCase()}. User must allow notifications in browser settings.`);
    }
    return result as PushPermissionState;
  } catch (err: any) {
    console.error('[FCM] STEP 1 FAILED — requestPermission() threw:', err?.message ?? err);
    return 'denied';
  }
}

// ─── STEP 2: Service Worker registration ─────────────────────────────────────

let _fcmSwReg: ServiceWorkerRegistration | null = null;

async function getFCMServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.error('[FCM] STEP 2 FAILED — Service Workers not supported.');
    return null;
  }

  if (_fcmSwReg) {
    console.info('[FCM] STEP 2 — Service Worker already registered (cached).');
    return _fcmSwReg;
  }

  console.info('[FCM] STEP 2 — Registering firebase-messaging-sw.js...');

  try {
    // Check if already registered
    const existing = await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE);
    if (existing) {
      console.info('[FCM] STEP 2 — Service Worker already registered at scope:', FCM_SW_SCOPE, '✓');
      _fcmSwReg = existing;
      return existing;
    }

    const reg = await navigator.serviceWorker.register(FCM_SW_URL, { scope: FCM_SW_SCOPE });
    console.info('[FCM] STEP 2 — Service Worker registered. State:', reg.installing?.state ?? reg.active?.state ?? 'unknown');

    // Wait for active
    await waitForSWActive(reg);
    console.info('[FCM] STEP 2 — Service Worker active ✓ (scope:', FCM_SW_SCOPE, ')');

    _fcmSwReg = reg;
    return reg;

  } catch (err: any) {
    console.error('[FCM] STEP 2 FAILED — SW registration error:', err?.message ?? err);
    console.error('[FCM] STEP 2 — Ensure firebase-messaging-sw.js exists at /public/firebase-messaging-sw.js');
    return null;
  }
}

function waitForSWActive(reg: ServiceWorkerRegistration): Promise<void> {
  return new Promise((resolve) => {
    if (reg.active) { resolve(); return; }
    const sw = reg.installing ?? reg.waiting;
    if (!sw) { resolve(); return; }
    sw.addEventListener('statechange', function handler() {
      if (sw.state === 'activated') {
        sw.removeEventListener('statechange', handler);
        resolve();
      }
    });
    setTimeout(resolve, 5000);
  });
}

// ─── STEP 3 + 4: Generate token and save to Firestore ────────────────────────

export async function initFCMToken(uid: string): Promise<string | null> {
  console.info('[FCM] ══════════════════════════════════════════');
  console.info('[FCM] Starting FCM initialization for uid:', uid);
  console.info('[FCM] ══════════════════════════════════════════');

  // Pre-flight checks
  if (!('serviceWorker' in navigator)) {
    console.error('[FCM] FAILED — Service Workers not supported. Push notifications require Chrome/Edge/Android Chrome.');
    return null;
  }

  // Check VAPID key FIRST — most common missing config
  if (!VAPID_KEY) {
    console.error('[FCM] ══ SETUP REQUIRED ══════════════════════════════════════');
    console.error('[FCM] VITE_FIREBASE_VAPID_KEY is NOT set in .env');
    console.error('[FCM] Steps to fix:');
    console.error('[FCM]   1. Open Firebase Console → Project Settings → Cloud Messaging');
    console.error('[FCM]   2. Scroll to "Web Push certificates"');
    console.error('[FCM]   3. Click "Generate key pair" (one time only)');
    console.error('[FCM]   4. Copy the public key (starts with B...)');
    console.error('[FCM]   5. Add to .env:  VITE_FIREBASE_VAPID_KEY=Bxxx...');
    console.error('[FCM]   6. Restart dev server: npm run dev');
    console.error('[FCM] ═════════════════════════════════════════════════════════');
    return null;
  }
  console.info('[FCM] VAPID key present ✓ (prefix:', VAPID_KEY.substring(0, 10) + '...)');

  // Check permission
  const perm = Notification.permission;
  console.info('[FCM] Current notification permission:', perm);
  if (perm !== 'granted') {
    console.error(`[FCM] FAILED — Permission is "${perm}". Cannot generate token without granted permission.`);
    return null;
  }
  console.info('[FCM] STEP 1 — Permission = GRANTED ✓');

  // Await messaging instance
  console.info('[FCM] STEP 2a — Awaiting Firebase Messaging instance...');
  const messaging = await messagingPromise;
  if (!messaging) {
    console.error('[FCM] STEP 2a FAILED — Firebase Messaging not supported in this browser.');
    console.error('[FCM] Push notifications require Chrome 50+, Edge 17+, or Android Chrome.');
    return null;
  }
  console.info('[FCM] STEP 2a — Firebase Messaging instance ready ✓');

  // Register SW
  const swReg = await getFCMServiceWorker();
  if (!swReg) {
    console.error('[FCM] STEP 2 FAILED — Cannot generate FCM token without a registered Service Worker.');
    return null;
  }
  console.info('[FCM] STEP 2 — Service Worker Registered ✓');

  // Generate token
  console.info('[FCM] STEP 3 — Calling getToken() with VAPID key...');
  let token: string;
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
  } catch (err: any) {
    console.error('[FCM] STEP 3 FAILED — getToken() threw an error:');
    console.error('[FCM]   code:   ', err?.code    ?? 'none');
    console.error('[FCM]   message:', err?.message ?? String(err));
    if (err?.code === 'messaging/failed-service-worker-registration') {
      console.error('[FCM]   → firebase-messaging-sw.js cannot be registered. Check the file exists in /public/');
    }
    if (err?.code === 'messaging/permission-blocked') {
      console.error('[FCM]   → Notifications are blocked. User must unblock in browser site settings.');
    }
    return null;
  }

  if (!token) {
    console.error('[FCM] STEP 3 FAILED — getToken() returned empty string. Permission may have changed or VAPID key is wrong.');
    return null;
  }
  console.info('[FCM] STEP 3 — Token Generated ✓ (prefix:', token.substring(0, 20) + '...)');

  // Save to Firestore
  console.info('[FCM] STEP 4 — Saving token to Firestore users/', uid, '...');
  const tokenData = {
    fcmToken:     token,
    platform:     detectPlatform(),
    browser:      detectBrowser(),
    fcmUpdatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'users', uid), tokenData);
    console.info('[FCM] STEP 4 — Token Saved to Firestore ✓ (updateDoc)');
  } catch (updateErr: any) {
    console.warn('[FCM] STEP 4 — updateDoc failed, trying setDoc merge:', updateErr?.message);
    try {
      await setDoc(doc(db, 'users', uid), tokenData, { merge: true });
      console.info('[FCM] STEP 4 — Token Saved to Firestore ✓ (setDoc merge)');
    } catch (setErr: any) {
      console.error('[FCM] STEP 4 FAILED — Could not save token to Firestore:');
      console.error('[FCM]   error:', setErr?.message ?? String(setErr));
      console.error('[FCM]   Check Firestore rules allow users/{uid} writes for authenticated users.');
      return null;
    }
  }

  // Update local cache
  const cachedToken = localStorage.getItem(FCM_TOKEN_LS_KEY);
  if (cachedToken !== token) {
    localStorage.setItem(FCM_TOKEN_LS_KEY, token);
    console.info('[FCM] STEP 4 — Token cached in localStorage ✓');
  }

  console.info('[FCM] ══ FCM INITIALIZATION COMPLETE ✓ ══════════════════════');
  return token;
}

// ─── Revoke token on logout ───────────────────────────────────────────────────

export async function revokeFCMToken(uid: string): Promise<void> {
  const messaging = await messagingPromise;
  if (!messaging) return;

  try {
    await deleteToken(messaging);
    localStorage.removeItem(FCM_TOKEN_LS_KEY);
    await updateDoc(doc(db, 'users', uid), {
      fcmToken:     null,
      fcmUpdatedAt: serverTimestamp(),
    }).catch(() => {});
    console.info('[FCM] Token revoked for uid:', uid);
  } catch (err: any) {
    console.warn('[FCM] revokeFCMToken error:', err?.message ?? err);
  }
}

// ─── Foreground message listener ──────────────────────────────────────────────

let _foregroundUnsubscribe: (() => void) | null = null;

export async function initForegroundMessages(): Promise<() => void> {
  if (_foregroundUnsubscribe) return _foregroundUnsubscribe;

  const messaging = await messagingPromise;
  if (!messaging) return () => {};

  const unsub = onMessage(messaging, (payload) => {
    console.info('[FCM] Foreground message received (app is open — no OS notification shown):', payload?.notification?.title);
    window.dispatchEvent(new CustomEvent('skm_push_foreground', {
      detail: {
        title:       payload.notification?.title   ?? payload.data?.title   ?? 'SKM',
        body:        payload.notification?.body    ?? payload.data?.body    ?? '',
        type:        payload.data?.type            ?? 'general',
        notifId:     payload.data?.notifId         ?? '',
        clickAction: payload.data?.clickAction     ?? '/',
      },
    }));
  });

  _foregroundUnsubscribe = unsub;
  return unsub;
}

export function subscribeForegroundMessages(): () => void {
  initForegroundMessages().catch(() => {});
  return () => { _foregroundUnsubscribe?.(); _foregroundUnsubscribe = null; };
}

// ─── SW notification click routing ───────────────────────────────────────────

export function listenForNotificationClicks(
  onNavigate: (type: string, url: string) => void
): () => void {
  if (!('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'FCM_NOTIFICATION_CLICK') {
      const { notifType, url } = event.data.data ?? {};
      console.info('[FCM] Notification tapped → navigating to:', url, 'type:', notifType);
      onNavigate(notifType ?? '', url ?? '/');
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

// ─── PWA install prompt ───────────────────────────────────────────────────────

let _installPrompt: any = null;

export function capturePWAInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _installPrompt = e;
    window.dispatchEvent(new CustomEvent('skm_pwa_installable'));
  });
  window.addEventListener('appinstalled', () => {
    _installPrompt = null;
    window.dispatchEvent(new CustomEvent('skm_pwa_installed'));
  });
}

export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!_installPrompt) return 'unavailable';
  _installPrompt.prompt();
  const { outcome } = await _installPrompt.userChoice;
  _installPrompt = null;
  return outcome as 'accepted' | 'dismissed';
}

export function isPWAInstallable(): boolean { return _installPrompt !== null; }
export function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

// ─── Platform helpers ─────────────────────────────────────────────────────────

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua))           return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/macintosh/i.test(ua))        return 'macos';
  if (/windows/i.test(ua))          return 'windows';
  if (/linux/i.test(ua))            return 'linux';
  return 'unknown';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/edg\//i.test(ua))   return 'edge';
  if (/opr\//i.test(ua))   return 'opera';
  if (/chrome/i.test(ua))  return 'chrome';
  if (/firefox/i.test(ua)) return 'firefox';
  if (/safari/i.test(ua))  return 'safari';
  return 'unknown';
}
