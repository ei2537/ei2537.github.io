/** @fileoverview Entry point — game initialization, main loop, and screen transitions. */

import S from './state.js';
import { TILE, MAP_W, MAP_H, C, S_SPD, GEN_GOAL, DBG_FOG_OFF, toggleScreenMode } from './config.js';
import { MapGen } from './map.js';
import { Survivor, Killer } from './entities.js';
import { moveEnt } from './physics.js';
import { tickSC } from './combat.js';
import { tickKiller, tickSurvivors } from './ai.js';
import { tickInput } from './input.js';
import { tickParts, bleed } from './effects.js';
import { tickHUD, notify } from './hud.js';
import {
  drawMap, drawRooms, drawGens, drawHooks, drawExits,
  drawSurvs, drawKiller, drawAlerts, drawTerror, drawSC,
  drawBlood, drawParts, drawMinimap, drawBigMap,
} from './renderer.js';

// Canvas setup
S.canvas = document.getElementById('canvas');
S.ctx    = S.canvas.getContext('2d');
S.mmCvs  = document.getElementById('minimap');
S.mmCtx  = S.mmCvs.getContext('2d');

function resize() {
  S.canvas.width  = window.innerWidth;
  S.canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Keyboard state
window.addEventListener('keydown', e => {
  S.keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM' && S.G && S.G.phase === 'play') {
    S.G.mapOpen = !S.G.mapOpen;
    document.getElementById('bigMapOverlay').classList.toggle('active', S.G.mapOpen);
  }
  if (e.code === 'KeyP') {
    const mode = toggleScreenMode();
    if (S.G && S.G.phase === 'play') notify('Screen Mode: ' + (mode ? 'ON' : 'OFF'));
  }
});
window.addEventListener('keyup', e => { S.keys[e.code] = false; });

// Game initialization
function initGame(role) {
  const map = new MapGen(MAP_W, MAP_H).generate(Date.now() & 0xFFFF);
  const floor = [];
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++)
      if (!map.isWall(x, y)) floor.push({ x, y });

  // Killer spawns near shack
  const shack = map.rooms.find(r => r.type === 'shack');
  const scx = shack ? shack.x + Math.floor(shack.w / 2) : 4;
  const scy = shack ? shack.y + Math.floor(shack.h / 2) : 4;
  const kTile = floor.find(f => Math.abs(f.x - scx) < 5 && Math.abs(f.y - scy) < 5) || floor[0];
  const killer = new Killer(kTile.x * TILE + TILE / 2, kTile.y * TILE + TILE / 2, role === 'killer');

  // Survivors spawn far from killer
  const survivors = [];
  const used = new Set([`${kTile.x},${kTile.y}`]);
  const shuffled = floor.sort(() => Math.random() - 0.5);
  for (let i = 0; i < 4; i++) {
    let chosen = shuffled.find(f =>
      !used.has(`${f.x},${f.y}`) && Math.abs(f.x - kTile.x) + Math.abs(f.y - kTile.y) > 20
    );
    if (!chosen) chosen = shuffled.find(f => !used.has(`${f.x},${f.y}`)) || floor[Math.floor(Math.random() * floor.length)];
    used.add(`${chosen.x},${chosen.y}`);
    survivors.push(new Survivor(chosen.x * TILE + TILE / 2, chosen.y * TILE + TILE / 2, i, role === 'survivor' && i === 0));
  }

  S.G = {
    map, survivors, killer,
    gens: map.genPlaces.map((p, i) => ({
      x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2,
      progress: 0, done: false, id: i, sparks: [],
    })),
    hooks: map.hookPlaces.map((p, i) => ({
      x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2,
      occupied: false, id: i, isBasement: p.isBasement || false,
    })),
    exits: map.exitPlaces.map((p, i) => ({
      x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2,
      open: false, id: i, dir: p.dir,
    })),
    fog: Array.from({ length: MAP_H }, () => Array(MAP_W).fill(DBG_FOG_OFF ? 1 : 0)),
    playerRole: role, elapsed: 0, phase: 'play', exitsOpen: false,
    particles: [], blood: [], alerts: [], sc: null, scWarn: null,
    mapOpen: false, result: null,
    stats: { gensRepaired: 0, hooksAttempted: 0, escapes: 0, kills: 0, time: 0 },
    cam: { x: 0, y: 0 }, prevTime: performance.now(),
  };
}

// Fog-of-war — gradually reveals tiles around the player
function tickFog() {
  const o = S.G.playerRole === 'killer' ? S.G.killer : S.G.survivors[0];
  if (!o || o.dead || o.escaped) return;
  const vr = S.G.playerRole === 'killer' ? 12 : 9;
  for (let y = Math.max(0, o.ty - vr); y < Math.min(MAP_H, o.ty + vr + 1); y++)
    for (let x = Math.max(0, o.tx - vr); x < Math.min(MAP_W, o.tx + vr + 1); x++)
      if (Math.hypot(x - o.tx, y - o.ty) <= vr)
        S.G.fog[y][x] = Math.min(1, S.G.fog[y][x] + 0.08);
}

