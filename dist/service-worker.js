const CACHE_NAME = 'booksWithMusic-v2';
const AUDIO_CACHE = 'booksWithMusic-audio-v2';

// Get the base path from the service worker's own location
const BASE_PATH = self.location.pathname.replace(/\/service-worker\.js$/, '') || '';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        BASE_PATH + '/',
        BASE_PATH + '/index.html',
        BASE_PATH + '/styles.css',
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('booksWithMusic-') && key !== CACHE_NAME && key !== AUDIO_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
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
