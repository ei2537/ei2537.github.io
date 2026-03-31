/** @fileoverview Combat mechanics: damage, skill checks, and exit gate logic. */

import S from './state.js';
import { C, GEN_GOAL } from './config.js';
import { emit, bleed, addAlert } from './effects.js';
import { notify } from './hud.js';

export function hit(s) {
  if (s.dead || s.hooked || s.downed) return;
  s.hp--;
  s.hurtFlash = 0.3;
  bleed(s.x, s.y);
  if (s.hp <= 0) {
    s.downed = true;
    s.downedTimer = 45;
    s.hp = 0;
    s.repairing = false;
    s.repairTarget = null;
  }
}

export function checkExits() {
  if (S.G.gens.filter(g => g.done).length >= GEN_GOAL) {
    S.G.exitsOpen = true;
    S.G.exits.forEach(e => e.open = true);
    notify('exit gates open');
    S.G.exits.forEach(e => emit(e.x, e.y, C.exit, 20));
  }
}

// Skill check — a timed QTE that appears during generator repair
export function startSC(gen) {
  S.G.scWarn = { gen, timer: 0.75, pulse: 0 };
}

function activateSC(gen) {
  S.G.scWarn = null;
  const start = 0.5 + Math.random() * 0.3;
  S.G.sc = {
    gen, active: true, progress: 0,
    targetStart: start, targetEnd: start + 0.12,
    spacePressed: false, result: null,
  };
}

function successSC(isGreat) {
  const sc = S.G.sc;
  sc.result = isGreat ? 'great' : 'good';
  sc.delay = 0.5;
  sc.gen.progress += isGreat ? 6 : 3;
  emit(sc.gen.x, sc.gen.y, isGreat ? '#e0b840' : '#fff', 5);
}

function failSC() {
  const sc = S.G.sc;
  sc.result = 'fail';
  sc.delay = 0.5;
  sc.gen.progress = Math.max(0, sc.gen.progress - 5);
  emit(sc.gen.x, sc.gen.y, '#f00', 15);
  addAlert(sc.gen.x, sc.gen.y);
  const s = S.G.survivors[0];
  if (s) { s.repairing = false; s.repairTarget = null; }
}

export function tickSC(dt) {
  if (S.G.scWarn) {
    S.G.scWarn.timer -= dt;
    S.G.scWarn.pulse += dt;
    if (S.G.scWarn.timer <= 0) activateSC(S.G.scWarn.gen);
  }
  if (!S.G.sc) return;

  const sc = S.G.sc;
  if (sc.result) {
    sc.delay -= dt;
    if (sc.delay <= 0) S.G.sc = null;
    return;
  }

  sc.progress += dt * 0.9;
  if (sc.progress > 1.0) {
    failSC();
  } else if (S.keys['Space'] && !sc.spacePressed) {
    sc.spacePressed = true;
    if (sc.progress >= sc.targetStart && sc.progress <= sc.targetEnd)
      successSC(sc.progress <= sc.targetStart + 0.03);
    else failSC();
  }
}
