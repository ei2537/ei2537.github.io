/** @fileoverview Player input handling for survivor and killer roles. */

import S from './state.js';
import { K_SPD, S_SPD, SP_SPD, C, ACT_RANGE, UNHOOK_R } from './config.js';
import { moveEnt, dist } from './physics.js';
import { hit, startSC, checkExits } from './combat.js';
import { emit } from './effects.js';
import { notify } from './hud.js';

export function tickInput(dt) {
  if (S.G.playerRole === 'survivor') tickSurvivorInput(dt);
  else tickKillerInput(dt);
}

function tickSurvivorInput(dt) {
  const G = S.G, s = G.survivors[0], k = G.killer;
  if (!s || s.dead || s.escaped || s.hooked) return;

  // Carried — can only mash space to struggle free
  if (s.hp < 0 && k.carrying === s.id) {
    const sp = S.keys['Space'];
    if (sp && !s._prevSpace) s.struggle = Math.min(100, s.struggle + 9);
    s._prevSpace = sp;
    s.struggle = Math.max(0, s.struggle - 3 * dt);
    if (s.struggle >= 100) {
      k.carrying = null; s.hp = 1; s.downed = false;
      s.struggle = 0; k.stunTimer = 1.5;
      notify('broke free!'); emit(s.x, s.y, C.survivor, 10);
    }
    if (s.hurtFlash > 0) s.hurtFlash -= dt;
    return;
  }

  // Downed — can only crawl
  if (s.downed) {
    const { dx, dy } = readDir();
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      moveEnt(s, dx / len * (S_SPD * 0.1) * dt, dy / len * (S_SPD * 0.1) * dt, G.map);
    }
    if (s.hurtFlash > 0) s.hurtFlash -= dt;
    return;
  }

  const { dx, dy } = readDir();
  const canSprint = S.keys['ShiftLeft'] && !s.exhausted && s.stamina > 0 && (dx || dy);
  s.sprinting = canSprint;

  if (canSprint) {
    s.stamina = Math.max(0, s.stamina - dt / 8.0);
    if (s.stamina <= 0) s.exhausted = true;
  } else if (s.exhausted) {
    s.stamina = Math.min(1.0, s.stamina + dt / 20.0);
    if (s.stamina >= 1.0) s.exhausted = false;
  }

  const base = s.hp === 1 ? S_SPD * 0.95 : S_SPD;
  const speed = canSprint ? SP_SPD : base;
  const len = Math.hypot(dx, dy) || 1;

  if (dx || dy) {
    moveEnt(s, dx / len * speed * dt, dy / len * speed * dt, G.map);
    if (s.repairing || s.healing) {
      s.repairing = false; s.repairTarget = null;
      s.healing = false; s.healTarget = null;
      G.sc = null; G.scWarn = null;
    }
  }

  // E key: interact (edge-triggered)
  const eDown = S.keys['KeyE'];
  if (eDown && !s._prevE) {
    if (s.repairing || s.healing) {
      s.repairing = false; s.repairTarget = null;
      s.healing = false; s.healTarget = null;
      G.sc = null; G.scWarn = null;
    } else {
      const gen = G.gens.find(g => !g.done && dist(s, g) < ACT_RANGE);
      const injuredS = G.survivors.find(o =>
        o.id !== s.id && !o.dead && !o.hooked && !o.downed && o.hp === 1 && dist(s, o) < ACT_RANGE
      );
      if (injuredS) { s.healing = true; s.healTarget = injuredS; }
      else if (gen) { s.repairing = true; s.repairTarget = gen; }

      const hookedS = G.survivors.find(o => o.id !== 0 && o.hooked && dist(s, o) < UNHOOK_R);
      if (hookedS) {
        hookedS.hooked = false; hookedS.hp = 1;
        G.hooks.find(h => h.id === hookedS.hookId).occupied = false;
        emit(hookedS.x, hookedS.y, C.survivor, 12); notify('survivor rescued');
      }
      const downedS = G.survivors.find(o => o.id !== 0 && o.downed && !o.dead && dist(s, o) < UNHOOK_R);
      if (downedS && !hookedS) {
        downedS.downed = false; downedS.hp = 1;
        emit(downedS.x, downedS.y, C.survivor, 12); notify('helped up');
      }
      if (G.exitsOpen) {
        const exit = G.exits.find(e => e.open && dist(s, e) < ACT_RANGE + 10);
        if (exit) { s.escaped = true; G.stats.escapes++; notify('escaped'); }
      }
    }
  }
  s._prevE = eDown;

  // Auto-repair
  if (s.repairing && s.repairTarget) {
    const gen = s.repairTarget;
    if (gen.done || dist(s, gen) >= ACT_RANGE + 10) {
      s.repairing = false; s.repairTarget = null;
    } else if (!G.sc) {
      gen.progress += 1.2 * dt;
      if (Math.random() < 0.008) startSC(gen);
      if (Math.random() < 0.05)
        gen.sparks.push({ x: gen.x + (Math.random() - .5) * 20, y: gen.y + (Math.random() - .5) * 20, life: 0.2 });
      if (gen.progress >= 100 && !gen.done) {
        gen.done = true; G.stats.gensRepaired++;
        emit(gen.x, gen.y, C.genDone, 20); checkExits(); notify('generator repaired');
        G.sc = null; G.scWarn = null;
        s.repairing = false; s.repairTarget = null;
      }
    }
  }

  // Auto-heal
  if (s.healing && s.healTarget) {
    const target = s.healTarget;
    if (target.dead || target.hooked || target.downed || target.hp !== 1 || dist(s, target) >= ACT_RANGE + 10) {
      s.healing = false; s.healTarget = null; target.healProgress = 0;
    } else {
      target.healProgress += 5 * dt;
      if (Math.random() < 0.05) emit(target.x, target.y + 5, '#cfcfcf', 1);
      if (target.healProgress >= 100) {
        target.hp = 2; target.healProgress = 0;
        s.healing = false; s.healTarget = null;
        emit(target.x, target.y, '#5a8850', 20); notify('healed');
      }
    }
  }

  if (s.hurtFlash > 0) s.hurtFlash -= dt;
}

