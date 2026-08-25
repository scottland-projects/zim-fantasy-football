// Deliberately minimal: this app is entirely dynamic (live scores, score
// predictions, per-request nonce-based CSP) so the service worker only
// exists to satisfy PWA installability and speed up repeat loads of
// content-hashed static assets. It must NEVER cache HTML documents, API
// calls, or Supabase requests — doing so would risk serving a stale score,
// a stale prediction, or (worse) a page rendered with an old CSP nonce.
const CACHE_NAME = "africa-fantasy-static-v1";
const STATIC_PATTERNS = [/^\/_next\/static\//, /^\/icon(-\d+)?\.png$/, /^\/icon-maskable-512\.png$/, /^\/apple-icon\.png$/, /^\/manifest\.webmanifest$/];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!STATIC_PATTERNS.some((re) => re.test(url.pathname))) return;

  // Cache-first for content-hashed / rarely-changing static assets only.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
