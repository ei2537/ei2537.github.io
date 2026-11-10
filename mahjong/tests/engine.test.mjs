import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,previewWins,wallGuide,validateGame,standings} from '../engine.mjs';
import {scoreWin} from '../scoring.mjs';
const step=(g,type,extra={})=>transition(g,{type,...extra});
function play(){return step(step(createGame(['A','B','C','D']),'parent-manual',{id:0}),'start');}
const tiles=text=>text.match(/[mpsz][0-9]/g)||[];
const hand=(values,win,extra={})=>({winner:1,from:3,method:'ron',mode:'tiles',hand:tiles(values),win,melds:[],dora:['z5'],ura:[],lizhi:0,special:'none',...extra});
const pinfu=()=>hand('m1m2m3m4m5m6p2p2s2s3s4s6s7','s8');

test('two rolls pick the initial dealer, and every wall cut counts the roller as one',()=>{
 let g=createGame(['A','B','C','D']);g=step(g,'parent-roll',{dice:[1,1]});assert.equal(g.parentRolls[0].target,1);
 g=step(g,'parent-roll',{dice:[3,4]});assert.equal(g.dealer,3);assert.equal(g.initialDealer,3);assert.equal(g.phase,'wall');
 for(let dealer=0;dealer<4;dealer++)for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){const w=wallGuide(dealer,[a,b]);assert.equal(w.owner,(dealer+a+b-1)%4);assert.equal(w.start,a+b+1);}
});
test('riichi, ron, deposits and next dealer preserve the supply',()=>{
 let g=step(play(),'riichi',{id:1});assert.equal(g.players[1].points,24000);assert.equal(g.kyotaku,1);
 g=step(g,'win',{wins:[{winner:1,from:2,method:'ron',mode:'points',ron:8000}]});
 assert.deepEqual(g.players.map(p=>p.points),[25000,33000,17000,25000]);assert.equal(g.kyotaku,0);
 g=step(g,'next');assert.equal(g.round,1);assert.equal(g.dealer,1);assert.equal(g.honba,0);assert.deepEqual(g.riichi,[false,false,false,false]);
});
test('dealer and child tsumo split honba correctly',()=>{
 const g=play();g.honba=2;
 const dealer=previewWins(g,[{winner:0,method:'tsumo',mode:'points',child:4000}]);assert.deepEqual(dealer.delta,[12600,-4200,-4200,-4200]);assert.equal(dealer.next.honba,3);
 g.honba=1;const child=previewWins(g,[{winner:1,method:'tsumo',mode:'points',child:2000,parent:4000}]);assert.deepEqual(child.delta,[-4100,8300,-2100,-2100]);
});
test('draw payments cover zero through four tenpai players and all stay zero-sum',()=>{
 for(let n=0;n<=4;n++){const g=step(play(),'draw',{tenpai:[0,1,2,3].slice(0,n)});const delta=g.result.delta;assert.equal(delta.reduce((a,b)=>a+b,0),0);if(n===1)assert.deepEqual(delta,[3000,-1000,-1000,-1000]);if(n===2)assert.deepEqual(delta,[1500,1500,-1500,-1500]);if(n===3)assert.deepEqual(delta,[1000,1000,1000,-3000]);if(n===0||n===4)assert.deepEqual(delta,[0,0,0,0]);assert.equal(g.result.next.honba,1);assert.equal(validateGame(g),true);}
 const ready=step(play(),'riichi',{id:2});assert.throws(()=>step(ready,'draw',{tenpai:[0]}),/リーチ/);
 const abort=step(ready,'draw',{abort:true,tenpai:[]});assert.equal(abort.kyotaku,1);assert.deepEqual(abort.result.delta,[0,0,0,0]);assert.equal(abort.result.next.dealer,0);
});
test('multiple ron awards deposits to the closest winner independent of entry order',()=>{
 let g=step(play(),'riichi',{id:2});
 const wins=[{winner:3,from:0,method:'ron',mode:'points',ron:8000},{winner:1,from:0,method:'ron',mode:'points',ron:12000}];
 const p=previewWins(g,wins);assert.equal(p.receiver,1);assert.deepEqual(p.delta,[-20000,13000,0,8000]);
 assert.deepEqual(previewWins(g,[...wins].reverse()).delta,p.delta);
 assert.throws(()=>previewWins(g,[wins[0],wins[0]]),/重複/);assert.throws(()=>previewWins(g,[wins[0],{...wins[1],from:2}]),/同じ放銃者/);
 g=step(g,'win',{wins});assert.equal(validateGame(g),true);
});
test('tile scoring identifies pinfu and menzen tsumo with the correct fu and payments',()=>{
 const g=play(),ron=scoreWin(g,pinfu());assert.equal(ron.han,1);assert.equal(ron.fu,30);assert.equal(ron.base,1000);assert.deepEqual(ron.delta,[0,1000,0,-1000]);
 const tsumo=scoreWin(g,{...pinfu(),method:'tsumo'});assert.equal(tsumo.han,2);assert.equal(tsumo.fu,20);assert.equal(tsumo.base,1500);assert.deepEqual(tsumo.delta,[-700,1500,-400,-400]);
});
test('seven pairs use 25 fu and red fives are counted automatically',()=>{
 const seven=scoreWin(play(),hand('m1m1m2m2p3p3p4p4s5s5s6s6z7','z7'));assert.equal(seven.fu,25);assert.equal(seven.han,2);assert.equal(seven.base,1600);
 const red=pinfu();red.method='tsumo';red.hand[4]='m0';const r=scoreWin(play(),red);assert.equal(r.han,3);assert.equal(r.base,2700);assert.ok(r.yaku.some(y=>y.name==='赤ドラ'));
});
test('open yakuhai and concealed/open status affect yaku and scoring',()=>{
 const input=hand('m1m2m3p4p5p6s7s8z2z2','s9',{dora:['m8'],melds:[{type:'pon',from:3,tiles:['z5','z5','z5']}]});
 const r=scoreWin(play(),input);assert.equal(r.han,1);assert.equal(r.fu,30);assert.equal(r.base,1000);
 assert.throws(()=>scoreWin(play(),{...input,lizhi:1,ura:['s1']}),/副露/);
 const noYaku=hand('m4m5m6p2p2s2s3s4s6s7','s8',{dora:['s7'],melds:[{type:'chi',from:0,tiles:['m1','m2','m3']}]});assert.throws(()=>scoreWin(play(),noYaku),/役/);
});
test('kokushi thirteen-sided wait respects double yakuman configuration',()=>{
 const input=hand('m1m9p1p9s1s9z1z2z3z4z5z6z7','m1',{dora:['m3']});
 const g=play();assert.equal(scoreWin(g,input).base,64000);g.config.doubleYakuman=false;assert.equal(scoreWin(g,input).base,32000);
});
test('an unregistered riichi stick is included once in the confirmation and final settlement',()=>{
 const g=play(),input={...pinfu(),lizhi:1,ura:['z2']};const p=previewWins(g,[input]);assert.equal(p.sticks,1);assert.deepEqual(p.declared,[1]);assert.equal(p.wins[0].han,2);assert.equal(p.delta[1],2000);
 const settled=step(g,'win',{wins:[input]});assert.equal(settled.players[1].points,27000);assert.equal(settled.kyotaku,0);assert.equal(validateGame(settled),true);
});
test('incomplete or impossible tile inputs and invalid special situations cannot settle',()=>{
 assert.throws(()=>scoreWin(play(),{...pinfu(),hand:[]}),/13枚/);
 assert.throws(()=>scoreWin(play(),{...pinfu(),dora:[]}),/ドラ表示牌/);
 assert.throws(()=>scoreWin(play(),{...pinfu(),lizhi:1}),/裏ドラ/);
 assert.throws(()=>scoreWin(play(),{...pinfu(),special:'rinshan',method:'tsumo'}),/カン/);
 assert.throws(()=>scoreWin(play(),{...pinfu(),ippatsu:true}),/一発/);
 const bad=pinfu();bad.hand=['m1','m1','m1','m1','m1',...bad.hand.slice(5)];assert.throws(()=>scoreWin(play(),bad),/5枚/);
});
test('manual adjustments cannot create chips, and ending awards any remaining deposits',()=>{
 let g=step(play(),'riichi',{id:0});assert.throws(()=>step(g,'adjust',{points:[25000,25000,25000,25000],kyotaku:1}),/合計/);
 g=step(g,'draw',{abort:true,tenpai:[]});g=step(g,'end');assert.equal(g.kyotaku,0);assert.equal(g.players.reduce((a,p)=>a+p.points,0),100000);assert.equal(standings(g)[0].points,26000);
});
test('mixed hand settlements, draws, JSON reloads, and dealer rotation always conserve points',()=>{
 let g=play();for(let i=0;i<50;i++){if(g.players[i%4].points>=1000&&i%3===0)g=step(g,'riichi',{id:i%4});
 if(i%4===0)g=step(g,'draw',{abort:true,tenpai:[]});else g=step(g,'win',{wins:[{winner:i%4,from:(i+1)%4,method:'ron',mode:'points',ron:[1000,2000,3900,8000][i%4]}]});
 assert.equal(validateGame(JSON.parse(JSON.stringify(g))),true);g=step(g,'next');g=step(g,'start');}
 assert.equal(g.players.reduce((a,p)=>a+p.points,0)+g.kyotaku*1000,100000);
});
