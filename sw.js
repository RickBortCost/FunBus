// Service worker della versione web: copia tutti i file alla prima visita e poi li serve dalla copia locale.
// I segnaposto sono riempiti da web/build.mjs.
const CACHE = 'funbus-1.26.3';
const FILES = ["./","css/style.css","data/animations.json","data/course.json","data/decode.json","data/game.json","data/glossary.json","data/lang/en.json","data/matching.json","data/normative.json","data/protocols.json","data/quiz.json","data/scenarios.json","data/topics.json","data/topologies.json","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","index.html","js/app.js","js/badges.js","js/build.js","js/charts.js","js/compare.js","js/core.js","js/extra.js","js/games.js","js/i18n.js","js/illus.js","js/logos.js","js/normative.js","js/osi.js","js/pages.js","js/path.js","js/search.js","js/sim.js","js/topo.js","logo-splash.svg","logo.svg","logos/LEGGIMI.txt","manifest.webmanifest"];

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
