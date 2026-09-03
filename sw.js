const CACHE = 'tifloacosta-app-v1-3-analytics';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=1.0',
  './data.js?v=0.14',
  './app-core.js?v=1.1',
  './app.js?v=1.3',
  './notifications.js?v=0.13',
  './videos.html',
  './videos-core.js?v=0.16',
  './videos.js?v=1.3',
  './videos.json',
  './offline.html',
  './manifest.webmanifest',
  './book-cover.jpg',
  './tifloacosta-icon-192.png',
  './tifloacosta-icon-512.png',
  './tifloacosta-maskable-192.png',
  './tifloacosta-maskable-512.png',
  './tifloacosta-apple-touch-icon.png',
  './tifloacosta-favicon.ico',
  './tifloacosta-simbolo-blanco.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tifloacosta-app-') && key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('./offline.html');
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const liveContent = event.request.mode === 'navigate' ||
    event.request.destination === 'script' ||
    event.request.destination === 'style' ||
    url.pathname.endsWith('/videos.json');

  event.respondWith(liveContent ? networkFirst(event.request) : cacheFirst(event.request));
});
