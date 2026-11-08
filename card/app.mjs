import { VERSION, createGame, transition, actionOptions, potTotal, pots, validateGame } from './engine.mjs';
import { migrateToHoldem, actionPreview, chipColumns } from './presentation.mjs';

const KEY = 'poker-chips:v1', DRAFT_KEY = `${KEY}:setup`, PREF_KEY = `${KEY}:preferences`;
const app = document.querySelector('#app'), modal = document.querySelector('#modal');
const overlay = document.querySelector('#handoff'), effects = document.querySelector('#chip-effects');
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = value => value.toLocaleString('ja-JP');
const signed = value => `${value > 0 ? '+' : ''}${number(value)}`;
const streets = ['プリフロップ','フロップ','ターン','リバー'];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let game = null, history = [], revision = null, storageAvailable = true, corruptSave = false, migrated = false;
let toastTimer, busy = false, effectEpoch = 0, finishHandoff = null;
let preferences = { showInfo:true };
let draft = {names:['','','',''],mode:'holdem',starting:1000,sb:10,bb:20};

function readSave() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const saved = JSON.parse(raw);
  if (saved.version !== VERSION || typeof saved.revision !== 'string' || !Array.isArray(saved.history)) throw new Error('保存形式が異なります。');
  validateGame(saved.game);
  const wasDraw = saved.game.config.mode !== 'holdem';
  saved.game = migrateToHoldem(saved.game);
  saved.history = wasDraw ? [] : saved.history.slice(-60).filter(state => {try {return state.config.mode === 'holdem' && validateGame(state);} catch {return false;}});
  saved.migrated = wasDraw;
  return saved;
}
try {
  const setup = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  if (setup && Array.isArray(setup.names) && setup.names.length >= 2 && setup.names.length <= 10) draft = {...draft,...setup,mode:'holdem'};
  const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
  if (typeof prefs?.showInfo === 'boolean') preferences.showInfo = prefs.showInfo;
  const saved = readSave();
  if (saved) {game = saved.game; history = saved.history; revision = saved.revision; migrated = saved.migrated;}
} catch {corruptSave = true;}
try {localStorage.setItem(`${KEY}:test`,'1');localStorage.removeItem(`${KEY}:test`);} catch {storageAvailable = false;}

function toast(message) {
  const target = document.querySelector('#message');
  clearTimeout(toastTimer); target.textContent = message; target.hidden = false;
  toastTimer = setTimeout(() => {target.hidden = true;}, 3800);
}
function saveDraft() {try {localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));} catch {storageAvailable = false;}}
function persist() {
  revision = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {localStorage.setItem(KEY,JSON.stringify({version:VERSION,revision,game,history}));}
  catch {storageAvailable = false;toast('途中保存ができません。ページを閉じずに使ってください。');}
}
function setBusy(value) {busy = value;app.inert = value;document.querySelector('.site-header').inert = value;}
function cancelEffects() {
  effectEpoch++; if (finishHandoff) finishHandoff();
  overlay.hidden = true; overlay.classList.remove('running'); effects.replaceChildren(); setBusy(false);
}
function syncBeforeChange() {
  if (!storageAvailable) return true;
  try {
    const saved = readSave();
    if ((saved?.revision || null) !== revision) {
      cancelEffects(); game = saved?.game || null; history = saved?.history || []; revision = saved?.revision || null;
      modal.close(); render();toast('別のタブの最新状態を読み込みました。もう一度操作してください。');return false;
    }
  } catch { /* A damaged save can be replaced by a new game. */ }
  return true;
}
async function change(action, origin) {
  if (busy || !syncBeforeChange()) return false;
  try {
    const before = game, next = transition(game,action);
    history.push(game);history = history.slice(-60);game = next;persist();
    const token = ++effectEpoch;
    const delta = potTotal(next) - potTotal(before);
    const pass = next.phase === 'betting' && (before.phase !== 'betting' || before.actor !== next.actor);
    const depositing = delta > 0 && before.phase !== 'ready' && !['rebuy','settle'].includes(action.type);
    if (depositing && before.phase === 'betting') {
      // Let the acting player see their chips leave before passing the screen.
      const player = next.players[before.actor];
      const stack = document.querySelector('#player-stack');
      if (stack) stack.innerHTML = `${number(player.stack)}<small> 枚</small>`;
      const committed = document.querySelector('.turn-committed');
      if (committed) committed.textContent = `このラウンド ${number(player.bet)}枚 · このハンド ${number(player.committed)}枚`;
      const art = document.querySelector('.pot-art');
      if (art) art.outerHTML = chipArt(potTotal(next));
    } else render();
    if (depositing) {setBusy(true);await collectChips(potTotal(before),potTotal(next),origin,token);}
    if (token !== effectEpoch || game !== next) return true;
    if (depositing) render();
    if (pass) await handoff(next.players[next.actor],token);
    if (token === effectEpoch) {setBusy(false);focusPhase();}
    return true;
  } catch(error) {cancelEffects();render();toast(error.message);return false;}
}
function undo() {
  if (busy || !history.length || !syncBeforeChange()) return;
  cancelEffects();game = history.pop();persist();render();focusPhase();toast('1アクション戻しました。');
}
window.addEventListener('storage',event => {
  if (event.key === PREF_KEY) {
    try {const p = JSON.parse(event.newValue || '{}');preferences.showInfo = p.showInfo !== false;render();} catch {}
    return;
  }
  if (event.key !== KEY) return;
  try {
    const saved = readSave();cancelEffects();game = saved?.game || null;history = saved?.history || [];revision = saved?.revision || null;
    modal.close();render();toast('別のタブの変更を反映しました。');
  } catch {toast('別のタブの記録を読み込めませんでした。');}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelEffects();render();}});

