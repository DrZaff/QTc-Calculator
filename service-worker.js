const CACHE_NAME = "clinicaltools-QTc-v1"; // change APPKEY per app, e.g. "abg" or "aki"
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon-180.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(res => {
      // If we have it cached, use it; otherwise fetch from network
      return (
        res ||
        fetch(event.request).catch(() => {
          // If offline and request fails, fall back to index.html
          return caches.match("/index.html");
        })
      );
    })
  );
});
