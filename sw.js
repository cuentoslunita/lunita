/* Service worker de Lunita: deja instalar la app y leer sin conexión lo que ya se abrió.
   - Las páginas (index y privacidad) van "primero la red, si no hay, la copia": así una versión nueva llega en cuanto hay conexión.
   - Las imágenes y letras (arte/) van "primero la copia": se guardan al verse por primera vez.
   - NUNCA toca pedidos a otros sitios: la comprobación del pago (Cloudflare) y Mercado Pago pasan siempre directo por la red.
   Los dos nombres de caché se calculan al armar el sitio (lanzamiento/armar_sitio.py): cambian solo si cambia la app o el arte. */
const CACHE_PAGINAS = 'lunita-paginas-9fc3768de0';
const CACHE_ARTE = 'lunita-arte-fc3d62e423';
const PRECARGA = ['./', 'privacidad.html', 'manifest.webmanifest', 'arte/pwa/icon-192.png', 'arte/pwa/icon-512.png', 'arte/pwa/maskable-512.png', 'arte/pwa/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_PAGINAS).then((c) => c.addAll(PRECARGA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('lunita-') && k !== CACHE_PAGINAS && k !== CACHE_ARTE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;          // el pago y todo lo externo, directo a la red
  const base = new URL('./', self.location).pathname;                                  // /lunita/
  const ruta = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : null;
  if (ruta === null || ruta.startsWith('placas/') || ruta === 'sw.js') return;       // las placas de redes y el propio worker no se guardan

  if (req.mode === 'navigate') { e.respondWith(paginaRedPrimero(req)); return; }
  if (ruta.startsWith('arte/')) { e.respondWith(copiaPrimero(req)); return; }
  e.respondWith(paginaRedPrimero(req));
});

async function paginaRedPrimero(req) {
  const cache = await caches.open(CACHE_PAGINAS);
  try {
    const r = await fetch(req);
    if (r.ok) cache.put(req, r.clone());
    return r;
  } catch (err) {
    const guardada = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('./') : null);
    if (guardada) return guardada;
    throw err;
  }
}

async function copiaPrimero(req) {
  const cache = await caches.open(CACHE_ARTE);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const r = await fetch(req);
  if (r.ok) cache.put(req, r.clone());
  return r;
}
