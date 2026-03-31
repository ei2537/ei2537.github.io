/** @fileoverview HUD DOM updates and notification system. */

import S from './state.js';
import { GEN_GOAL, GEN_COUNT } from './config.js';

export function notify(msg) {
  const el = document.getElementById('notify');
  el.textContent = msg;
  el.classList.add('show');
  S.notifyTTL = 2.5;
}

export function tickHUD() {
  const G = S.G;

  document.getElementById('timerVal').textContent =
    String(Math.floor(G.elapsed / 60)).padStart(2, '0') + ':' +
    String(Math.floor(G.elapsed % 60)).padStart(2, '0');

  buildGenPanel(G);
  buildSurvPanel(G);
  updateGauges(G);
  updateHint(G);
}

function buildGenPanel(G) {
  const done = G.gens.filter(g => g.done).length;
  const gp = document.getElementById('genPanel');
  const color = done >= GEN_GOAL ? 'var(--gen-done)' : 'var(--text)';

  let html = `<div class="gen-label">generators — <span style="color:${color}">${done}/${GEN_GOAL}</span> needed</div>`;
  for (const g of G.gens) {
    const cls = g.done ? 'done' : '';
    const pct = g.done ? 100 : g.progress;
    const label = g.done ? 'done' : Math.floor(g.progress) + '%';
    html += `<div class="gen-row ${cls}"><div class="gen-pip"></div><div class="gen-bar-wrap"><div class="gen-bar-fill" style="width:${pct}%"></div></div><span style="font-size:9px;color:var(--dim)">${label}</span></div>`;
  }
  gp.innerHTML = html;
}

function buildSurvPanel(G) {
  const sp = document.getElementById('survivorPanel');
  let html = '<div class="surv-label" style="text-align:right">survivors</div>';

  for (let i = 0; i < G.survivors.length; i++) {
    const s = G.survivors[i];
    let pips = '';
    for (let j = 0; j < 2; j++) {
      const cls = s.dead ? 'empty' : s.hooked ? 'hooked' : (j < s.hp ? 'full' : 'empty');
      pips += `<div class="surv-pip ${cls}"></div>`;
    }
    const nameColor = s.dead ? 'var(--dim2)' : s.hooked ? 'var(--killer)' : 'var(--dim)';
    const name = s.isPlayer ? 'you' : `s-${i + 1}`;
    const esc = s.escaped ? '<span style="color:var(--gen-done)">escaped</span>' : '';
    html += `<div class="surv-status"><div class="surv-health">${pips}</div><span style="color:${nameColor}">${name}</span> ${esc}</div>`;
  }
  sp.innerHTML = html;
}

function updateGauges(G) {
  const sprintG = document.getElementById('sprintGauge');
  const repairG = document.getElementById('repairGauge');

  if (G.playerRole === 'survivor') {
    const s = G.survivors[0];

    if (s.repairing && s.repairTarget) {
      repairG.classList.add('active');
      document.getElementById('repairFill').style.width = `${s.repairTarget.progress}%`;
    } else {
      repairG.classList.remove('active');
    }

    if (s.dead || s.escaped || s.hooked) {
      sprintG.classList.remove('active');
    } else {
      sprintG.classList.add('active');
      const fill = document.getElementById('sprintFill');
      const label = document.getElementById('sprintLabel');
      fill.style.width = `${s.stamina * 100}%`;
      if (s.exhausted) {
        fill.classList.add('exhausted');
        label.classList.add('exhausted');
        label.textContent = 'exhausted';
      } else {
        fill.classList.remove('exhausted');
        label.classList.remove('exhausted');
        label.textContent = 'sprint';
      }
    }
  } else {
    sprintG.classList.remove('active');
    repairG.classList.remove('active');
  }
}

function updateHint(G) {
  const hint = document.getElementById('actionHint');
  if (G.playerRole === 'survivor') {
    const s = G.survivors[0];
    if (s.dead || s.escaped || s.hooked) hint.textContent = '';
    else if (s.hp < 0 && G.killer.carrying === s.id)
      hint.textContent = `[space] mash to struggle — ${Math.floor(s.struggle)}%`;
    else if (s.downed) hint.textContent = '[wasd] crawl — bleeding out';
    else if (G.sc && !G.sc.result) hint.textContent = '[space] skill check';
    else if (G.scWarn) hint.textContent = '! skill check incoming';
    else if (s.repairing) hint.textContent = 'repairing... [e] cancel  [wasd] move to cancel';
    else hint.textContent = G.exitsOpen ? 'exit gates open — reach the exit' : '[e] interact / repair';
  } else {
    hint.textContent = G.killer.carrying ? 'bring to hook' : '[space] attack';
  }
}
