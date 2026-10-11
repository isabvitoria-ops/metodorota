/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

const CACHE = "marvia-v1";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll([
        "/metodorota/",
        "/metodorota/index.html",
      ]),
    ),
  );
  void self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((n) => n !== CACHE)
          .map((n) => caches.delete(n)),
      ),
    ),
  );
  void self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  // API calls (Supabase) always go to network
  if (url.hostname.includes("supabase")) return;

  // Navigation requests: network-first, fall back to cache
  if (evento.request.mode === "navigate") {
    evento.respondWith(
      fetch(evento.request)
        .then((resposta) => {
          const copia = resposta.clone();
          void caches.open(CACHE).then((cache) => cache.put(evento.request, copia));
          return resposta;
        })
        .catch(() => caches.match("/metodorota/index.html").then((r) => r ?? new Response("Offline", { status: 503 }))),
    );
    return;
  }

  // Static assets under /metodorota/: cache-first
  if (url.pathname.startsWith("/metodorota/")) {
    evento.respondWith(
      caches.match(evento.request).then((cacheada) => {
        if (cacheada) return cacheada;
        return fetch(evento.request).then((resposta) => {
          const copia = resposta.clone();
          void caches.open(CACHE).then((cache) => cache.put(evento.request, copia));
          return resposta;
        });
      }),
    );
    return;
  }
});
