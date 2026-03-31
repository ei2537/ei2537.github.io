/** @fileoverview All Canvas2D rendering: map, entities, effects, minimap. */

import S from './state.js';
import { TILE, MAP_W, MAP_H, C, TERROR_R } from './config.js';
import { dist } from './physics.js';

export function drawMap() {
  const { ctx, canvas } = S;
  const G = S.G, map = G.map;
  const camX = Math.floor(G.cam.x), camY = Math.floor(G.cam.y);
  const stX = Math.max(0, Math.floor(camX / TILE) - 1);
  const stY = Math.max(0, Math.floor(camY / TILE) - 1);
  const edX = Math.min(MAP_W, Math.ceil((camX + canvas.width) / TILE) + 2);
  const edY = Math.min(MAP_H, Math.ceil((camY + canvas.height) / TILE) + 2);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Floor tiles with fog-of-war
  for (let ty = stY; ty < edY; ty++) {
    for (let tx = stX; tx < edX; tx++) {
      if (map.isWall(tx, ty)) continue;
      const vis = G.fog[ty]?.[tx] ?? 0;
      if (vis < 0.01) continue;
      const sx = tx * TILE - camX, sy = ty * TILE - camY;

      ctx.fillStyle = (tx + ty) % 2 === 0 ? C.floor : C.floorAlt;
      ctx.fillRect(sx, sy, TILE, TILE);
      ctx.strokeStyle = '#161412'; ctx.lineWidth = 0.3;
      ctx.strokeRect(sx, sy, TILE, TILE);

      // Wall shadow projection
      if (map.isWall(tx, ty - 1)) {
        const g = ctx.createLinearGradient(sx, sy, sx, sy + 12);
        g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.fillRect(sx, sy, TILE, 12);
      }
      if (map.isWall(tx - 1, ty)) {
        const g = ctx.createLinearGradient(sx, sy, sx + 10, sy);
        g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.fillRect(sx, sy, 10, TILE);
      }

      if (vis < 1) {
        ctx.globalAlpha = 1 - vis;
        ctx.fillStyle = C.fog; ctx.fillRect(sx, sy, TILE, TILE);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Visible walls with edge highlights
  const visWalls = [];
  for (let ty = stY; ty < edY; ty++)
    for (let tx = stX; tx < edX; tx++) {
      if (!map.isWall(tx, ty)) continue;
      const adj = Math.max(
        G.fog[ty - 1]?.[tx] ?? 0, G.fog[ty + 1]?.[tx] ?? 0,
        G.fog[ty]?.[tx - 1] ?? 0, G.fog[ty]?.[tx + 1] ?? 0
      );
      if (adj > 0.04) visWalls.push({ tx, ty, adj });
    }

  for (const { tx, ty, adj } of visWalls) {
    const wx = tx * TILE - camX, wy = ty * TILE - camY;
    ctx.globalAlpha = Math.min(1, adj + 0.15);
    ctx.fillStyle = C.wallFace; ctx.fillRect(wx, wy, TILE, TILE);
    ctx.fillStyle = C.wallEdge;
    if (!map.isWall(tx, ty - 1)) ctx.fillRect(wx, wy, TILE, 2);
    if (!map.isWall(tx, ty + 1)) ctx.fillRect(wx, wy + TILE - 2, TILE, 2);
    if (!map.isWall(tx - 1, ty)) ctx.fillRect(wx, wy, 2, TILE);
    if (!map.isWall(tx + 1, ty)) ctx.fillRect(wx + TILE - 2, wy, 2, TILE);
  }
  ctx.globalAlpha = 1;
}

export function drawRooms() {
  const { ctx } = S, G = S.G;
  G.map.rooms.forEach(r => {
    if (r.type !== 'main' && r.type !== 'shack') return;
    const sx = r.x * TILE - G.cam.x, sy = r.y * TILE - G.cam.y;
    const vis = G.fog[r.y + Math.floor(r.h / 2)]?.[r.x + Math.floor(r.w / 2)] ?? 0;
    if (vis < 0.03) return;

    ctx.save();
    ctx.globalAlpha = Math.min(0.85, vis);
    if (r.type === 'main') {
      ctx.strokeStyle = '#2e2a22'; ctx.lineWidth = 3;
      ctx.strokeRect(sx + 1.5, sy + 1.5, r.w * TILE - 3, r.h * TILE - 3);
      ctx.fillStyle = 'rgba(28,22,14,0.18)'; ctx.fillRect(sx, sy, r.w * TILE, r.h * TILE);
      ctx.fillStyle = '#252018'; ctx.fillRect(sx, sy, r.w * TILE, 4);
    } else {
      ctx.strokeStyle = '#2a1e14'; ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, r.w * TILE - 2, r.h * TILE - 2);
      ctx.fillStyle = 'rgba(20,14,8,0.22)'; ctx.fillRect(sx, sy, r.w * TILE, r.h * TILE);
    }
    ctx.restore();
  });
}

export function drawGens() {
  const { ctx } = S, G = S.G;
  G.gens.forEach(g => {
    const sx = g.x - G.cam.x, sy = g.y - G.cam.y;
    const vis = G.fog[Math.floor(g.y / TILE)][Math.floor(g.x / TILE)] || 0;
    if (vis < 0.05) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0.3, vis);
    ctx.fillStyle = g.done ? '#1a2a1a' : '#1e1a0a';
    ctx.fillRect(sx - 14, sy - 14, 28, 28);
    ctx.strokeStyle = g.done ? C.genDone : C.gen; ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - 14, sy - 14, 28, 28);

    if (g.done) {
      ctx.fillStyle = C.genDone;
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.fill();
    }

    g.sparks = g.sparks.filter(sp => {
      sp.life -= 0.016;
      if (sp.life > 0) {
        ctx.fillStyle = C.gen;
        ctx.globalAlpha = sp.life / 0.2 * vis;
        ctx.beginPath(); ctx.arc(sp.x - G.cam.x, sp.y - G.cam.y, 2, 0, Math.PI * 2); ctx.fill();
        return true;
      }
      return false;
    });
    ctx.restore();
  });
}

