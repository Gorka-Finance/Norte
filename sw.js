/* Norte: service worker. Permite abrir la app sin conexión.
   - La página (index.html): primero la red (para recibir las actualizaciones) y, si no hay conexión, la copia guardada.
   - Iconos, manifiesto y fuentes: la copia guardada, que se renueva en segundo plano.
   - Las llamadas a Firebase no pasan por aquí: los datos los guarda la propia app en el dispositivo. */
const V = 'norte-430c5645a2';
const CORE = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.svg', './favicon-32.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('norte-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !FONTS.test(req.url)) return;
  if (same && url.pathname.endsWith('/config.js')) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try { const r = await Promise.race([fetch(req, { cache: 'no-cache' }), timeout(6000)]); if (r && r.ok) { c.put('./config.js', r.clone()); return r; } throw new Error('bad'); }
      catch (err) { return (await c.match('./config.js')) || Response.error(); }
    })());
    return;
  }
  if (same && (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const r = await Promise.race([fetch(req, { cache: 'no-cache' }), timeout(6000)]);
        if (r && r.ok) { c.put('./index.html', r.clone()); return r; }
        throw new Error('bad');
      } catch (err) {
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(req);
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
