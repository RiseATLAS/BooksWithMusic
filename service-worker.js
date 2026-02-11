// Cache version - increment this number when deploying updates
const CACHE_VERSION = 'v20260204-1819';
const CACHE_NAME = `books-with-music-${CACHE_VERSION}`;
const AUDIO_CACHE = 'booksWithMusic-audio-v2';

// Files to cache - updated for GitHub Pages deployment
const urlsToCache = [
  '/BooksWithMusic/',
  '/BooksWithMusic/index.html',
  '/BooksWithMusic/reader.html',
  '/BooksWithMusic/styles.css',
  '/BooksWithMusic/js/main.js',
  '/BooksWithMusic/favicon.svg'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing new version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    }).then(() => {
      // Skip waiting to activate the new service worker immediately
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating new version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('books-with-music-') && key !== CACHE_NAME && key !== AUDIO_CACHE)
          .map((key) => {
            console.log('[Service Worker] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    }).then(() => {
      // Notify all clients that a new version is active
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
          });
        });
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/audio/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
