import { VERSION, createGame, transition, actionOptions, potTotal, pots, rounds, validateGame } from './engine.mjs';

const KEY = 'poker-chips:v1';
const DRAFT_KEY = `${KEY}:setup`;
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = value => value.toLocaleString('ja-JP');
const signed = value => `${value > 0 ? '+' : ''}${number(value)}`;
let game = null, history = [], revision = null, storageAvailable = true, corruptSave = false, toastTimer;
let draft = {names:['','','',''],mode:'draw',starting:1000,ante:10,minBet:10,sb:10,bb:20};

function readSave() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const saved = JSON.parse(raw);
  if (saved.version !== VERSION || typeof saved.revision !== 'string' || !Array.isArray(saved.history)) throw new Error('保存形式が異なります。');
  validateGame(saved.game);
  saved.history = saved.history.slice(-60).filter(state => {try {return validateGame(state);} catch {return false;}});
  return saved;
}
try {
  const setup = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  if (setup && Array.isArray(setup.names) && setup.names.length >= 2 && setup.names.length <= 10) draft = {...draft,...setup};
  const saved = readSave();
  if (saved) { game = saved.game; history = saved.history; revision = saved.revision; }
} catch { corruptSave = true; }
try { localStorage.setItem(`${KEY}:test`, '1'); localStorage.removeItem(`${KEY}:test`); } catch { storageAvailable = false; }

function toast(message) {
  const target = document.querySelector('#message');
  clearTimeout(toastTimer); target.textContent = message; target.hidden = false;
  toastTimer = setTimeout(() => {target.hidden = true;}, 4500);
}

function saveDraft() { try {localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));} catch {storageAvailable = false;} }
function persist() {
  revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {localStorage.setItem(KEY, JSON.stringify({version:VERSION, revision, game, history}));}
  catch {storageAvailable = false; toast('このブラウザでは途中保存ができません。ページを閉じずに使ってください。');}
}
function syncBeforeChange() {
  if (!storageAvailable) return true;
  try {
    const saved = readSave();
    if ((saved?.revision || null) !== revision) {
      game = saved?.game || null; history = saved?.history || []; revision = saved?.revision || null;
      modal.close(); render(); toast('別のタブで更新されたので、最新の状態に切り替えました。もう一度操作してください。');
      return false;
    }
  } catch { /* A known damaged save can be replaced by a new game. */ }
  return true;
}
function change(action) {
  if (!syncBeforeChange()) return false;
  try {
    const next = transition(game, action);
    history.push(game); history = history.slice(-60); game = next;
    persist(); render(true); return true;
  } catch (error) {toast(error.message); return false;}
}
function undo() {
  if (!history.length || !syncBeforeChange()) return;
  game = history.pop(); persist(); render(true); toast('ひとつ前に戻しました。');
}
window.addEventListener('storage', event => {
  if (event.key !== KEY) return;
  try {
    const saved = readSave(); game = saved?.game || null; history = saved?.history || []; revision = saved?.revision || null;
    modal.close(); render(); toast('別のタブの変更を反映しました。');
  } catch {toast('別のタブの保存データを読み込めませんでした。');}
});

function storageNotice() {
  return !storageAvailable ? '<p class="storage-error">途中保存を使えないブラウザです。このページを閉じると記録が消えます。</p>' : '';
}
function render(focus = false) {
  app.innerHTML = storageNotice() + (game ? gameView() : setupView());
  if (focus) {
    const target = document.querySelector('#turn-title, #phase-title');
    if (target) {target.focus({preventScroll:true}); target.scrollIntoView({block:'nearest',behavior:'instant'});}
  }
}

