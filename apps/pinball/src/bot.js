/* Páramo Pinball — jugador automático (demo de inicio y selftest)
 * © 2026 Sebastian Sotomontes.
 */
(function (G) {
  'use strict';
  const PB = (G.PB = G.PB || {});
  function makeBot(rand) {
    rand = rand || Math.random;
    let pullT = 0;
    return function tick(g, dt) {
      const near = { L: false, R: false };
      for (const b of g.world.balls) {
        if (b.y > 780 && b.y < 930 && b.vy > -200) { if (b.x < 280 && b.x > 120) near.L = true; if (b.x >= 280 && b.x < 440) near.R = true; }
      }
      const fl = g.world.flippers;
      for (const [k, f] of [['L', fl[0]], ['R', fl[1]]]) {
        f.heldT = f.pressed ? (f.heldT || 0) + dt : 0;
        const want = f.heldT > 1.5 ? false : f.pressed ? near[k] || rand() < 0.8 : near[k] && rand() < 0.25;
        g.flip(k, want);
      }
      if (g.world.balls.some((b) => g.inLane(b) && b.y > 900 && Math.abs(b.vy) < 5)) {
        if (!g.plungerHeld) { g.plunger(true); pullT = 0.35 + rand() * 0.65; }
      }
      if (g.plungerHeld && g.plungerPull >= pullT) g.plunger(false);
    };
  }
  PB.makeBot = makeBot;
  if (typeof module !== 'undefined') module.exports = makeBot;
})(typeof globalThis !== 'undefined' ? globalThis : window);
