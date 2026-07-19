// Minimal app-shell cache for offline fallback only. Deliberately does NOT
// cache /api/* - financial data must always come from the network, never a
// stale cache.
//
// Network-first (not cache-first): a mobile home-screen PWA install is
// rarely fully closed, so a cache-first strategy could keep serving an old
// JS/CSS bundle indefinitely across deploys - stale theme logic, stale
// layout fixes - even while a fresh browser tab on desktop gets the latest
// build. Always try the network first; only fall back to cache when offline.
const CACHE_NAME = "pfms-shell-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw new Error("offline and not cached");
      }
    })
  );
});
