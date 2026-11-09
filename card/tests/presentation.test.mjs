import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,transition,validateGame,potTotal} from '../engine.mjs';
import {migrateToHoldem,actionPreview,chipColumns,standings} from '../presentation.mjs';

const step=(game,type,extra={})=>transition(game,{type,...extra});
function table(stacks=[1000,1000,1000]) {
  let game=createGame(stacks.map((_,i)=>`P${i}`),{mode:'holdem'});
  game.players.forEach((p,i)=>{p.stack=stacks[i];p.baseline=stacks[i];p.handStart=stacks[i];});
  game.totalSupply=stacks.reduce((a,b)=>a+b,0);
  return step(step(game,'start'),'advance');
}

test('raising preview shows exact cost and opponents cannot check against it',()=>{
  const game=table(),original=JSON.stringify(game),preview=actionPreview(game,'raise',40);
  assert.equal(preview.paid,40);assert.equal(preview.stackAfter,960);assert.equal(preview.potAfter,70);
  assert.deepEqual(preview.opponents.map(p=>p.due),[30,20]);
  assert.ok(preview.opponents.every(p=>!p.actions.includes('チェック')&&p.actions.includes('レイズ')));
  assert.equal(JSON.stringify(game),original,'opening an info must not perform the action');
});
test('call preview distinguishes a small blind needing chips from the big blind option',()=>{
  const preview=actionPreview(table(),'call');
  assert.equal(preview.stackAfter,980);assert.equal(preview.potAfter,50);
  assert.deepEqual(preview.opponents[0].actions,['コール','レイズ','フォールド']);
  assert.deepEqual(preview.opponents[1].actions,['チェック','レイズ','フォールド']);
});
test('checking the big blind correctly says the round ends instead of promising another action',()=>{
  const game=step(step(table(),'call'),'call'),preview=actionPreview(game,'check');
  assert.equal(preview.stackBefore,980);assert.equal(preview.stackAfter,980);
  assert.equal(preview.potAfter,60);assert.equal(preview.nextPhase,'between');assert.deepEqual(preview.opponents,[]);
});
test('a previous raiser who is already matched is waiting, rather than offered a second action',()=>{
  const game=step(table([1000,1000,1000,1000]),'raise',{target:40});
  const preview=actionPreview(game,'call'),raiser=preview.opponents.find(p=>p.name==='P3');
  assert.equal(raiser.responded,true);assert.equal(raiser.due,0);assert.deepEqual(raiser.actions,[]);
  assert.equal(preview.opponents.filter(p=>!p.responded).length,2);
});
test('short all-in preview removes the re-raise option for opponents who already acted',()=>{
  let game=table([1000,1000,160,1000]);
  game=step(game,'raise',{target:100});game=step(game,'call');game=step(game,'call');
  const preview=actionPreview(game,'allin');
  assert.equal(preview.stackAfter,0);assert.equal(preview.roundTotal,160);
  assert.ok(preview.opponents.every(p=>p.due===60&&!p.actions.includes('チェック')&&!p.actions.includes('レイズ')));
});
test('heads-up fold preview explains the opponent winning without charging more chips',()=>{
  const preview=actionPreview(table([1000,1000]),'fold');
  assert.equal(preview.paid,0);assert.equal(preview.stackAfter,990);
  assert.equal(preview.wonByFold,true);assert.equal(preview.winner,'P1');assert.equal(preview.potAfter,30);
});
test('legacy draw migration refunds committed chips and preserves the total supply',()=>{
  let old=createGame(['A','B','C'],{mode:'draw'});
  old=step(step(old,'start'),'advance');old=step(old,'raise',{target:100});
  const serialized=JSON.stringify(old),upgraded=migrateToHoldem(old);
  assert.equal(upgraded.phase,'ready');assert.equal(upgraded.config.mode,'holdem');assert.equal(potTotal(upgraded),0);
  assert.deepEqual(upgraded.players.map(p=>p.stack),[1000,1000,1000]);
  assert.equal(upgraded.totalSupply,old.totalSupply);assert.equal(validateGame(upgraded),true);assert.equal(JSON.stringify(old),serialized);
});
test('existing hold’em saves are preserved exactly',()=>{
  const game=table();assert.equal(migrateToHoldem(game),game);
});
test('chip denominations retain the exact pot amount while keeping visual stacks bounded',()=>{
  for(const amount of [0,1,30,70,155,1000,10123,99999999]) {
    const columns=chipColumns(amount);
    assert.equal(columns.reduce((sum,c)=>sum+c.value*c.count,0),amount);
    assert.ok(columns.length<=4&&columns.every(c=>c.visible<=6&&c.visible>0));
  }
});
test('standings sort chips descending, preserve seats, and share ranks on a tie',()=>{
  const game=createGame(['A','B','C','D'],{mode:'holdem'});
  game.players.forEach((p,i)=>{p.stack=[900,1500,1500,100][i];});
  const before=JSON.stringify(game),rows=standings(game);
  assert.deepEqual(rows.map(r=>[r.id,r.rank,r.total]),[[1,1,1500],[2,1,1500],[0,3,900],[3,4,100]]);
  assert.equal(JSON.stringify(game),before);
});
test('posting blinds and betting do not lower provisional standings before settlement',()=>{
  const game=step(table([1000,1000,1000,1000]),'raise',{target:100});
  assert.ok(standings(game).every(row=>row.rank===1&&row.total===1000&&row.change===0));
  assert.equal(standings(game).find(row=>row.id===3).stack,900);
});
test('paying a pot updates ranks and net chip changes',()=>{
  let game=step(table([1000,1000,1000,1000]),'raise',{target:100});
  game=step(step(step(game,'fold'),'fold'),'fold');
  assert.equal(game.phase,'complete');
  assert.deepEqual(standings(game).map(r=>[r.id,r.rank,r.change]),[[3,1,30],[0,2,0],[1,3,-10],[2,4,-20]]);
  game=step(game,'rebuy',{id:2,amount:1000});
  const leader=standings(game)[0];
  assert.equal(leader.id,2);assert.equal(leader.total,1980);assert.equal(leader.change,-20);
});
