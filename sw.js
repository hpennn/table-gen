var CACHE_NAME = 'table-gen-3';
var ASSETS = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE_NAME).then(function(c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener('fetch', function(e) {
  // Skip non-HTTP/HTTPS requests (e.g., chrome-extension://)
  if (!e.request.url.startsWith('http://') && !e.request.url.startsWith('https://')) {
    return;
  }
  // Network-first for HTML navigation requests
  if (e.request.mode === 'navigate' || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'))) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        return response;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }
  // Skip API requests
  if (e.request.url.includes('/api/')) { return; }
  // Skip non-GET
  if (e.request.method !== 'GET') { return; }

  e.respondWith(
    caches.match(e.request).then(function(r) {
      return r || fetch(e.request).then(function(resp) {
        var clone = resp.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone).catch(function(){}); });
        return resp;
      }).catch(function() { return caches.match('/'); })
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
