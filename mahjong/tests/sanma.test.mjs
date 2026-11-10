import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,previewWins,wallGuide,validateGame,roundName,windOf} from '../engine.mjs';
import {scoreWin} from '../scoring.mjs';
import {wallSettings} from '../rules.mjs';
const step=(g,type,extra={})=>transition(g,{type,...extra});
const play=(config={})=>step(step(createGame(['A','B','C'],config),'parent-manual',{id:0}),'start');
const tiles=text=>text.match(/[mpsz][0-9]/g)||[];
const pinfu=(extra={})=>({winner:1,from:2,method:'ron',mode:'tiles',hand:tiles('p1p2p3p4p5p6s2s2s3s4s5s6s7'),win:'s8',melds:[],dora:['z5'],ura:[],lizhi:0,nuki:0,special:'none',...extra});

test('sanma uses three seats, 35,000 points, three hands per wind, and three 18-stack walls',()=>{
 let g=play();assert.equal(g.supply,105000);assert.equal(g.players.length,3);assert.deepEqual(wallSettings(g),{stacks:18,dead:9,rinshan:4});
 for(let dealer=0;dealer<3;dealer++)for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)assert.equal(wallGuide(dealer,[a,b],3).owner,(dealer+a+b-1)%3);
 g=step(g,'win',{wins:[{winner:1,from:2,method:'ron',mode:'points',ron:1000}]});g=step(g,'next');assert.equal(roundName(g),'東2局');
 g=step(g,'start');g=step(g,'win',{wins:[{winner:2,from:0,method:'ron',mode:'points',ron:1000}]});g=step(g,'next');assert.equal(roundName(g),'東3局');
 g=step(g,'start');g=step(g,'win',{wins:[{winner:0,from:1,method:'ron',mode:'points',ron:1000}]});g=step(g,'next');assert.equal(roundName(g),'南1局');assert.equal(g.dealer,0);assert.deepEqual(g.riichi,[false,false,false]);
 g.config.nuki=false;assert.equal(wallSettings(g).dead,7);
});
test('two dealer-selection rolls count only actual sanma players',()=>{
 let g=createGame(['A','B','C']);g=step(g,'parent-roll',{dice:[1,1]});assert.equal(g.parentRolls[0].target,1);
 g=step(g,'parent-roll',{dice:[3,4]});assert.equal(g.dealer,1);assert.equal(g.phase,'wall');
});
test('all sanma noten divisions preserve points and use a 2,000-point pool',()=>{
 for(let n=0;n<=3;n++){const g=step(play(),'draw',{tenpai:[0,1,2].slice(0,n)});const expected=[[0,0,0],[2000,-1000,-1000],[1000,1000,-2000],[0,0,0]][n];assert.deepEqual(g.result.delta,expected);assert.equal(validateGame(g),true);}
});
test('ron and tsumo payments map correctly after every dealer rotation',()=>{
 for(let dealer=0;dealer<3;dealer++)for(let winner=0;winner<3;winner++){
  const g=play();g.dealer=dealer;const from=(winner+1)%3;
  const ron=scoreWin(g,pinfu({winner,from}));assert.equal(ron.base,winner===dealer?1500:1000);assert.equal(ron.delta[from],-ron.base);assert.equal(ron.delta[winner],ron.base);assert.equal(ron.delta.reduce((a,b)=>a+b,0),0);
  const tsumo=scoreWin(g,pinfu({winner,from,method:'tsumo'}));assert.equal(tsumo.base,winner===dealer?1400:1100);assert.equal(tsumo.delta.reduce((a,b)=>a+b,0),0);assert.equal(windOf(g,winner),((winner-dealer+3)%3));
 }
});
test('nuki adds bonus han, and tsumo loss versus split changes actual payer amounts',()=>{
 const g=play(),input=pinfu({method:'tsumo',nuki:1});const loss=scoreWin(g,input);assert.equal(loss.han,3);assert.equal(loss.fu,20);assert.equal(loss.base,2000);assert.deepEqual(loss.delta,[-1300,2000,-700]);assert.ok(loss.yaku.some(y=>y.name==='抜きドラ'&&y.han===1));
 g.config.tsumo='split';const split=scoreWin(g,input);assert.deepEqual(split.delta,[-1700,2800,-1100]);
 input.winner=0;const dealer=scoreWin(g,input);assert.deepEqual(dealer.delta,[4000,-2000,-2000]);
});
test('West indicators also count extracted North tiles as ordinary dora',()=>{
 const r=scoreWin(play(),pinfu({method:'tsumo',nuki:1,dora:['z3']}));assert.equal(r.han,4);assert.equal(r.base,3900);assert.ok(r.yaku.some(y=>y.name==='抜きドラ'&&y.han===2));
 const ura=scoreWin(play(),pinfu({nuki:1,lizhi:1,ura:['z3']}));assert.equal(ura.han,4);
});
test('1m and 9m indicators wrap to each other in sanma',()=>{
 for(const [pair,indicator] of [['m9','m1'],['m1','m9']]){
 const r=scoreWin(play(),pinfu({hand:tiles(`${pair}${pair}p1p2p3p4p5p6s2s3s4s6s7`),dora:[indicator]}));assert.equal(r.han,3);assert.equal(r.base,3900);
 }
});
test('nuki cannot supply a yaku, duplicate North tiles, or forbidden manzu and chii',()=>{
 const noYaku=pinfu({hand:tiles('p4p5p6s2s3s4s6s7z2z2'),melds:[{type:'pon',from:0,tiles:['p1','p1','p1']}],nuki:3});assert.throws(()=>scoreWin(play(),noYaku),/役/);
 const impossible=pinfu({hand:tiles('p1p2p3p4p5p6z4z4s3s4s5s6s7'),nuki:3});assert.throws(()=>scoreWin(play(),impossible),/5枚/);
 assert.throws(()=>scoreWin(play(),pinfu({hand:tiles('m1m2m3p4p5p6s2s2s3s4s5s6s7')})),/萬子/);
 assert.throws(()=>scoreWin(play(),{...noYaku,melds:[{type:'chi',from:0,tiles:['p1','p2','p3']}]}),/チー/);
 const g=play({nuki:false});assert.throws(()=>scoreWin(g,pinfu({nuki:1})),/北抜き/);
 assert.throws(()=>scoreWin(play(),pinfu({winner:3})),/和了した人/);
});
test('sanma honba is added to actual payers under both presets',()=>{
 const g=play();g.honba=2;assert.deepEqual(scoreWin(g,pinfu({method:'tsumo'})).delta,[-900,1500,-600]);assert.deepEqual(scoreWin(g,pinfu()).delta,[0,1600,-1600]);
 g.config.honbaValue=1000;assert.deepEqual(scoreWin(g,pinfu({method:'tsumo'})).delta,[-1700,3100,-1400]);assert.deepEqual(scoreWin(g,pinfu()).delta,[0,3000,-3000]);
 const direct=previewWins(g,[{winner:1,method:'tsumo',mode:'points',parent:700,child:400}]);assert.deepEqual(direct.delta,[-1700,3100,-1400]);
});
test('double ron has two winners and the closest winner receives deposits',()=>{
 let g=step(play(),'riichi',{id:0});const wins=[{winner:2,from:0,method:'ron',mode:'points',ron:8000},{winner:1,from:0,method:'ron',mode:'points',ron:1000}];
 const p=previewWins(g,wins);assert.equal(p.receiver,1);assert.deepEqual(p.delta,[-9000,2000,8000]);g=step(g,'win',{wins});assert.equal(validateGame(g),true);
 assert.throws(()=>previewWins(play(),[wins[0],wins[1],wins[0]]),/1〜2人/);
});
test('sanma yakuman and pao do not charge a missing player or misassign liability',()=>{
 const kokushi=pinfu({hand:tiles('m1m9p1p9s1s9z1z2z3z4z5z6z7'),win:'m1',dora:['p3']});assert.equal(scoreWin(play(),kokushi).base,64000);
 for(let dealer=0;dealer<3;dealer++){
 const g=play();g.dealer=dealer;g.honba=1;const winner=(dealer+1)%3,liable=(dealer+2)%3;
 const pao=pinfu({winner,method:'tsumo',hand:tiles('p2p2s2s3'),win:'s4',dora:['m1'],melds:[{type:'pon',from:dealer,tiles:['z5','z5','z5']},{type:'pon',from:dealer,tiles:['z6','z6','z6']},{type:'pon',from:liable,tiles:['z7','z7','z7']}]});
 const r=scoreWin(g,pao);assert.equal(r.base,32000);assert.equal(r.delta[liable],-32300);assert.equal(r.delta[winner],32300);assert.equal(r.delta[dealer],0);
 }
});
test('standalone transfers, deposits and riichi reset conserve the saved supply',()=>{
 let g=step(play(),'transfer',{from:0,to:1,amount:8000});g=step(g,'riichi',{id:1});assert.equal(g.kyotaku,1);g=step(g,'reset-riichi');assert.equal(g.kyotaku,1);assert.deepEqual(g.riichi,[false,false,false]);g=step(g,'award',{to:2});assert.deepEqual(g.players.map(p=>p.points),[27000,42000,36000]);assert.equal(validateGame(JSON.parse(JSON.stringify(g))),true);
 assert.throws(()=>step(g,'transfer',{from:0,to:0,amount:1000}),/相手/);assert.throws(()=>step(g,'transfer',{from:0,to:1,amount:123}),/100点/);
});