function setupView() {
  const max = draft.mode === 'draw' ? 6 : 10;
  return `<div class="intro"><h1>チップを用意しよう。</h1><p>トランプは手元に。全員のチップは、この1台で。</p></div>
  ${corruptSave ? '<p class="storage-error">前回の記録を読み込めませんでした。新しいゲームを始めると保存し直します。</p>' : ''}
  <form id="setup-form"><div class="setup-grid">
    <section class="panel" aria-labelledby="players-title">
      <div class="section-title"><h2 id="players-title">参加する人</h2><p>${draft.names.length}人</p></div>
      <p class="help-text" style="margin:-10px 0 18px">テーブルに座る順番で入れてください。上から時計回りに進みます。</p>
      <div class="player-inputs">${draft.names.map((name,i) => `<div class="player-input"><label class="seat" for="name-${i}">${String(i+1).padStart(2,'0')}</label><input id="name-${i}" data-name="${i}" aria-label="${i+1}人目の名前" value="${escape(name)}" placeholder="プレイヤー${i+1}" maxlength="20" autocomplete="off"><button type="button" class="remove-player" data-remove="${i}" aria-label="${i+1}人目を外す" ${draft.names.length <= 2 ? 'disabled' : ''}>×</button></div>`).join('')}</div>
      <button type="button" class="add-player" data-do="add-player" ${draft.names.length >= max ? 'disabled' : ''}>＋ 人を追加</button><p class="help-text">${draft.mode === 'draw' ? '2〜6人で遊べます。' : '2〜10人で遊べます。'} 名前は空欄のままでもOK。</p>
      <div class="how-start"><h3>始め方は、これだけ。</h3><ol><li>名前とルールを決める</li><li>画面の案内に沿ってカードを配る</li><li>順番に「出す」「降りる」を選ぶ</li></ol></div>
    </section>
    <div class="setup-right"><section class="panel" aria-labelledby="rule-title"><div class="section-title"><h2 id="rule-title">遊ぶルール</h2></div>
      <div class="mode-switch"><button type="button" data-mode="draw" aria-pressed="${draft.mode === 'draw'}">5枚ポーカー<span>手札を1回交換する</span></button><button type="button" data-mode="holdem" aria-pressed="${draft.mode === 'holdem'}">ホールデム<span>共有カードで遊ぶ</span></button></div>
      <label class="field"><span>最初に配るチップ</span><span class="input-unit"><input name="starting" type="number" inputmode="numeric" min="1" max="1000000" step="1" required value="${escape(draft.starting)}"><span>枚 / 人</span></span></label>
      ${draft.mode === 'draw' ? `<div class="fields-two"><label class="field"><span>毎回の参加料</span><span class="input-unit"><input name="ante" type="number" inputmode="numeric" min="1" max="1000000" step="1" required value="${escape(draft.ante)}"><span>枚</span></span></label><label class="field"><span>最小のベット</span><span class="input-unit"><input name="minBet" type="number" inputmode="numeric" min="1" max="1000000" step="1" required value="${escape(draft.minBet)}"><span>枚</span></span></label></div><p class="help-text">参加料は勝負の最初に全員から自動で集めます。迷ったら、このままで。</p>` : `<div class="fields-two"><label class="field"><span>小ブラインド</span><span class="input-unit"><input name="sb" type="number" inputmode="numeric" min="1" max="999999" step="1" required value="${escape(draft.sb)}"><span>枚</span></span></label><label class="field"><span>大ブラインド</span><span class="input-unit"><input name="bb" type="number" inputmode="numeric" min="2" max="1000000" step="1" required value="${escape(draft.bb)}"><span>枚</span></span></label></div><p class="help-text">2人が先に出すチップです。担当は勝負ごとに自動で交代します。</p>`}
      <p id="setup-error" class="error" role="alert" hidden></p>
      <div class="start-area"><button class="primary wide" type="submit">このメンバーで始める</button><p class="save-note">途中の記録は、このブラウザに自動保存されます。</p></div>
    </section></div>
  </div></form><p class="footer-note">チップは点数として使います。登録・ダウンロードは不要です。</p>`;
}

