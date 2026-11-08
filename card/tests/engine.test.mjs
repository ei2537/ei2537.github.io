import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,actionOptions,pots,potTotal,validateGame} from '../engine.mjs';

function table(stacks=[1000,1000,1000], config={}) {
  let game=createGame(stacks.map((_,i)=>`P${i}`),config);
  game.players.forEach((p,i)=>{p.stack=stacks[i];p.baseline=stacks[i];p.handStart=stacks[i];});
  game.totalSupply=stacks.reduce((a,b)=>a+b,0);
  return transition(transition(game,{type:'start'}),{type:'advance'});
}
const step=(g,type,extra={})=>transition(g,{type,...extra});
function checkDown(game) {
  for(let guard=0;guard<100;guard++) {
    if(game.phase==='showdown'||game.phase==='complete')return game;
    game=step(game,game.phase==='betting'?'call':'advance');
  }
  throw new Error('Hand did not finish');
}

test('draw antes are separate from round bets and transitions are immutable',()=>{
  const original=createGame(['A','B','C']);
  const game=step(original,'start');
  assert.equal(original.hand,0);assert.equal(game.phase,'deal');assert.equal(potTotal(game),30);
  assert.deepEqual(game.players.map(p=>p.bet),[0,0,0]);
  assert.equal(step(game,'advance').actor,1);
});
test('raises use the round total, charge only the difference, and require a full raise',()=>{
  let game=table();
  game=step(game,'raise',{target:20}); // P1:20
  assert.throws(()=>step(game,'raise',{target:30}),/40/);
  game=step(game,'call'); // P2:20
  game=step(game,'raise',{target:60}); // P0:60
  assert.equal(game.actor,1);assert.equal(actionOptions(game).call,40);
  game=step(game,'call');assert.equal(game.players[1].stack,930);
  game=step(game,'call');assert.equal(game.phase,'between');assert.equal(potTotal(game),210);
});
test('check through draw, choose tied winners, and allocate the odd chip clockwise',()=>{
  let game=checkDown(table([100,100,100],{ante:1,minBet:1}));
  assert.equal(game.phase,'showdown');assert.equal(potTotal(game),3);
  game=step(game,'settle',{selections:[[0,1]]});
  assert.deepEqual(game.players.map(p=>p.stack),[100,101,99]);
  assert.equal(game.phase,'complete');assert.equal(potTotal(game),0);
});
test('everyone folding pays the survivor immediately without losing chips',()=>{
  let game=table();game=step(game,'raise',{target:50});game=step(game,'fold');game=step(game,'fold');
  assert.equal(game.phase,'complete');assert.equal(game.players[1].stack,1020);
  assert.equal(game.players.reduce((a,p)=>a+p.stack,0),3000);
});
test('unequal all-ins create side pots and return the unmatched part',()=>{
  let game=table([50,100,200]);
  game=step(game,'allin');game=step(game,'allin');game=step(game,'allin');
  assert.equal(game.phase,'between');assert.deepEqual(game.players.map(p=>p.committed),[50,100,100]);
  assert.equal(game.players[2].stack,100);game=step(game,'advance');assert.equal(game.phase,'showdown');
  assert.deepEqual(pots(game),[{amount:150,eligible:[0,1,2]},{amount:100,eligible:[1,2]}]);
  assert.throws(()=>step(game,'settle',{selections:[[0],[0]]}),/勝った人/);
  game=step(game,'settle',{selections:[[0],[1]]});assert.deepEqual(game.players.map(p=>p.stack),[150,100,100]);
});
test('short all-in does not reopen a previous raiser',()=>{
  let game=table([1000,1000,160,1000]);
  game=step(game,'raise',{target:100});game=step(game,'allin');game=step(game,'fold');game=step(game,'call');
  assert.equal(game.actor,1);assert.equal(actionOptions(game).call,50);assert.equal(actionOptions(game).canRaise,false);
  assert.throws(()=>step(game,'allin'),/上乗せ/);
  game=step(game,'call');assert.equal(game.phase,'between');
});
test('cumulative short all-ins reopen action when a full raise is faced',()=>{
  let game=table([1000,1000,160,210]);
  game=step(game,'raise',{target:100});game=step(game,'allin');game=step(game,'allin');game=step(game,'call');
  assert.equal(game.actor,1);assert.equal(actionOptions(game).canRaise,true);assert.equal(actionOptions(game).min,300);
});
test('the big blind gets an option after everyone calls',()=>{
  let game=table([1000,1000,1000],{mode:'holdem'});
  assert.equal(game.actor,0);assert.equal(game.sb,1);assert.equal(game.bb,2);
  game=step(game,'call');game=step(game,'call');assert.equal(game.actor,2);assert.equal(actionOptions(game).due,0);
  game=step(game,'call');assert.equal(game.phase,'between');game=step(game,'advance');assert.equal(game.actor,1);
});
test('heads-up dealer posts small blind and acts first before the flop, last after',()=>{
  let game=table([1000,1000],{mode:'holdem'});
  assert.equal(game.sb,0);assert.equal(game.bb,1);assert.equal(game.actor,0);
  game=step(game,'call');game=step(game,'call');game=step(game,'advance');assert.equal(game.actor,1);
});
test('short big blind does not force a lone opponent to put in unmatched chips',()=>{
  let game=table([1000,5],{mode:'holdem'});
  assert.equal(game.phase,'between');assert.deepEqual(game.players.map(p=>p.committed),[5,5]);
  game=checkDown(game);game=step(game,'settle',{selections:[[1]]});assert.deepEqual(game.players.map(p=>p.stack),[995,10]);
});
test('nominal big blind still sets the bring-in when multiple players can act',()=>{
  let game=table([1000,1000,5],{mode:'holdem'});
  assert.equal(actionOptions(game).call,20);game=step(game,'call');assert.equal(actionOptions(game).call,10);
});
test('folded money remains in pots but folded players cannot win',()=>{
  let game=table();game=step(game,'raise',{target:10});game=step(game,'call');game=step(game,'call');
  game=step(game,'advance');game=step(game,'fold');game=step(game,'call');game=step(game,'call');
  assert.deepEqual(pots(game),[{amount:60,eligible:[0,2]}]);
  assert.throws(()=>step(game,'settle',{selections:[[1]]}),/勝った人/);
  assert.throws(()=>step(game,'settle',{selections:[[]]}),/勝った人/);
});
test('zero-stack seats are skipped, dealer rotates, and rebuys work between hands',()=>{
  let game=table([100,10,100]);game=step(game,'raise',{target:10}); // P2 acts: P1 all-in on ante
  game=step(game,'call');game=checkDown(game);
  game=step(game,'settle',{selections:[[0],[0]]});
  assert.equal(game.players[1].stack,0);
  game=step(game,'rebuy',{id:1,amount:500});assert.equal(game.totalSupply,710);assert.equal(game.players[1].stack,500);
  game=step(game,'start');assert.equal(game.dealer,1);
  assert.throws(()=>step(game,'rebuy',{id:1,amount:100}),/合間/);
});
test('reject invalid setup, duplicate names, invalid action values, and damaged totals',()=>{
  assert.throws(()=>createGame(['A','A']),/名前/);
  assert.throws(()=>createGame(['A','B'],{starting:1.5}),/最初/);
  assert.throws(()=>createGame(['A','B'],{mode:'holdem',sb:20,bb:10}),/小ブラインド/);
  assert.throws(()=>step(table(),'raise',{target:NaN}),/枚数/);
  const damaged=table();damaged.players[0].stack++;assert.throws(()=>validateGame(damaged),/合計/);
});
test('seeded random games conserve chips, terminate, and round-trip through JSON',()=>{
  let seed=2537;
  const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  for(let run=0;run<300;run++) {
    const count=2+Math.floor(random()*5),stacks=Array.from({length:count},()=>1+Math.floor(random()*1000));
    let game=table(stacks,{mode:run%2?'draw':'holdem'});
    let steps=0;
    while(game.phase!=='complete' && steps++<200) {
      if(game.phase==='betting') {
        const o=actionOptions(game),r=random();
        if(r<.14) game=step(game,'fold');
        else if(r<.32&&o.canRaise) game=step(game,'raise',{target:Math.min(o.max,o.min+Math.floor(random()*50))});
        else if(r<.42&&o.allInAllowed) game=step(game,'allin');
        else game=step(game,'call');
      } else if(game.phase==='showdown') {
        game=step(game,'settle',{selections:pots(game).map(p=>[p.eligible[Math.floor(random()*p.eligible.length)]])});
      } else game=step(game,'advance');
      assert.equal(validateGame(JSON.parse(JSON.stringify(game))),true);
    }
    assert.equal(game.phase,'complete');assert.equal(game.players.reduce((a,p)=>a+p.stack,0),stacks.reduce((a,b)=>a+b,0));
  }
});
