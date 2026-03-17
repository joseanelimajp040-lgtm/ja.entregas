// ─── SERVICE WORKER — J.A Pet Shop PWA ───────────────────────────────────────
const CACHE_NAME = 'ja-petshop-' + Date.now();
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
    ).then(() => self.clients.claim())
  );
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
      fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
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
// ═══════════════════════════════════════════════
// FCM — NOTIFICAÇÕES EM BACKGROUND
// ═══════════════════════════════════════════════
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyDgRir19C9uHMzuSklKTI0J8NdeBDYsnVE",
  authDomain:        "ja-entregas.firebaseapp.com",
  projectId:         "ja-entregas",
  storageBucket:     "ja-entregas.firebasestorage.app",
  messagingSenderId: "143444928575",
  appId:             "1:143444928575:web:dfd9e472f361c331d9f08a"
});

const messaging = firebase.messaging();

// Notificação recebida com app em segundo plano / fechado
messaging.onBackgroundMessage(function (payload) {
  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || '📦 Nova Entrega', {
    body:    body || 'Toque para ver os detalhes.',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag:     data.deliveryId || 'nova-entrega',  // evita duplicatas
    renotify: true,
    data:    data,
    actions: [
      { action: 'abrir',   title: '📋 Ver entrega' },
      { action: 'fechar',  title: 'Fechar' }
    ]
  });
});

// Clique na notificação
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'fechar') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Se o app já estiver aberto, foca nele
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão, abre uma nova aba
      return clients.openWindow('/');
    })
  );
});
