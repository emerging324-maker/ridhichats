// Ridhi Chats POS — offline support. Bump CACHE on every release so phones pick up the new files.
const CACHE = "ridhi-pos-v3.3.0";
const SHELL = ["./","index.html","styles.css","manifest.webmanifest","logo.jpg","icon-192.png","icon-512.png",
  "js/qrcode.js","js/fx.js","js/core.js","js/pos.js","js/printer.js","js/admin.js",
  "img/bhel.jpg","img/bluedrink.jpg","img/club.jpg","img/coldcoffee.jpg","img/corncanopy.jpg","img/cornchaat.jpg","img/cornpizza.jpg","img/cutlet.jpg","img/dahipapdi.jpg","img/dahipuri.jpg","img/falooda.jpg","img/fries.jpg","img/gingerlime.jpg","img/golisoda.jpg","img/grill.jpg","img/grill2.jpg","img/jeera.jpg","img/lemonade.jpg","img/masalapuri.jpg","img/mint.jpg","img/nippat.jpg","img/panipuri.jpg","img/papdi.jpg","img/perifries.jpg","img/pizza.jpg","img/pizza2.jpg","img/ragda.jpg","img/roll.jpg","img/roll2.jpg","img/samosa.jpg","img/sandwich.jpg","img/sevpuri.jpg","img/streetsandwich.jpg","img/tikki.jpg","img/toast.jpg","img/toast2.jpg","img/wrap.jpg"];
self.addEventListener("install", e => {
  // cache each file on its own so one missing file can never block the install
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.hostname.includes("google.com") && !url.hostname.includes("fonts")) return; // Apps Script: always live
  if(url.origin !== location.origin && !url.hostname.includes("fonts.g")) return;
  // serve from cache at once (works offline), refresh the cache in the background
  e.respondWith(caches.open(CACHE).then(cache => cache.match(req, {ignoreSearch:url.origin === location.origin}).then(hit => {
    const net = fetch(req).then(res => { if(res && (res.status === 200 || res.type === "opaque")) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