function tickKillerInput(dt) {
  const G = S.G, k = G.killer;
  if (k.hitCooldown > 0) k.hitCooldown -= dt;
  if (k.stunTimer > 0) { k.stunTimer -= dt; if (k.stunTimer > 0) return; }

  const { dx, dy } = readDir();
  const len = Math.hypot(dx, dy) || 1;
  let speed = K_SPD;
  if (k.carrying !== null) {
    const cs = G.survivors[k.carrying];
    speed *= 0.88 - (cs ? cs.struggle / 100 * 0.35 : 0);
  }
  if (dx || dy) moveEnt(k, dx / len * speed * dt, dy / len * speed * dt, G.map);

  if (k.carrying !== null) {
    const cs = G.survivors[k.carrying];
    if (cs) { cs.x = k.x; cs.y = k.y; }

    const hook = G.hooks.filter(h => !h.occupied).sort((a, b) => dist(k, a) - dist(k, b))[0];
    if (hook && dist(k, hook) < 32) {
      const s = G.survivors[k.carrying];
      s.hooked = true; hook.occupied = true; s.hookId = hook.id;
      s.x = hook.x; s.y = hook.y; k.carrying = null; G.stats.hooksAttempted++;
      s.hookCount = (s.hookCount || 0) + 1;
      s.hookTimer = s.hookCount === 1 ? 90 : (s.hookCount === 2 ? 45 : 0);
      emit(hook.x, hook.y, C.killer, 6); notify('survivor hooked');
    }
  }

  if (S.keys['Space'] && k.hitCooldown <= 0 && k.carrying === null) {
    const downed = G.survivors.find(s => s.downed && !s.dead && dist(k, s) < 36);
    if (downed) {
      k.carrying = downed.id; downed.downed = false; downed.hp = -1; notify('picked up');
    } else {
      const t = G.survivors
        .filter(s => !s.dead && !s.escaped && !s.hooked && !s.downed && s.hp >= 0)
        .sort((a, b) => dist(k, a) - dist(k, b))[0];
      if (t && dist(k, t) < k.r + t.r + 20) {
        hit(t); k.hitCooldown = 3.0; k.stunTimer = 3.0; emit(k.x, k.y, C.killer, 6);
      } else {
        emit(k.x + dx * 30, k.y + dy * 30, '#444', 3);
        k.hitCooldown = 3.0; k.stunTimer = 3.0;
      }
    }
  }
}

function readDir() {
  let dx = 0, dy = 0;
  if (S.keys['KeyW'] || S.keys['ArrowUp']) dy -= 1;
  if (S.keys['KeyS'] || S.keys['ArrowDown']) dy += 1;
  if (S.keys['KeyA'] || S.keys['ArrowLeft']) dx -= 1;
  if (S.keys['KeyD'] || S.keys['ArrowRight']) dx += 1;
  return { dx, dy };
}
