import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const code=await readFile(new URL('sw.js',root),'utf8');
function harness() {
  const listeners=new Map(),stores=new Map();
  let online=true,missing=null,networkCalls=0,activated=false;
  const key=request=>typeof request==='string'?request:request.url;
  const fetch=async request=>{
    networkCalls++;
    if(!online||key(request).includes(missing||'NEVER-MISSING'))throw new Error('No network');
    const url=new URL(key(request)),path=url.pathname.replace(/^\/mahjong\//,'')||'index.html';
    return new Response(await readFile(new URL(path,root)),{status:200});
  };
  const caches={
    async open(name) {
      if(!stores.has(name))stores.set(name,new Map());
      const entries=stores.get(name);
      return {
        async match(request){return entries.get(key(request))?.clone();},
        async put(request,response){entries.set(key(request),response.clone());},
        async addAll(requests){
          const responses=await Promise.all(requests.map(fetch));
          requests.forEach((request,i)=>entries.set(key(request),responses[i]));
        }
      };
    },
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);}
  };
  const self={location:{href:'https://example.test/mahjong/sw.js'},clients:{claim:async()=>{activated=true;}},skipWaiting:async()=>{},addEventListener:(name,handler)=>listeners.set(name,handler)};
  const context=vm.createContext({self,caches,fetch,URL,Request,Response,Set,Promise});
  vm.runInContext(code,context);
  const lifecycle=async name=>{let done;listeners.get(name)({waitUntil:p=>{done=p;}});return done;};
  return {
    stores,online(value){online=value;},missing(value){missing=value;},calls:()=>networkCalls,activated:()=>activated,
    shell:()=>[...vm.runInContext('SHELL',context)],
    install:()=>lifecycle('install'),activate:()=>lifecycle('activate'),
    async status(type='OFFLINE_STATUS') {
      let done,result;
      listeners.get('message')({data:{type},ports:[{postMessage:value=>{result=value;}}],waitUntil:p=>{done=p;}});
      await done;return result;
    },
    async request(url,mode='cors',method='GET') {
      let response;
      listeners.get('fetch')({request:{url,mode,method},respondWith:p=>{response=p;}});
      return response;
    }
  };
}
test('a cold offline navigation and every app asset are served without any network request',async()=>{
  const app=harness();await app.install();await app.activate();assert.equal((await app.status()).ready,true);
  app.online(false);const before=app.calls();
  const home=await app.request('https://example.test/mahjong/?from=home-screen','navigate');
  assert.match(await home.text(),/麻雀点棒/);
  for(const asset of app.shell())assert.equal((await app.request(asset)).status,200);
  assert.equal(app.calls(),before);assert.equal(app.activated(),true);
});
test('the offline shell covers all HTML, JavaScript imports, and manifest icons',async()=>{
  const app=harness(),shell=new Set(app.shell());
  const html=await readFile(new URL('index.html',root),'utf8');
  for(const match of html.matchAll(/(?:href|src)="(\.\/[^\"]+)"/g))assert.ok(shell.has(new URL(match[1],'https://example.test/mahjong/').href),match[1]);
  for(const file of ['app.mjs','engine.mjs','scoring.mjs','rules.mjs','offline.mjs']) {
    const source=await readFile(new URL(file,root),'utf8');
    for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.\/[^'"]+)['"]/g))assert.ok(shell.has(new URL(match[1],'https://example.test/mahjong/').href),match[1]);
  }
  const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',root),'utf8'));
  assert.equal(manifest.start_url,'./');assert.equal(manifest.display,'standalone');
  for(const icon of manifest.icons)assert.ok(shell.has(new URL(icon.src,'https://example.test/mahjong/').href));
});
test('incomplete preparation never reports ready and can be repaired after reconnection',async()=>{
  const app=harness();app.missing('vendor/majiang.mjs');
  await assert.rejects(app.install(),/No network/);assert.equal((await app.status()).ready,false);
  app.missing(null);assert.equal((await app.status('PREPARE_OFFLINE')).ready,true);
  app.online(false);assert.equal((await app.request('https://example.test/mahjong/','navigate')).status,200);
});
test('activation keeps unrelated caches, and unrelated URLs and writes are never intercepted',async()=>{
  const app=harness();app.stores.set('some-other-site',new Map());app.stores.set('poker-card-offline-4',new Map());app.stores.set('riichi-mahjong-offline-old',new Map());
  await app.install();await app.activate();
  assert.ok(app.stores.has('some-other-site'));assert.ok(app.stores.has('poker-card-offline-4'));assert.ok(!app.stores.has('riichi-mahjong-offline-old'));
  assert.equal(await app.request('https://example.test/other/','navigate'),undefined);
  assert.equal(await app.request('https://other.test/mahjong/app.mjs?v=4'),undefined);
  assert.equal(await app.request('https://example.test/mahjong/','navigate','POST'),undefined);
});
