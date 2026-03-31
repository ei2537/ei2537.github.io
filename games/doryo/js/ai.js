/** @fileoverview AI behavior for killer and survivor NPCs. */

import S from './state.js';
import { K_SPD, S_SPD, SP_SPD, C, ACT_RANGE, UNHOOK_R, TERROR_R } from './config.js';
import { dist, pathTo } from './physics.js';
import { hit, checkExits } from './combat.js';
import { emit } from './effects.js';
import { notify } from './hud.js';

export function tickKiller(dt) {
  const G = S.G, k = G.killer;
  if (k.stunTimer > 0) { k.stunTimer -= dt; return; }

  if (!k.aiState) k.aiState = 'patrol';
  if (!k._patrolIdx) k._patrolIdx = 0;
  if (!k._lostTimer) k._lostTimer = 0;

  const alive = G.survivors.filter(s => !s.dead && !s.escaped && !s.hooked);
  if (alive.length === 0) return;

  // Carry survivor to nearest hook
  if (k.carrying !== null) {
    const cs = G.survivors[k.carrying];
    const speed = K_SPD * (0.88 - (cs ? cs.struggle / 100 * 0.35 : 0));
    const hook = G.hooks.filter(h => !h.occupied).sort((a, b) => dist(k, a) - dist(k, b))[0];
    if (hook) {
      pathTo(k, hook.x, hook.y, speed, dt);
      if (cs) { cs.x = k.x; cs.y = k.y; }
      if (dist(k, hook) < 30) {
        cs.hooked = true; hook.occupied = true; cs.hookId = hook.id;
        cs.x = hook.x; cs.y = hook.y; k.carrying = null; G.stats.hooksAttempted++;
        cs.hookCount = (cs.hookCount || 0) + 1;
        cs.hookTimer = cs.hookCount === 1 ? 90 : (cs.hookCount === 2 ? 45 : 0);
        emit(hook.x, hook.y, C.killer, 6);
        notify('hooked');
      }
    }
    return;
  }

  // Pick up downed survivor nearby
  const downed = G.survivors.find(s => s.downed && !s.dead && dist(k, s) < 30);
  if (downed && k.carrying === null) {
    k.carrying = downed.id; downed.downed = false; downed.hp = -1;
    notify('picked up');
    return;
  }

  // Detection
  const visible = alive.filter(s => dist(k, s) < 250);
  const nearest = visible.length > 0 ? visible.reduce((a, b) => dist(k, a) < dist(k, b) ? a : b) : null;

  if (nearest) {
    k.aiState = 'chase'; k._chaseTarget = nearest; k._lostTimer = 5;
  } else if (G.alerts.length > 0 && k.aiState !== 'chase') {
    const a = G.alerts[G.alerts.length - 1];
    k._searchPos = { x: a.x, y: a.y };
    k._searchTimer = 0;
    k._sweepTimer = 0;
    k.aiState = 'search';
  }

  switch (k.aiState) {
    case 'patrol': {
      const gens = G.gens.filter(g => !g.done);
      if (gens.length === 0) { if (alive[0]) pathTo(k, alive[0].x, alive[0].y, K_SPD * 0.8, dt); break; }
      gens.sort((a, b) => b.progress - a.progress);
      const tgt = gens[k._patrolIdx % gens.length];
      pathTo(k, tgt.x, tgt.y, K_SPD * 0.88, dt);
      if (dist(k, tgt) < 60) k._patrolIdx++;
      break;
    }
    case 'search': {
      if (!k._searchPos) { k.aiState = 'patrol'; break; }
      if (!k._searchTimer) k._searchTimer = 0;
      k._searchTimer += dt;

      // Phase 1: move toward alert location
      if (dist(k, k._searchPos) > 50 && k._searchTimer < 6) {
        pathTo(k, k._searchPos.x, k._searchPos.y, K_SPD, dt);
      } else {
        // Phase 2: sweep the area — circle around looking for survivors
        if (!k._sweepTimer) k._sweepTimer = 0;
        k._sweepTimer += dt;
        const ang = k._sweepTimer * 1.2;
        const sweepR = 120;
        const sx = k._searchPos.x + Math.cos(ang) * sweepR;
        const sy = k._searchPos.y + Math.sin(ang) * sweepR;
        pathTo(k, sx, sy, K_SPD * 0.85, dt);

        // Give up after sweeping for a few seconds
        if (k._sweepTimer > 4) {
          k.aiState = 'patrol';
          k._searchPos = null;
          k._searchTimer = 0;
          k._sweepTimer = 0;
          k._patrolIdx++;  // move to next patrol target
        }
      }
      break;
    }
    case 'chase': {
      const t = k._chaseTarget;
      if (!t || t.dead || t.escaped || t.hooked) { k.aiState = 'patrol'; break; }
      if (dist(k, t) > 380) { k._lostTimer -= dt; if (k._lostTimer <= 0) { k.aiState = 'patrol'; break; } }
      else k._lostTimer = 5;
      pathTo(k, t.x, t.y, K_SPD * 1.06, dt);
      if (k.hitCooldown <= 0 && dist(k, t) < k.r + t.r + 12) {
        hit(t); k.hitCooldown = 3.0; k.stunTimer = 3.0;
      }
      if (t.downed && dist(k, t) < 30 && k.carrying === null) {
        k.carrying = t.id; t.downed = false; t.hp = -1; k.aiState = 'patrol';
      }
      break;
    }
  }
  if (k.hitCooldown > 0) k.hitCooldown -= dt;
}

