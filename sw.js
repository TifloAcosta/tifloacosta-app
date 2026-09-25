const CACHE = 'tifloacosta-app-v2-25-colors';
const NAVIGATION_TIMEOUT_MS = 5000;
const SHELL = [
  './',
  './index.html',
  './styles.css?v=1.2',
  './data.js?v=0.20',
  './app-core.js?v=1.6',
  './search-accessibility.js?v=1.1',
  './contextual-search.js?v=1.0',
  './downloads-core.js?v=1.1',
  './download-config.js?v=1.1',
  './downloads.js?v=1.4',
  './downloads.css?v=1.1',
  './actualidad-core.js?v=1.6',
  './actualidad.js?v=1.3',
  './actualidad-media.js?v=1.1',
  './app.js?v=2.1',
  './tifloacosta-favicon.ico',
  './tifloacosta-icon-192.png',
  './tifloacosta-icon-512.png',
  './tifloacosta-maskable-192.png',
  './tifloacosta-maskable-512.png',
  './tifloacosta-apple-touch-icon.png',
  './tifloacosta-simbolo-blanco.svg',
  './book-cover.jpg',
  './offline.html'
];

const LIVE_PATHS = new Set([
  '/actualidad.json',
  '/actualidad-media.json',
  '/actualidad-apps.json',
  '/videos.json',
  '/mobile-content.json',
  '/video-search-index.js',
  '/medical-studies.js'
]);

function navigationFetchWithTimeout(request) {
  return Promise.race([
    fetch(request, { cache: 'no-store' }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Navigation timeout')), NAVIGATION_TIMEOUT_MS);
    })
  ]);
}

function freshScript(url, cacheKey, request) {
  return fetch(url.href, { cache: 'no-store', credentials: 'same-origin' })
    .then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(cacheKey, copy));
      }
      return response;
    })
    .catch(() => caches.match(cacheKey).then(cached => cached || caches.match(request)));
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isAppOrigin = url.origin === self.location.origin;
  const isLivePath = isAppOrigin && LIVE_PATHS.has(url.pathname);

  if (request.mode === 'navigate') {
    event.respondWith(
      navigationFetchWithTimeout(request)
        .then(response => {
          if (response && response.ok && isAppOrigin) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request)
            .then(cached => cached || caches.match('./index.html'))
            .then(cached => cached || caches.match('./offline.html'))
        )
    );
    return;
  }

  if (isLivePath) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (isAppOrigin && url.pathname.endsWith('/styles.css')) {
    url.searchParams.set('v', '1.2');
    event.respondWith(freshScript(url, './styles.css?v=1.2', request));
    return;
  }

  if (isAppOrigin && url.pathname.endsWith('/app-core.js')) {
    url.searchParams.set('v', '1.6');
    event.respondWith(freshScript(url, './app-core.js?v=1.6', request));
    return;
  }

  if (isAppOrigin && url.pathname.endsWith('/app.js')) {
    url.searchParams.set('v', '2.1');
    event.respondWith(freshScript(url, './app.js?v=2.1', request));
    return;
  }

  if (isAppOrigin && url.pathname.endsWith('/downloads.js')) {
    url.searchParams.set('v', '1.4');
    event.respondWith(freshScript(url, './downloads.js?v=1.4', request));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response && response.ok && isAppOrigin) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    }).catch(() => caches.match('./offline.html'))
  );
});