function stageTrack() {
  if (game.phase === 'ready') return '';
  const names = game.config.mode === 'draw' ? ['交換前','交換後','結果'] : ['配札後','3枚公開','4枚目','5枚目','結果'];
  const current = ['showdown','complete'].includes(game.phase) ? names.length - 1 : game.round;
  return `<ol class="stage-track" aria-label="勝負の進み具合">${names.map((name,i)=>`<li class="${i === current ? 'current' : i < current ? 'done' : ''}" ${i===current?'aria-current="step"':''}>${name}</li>`).join('')}</ol>`;
}
function potBar() {
  if (game.phase === 'ready') return '';
  return `<div class="pot-bar"><div><p class="eyebrow">${game.phase === 'complete' ? '配分したチップ' : '場に集まったチップ'}</p><p class="pot-number">${number(game.phase === 'complete' ? game.result.total : potTotal(game))}<span>枚</span></p></div><div class="pot-side">${game.phase === 'betting' ? `この周の基準<br><strong>${number(game.currentBet)}</strong> 枚` : `1人の持ち点<br>最初は ${number(game.config.starting)} 枚`}</div></div>`;
}
function tableView() {
  return `<section class="panel table-panel" aria-labelledby="table-title"><div class="table-heading"><h2 id="table-title">みんなのチップ</h2><span>席順・時計回り</span></div><table class="players-table"><thead><tr><th scope="col">名前</th><th scope="col">持ち点</th><th scope="col">この勝負</th></tr></thead><tbody>${game.players.map((p,i) => {
    let status = p.lastAction;
    if (game.phase === 'ready') status = '準備OK';
    else if (!p.inHand) status = 'お休み';
    else if (game.phase === 'complete') status = `${signed(game.result.changes.find(change=>change.id===p.id)?.amount || 0)}枚`;
    else if (p.folded) status = 'この勝負は降りた';
    else if (p.stack === 0) status = '全額を出して待機中';
    if (game.actor === i) status = 'いまの手番';
    const badge = game.hand > 0 && game.dealer === i ? '<span class="badge">配る人</span>' : '';
    return `<tr class="${game.actor===i?'active':''} ${p.folded||(!p.inHand&&game.phase!=='ready')?'out':''}"><td><div class="player-name">${escape(p.name)}${badge}</div><div class="player-state">${escape(status)}</div></td><td><div class="player-stack">${number(p.stack)}</div></td><td><div class="player-bet">${game.phase === 'complete' ? '—' : number(p.committed)}</div></td></tr>`;
  }).join('')}</tbody></table><p class="table-footer">「この勝負」は、参加料も含めて出した合計です。</p></section>`;
}
function gameView() {
  return `<div class="game-top"><div><h1>${game.hand ? `第${game.hand}ゲーム` : '準備ができました'}</h1><p class="game-meta">${game.config.mode==='draw'?`5枚ポーカー · 参加料 ${number(game.config.ante)}枚`:`ホールデム · ${number(game.config.sb)} / ${number(game.config.bb)}`} · ${game.players.length}人</p></div><div class="game-tools"><button type="button" class="text-button" data-do="undo" ${history.length?'':'disabled'}>1つ戻す</button><button type="button" class="text-button" data-do="menu">メニュー</button></div></div>
  ${stageTrack()}<div class="game-grid"><div><section class="panel" aria-label="ゲームの操作">${potBar()}${phaseView()}</section><p class="inline-tip">${contextTip()}</p></div><div class="game-side">${tableView()}${game.log.length ? `<details class="below-panel"><summary>この勝負の記録</summary><ol class="log">${game.log.map(message=>`<li>${escape(message)}</li>`).join('')}</ol></details>` : ''}</div></div><p class="footer-note">${storageAvailable?'自動保存中 · ページを閉じても、このブラウザで続きから。':'このページを閉じずに使ってください。'}</p>`;
}
function phaseView() {
  if (game.phase === 'ready') return `<h2 id="phase-title" class="phase-heading" tabindex="-1">まずはカードを用意。</h2><p class="instruction">${escape(game.players[game.dealer].name)}さんから、配る役を始めます。席順に時計回りで進めてください。</p><button type="button" class="primary wide next-button" data-do="start">最初の勝負を始める</button>`;
  if (game.phase === 'deal') {
    const message = game.config.mode === 'draw' ? '全員にカードを5枚ずつ、裏向きで配ってください。配り終えたら、自分の手札を確認しましょう。' : '全員にカードを2枚ずつ、裏向きで配ってください。真ん中の共有カードは、まだ出しません。';
    return `<p class="eyebrow">配る人：${escape(game.players[game.dealer].name)}さん</p><h2 id="phase-title" class="phase-heading" tabindex="-1">カードを配ってください。</h2><p class="instruction">${message}</p><p class="deal-note">${game.config.mode==='draw'?`全員の参加料 ${number(game.config.ante)}枚は集計済みです。`:`${escape(game.players[game.sb].name)}さんの小ブラインドと、${escape(game.players[game.bb].name)}さんの大ブラインドは集計済みです。`}</p><button type="button" class="primary wide next-button" data-do="advance">配り終えた · ベットへ</button>`;
  }
  if (game.phase === 'betting') return bettingView();
  if (game.phase === 'between') {
    const draw = game.config.mode === 'draw';
    const heading = draw ? '手札を交換してください。' : game.round===0 ? '真ん中に3枚、表向きに。' : '真ん中に、もう1枚。';
    const text = draw ? '降りていない人は、いらないカードを裏向きで捨て、同じ枚数を受け取ります。交換しなくてもOK。全員の交換が終わったら進みます。' : game.round===0 ? '山札の一番上を1枚よけてから、共有カードを3枚公開してください。全員が同じカードを使います。' : `山札の一番上を1枚よけてから、${game.round===1?'4':'5'}枚目の共有カードを公開してください。`;
    return `<h2 id="phase-title" class="phase-heading" tabindex="-1">${heading}</h2><p class="instruction">${text}</p><button type="button" class="primary wide next-button" data-do="advance">${draw?'交換できた · 次へ':'公開できた · 次へ'}</button>`;
  }
  if (game.phase === 'showdown') return showdownView();
  return resultView();
}
function bettingView() {
  const p = game.players[game.actor], o = actionOptions(game);
  const hint = o.due === 0 ? '追加で出さずに続けるか、チップを出すか選べます。' : p.stack <= o.due ? `同じ枚数には${number(o.due)}枚必要ですが、残り${number(p.stack)}枚を全部出せば勝負に残れます。` : `続けるには、あと${number(o.call)}枚を出します。${o.canRaise ? '強いと思ったら、さらに上乗せもできます。' : '同じ枚数にそろえるか、降りるかを選びます。'}`;
  const label = o.due === 0 ? '出さずに続ける' : p.stack <= o.due ? `残り${number(o.call)}枚を出す` : `${number(o.call)}枚を出す`;
  const min = Math.min(o.min, o.max);
  const quick = [...new Set([min, Math.min(o.max,min + (game.config.mode==='draw'?game.config.minBet:game.config.bb)),Math.min(o.max,min*2)])];
  return `<div class="turn-heading"><h2 id="turn-title" tabindex="-1">${escape(p.name)}さん</h2><span class="turn-label">の番です</span></div><p class="instruction">${hint}</p>
    <div class="action-grid"><button type="button" class="primary action" data-do="call">${label}<small>${o.due===0?'チェック · 追加は0枚':p.stack<=o.due?'オールイン · 勝負には残れる':'コール · 同じ枚数にそろえる'}</small></button><button type="button" class="action fold-action" data-do="fold">今回は降りる<small>フォールド · 出した分は戻らない</small></button></div>
    ${o.canRaise ? `<div class="raise-box"><form id="raise-form"><div class="raise-title"><label for="raise-total">${game.currentBet===0?'チップを出して始める':'さらに上乗せする'}</label><span class="muted">${game.currentBet===0?'ベット':'レイズ'}</span></div><div class="raise-form"><input id="raise-total" type="number" inputmode="numeric" min="${min}" max="${o.max}" step="1" value="${min}" required aria-describedby="raise-hint"><button type="submit">合計を決めて出す</button></div><div class="quick-bets">${quick.map(amount=>`<button type="button" data-amount="${amount}">${number(amount)}枚</button>`).join('')}</div><p id="raise-hint" class="help-text">この周に出す合計です。${p.bet>0?`すでに出した${number(p.bet)}枚を含みます。` : ''}追加は <span id="raise-add">${number(min-p.bet)}</span> 枚。${o.max<o.min?'全額を出す場合だけ、この枚数で参加できます。':`最小${number(o.min)}枚。`}</p></form></div>` : o.due>0 && o.max>game.currentBet ? '<p class="help-text" style="margin-top:16px">今回は上乗せできません。必要な分だけ出すか、降りるかを選びます。</p>' : ''}
    ${o.allInAllowed && p.stack>o.call ? `<button type="button" class="allin-button" data-do="allin">残り${number(p.stack)}枚をすべて出す（オールイン）</button>` : ''}`;
}
function showdownView() {
  const allPots = pots(game);
  return `<h2 id="phase-title" class="phase-heading" tabindex="-1">カードを比べて、勝者を選ぶ。</h2><p class="instruction">降りていない人の手札を公開してください。同じ強さで引き分けなら、複数人を選びます。</p><form id="settle-form">${allPots.map((pot,i)=>`<fieldset class="pot-select"><legend>${allPots.length===1?'場のチップ':i===0?'メインポット':`サイドポット ${i}`} · ${number(pot.amount)}枚</legend>${pot.eligible.length===1?`<p class="automatic-award">${escape(game.players[pot.eligible[0]].name)}さんが受け取ります。</p>`:`<p class="help-text">${allPots.length>1?'この分を受け取れる人だけ表示しています。':'いちばん強い人を選んでください。'}</p><div class="winner-options">${pot.eligible.map(id=>`<label class="winner-option"><input type="checkbox" name="pot-${i}" value="${id}"><span>${escape(game.players[id].name)}</span></label>`).join('')}</div>`}</fieldset>`).join('')}<p id="settle-hint" class="help-text" role="status">勝った人を選ぶと配分できます。</p><button type="submit" id="settle-submit" class="primary wide next-button" ${allPots.every(p=>p.eligible.length===1)?'':'disabled'}>チップを配分する</button></form>`;
}
function resultView() {
  const funded = game.players.filter(p=>p.stack>0);
  const awards = game.result.awards.filter(a=>a.amount>0);
  return `<h2 id="phase-title" class="phase-heading" tabindex="-1">${awards.length===1?`${escape(game.players[awards[0].id].name)}さんの勝ち。`:'チップを分けました。'}</h2><p class="instruction">${game.result.reason==='ほかの全員が降りたため'?'ほかの全員が降りたので、場のチップを受け取りました。':'選んだ勝者に、場のチップを配分しました。'}</p><p class="eyebrow">この勝負の増減</p><ul class="result-list">${game.result.changes.map(change=>`<li><span>${escape(game.players[change.id].name)}</span><strong class="${change.amount>0?'positive':''}">${signed(change.amount)} 枚</strong></li>`).join('')}</ul>
  ${funded.length>=2 ? `<button type="button" class="primary wide next-button" data-do="start">次の勝負へ</button><p class="result-note">配る役が、次の人へ移ります。</p>` : `<p class="session-winner">${escape(funded[0]?.name||'')}さんに、すべてのチップが集まりました。</p><button type="button" class="primary wide next-button" data-do="new-game">新しいゲームを始める</button><div class="secondary-row"><button type="button" class="text-button" data-do="rebuy">チップを追加して続ける</button></div>`}`;
}
function contextTip() {
  if (game.phase==='betting') return '<strong>迷ったら</strong>　強い手なら「出す」、勝てなさそうなら「降りる」。出さずに続けられるときは、チェックで様子を見られます。';
  if (game.phase==='showdown') return '<strong>全額を出した人がいるとき</strong>　受け取れる範囲を自動で分けます。余りの1枚は、配る人の左から時計回りに渡します。';
  if (game.phase==='complete') return '<strong>取り消したいとき</strong>　「1つ戻す」で配分前にも戻れます。チップの追加は、メニューから勝負の合間にできます。';
  return '<strong>この1台で進めます</strong>　手番の人に選んでもらうか、1人が全員の操作を担当してください。カードの強さは、みんなで確認します。';
}