export function tickSurvivors(dt) {
  const G = S.G;
  const actives = G.survivors.filter(o => !o.dead && !o.escaped && !o.hooked && !o.downed && o.hp > 0);
  const needHelp = G.survivors.filter(o => !o.dead && !o.escaped && (o.hooked || o.downed));
  const k = G.killer;

  // Assign rescue role
  let rescuer = null;
  if (needHelp.length > 0) {
    const target = needHelp[0];
    const healthy = actives.filter(o => o.hp === 2);
    const pool = healthy.length > 0 ? healthy : actives;
    if (pool.length > 0) rescuer = pool.sort((a, b) => dist(a, target) - dist(b, target))[0];
  }

  // Assign decoy role
  let decoy = null;
  const inDanger = G.survivors.find(o => !o.dead && !o.escaped && (o.hp < 2 || o.downed) && dist(o, k) < 350);
  if (inDanger) {
    const pool = actives.filter(o => o.id !== inDanger.id && o.hp === 2 && o.stamina > 0.5);
    if (pool.length > 0) decoy = pool.sort((a, b) => dist(a, k) - dist(b, k))[0];
  }

  // Assign healer/patient roles
  let healer = null, patient = null;
  const injured = actives.find(o => o.hp === 1 && actives.some(x => x.id !== o.id && x.hp === 2));
  if (injured && !rescuer && !decoy) {
    patient = injured;
    const pool = actives.filter(o => o.id !== patient.id && o.hp === 2);
    if (pool.length > 0) healer = pool.sort((a, b) => dist(a, patient) - dist(b, patient))[0];
  }

  G.survivors.forEach(s => {
    if (s.isPlayer || s.dead || s.escaped || s.hooked || s.downed || s.hp < 0) return;

    // Role assignment
    if (rescuer && s.id === rescuer.id) { s.aiState = 'rescue'; s._rescueTarget = needHelp[0]; }
    else if (decoy && s.id === decoy.id) s.aiState = 'decoy';
    else if (healer && s.id === healer.id) { s.aiState = 'heal'; s._healTarget = patient; }
    else if (patient && s.id === patient.id && healer) { s.aiState = 'get_healed'; s._healerTarget = healer; }
    else s.aiState = 'repair';

    const dK = dist(s, k);
    const danger = dK <= TERROR_R, critical = dK < 160;

    // Override roles under threat
    if (G.exitsOpen && !danger) s.aiState = 'exit';
    if (critical && s.aiState !== 'decoy') s.aiState = 'flee';
    else if (danger && (s.hp === 1 || s.aiState === 'heal' || s.aiState === 'get_healed') &&
             s.aiState !== 'decoy' && s.aiState !== 'rescue') s.aiState = 'flee';

    // Sprint logic
    const wantSprint = s.aiState === 'flee' || (s.aiState === 'decoy' && critical);
    s.sprinting = wantSprint && !s.exhausted && s.stamina > 0;

    if (s.sprinting) {
      s.stamina = Math.max(0, s.stamina - dt / 8.0);
      if (s.stamina <= 0) s.exhausted = true;
    } else if (s.exhausted) {
      s.stamina = Math.min(1.0, s.stamina + dt / 20.0);
      if (s.stamina >= 1.0) s.exhausted = false;
    }

    const base = s.hp === 1 ? S_SPD * 0.95 : S_SPD;
    const spd = s.sprinting ? SP_SPD : base;

    switch (s.aiState) {
      case 'repair': {
        const gen = G.gens.filter(g => !g.done).sort((a, b) => dist(s, a) - dist(s, b))[0];
        if (gen) {
          if (dist(s, gen) > ACT_RANGE - 10) pathTo(s, gen.x, gen.y, spd * 0.85, dt);
          else {
            gen.progress += 1.2 * dt;
            if (gen.progress >= 100 && !gen.done) {
              gen.done = true; emit(gen.x, gen.y, C.genDone, 12); G.stats.gensRepaired++; checkExits();
            }
          }
        }
        break;
      }
      case 'flee': {
        const ang = Math.atan2(s.y - k.y, s.x - k.x) + Math.sin(G.elapsed * 2.5 + s.id * 1.7) * 0.7;
        pathTo(s, s.x + Math.cos(ang) * 200, s.y + Math.sin(ang) * 200, spd, dt);
        if (!danger) s.aiState = s.hp === 1 ? 'hide' : 'repair';
        break;
      }
      case 'hide':
        if (!danger) s.aiState = 'repair';
        else if (critical) s.aiState = 'flee';
        break;
      case 'rescue': {
        const t = s._rescueTarget;
        if (!t || (!t.hooked && !t.downed) || t.dead) { s.aiState = 'repair'; break; }
        if (dK < 120) { s.aiState = 'flee'; break; }
        if (dist(s, t) < UNHOOK_R) {
          if (t.hooked) { t.hooked = false; t.hp = 1; G.hooks.find(h => h.id === t.hookId).occupied = false; }
          else if (t.downed) { t.downed = false; t.hp = 1; }
          emit(t.x, t.y, C.survivor, 8); s.aiState = 'repair';
        } else pathTo(s, t.x, t.y, spd, dt);
        break;
      }
      case 'decoy':
        if (dK < 150) {
          const ang = Math.atan2(s.y - k.y, s.x - k.x);
          pathTo(s, s.x + Math.cos(ang) * 200, s.y + Math.sin(ang) * 200, spd, dt);
        } else if (dK > 350) {
          pathTo(s, k.x, k.y, spd, dt);
        } else {
          const ang = Math.atan2(s.y - k.y, s.x - k.x) + Math.PI / 2;
          pathTo(s, s.x + Math.cos(ang) * 50, s.y + Math.sin(ang) * 50, spd * 0.7, dt);
        }
        if (s.hp === 1 || s.exhausted) s.aiState = 'flee';
        break;
      case 'exit': {
        if (critical) { s.aiState = 'flee'; break; }
        const exit = G.exits.filter(e => e.open).sort((a, b) => dist(s, a) - dist(s, b))[0];
        if (exit) {
          if (dist(s, exit) < ACT_RANGE) { s.escaped = true; G.stats.escapes++; emit(s.x, s.y, C.survivor, 16); }
          else pathTo(s, exit.x, exit.y, spd, dt);
        }
        break;
      }
      case 'heal': {
        const tgt = s._healTarget;
        if (!tgt || tgt.hp !== 1 || danger) { s.aiState = 'repair'; break; }
        if (dist(s, tgt) > ACT_RANGE - 10) pathTo(s, tgt.x, tgt.y, spd * 0.85, dt);
        else {
          tgt.healProgress += 5 * dt;
          if (Math.random() < 0.05) emit(tgt.x, tgt.y + 5, '#cfcfcf', 1);
          if (tgt.healProgress >= 100) {
            tgt.hp = 2; tgt.healProgress = 0; s.aiState = 'repair';
            emit(tgt.x, tgt.y, '#5a8850', 20); notify('healed');
          }
        }
        break;
      }
      case 'get_healed':
        if (!s._healerTarget || s.hp !== 1 || danger) { s.aiState = 'repair'; break; }
        if (dist(s, s._healerTarget) > 100) pathTo(s, s._healerTarget.x, s._healerTarget.y, spd * 0.85, dt);
        break;
    }
  });
}