// Main game loop
function gameLoop(now) {
  if (!S.running) return;
  const G = S.G;
  const dt = Math.min((now - G.prevTime) / 1000, 0.05);
  G.prevTime = now;

  if (G.phase === 'play') {
    G.elapsed += dt;
    tickInput(dt);
    if (G.playerRole === 'killer') tickSurvivors(dt);
    else { tickKiller(dt); tickSurvivors(dt); }
    tickSC(dt);

    // Hook and bleedout timers
    G.survivors.forEach(s => {
      if (s.hooked) {
        s.hookTimer -= dt;
        if (s.hookTimer <= 0) {
          s.dead = true; s.hooked = false; G.stats.kills++;
          G.hooks.find(h => h.id === s.hookId).occupied = false;
          bleed(s.x, s.y); notify('survivor eliminated');
        }
      }
      if (s.downed && !s.dead) {
        s.downedTimer -= dt;
        if (!s.isPlayer) {
          const k = G.killer;
          const fx = s.x - k.x, fy = s.y - k.y, fd = Math.hypot(fx, fy) || 1;
          moveEnt(s, fx / fd * (S_SPD * 0.1) * dt, fy / fd * (S_SPD * 0.1) * dt, G.map);
        }
        if (s.downedTimer <= 0) {
          s.dead = true; s.downed = false; G.stats.kills++;
          bleed(s.x, s.y); notify('survivor bled out');
        }
      }
    });

    tickParts(dt);
    tickFog();

    // Camera follow
    const target = G.playerRole === 'killer'
      ? G.killer
      : (!G.survivors[0].dead && !G.survivors[0].escaped ? G.survivors[0] : G.killer);
    G.cam.x += (target.x - S.canvas.width / 2 - G.cam.x) * 0.12;
    G.cam.y += (target.y - S.canvas.height / 2 - G.cam.y) * 0.12;

    // Win/loss check
    if (G.survivors.every(s => s.dead || s.escaped || s.hooked)) {
      const esc = G.survivors.filter(s => s.escaped).length;
      let r = 'draw';
      if (esc >= 3) r = G.playerRole === 'survivor' ? 'win' : 'lose';
      else if (esc <= 1) r = G.playerRole === 'survivor' ? 'lose' : 'win';
      endGame(r);
    }

    if (S.notifyTTL > 0) {
      S.notifyTTL -= dt;
      if (S.notifyTTL <= 0) document.getElementById('notify').classList.remove('show');
    }
  }

  // Render
  S.ctx.fillStyle = '#000';
  S.ctx.fillRect(0, 0, S.canvas.width, S.canvas.height);

  if (G.phase === 'play' || G.phase === 'result') {
    drawMap(); drawRooms(); drawBlood(dt);
    drawGens(); drawHooks(); drawExits();
    drawSurvs(); drawKiller(); drawParts();
    drawAlerts(); drawTerror(); drawSC();
    tickHUD(); drawMinimap(); drawBigMap();
  }

  requestAnimationFrame(gameLoop);
}

// End game — show result screen
function endGame(result) {
  const G = S.G;
  G.phase = 'result'; G.result = result; G.stats.time = G.elapsed;
  document.getElementById('hud').classList.remove('active');
  document.getElementById('resultScreen').classList.remove('hidden');

  const win = result === 'win', draw = result === 'draw';
  document.getElementById('resultTitle').textContent = draw ? 'Draw' : (win ? 'Victory' : 'Defeat');
  document.getElementById('resultTitle').className = 'result-title ' + result;

  const esc = G.survivors.filter(s => s.escaped).length;
  const kills = 4 - esc;

  let sub = '';
  if (draw) sub = `${esc} escaped, ${kills} sacrificed - A Balanced Trial.`;
  else if (G.playerRole === 'survivor') sub = win ? `${esc} escaped - Survivor Team Win!` : `${kills} sacrificed - Survivor Team Loss...`;
  else sub = win ? `Entity Pleased - ${kills} sacrificed.` : `Entity Displeased - ${esc} escaped.`;

  document.getElementById('resultSub').textContent = sub;

  const t = G.stats;
  document.getElementById('resultStats').innerHTML = [
    row('time elapsed', `${pad(Math.floor(t.time / 60))}:${pad(Math.floor(t.time % 60))}`),
    row('generators repaired', `${t.gensRepaired} / ${GEN_GOAL}`),
    row('survivors hooked', t.hooksAttempted),
    row('escaped', t.escapes),
    row('killed', t.kills),
  ].join('');
}

function row(label, val) {
  return `<div class="result-stat-row"><span>${label}</span><span class="val">${val}</span></div>`;
}
function pad(n) { return String(n).padStart(2, '0'); }

// UI event listeners
document.querySelectorAll('.role-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    S.role = btn.dataset.role;
  })
);

document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('titleScreen').classList.add('hidden');
  document.getElementById('hud').classList.add('active');
  initGame(S.role);
  S.running = true;
  S.G.prevTime = performance.now();
  requestAnimationFrame(gameLoop);
});

document.getElementById('retryBtn').addEventListener('click', () => {
  document.getElementById('resultScreen').classList.add('hidden');
  document.getElementById('hud').classList.add('active');
  initGame(S.role);
  S.G.prevTime = performance.now();
});