function showModal(title, body, actions = '') {
  if (modal.open) modal.close();
  document.querySelector('#modal-content').innerHTML = `<div class="dialog-head"><h2 id="modal-title">${title}</h2><button type="button" data-do="close" aria-label="閉じる">×</button></div><div class="dialog-body">${body}</div>${actions?`<div class="dialog-actions">${actions}</div>`:''}`;
  modal.showModal();
}
function confirmAction(title, body, label, callback) {
  showModal(title,`<p>${body}</p>`,'<button type="button" data-do="close">やめる</button><button type="button" class="primary" id="confirm-action"></button>');
  const confirm = document.querySelector('#confirm-action'); confirm.textContent = label;
  confirm.addEventListener('click',()=>{modal.close(); callback();},{once:true});
}
function help() {
  showModal('使い方', `<p>手元のトランプで遊び、チップの計算だけをこの画面に任せます。スマホ1台で全員分を管理します。</p>
    <section class="help-section"><h3>5枚ポーカーの進め方</h3><ol><li>全員が参加料を出し、カードを5枚ずつ受け取ります。参加料は自動で集めます。</li><li>時計回りに、チップを出すか降りるかを選びます。</li><li>残った人がいらないカードを交換し、もう一度ベットします。</li><li>手札を比べて勝者を選ぶと、チップを配分します。</li></ol><p>このサイトでは「役の条件なしで始める・交換は1回・ベット額は自由」のルールで遊びます。交換札が足りないときは、捨て札をよく混ぜて使ってください。</p></section>
    <section class="help-section"><h3>ボタンの意味</h3><dl class="glossary"><dt>チェック — 出さずに続ける</dt><dd>この周のチップがそろっているときに選べます。勝負に残ったまま、次の人へ進みます。</dd><dt>コール — 同じ枚数にそろえる</dt><dd>先に出した人と同じ合計になるように、不足分だけを出します。</dd><dt>ベット・レイズ — チップを出す・上乗せする</dt><dd>入力するのは「この周で出す合計」。すでに出した分は自動で差し引きます。最低額は画面で案内します。</dd><dt>フォールド — 今回は降りる</dt><dd>この勝負には参加しません。出したチップは戻りませんが、次の勝負からまた参加できます。</dd><dt>オールイン — 残りをすべて出す</dt><dd>残りが足りなくても勝負には残れます。受け取れるのは自分が参加した分のポットまで。配分は自動で分けます。</dd></dl></section>
    <section class="help-section"><h3>ホールデムの進め方</h3><p>自分だけのカード2枚と、真ん中の共有カード5枚から最も強い5枚を作ります。配札後・共有カード3枚・4枚目・5枚目の計4回ベットします。最初にチップを出す2人（ブラインド）は自動で交代します。2人のときは配る人が小ブラインドです。</p></section>
    <section class="help-section"><h3>役の強さ（上ほど強い）</h3><ol class="hand-ranks"><li>ロイヤルフラッシュ</li><li>ストレートフラッシュ</li><li>フォーカード</li><li>フルハウス</li><li>フラッシュ</li><li>ストレート</li><li>スリーカード</li><li>ツーペア</li><li>ワンペア</li><li>ハイカード（役なし）</li></ol><p style="margin-top:10px">役が同じなら、役を作るカードの数字、残りの強いカードの順で比較します。スートに強弱はありません。Aは通常いちばん強く、A・2・3・4・5のストレートだけは最も弱い並びです。</p></section>
    <section class="help-section"><h3>保存と取り消し</h3><p>操作のたびに、このブラウザだけに保存します。再読み込みしても続きから。「1つ戻す」は直前60回まで戻れます。配分や全額を出す操作も取り消せます。プライベートブラウズやブラウザのデータ削除では記録が消えます。</p><p>チップは点数です。カードは配らず、勝敗も自動判定しません。配る人の左から時計回りを基本に進めます。</p></section>`);
}
function menu() {
  const betweenHands = ['ready','complete'].includes(game.phase);
  showModal('ゲームのメニュー',`<button type="button" class="wide" data-do="rebuy" ${betweenHands?'':'disabled'}>チップを追加する</button><p class="help-text">追加できるのは、勝負を始める前か配分した後です。</p><button type="button" class="wide" data-do="help" style="margin-top:18px">使い方・役の強さ</button><button type="button" class="text-button danger wide" data-do="new-game" style="margin-top:18px">このゲームを終えて、最初から</button>`);
}
function rebuy() {
  if (!['ready','complete'].includes(game.phase)) return;
  showModal('チップを追加する',`<form id="rebuy-form"><label class="field"><span>追加する人</span><select name="player">${game.players.map(p=>`<option value="${p.id}">${escape(p.name)}（${number(p.stack)}枚）</option>`).join('')}</select></label><label class="field"><span>追加する枚数</span><input name="amount" type="number" inputmode="numeric" min="1" max="1000000" step="1" required value="${game.config.starting}"></label><button type="submit" class="primary wide" style="margin-top:24px">この枚数を追加する</button></form>`);
}
function newGame() {
  confirmAction('最初から始めますか？','今のチップと進行状況をリセットします。同じメンバーで設定し直せます。','最初から始める',()=>{
    if (!syncBeforeChange()) return;
    draft = {...game.config,names:game.players.map(p=>p.name)}; saveDraft(); game = null; history = []; revision = null;
    try {localStorage.removeItem(KEY);} catch {storageAvailable = false;}
    render(); window.scrollTo({top:0,behavior:'instant'});
  });
}

