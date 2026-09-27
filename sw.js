/* Karo Schlauer offline: Seite und Bibel-Daten zwischenspeichern.
   Immer zuerst das Netz fragen (damit Updates sofort da sind), ohne Netz den gespeicherten Stand zeigen. */
const CACHE = "karo-schlauer-v3";
const DATEIEN = ["./", "./index.html", "./js/bibel-daten.js", "./js/supabase.min.js"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if(res && res.ok){ const kopie = res.clone(); caches.open(CACHE).then(c => c.put(req, kopie)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});
