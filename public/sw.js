// Phase 7 service worker: push, shell caching, stale-while-revalidate API reads.

const CACHE_VERSION = 'society-mobile-v7';
const STATIC_CACHE = `${CACHE_VERSION}:static`;
const API_CACHE = `${CACHE_VERSION}:api`;
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/visitors',
  '/my-visitors',
  '/my-bills',
  '/emergency',
  '/packages',
  '/manifest.json',
  '/icons/icon.svg',
];
const CRITICAL_API_PREFIXES = [
  '/api/dashboard',
  '/api/notifications',
  '/api/my-visitors',
  '/api/notices',
  '/api/my-bills',
  '/api/complaints',
  '/api/packages',
  '/api/guard/gate',
  '/api/emergency',
  '/api/search',
];

self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon.svg',
      badge: data.badge || '/icons/icon.svg',
      tag: data.tag || 'default',
      renotify: data.priority === 'emergency',
      data: { url: data.url || data.link || '/dashboard', actions: data.actions || null },
      vibrate: data.priority === 'emergency' ? [300, 100, 300, 100, 300] : [120, 80, 120],
      requireInteraction: data.tag === 'visitor-approval' || data.tag === 'emergency' || data.tag === 'sos-alert',
      actions: data.actions || [
        ...(data.tag === 'visitor-approval' ? [
          { action: 'open', title: 'Review' },
        ] : []),
      ],
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'SmartSocietyHub', options)
    );
  } catch (e) {
    console.error('Push parse error:', e);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .finally(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isCriticalApi = CRITICAL_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

  if (isCriticalApi) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Never cache legacy entry paths or auth routes — they must reach the server for redirects.
  const bypassCache =
    url.pathname === '/SmartSocietyHub' ||
    url.pathname === '/SmartSocietyHub/' ||
    url.pathname === '/login' ||
    url.pathname === '/';

  if (request.mode === 'navigate') {
    if (bypassCache) {
      event.respondWith(fetch(request));
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || network;
}
