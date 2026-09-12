// v8 — production-safe caching: never cache private APIs or personalized HTML; bypass all cross-origin requests.
const CACHE_NAME = 'kruthika-v9';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/kruthika-avatar.svg'
];

const CHAT_CACHE_NAME = 'kruthika-chat-history-v6';
const MAX_CHAT_ENTRIES = 100;

// Explicit public API allowlist — everything else is network-only (no Cache Storage).
const PUBLIC_CACHEABLE_API_PREFIXES = [
  '/api/blog/posts',
  '/api/public-config',
];

function isPublicCacheableApi(pathname) {
  return PUBLIC_CACHEABLE_API_PREFIXES.some(prefix =>
    pathname === prefix || pathname.startsWith(prefix + '/')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name !== CACHE_NAME && name !== CHAT_CACHE_NAME)
        .map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Cross-origin requests (Adsterra ads, ad creatives, OneSignal, external CDNs)
  // must bypass the Service Worker completely. Intercepting cross-origin images/assets
  // routes them through SW fetch() which triggers CSP connect-src violations and breaks ad delivery.
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.method !== 'GET' && !url.pathname.includes('/api/chat')) return;

  if (url.pathname.includes('/api/chat') && request.method === 'POST') {
    event.respondWith(handleChatRequest(request));
    return;
  }

  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  if (url.pathname.startsWith('/api/adsterra/')) {
    return;
  }

  // Private/session APIs: network only — never read or write Cache Storage.
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') return;
    if (!isPublicCacheableApi(url.pathname)) {
      event.respondWith(
        fetch(request, { cache: 'no-store' }).catch(() =>
          new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
          })
        )
      );
      return;
    }
    // Public allowlisted GET APIs: network-first, optional short fallback.
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          if (response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME + '-public-api')
              .then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // HTML: network only — pages vary by country/language cookies; never cache HTML.
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() =>
        new Response('<!DOCTYPE html><html><body><p>Offline — please reconnect.</p></body></html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
        })
      )
    );
    return;
  }

  // Static images/fonts/css — cache-first for immutable public assets only.
  if (url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.webp') ||
      url.pathname.endsWith('.avif') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.woff2') ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.css')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
  }
});

async function handleChatRequest(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CHAT_CACHE_NAME);
      await cache.put(request.url + '_' + Date.now(), response.clone());
      const keys = await cache.keys();
      if (keys.length > MAX_CHAT_ENTRIES) {
        const oldKeys = keys.slice(0, keys.length - MAX_CHAT_ENTRIES);
        await Promise.all(oldKeys.map(key => cache.delete(key)));
      }
    }
    return response;
  } catch {
    return new Response(JSON.stringify({
      success: false,
      response: "I'm currently offline, but I'll be back soon!",
      offline: true
    }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      caches.keys().then(names =>
        Promise.all(names.map(name => caches.delete(name)))
      ).then(() => {
        self.clients.matchAll().then(clients => {
          clients.forEach(client =>
            client.postMessage({ type: 'CACHES_CLEARED' })
          );
        });
      })
    );
  }
});
