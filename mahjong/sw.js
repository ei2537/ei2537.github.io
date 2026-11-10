const RELEASE='1',CACHE_PREFIX='riichi-mahjong-offline-',CACHE=CACHE_PREFIX+RELEASE;
const BASE=new URL('./',self.location.href);
const SHELL=['./','./index.html','./style.css?v=1','./app.mjs?v=1','./engine.mjs','./scoring.mjs','./vendor/majiang.mjs','./vendor/LICENSE','./offline.mjs?v=1','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png'].map(path=>new URL(path,BASE).href);
const URLS=new Set(SHELL);
async function ready(){const cache=await caches.open(CACHE);return (await Promise.all(SHELL.map(url=>cache.match(url)))).every(Boolean);}
async function prepare(){const cache=await caches.open(CACHE);await cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})));}
self.addEventListener('install',event=>event.waitUntil(prepare().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&n!==CACHE).map(n=>caches.delete(n)));await self.clients.claim();})()));
self.addEventListener('message',event=>{if(!['OFFLINE_STATUS','PREPARE_OFFLINE'].includes(event.data?.type))return;event.waitUntil((async()=>{try{if(event.data.type==='PREPARE_OFFLINE')await prepare();event.ports[0]?.postMessage({release:RELEASE,ready:await ready()});}catch{event.ports[0]?.postMessage({release:RELEASE,ready:false});}})());});
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==BASE.origin)return;const home=req.mode==='navigate'&&[BASE.pathname,BASE.pathname+'index.html'].includes(url.pathname);if(!home&&!URLS.has(url.href))return;event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(home?BASE.href:req);if(cached)return cached;const response=await fetch(req);if(response.ok)await cache.put(home?BASE.href:req,response.clone());return response;})());});
