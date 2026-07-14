/*
 * Service worker: app shell only.
 *
 * The one rule that matters: /api/ is NEVER cached, never served from cache,
 * never even inspected. This is a money app. A cached balance is a number that
 * was true once, presented as if it were true now — worse than an error,
 * because an error is honest. Real offline support (a queued-write log with
 * idempotency keys) is a separate, deliberate piece of work; this file is not
 * a down payment on it.
 *
 * What it does buy: an installable app on Android/Chrome (which requires a
 * fetch handler to exist at all), an instant cold start from the hashed static
 * bundle, and an honest "sin conexión" page instead of the browser's dinosaur.
 */

const VERSION = "v1";
const CACHE = `finanzas-shell-${VERSION}`;
const OFFLINE_URL = "/offline";

/** Same-origin GETs whose content is immutable or presentational — never data. */
function isShellAsset(pathname) {
  return (
    // Content-hashed by Next: the URL changes whenever the bytes do, so a
    // cache hit can never be stale.
    pathname.startsWith("/_next/static/") ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icon-") ||
    pathname === "/icon" ||
    pathname === "/apple-icon"
  );
}

/**
 * The whole routing decision, in one pure function so it can be tested for real
 * rather than reasoned about. Returns what to do with a request.
 */
function pickStrategy(request) {
  const url = new URL(request.url);

  // Anything that writes is never ours to replay or replace.
  if (request.method !== "GET") return "passthrough";
  // Third-party requests (fonts, analytics) stay the browser's business.
  if (url.origin !== self.location.origin) return "passthrough";
  // The rule. Data always comes from the server or not at all.
  if (url.pathname.startsWith("/api/")) return "passthrough";

  if (request.mode === "navigate") return "navigate";
  if (isShellAsset(url.pathname)) return "cache-first";

  return "passthrough";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      // Take over immediately instead of waiting for every tab to close: a
      // half-updated app (new HTML, old worker) is worse than a brief overlap.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("finanzas-shell-") && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const strategy = pickStrategy(event.request);
  if (strategy === "passthrough") return;

  if (strategy === "navigate") {
    // Network-first: a page is only ever served from the network, so it can't
    // render yesterday's markup. The cache is the apology, not the answer.
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (cached) =>
            cached ??
            new Response("Sin conexión", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
        )
      )
    );
    return;
  }

  // cache-first, for immutable assets only.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Opaque/error responses are not worth keeping — caching a 404 of a
        // chunk would wedge the app until the next version bump.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
