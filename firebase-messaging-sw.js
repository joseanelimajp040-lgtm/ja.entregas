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

messaging.onBackgroundMessage(function(payload) {
  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || '📦 Nova Entrega — J.A Pet Shop', {
    body:     body || 'Toque para ver os detalhes.',
    icon:     '/icon-192.png',
    badge:    '/icon-192.png',
    vibrate:  [200, 100, 200, 100, 200],
    tag:      data.deliveryId || 'nova-entrega',
    renotify: true,
    data:     data,
    actions: [
      { action: 'abrir',  title: '📋 Ver entrega' },
      { action: 'fechar', title: 'Fechar' }
    ]
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'fechar') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
