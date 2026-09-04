// Service Worker exclusivo de cotizador-movil.html.
// Objetivo único: que la app abra al instante (aunque haya poca señal dentro
// de la tienda) mostrando la interfaz de inmediato desde caché, mientras
// SIEMPRE va a la red por los datos reales (precios, tasas, guardado de
// cotizaciones). Nunca cachea ni intercepta nada de Firebase/Firestore/Google.

const CACHE_NAME = 'cotizador-shell-v5';

const SHELL_URLS = [
  '/cotizador-movil.html',
  '/manifest-cotizador.json',
  '/img/icon.svg',
  '/img/icon-32.png',
  '/img/icon-180.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/Logo.svg',
  '/js/services/ticket-service.js',
  '/js/vendor/html2canvas.min.js',
  '/js/vendor/jspdf.umd.min.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => null))))
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

  // Nunca tocar nada que no sea GET (evita interferir con escrituras).
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interceptar Firebase Auth / Firestore / APIs de Google: precios,
  // tasas de crédito y guardado de cotizaciones deben ser SIEMPRE en vivo.
  const esApiDeGoogle = /(^|\.)googleapis\.com$/.test(url.hostname)
    || /(^|\.)google\.com$/.test(url.hostname)
    || /firebaseio\.com$/.test(url.hostname)
    || /firebaseinstallations\.googleapis\.com$/.test(url.hostname);
  if (esApiDeGoogle) return;

  const esArchivoDelCascaron = SHELL_URLS.includes(req.url) || url.pathname === '/cotizador-movil.html';
  if (!esArchivoDelCascaron) return; // todo lo demás sigue su curso normal

  // El HTML de la app se actualiza seguido: red primero, y solo si no hay
  // conexión se usa la copia guardada. Así cada cambio se ve en la PRIMERA
  // carga, no hasta la segunda (que es lo que pasaba con stale-while-revalidate
  // aplicado también al propio documento).
  const esDocumentoPrincipal = url.pathname === '/cotizador-movil.html';
  if (esDocumentoPrincipal) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // El resto del cascarón (íconos, SDK de Firebase, ticket-service y sus
  // vendors) cambia poco: stale-while-revalidate para que abra al instante,
  // actualizando en segundo plano para la próxima carga.
  event.respondWith(
    caches.match(req).then((cached) => {
      const actualizar = fetch(req).then((res) => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || actualizar;
    })
  );
});
