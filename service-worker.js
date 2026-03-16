const CACHE_NAME = 'ricettario-neil-v5-2026-navigation-fix';

const APP_SHELL = [
  '/',
  '/index.html',
  '/recipe.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
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

  if (!url.protocol.startsWith('http')) return;

  // Non cacheare Supabase o CDN esterni
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('cdn.jsdelivr.net')
  ) {
    return;
  }

  const pathname = url.pathname;

  // Non cacheare admin / login / file sensibili
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

  // Per tutte le navigazioni HTML: network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch(() => {});
            });
          }

          return networkResponse;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;

          if (pathname.startsWith('/recipe/')) {
            return caches.match('/recipe.html');
          }

          return caches.match('/index.html');
        })
    );
    return;
  }

  // Non cacheare URL con querystring dinamiche
  if (url.search) {
    return;
  }

  // Cache-first per asset statici del sito pubblico
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

          if (url.origin !== self.location.origin) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch(() => {});
          });

          return networkResponse;
        })
        .catch(() => caches.match(request));
    })
  );
});