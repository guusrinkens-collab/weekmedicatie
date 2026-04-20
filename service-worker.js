const CACHE_NAME = 'weekmedicatie-v6';
const BASE = self.registration.scope;
const ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icons/app-icon.jpg',
  BASE + 'assets/welcome.png',
  BASE + 'css/style.css',
  BASE + 'js/data.js',
  BASE + 'js/holidays.js',
  BASE + 'js/ui.js',
  BASE + 'js/stock.js',
  BASE + 'js/tapering.js',
  BASE + 'js/schedule.js',
  BASE + 'js/medications.js',
  BASE + 'js/theme.js',
  BASE + 'js/camera.js',
  BASE + 'js/notifications.js',
  BASE + 'js/weekdoosjes.js',
  BASE + 'js/history.js',
  BASE + 'js/wellbeing.js',
  BASE + 'js/contacts.js',
  BASE + 'js/export.js',
  BASE + 'js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error('Service worker cache fout:', err);
        return self.skipWaiting();
      })
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
  if (e.request.url.includes('anthropic.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => caches.match(BASE + 'index.html'));
    })
  );
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Weekmedicatie', body: 'Tijd voor uw medicatie!' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: BASE + 'icons/app-icon.jpg',
      badge: BASE + 'icons/app-icon.jpg',
      vibrate: [200, 100, 200],
      tag: 'medicatie-reminder',
      renotify: true
    })
  );
});