document.querySelector('#help-button').addEventListener('click', help);
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || button.disabled) return;
  if (button.dataset.mode) {
    const mode = button.dataset.mode;
    if (mode==='draw' && draft.names.length>6) {toast('5枚ポーカーは6人までです。先に参加者を減らしてください。');return;}
    draft.mode = mode; saveDraft(); render(); return;
  }
  if (button.dataset.remove !== undefined) {draft.names.splice(Number(button.dataset.remove),1);saveDraft();render();return;}
  if (button.dataset.amount !== undefined) {
    const input = document.querySelector('#raise-total'); input.value = button.dataset.amount; input.dispatchEvent(new Event('input',{bubbles:true})); return;
  }
  switch (button.dataset.do) {
    case 'add-player': draft.names.push(''); saveDraft(); render(); document.querySelector(`[data-name="${draft.names.length-1}"]`)?.focus(); break;
    case 'start': change({type:'start'}); break;
    case 'advance': change({type:'advance'}); break;
    case 'call': change({type:'call'}); break;
    case 'fold': {
      const options=actionOptions(game);
      if(options?.due===0) confirmAction('今回は降りますか？','いまは追加のチップなしで続けられます。降りると、この勝負から抜けます。','降りる',()=>change({type:'fold'}));
      else change({type:'fold'});
      break;
    }
    case 'allin': {
      const p=game.players[game.actor];
      confirmAction('残りをすべて出しますか？',`${escape(p.name)}さんの残り${number(p.stack)}枚を出します。この勝負中は、それ以上のチップを追加できません。`,'すべて出す',()=>change({type:'allin'})); break;
    }
    case 'undo': undo(); break;
    case 'menu': menu(); break;
    case 'help': help(); break;
    case 'close': modal.close(); break;
    case 'rebuy': rebuy(); break;
    case 'new-game': newGame(); break;
  }
});
document.addEventListener('input',event=>{
  const input=event.target;
  if (!game && input.closest('#setup-form')) {
    if(input.dataset.name!==undefined) draft.names[Number(input.dataset.name)]=input.value;
    else if(input.name) draft[input.name]=input.value===''?'':Number(input.value);
    saveDraft();
    const error = document.querySelector('#setup-error'); if(error) error.hidden=true;
  }
  if(input.id==='raise-total' && game?.phase==='betting') {
    const added=Number(input.value)-game.players[game.actor].bet;
    document.querySelector('#raise-add').textContent=Number.isFinite(added)?number(Math.max(0,added)):'—';
  }
});
document.addEventListener('change',event=>{
  if(!event.target.closest('#settle-form')) return;
  const selections=getSelections(), list=pots(game);
  const ready=list.every((pot,i)=>pot.eligible.length===1||selections[i].length>0);
  document.querySelector('#settle-submit').disabled=!ready;
  const hint=document.querySelector('#settle-hint');
  hint.textContent=ready?'選んだ人に配分します。間違えても「1つ戻す」で戻せます。':'それぞれのポットで勝った人を選んでください。';
});
function getSelections() {
  return pots(game).map((pot,i)=>pot.eligible.length===1?pot.eligible:[...document.querySelectorAll(`input[name="pot-${i}"]:checked`)].map(input=>Number(input.value)));
}
document.addEventListener('submit',event=>{
  const form=event.target;
  if(!['setup-form','raise-form','settle-form','rebuy-form'].includes(form.id)) return;
  event.preventDefault();
  if(form.id==='setup-form') {
    if(!syncBeforeChange()) return;
    try {
      game=createGame(draft.names,draft);history=[];corruptSave=false;persist();render(true);window.scrollTo({top:0,behavior:'instant'});
    } catch(error) {game=null;const target=document.querySelector('#setup-error');target.textContent=error.message;target.hidden=false;}
  } else if(form.id==='raise-form') {
    const target=Number(document.querySelector('#raise-total').value), options=actionOptions(game);
    if(target===options.max) confirmAction('残りをすべて出しますか？',`残り${number(game.players[game.actor].stack)}枚を出します。`,'すべて出す',()=>change({type:'raise',target}));
    else change({type:'raise',target});
  } else if(form.id==='settle-form') change({type:'settle',selections:getSelections()});
  else if(form.id==='rebuy-form') {
    const data=new FormData(form);
    if(change({type:'rebuy',id:Number(data.get('player')),amount:Number(data.get('amount'))})) {modal.close();toast('チップを追加しました。');}
  }
});
render();
