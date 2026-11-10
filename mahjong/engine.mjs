import {scoreWin} from './scoring.mjs?v=2';
import {WINDS,countOf,windIndex,roundText} from './rules.mjs?v=2';
export {WINDS,countOf};
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const int=(n,min=0,max=1000000)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export const windOf=windIndex;
export const roundName=game=>roundText(game.round,countOf(game));
export function standings(game){const n=countOf(game),rows=game.players.map((p,id)=>({...p,id,change:p.points-game.config.starting})).sort((a,b)=>b.points-a.points||(a.id-game.initialDealer+n)%n-(b.id-game.initialDealer+n)%n);rows.forEach((r,i)=>{r.rank=i&&r.points===rows[i-1].points?rows[i-1].rank:i+1;});return rows;}
export function createGame(names,config={}) {
  const count=config.count??names?.length;
  check([3,4].includes(count),'3人打ち・4人打ちを選んでください。');
  const c={starting:count===3?35000:25000,length:'hanchan',aka:true,kuitan:true,kiriage:false,kazoe:true,doubleYakuman:true,nuki:true,tsumo:'loss',honbaValue:300,...config,count};
  check(Array.isArray(names)&&names.length===count,`${count}人の名前を入力してください。`);
  const clean=names.map((n,i)=>String(n).trim().slice(0,20)||`プレイヤー${i+1}`);
  check(new Set(clean).size===count,'名前が重ならないようにしてください。');
  check(int(c.starting,1000,100000)&&c.starting%100===0,'開始点は1,000〜100,000点の100点単位です。');
  check(['tonpu','hanchan'].includes(c.length),'東風戦・半荘を選んでください。');
  check(['loss','split'].includes(c.tsumo),'ツモの支払い方法を選んでください。');
  check([300,1000].includes(c.honbaValue),'本場の加点を選んでください。');
  return {version:1,config:c,players:clean.map(name=>({name,points:c.starting})),supply:c.starting*count,phase:'parent',dealer:0,initialDealer:0,round:0,honba:0,kyotaku:0,riichi:Array(count).fill(false),parentRolls:[],wall:null,result:null,log:[]};
}
function dicePair(dice){check(Array.isArray(dice)&&dice.length===2&&dice.every(n=>int(n,1,6)),'サイコロはそれぞれ1〜6です。');return dice[0]+dice[1];}
export function wallGuide(dealer,dice,count=4){const sum=dicePair(dice);check([3,4].includes(count)&&int(dealer,0,count-1),'親と人数を確認してください。');return {dice:[...dice],sum,owner:(dealer+sum-1)%count,cut:sum,start:sum+1};}
export function validateGame(g) {
  check(g?.version===1&&Array.isArray(g.players)&&[3,4].includes(g.players.length),'保存データを読み込めません。');
  check(['parent','wall','play','result','ended'].includes(g.phase),'局の進行を確認できません。');
  const n=countOf(g);
  check(int(g.dealer,0,n-1)&&int(g.initialDealer,0,n-1)&&int(g.round,0,99)&&int(g.honba,0,10000)&&int(g.kyotaku,0,10000),'局・親・本場・供託を確認してください。');
  check(g.players.every(p=>typeof p.name==='string'&&p.name.length<=20&&int(p.points,-100000000,100000000)&&p.points%100===0),'持ち点を確認してください。');
  check(Array.isArray(g.riichi)&&g.riichi.length===n&&g.riichi.every(v=>typeof v==='boolean'),'リーチ情報を確認してください。');
  check(g.players.reduce((a,p)=>a+p.points,0)+g.kyotaku*1000===g.supply,'点棒の合計が一致しません。');return true;
}
export function previewWins(game,inputs) {
  const n=countOf(game);
  check(game.phase==='play','対局中に和了を登録してください。');
  check(Array.isArray(inputs)&&inputs.length>=1&&inputs.length<=n-1,`和了は1〜${n-1}人で指定してください。`);
  const wins=inputs.map(input=>scoreWin(game,input));
  check(new Set(wins.map(w=>w.winner)).size===wins.length,'同じ人を重複して和了にできません。');
  if(wins.length>1)check(wins.every(w=>w.method==='ron'&&w.from===wins[0].from),'複数ロンは同じ放銃者に対して登録してください。');
  check(!wins.some(w=>wins.some(other=>other.winner===w.from)&&w.method==='ron'),'和了者と放銃者は同じ人にできません。');
  const delta=Array(n).fill(0),declared=wins.filter(w=>w.declare).map(w=>w.winner);
  for(const id of declared){check(game.players[id].points>=1000,'未登録のリーチ棒1,000点を支払えません。');delta[id]-=1000;}
  for(const win of wins){check(win.delta.length===n&&win.delta.every(n=>int(n,-10000000,10000000)&&n%100===0)&&win.delta.reduce((a,b)=>a+b,0)===0,'精算する点数を確認できません。');win.delta.forEach((n,id)=>delta[id]+=n);}
  const receiver=wins.length===1?wins[0].winner:[...wins].sort((a,b)=>(a.winner-a.from+n)%n-(b.winner-b.from+n)%n)[0].winner;
  const sticks=game.kyotaku+declared.length;delta[receiver]+=sticks*1000;
  const renchan=wins.some(w=>w.winner===game.dealer);
  return {kind:'win',wins,delta,sticks,receiver,declared,next:{dealer:renchan?game.dealer:(game.dealer+1)%n,round:game.round+(renchan?0:1),honba:renchan?game.honba+1:0},label:wins.length>1?`${wins.length}人ロン`:wins[0].method==='ron'?'ロン':'ツモ'};
}
function result(g,data){data.delta.forEach((n,id)=>g.players[id].points+=n);g.result={...data,round:roundName(g),honba:g.honba};g.phase='result';g.log.push(`${roundName(g)} ${g.honba}本場：${data.label}`);}
export function transition(original,action) {
  validateGame(original);const g=structuredClone(original),n=countOf(g);
  if(action.type==='parent-roll') {
    check(g.phase==='parent'&&g.parentRolls.length<2,'親決めは2回振りです。');const sum=dicePair(action.dice);
    const roller=g.parentRolls.length?g.parentRolls[0].target:0,target=(roller+sum-1)%n;
    g.parentRolls.push({dice:action.dice,sum,roller,target});
    if(g.parentRolls.length===2){g.dealer=target;g.initialDealer=target;g.phase='wall';}
  } else if(action.type==='parent-manual') {
    check(g.phase==='parent'&&int(action.id,0,n-1),'親を選んでください。');g.dealer=action.id;g.initialDealer=action.id;g.phase='wall';
  } else if(action.type==='wall-roll') {
    check(['wall','play'].includes(g.phase),'開門を確認する局を選んでください。');g.wall=wallGuide(g.dealer,action.dice,n);
  } else if(action.type==='start') {check(g.phase==='wall','局の準備中に開始してください。');g.phase='play';}
  else if(action.type==='riichi') {
    check(g.phase==='play'&&int(action.id,0,n-1),'対局中のプレイヤーを選んでください。');check(!g.riichi[action.id],'すでにリーチ登録済みです。');check(g.players[action.id].points>=1000,'リーチには1,000点必要です。');
    g.players[action.id].points-=1000;g.kyotaku++;g.riichi[action.id]=true;g.log.push(`${roundName(g)}：${g.players[action.id].name} リーチ`);
  } else if(action.type==='win') {const data=previewWins(g,action.wins);result(g,data);g.kyotaku=0;}
  else if(action.type==='draw') {
    check(g.phase==='play','対局中に流局を登録してください。');const tenpai=[...new Set(action.tenpai||[])];
    check(tenpai.every(id=>int(id,0,n-1)),'テンパイの人を選んでください。');
    if(!action.abort)check(g.riichi.every((r,id)=>!r||tenpai.includes(id)),'リーチした人はテンパイとして登録してください。');
    const delta=Array(n).fill(0),ready=tenpai.length,pool=n===3?2000:3000;
    if(!action.abort&&ready>0&&ready<n)for(let id=0;id<n;id++)delta[id]=tenpai.includes(id)?pool/ready:-pool/(n-ready);
    const stay=action.abort||tenpai.includes(g.dealer);
    result(g,{kind:'draw',label:action.abort?'途中流局':`流局（${ready}人テンパイ）`,tenpai,abort:!!action.abort,delta,next:{dealer:stay?g.dealer:(g.dealer+1)%n,round:g.round+(stay?0:1),honba:g.honba+1}});
  } else if(action.type==='next') {
    check(g.phase==='result','精算後に次局へ進んでください。');Object.assign(g,g.result.next);g.phase='wall';g.riichi=Array(n).fill(false);g.wall=null;g.result=null;
  } else if(action.type==='adjust') {
    check(Array.isArray(action.points)&&action.points.length===n&&action.points.every(n=>int(n,-10000000,10000000)&&n%100===0),'持ち点は100点単位で入力してください。');
    check(int(action.kyotaku,0,10000),'供託本数を確認してください。');
    check(action.points.reduce((a,b)=>a+b,0)+action.kyotaku*1000===g.supply,'持ち点と供託の合計を開始時と合わせてください。');
    action.points.forEach((n,id)=>g.players[id].points=n);g.kyotaku=action.kyotaku;g.log.push('点数を手動調整');
  } else if(action.type==='transfer') {
    check(g.phase==='play'&&int(action.from,0,n-1)&&int(action.to,0,n-1)&&action.from!==action.to,'点棒を渡す相手を選んでください。');
    check(int(action.amount,100,1000000)&&action.amount%100===0,'移動する点棒は100点単位で入力してください。');
    g.players[action.from].points-=action.amount;g.players[action.to].points+=action.amount;
    g.log.push(`${g.players[action.from].name} → ${g.players[action.to].name} ${action.amount.toLocaleString('ja-JP')}点`);
  } else if(action.type==='award') {
    check(g.phase==='play'&&int(action.to,0,n-1)&&g.kyotaku>0,'供託を受け取る人を選んでください。');
    g.players[action.to].points+=g.kyotaku*1000;g.log.push(`供託${g.kyotaku}本 → ${g.players[action.to].name}`);g.kyotaku=0;
  } else if(action.type==='reset-riichi') {
    check(g.phase==='play','点棒管理中に操作してください。');g.riichi=Array(n).fill(false);g.log.push('リーチ表示をリセット（供託は持ち越し）');
  } else if(action.type==='wall-dealer') {
    check(g.phase==='wall'&&int(action.id,0,n-1),'親を選んでください。');g.dealer=action.id;g.wall=null;
  } else if(action.type==='end') {
    check(['wall','result'].includes(g.phase),'局の合間に終了してください。');
    const leader=standings(g)[0];g.players[leader.id].points+=g.kyotaku*1000;g.kyotaku=0;g.phase='ended';g.log.push('対局終了（残った供託はトップへ）');
  } else throw new Error('操作を確認してください。');
  validateGame(g);return g;
}
