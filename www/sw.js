const CACHE = "verse-advocate-v2";
// Shell + default translation are precached; other translations cache on first use
const PRECACHE = ["./", "index.html", "manifest.json", "web.verses.txt", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cachePut = (req, res) => {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(req, copy));
  }
  return res;
};

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  const isPage = e.request.mode === "navigate" || e.request.url.endsWith("index.html");
  if (isPage) {
    // network-first so app updates reach installed users; cache is the offline fallback
    e.respondWith(
      fetch(e.request).then(res => cachePut(e.request, res)).catch(() => caches.match(e.request))
    );
  } else {
    // cache-first for the big immutable data files
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => cachePut(e.request, res)))
    );
  }
});
