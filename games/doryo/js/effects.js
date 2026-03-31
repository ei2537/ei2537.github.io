/** @fileoverview Particle system, blood pools, and alert markers. */

import S from './state.js';
import { notify } from './hud.js';

export function emit(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 30 + Math.random() * 50;
    S.G.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.4, maxLife: 0.8,
      r: 1.5 + Math.random() * 2,
      color, gravity: 50,
    });
  }
}

export function tickParts(dt) {
  S.G.particles = S.G.particles.filter(p => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    return p.life > 0;
  });
}

export function bleed(x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 4 + Math.random() * 12;
    S.G.blood.push({
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d,
      r: 2 + Math.random() * 3,
      alpha: 0.6 + Math.random() * 0.3,
      age: 0,
    });
  }
  emit(x, y, '#6a0e0e', 6);
}

export function addAlert(x, y) {
  S.G.alerts.push({ x, y, life: 2.0 });
  if (S.G.playerRole === 'killer') notify('LOUD NOISE DETECTED');
}
