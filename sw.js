/* Service worker: permite usar la app sin conexión. */
// Sube este número en cada actualización para que el móvil limpie la caché vieja.
// Los datos (localStorage) no se tocan: solo se renuevan los archivos de la app.
const CACHE = 'planificador-comidas-v3';
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png',
  'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/logic.js', 'js/catalog.js', 'js/store.js', 'js/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero (para recibir actualizaciones) y caché si no hay conexión.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
