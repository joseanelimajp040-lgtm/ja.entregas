// ─── SERVICE WORKER — J.A Pet Shop PWA ───────────────────────────────────────
const CACHE_NAME   = 'ja-petshop-v1';
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// CDN assets to cache on first fetch
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ── INSTALL: pre-cache static shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: network-first for Firebase/API, cache-first for static/CDN ────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network-first for Firestore / Firebase calls
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request)
      )
    );
    return;
  }

  // Cache-first for CDN (fonts, tailwind) and local assets
  if (CDN_HOSTS.some(h => url.hostname.includes(h)) ||
      url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Only cache valid responses
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Default: network only
  event.respondWith(fetch(event.request));
});

// ── PUSH NOTIFICATIONS (basic scaffold) ──────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title   = data.title   || 'J.A Pet Shop';
  const options = {
    body: data.body || 'Nova notificação.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || '/'));
});
