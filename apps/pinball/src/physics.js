/* Páramo Pinball — motor de física 2D
 * © 2026 Sebastian Sotomontes. Todos los derechos reservados.
 *
 * Modelo: bola puntual con radio; colisionadores = segmentos, círculos y
 * flippers (cápsulas cónicas en rotación). Paso fijo con subpasos para evitar
 * túneles. Funciona en navegador y en Node (selftest).
 */
(function (G) {
  'use strict';
  const PB = (G.PB = G.PB || {});

  const BALL_R = 10;
  const MAX_SPEED = 2700;

  function closestOnSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1e-9;
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return { x: ax + dx * t, y: ay + dy * t, t };
  }

  function seg(ax, ay, bx, by, o) {
    const s = Object.assign({ type: 'seg', ax, ay, bx, by, e: 0.45, friction: 0.02, kick: 0, enabled: true, tag: null, solid: null }, o || {});
    const len = Math.hypot(bx - ax, by - ay) || 1;
    // normal izquierda (para one-way): (dy, -dx)
    s.nx = (by - ay) / len; s.ny = -(bx - ax) / len;
    return s;
  }
  function circle(x, y, r, o) {
    return Object.assign({ type: 'circle', x, y, r, e: 0.5, friction: 0.02, kick: 0, enabled: true, tag: null }, o || {});
  }
  function poly(points, o, closed) {
    const out = [];
    for (let i = 0; i < points.length - 1; i++) out.push(seg(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], o));
    if (closed) { const a = points[points.length - 1], b = points[0]; out.push(seg(a[0], a[1], b[0], b[1], o)); }
    return out;
  }

  function flipper(px, py, len, side, o) {
    // side: 1 = izquierdo (apunta a la derecha), -1 = derecho
    const rest = side === 1 ? 0.52 : Math.PI - 0.52;
    const up = side === 1 ? -0.48 : Math.PI + 0.48;
    return Object.assign({ type: 'flipper', px, py, len, side, r1: 11, r2: 6, rest, up,
      angle: rest, omega: 0, pressed: false, e: 0.35, upSpeed: 26, downSpeed: 16, enabled: true }, o || {});
  }

  function updateFlipper(f, dt) {
    const target = f.pressed && f.enabled ? f.up : f.rest;
    const diff = target - f.angle;
    if (Math.abs(diff) < 1e-4) { f.omega = 0; return; }
    const speed = f.pressed && f.enabled ? f.upSpeed : f.downSpeed;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
    f.omega = step / dt;
    f.angle += step;
  }
  function flipperTip(f) {
    return { x: f.px + Math.cos(f.angle) * f.len, y: f.py + Math.sin(f.angle) * f.len };
  }

  function makeBall(x, y, vx, vy) {
    return { x, y, vx: vx || 0, vy: vy || 0, r: BALL_R, held: null, ramp: null, sensors: new Set(), alive: true, id: Math.random().toString(36).slice(2, 8), lastHit: null };
  }

  /* Respuesta de impacto genérica contra una superficie con velocidad (svx, svy). */
  function respond(b, nx, ny, pen, e, friction, svx, svy) {
    b.x += nx * pen; b.y += ny * pen;
    const rvx = b.vx - svx, rvy = b.vy - svy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 0;
    const tx = rvx - vn * nx, ty = rvy - vn * ny;
    const k = 1 - friction;
    b.vx = svx + tx * k - e * vn * nx;
    b.vy = svy + ty * k - e * vn * ny;
    return -vn;
  }

  function collideSeg(b, s, events) {
    if (!s.enabled) return;
    const q = closestOnSeg(b.x, b.y, s.ax, s.ay, s.bx, s.by);
    let dx = b.x - q.x, dy = b.y - q.y;
    const d2 = dx * dx + dy * dy;
    const R = b.r + (s.thick || 0);
    if (d2 >= R * R) return;
    if (s.solid) {
      // one-way: sólo choca si la bola está del lado indicado y se acerca
      const side = (b.x - s.ax) * s.nx + (b.y - s.ay) * s.ny;
      if (side * s.solid < 0) return;
    }
    let d = Math.sqrt(d2);
    let nx, ny;
    if (d < 1e-6) { nx = s.nx; ny = s.ny; d = 0; } else { nx = dx / d; ny = dy / d; }
    if (s.solid && (nx * s.nx + ny * s.ny) * s.solid < 0) { nx = s.nx * s.solid; ny = s.ny * s.solid; }
    const imp = respond(b, nx, ny, R - d, s.e, s.friction, 0, 0);
    if (imp > 0) {
      if (s.kick && imp > 60) { b.vx += nx * s.kick; b.vy += ny * s.kick; }
      if (s.tag) events.push({ type: 'hit', tag: s.tag, obj: s, ball: b, speed: imp });
    }
  }

  function collideCircle(b, c, events) {
    if (!c.enabled) return;
    const dx = b.x - c.x, dy = b.y - c.y;
    const R = b.r + c.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d, ny = dy / d;
    const imp = respond(b, nx, ny, R - d, c.e, c.friction, 0, 0);
    if (imp > 0 || c.kick) {
      if (c.kick && imp > 20) {
        // bumper activo: impulso radial con velocidad mínima garantizada
        const vn = b.vx * nx + b.vy * ny;
        const add = Math.max(c.kick - vn, 0);
        b.vx += nx * add; b.vy += ny * add;
      }
      if (c.tag && imp > 0) events.push({ type: 'hit', tag: c.tag, obj: c, ball: b, speed: imp });
    }
  }

  function collideFlipper(b, f, events) {
    const tip = flipperTip(f);
    const q = closestOnSeg(b.x, b.y, f.px, f.py, tip.x, tip.y);
    const rad = f.r1 + (f.r2 - f.r1) * q.t;
    const dx = b.x - q.x, dy = b.y - q.y;
    const R = b.r + rad;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) return;
    const d = Math.sqrt(d2) || 1e-6;
    const nx = dx / d, ny = dy / d;
    // velocidad de la superficie en el punto de contacto: ω × r
    const cx = b.x - nx * b.r, cy = b.y - ny * b.r;
    const svx = -f.omega * (cy - f.py), svy = f.omega * (cx - f.px);
    const imp = respond(b, nx, ny, R - d, f.e, 0.01, svx, svy);
    if (imp > 0) events.push({ type: 'flipper', obj: f, ball: b, speed: imp });
  }

  function sensorOverlap(b, s) {
    if (s.shape === 'circle') {
      const dx = b.x - s.x, dy = b.y - s.y;
      return dx * dx + dy * dy < (s.r + (s.inner ? 0 : b.r)) ** 2;
    }
    const q = closestOnSeg(b.x, b.y, s.ax, s.ay, s.bx, s.by);
    const dx = b.x - q.x, dy = b.y - q.y;
    return dx * dx + dy * dy < b.r * b.r;
  }

  function clampSpeed(b) {
    const s2 = b.vx * b.vx + b.vy * b.vy;
    if (s2 > MAX_SPEED * MAX_SPEED) { const k = MAX_SPEED / Math.sqrt(s2); b.vx *= k; b.vy *= k; }
  }

  /* Un paso del mundo. world = { balls, colliders, flippers, sensors, gravity } */
  function step(world, dt, substeps) {
    const events = [];
    const h = dt / substeps;
    for (let s = 0; s < substeps; s++) {
      for (const f of world.flippers) updateFlipper(f, h);
      for (const b of world.balls) {
        if (!b.alive || b.held || b.ramp) continue;
        b.vy += world.gravity * h;
        const drag = 1 - 0.08 * h;
        b.vx *= drag; b.vy *= drag;
        b.x += b.vx * h; b.y += b.vy * h;
        for (let it = 0; it < 2; it++) {
          for (const c of world.colliders) c.type === 'seg' ? collideSeg(b, c, events) : collideCircle(b, c, events);
          for (const f of world.flippers) collideFlipper(b, f, events);
        }
        // bola contra bola (multibola)
        for (const o of world.balls) {
          if (o === b || !o.alive || o.held || o.ramp || o.id < b.id) continue;
          const dx = o.x - b.x, dy = o.y - b.y, R = b.r + o.r, d2 = dx * dx + dy * dy;
          if (d2 < R * R && d2 > 1e-6) {
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = (R - d) / 2;
            b.x -= nx * pen; b.y -= ny * pen; o.x += nx * pen; o.y += ny * pen;
            const rv = (o.vx - b.vx) * nx + (o.vy - b.vy) * ny;
            if (rv < 0) { const j = -rv * 0.95; b.vx -= nx * j; b.vy -= ny * j; o.vx += nx * j; o.vy += ny * j; }
          }
        }
        clampSpeed(b);
        for (const sn of world.sensors) {
          if (!sn.enabled) continue;
          const inside = sensorOverlap(b, sn);
          const was = b.sensors.has(sn);
          if (inside && !was) { b.sensors.add(sn); events.push({ type: 'sensor', tag: sn.tag, obj: sn, ball: b }); }
          else if (!inside && was) b.sensors.delete(sn);
        }
      }
    }
    return events;
  }

  PB.phys = { BALL_R, MAX_SPEED, seg, circle, poly, flipper, flipperTip, makeBall, step, closestOnSeg, updateFlipper };
  if (typeof module !== 'undefined') module.exports = PB.phys;
})(typeof globalThis !== 'undefined' ? globalThis : window);
