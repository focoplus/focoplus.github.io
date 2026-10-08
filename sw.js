/* Foco+ · modo sin internet
   Cuando subas cambios a GitHub, sube también este archivo cambiando VERSION
   (ej. de 'foco-plus-v3' a 'foco-plus-v4'): así los teléfonos saben que hay algo nuevo. */
const VERSION = 'foco-plus-v3';
const ARCHIVOS = [
  './', './index.html', './manifest.json', './perfil.js',
  './iconos/icon-192.png', './iconos/icon-512.png', './iconos/apple-touch-icon.png', './iconos/favicon.png',
  './english/', './english/index.html',
  './sql/', './sql/index.html',
  './lectura/', './lectura/index.html',
  './ejercicio/', './ejercicio/index.html',
  './finanzas/', './finanzas/index.html',
  './lib/sql-asm.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'foco-plus-fuentes').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Letras (Google Fonts): se guardan la primera vez y después salen del teléfono
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open('foco-plus-fuentes').then(c => c.match(req).then(hit => hit ||
      fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit))));
    return;
  }
  if (url.origin !== location.origin) return;

  // Motor de SQL e íconos: no cambian, se usan directo desde el teléfono
  if (url.pathname.includes('/lib/') || url.pathname.includes('/iconos/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
    return;
  }

  // Páginas: primero intenta traer la versión más nueva; si no hay internet, usa la guardada
  // (si la señal es mala y tarda más de 4 segundos, también usa la guardada)
  const red = fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); return caches.open(VERSION).then(c => c.put(req, copia)).then(() => res); }
    return res;
  });
  e.waitUntil(red.catch(() => {}));
  const lento = new Promise((_, no) => setTimeout(no, 4000));
  const guardada = () => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'));
  e.respondWith(
    Promise.race([red, lento]).catch(() => guardada().then(hit => hit || red))
  );
});
