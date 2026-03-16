const CACHE_NAME = 'ricettario-neil-v4-2026-recipe-pages';

const APP_SHELL = [
  './',
  './index.html',
  './recipe.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Non cacheare richieste non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // Non cacheare Supabase o altre API esterne
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    return;
  }

  const pathname = url.pathname;

  // Non cacheare area admin / login / file sensibili
  if (
    pathname.endsWith('/admin.html') ||
    pathname.endsWith('/login.html') ||
    pathname.endsWith('/reset-password.html') ||
    pathname.endsWith('/update-password.html') ||
    pathname.endsWith('/supabase.js') ||
    pathname.endsWith('/admin.js') ||
    pathname.endsWith('/login.js') ||
    pathname.endsWith('/admin.css')
  ) {
    return;
  }

  // Non cacheare querystring dinamiche tranne recipe.html?slug=...
  const isRecipePage = pathname.endsWith('/recipe.html') || pathname.endsWith('recipe.html');
  if (url.search && !isRecipePage) {
    return;
  }

  // Per recipe.html?slug=... usiamo network-first così non rimane bloccata in cache
  if (isRecipePage) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('./recipe.html', responseClone).catch(() => {});
          });

          return networkResponse;
        })
        .catch(() => caches.match('./recipe.html'))
    );
    return;
  }

  // Cache-first per il resto del sito pubblico
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const isSameOrigin = url.origin === self.location.origin;
          if (!isSameOrigin) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });

          return networkResponse;
        })
        .catch(() => {
          if (
            pathname.endsWith('/') ||
            pathname.endsWith('/index.html') ||
            pathname === self.location.pathname.replace('service-worker.js', '')
          ) {
            return caches.match('./index.html');
          }

          return caches.match(request);
        });
    })
  );
});