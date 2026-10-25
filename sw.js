const CACHE_NAME = 'pdf-audio-sync-v9';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Không can thiệp vào các request tải PDF, Audio hoặc domain R2 / bên ngoài
  if (
    url.includes('r2.dev') ||
    url.includes('drive.google.com') ||
    url.includes('googleusercontent.com') ||
    url.endsWith('.pdf') ||
    url.endsWith('.mp3') ||
    url.endsWith('.m4a') ||
    url.endsWith('.wav') ||
    url.includes('corsproxy')
  ) {
    return; // Để trình duyệt trực tiếp tải từ mạng
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
