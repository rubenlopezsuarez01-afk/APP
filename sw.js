/* Service worker: permite usar la app sin conexión. */
// La versión está en js/version.js: al subirla, el móvil renueva la caché.
// Los datos (localStorage y Firebase) no se tocan: solo se renuevan los archivos de la app.
importScripts('js/version.js');
const CACHE = 'planificador-comidas-v' + self.APP_VERSION;
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png',
  'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/version.js', 'js/logic.js', 'js/catalog.js', 'js/store.js', 'js/firebase-config.js', 'js/sync-firebase.js', 'js/app.js'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' para guardar los archivos del servidor y no los que tenga el navegador.
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
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
  // La comprobación de versión (?t=...) va siempre directa al servidor.
  if (url.searchParams.has('t')) return;
  if (firebaseSdk) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    })));
    return;
  }
  // no-cache: pregunta siempre al servidor si hay algo nuevo (GitHub Pages deja
  // los archivos 10 minutos en la caché del navegador y las actualizaciones tardaban).
  const fresh = new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' });
  e.respondWith(
    fetch(fresh)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
