/* Service worker: de schil van de site werkt ook bij slechte verbinding. Data komt altijd live. */
const CACHE = "bp-v4";
const SHELL = ["./", "index.html", "style.css", "config.js", "common.js", "app.js", "ranglijst.html", "ranglijst.js", "stemmen.html", "stemmen.js", "regels.html", "regels.js", "bush.svg", "icon-192.png"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  // Eerst netwerk (altijd de nieuwste versie), cache als terugval
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
