/**
 * SKM Push Notification Service
 *
 * Handles:
 *  - One-time permission request
 *  - FCM token generation & storage in Firestore
 *  - Token refresh detection
 *  - Foreground message display (in-app toast bridge)
 *  - Navigation routing on notification click (from SW postMessage)
 *
 * Architecture:
 *  - Foreground: Firebase SDK onMessage() → dispatches 'skm_push_foreground' event
 *  - Background: firebase-messaging-sw.js shows native OS notification
 *  - Click: SW posts 'FCM_NOTIFICATION_CLICK' to all open clients → app routes
 */

import {
  getToken,
  onMessage,
  deleteToken,
} from 'firebase/messaging';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, messaging, isMessagingSupported } from '../firebase/firebase';

// VAPID key from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
// Set VITE_FIREBASE_VAPID_KEY in your .env file
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const FCM_TOKEN_KEY = 'skm_fcm_token';
const PERMISSION_ASKED_KEY = 'skm_push_permission_asked';

export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

// ─── Permission ───────────────────────────────────────────────────────────────

export function getPushPermissionState(): PushPermissionState {
  if (!('Notification' in window)) return 'unsupported';
  if (!('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission as PushPermissionState;
}

export function hasAskedPermission(): boolean {
  return localStorage.getItem(PERMISSION_ASKED_KEY) === 'true';
}

/**
 * Request push permission (shows browser prompt exactly once).
 * Returns the resulting permission state.
 */
export async function requestPushPermission(): Promise<PushPermissionState> {
  if (!('Notification' in window)) return 'unsupported';
  if (!('serviceWorker' in navigator)) return 'unsupported';

  localStorage.setItem(PERMISSION_ASKED_KEY, 'true');

  try {
    const result = await Notification.requestPermission();
    return result as PushPermissionState;
  } catch {
    return 'denied';
  }
}

// ─── Service Worker registration ──────────────────────────────────────────────

async function getOrRegisterSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // Use existing registration if available
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) return existing;

    // Register the FCM SW (separate from our cache SW to avoid conflicts)
    return await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
  } catch (err) {
    console.warn('[Push] SW registration failed:', err);
    return null;
  }
}

// ─── FCM Token ────────────────────────────────────────────────────────────────

/**
 * Generates (or retrieves cached) FCM registration token.
 * Stores it in Firestore under users/{uid}.
 * Returns null if messaging is not supported or permission not granted.
 */
export async function initFCMToken(uid: string): Promise<string | null> {
  const supported = await isMessagingSupported().catch(() => false);
  if (!supported || !messaging) {
    console.info('[Push] FCM not supported in this browser.');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.info('[Push] Permission not granted — skipping token generation.');
    return null;
  }

  if (!VAPID_KEY) {
    console.warn('[Push] VITE_FIREBASE_VAPID_KEY not set — push disabled. Add it to your .env file.');
    return null;
  }

  try {
    const swReg = await getOrRegisterSW();

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg ?? undefined,
    });

    if (!token) {
      console.warn('[Push] getToken returned empty — permission may have been revoked.');
      return null;
    }

    // Cache locally to detect refreshes
    const cachedToken = localStorage.getItem(FCM_TOKEN_KEY);

    // Store in Firestore (update rather than set so we don't overwrite other user fields)
    await updateDoc(doc(db, 'users', uid), {
      fcmToken:  token,
      platform:  detectPlatform(),
      browser:   detectBrowser(),
      fcmUpdatedAt: serverTimestamp(),
    }).catch(async () => {
      // Document may not exist yet (new user) — use setDoc-like approach via merge
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'users', uid), {
        fcmToken: token,
        platform: detectPlatform(),
        browser:  detectBrowser(),
        fcmUpdatedAt: serverTimestamp(),
      }, { merge: true });
    });

    if (cachedToken !== token) {
      console.info('[Push] FCM token stored/refreshed for uid:', uid);
      localStorage.setItem(FCM_TOKEN_KEY, token);
    }

    return token;
  } catch (err) {
    console.warn('[Push] initFCMToken error:', err);
    return null;
  }
}

/**
 * Delete the FCM token from Firebase (call on logout).
 * Removes fcmToken from Firestore too.
 */
export async function revokeFCMToken(uid: string): Promise<void> {
  const supported = await isMessagingSupported().catch(() => false);
  if (!supported || !messaging) return;

  try {
    await deleteToken(messaging);
    localStorage.removeItem(FCM_TOKEN_KEY);

    await updateDoc(doc(db, 'users', uid), {
      fcmToken: null,
      fcmUpdatedAt: serverTimestamp(),
    }).catch(() => {});

    console.info('[Push] FCM token revoked for uid:', uid);
  } catch (err) {
    console.warn('[Push] revokeFCMToken error:', err);
  }
}

// ─── Foreground message listener ──────────────────────────────────────────────

/**
 * Listens for FCM messages while the app is in the foreground.
 * Dispatches 'skm_push_foreground' custom event — picked up by NotificationContext
 * to queue an in-app toast (instead of showing a native OS notification).
 *
 * Returns an unsubscribe function.
 */
export function subscribeForegroundMessages(): (() => void) {
  if (!messaging) return () => {};

  const unsub = onMessage(messaging, (payload) => {
    console.info('[Push] Foreground message received:', payload);

    window.dispatchEvent(new CustomEvent('skm_push_foreground', {
      detail: {
        title:   payload.notification?.title   ?? payload.data?.title   ?? 'SKM',
        body:    payload.notification?.body    ?? payload.data?.body    ?? '',
        type:    payload.data?.type            ?? 'general',
        notifId: payload.data?.notifId         ?? '',
        clickAction: payload.data?.clickAction ?? '/',
      },
    }));
  });

  return unsub;
}

// ─── Notification click routing (from SW postMessage) ────────────────────────

/**
 * Listens for navigation requests from the service worker when a user taps
 * a push notification while the app is open in the background.
 */
export function listenForNotificationClicks(
  onNavigate: (type: string, url: string) => void
): () => void {
  if (!('serviceWorker' in navigator)) return () => {};

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'FCM_NOTIFICATION_CLICK') {
      const { notifType, url } = event.data.data ?? {};
      onNavigate(notifType ?? '', url ?? '/');
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}

// ─── PWA install prompt ───────────────────────────────────────────────────────

let _deferredInstallPrompt: any = null;

export function capturePWAInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('skm_pwa_installable'));
    console.info('[PWA] Install prompt captured and deferred.');
  });

  window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    console.info('[PWA] App installed successfully.');
    window.dispatchEvent(new CustomEvent('skm_pwa_installed'));
  });
}

export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!_deferredInstallPrompt) return 'unavailable';
  _deferredInstallPrompt.prompt();
  const { outcome } = await _deferredInstallPrompt.userChoice;
  _deferredInstallPrompt = null;
  return outcome as 'accepted' | 'dismissed';
}

export function isPWAInstallable(): boolean {
  return _deferredInstallPrompt !== null;
}

export function isPWAInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

// ─── Platform detection ───────────────────────────────────────────────────────

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua))              return 'android';
  if (/iphone|ipad|ipod/i.test(ua))    return 'ios';
  if (/macintosh/i.test(ua))           return 'macos';
  if (/windows/i.test(ua))             return 'windows';
  if (/linux/i.test(ua))               return 'linux';
  return 'unknown';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/edg\//i.test(ua))               return 'edge';
  if (/opr\//i.test(ua))               return 'opera';
  if (/chrome/i.test(ua))              return 'chrome';
  if (/firefox/i.test(ua))             return 'firefox';
  if (/safari/i.test(ua))              return 'safari';
  return 'unknown';
}
