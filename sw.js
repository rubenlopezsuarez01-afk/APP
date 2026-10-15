/* Service worker: permite usar la app sin conexión. */
// Sube este número en cada actualización para que el móvil limpie la caché vieja.
// Los datos (localStorage) no se tocan: solo se renuevan los archivos de la app.
const CACHE = 'planificador-comidas-v5';
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png',
  'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/logic.js', 'js/catalog.js', 'js/store.js', 'js/firebase-config.js', 'js/sync-firebase.js', 'js/app.js'
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
// La librería de Firebase se guarda para poder abrir la app sin cobertura;
// las conexiones con la base de datos de Firebase no pasan por aquí.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const firebaseSdk = url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (url.origin !== self.location.origin && !firebaseSdk) return;
  if (firebaseSdk) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    })));
    return;
  }
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
