const CACHE_NAME = 'slate-offline-cache-v1';
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'logo.svg',
  'manifest.json'
];

// 1. Install event: Cache the essential shell app assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching application shell...');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate event: Clean up legacy caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Cleaning up outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch event: Stale-While-Revalidate strategy
self.addEventListener('fetch', (event) => {
  // Only handle local HTTP/HTTPS requests (skip browser extensions, chrome-extension://, etc.)
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.startsWith('https://fonts.')) {
    return;
  }

  // Skip dev-server hot updates (Vite HMR check)
  if (event.request.url.includes('@vite') || event.request.url.includes('hot-update')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // Check for valid response before caching
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' || event.request.url.startsWith('https://fonts.')) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((err) => {
            console.warn('[Service Worker] Network fetch failed, falling back to cache if available:', err);
            // If cache is empty and network fails, check if request is for document/navigation and return index shell
            if (event.request.mode === 'navigate') {
              return caches.match('./');
            }
          });

        // Return cached resource immediately (stale), while network fetches updated version in background (revalidate)
        return cachedResponse || fetchPromise;
      });
    })
  );
});
