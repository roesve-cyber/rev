// Service Worker exclusivo de la app de cobranza (/cobranza/).
// Objetivo: que la app abra al instante aunque haya poca señal en ruta (interfaz desde caché),
// mientras los datos siempre se piden a Firebase. Los DATOS de la cartera NO se guardan aquí:
// la propia app los guarda en IndexedDB. Nunca intercepta Firebase/Firestore/Google.

const CACHE_NAME = 'cobranza-shell-v1';

const SHELL_URLS = [
  '/cobranza/',
  '/cobranza/index.html',
  '/cobranza/manifest.json',
  '/cobranza/motor.js',
  '/img/icon.svg',
  '/img/icon-32.png',
  '/img/icon-180.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/Logo.svg',
  '/js/services/calculator.js',
  '/js/services/cobranza-risk-service.js',
  '/js/services/imagen-whatsapp.js',
  '/js/vendor/html2canvas.min.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => null))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const esApiDeGoogle = /(^|\.)googleapis\.com$/.test(url.hostname)
    || /(^|\.)google\.com$/.test(url.hostname)
    || /firebaseio\.com$/.test(url.hostname)
    || /firebaseinstallations\.googleapis\.com$/.test(url.hostname);
  if (esApiDeGoogle) return;

  const esArchivoDelCascaron = SHELL_URLS.includes(req.url) || SHELL_URLS.includes(url.pathname);
  if (!esArchivoDelCascaron) return;

  // La app y su motor de cálculo cambian seguido: red primero (cada cambio se ve a la primera);
  // sin conexión se usa la copia guardada.
  const redPrimero = url.pathname === '/cobranza/' || url.pathname === '/cobranza/index.html' || url.pathname === '/cobranza/motor.js';
  if (redPrimero) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) { const copia = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copia)).catch(() => {}); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // El resto (íconos, SDK de Firebase, vendors) cambia poco: caché primero y se actualiza en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const actualizar = fetch(req).then((res) => {
        if (res && res.ok) { const copia = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copia)).catch(() => {}); }
        return res;
      }).catch(() => cached);
      return cached || actualizar;
    })
  );
});
