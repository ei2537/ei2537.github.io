// Pure chip accounting and betting rules. No cards, network, or browser state.
export const VERSION = 1;
const copy = value => structuredClone(value);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
export const rounds = mode => mode === 'draw' ? ['交換前', '交換後'] : ['プリフロップ', 'フロップ', 'ターン', 'リバー'];
export const potTotal = game => game.players.reduce((sum, player) => sum + player.committed, 0);
const live = game => game.players.filter(player => player.inHand && !player.folded);
const available = game => live(game).filter(player => player.stack > 0);
const unit = game => game.config.mode === 'draw' ? game.config.minBet : game.config.bb;
const note = (game, message) => { game.log.push(message); };
const clockwise = (game, after, predicate) => {
  for (let step = 1; step <= game.players.length; step++) {
    const index = (after + step) % game.players.length;
    if (predicate(game.players[index])) return index;
  }
  return null;
};

export function createGame(names, config) {
  const settings = { mode: 'draw', starting: 1000, ante: 10, minBet: 10, sb: 10, bb: 20, ...config };
  assert(['draw', 'holdem'].includes(settings.mode), 'ゲームの種類を選んでください。');
  assert(names.length >= 2 && names.length <= (settings.mode === 'draw' ? 6 : 10), '人数を確認してください。');
  assert(integer(settings.starting, 1, 1000000), '最初のチップは1〜1,000,000枚にしてください。');
  for (const key of ['ante', 'minBet', 'sb', 'bb']) assert(integer(settings[key], 1, 1000000), '参加料・ベットは1〜1,000,000枚の整数にしてください。');
  assert((settings.mode === 'draw' ? settings.ante : settings.bb) <= settings.starting, '最初のチップは参加料・大ブラインド以上にしてください。');
  if (settings.mode === 'holdem') assert(settings.sb < settings.bb, '小ブラインドは大ブラインドより小さくしてください。');
  const cleanNames = names.map((name, i) => String(name).trim().slice(0, 20) || `プレイヤー${i + 1}`);
  assert(new Set(cleanNames).size === cleanNames.length, '名前が重ならないようにしてください。');
  return {
    version: VERSION, config: settings, phase: 'ready', hand: 0, dealer: 0,
    round: 0, actor: null, currentBet: 0, minRaise: unit({config:settings}), sb: null, bb: null,
    totalSupply: names.length * settings.starting, log: [], result: null,
    players: cleanNames.map((name, id) => ({ id, name, stack: settings.starting, baseline: settings.starting, handStart: settings.starting, inHand: false, folded: false, bet: 0, committed: 0, actedAt: null, lastAction: '' }))
  };
}

function pay(game, player, amount, label, isBet = true) {
  const paid = Math.min(amount, player.stack);
  player.stack -= paid;
  player.committed += paid;
  if (isBet) player.bet += paid;
  player.lastAction = `${label} ${paid.toLocaleString('ja-JP')}`;
  note(game, `${player.name}：${label} ${paid.toLocaleString('ja-JP')}枚${player.stack === 0 ? '（オールイン）' : ''}`);
}

function startHand(game) {
  assert(['ready', 'complete'].includes(game.phase), '今の勝負を終えてから進んでください。');
  assert(game.players.filter(p => p.stack > 0).length >= 2, 'チップのある人が2人以上必要です。');
  if (game.hand > 0 || game.players[game.dealer].stack === 0) game.dealer = clockwise(game, game.dealer, p => p.stack > 0);
  game.hand++;
  game.round = 0; game.actor = null; game.phase = 'deal'; game.result = null;
  game.currentBet = 0; game.minRaise = unit(game); game.sb = null; game.bb = null;
  game.log = [];
  for (const player of game.players) {
    player.handStart = player.stack; player.inHand = player.stack > 0;
    player.folded = false; player.bet = 0; player.committed = 0; player.actedAt = null; player.lastAction = '';
  }
  if (game.config.mode === 'draw') {
    for (const player of live(game)) pay(game, player, game.config.ante, '参加料', false);
  } else {
    const count = live(game).length;
    game.sb = count === 2 ? game.dealer : clockwise(game, game.dealer, p => p.inHand);
    game.bb = clockwise(game, game.sb, p => p.inHand);
    pay(game, game.players[game.sb], game.config.sb, '小ブラインド');
    pay(game, game.players[game.bb], game.config.bb, '大ブラインド');
    game.currentBet = game.config.bb;
  }
}

