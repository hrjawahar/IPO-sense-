/* IPO Sense service worker: offline app shell + Android share target inbox */
const SHELL = "ipo-sense-shell-v4";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("ipo-sense-shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Something shared from another app: keep it in an inbox cache, then open the app.
  if (e.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const inbox = await caches.open("share-inbox");
        for (const k of await inbox.keys()) await inbox.delete(k);
        const files = form.getAll("shots").filter(f => f && f.size);
        for (let i = 0; i < files.length; i++) {
          await inbox.put(new URL("inbox-file-" + i, self.registration.scope).href, new Response(files[i], { headers: { "content-type": files[i].type || "image/png" } }));
        }
        const text = ["title", "text", "url"].map(k => form.get(k)).filter(v => typeof v === "string" && v.trim()).join("\n");
        if (text) await inbox.put(new URL("inbox-text", self.registration.scope).href, new Response(text));
      } catch (err) {}
      return Response.redirect(new URL("./?shared=1#score", self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Pages: network first so updates show up, cached copy when offline.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(SHELL).then(x => x.put("./index.html", c)); return r; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
