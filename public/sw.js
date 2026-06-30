// SKM Experience — Service Worker
// Caches the app shell on install so the offline page works when there's no network.

const CACHE = 'skm-v6';

const PRECACHE = [
  '/',
  '/index.html',
  '/signal-lost.png',
  '/egg mus_Image_v5vrg3v5vrg3v5vr-removebg-preview.png',
  '/Jump pose.png',
  '/THUMBS_POSE__Egg_-removebg-preview.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Navigation: network-first, fall back to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|css|js)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }
});

// ─── Show notification from main thread message ───────────────────────────────
// The main thread sends { type: 'SHOW_NOTIFICATION', title, body, icon, tag, data }
// The SW shows it via self.registration.showNotification() — the ONLY way that
// works reliably on Android Chrome when triggered from app code.

self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') return;

  var title   = event.data.title   || 'SKM';
  var body    = event.data.body    || '';
  var icon    = event.data.icon    || '/THUMBS_POSE__Egg_-removebg-preview.png';
  var tag     = event.data.tag     || 'skm-notification';
  var url     = event.data.url     || '/';

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

// ─── Notification click handler ───────────────────────────────────────────────

self.addEventListener('notificationclick', event => {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'SKM_NOTIFICATION_CLICK', url: url });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
