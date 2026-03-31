/** @fileoverview Entity base class and character subclasses. */

import { TILE } from './config.js';

export class Entity {
  constructor(wx, wy) {
    this.x = wx;
    this.y = wy;
    this.r = 14;
    this.pathTimer = 0;
    this.nextStep = null;
  }
  get tx() { return Math.floor(this.x / TILE); }
  get ty() { return Math.floor(this.y / TILE); }
}

export class Survivor extends Entity {
  constructor(wx, wy, id, isPlayer) {
    super(wx, wy);
    this.id = id;
    this.isPlayer = isPlayer;
    this.hp = 2;
    this.r = 13;
    this.hooked = false;
    this.hookTimer = 0;
    this.hookCount = 0;
    this.dead = false;
    this.escaped = false;
    this.stamina = 1.0;
    this.sprinting = false;
    this.exhausted = false;
    this.hurtFlash = 0;
    this.repairing = false;
    this.repairTarget = null;
    this.healing = false;
    this.healTarget = null;
    this.healProgress = 0;
    this.downed = false;
    this.downedTimer = 45;
    this.struggle = 0;
    this._prevE = false;
    this._prevSpace = false;
  }
}

export class Killer extends Entity {
  constructor(wx, wy, isPlayer) {
    super(wx, wy);
    this.isPlayer = isPlayer;
    this.r = 16;
    this.hitCooldown = 0;
    this.stunTimer = 0;
    this.carrying = null;
  }
}
