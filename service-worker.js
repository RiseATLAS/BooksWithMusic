// Cache version
const CACHE_VERSION = 'v1';
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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
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
