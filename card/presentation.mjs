import { createGame, transition, actionOptions, potTotal, validateGame } from './engine.mjs';

// Upgrade a saved draw hand without losing anyone's unspent or committed chips.
export function migrateToHoldem(original) {
  validateGame(original);
  if (original.config.mode === 'holdem') return original;
  const game = createGame(original.players.map(p => p.name), {
    mode: 'holdem', starting: Math.max(20, original.config.starting), sb: 10, bb: 20
  });
  game.players.forEach((player, i) => {
    player.stack = original.players[i].stack + original.players[i].committed;
    player.handStart = player.stack;
    player.baseline = original.players[i].baseline;
  });
  game.totalSupply = original.totalSupply;
  validateGame(game);
  return game;
}

// Preview only: no state is committed, persisted, or mutated by an info button.
export function actionPreview(game, kind, target) {
  const player = game.players[game.actor], options = actionOptions(game);
  if (!options) throw new Error('ベッティング中に確認してください。');
  const action = kind === 'check' ? {type:'check'} : kind === 'raise' ? {type:'raise',target:Number(target)} : {type:kind};
  const after = transition(game, action);
  const paid = kind === 'fold' || kind === 'check' ? 0 : kind === 'call' ? options.call : kind === 'allin' ? player.stack : Number(target) - player.bet;
  const opponents = after.phase === 'betting' ? after.players.filter(p => p.id !== player.id && p.inHand && !p.folded).map(p => {
    if (p.stack === 0) return {name:p.name, allin:true, due:0, actions:[]};
    if (p.actedAt !== null && p.bet >= after.currentBet) return {name:p.name,allin:false,responded:true,due:0,actions:[]};
    const choices = actionOptions({...after,actor:p.id});
    return {name:p.name,allin:false,due:choices.call,fullDue:choices.due,actions:[choices.due === 0 ? 'チェック' : p.stack <= choices.due ? 'オールインでコール' : 'コール',...(choices.canRaise ? [after.currentBet === 0 ? 'ベット' : 'レイズ'] : []),'フォールド']};
  }) : [];
  return {
    paid, stackBefore:player.stack, stackAfter:after.players[player.id].stack,
    potBefore:potTotal(game), potAfter:after.phase === 'complete' ? after.result.total : potTotal(after),
    roundTotal:player.bet + paid,
    folded:kind === 'fold', committed:player.committed,
    allin:kind !== 'fold' && after.players[player.id].stack === 0,
    wonByFold:after.phase === 'complete',
    winner:after.phase === 'complete' ? after.players[after.result.awards[0].id].name : null,
    nextPhase:after.phase, opponents
  };
}

export function chipColumns(amount) {
  const values = amount >= 10000 ? [1000,100,10,1] : [100,25,5,1];
  let rest = amount;
  return values.map(value => {
    const count = Math.floor(rest / value); rest %= value;
    return {value,count,visible:Math.min(6,count)};
  }).filter(column => column.count > 0);
}
