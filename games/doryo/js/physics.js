/**
 * @fileoverview Physics, collision detection, and BFS pathfinding.
 * Uses TypedArrays for zero-allocation BFS to avoid GC pressure.
 */

import { TILE, MAP_W, MAP_H } from './config.js';
import S from './state.js';

export function moveEnt(e, dx, dy, map) {
  const nx = e.x + dx, ny = e.y + dy, r = e.r - 2;
  const corners = (cx, cy) => [
    { x: cx - r, y: cy - r }, { x: cx + r, y: cy - r },
    { x: cx - r, y: cy + r }, { x: cx + r, y: cy + r },
  ];
  if (corners(nx, e.y).every(c => !map.isWall(Math.floor(c.x / TILE), Math.floor(c.y / TILE)))) e.x = nx;
  if (corners(e.x, ny).every(c => !map.isWall(Math.floor(c.x / TILE), Math.floor(c.y / TILE)))) e.y = ny;
}

export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function moveTo(e, tx, ty, speed, dt) {
  const d = Math.hypot(tx - e.x, ty - e.y);
  if (d < 4) return;
  moveEnt(e, (tx - e.x) / d * speed * dt, (ty - e.y) / d * speed * dt, S.G.map);
}

// Pre-allocated TypedArrays — zero GC allocation during BFS
const MAX_NODES = MAP_W * MAP_H;
const bfsQueue  = new Int32Array(MAX_NODES * 3);
const bfsVis    = new Int32Array(MAX_NODES);
const firstX    = new Int32Array(MAX_NODES);
const firstY    = new Int32Array(MAX_NODES);
let bfsMark = 0;

function bfsNext(sx, sy, gx, gy) {
  const stX = Math.floor(sx / TILE), stY = Math.floor(sy / TILE);
  const glX = Math.floor(gx / TILE), glY = Math.floor(gy / TILE);
  if (stX === glX && stY === glY) return { x: gx, y: gy };

  bfsMark++;
  if (bfsMark > 2e9) { bfsMark = 1; bfsVis.fill(0); }

  const W = MAP_W;
  let head = 0, tail = 0;
  bfsQueue[tail++] = stX;
  bfsQueue[tail++] = stY;
  bfsQueue[tail++] = 0;
  bfsVis[stY * W + stX] = bfsMark;

  let foundX = -1, foundY = -1;
  let closestX = stX, closestY = stY;
  let minDiff = Math.abs(stX - glX) + Math.abs(stY - glY);
  const dirs = [0, -1, 0, 1, -1, 0, 1, 0];

  while (head < tail) {
    const cx = bfsQueue[head++], cy = bfsQueue[head++], cd = bfsQueue[head++];
    if (cx === glX && cy === glY) { foundX = cx; foundY = cy; break; }

    const diff = Math.abs(cx - glX) + Math.abs(cy - glY);
    if (diff < minDiff) { minDiff = diff; closestX = cx; closestY = cy; }
    if (cd > 24) continue;

    const pIdx = cy * W + cx;
    const isStart = cx === stX && cy === stY;

    for (let i = 0; i < 8; i += 2) {
      const nx = cx + dirs[i], ny = cy + dirs[i + 1];
      const idx = ny * W + nx;
      if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H &&
          !S.G.map.isWall(nx, ny) && bfsVis[idx] !== bfsMark) {
        bfsVis[idx] = bfsMark;
        firstX[idx] = isStart ? nx : firstX[pIdx];
        firstY[idx] = isStart ? ny : firstY[pIdx];
        bfsQueue[tail++] = nx;
        bfsQueue[tail++] = ny;
        bfsQueue[tail++] = cd + 1;
      }
    }
  }

  const tgX = foundX !== -1 ? foundX : closestX;
  const tgY = foundY !== -1 ? foundY : closestY;
  if (tgX === stX && tgY === stY) return { x: stX * TILE + TILE / 2, y: stY * TILE + TILE / 2 };

  const fi = tgY * W + tgX;
  return { x: firstX[fi] * TILE + TILE / 2, y: firstY[fi] * TILE + TILE / 2 };
}

export function pathTo(e, targetX, targetY, speed, dt) {
  if (e.pathTimer <= 0 || !e.nextStep || dist(e, e.nextStep) <= 4) {
    e.nextStep = bfsNext(e.x, e.y, targetX, targetY);
    e.pathTimer = 0.5;
  } else {
    e.pathTimer -= dt;
  }
  moveTo(e, e.nextStep.x, e.nextStep.y, speed, dt);
}
