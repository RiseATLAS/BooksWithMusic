const CACHE_NAME = 'booksWithMusic-v2';
const AUDIO_CACHE = 'booksWithMusic-audio-v2';

// Get the base path from the service worker's own location
// This will be '' for root deployment or '/BooksWithMusic' for subdirectory
const BASE_PATH = self.location.pathname.replace(/\/[^/]*$/, '');

// Helper to construct URLs safely
function getUrl(path) {
  if (!BASE_PATH) return path;
  return BASE_PATH + path;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        getUrl('/'),
        getUrl('/index.html'),
        getUrl('/styles.css'),
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
