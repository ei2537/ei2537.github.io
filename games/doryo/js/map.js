/**
 * @fileoverview Procedural map generation.
 * Uses XorShift PRNG for deterministic seeded generation.
 */

import { MAP_CFG, GEN_COUNT } from './config.js';

export class MapGen {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.grid = Array.from({ length: h }, () => Array(w).fill(0));

    for (let x = 0; x < w; x++) { this.grid[0][x] = 1; this.grid[h - 1][x] = 1; }
    for (let y = 0; y < h; y++) { this.grid[y][0] = 1; this.grid[y][w - 1] = 1; }

    this.rooms      = [];
    this.genPlaces  = [];
    this.hookPlaces = [];
    this.exitPlaces = [];
    this.basementPos = null;
    this._edgeCache  = null;
  }

  generate(seed) {
    const rng = this._rng(seed);
    const W = this.w, H = this.h;

    const mb = MAP_CFG.mainBuilding;
    const mbX = Math.floor(W / 2 - mb.w / 2);
    const mbY = Math.floor(H / 2 - mb.h / 2);
    this._buildRoom(mbX, mbY, mb.w, mb.h, 'main', rng);
    this.rooms.push({ x: mbX, y: mbY, w: mb.w, h: mb.h, type: 'main' });
    this.genPlaces.push({ x: mbX + Math.floor(mb.w / 2), y: mbY + Math.floor(mb.h / 2) });

    const ks = MAP_CFG.killerShack;
    const corners = [
      { x: 4, y: 4 }, { x: W - ks.w - 4, y: 4 },
      { x: 4, y: H - ks.h - 4 }, { x: W - ks.w - 4, y: H - ks.h - 4 },
    ];
    const shackPos = corners[Math.floor(rng() * 4)];
    this._buildRoom(shackPos.x, shackPos.y, ks.w, ks.h, 'shack', rng);
    this.rooms.push({ x: shackPos.x, y: shackPos.y, w: ks.w, h: ks.h, type: 'shack' });
    this.basementPos = {
      x: shackPos.x + Math.floor(ks.w / 2),
      y: shackPos.y + Math.floor(ks.h / 2),
    };

    const mw = MAP_CFG.mazeTileW, mh = MAP_CFG.mazeTileH, gap = 4;
    const cols = Math.floor((W - 8) / (mw + gap));
    const rows = Math.floor((H - 8) / (mh + gap));
    const cells = [];
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const cx = 4 + gx * (mw + gap);
        const cy = 4 + gy * (mh + gap);
        if (this._overlaps(cx - 2, cy - 2, mw + 4, mh + 4)) continue;
        cells.push({ cx, cy });
      }
    }
    const shuffled = this._shuffle(cells, rng);
    const mazeCount = MAP_CFG.mazeMin + Math.floor(rng() * (MAP_CFG.mazeMax - MAP_CFG.mazeMin + 1));
    shuffled.slice(0, mazeCount).forEach(cell => {
      this._buildMaze(cell.cx, cell.cy, mw, mh, this._mazeType(rng), rng);
      this.rooms.push({ x: cell.cx, y: cell.cy, w: mw, h: mh, type: 'maze' });
    });

    this._placeFiller(rng);
    this._placeGens(rng);
    this._placeHooks(rng);
    this._placeExits(rng);
    this._buildEdgeCache();
    return this;
  }

  _set(x, y) {
    if (x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1) this.grid[y][x] = 1;
  }

  _buildRoom(x, y, w, h, type, rng) {
    for (let tx = x; tx < x + w; tx++) { this._set(tx, y); this._set(tx, y + h - 1); }
    for (let ty = y; ty < y + h; ty++) { this._set(x, ty); this._set(x + w - 1, ty); }

    if (type === 'main') {
      const openings = [
        { tx: x + Math.floor(w * 0.3), ty: y, dir: 'n' },
        { tx: x + Math.floor(w * 0.7), ty: y, dir: 'n' },
        { tx: x, ty: y + Math.floor(h * 0.4), dir: 'w' },
        { tx: x + w - 1, ty: y + Math.floor(h * 0.4), dir: 'e' },
        { tx: x + Math.floor(w / 2), ty: y + h - 1, dir: 's' },
      ];
      this._shuffle(openings, rng).slice(0, 3 + Math.floor(rng() * 2)).forEach(o => {
        this.grid[o.ty][o.tx] = 0;
        if (o.dir === 'n' || o.dir === 's') this.grid[o.ty][o.tx + 1] = 0;
        else this.grid[o.ty + 1][o.tx] = 0;
      });
    } else if (type === 'shack') {
      const wy = rng() > 0.5 ? y : y + h - 1;
      this.grid[wy][x + Math.floor(w * 0.3)] = 0;
      this.grid[y + Math.floor(h / 2)][x + w - 1] = 0;
      this.grid[y + Math.floor(h / 2)][x] = 0;
    }
  }

  _mazeType(rng) {
    const types = ['tl', 'corridor', 'box', 'jungle', 'u_shape', 'i_wall'];
    return types[Math.floor(rng() * types.length)];
  }

  _buildMaze(x, y, w, h, type, rng) {
    const flipX = rng() > 0.5, flipY = rng() > 0.5;
    const fx = tx => flipX ? (x + w - 1 - (tx - x)) : tx;
    const fy = ty => flipY ? (y + h - 1 - (ty - y)) : ty;

    switch (type) {
      case 'tl':
        for (let ty = y; ty < y + Math.floor(h * 0.55); ty++) this._set(fx(x), ty);
        for (let tx = x; tx < x + Math.floor(w * 0.55); tx++) this._set(tx, fy(y));
        break;
      case 'corridor':
        if (flipX) for (let ty = y + 1; ty < y + h - 1; ty++) { this._set(x, ty); this._set(x + w - 1, ty); }
        else for (let tx = x + 1; tx < x + w - 1; tx++) { this._set(tx, y); this._set(tx, y + h - 1); }
        break;
      case 'box': {
        const bx = x + 1, by = y + 1, bw = w - 2, bh = h - 2;
        for (let tx = bx; tx < bx + bw; tx++) { this._set(tx, by); this._set(tx, by + bh - 1); }
        for (let ty = by; ty < by + bh; ty++) { this._set(bx, ty); this._set(bx + bw - 1, ty); }
        this.grid[flipY ? by + bh - 1 : by][bx + Math.floor(bw / 2)] = 0;
        this.grid[by + Math.floor(bh / 2)][flipX ? bx + bw - 1 : bx] = 0;
        break;
      }
      case 'jungle': {
        const mx = x + Math.floor(w / 2), my = y + Math.floor(h / 2);
        for (let ty = y; ty < y + h; ty++) this._set(mx, ty);
        for (let tx = x; tx < x + w; tx++) this._set(tx, my);
        this.grid[flipY ? y + h - 1 : y][mx] = 0;
        this.grid[my][flipX ? x + w - 1 : x] = 0;
        break;
      }
      case 'u_shape': {
        const open = Math.floor(rng() * 4);
        for (let tx = x; tx < x + w; tx++) {
          if (open !== 0) this._set(tx, y);
          if (open !== 1) this._set(tx, y + h - 1);
        }
        for (let ty = y; ty < y + h; ty++) {
          if (open !== 2) this._set(x, ty);
          if (open !== 3) this._set(x + w - 1, ty);
        }
        break;
      }
      case 'i_wall':
        if (flipX) for (let ty = y + 1; ty < y + h - 1; ty++) this._set(x + Math.floor(w / 2), ty);
        else for (let tx = x + 1; tx < x + w - 1; tx++) this._set(tx, y + Math.floor(h / 2));
        break;
    }
  }

  _placeFiller(rng) {
    const floors = [];
    for (let y = 3; y < this.h - 3; y++)
      for (let x = 3; x < this.w - 3; x++)
        if (this.grid[y][x] === 0) floors.push({ x, y });

    const chaseCount = 10 + Math.floor(rng() * 10);
    const shuffled = this._shuffle(floors, rng);
    let placed = 0;

    for (const p of shuffled) {
      if (placed >= chaseCount) break;
      let clear = true;
      for (let dy = -2; dy <= 2 && clear; dy++)
        for (let dx = -2; dx <= 2 && clear; dx++) {
          const ty = p.y + dy, tx = p.x + dx;
          if (ty < 1 || ty >= this.h - 1 || tx < 1 || tx >= this.w - 1 || this.grid[ty][tx] !== 0)
            clear = false;
        }
      if (!clear) continue;

      const t = Math.floor(rng() * 5);
      const s = this._set.bind(this);
      if (t === 0)      { s(p.x, p.y); s(p.x + 1, p.y); s(p.x, p.y + 1); }
      else if (t === 1)  { s(p.x, p.y); s(p.x - 1, p.y); s(p.x, p.y - 1); }
      else if (t === 2)  { s(p.x - 1, p.y); s(p.x, p.y); s(p.x + 1, p.y); }
      else if (t === 3)  { s(p.x, p.y - 1); s(p.x, p.y); s(p.x, p.y + 1); }
      else               { s(p.x, p.y); s(p.x + 1, p.y); s(p.x, p.y - 1); s(p.x - 1, p.y); }
      placed++;
    }

    const debrisCount = Math.floor(floors.length * 0.012);
    this._shuffle(floors, rng).slice(0, debrisCount).forEach(p => {
      let w = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (this.grid[p.y + dy]?.[p.x + dx] === 1) w++;
      if (w === 0) this._set(p.x, p.y);
    });
  }

  _placeGens(rng) {
    const floors = [];
    for (let y = 1; y < this.h - 1; y++)
      for (let x = 1; x < this.w - 1; x++)
        if (this.grid[y][x] === 0) floors.push({ x, y });

    const placed = [...this.genPlaces];
    for (const c of this._shuffle(floors, rng)) {
      if (placed.length >= GEN_COUNT) break;
      const tooClose = placed.some(p => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) < MAP_CFG.genMinDist);
      if (!tooClose) placed.push({ x: c.x, y: c.y });
    }
    this.genPlaces = placed.slice(0, GEN_COUNT);
  }

  _placeHooks(rng) {
    const floors = [];
    for (let y = 1; y < this.h - 1; y++)
      for (let x = 1; x < this.w - 1; x++)
        if (this.grid[y][x] === 0) floors.push({ x, y });

    const placed = [];
    if (this.basementPos) placed.push({ ...this.basementPos, isBasement: true });

    for (const c of this._shuffle(floors, rng)) {
      if (placed.length >= MAP_CFG.hookCount) break;
      const tooClose = placed.some(p => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) < MAP_CFG.hookMinDist);
      if (!tooClose) placed.push({ x: c.x, y: c.y });
    }
    this.hookPlaces = placed;
  }

  _placeExits(rng) {
    const peri = [];
    for (let x = 2; x < this.w - 2; x++) {
      if (this.grid[1][x] === 0) peri.push({ x, y: 0, dir: 'n' });
      if (this.grid[this.h - 2][x] === 0) peri.push({ x, y: this.h - 1, dir: 's' });
    }
    for (let y = 2; y < this.h - 2; y++) {
      if (this.grid[y][1] === 0) peri.push({ x: 0, y, dir: 'w' });
      if (this.grid[y][this.w - 2] === 0) peri.push({ x: this.w - 1, y, dir: 'e' });
    }

    const exits = [];
    for (const p of this._shuffle(peri, rng)) {
      if (exits.length >= 2) break;
      if (!exits.some(e => Math.abs(p.x - e.x) + Math.abs(p.y - e.y) < 20)) exits.push(p);
    }
    this.exitPlaces = exits;
    exits.forEach(e => { this.grid[e.y][e.x] = 0; });
  }

  _buildEdgeCache() {
    this._edgeCache = [];
    for (let ty = 0; ty < this.h; ty++) {
      for (let tx = 0; tx < this.w; tx++) {
        if (this.grid[ty][tx] !== 1) continue;
        const edges = {
          n: !this.isWall(tx, ty - 1), s: !this.isWall(tx, ty + 1),
          w: !this.isWall(tx - 1, ty), e: !this.isWall(tx + 1, ty),
        };
        if (edges.n || edges.s || edges.w || edges.e)
          this._edgeCache.push({ tx, ty, edges });
      }
    }
  }

  _overlaps(rx, ry, rw, rh) {
    return this.rooms.some(r =>
      rx < r.x + r.w + 1 && rx + rw + 1 > r.x &&
      ry < r.y + r.h + 1 && ry + rh + 1 > r.y
    );
  }

  // XorShift PRNG — deterministic pseudo-random from seed
  _rng(seed) {
    let s = (seed || 12345) >>> 0;
    return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0xffffffff; };
  }

  _shuffle(arr, rng) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  isWall(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    return this.grid[ty][tx] === 1;
  }
}
