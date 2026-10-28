const CACHE_NAME = 'madar-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './dashboard.html',
  './register.html',
  './exam.html',
  './books.html',
  './evaluations.html',
  './schedule.html',
  './profile.html',
  './subject.html',
  './lab.html',
  './base.css',
  './logo.jpg',
  './offline.html',
  './icon-192.png',
  './icon-512.png'
];

// 1. تخزين الملفات في الكاش أول ما التطبيق يتثبت
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. مسح الكاش القديم لو في نسخة جديدة
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. جلب الملفات (لو في نت يجيب من النت، لو مفيش يجيب من الكاش)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // لو النت فصل، هات الملف من الكاش
      return caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        // لو الملف مش موجود في الكاش ونت فصل، اعرض صفحة الأوفلاين
        if (event.request.mode === 'navigate') {
          return caches.match('./offline.html');
        }
      });
    })
  );
});