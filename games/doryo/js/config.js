/** @fileoverview Game constants, color palette, and map configuration. */

export const DBG_FOG_OFF = false;

export const TILE = 40;
export const MAP_W = 72;
export const MAP_H = 52;

export const K_SPD = 142;
export const S_SPD = K_SPD * 0.95;
export const SP_SPD = K_SPD * 1.50;
export const GEN_COUNT = 7;
export const GEN_GOAL = 5;
export const UNHOOK_R = 52;
export const ACT_RANGE = 52;
export const TERROR_R = 380;

export const MAP_CFG = {
  mainBuilding: { w: 10, h: 8 },
  killerShack: { w: 5, h: 4 },
  mazeTileW: 6, mazeTileH: 5,
  mazeMin: 12, mazeMax: 16,
  genMinDist: 11,
  hookMinDist: 8,
  hookCount: 12,
};

export const C = {
  wall: '#2a2825', wallFace: '#33302b', wallEdge: '#3e3832',
  floor: '#0e0d0b', floorAlt: '#100f0c',
  survivor: '#4a9eff', killer: '#e05252',
  gen: '#c8a840', genDone: '#5a8850',
  hook: '#7a5c38', hookLit: '#b88848',
  exit: '#4a7a50', basement: '#6a3060',
  fog: 'rgba(0,0,0,0.96)', blood: '#6a0e0e',
};
