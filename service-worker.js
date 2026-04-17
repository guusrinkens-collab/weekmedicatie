const CACHE_NAME = 'weekmedicatie-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/css/style.css',
  '/js/data.js',
  '/js/holidays.js',
  '/js/ui.js',
  '/js/stock.js',
  '/js/tapering.js',
  '/js/schedule.js',
  '/js/medications.js',
  '/js/theme.js',
  '/js/camera.js',
  '/js/notifications.js',
  '/js/history.js',
  '/js/wellbeing.js',
  '/js/contacts.js',
  '/js/export.js',
  '/js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Pass through Anthropic API calls
  if (e.request.url.includes('anthropic.com')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Push notification handler
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Weekmedicatie', body: 'Tijd voor uw medicatie!' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      vibrate: [200, 100, 200],
      tag: 'medicatie-reminder',
      renotify: true
    })
  );
});
