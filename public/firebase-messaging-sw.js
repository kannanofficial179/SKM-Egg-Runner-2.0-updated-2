/**
 * SKM EGG RUNNER — Firebase Cloud Messaging Service Worker
 *
 * This file MUST be served from the root path (/firebase-messaging-sw.js).
 * It handles background push notifications when the app tab is closed or hidden.
 *
 * Firebase SDK is imported via importScripts (compat version required in SW context).
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ─── Firebase config (must be hardcoded here — no env access in SW) ──────────
firebase.initializeApp({
  apiKey:            'AIzaSyBcGsQCma6dB3yDSZxhPAiwJtNR3CofcJc',
  authDomain:        'skm-egg-runner.firebaseapp.com',
  projectId:         'skm-egg-runner',
  storageBucket:     'skm-egg-runner.firebasestorage.app',
  messagingSenderId: '635492295830',
  appId:             '1:635492295830:web:d572a5d8b35e42ef8f4eb7',
  measurementId:     'G-59KS5GKX0H',
});

const messaging = firebase.messaging();

// ─── Background message handler ───────────────────────────────────────────────
// Fires when app is in background or closed. FCM delivers the raw payload here.
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Background message received:', payload);

  const { title, body, icon, badge, image, data } = payload.notification ?? {};
  const notifData = payload.data ?? {};

  const notificationTitle = title ?? 'SKM Notification';
  const notificationOptions = {
    body:    body    ?? '',
    icon:    icon    ?? '/THUMBS_POSE__Egg_-removebg-preview.png',
    badge:   badge   ?? '/skm-badge-96.png',
    image:   image,
    tag:     notifData.tag     ?? 'skm-notification',
    renotify: true,
    requireInteraction: notifData.priority === 'urgent' || notifData.priority === 'high',
    data: {
      url:    notifData.clickAction ?? '/',
      type:   notifData.type        ?? 'general',
      notifId: notifData.notifId    ?? '',
    },
    actions: buildActions(notifData.type),
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ─── Notification click handler ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM-SW] Notification clicked:', event.notification.tag, event.action);
  event.notification.close();

  const data = event.notification.data ?? {};
  let targetUrl = data.url ?? '/';

  // Route by action button clicked
  if (event.action === 'scan_qr')    targetUrl = '/?tab=scan';
  if (event.action === 'play_game')  targetUrl = '/';
  if (event.action === 'view_stats') targetUrl = '/?tab=stats';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app is already open, focus it and post a message
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'FCM_NOTIFICATION_CLICK',
            data: { url: targetUrl, notifType: data.type, notifId: data.notifId },
          });
          return;
        }
      }
      // App not open — open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Push event (fallback for non-FCM direct pushes) ─────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    // FCM already handled above via onBackgroundMessage; this is a safety net
    if (payload.notification) {
      event.waitUntil(
        self.registration.showNotification(
          payload.notification.title ?? 'SKM',
          {
            body:  payload.notification.body  ?? '',
            icon:  payload.notification.icon  ?? '/THUMBS_POSE__Egg_-removebg-preview.png',
            badge: '/skm-badge-96.png',
            data:  payload.data ?? {},
          }
        )
      );
    }
  } catch {
    // not JSON — ignore
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildActions(type) {
  switch (type) {
    case 'protein_added':
    case 'protein_reminder':
    case 'protein_goal_complete':
    case 'daily_goal_reminder':
    case 'protein_duplicate':
    case 'golden_egg_scanned':
      return [{ action: 'scan_qr', title: '🥚 Scan QR' }];

    case 'run_completed':
    case 'new_high_score':
    case 'game_reminder':
    case 'mission_complete':
    case 'qr_validated':
      return [{ action: 'play_game', title: '🎮 Play Now' }];

    case 'achievement_unlocked':
    case 'level_up':
    case 'champion_rank_improved':
    case 'streak_milestone':
    case 'protein_milestone':
      return [{ action: 'view_stats', title: '🏆 View Stats' }];

    default:
      return [];
  }
}
