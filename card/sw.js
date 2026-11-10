/* Bump this release and the versioned asset URLs together when shipping. */
const RELEASE = '5';
const CACHE_PREFIX = 'poker-card-offline-';
const CACHE = `${CACHE_PREFIX}${RELEASE}`;
const BASE = new URL('./', self.location.href);
const SHELL = [
  './', './index.html', './style.css?v=5', './app.mjs?v=5',
  './engine.mjs', './presentation.mjs?v=3', './offline.mjs?v=5',
  './manifest.webmanifest', './icon.svg',
  './icon-180.png', './icon-192.png', './icon-512.png'
].map(path => new URL(path, BASE).href);
const SHELL_URLS = new Set(SHELL);

async function ready() {
  const cache = await caches.open(CACHE);
  const present = await Promise.all(SHELL.map(url => cache.match(url)));
  return present.every(Boolean);
}
async function prepare() {
  const cache = await caches.open(CACHE);
  // addAll is atomic: a failed download cannot declare a partial shell ready.
  await cache.addAll(SHELL.map(url => new Request(url, {cache:'reload'})));
}
self.addEventListener('install', event => {
  event.waitUntil(prepare().then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Scope this cleanup to this app; never clear game data or other sites' caches.
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (!['OFFLINE_STATUS','PREPARE_OFFLINE'].includes(event.data?.type)) return;
  event.waitUntil((async () => {
    try {
      if (event.data.type === 'PREPARE_OFFLINE') await prepare();
      event.ports[0]?.postMessage({type:'OFFLINE_STATUS',release:RELEASE,ready:await ready()});
    } catch {
      event.ports[0]?.postMessage({type:'OFFLINE_STATUS',release:RELEASE,ready:false});
    }
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin) return;
  const home = request.mode === 'navigate' && [BASE.pathname,`${BASE.pathname}index.html`].includes(url.pathname);
  if (!home && !SHELL_URLS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(home ? BASE.href : request);
    if (cached) return cached;
    // Recover an individually evicted asset when a connection is available.
    const response = await fetch(request);
    if (response.ok) await cache.put(home ? BASE.href : request,response.clone());
    return response;
  })());
});