export function actionOptions(game) {
  if (game.phase !== 'betting' || game.actor === null) return null;
  const player = game.players[game.actor];
  const due = Math.max(0, game.currentBet - player.bet);
  const max = player.bet + player.stack;
  // A checked player can respond to an opening bet. Cumulative short raises
  // reopen action once they reach the last full raise faced by that player.
  const reopened = player.actedAt === null || player.actedAt === 0 || game.currentBet - player.actedAt >= game.minRaise;
  const canRaise = reopened && available(game).some(other => other.id !== player.id) && max > game.currentBet;
  return { due, call: Math.min(due, player.stack), max, min: game.currentBet + game.minRaise, canRaise, allInAllowed: max <= game.currentBet || canRaise };
}

function refundUncalled(game) {
  const ranked = game.players.filter(p => p.inHand).slice().sort((a, b) => b.committed - a.committed);
  if (ranked.length < 2 || ranked[0].folded) return;
  const amount = ranked[0].committed - ranked[1].committed;
  if (amount > 0) {
    ranked[0].committed -= amount; ranked[0].bet = Math.max(0, ranked[0].bet - amount); ranked[0].stack += amount;
    note(game, `${ranked[0].name}：相手が出していない分 ${amount.toLocaleString('ja-JP')}枚を返却`);
  }
}

function endRound(game) {
  refundUncalled(game);
  game.actor = null;
  game.phase = game.round === rounds(game.config.mode).length - 1 ? 'showdown' : 'between';
}

function pickActor(game, after) {
  const remaining = live(game);
  if (remaining.length === 1) {
    const amount = potTotal(game);
    finish(game, [{ id: remaining[0].id, amount }], 'ほかの全員が降りたため');
    return;
  }
  const active = available(game);
  if (active.length < 2) {
    const sole = active[0];
    const otherBet = Math.max(0, ...remaining.filter(p => p.id !== sole?.id).map(p => p.bet));
    if (!sole || sole.bet >= otherBet) { endRound(game); return; }
    game.currentBet = Math.min(game.currentBet, otherBet);
  }
  game.actor = clockwise(game, after, p => p.inHand && !p.folded && p.stack > 0 && (p.actedAt === null || p.bet < game.currentBet));
  if (game.actor === null) endRound(game);
}

function advance(game) {
  assert(['deal', 'between'].includes(game.phase), '順番に操作してください。');
  const dealing = game.phase === 'deal';
  if (!dealing) {
    game.round++; game.currentBet = 0; game.minRaise = unit(game);
    for (const player of game.players) { player.bet = 0; player.actedAt = null; player.lastAction = ''; }
  }
  game.phase = 'betting';
  const after = dealing && game.config.mode === 'holdem' ? game.bb : game.dealer;
  pickActor(game, after);
}

function act(game, type, target) {
  assert(game.phase === 'betting' && game.actor !== null, '今はベットできません。');
  const index = game.actor, player = game.players[index], options = actionOptions(game);
  if (type === 'fold') {
    player.folded = true; player.lastAction = '降りた'; note(game, `${player.name}：降りた`);
  } else if (type === 'call' || type === 'check') {
    assert(type !== 'check' || options.due === 0, '同じ枚数を出すか、降りてください。');
    if (options.due === 0) { player.lastAction = 'チェック'; note(game, `${player.name}：チェック`); }
    else pay(game, player, options.call, 'コール');
    player.actedAt = game.currentBet;
  } else if (type === 'raise' || type === 'allin') {
    const total = type === 'allin' ? options.max : Number(target);
    assert(integer(total, player.bet + 1, options.max), '持っている枚数の範囲で入力してください。');
    if (total <= game.currentBet) {
      assert(type === 'allin', '同じ枚数を出す場合はコールを選んでください。');
      pay(game, player, player.stack, 'オールイン');
      player.actedAt = game.currentBet;
    } else {
      assert(options.canRaise, '今回は上乗せできません。');
      assert(total >= options.min || total === options.max, `合計${options.min}枚以上にするか、全額を出してください。`);
      const increase = total - game.currentBet;
      const label = type === 'allin' ? 'オールイン' : game.currentBet === 0 ? 'ベット' : 'レイズ';
      pay(game, player, total - player.bet, label);
      if (increase >= game.minRaise) game.minRaise = increase;
      game.currentBet = total; player.actedAt = total;
    }
  } else throw new Error('操作を確認してください。');
  pickActor(game, index);
}

