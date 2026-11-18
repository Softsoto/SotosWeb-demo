/* Páramo Pinball — kit para construir mesas a partir de piezas
 * © 2026 Sebastian Sotomontes.
 * Marco común 600x1000: campo 20..540 (centro x=280), carril del lanzador 540..580.
 */
(function (G) {
  'use strict';
  const PB = (G.PB = G.PB || {});
  const { seg, circle, poly, flipper } = PB.phys;
  const CX = 280;
  const mx = (x) => 2 * CX - x;

  function ellipseArc(cx, cy, rx, ry, a0, a1, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return pts;
  }

  function create() {
    const t = {
      W: 600, H: 1000, CX, colliders: [], sensors: [], flippers: [],
      items: { walls: [], bumpers: [], slings: [], drops: {}, spinners: [], ramps: [], holes: [], lanes: [], targets: [], rollovers: [], labels: [], kickbacks: [], posts: [] },
      launch: { x: 560, y: 948 }, drainY: 1030,
    };
    const I = t.items;
    const k = { t, mx, ellipseArc };

    k.wall = (pts, o) => { t.colliders.push(...poly(pts, Object.assign({ e: 0.4 }, o))); I.walls.push({ pts, style: (o && o.style) || 'wall' }); return pts; };
    k.post = (x, y, r) => { t.colliders.push(circle(x, y, r || 5, { e: 0.45 })); I.posts.push({ x, y, r: r || 5 }); };

    /* Marco: contorno, carril del lanzador, compuerta, parte inferior.
       bottom: 'safeLeft' (la órbita izquierda vuelve al inlane) o 'standard' (dos outlanes). */
    k.frame = (o) => {
      o = o || {};
      const arc = ellipseArc(300, 235, 280, 215, Math.PI, Math.PI * 2, 48);
      t.outline = [[20, 1000], [20, 235], ...arc, [580, 235], [580, 1000]];
      t.colliders.push(...poly(t.outline, { e: 0.4 }));
      t.laneWall = [[540, 1000], [540, 330]];
      t.colliders.push(...poly(t.laneWall, { e: 0.4 }), circle(540, 330, 4, { e: 0.4 }));
      t.gate = seg(580, 300, 540, 330, { e: 0.3, solid: -1 });
      t.colliders.push(t.gate);
      t.plunger = { x0: 542, x1: 578, y: 960 };
      t.colliders.push(seg(542, 960, 578, 960, { e: 0.1 }));

      const guideStd = [[62, 700], [62, 800], [200, 870]];
      const left = o.bottom === 'safeLeft' ? [[20, 630], [52, 700], [52, 800], [200, 870]] : guideStd;
      const right = guideStd.map(([x, y]) => [mx(x), y]);
      k.wall(left); k.wall(right);
      if (o.bottom !== 'safeLeft') k.post(62, 700, 6);
      k.post(mx(62), 700, 6);

      const sl = [[108, 690], [108, 778], [162, 812]];
      for (const side of [1, -1]) {
        const p = side === 1 ? sl : sl.map(([x, y]) => [mx(x), y]);
        const face = seg(p[0][0], p[0][1], p[2][0], p[2][1], { e: 0.5, kick: 520, tag: 'sling', thick: 2 });
        face.idx = I.slings.length;
        t.colliders.push(face, seg(p[0][0], p[0][1], p[1][0], p[1][1], { e: 0.3 }), seg(p[1][0], p[1][1], p[2][0], p[2][1], { e: 0.3 }));
        I.slings.push({ pts: p, face, flash: 0 });
      }
      const ro = (id, x, y, tag) => { const s = { shape: 'circle', x, y, r: 4, tag, id, enabled: true }; t.sensors.push(s); return s; };
      ro('inL', o.bottom === 'safeLeft' ? 80 : 85, 760, 'inlane');
      ro('inR', mx(85), 760, 'inlane');
      ro('outR', mx(41), 820, 'outlane');
      if (o.bottom !== 'safeLeft') ro('outL', 41, 820, 'outlane');
      if (o.kickback) {
        const x = o.kickback === 'L' ? 41 : mx(41);
        const s = { shape: 'circle', x, y: 900, r: 6, tag: 'kickback', id: 'kb' + o.kickback, enabled: true };
        t.sensors.push(s); I.kickbacks.push({ x, y: 900, sensor: s });
      }
      t.flippers.push(flipper(195, 880, 70, 1, { group: 'L' }), flipper(mx(195), 880, 70, -1, { group: 'R' }));
    };

    k.flipper = (x, y, len, side, o) => { const f = flipper(x, y, len, side, Object.assign({ group: side === 1 ? 'L' : 'R', r1: 9, r2: 5 }, o)); t.flippers.push(f); return f; };

    k.bumper = (x, y, r, o) => {
      const c = circle(x, y, r || 24, Object.assign({ e: 0.6, kick: 820, tag: 'bumper', flash: 0 }, o));
      c.idx = I.bumpers.length; t.colliders.push(c); I.bumpers.push(c); return c;
    };

    /* Deflector inclinado desde una pared hasta el extremo de una columna de dianas:
       evita que la bola quede encajada entre la columna y la pared. */
    k.cap = (wallX, x, y) => k.wall([[wallX, y - Math.abs(wallX - x) - 6], [x, y]]);

    k.drops = (id, segs, label, o) => {
      const bank = { id, label, list: [], reset: (o && o.reset) || 2 };
      segs.forEach(([ax, ay, bx, by], i) => {
        const s = seg(ax, ay, bx, by, { e: 0.25, tag: 'drop', bank: id, idx: i, thick: 2 });
        t.colliders.push(s); bank.list.push(s);
      });
      I.drops[id] = bank; return bank;
    };

    k.target = (id, ax, ay, bx, by, label, group) => {
      const s = seg(ax, ay, bx, by, { e: 0.35, tag: 'target', id, thick: 3, lit: false, label, group: group || 'targets' });
      t.colliders.push(s); I.targets.push(s); return s;
    };

    k.spinner = (id, ax, ay, bx, by, label) => {
      const s = { shape: 'seg', ax, ay, bx, by, tag: 'spinner', id, enabled: true, angle: 0, spin: 0, label };
      t.sensors.push(s); I.spinners.push(s); return s;
    };

    /* Rampa: paredes de embocadura + sensor + trayectoria Bézier animada. */
    k.ramp = (id, o) => {
      for (const w of o.walls || []) { k.wall(w, { style: 'ramp' }); k.post(w[0][0], w[0][1], 5); }
      const [ax, ay, bx, by] = o.mouth;
      const s = { shape: 'seg', ax, ay, bx, by, tag: 'ramp', id, enabled: true };
      t.sensors.push(s);
      const r = { id, sensor: s, dir: o.dir, path: o.path, exit: o.exit, dur: o.dur || 0.95, label: o.label, color: o.color };
      I.ramps.push(r); return r;
    };

    k.hole = (id, x, y, o) => {
      o = o || {};
      const s = { shape: 'circle', x, y, r: o.r || 13, inner: true, tag: 'hole', id, enabled: true };
      t.sensors.push(s);
      if (o.back) k.wall(o.back);
      const h = { id, x, y, sensor: s, eject: o.eject || [0, 500], label: o.label, hold: o.hold || 1.3, tunnel: o.tunnel || null };
      I.holes.push(h); return h;
    };

    k.lanes = (posts, y, letters) => {
      for (const x of posts) {
        t.colliders.push(seg(x, y - 32, x, y + 23, { e: 0.35, thick: 3 }), circle(x, y + 23, 5, { e: 0.4 }));
        I.walls.push({ pts: [[x, y - 32], [x, y + 23]], style: 'post' });
      }
      for (let i = 0; i < posts.length - 1; i++) {
        const s = { shape: 'circle', x: (posts[i] + posts[i + 1]) / 2, y, r: 4, tag: 'lane', idx: i, enabled: true, letter: letters[i] };
        t.sensors.push(s); I.lanes.push(s);
      }
    };

    k.rollover = (id, x, y, o) => {
      const s = Object.assign({ shape: 'circle', x, y, r: 5, tag: 'rollover', id, enabled: true }, o);
      t.sensors.push(s); I.rollovers.push(s); return s;
    };
    k.gateSensor = (id, ax, ay, bx, by) => { const s = { shape: 'seg', ax, ay, bx, by, tag: 'rollover', id, enabled: true, hidden: true }; t.sensors.push(s); I.rollovers.push(s); return s; };
    k.label = (x, y, text, o) => I.labels.push(Object.assign({ x, y, text }, o));

    return k;
  }

  PB.kit = { create, ellipseArc, mx, CX };
  PB.tables = PB.tables || {};
  if (typeof module !== 'undefined') module.exports = PB.kit;
})(typeof globalThis !== 'undefined' ? globalThis : window);
