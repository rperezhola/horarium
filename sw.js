// Service worker: guarda la app entera para que abra sin red. Subir V en cada cambio publicado.
const V = 'horarium-2';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'sun.js', 'dial.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', 'icons/icon-maskable-512.png',
  'fonts/alegreya.woff2', 'fonts/alegreya-italic.woff2', 'fonts/alegreya-sc-500.woff2', 'fonts/alegreya-sc-700.woff2',
  'fonts/alegreya-sans-400.woff2', 'fonts/alegreya-sans-700.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // el buscador va siempre a la red
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || fetch(e.request))
      .catch(() => caches.match('index.html'))
  );
});
