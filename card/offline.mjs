const RELEASE = '4';
export const offlineStatus = {state:'loading',message:'オフライン利用を準備中…'};
let pending = null;
function update(state,message) {
  Object.assign(offlineStatus,{state,message});
  window.dispatchEvent(new CustomEvent('offline-status',{detail:{...offlineStatus}}));
}
function bounded(promise,ms=15000) {
  return new Promise((resolve,reject) => {
    const timer=setTimeout(()=>reject(new Error('timeout')),ms);
    promise.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
}
function ask(worker,type='OFFLINE_STATUS') {
  return new Promise((resolve,reject) => {
    const channel=new MessageChannel();
    const timer=setTimeout(()=>{channel.port1.close();reject(new Error('timeout'));},8000);
    channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
    worker.postMessage({type},[channel.port2]);
  });
}
async function verify(worker,repair=false) {
  const status=await ask(worker,repair?'PREPARE_OFFLINE':'OFFLINE_STATUS');
  if(status.release===RELEASE && status.ready) {
    update('ready','オフライン準備完了');return true;
  }
  return false;
}
async function prepare(repair) {
  if(!('serviceWorker' in navigator)||!window.isSecureContext) {
    update('unavailable','このブラウザでは準備できません。Safariで開いてください。');return false;
  }
  let cachedReady=false;
  try {
    const existing=await navigator.serviceWorker.getRegistration('./');
    if(existing?.active)cachedReady=await verify(existing.active,false);
    // Always check for a new worker while connected, but don't make a cached
    // game wait for the network (e.g. on a ferry with a weak connection).
    const install=navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
    if(cachedReady&&!repair) {install.catch(()=>{});return true;}
    if(repair)update('loading','オフライン利用を準備中…');
    const registration=await bounded(install);
    await bounded(navigator.serviceWorker.ready);
    const active=registration.active || (await navigator.serviceWorker.getRegistration('./'))?.active;
    if(active&&await verify(active,repair))return true;
    // A freshly installed worker may still be replacing an older controller.
    if(registration.installing||registration.waiting) {
      await bounded(new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})));
      if(navigator.serviceWorker.controller&&await verify(navigator.serviceWorker.controller,false))return true;
    }
    throw new Error('incomplete');
  } catch {
    if(cachedReady){update('ready','オフライン準備完了');return true;}
    update('error','まだ準備できていません。通信できる場所で再試行してください。');return false;
  }
}
export function prepareOffline(repair=false) {
  if(pending)return pending;
  pending=prepare(repair).finally(()=>{pending=null;});
  return pending;
}
window.addEventListener('online',()=>{prepareOffline();});
navigator.serviceWorker?.addEventListener('controllerchange',()=>{
  const worker=navigator.serviceWorker.controller;
  if(worker)verify(worker).catch(()=>{});
});
prepareOffline();
