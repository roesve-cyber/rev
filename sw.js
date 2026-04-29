const CACHE_NAME = "pos-v2";

const urlsToCache = [
  "/",
  "/index.html"
];

// Instalación
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Activación
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
});

// Fetch inteligente (Corregido para evitar errores con Firebase)
self.addEventListener("fetch", e => {
  // 🟢 PASO 1: Si no es una petición de "lectura" (GET), no la guardamos en caché.
  // Esto evita el error "Request method 'POST' is unsupported"
  if (e.request.method !== 'GET') {
    return; // Detenemos aquí y dejamos que la petición siga su curso normal
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Solo guardamos en caché si la respuesta es válida (status 200)
        if (!res || res.status !== 200 || res.type !== 'basic') {
          return res;
        }
        
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          // 🟢 PASO 2: Verificamos una vez más antes de guardar
          if (e.request.method === 'GET') {
            cache.put(e.request, clone);
          }
        });
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