export function drawHooks() {
  const { ctx } = S, G = S.G;
  G.hooks.forEach(h => {
    const sx = h.x - G.cam.x, sy = h.y - G.cam.y;
    const vis = G.fog[Math.floor(h.y / TILE)]?.[Math.floor(h.x / TILE)] || 0;
    if (vis < 0.05) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0.35, vis);
    ctx.strokeStyle = h.occupied ? C.hookLit : (h.isBasement ? C.basement : C.hook);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy + 14); ctx.lineTo(sx, sy - 4);
    ctx.bezierCurveTo(sx, sy - 16, sx + 14, sy - 16, sx + 14, sy - 4);
    ctx.stroke();
    if (h.isBasement) {
      ctx.strokeStyle = C.basement; ctx.lineWidth = 1;
      ctx.strokeRect(sx - 8, sy - 22, 16, 6);
    }
    ctx.restore();
  });
}

export function drawExits() {
  const { ctx } = S, G = S.G;
  G.exits.forEach(e => {
    const sx = e.x - G.cam.x, sy = e.y - G.cam.y;
    const vis = G.fog[Math.floor(e.y / TILE)]?.[Math.floor(e.x / TILE)] || 0;
    const a = e.open ? Math.max(0.6, vis) : vis * 0.25;
    if (a < 0.02) return;

    ctx.save(); ctx.globalAlpha = a;
    const isV = e.dir === 'n' || e.dir === 's';
    const gw = isV ? TILE * 2 : 6, gh = isV ? 6 : TILE * 2;
    ctx.strokeStyle = e.open ? C.exit : C.hook; ctx.lineWidth = 2;
    ctx.strokeRect(sx - gw / 2, sy - gh / 2, gw, gh);

    if (e.open) {
      const grd = ctx.createRadialGradient(sx, sy, 4, sx, sy, TILE * 1.5);
      grd.addColorStop(0, 'rgba(74,122,80,0.35)'); grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(sx, sy, TILE * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
}

function drawBody(sx, sy, headR, bodyW, bodyH, headC, bodyC, outC) {
  const { ctx } = S;
  ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(sx, sy + bodyH * 0.5 + 2, bodyW * 0.7, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = bodyC;
  ctx.beginPath(); ctx.roundRect(sx - bodyW / 2, sy - bodyH * 0.3, bodyW, bodyH, 3); ctx.fill();
  ctx.strokeStyle = outC; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.fillStyle = headC;
  ctx.beginPath(); ctx.arc(sx, sy - bodyH * 0.3 - headR + 1, headR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = outC; ctx.stroke();
}

export function drawSurvs() {
  const { ctx } = S, G = S.G;
  G.survivors.forEach(s => {
    if (s.dead) return;
    if (s.hp < 0 && G.killer.carrying === s.id) return;

    const sx = Math.round(s.x - G.cam.x), sy = Math.round(s.y - G.cam.y);
    const vis = G.fog[s.ty]?.[s.tx] || 0;
    if (G.playerRole === 'killer' && dist(s, G.killer) > 160 && vis < 0.5) return;
    if (vis < 0.05 && !s.isPlayer) return;

    ctx.save();
    if (s.hurtFlash > 0) { ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 16 * (s.hurtFlash / 0.3); }

    if (s.hooked) {
      const bc = s.isPlayer ? '#2a5599' : '#1e3d66';
      ctx.fillStyle = '#000'; ctx.globalAlpha = 0.2;
      ctx.beginPath(); ctx.ellipse(sx, sy + 14, 8, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = bc; ctx.beginPath(); ctx.roundRect(sx - 6, sy - 4, 12, 16, 2); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = bc; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx - 6, sy); ctx.lineTo(sx - 9, sy - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 6, sy); ctx.lineTo(sx + 9, sy - 10); ctx.stroke();
      ctx.fillStyle = s.isPlayer ? '#eeccaa' : '#ccaa88';
      ctx.beginPath(); ctx.arc(sx, sy - 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.stroke();

      const maxTimer = s.hookCount === 1 ? 90 : 45;
      const frac = Math.max(0, Math.min(1, s.hookTimer / maxTimer));
      ctx.strokeStyle = frac > 0.5 ? '#c8a840' : '#cc3333'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(sx, sy, 18, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    } else if (s.downed) {
      const bc = s.isPlayer ? '#2a4488' : '#1e3355';
      ctx.fillStyle = '#000'; ctx.globalAlpha = 0.2;
      ctx.beginPath(); ctx.ellipse(sx, sy + 3, 12, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = bc; ctx.beginPath(); ctx.roundRect(sx - 10, sy - 3, 20, 8, 2); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = s.isPlayer ? '#eeccaa' : '#ccaa88';
      ctx.beginPath(); ctx.arc(sx - 12, sy, 4, 0, Math.PI * 2); ctx.fill();
      const crawl = Math.sin(G.elapsed * 3 + s.id) * 2;
      ctx.strokeStyle = bc; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx + 10, sy); ctx.lineTo(sx + 16 + crawl, sy - 4); ctx.stroke();
      const frac = s.downedTimer / 45;
      ctx.fillStyle = '#222'; ctx.fillRect(sx - 14, sy - 12, 28, 3);
      ctx.fillStyle = frac > 0.3 ? '#cc7722' : '#cc2222'; ctx.fillRect(sx - 14, sy - 12, 28 * frac, 3);
    } else {
      const injured = s.hp === 1;
      const bodyC = injured ? (s.isPlayer ? '#884433' : '#6e3322') : (s.isPlayer ? '#2a55bb' : '#1e3d77');
      const headC = s.isPlayer ? '#eeccaa' : '#ccaa88';
      const outC = injured ? '#551a0a' : '#1a1a2a';
      const bob = Math.sin(G.elapsed * 6 + s.id * 2) * 1.5;
      const tilt = injured ? Math.sin(G.elapsed * 2) * 0.15 : 0;
      ctx.translate(sx, sy); ctx.rotate(tilt); ctx.translate(-sx, -sy);
      drawBody(sx, sy + bob, 5, 12, 14, headC, bodyC, outC);
      ctx.fillStyle = '#111';
      ctx.fillRect(sx - 3, sy - 14 + bob - 3, 2, 2);
      ctx.fillRect(sx + 1, sy - 14 + bob - 3, 2, 2);
      if (injured) {
        ctx.fillStyle = '#881111'; ctx.fillRect(sx + 3, sy - 6 + bob, 2, 4);
        ctx.fillStyle = '#661111'; ctx.fillRect(sx - 4, sy - 2 + bob, 2, 3);
      }
      if (s.isPlayer) {
        ctx.strokeStyle = 'rgba(100,180,255,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, sy + bob, 16, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  });
}

export function drawKiller() {
  const { ctx } = S, G = S.G, k = G.killer;
  const sx = Math.round(k.x - G.cam.x), sy = Math.round(k.y - G.cam.y);

  ctx.save();
  if (k.stunTimer > 0) { ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; ctx.globalAlpha = 0.6; }

  ctx.fillStyle = '#000';
  ctx.globalAlpha = Math.min(ctx.globalAlpha || 1, 0.3);
  ctx.beginPath(); ctx.ellipse(sx, sy + 14, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = k.stunTimer > 0 ? 0.6 : 1;

  ctx.fillStyle = '#1a0808';
  ctx.beginPath(); ctx.roundRect(sx - 8, sy - 8, 16, 18, 3); ctx.fill();
  ctx.strokeStyle = '#331111'; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.fillStyle = '#1a0808';
  ctx.beginPath();
  ctx.moveTo(sx - 8, sy + 6); ctx.lineTo(sx - 11, sy + 14);
  ctx.lineTo(sx + 11, sy + 14); ctx.lineTo(sx + 8, sy + 6);
  ctx.fill();

  ctx.fillStyle = '#aa2222';
  ctx.beginPath(); ctx.arc(sx, sy - 12, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#551111'; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.fillStyle = '#ff3333'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 6;
  ctx.fillRect(sx - 4, sy - 14, 3, 2); ctx.fillRect(sx + 1, sy - 14, 3, 2);
  ctx.shadowBlur = 0;

  const wAngle = Math.sin(G.elapsed * 2) * 0.3;
  ctx.save();
  ctx.translate(sx + 10, sy - 6); ctx.rotate(-0.4 + wAngle);
  ctx.fillStyle = '#666'; ctx.fillRect(-1, -14, 3, 14);
  ctx.fillStyle = '#999'; ctx.fillRect(-4, -16, 10, 3);
  ctx.restore();

  if (k.carrying !== null) {
    const cs = G.survivors[k.carrying];
    const shake = cs && cs.struggle > 10 ? Math.sin(G.elapsed * 20) * 3 * (cs.struggle / 100) : 0;
    const cbc = cs?.isPlayer ? '#2a4488' : '#1e3355';
    ctx.fillStyle = cbc;
    ctx.beginPath(); ctx.roundRect(sx - 12 + shake, sy - 2, 10, 6, 2); ctx.fill();
    ctx.fillStyle = cs?.isPlayer ? '#eeccaa' : '#ccaa88';
    ctx.beginPath(); ctx.arc(sx - 14 + shake, sy + 1, 3, 0, Math.PI * 2); ctx.fill();
    if (cs && cs.struggle > 0) {
      ctx.fillStyle = '#333'; ctx.fillRect(sx - 16, sy - 8, 20, 3);
      ctx.fillStyle = '#ddaa22'; ctx.fillRect(sx - 16, sy - 8, 20 * (cs.struggle / 100), 3);
    }
  }
  ctx.restore();
}

export function drawAlerts() {
  if (S.G.playerRole !== 'killer') return;
  const { ctx } = S, G = S.G;
  G.alerts = G.alerts.filter(a => {
    a.life -= 0.016;
    if (a.life <= 0) return false;
    const sx = a.x - G.cam.x, sy = a.y - G.cam.y;
    ctx.save(); ctx.globalAlpha = Math.min(1, a.life);
    ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 2 + a.life * 2;
    ctx.beginPath(); ctx.arc(sx, sy, 10 + (3.0 - a.life) * 15, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff3333';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 6, sy - 14); ctx.lineTo(sx + 6, sy - 14); ctx.fill();
    ctx.restore();
    return true;
  });
}

// Heartbeat-style terror vignette — intensity scales with killer proximity
export function drawTerror() {
  if (S.G.playerRole !== 'survivor') return;
  const { ctx, canvas } = S, p = S.G.survivors[0];
  if (!p || p.dead || p.escaped) return;

  const d = dist(p, S.G.killer);
  if (d >= TERROR_R) return;

  const intensity = 1 - d / TERROR_R;
  const phase = S.G.elapsed * (1 + intensity * 3) * Math.PI * 2;
  const throb = Math.pow(Math.sin(phase), 4);

  ctx.save();
  const g = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 0,
    canvas.width / 2, canvas.height / 2, canvas.width * 0.8
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(180,0,0,${intensity * 0.4 * throb + intensity * 0.1})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

export function drawSC() {
  const { ctx, canvas } = S, G = S.G;

  if (G.scWarn) {
    const cx = canvas.width / 2, cy = canvas.height / 2 + 60, r = 44;
    const pulse = Math.sin(G.scWarn.pulse * 14) * 0.5 + 0.5;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r + pulse * 6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,200,60,${0.35 + pulse * 0.5})`; ctx.lineWidth = 2 + pulse * 3; ctx.stroke();
    ctx.fillStyle = `rgba(255,200,60,${0.08 + pulse * 0.12})`; ctx.fill();
    ctx.font = "bold 22px 'Josefin Sans',sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255,200,60,${0.5 + pulse * 0.5})`; ctx.fillText('!', cx, cy);
    ctx.restore();
  }

  if (!G.sc) return;
  const sc = G.sc, cx = canvas.width / 2, cy = canvas.height / 2 + 60, r = 40;

  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#222'; ctx.stroke();

  const ts = sc.targetStart * Math.PI * 2 - Math.PI / 2;
  const te = sc.targetEnd * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, ts, te); ctx.lineWidth = 6; ctx.strokeStyle = 'white'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r, ts, ts + 0.03 * Math.PI * 2); ctx.strokeStyle = '#e0b840'; ctx.stroke();

  if (sc.result) {
    ctx.font = "bold 14px 'Josefin Sans', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (sc.result === 'great') { ctx.fillStyle = '#e0b840'; ctx.fillText('GREAT', cx, cy); }
    else if (sc.result === 'good') { ctx.fillStyle = 'white'; ctx.fillText('GOOD', cx, cy); }
    else { ctx.fillStyle = '#ff3333'; ctx.fillText('FAIL', cx, cy); }
  } else {
    const a = sc.progress * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineWidth = 3; ctx.strokeStyle = '#ff3333'; ctx.stroke();
  }
  ctx.restore();
}

export function drawBlood(dt) {
  const { ctx } = S, G = S.G;
  G.blood.forEach(p => {
    p.age = (p.age || 0) + dt;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha * (1 - p.age * 0.15));
    ctx.fillStyle = '#4a0808';
    ctx.fillRect(Math.round(p.x - G.cam.x - p.r), Math.round(p.y - G.cam.y - p.r * 0.4), p.r * 2, p.r);
    ctx.fillStyle = '#5a0e0e';
    ctx.fillRect(Math.round(p.x - G.cam.x - p.r * 0.6), Math.round(p.y - G.cam.y - p.r * 0.2), p.r * 1.2, p.r * 0.6);
    ctx.restore();
  });
  G.blood = G.blood.filter(p => (p.age || 0) < 120);
}

export function drawParts() {
  const { ctx } = S, G = S.G;
  G.particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = (p.life / p.maxLife) * 0.9;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x - G.cam.x, p.y - G.cam.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

function renderMap(mCtx, mw, mh, dotScale) {
  const G = S.G;
  const scaleX = mw / (MAP_W * TILE), scaleY = mh / (MAP_H * TILE);
  mCtx.fillStyle = '#000'; mCtx.fillRect(0, 0, mw, mh);

  for (let ty = 0; ty < MAP_H; ty++)
    for (let tx = 0; tx < MAP_W; tx++) {
      const fv = G.fog[ty]?.[tx] ?? 0;
      if (fv < 0.05) continue;
      mCtx.globalAlpha = Math.min(1, fv + 0.1);
      mCtx.fillStyle = G.map.isWall(tx, ty) ? '#2a2725' : '#333';
      mCtx.fillRect(tx * TILE * scaleX, ty * TILE * scaleY, Math.ceil(TILE * scaleX), Math.ceil(TILE * scaleY));
    }
  mCtx.globalAlpha = 1;

  G.gens.forEach(g => {
    if ((G.fog[Math.floor(g.y / TILE)]?.[Math.floor(g.x / TILE)] ?? 0) < 0.05) return;
    mCtx.fillStyle = g.done ? C.genDone : C.gen;
    mCtx.fillRect(g.x * scaleX - 2 * dotScale, g.y * scaleY - 2 * dotScale, 4 * dotScale, 4 * dotScale);
  });
  G.hooks.forEach(h => {
    if ((G.fog[Math.floor(h.y / TILE)]?.[Math.floor(h.x / TILE)] ?? 0) < 0.05) return;
    mCtx.fillStyle = h.isBasement ? C.basement : '#5a4830';
    mCtx.fillRect(h.x * scaleX - dotScale, h.y * scaleY - dotScale, 2 * dotScale, 2 * dotScale);
  });
  G.exits.forEach(e => {
    if ((G.fog[Math.floor(e.y / TILE)]?.[Math.floor(e.x / TILE)] ?? 0) < 0.05) return;
    mCtx.fillStyle = e.open ? C.exit : '#5a5040';
    mCtx.fillRect(e.x * scaleX - 2 * dotScale, e.y * scaleY - 2 * dotScale, 4 * dotScale, 4 * dotScale);
  });

  const k = G.killer;
  if (G.playerRole === 'killer' || (G.fog[k.ty]?.[k.tx] ?? 0) > 0.3) {
    mCtx.fillStyle = C.killer;
    mCtx.beginPath(); mCtx.arc(k.x * scaleX, k.y * scaleY, 3 * dotScale, 0, Math.PI * 2); mCtx.fill();
  }
  G.survivors.forEach(s => {
    if (s.dead || s.escaped) return;
    if (!s.isPlayer && G.playerRole === 'survivor' && (G.fog[s.ty]?.[s.tx] ?? 0) < 0.3) return;
    mCtx.fillStyle = s.hooked ? C.killer : (s.isPlayer ? '#88bbff' : C.survivor);
    mCtx.beginPath(); mCtx.arc(s.x * scaleX, s.y * scaleY, 2 * dotScale, 0, Math.PI * 2); mCtx.fill();
  });
}

export function drawMinimap() {
  renderMap(S.mmCtx, S.mmCvs.width, S.mmCvs.height, 1);
}

export function drawBigMap() {
  if (!S.G.mapOpen) return;
  const cvs = document.getElementById('bigMap');
  renderMap(cvs.getContext('2d'), cvs.width, cvs.height, 2);
}
