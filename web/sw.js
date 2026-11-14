// Service worker della versione web: copia tutti i file alla prima visita e poi li serve dalla copia locale.
// I segnaposto sono riempiti da web/build.mjs.
const CACHE = 'funbus-__VERSION__';
const FILES = '__FILES__';

self.addEventListener('install', e => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('funbus-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches
      .match(e.request, { ignoreSearch: true, cacheName: CACHE })
      .then(r => r || fetch(e.request).catch(() => new Response('', { status: 404 }))),
  );
});
