// sw.js — Service Worker MMP POS
try {
  importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');
} catch (err) {
  console.warn('No se pudieron cargar scripts de Firebase Messaging:', err);
}

var CACHE_NAME = 'mmp-pos-v38';
var ASSETS = [
  '/',
  '/index.html',
  '/estilos.css',
  '/manifest.json'
];

var firebaseConfig = {
  apiKey: "AIzaSyALvu7jMIiwJy2zY96fmeQR9M_tLR6mDUI",
  authDomain: "mmpueblito-8fb29.firebaseapp.com",
  projectId: "mmpueblito-8fb29",
  storageBucket: "mmpueblito-8fb29.firebasestorage.app",
  messagingSenderId: "32950655624",
  appId: "1:32950655624:web:42a8657431319f9a25dd3d"
};

try {
  firebase.initializeApp(firebaseConfig);
  var messaging = firebase.messaging();
  messaging.onBackgroundMessage(function(payload) {
    var title = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || 'Boveda de autorizaciones';
    var body = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || 'Tienes un pendiente por revisar.';
    var url = (payload.data && payload.data.url) || '/?view=autorizaciones';
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'boveda-autorizaciones',
      data: { url: url }
    });
  });
} catch (err) {
  console.warn('Firebase Messaging no disponible en SW:', err);
}

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    }).catch(function(err) {
      console.warn('SW cache error:', err);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Solo cachear GET requests
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request);
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/?view=autorizaciones';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});








