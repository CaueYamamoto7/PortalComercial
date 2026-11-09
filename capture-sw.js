var CACHE = "assinasoft-capture-v1";
var FILES = [
  "/cadastro-lead", "/assets/css/tokens.css", "/assets/css/base.css",
  "/assets/css/components.css", "/assets/css/cadastro-lead.css",
  "/assets/js/config.js", "/assets/js/util.js", "/assets/js/store.js",
  "/assets/js/auth.js", "/assets/js/api.js", "/assets/js/capture-offline.js",
  "/assets/js/pages/cadastro-lead.js", "/images/logoFull.png", "/images/logoMini.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.indexOf("assinasoft-capture-") === 0 && key !== CACHE; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.indexOf("/api/") === 0) return;
  var path = url.pathname === "/cadastro-lead.html" ? "/cadastro-lead" : url.pathname;
  if (FILES.indexOf(path) === -1) return;
  event.respondWith(caches.match(path).then(function (cached) {
    return cached || fetch(event.request);
  }));
});
