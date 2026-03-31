/** @fileoverview Shared mutable state accessed by all modules. */

const S = {
  G: null,
  keys: {},
  canvas: null,
  ctx: null,
  mmCvs: null,
  mmCtx: null,
  running: false,
  role: 'survivor',
  notifyTTL: 0,
};

export default S;