async function collectChips(from,to,origin,token) {
  const amount = document.querySelector('#pot-amount'), art = document.querySelector('.pot-art');
  if (!amount || reducedMotion.matches) return;
  const bounds = amount.getBoundingClientRect();
  const target = {x:bounds.left+bounds.width/2,y:bounds.top+bounds.height/2};
  const start = origin ? {x:origin.left+origin.width/2,y:origin.top+origin.height/2} : {x:window.innerWidth/2,y:window.innerHeight*.76};
  const duration = 360, started = performance.now();
  amount.textContent = number(from);art?.classList.add('collecting');
  const flights = Array.from({length:4},(_,i)=>{
    const chip = document.createElement('span');chip.className = 'flying-chip';effects.append(chip);
    const animation = chip.animate([
      {transform:`translate(${start.x+i*5-18}px,${start.y+i*3-12}px) scale(.9)`,opacity:0},
      {offset:.15,opacity:1},
      {transform:`translate(${target.x-12+i*3}px,${target.y-12}px) scale(.55)`,opacity:0}
    ],{duration:duration+i*24,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
    return animation.finished.catch(()=>{}).then(()=>chip.remove());
  });
  await new Promise(resolve=>{
    function tick(now) {
      if(token!==effectEpoch){resolve();return;}
      const progress = Math.min(1,(now-started)/duration);
      amount.textContent = number(Math.round(from+(to-from)*(1-(1-progress)**3)));
      if(progress<1)requestAnimationFrame(tick);else resolve();
    }
    requestAnimationFrame(tick);
  });
  await Promise.all(flights);art?.classList.remove('collecting');
}
function handoff(player,token) {
  if(token!==effectEpoch)return Promise.resolve();
  setBusy(true);
  overlay.innerHTML = `<span class="handoff-caption">次のプレイヤー</span><strong>${escape(player.name)}</strong><span class="handoff-stack">持ち点 <b>${number(player.stack)}</b> 枚</span><span class="handoff-skip">タップでスキップ</span>`;
  overlay.setAttribute('aria-label',`次は${player.name}さん。持ち点${number(player.stack)}枚。タップでスキップ`);
  overlay.dataset.lastPlayer = player.name;overlay.dataset.state = 'active';overlay.hidden = false;
  overlay.classList.remove('running');void overlay.offsetWidth;overlay.classList.add('running');overlay.focus({preventScroll:true});
  return new Promise(resolve=>{
    const done=()=>{clearTimeout(timer);overlay.hidden=true;overlay.classList.remove('running');overlay.dataset.state='complete';finishHandoff=null;overlay.onclick=null;resolve();};
    const timer=setTimeout(done,reducedMotion.matches?350:820);finishHandoff=done;overlay.onclick=done;
  });
}
function focusPhase() {document.querySelector('#turn-title,#phase-title')?.focus({preventScroll:true});}
function render() {
  document.body.classList.toggle('is-playing',!!game);
  document.body.dataset.phase = game?.phase || 'setup';
  app.className = game ? 'playing-app' : 'setup-app';
  app.innerHTML = game ? gameView() : setupView();
}
function infoButton(kind,label) {
  return preferences.showInfo ? `<button type="button" class="info-button" data-info="${kind}" aria-label="${label}の説明"><span aria-hidden="true">i</span></button>` : '';
}
function choice(kind,title,detail,primary=false,disabled=false) {
  return `<div class="action-choice ${primary?'primary-choice':''} ${preferences.showInfo?'has-info':''}"><button type="button" class="choice-button" data-do="${kind}" ${disabled?'disabled':''}><strong>${title}</strong><small>${detail}</small></button>${infoButton(kind,kind==='call'?(actionOptions(game).due===0?'チェック':'コール'):kind==='fold'?'フォールド':'オールイン')}</div>`;
}

function setupView() {
  return `<div class="intro"><p class="eyebrow">NO LIMIT TEXAS HOLD’EM</p><h1>ポーカーチップ</h1><p>トランプは手元に。全員のチップは、この1台で。</p></div>
  ${!storageAvailable?'<p class="storage-error">途中保存を使えません。プレイ中はページを閉じずに使ってください。</p>':''}
  ${corruptSave?'<p class="storage-error">前回の記録を読み込めませんでした。新しいゲームを始めると保存し直します。</p>':''}
  <form id="setup-form"><div class="setup-grid"><section class="panel"><div class="section-title"><h2>プレイヤー</h2><span>${draft.names.length}人</span></div><p class="help-text">席順に、上から時計回りで入力してください。</p><div class="player-inputs">${draft.names.map((name,i)=>`<div class="player-input"><label for="name-${i}">${String(i+1).padStart(2,'0')}</label><input id="name-${i}" data-name="${i}" aria-label="${i+1}人目の名前" value="${escape(name)}" placeholder="プレイヤー${i+1}" maxlength="20" autocomplete="off"><button type="button" class="remove-player" data-remove="${i}" aria-label="${i+1}人目を外す" ${draft.names.length<=2?'disabled':''}>×</button></div>`).join('')}</div><button type="button" class="add-player wide" data-do="add-player" ${draft.names.length>=10?'disabled':''}>＋ プレイヤーを追加</button><p class="help-text">2〜10人。空欄なら「プレイヤー1」のように表示します。</p></section>
  <section class="panel"><div class="section-title"><h2>テーブル設定</h2><span>テキサスホールデム</span></div><label class="field"><span>スタートチップ</span><span class="input-unit"><input name="starting" type="number" inputmode="numeric" min="2" max="1000000" step="1" required value="${escape(draft.starting)}"><span>枚 / 人</span></span></label><div class="fields-two"><label class="field"><span>スモールブラインド</span><span class="input-unit"><input name="sb" type="number" inputmode="numeric" min="1" max="999999" step="1" required value="${escape(draft.sb)}"><span>枚</span></span></label><label class="field"><span>ビッグブラインド</span><span class="input-unit"><input name="bb" type="number" inputmode="numeric" min="2" max="1000000" step="1" required value="${escape(draft.bb)}"><span>枚</span></span></label></div><p class="help-text">ブラインドは自動で支払い、ハンドごとに交代します。</p><p id="setup-error" class="error" role="alert" hidden></p><button class="primary wide start-button" type="submit">テーブルを作る</button><p class="save-note">このブラウザに自動保存されます。</p></section></div></form><p class="footer-note">カードと勝敗は手元で確認。チップは点数として使います。</p>`;
}
function stageTrack() {
  const result=['showdown','complete'].includes(game.phase);
  return `<ol class="street-track" aria-label="ベッティングラウンド">${[...streets,'結果'].map((name,i)=>`<li class="${(result?i===4:i===game.round)?'current':''}" ${(result?i===4:i===game.round)?'aria-current="step"':''}>${name}</li>`).join('')}</ol>`;
}
function chipArt(amount) {
  return `<div class="pot-art" aria-hidden="true">${chipColumns(amount).map((col,i)=>`<div class="chip-column shade-${i}">${Array.from({length:col.visible},(_,j)=>`<span class="pot-chip" style="--level:${j}">${j===col.visible-1?col.value:''}</span>`).join('')}</div>`).join('')}</div>`;
}
function potView() {
  const total=game.phase==='complete'?game.result.total:potTotal(game);
  return `<div class="pot-area"><div><p class="eyebrow">${game.phase==='complete'?'獲得ポット':'POT'}</p><p class="pot-number"><strong id="pot-amount">${number(total)}</strong><span>枚</span></p></div>${chipArt(total)}<div class="pot-bet"><span>現在のベット</span><strong>${number(game.currentBet)}<small> 枚</small></strong></div></div>`;
}
function gameView() {
  return `<div class="game-shell"><div class="game-bar"><div><h1>${game.hand?`ハンド ${game.hand}`:'テーブル準備'}</h1><span>BLINDS ${number(game.config.sb)} / ${number(game.config.bb)}</span></div><div class="game-tools"><button type="button" class="text-button" data-do="undo" ${history.length?'':'disabled'}>1つ戻す</button><button type="button" class="text-button" data-do="menu">メニュー</button></div></div>${stageTrack()}<div class="play-layout"><section class="play-panel" aria-label="ゲームの操作">${potView()}<div class="phase-content ${game.phase==='betting'?'betting-content':''}">${phaseView()}</div></section><aside class="desktop-table">${tableView()}</aside></div><div class="game-footer"><button type="button" data-do="players">全員のチップ</button><span class="save-indicator ${storageAvailable?'':'unsaved'}">${storageAvailable?'保存済み':'保存できません'}</span><button type="button" data-do="log">アクション履歴</button></div></div>`;
}
function tableView() {
  return `<div class="table-wrap"><h2>全員のチップ</h2><table class="players-table"><thead><tr><th scope="col">プレイヤー</th><th scope="col">残り</th><th scope="col">投入済み</th></tr></thead><tbody>${game.players.map((p,i)=>{
    let status=game.phase==='ready'?'準備OK':!p.inHand?'シットアウト':p.folded?'フォールド':p.stack===0&&game.phase!=='complete'?'オールイン':p.lastAction;
    if(game.phase==='complete')status=`${signed(game.result.changes.find(c=>c.id===i)?.amount||0)}枚`;
    if(game.actor===i)status='現在のプレイヤー';
    const badges=game.hand>0?`${game.dealer===i?'<b class="badge">D</b>':''}${game.sb===i?'<b class="badge">SB</b>':''}${game.bb===i?'<b class="badge">BB</b>':''}`:'';
    return `<tr class="${game.actor===i?'active':''} ${p.folded?'folded':''}"><td><div class="player-name">${escape(p.name)} ${badges}</div><small>${escape(status||'待機中')}</small></td><td>${number(p.stack)}</td><td>${game.phase==='complete'?'—':number(p.committed)}</td></tr>`;
  }).join('')}</tbody></table><p class="help-text">D：ディーラー / SB・BB：ブラインド<br>投入済みは、このハンド全体の合計です。</p></div>`;
}
function phaseView() {
  if(game.phase==='betting')return bettingView();
  if(game.phase==='ready')return `<div class="phase-copy"><p class="eyebrow">READY</p><h2 id="phase-title" tabindex="-1">テーブルの準備ができました。</h2><p>最初のディーラーは${escape(game.players[game.dealer].name)}さん。画面に沿って、時計回りに進めます。</p></div><button type="button" class="primary wide phase-next" data-do="start">最初のハンドへ</button>`;
  if(game.phase==='deal')return `<div class="phase-copy"><p class="eyebrow">ディーラー：${escape(game.players[game.dealer].name)}</p><h2 id="phase-title" tabindex="-1">ホールカードを2枚ずつ。</h2><p>全員に2枚ずつ裏向きで配り、手札を確認してください。共有カードはまだ出しません。</p><p class="blind-note">${escape(game.players[game.sb].name)}：SB ${number(game.players[game.sb].bet)}枚<br>${escape(game.players[game.bb].name)}：BB ${number(game.players[game.bb].bet)}枚 <span>支払い済み</span></p></div><button type="button" class="primary wide phase-next" data-do="advance">配り終えた · プリフロップへ</button>`;
  if(game.phase==='between') {
    const next=streets[game.round+1];
    return `<div class="phase-copy"><p class="eyebrow">NEXT · ${next}</p><h2 id="phase-title" tabindex="-1">${game.round===0?'フロップを3枚公開。':`${next}を1枚公開。`}</h2><p>山札の一番上を1枚よけてから、${game.round===0?'共有カードを3枚':`${game.round===1?'4':'5'}枚目の共有カードを`}表向きにしてください。</p></div><button type="button" class="primary wide phase-next" data-do="advance">公開できた · ${next}へ</button>`;
  }
  if(game.phase==='showdown')return showdownView();
  return resultView();
}
function bettingView() {
  const p=game.players[game.actor],o=actionOptions(game),minimum=Math.min(o.min,o.max);
  const quick=[...new Set([minimum,Math.min(o.max,minimum+game.config.bb),Math.min(o.max,minimum*2)])];
  return `<div class="turn-summary"><div class="turn-identity"><p class="eyebrow">現在のプレイヤー</p><h2 id="turn-title" tabindex="-1" title="${escape(p.name)}">${escape(p.name)}</h2><p class="turn-committed">このラウンド ${number(p.bet)}枚 · このハンド ${number(p.committed)}枚</p></div><div class="own-stack"><span>持ち点（残り）</span><strong id="player-stack" class="${p.stack>=1000000?'large-stack':''}">${number(p.stack)}<small> 枚</small></strong></div></div>
  <div class="action-pair">${choice('call',o.due===0?'チェック':'コール',o.due===0?'追加 0枚':`追加 ${number(o.call)}枚${p.stack<=o.due?' · オールイン':''}`,true)}${choice('fold','フォールド','このハンドを降りる')}</div>
  ${o.canRaise?`<form id="raise-form" class="raise-box"><div class="raise-heading"><label for="raise-total">${game.currentBet===0?'ベット':'レイズ'} <span>このラウンドの合計</span></label>${infoButton('raise',game.currentBet===0?'ベット':'レイズ')}</div><div class="raise-controls"><div class="raise-input"><input id="raise-total" type="number" inputmode="numeric" min="${minimum}" max="${o.max}" step="1" required value="${minimum}" aria-describedby="raise-hint"><span>枚</span></div><button type="submit" class="raise-submit">${game.currentBet===0?'ベット':'レイズ'}する <small>追加 <span id="raise-add">${number(minimum-p.bet)}</span>枚</small></button></div><div class="raise-bottom"><p id="raise-hint">${o.max<o.min?'全額の場合のみ可能':`最小 ${number(o.min)}枚`}</p><div class="quick-bets">${quick.map(amount=>`<button type="button" data-amount="${amount}">${number(amount)}</button>`).join('')}</div></div></form>`:`<div class="raise-unavailable"><span>レイズ不可</span><small>${game.players.some(other=>other.id!==p.id&&other.inHand&&!other.folded&&other.stack>0)?'ベッティングが再開されていません':'相手はオールインしています'}</small>${infoButton('raise','レイズ')}</div>`}
  ${o.allInAllowed&&p.stack>o.call?`<div class="allin-row ${preferences.showInfo?'has-info':''}"><button type="button" data-do="allin">オールイン <strong>${number(p.stack)}枚</strong></button>${infoButton('allin','オールイン')}</div>`:'<div class="no-allin-note">コールかフォールドを選んでください。</div>'}`;
}
function showdownView() {
  const list=pots(game);
  return `<div class="phase-copy compact-copy"><p class="eyebrow">SHOWDOWN</p><h2 id="phase-title" tabindex="-1">勝者を選んでください。</h2><p>手札を公開して比較します。同点なら複数人を選択。</p></div><form id="settle-form" class="settle-form"><div class="settle-pots scroll-area">${list.map((pot,i)=>`<fieldset class="pot-select"><legend>${list.length===1?'ポット':i===0?'メインポット':`サイドポット ${i}`} · ${number(pot.amount)}枚</legend>${pot.eligible.length===1?`<p class="automatic-award">${escape(game.players[pot.eligible[0]].name)}さんに配分</p>`:`<div class="winner-options">${pot.eligible.map(id=>`<label class="winner-option"><input type="checkbox" name="pot-${i}" value="${id}"><span>${escape(game.players[id].name)}</span></label>`).join('')}</div>`}</fieldset>`).join('')}</div><p id="settle-hint" class="help-text" role="status">${list.every(p=>p.eligible.length===1)?'配分先を確認してください。':'各ポットの勝者を選んでください。'}</p><button type="submit" id="settle-submit" class="primary wide" ${list.every(p=>p.eligible.length===1)?'':'disabled'}>チップを配分する</button></form>`;
}
function resultView() {
  const funded=game.players.filter(p=>p.stack>0),awards=game.result.awards.filter(a=>a.amount>0);
  return `<div class="phase-copy compact-copy"><p class="eyebrow">RESULT</p><h2 id="phase-title" tabindex="-1">${awards.length===1?`${escape(game.players[awards[0].id].name)}さんの勝ち`:'スプリットポット'}</h2><p>${game.result.reason==='ほかの全員が降りたため'?'ほかの全員がフォールドしました。':'勝者にポットを配分しました。'}</p></div><ul class="result-list scroll-area" aria-label="このハンドの増減">${game.result.changes.map(c=>`<li><span>${escape(game.players[c.id].name)}</span><strong class="${c.amount>0?'positive':''}">${signed(c.amount)}枚</strong></li>`).join('')}</ul>${funded.length>=2?'<button type="button" class="primary wide phase-next" data-do="start">次のハンドへ</button>':'<button type="button" class="primary wide phase-next" data-do="new-game">新しいゲームを始める</button><button type="button" class="text-button wide" data-do="rebuy">リバイして続ける</button>'}`;
}

function showModal(title,body,actions='') {
  if(modal.open)modal.close();
  document.querySelector('#modal-content').innerHTML=`<div class="dialog-head"><h2 id="modal-title">${title}</h2><button type="button" data-do="close" aria-label="閉じる">×</button></div><div class="dialog-body">${body}</div>${actions?`<div class="dialog-actions">${actions}</div>`:''}`;
  modal.showModal();
}
function confirmAction(title,body,label,callback) {
  showModal(title,`<p>${body}</p>`,'<button type="button" data-do="close">キャンセル</button><button type="button" class="primary" id="confirm-action"></button>');
  const button=document.querySelector('#confirm-action');button.textContent=label;
  button.addEventListener('click',()=>{modal.close();callback();},{once:true});
}
function explain(kind) {
  if(game?.phase!=='betting')return;
  const p=game.players[game.actor],o=actionOptions(game);
  const actual=kind==='call'&&o.due===0?'check':kind;
  const titles={check:'チェック',call:'コール',fold:'フォールド',raise:game.currentBet===0?'ベット':'レイズ',allin:'オールイン'};
  const target=Number(document.querySelector('#raise-total')?.value);
  if(kind==='raise'&&!o.canRaise) {
    const opponentCanAct=game.players.some(other=>other.id!==p.id&&other.inHand&&!other.folded&&other.stack>0);
    showModal('レイズできない理由',`<p>${opponentCanAct?'直前の小さなオールインでは、すでに行動したあなたにレイズの権利が戻っていません。今回はコールかフォールドを選びます。':'残っている相手は全員オールインです。相手が追加できないため、必要な分のコールかフォールドを選びます。'}</p><p class="help-text">レイズが可能になる場合だけ、入力欄を表示します。</p>`);return;
  }
  let preview;
  try {preview=actionPreview(game,actual,target);} catch(error) {showModal(`${titles[actual]}の説明`,`<p>${escape(error.message)}</p><p class="help-text">現在入力している額での説明です。額を修正して、もう一度確認してください。</p>`);return;}
  const introductions={
    check:'チップを追加せず、ハンドに残って次の人へ回します。',
    call:preview.allin?'残りのチップをすべて出してコールします。足りない分を追加する必要はありません。':'現在のベットと同じ合計にそろえ、ハンドに残ります。',
    fold:`このハンドを降ります。投入済みの${number(p.committed)}枚はポットに残り、取り戻せません。`,
    raise:`このラウンドの合計を${number(preview.roundTotal)}枚に${game.currentBet===0?'設定':'引き上げ'}ます。すでに出した${number(p.bet)}枚を差し引き、${number(preview.paid)}枚を追加します。`,
    allin:`残り${number(p.stack)}枚をすべて投入します。このハンドでこれ以上のチップを要求されることはありません。`
  };
  const tradeoffs={
    check:'追加のチップを失うリスクなく様子を見られます。一方、相手に追加を要求したり、降りる判断を迫ったりはできません。',
    call:'今の額で勝負に残れますが、相手に新しい追加額は要求しません。後の相手のレイズには、再び対応が必要になることがあります。',
    fold:'これ以上の損失を避けられます。その代わり、このハンドのポットを獲得する権利を失います。',
    raise:'相手に追加のチップを要求して、続けるか降りるかの判断を迫れます。その分、自分が失う可能性のあるチップも増えます。相手がレイズし返せる場合もあります。',
    allin:'追加できる上限まで出す選択です。相手が全員降りればポットを獲得しますが、負けると今回出したチップをすべて失います。勝っても、自分が参加した範囲のポットまでしか受け取れません。'
  };
  let impact;
  if(preview.wonByFold)impact=`<p>${escape(preview.winner)}さん以外が全員降りるため、${escape(preview.winner)}さんがポット${number(preview.potAfter)}枚を獲得します。</p>`;
  else if(preview.nextPhase!=='betting')impact=`<p>必要なチップがそろうため、このベッティングラウンドは終了します。${preview.nextPhase==='showdown'?'次はショーダウンです。':'次は共有カードを公開します。'}</p>`;
  else {
    const pressure=(actual==='raise'||actual==='allin')&&preview.roundTotal>game.currentBet;
    impact=`<p>${pressure?'新しいベットに届いていない相手はチェックできません。コール、権利があれば再レイズ、またはフォールドを選びます。':actual==='fold'?'相手に追加額は要求せず、相手同士の勝負が続きます。':actual==='check'?'相手もチェックできますが、ベットすることもできます。相手がベットしたら、あなたにも対応の手番が回ります。':'ベット額を引き上げないため、相手の支払い条件は変わりません。まだベットに届いていない相手はチェックできません。'}</p>
    <div class="opponent-list">${preview.opponents.map(other=>`<div><strong>${escape(other.name)}</strong><span>${other.allin?'オールイン済み · 操作せず結果を待つ':other.responded?'対応済み · 追加不要':`追加 ${number(other.due)}枚${other.fullDue>other.due?'（残り全額）':''}<small>${other.actions.join(' / ')}</small>`}</span></div>`).join('')}</div><p class="help-text">今のベット額のまま相手の手番が来た場合です。その前に別の人がレイズすると条件が変わります。</p>`;
  }
  showModal(titles[actual],`<p>${introductions[actual]}</p><dl class="impact-numbers"><div><dt>自分の持ち点</dt><dd>${number(preview.stackBefore)} → <strong>${number(preview.stackAfter)}</strong>枚</dd></div><div><dt>ポット${preview.wonByFold?'（配分）':''}</dt><dd>${number(preview.potBefore)} → <strong>${number(preview.potAfter)}</strong>枚</dd></div></dl><section class="info-section"><h3>相手への影響</h3>${impact}</section><section class="info-section"><h3>この選択の特徴</h3><p>${tradeoffs[actual]}</p>${preview.allin?'<p class="help-text">以後は操作せず結果を待ちます。サイドポットは自動で分けます。</p>':''}</section>`);
}
function settings() {
  showModal('設定',`<label class="setting-switch"><span><strong>アクションの説明ボタン</strong><small>ⓘ で、枚数の変化と相手への影響を確認できます。</small></span><input id="show-info" type="checkbox" role="switch" ${preferences.showInfo?'checked':''}></label><p class="help-text">オフにすると、プレイ画面の説明ボタンを非表示にします。設定はこのブラウザに保存されます。</p>`);
}
function help() {
  showModal('使い方・役の強さ',`<p>ノーリミットのテキサスホールデム専用です。スマホ1台を回すか、1人が全員分を操作してください。</p><section class="info-section"><h3>ハンドの流れ</h3><ol><li>2人のブラインドを自動支払い。全員にホールカードを2枚ずつ配ります。</li><li>プリフロップでベットします。</li><li>フロップ3枚、ターン1枚、リバー1枚を順に公開し、そのつどベットします。</li><li>ショーダウンで勝者を選ぶとポットを配分します。</li></ol><p>自分の2枚と共有カード5枚から、最も強い5枚を作ります。全員がフォールドした場合は、その場で残った人の勝ちです。</p></section><section class="info-section"><h3>アクションの説明</h3><p>各アクション横のⓘで、その時点の支払い、残りチップ、相手の選択肢を確認できます。レイズ入力は「このラウンドで出す合計」です。説明ボタンは設定で隠せます。</p></section><section class="info-section"><h3>役の強さ（上ほど強い）</h3><ol><li>ロイヤルフラッシュ</li><li>ストレートフラッシュ</li><li>フォーカード</li><li>フルハウス</li><li>フラッシュ</li><li>ストレート</li><li>スリーカード</li><li>ツーペア</li><li>ワンペア</li><li>ハイカード</li></ol><p>同じ役は数字とキッカーで比較します。スートに強弱はありません。A・2・3・4・5は最も弱いストレートです。</p></section><section class="info-section"><h3>保存・配分</h3><p>操作のたびにブラウザに保存します。「1つ戻す」は60アクションまで。リバイはハンドの合間にできます。同点の余り1枚は、ディーラーの左から時計回りに配ります。</p><p>カードの配布と勝敗判定は手元で行います。プライベートブラウズ終了やサイトデータ削除で記録は消えます。</p></section>`);
}
function menu() {
  const between=['ready','complete'].includes(game.phase);
  showModal('メニュー',`<div class="menu-buttons"><button type="button" data-do="players">全員のチップ</button><button type="button" data-do="rebuy" ${between?'':'disabled'}>リバイ（チップ追加）</button><button type="button" data-do="settings">設定</button><button type="button" data-do="help">使い方・役の強さ</button><button type="button" data-do="log">アクション履歴</button><button type="button" class="danger text-button" data-do="new-game">ゲームを終了して最初から</button></div><p class="help-text">リバイはハンド開始前・終了後にできます。</p>`);
}
function rebuy() {
  if(!['ready','complete'].includes(game.phase))return;
  showModal('リバイ',`<form id="rebuy-form"><label class="field"><span>プレイヤー</span><select name="player">${game.players.map(p=>`<option value="${p.id}">${escape(p.name)}（残り${number(p.stack)}枚）</option>`).join('')}</select></label><label class="field"><span>追加するチップ</span><input name="amount" type="number" inputmode="numeric" min="1" max="1000000" step="1" required value="${game.config.starting}"></label><button type="submit" class="primary wide start-button">追加する</button></form>`);
}
function newGame() {
  confirmAction('最初から始めますか？','現在のチップと進行をリセットします。同じメンバーで設定し直せます。','最初から始める',()=>{
    if(!syncBeforeChange())return;
    cancelEffects();draft={...game.config,names:game.players.map(p=>p.name),mode:'holdem'};saveDraft();game=null;history=[];revision=null;
    try {localStorage.removeItem(KEY);} catch {storageAvailable=false;}
    render();window.scrollTo({top:0,behavior:'instant'});
  });
}
function getSelections() {return pots(game).map((pot,i)=>pot.eligible.length===1?pot.eligible:[...document.querySelectorAll(`input[name="pot-${i}"]:checked`)].map(input=>Number(input.value)));}

document.querySelector('#help-button').addEventListener('click',help);
document.querySelector('#settings-button').addEventListener('click',settings);
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled||busy)return;
  if(button.dataset.info){explain(button.dataset.info);return;}
  if(button.dataset.remove!==undefined){draft.names.splice(Number(button.dataset.remove),1);saveDraft();render();return;}
  if(button.dataset.amount!==undefined){const input=document.querySelector('#raise-total');input.value=button.dataset.amount;input.dispatchEvent(new Event('input',{bubbles:true}));return;}
  const origin=button.getBoundingClientRect();
  switch(button.dataset.do) {
    case 'add-player':if(draft.names.length>=10)break;draft.names.push('');saveDraft();render();document.querySelector(`[data-name="${draft.names.length-1}"]`)?.focus();break;
    case 'start':change({type:'start'},origin);break;
    case 'advance':change({type:'advance'},origin);break;
    case 'call':change({type:'call'},origin);break;
    case 'fold':change({type:'fold'},origin);break;
    case 'allin':confirmAction('オールインしますか？',`残り${number(game.players[game.actor].stack)}枚をすべて投入します。`,'オールイン',()=>change({type:'allin'},origin));break;
    case 'undo':undo();break;
    case 'menu':menu();break;
    case 'settings':settings();break;
    case 'help':help();break;
    case 'close':modal.close();break;
    case 'players':showModal('チップ一覧',tableView());break;
    case 'log':showModal('アクション履歴',game.log.length?`<ol class="action-log">${game.log.map(text=>`<li>${escape(text)}</li>`).join('')}</ol>`:'<p>まだアクションはありません。</p>');break;
    case 'rebuy':rebuy();break;
    case 'new-game':newGame();break;
  }
});
document.addEventListener('input',event=>{
  const input=event.target;
  if(!game&&input.closest('#setup-form')) {
    if(input.dataset.name!==undefined)draft.names[Number(input.dataset.name)]=input.value;
    else if(input.name)draft[input.name]=input.value===''?'':Number(input.value);
    saveDraft();const error=document.querySelector('#setup-error');if(error)error.hidden=true;
  }
  if(input.id==='raise-total'&&game?.phase==='betting') {
    const added=Number(input.value)-game.players[game.actor].bet;
    document.querySelector('#raise-add').textContent=Number.isFinite(added)?number(Math.max(0,added)):'—';
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='show-info') {
    preferences.showInfo=event.target.checked;
    try {localStorage.setItem(PREF_KEY,JSON.stringify(preferences));} catch {toast('設定は、このページを閉じるまで反映します。');}
    render();return;
  }
  if(!event.target.closest('#settle-form'))return;
  const selections=getSelections(),ready=pots(game).every((pot,i)=>pot.eligible.length===1||selections[i].length>0);
  document.querySelector('#settle-submit').disabled=!ready;
  document.querySelector('#settle-hint').textContent=ready?'選んだ勝者に配分します。':'各ポットの勝者を選んでください。';
});
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!['setup-form','raise-form','settle-form','rebuy-form'].includes(form.id))return;
  event.preventDefault();if(busy)return;
  if(form.id==='setup-form') {
    if(!syncBeforeChange())return;
    try {game=createGame(draft.names,{...draft,mode:'holdem'});history=[];corruptSave=false;persist();render();window.scrollTo({top:0,behavior:'instant'});focusPhase();}
    catch(error){game=null;const target=document.querySelector('#setup-error');target.textContent=error.message;target.hidden=false;}
  } else if(form.id==='raise-form') {
    const target=Number(document.querySelector('#raise-total').value),options=actionOptions(game),origin=event.submitter?.getBoundingClientRect();
    if(target===options.max)confirmAction('オールインしますか？',`残り${number(game.players[game.actor].stack)}枚をすべて投入します。`,'オールイン',()=>change({type:'raise',target},origin));
    else change({type:'raise',target},origin);
  } else if(form.id==='settle-form')change({type:'settle',selections:getSelections()});
  else {const data=new FormData(form);modal.close();if(await change({type:'rebuy',id:Number(data.get('player')),amount:Number(data.get('amount'))}))toast('チップを追加しました。');}
});
if(migrated){persist();toast('以前のルールのチップを戻し、ホールデムの開始前に切り替えました。');}
render();
