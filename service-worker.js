const VERSION = "v6-2026-pwa-upgrade";
const STATIC_CACHE = `ricettario-neil-static-${VERSION}`;
const RUNTIME_CACHE = `ricettario-neil-runtime-${VERSION}`;
const IMAGE_CACHE = `ricettario-neil-images-${VERSION}`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/recipe.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/banner.png",
  "/images/Chef%20Lai.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key !== STATIC_CACHE &&
              key !== RUNTIME_CACHE &&
              key !== IMAGE_CACHE
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (!url.protocol.startsWith("http")) return;

  if (shouldBypassCache(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (isImageRequest(request, url)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAssetRequest(request));
    return;
  }

  event.respondWith(handleRuntimeRequest(request));
});

function shouldBypassCache(url) {
  const pathname = url.pathname;

  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("cdn.jsdelivr.net")
  ) {
    return true;
  }

  if (
    pathname.endsWith("/admin.html") ||
    pathname.endsWith("/login.html") ||
    pathname.endsWith("/reset-password.html") ||
    pathname.endsWith("/update-password.html") ||
    pathname.endsWith("/supabase.js") ||
    pathname.endsWith("/admin.js") ||
    pathname.endsWith("/login.js") ||
    pathname.endsWith("/admin.css")
  ) {
    return true;
  }

  return false;
}

async function handleNavigationRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    if (pathname.startsWith("/recipe/")) {
      const cachedRecipePage = await caches.match("/recipe.html");
      if (cachedRecipePage) return cachedRecipePage;
    }

    const cachedHome = await caches.match("/index.html");
    if (cachedHome) return cachedHome;

    return new Response(
      `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline | Ricettario Neil</title>
  <style>
    body{
      margin:0;
      font-family:Arial, Helvetica, sans-serif;
      background:#090b12;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      min-height:100vh;
      padding:24px;
      box-sizing:border-box;
    }
    .box{
      max-width:520px;
      background:rgba(255,255,255,0.08);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:20px;
      padding:24px;
      text-align:center;
    }
    h1{
      margin-top:0;
      font-size:1.8rem;
    }
    p{
      color:rgba(255,255,255,0.85);
      line-height:1.6;
    }
    a{
      display:inline-block;
      margin-top:12px;
      color:#fff;
      text-decoration:none;
      background:#5b8cff;
      padding:12px 16px;
      border-radius:999px;
      font-weight:700;
    }
  </style>
</head>
<body>
  <div class="box">
    <h1>Sei offline</h1>
    <p>Non riesco a caricare la pagina in questo momento. Se hai già aperto il ricettario prima, alcune pagine e risorse potrebbero comunque essere disponibili dalla cache.</p>
    <a href="/">Torna alla home</a>
  </div>
</body>
</html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 200
      }
    );
  }
}

async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone()).catch(() => {});
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }

    return networkResponse;
  } catch (error) {
    const fallback = await caches.match("/images/Chef%20Lai.png");
    if (fallback) return fallback;

    return new Response("", { status: 404 });
  }
}

async function handleStaticAssetRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone()).catch(() => {});
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }

    return networkResponse;
  } catch (error) {
    return caches.match(request);
  }
}

async function handleRuntimeRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }

    return networkResponse;
  } catch (error) {
    return caches.match(request);
  }
}

function isImageRequest(request, url) {
  if (request.destination === "image") return true;
  return /\.(png|jpg|jpeg|webp|gif|svg|avif)$/i.test(url.pathname);
}

function isStaticAsset(url) {
  return /\.(css|js|json|woff2?|ttf|otf)$/i.test(url.pathname);
}