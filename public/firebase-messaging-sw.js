/**
 * SKM EGG RUNNER — Firebase Cloud Messaging Service Worker
 *
 * Registered with scope: /firebase-cloud-messaging-push-scope
 * (different from sw.js which uses scope '/' — this avoids conflicts)
 *
 * Handles background push notifications when the app is closed or backgrounded.
 * Must be at public root path: /firebase-messaging-sw.js
 *
 * Firebase compat SDK is required inside service workers (no ES modules in SW).
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Firebase config — hardcoded because service workers have no access to env vars
firebase.initializeApp({
  apiKey:            'AIzaSyBcGsQCma6dB3yDSZxhPAiwJtNR3CofcJc',
  authDomain:        'skm-egg-runner.firebaseapp.com',
  projectId:         'skm-egg-runner',
  storageBucket:     'skm-egg-runner.firebasestorage.app',
  messagingSenderId: '635492295830',
  appId:             '1:635492295830:web:d572a5d8b35e42ef8f4eb7',
});

const messaging = firebase.messaging();

// ─── Background message handler ───────────────────────────────────────────────
// Fires when app tab is CLOSED or BACKGROUNDED.
// FCM delivers the raw data payload here; we must call showNotification ourselves.
messaging.onBackgroundMessage(function(payload) {
  console.log('[FCM-SW] Background message received');

  // notification fields from FCM payload
  const notifTitle = (payload.notification && payload.notification.title)
    ? payload.notification.title
    : 'SKM Notification';

  const notifBody = (payload.notification && payload.notification.body)
    ? payload.notification.body
    : '';

  // data fields sent by Cloud Function
  const d = payload.data || {};

  var options = {
    body:    notifBody,
    icon:    '/THUMBS_POSE__Egg_-removebg-preview.png',
    badge:   '/THUMBS_POSE__Egg_-removebg-preview.png',
    tag:     'skm-' + (d.type || 'notification'),
    renotify: true,
    requireInteraction: d.priority === 'urgent' || d.priority === 'high',
    data: {
      url:     d.clickAction || '/',
      type:    d.type        || 'general',
      notifId: d.notifId     || '',
    },
    actions:  buildActions(d.type),
    vibrate:  [200, 100, 200],
  };

  // Only add image if it's actually set (undefined crashes some Android browsers)
  if (payload.notification && payload.notification.image) {
    options.image = payload.notification.image;
  }

  return self.registration.showNotification(notifTitle, options);
});

// ─── Notification click handler ───────────────────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  console.log('[FCM-SW] Notification clicked, action:', event.action);
  event.notification.close();

  var data = event.notification.data || {};
  var targetUrl = data.url || '/';

  // Override URL based on which action button was tapped
  if (event.action === 'scan_qr')    targetUrl = '/?open=scan';
  if (event.action === 'play_game')  targetUrl = '/?open=game';
  if (event.action === 'view_stats') targetUrl = '/?open=profile';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // If app already open in any tab — focus it and tell it to navigate
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'FCM_NOTIFICATION_CLICK',
            data: {
              url:       targetUrl,
              notifType: data.type,
              notifId:   data.notifId,
            },
          });
          return;
        }
      }
      // App not open — open a new tab/window at the target URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ─── Show notification on demand from main thread ─────────────────────────────
// Main thread posts { type: 'SHOW_NOTIFICATION', title, body, icon, tag, url }
// This SW has notification authority so showNotification works on Android.

self.addEventListener('message', function(event) {
  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') return;
  var title = event.data.title || 'SKM';
  var body  = event.data.body  || '';
  var icon  = event.data.icon  || '/THUMBS_POSE__Egg_-removebg-preview.png';
  var tag   = event.data.tag   || 'skm-notification';
  var url   = event.data.url   || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body:     body,
      icon:     icon,
      badge:    icon,
      tag:      tag,
      renotify: true,
      vibrate:  [200, 100, 200],
      data:     { url: url },
    })
  );
});

// ─── Action builder ───────────────────────────────────────────────────────────

function buildActions(type) {
  switch (type) {
    case 'protein_added':
    case 'protein_reminder':
    case 'protein_goal_complete':
    case 'daily_goal_reminder':
    case 'protein_duplicate':
    case 'golden_egg_scanned':
    case 'streak_reminder':
      return [{ action: 'scan_qr', title: 'Scan QR' }];

    case 'run_completed':
    case 'new_high_score':
    case 'game_reminder':
    case 'mission_complete':
    case 'qr_validated':
    case 'daily_reward_available':
      return [{ action: 'play_game', title: 'Play Now' }];

    case 'achievement_unlocked':
    case 'level_up':
    case 'champion_rank_improved':
    case 'streak_milestone':
    case 'protein_milestone':
      return [{ action: 'view_stats', title: 'View Stats' }];

    default:
      return [];
  }
}