export function pots(game) {
  const levels = [...new Set(game.players.map(p => p.committed).filter(Boolean))].sort((a, b) => a - b);
  let previous = 0;
  const result = [];
  for (const level of levels) {
    const contributors = game.players.filter(p => p.committed >= level);
    const eligible = contributors.filter(p => !p.folded && p.inHand).map(p => p.id);
    const amount = (level - previous) * contributors.length;
    assert(eligible.length > 0, '配分先を確認できません。ひとつ前に戻してください。');
    const last = result.at(-1);
    if (last && last.eligible.join(',') === eligible.join(',')) last.amount += amount;
    else result.push({ amount, eligible });
    previous = level;
  }
  return result;
}

function finish(game, awards, reason) {
  const total = potTotal(game);
  assert(awards.reduce((sum, award) => sum + award.amount, 0) === total, '配分する枚数が合いません。');
  for (const award of awards) game.players[award.id].stack += award.amount;
  game.result = { total, reason, awards, changes: game.players.filter(p => p.inHand).map(p => ({id:p.id, amount:p.stack - p.handStart})) };
  for (const player of game.players) { player.committed = 0; player.bet = 0; }
  game.actor = null; game.phase = 'complete';
  note(game, `配分完了：${total.toLocaleString('ja-JP')}枚`);
}

function settle(game, selections) {
  assert(game.phase === 'showdown', 'カードを確認する段階で配分してください。');
  const awards = new Map();
  pots(game).forEach((pot, i) => {
    const ids = pot.eligible.length === 1 ? pot.eligible : selections?.[i];
    assert(Array.isArray(ids) && ids.length > 0 && new Set(ids).size === ids.length && ids.every(id => pot.eligible.includes(id)), 'それぞれのポットで勝った人を選んでください。');
    const ordered = Array.from({length:game.players.length}, (_, offset) => (game.dealer + 1 + offset) % game.players.length).filter(id => ids.includes(id));
    const each = Math.floor(pot.amount / ids.length), rest = pot.amount % ids.length;
    ordered.forEach((id, index) => awards.set(id, (awards.get(id) || 0) + each + (index < rest ? 1 : 0)));
  });
  finish(game, [...awards].map(([id, amount]) => ({id, amount})), 'カードを比べた結果');
}

export function validateGame(game) {
  assert(game?.version === VERSION && Array.isArray(game.players) && game.players.length >= 2 && game.players.length <= 10, '保存データの形式を確認できません。');
  assert(['ready','deal','betting','between','showdown','complete'].includes(game.phase), '保存データの進行状況を確認できません。');
  assert(['draw','holdem'].includes(game.config?.mode), '保存データのルールを確認できません。');
  assert(integer(game.dealer, 0, game.players.length - 1) && integer(game.round, 0, rounds(game.config.mode).length - 1), '保存データの手番を確認できません。');
  for (const [i, player] of game.players.entries()) {
    assert(player.id === i && typeof player.name === 'string' && player.name.length <= 20, '保存データの参加者を確認できません。');
    for (const key of ['stack', 'bet', 'committed', 'handStart', 'baseline']) assert(integer(player[key], 0, 1000000000), 'チップの枚数を確認できません。');
    assert(player.bet <= player.committed, 'ベットの枚数が合いません。');
  }
  assert(integer(game.totalSupply, 1, 1000000000) && game.players.reduce((sum,p) => sum + p.stack + p.committed, 0) === game.totalSupply, 'チップの合計が合いません。');
  if (game.phase === 'betting') assert(integer(game.actor,0,game.players.length - 1) && game.players[game.actor].inHand && !game.players[game.actor].folded && game.players[game.actor].stack > 0, '手番を確認できません。');
  return true;
}

export function transition(original, action) {
  validateGame(original);
  const game = copy(original);
  if (action.type === 'start') startHand(game);
  else if (action.type === 'advance') advance(game);
  else if (action.type === 'settle') settle(game, action.selections);
  else if (action.type === 'rebuy') {
    assert(['ready','complete'].includes(game.phase), 'チップの追加は勝負の合間にできます。');
    assert(integer(action.id, 0, game.players.length - 1) && integer(action.amount,1,1000000), '追加する枚数を確認してください。');
    game.players[action.id].stack += action.amount; game.players[action.id].baseline += action.amount; game.totalSupply += action.amount;
    note(game, `${game.players[action.id].name}：${action.amount.toLocaleString('ja-JP')}枚を追加`);
  } else act(game, action.type, action.target);
  validateGame(game);
  return game;
}
