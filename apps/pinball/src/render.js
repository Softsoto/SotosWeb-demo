/* Páramo Pinball — render "mesa física": materiales, volumen y perspectiva
 * © 2026 Sebastian Sotomontes.
 * Se dibuja la mesa plana en un buffer (600x1000) y luego se proyecta inclinada
 * (warp de perspectiva por franjas) sobre el canvas visible.
 */
(function (G) {
  'use strict';
  const PB = (G.PB = G.PB || {});

  /* ---------------- utilidades ---------------- */
  function poly(ctx, pts, close) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close) ctx.closePath();
  }
  function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(hex, a) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; }
  function shade(hex, f) { // f>0 aclara, f<0 oscurece
    const c = hexRgb(hex).map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function bez(p, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
  }
  function bezPts(p, n) { const out = []; for (let i = 0; i <= n; i++) out.push(bez(p, i / n)); return out; }
  function offsetPath(pts, d) {
    return pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [p[0] - dy / l * d, p[1] + dx / l * d];
    });
  }
  function hslHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
    return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  /* ---------------- texturas CC0 (ambientCG) ---------------- */
  const TEX = {};
  function loadTextures(base) {
    const names = ['wood', 'metal', 'grass', 'sheetmetal', 'paper', 'planks'];
    if (typeof Image === 'undefined') return Promise.resolve();
    return Promise.all(names.map((n) => new Promise((res) => {
      const img = new Image();
      img.onload = () => { TEX[n] = img; res(); };
      img.onerror = () => res();
      img.src = (base || 'assets/textures/') + n + '.jpg';
    })));
  }
  /* rellena el trazo/área actual con una textura (o no hace nada si no cargó) */
  function texPattern(ctx, name, scale) {
    const img = TEX[name]; if (!img) return null;
    const p = ctx.createPattern(img, 'repeat');
    if (p && p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(scale || 0.5));
    return p;
  }

  function mkCanvas(w, h) {
    return (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  }

  /* ---------------- materiales ---------------- */
  const M = {
    fast: false,
    shadow(ctx, fn, dx, dy, blur, alpha) {
      if (M.fast) {
        // piezas móviles: sombra desplazada sin desenfoque (mucho más barata por fotograma)
        ctx.save(); ctx.translate(dx == null ? 4 : dx, dy == null ? 6 : dy); ctx.globalAlpha = (alpha == null ? 0.55 : alpha) * 0.55;
        fn(); ctx.restore(); return;
      }
      ctx.save(); ctx.shadowColor = `rgba(0,0,0,${alpha == null ? 0.55 : alpha})`; ctx.shadowBlur = blur == null ? 8 : blur;
      ctx.shadowOffsetX = dx == null ? 4 : dx; ctx.shadowOffsetY = dy == null ? 6 : dy; fn(); ctx.restore();
    },
    /* raíl con bisel: sombra, canto oscuro, cuerpo y brillo */
    rail(ctx, pts, th, w, close) {
      w = w || 9;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      M.shadow(ctx, () => { poly(ctx, pts, close); ctx.strokeStyle = th.railDark; ctx.lineWidth = w + 3; ctx.stroke(); }, 3, 6, 6, 0.6);
      poly(ctx, pts, close); ctx.strokeStyle = th.rail; ctx.lineWidth = w; ctx.stroke();
      const mp = texPattern(ctx, 'metal', 0.25);
      if (mp) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; poly(ctx, pts, close); ctx.strokeStyle = mp; ctx.lineWidth = w; ctx.stroke(); ctx.restore(); }
      ctx.save(); ctx.translate(-w * 0.18, -w * 0.22);
      poly(ctx, pts, close); ctx.strokeStyle = th.railLight; ctx.lineWidth = Math.max(1.5, w * 0.28); ctx.stroke();
      ctx.restore();
    },
    chrome(ctx, pts, w) {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      M.shadow(ctx, () => { poly(ctx, pts); ctx.strokeStyle = '#3c4148'; ctx.lineWidth = w + 2; ctx.stroke(); }, 3, 7, 5, 0.5);
      poly(ctx, pts); ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = w; ctx.stroke();
      ctx.save(); ctx.translate(-0.6, -1); poly(ctx, pts); ctx.strokeStyle = '#f4f8fc'; ctx.lineWidth = Math.max(1, w * 0.35); ctx.stroke(); ctx.restore();
    },
    post(ctx, x, y, r, th) {
      M.shadow(ctx, () => { ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.fillStyle = '#16181b'; ctx.fill(); }, 2, 4, 4, 0.6);
      const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, 0.5, x, y, r + 1);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, th.rubberPost || '#c8ccd2'); g.addColorStop(1, '#5d636b');
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    },
    /* lente de inserto: vidrio tintado; encendido = luz difusa cálida */
    lens(ctx, x, y, r, color, on, label, shape) {
      ctx.save();
      const path = () => {
        ctx.beginPath();
        if (shape === 'diamond') { ctx.moveTo(x, y - r * 1.25); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.25); ctx.lineTo(x - r, y); ctx.closePath(); }
        else if (shape === 'arrow') { ctx.moveTo(x, y - r * 1.5); ctx.lineTo(x + r, y + r * 0.6); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x - r, y + r * 0.6); ctx.closePath(); }
        else ctx.arc(x, y, r, 0, Math.PI * 2);
      };
      if (on) {
        const halo = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 3.2);
        halo.addColorStop(0, rgba(color, 0.55)); halo.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = halo; ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
      }
      path();
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0.5, x, y, r * 1.3);
      if (on) { g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, shade(color, 0.45)); g.addColorStop(1, color); }
      else { g.addColorStop(0, shade(color, -0.35)); g.addColorStop(1, shade(color, -0.78)); }
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.4, r * 0.35, r * 0.2, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = on ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)'; ctx.fill();
      if (label) {
        ctx.font = `800 ${Math.round(r * 1.05)}px "Trebuchet MS", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = on ? 'rgba(40,20,0,0.85)' : 'rgba(255,255,255,0.55)'; ctx.fillText(label, x, y + 0.5); ctx.textBaseline = 'alphabetic';
      }
      ctx.restore();
    },
    decal(ctx, text, x, y, size, color, rot) {
      ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
      ctx.font = `800 ${size}px "Trebuchet MS", sans-serif`; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillText(text, 1.2, 1.6);
      ctx.fillStyle = color; ctx.fillText(text, 0, 0); ctx.restore();
    },
  };

  /* ---------------- arte para los fondos de cada mesa ---------------- */
  const A = {
    poly,
    rgba, shade,
    /* aplica una textura real sobre la zona ya pintada (path opcional) */
    texture(ctx, name, alpha, mode, pathFn, scale) {
      const p = texPattern(ctx, name, scale || 0.6); if (!p) return;
      ctx.save();
      if (pathFn) { pathFn(); ctx.clip(); }
      ctx.globalCompositeOperation = mode || 'multiply'; ctx.globalAlpha = alpha;
      ctx.fillStyle = p; ctx.fillRect(0, 0, 600, 1000);
      ctx.restore();
    },
    noise(ctx, t, alpha, seed) {
      let s = seed || 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 9000; i++) { const v = r() > 0.5 ? 255 : 0; ctx.fillStyle = `rgba(${v},${v},${v},${alpha * r()})`; ctx.fillRect(r() * t.W, r() * t.H, 1.5, 1.5); }
    },
    stars(ctx, t, n, maxY, seed) {
      let s = seed || 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < n; i++) {
        const x = r() * t.W, y = r() * maxY, rr = r() * 1.6 + 0.4, a = 0.3 + r() * 0.7;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.5); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x - rr * 3, y - rr * 3, rr * 6, rr * 6);
      }
    },
    glow(ctx, x, y, r, color, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); },
    mountain(ctx, pts, top, bottom, snowLine) {
      const ys = pts.map((p) => p[1]); const y0 = Math.min(...ys), y1 = Math.max(...ys);
      const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bottom);
      poly(ctx, pts, true); ctx.fillStyle = g; ctx.fill();
      if (snowLine) {
        ctx.save(); poly(ctx, pts, true); ctx.clip();
        const sg = ctx.createLinearGradient(0, y0, 0, y0 + snowLine); sg.addColorStop(0, 'rgba(245,250,255,0.95)'); sg.addColorStop(1, 'rgba(245,250,255,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, y0, 600, snowLine); ctx.restore();
      }
    },
    title(ctx, text, x, y, color, size) { M.decal(ctx, text, x, y, size || 22, color); },
    frailejon(ctx, x, y, s) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      M.shadow(ctx, () => { ctx.fillStyle = '#5b4a33'; ctx.fillRect(-3, -30, 6, 30); }, 3, 3, 4, 0.4);
      const tg = ctx.createLinearGradient(-3, 0, 3, 0); tg.addColorStop(0, '#8a7350'); tg.addColorStop(1, '#4c3d29'); ctx.fillStyle = tg; ctx.fillRect(-3, -30, 6, 30);
      for (let i = 0; i < 14; i++) {
        const a = -Math.PI / 2 + (i - 6.5) * 0.24, len = 15 + (i % 3) * 2;
        ctx.save(); ctx.translate(0, -32); ctx.rotate(a + Math.PI / 2);
        const lg = ctx.createLinearGradient(0, 0, 0, -len); lg.addColorStop(0, '#6f8c5e'); lg.addColorStop(1, '#c9dcb2');
        ctx.beginPath(); ctx.ellipse(0, -len / 2, 3.2, len / 2, 0, 0, Math.PI * 2); ctx.fillStyle = lg; ctx.fill(); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, -40, 3, 0, Math.PI * 2); ctx.fillStyle = '#f2cf3c'; ctx.fill();
      ctx.restore();
    },
    condor(ctx, x, y, s, color, alpha) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-40, -22, -92, -8);
      ctx.lineTo(-84, -2); ctx.lineTo(-90, 4); ctx.lineTo(-78, 6); ctx.lineTo(-82, 12); ctx.lineTo(-66, 10);
      ctx.quadraticCurveTo(-30, 8, -8, 14); ctx.lineTo(0, 30); ctx.lineTo(8, 14);
      ctx.quadraticCurveTo(30, 8, 66, 10);
      ctx.lineTo(82, 12); ctx.lineTo(78, 6); ctx.lineTo(90, 4); ctx.lineTo(84, -2); ctx.lineTo(92, -8);
      ctx.quadraticCurveTo(40, -22, 0, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(0, -2, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },
  };

  /* materiales por defecto (metal, madera, goma) si la mesa no los define */
  const DEFAULT_THEME = {
    accent: '#ffb347', accent2: '#6fdc6a', cabinet: '#5b3a22', rail: '#b9bec6', railDark: '#262a30', railLight: '#f5f8fb',
    decal: '#f6ead0', apron: '#3d4f62', plastic: '#bfe3ff', plasticSling: '#c8442c', bumper: '#2f6e9c', bumperCap: '#ffd36b',
    rubber: '#b8322a', flipper: '#f3efe6', drop: '#e8b22e', spinner: '#dfe4ea', rubberPost: '#d4d8dd',
  };
  const themeCache = new WeakMap();
  function themeOf(def) {
    let th = themeCache.get(def);
    if (!th) {
      th = Object.assign({}, DEFAULT_THEME);
      for (const [k, v] of Object.entries(def.theme || {})) if (k in DEFAULT_THEME && /^#[0-9a-f]{6}$/i.test(v)) th[k] = v;
      themeCache.set(def, th);
    }
    return th;
  }

  /* ---------------- capa estática (cacheada) ---------------- */
  const cache = new WeakMap();
  function staticLayer(game) {
    const t = game.t;
    let cv = cache.get(t); if (cv) return cv;
    cv = mkCanvas(t.W, t.H);
    const ctx = cv.getContext('2d');
    const th = themeOf(game.def), I = t.items;

    // gabinete (madera / laterales)
    const wood = ctx.createLinearGradient(0, 0, t.W, 0);
    wood.addColorStop(0, shade(th.cabinet, -0.35)); wood.addColorStop(0.5, th.cabinet); wood.addColorStop(1, shade(th.cabinet, -0.35));
    ctx.fillStyle = wood; ctx.fillRect(0, 0, t.W, t.H);
    if (TEX.wood) A.texture(ctx, 'wood', 0.85, 'multiply', null, 0.7);
    else for (let i = 0; i < 70; i++) { ctx.strokeStyle = `rgba(0,0,0,${0.04 + (i % 5) * 0.012})`; ctx.lineWidth = 1; ctx.beginPath(); const y = i * 15 + (i % 3) * 4; ctx.moveTo(0, y); ctx.bezierCurveTo(200, y + 6, 400, y - 6, 600, y + 3); ctx.stroke(); }

    // campo de juego pintado
    ctx.save(); poly(ctx, t.outline, true); ctx.clip();
    game.def.paint(ctx, t, A);
    A.noise(ctx, t, 0.05, 7);
    // luz de ambiente: centro más iluminado, bordes en sombra
    const vg = ctx.createRadialGradient(290, 560, 120, 290, 520, 640);
    vg.addColorStop(0, 'rgba(255,255,255,0.06)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, t.W, t.H);
    // sombra interior del contorno
    M.shadow(ctx, () => { poly(ctx, t.outline, true); ctx.strokeStyle = '#000'; ctx.lineWidth = 14; ctx.stroke(); }, 0, 0, 18, 0.8);
    ctx.restore();

    // canal del lanzador
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(541, 330, 39, 670);

    // agujeros (rebajes con aro metálico)
    for (const h of I.holes) {
      ctx.save();
      const rim = ctx.createRadialGradient(h.x - 5, h.y - 6, 2, h.x, h.y, 21);
      rim.addColorStop(0, '#f0f3f7'); rim.addColorStop(0.6, '#8d959e'); rim.addColorStop(1, '#3a3f45');
      M.shadow(ctx, () => { ctx.beginPath(); ctx.ellipse(h.x, h.y, 20, 16, 0, 0, Math.PI * 2); ctx.fillStyle = rim; ctx.fill(); }, 2, 4, 6, 0.6);
      const hole = ctx.createRadialGradient(h.x + 2, h.y + 3, 1, h.x, h.y, 15);
      hole.addColorStop(0, '#000'); hole.addColorStop(0.7, '#0b0b0b'); hole.addColorStop(1, '#2b2b2b');
      ctx.beginPath(); ctx.ellipse(h.x, h.y, 15, 11.5, 0, 0, Math.PI * 2); ctx.fillStyle = hole; ctx.fill();
      ctx.restore();
      if (h.label) M.decal(ctx, h.label, h.x, h.y + 34, 11, th.decal);
    }

    // paredes / guías como raíles
    M.rail(ctx, t.outline, th, 12);
    M.rail(ctx, t.laneWall, th, 9);
    for (const w of I.walls) M.rail(ctx, w.pts, th, w.style === 'post' ? 7 : 9);
    for (const p of I.posts) M.post(ctx, p.x, p.y, p.r + 1, th);
    // compuerta del lanzador
    M.chrome(ctx, [[t.gate.ax, t.gate.ay], [t.gate.bx, t.gate.by]], 3);

    // etiquetas
    for (const l of I.labels) M.decal(ctx, l.text, l.x, l.y, 11, th.decal, l.rot);
    for (const sp of I.spinners) if (sp.label) M.decal(ctx, sp.label, (sp.ax + sp.bx) / 2, (sp.ay + sp.by) / 2 + 30, 11, th.decal);

    // delantal inferior (apron)
    ctx.save();
    const ap = [[20, 935], [222, 935], [250, 1000], [20, 1000]];
    const ap2 = ap.map(([x, y]) => [560 - x, y]);
    for (const a of [ap, ap2]) {
      M.shadow(ctx, () => { poly(ctx, a, true); ctx.fillStyle = th.apron; ctx.fill(); }, 0, -4, 10, 0.6);
      const ag = ctx.createLinearGradient(0, 935, 0, 1000); ag.addColorStop(0, shade(th.apron, 0.25)); ag.addColorStop(1, shade(th.apron, -0.3));
      poly(ctx, a, true); ctx.fillStyle = ag; ctx.fill();
      A.texture(ctx, 'metal', 0.55, 'overlay', () => poly(ctx, a, true), 0.35);
      ctx.save(); poly(ctx, a, true); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      // tornillos
      for (const [sx, sy] of [[a[0][0] + 12, 946], [a[1][0] - (a === ap ? 14 : -14), 946]]) { const sg = ctx.createRadialGradient(sx - 1, sy - 1, 0.5, sx, sy, 3.5); sg.addColorStop(0, '#fff'); sg.addColorStop(1, '#555'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, Math.PI * 2); ctx.fill(); }
    }
    M.decal(ctx, game.def.name.toUpperCase(), 110, 975, 13, th.decal);
    M.decal(ctx, '© 2026 S. Sotomontes', 450, 975, 9, rgba(th.decal.startsWith('#') ? th.decal : '#ffffff', 0.7));
    ctx.restore();

    cache.set(t, cv);
    return cv;
  }

  /* ---------------- piezas dinámicas ---------------- */
  function drawRampPlastic(ctx, r, th, hotness) {
    const pts = bezPts(r.path, 40);
    const L = offsetPath(pts, 15), R = offsetPath(pts, -15);
    // sombra proyectada de la rampa sobre el campo
    ctx.save(); ctx.translate(8, 14); ctx.globalAlpha = 0.25;
    poly(ctx, L.concat(R.slice().reverse()), true); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    // plástico translúcido
    poly(ctx, L.concat(R.slice().reverse()), true);
    ctx.fillStyle = rgba(th.plastic, 0.28 + hotness * 0.2); ctx.fill();
    // reflejo longitudinal
    ctx.save(); poly(ctx, offsetPath(pts, 6)); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    M.chrome(ctx, L, 3.2); M.chrome(ctx, R, 3.2);
  }

  function drawBumper(ctx, b, th0, hot, time, capColor) {
    const th = capColor ? Object.assign({}, th0, { bumperCap: capColor }) : th0;
    const f = b.flash, x = b.x, y = b.y, r = b.r;
    M.shadow(ctx, () => { ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fillStyle = '#1a1a1a'; ctx.fill(); }, 4, 8, 8, 0.6);
    // faldón (anillo inferior)
    const sk = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, r + 5);
    sk.addColorStop(0, '#f5f5f5'); sk.addColorStop(0.75, '#9a9a9a'); sk.addColorStop(1, '#3d3d3d');
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fillStyle = sk; ctx.fill();
    // cuerpo
    const body = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    body.addColorStop(0, shade(th.bumper, 0.35)); body.addColorStop(0.5, th.bumper); body.addColorStop(1, shade(th.bumper, -0.55));
    ctx.beginPath(); ctx.arc(x, y - 2, r - 1, 0, Math.PI * 2); ctx.fillStyle = body; ctx.fill();
    // tapa con luz
    const lit = f > 0 || hot;
    const cap = ctx.createRadialGradient(x - r * 0.3, y - r * 0.45, 1, x, y - 4, r * 0.8);
    cap.addColorStop(0, '#ffffff'); cap.addColorStop(0.4, lit ? shade(th.bumperCap, 0.6) : shade(th.bumperCap, 0.15)); cap.addColorStop(1, lit ? th.bumperCap : shade(th.bumperCap, -0.5));
    ctx.beginPath(); ctx.arc(x, y - 4, r * 0.72, 0, Math.PI * 2); ctx.fillStyle = cap; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    if (lit) A.glow(ctx, x, y - 4, r * 2.2, th.bumperCap, 0.35 * Math.max(f, hot ? 0.6 : 0));
    // anillo de pateo (aro metálico que baja al golpear)
    ctx.beginPath(); ctx.arc(x, y - 1 + f * 2, r + 1, 0, Math.PI * 2); ctx.strokeStyle = f > 0 ? '#ffffff' : 'rgba(220,225,230,0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
  }

  function drawSling(ctx, s, th) {
    const p = s.pts;
    // base de goma blanca a lo largo de la cara de pateo
    M.shadow(ctx, () => { poly(ctx, p, true); ctx.fillStyle = '#000'; ctx.fill(); }, 4, 7, 8, 0.6);
    const g = ctx.createLinearGradient(p[0][0], p[0][1], p[2][0], p[2][1]);
    g.addColorStop(0, shade(th.plasticSling, 0.35)); g.addColorStop(1, shade(th.plasticSling, -0.35));
    poly(ctx, p, true); ctx.fillStyle = g; ctx.fill();
    // brillo del plástico
    ctx.save(); poly(ctx, p, true); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo((p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2); ctx.fill();
    ctx.restore();
    if (s.flash > 0) A.glow(ctx, (p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2, 50, '#ffffff', 0.35 * s.flash);
    // goma
    const bulge = s.flash * 4;
    const mx = (p[0][0] + p[2][0]) / 2, my = (p[0][1] + p[2][1]) / 2;
    const nx = s.face.nx, ny = s.face.ny, side = ((280 - mx) * nx + (500 - my) * ny) > 0 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.quadraticCurveTo(mx + nx * side * (3 + bulge), my + ny * side * (3 + bulge), p[2][0], p[2][1]);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 3.5; ctx.stroke();
    M.post(ctx, p[0][0], p[0][1], 5, th); M.post(ctx, p[1][0], p[1][1], 5, th); M.post(ctx, p[2][0], p[2][1], 5, th);
  }

  function drawFlipper(ctx, f, th, tilted) {
    const tip = PB.phys.flipperTip(f);
    const a = f.angle, nx = -Math.sin(a), ny = Math.cos(a);
    const shape = (grow) => {
      const r1 = f.r1 + grow, r2 = f.r2 + grow;
      ctx.beginPath();
      ctx.moveTo(f.px + nx * r1, f.py + ny * r1);
      ctx.lineTo(tip.x + nx * r2, tip.y + ny * r2);
      ctx.arc(tip.x, tip.y, r2, a + Math.PI / 2, a - Math.PI / 2, true);
      ctx.lineTo(f.px - nx * r1, f.py - ny * r1);
      ctx.arc(f.px, f.py, r1, a - Math.PI / 2, a + Math.PI / 2, true);
      ctx.closePath();
    };
    M.shadow(ctx, () => { shape(0); ctx.fillStyle = '#000'; ctx.fill(); }, 4, 9, 8, 0.6);
    shape(0); ctx.fillStyle = tilted ? '#555' : th.rubber; ctx.fill();   // goma
    shape(-2.2);
    const g = ctx.createLinearGradient(f.px - nx * f.r1, f.py - ny * f.r1, f.px + nx * f.r1, f.py + ny * f.r1);
    g.addColorStop(0, tilted ? '#777' : '#ffffff'); g.addColorStop(0.55, tilted ? '#666' : th.flipper); g.addColorStop(1, tilted ? '#444' : shade(th.flipper, -0.45));
    ctx.fillStyle = g; ctx.fill();
    const cap = ctx.createRadialGradient(f.px - 2, f.py - 2, 0.5, f.px, f.py, 5);
    cap.addColorStop(0, '#fff'); cap.addColorStop(1, '#6b737c');
    ctx.beginPath(); ctx.arc(f.px, f.py, 4.5, 0, Math.PI * 2); ctx.fillStyle = cap; ctx.fill();
  }

  function drawBall(ctx, b) {
    const x = b.x, y = b.y, r = b.r * (b.ramp ? 1.12 : 1);
    ctx.beginPath(); ctx.ellipse(x + (b.ramp ? 9 : 4), y + (b.ramp ? 15 : 7), r * 0.95, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
    // cromo: reflejo de entorno (cielo claro arriba, campo oscuro abajo)
    const g = ctx.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, '#f7fbff'); g.addColorStop(0.42, '#aeb8c3'); g.addColorStop(0.5, '#4d5560'); g.addColorStop(0.75, '#8d969f'); g.addColorStop(1, '#d4dbe2');
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    const s = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, 0, x - r * 0.35, y - r * 0.45, r * 0.55);
    s.addColorStop(0, 'rgba(255,255,255,1)'); s.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = s; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
  }

  function drawDrop(ctx, d, color, hot, blink) {
    const vertical = Math.abs(d.bx - d.ax) < Math.abs(d.by - d.ay);
    const x0 = Math.min(d.ax, d.bx), y0 = Math.min(d.ay, d.by);
    const L = vertical ? Math.abs(d.by - d.ay) : Math.abs(d.bx - d.ax);
    ctx.save(); ctx.translate(vertical ? x0 : x0, vertical ? y0 : y0); if (vertical) { ctx.rotate(Math.PI / 2); }
    if (!d.enabled) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, -4, L, 8); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(0, -4, L, 8); ctx.restore(); return; }
    M.shadow(ctx, () => { ctx.fillStyle = '#000'; ctx.fillRect(0, -6, L, 12); }, 3, 7, 6, 0.6);
    const g = ctx.createLinearGradient(0, -6, 0, 6);
    const c = hot && blink ? '#ffffff' : color;
    g.addColorStop(0, shade(c, 0.5)); g.addColorStop(0.45, c); g.addColorStop(1, shade(c, -0.5));
    ctx.fillStyle = g; ctx.fillRect(0, -6, L, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(1, -5, L - 2, 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(0, -6, L, 12);
    ctx.restore();
  }

  function drawTarget(ctx, tg, th, hot, blink) {
    const vertical = Math.abs(tg.bx - tg.ax) < Math.abs(tg.by - tg.ay);
    const cx = (tg.ax + tg.bx) / 2, cy = (tg.ay + tg.by) / 2, len = Math.hypot(tg.bx - tg.ax, tg.by - tg.ay);
    ctx.save(); ctx.translate(cx, cy); if (vertical) ctx.rotate(Math.PI / 2);
    M.shadow(ctx, () => { ctx.fillStyle = '#000'; ctx.fillRect(-len / 2, -5, len, 10); }, 3, 6, 5, 0.6);
    const base = tg.lit ? th.accent2 : hot && blink ? shade(th.accent2, 0.2) : shade(th.accent2, -0.55);
    const g = ctx.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, shade(base, 0.45)); g.addColorStop(1, shade(base, -0.4));
    ctx.fillStyle = g; ctx.fillRect(-len / 2, -5, len, 10);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.strokeRect(-len / 2, -5, len, 10);
    ctx.restore();
    if (tg.lit) A.glow(ctx, cx, cy, 30, th.accent2, 0.3);
    if (tg.label) M.decal(ctx, tg.label, cx + (vertical ? (cx < 280 ? 18 : -18) : 0), cy + 5, 12, tg.lit ? '#ffffff' : th.decal);
  }

  function drawSpinner(ctx, sp, th, hot, blink) {
    const len = Math.hypot(sp.bx - sp.ax, sp.by - sp.ay), ang = Math.atan2(sp.by - sp.ay, sp.bx - sp.ax);
    const w = Math.cos(sp.angle);
    ctx.save(); ctx.translate((sp.ax + sp.bx) / 2, (sp.ay + sp.by) / 2); ctx.rotate(ang);
    // soportes
    for (const sx of [-len / 2, len / 2]) { const gp = ctx.createLinearGradient(sx - 3, -6, sx + 3, 6); gp.addColorStop(0, '#eef2f6'); gp.addColorStop(1, '#5c646d'); ctx.fillStyle = gp; ctx.fillRect(sx - 3, -7, 6, 14); }
    // placa giratoria
    const hgt = 3 + 14 * Math.abs(w);
    const g = ctx.createLinearGradient(0, -hgt / 2, 0, hgt / 2);
    const c = hot && blink ? th.accent2 : th.spinner;
    g.addColorStop(0, w > 0 ? shade(c, 0.5) : shade(c, -0.5)); g.addColorStop(1, w > 0 ? shade(c, -0.3) : shade(c, 0.3));
    M.shadow(ctx, () => { ctx.fillStyle = '#000'; ctx.fillRect(-len / 2 + 3, -hgt / 2, len - 6, hgt); }, 2, 5, 4, 0.5);
    ctx.fillStyle = g; ctx.fillRect(-len / 2 + 3, -hgt / 2, len - 6, hgt);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.strokeRect(-len / 2 + 3, -hgt / 2, len - 6, hgt);
    ctx.restore();
  }

  function drawPlunger(ctx, t, pull, th) {
    const pl = t.plunger, x = (pl.x0 + pl.x1) / 2, top = pl.y + pull * 34;
    // muelle
    ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 2.5;
    ctx.beginPath(); for (let i = 0; i <= 10; i++) { const yy = top + 8 + i * ((38 - pull * 30) / 10); ctx.lineTo(i % 2 ? x + 9 : x - 9, yy); } ctx.stroke();
    // vástago
    const rg = ctx.createLinearGradient(x - 4, 0, x + 4, 0); rg.addColorStop(0, '#5d656e'); rg.addColorStop(0.4, '#f4f7fa'); rg.addColorStop(1, '#4b525a');
    ctx.fillStyle = rg; ctx.fillRect(x - 3.5, top, 7, 1000 - top);
    // cabeza
    const hg = ctx.createLinearGradient(0, top - 5, 0, top + 6); hg.addColorStop(0, shade(th.accent, 0.4)); hg.addColorStop(1, shade(th.accent, -0.4));
    M.shadow(ctx, () => { ctx.fillStyle = '#000'; ctx.fillRect(pl.x0 + 3, top - 4, pl.x1 - pl.x0 - 6, 9); }, 1, 3, 3, 0.5);
    ctx.fillStyle = hg; ctx.fillRect(pl.x0 + 3, top - 4, pl.x1 - pl.x0 - 6, 9);
  }

  /* ---------------- dibujo completo (plano) ---------------- */
  function drawFlat(ctx, game, time) {
    const t = game.t, I = t.items, th = themeOf(game.def);
    M.fast = false;
    ctx.drawImage(staticLayer(game), 0, 0);
    M.fast = true;
    const blink = Math.floor(time * 4) % 2 === 0;
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    const hot = (kind, o) => game.hotKind(kind, o);
    const ins = t.inserts || { rankY: 620, multY: 665 };

    const fxAge = (kind) => { let a = Infinity; for (const f of game.fx || []) if (f.kind === kind) a = Math.min(a, game.time - f.t0); return a; };
    const chase = Math.floor(time * 8);
    const rainbow = fxAge('lanes') < 1.6;

    // insertos (bajo las piezas)
    I.lanes.forEach((l, i) => {
      const skill = game.skillArmed && game.skillLane === i;
      const col = rainbow ? hslHex((time * 600 + i * 120) % 360, 90, 55) : skill ? '#ffffff' : th.accent;
      M.lens(ctx, l.x, l.y + 2, 9, col, rainbow || game.lanes[i] || (skill && blink), l.letter);
      if (hot('lane', l) && !game.lanes[i]) M.lens(ctx, l.x, l.y + 40, 6, th.accent2, blink, null, 'arrow');
    });
    const idleChase = game.state !== 'playing' || (game.missionLit && !game.mission);
    for (let i = 0; i < game.ranks.length; i++) {
      const x = 280 + (i - (game.ranks.length - 1) / 2) * 27;
      M.lens(ctx, x, ins.rankY, 7, th.accent, game.rank >= i || (idleChase && chase % game.ranks.length === i), null, 'diamond');
    }
    for (let i = 2; i <= 6; i++) M.lens(ctx, 280 + (i - 4) * 31, ins.multY, 10, th.accent2, game.mult >= i, '×' + i);
    const saving = game.ballSaveStarted && game.ballSave > 0;
    M.lens(ctx, 280, 925, 9, th.accent2, saving && (game.ballSave > 3 || blink), '★');
    M.lens(ctx, 280, ins.multY + 34, 8, th.accent, game.missionLit && !game.mission && pulse > 0.4, 'M');
    for (const r of I.ramps) {
      const s = r.sensor, mxp = (s.ax + s.bx) / 2 - r.dir[0] * 62, myp = (s.ay + s.by) / 2 - r.dir[1] * 62;
      const jack = game.multiball && game.R.jackpot === 'ramp:' + r.id;
      const lockArm = game.R.multiball && game.R.multiball.type === 'lock' && game.R.multiball.lightEv === 'ramp:' + r.id && !game.lockLit;
      // tres flechas en secuencia (chase) cuando la rampa es objetivo
      const live = hot('ramp', r) || jack;
      for (let k = 0; k < 3; k++) {
        ctx.save(); ctx.translate(mxp + r.dir[0] * k * 17, myp + r.dir[1] * k * 17); ctx.rotate(Math.atan2(r.dir[1], r.dir[0]) + Math.PI / 2);
        M.lens(ctx, 0, 0, 7 - k, jack ? '#ff4040' : hot('ramp', r) ? th.accent2 : th.accent, live ? chase % 3 === k : (lockArm && k === 0), null, 'arrow');
        ctx.restore();
      }
      if (r.label) M.decal(ctx, r.label, mxp - r.dir[0] * 34, myp - r.dir[1] * 34 + 4, 11, th.decal);
    }
    for (const h of I.holes) {
      const isMission = h.id === game.R.missionHole && game.missionLit && !game.mission;
      const isLock = game.R.multiball && game.R.multiball.type === 'lock' && game.R.multiball.hole === h.id && game.lockLit;
      const isJack = game.multiball && game.R.jackpot === 'hole:' + h.id;
      M.lens(ctx, h.x, h.y + 50, 7, isLock || isJack ? '#ff4040' : hot('hole', h) ? th.accent2 : th.accent, isMission || isLock || isJack || hot('hole', h) ? pulse > 0.35 : false, null, 'arrow');
      if (game.R.multiball && game.R.multiball.hole === h.id) for (let i = 0; i < game.R.multiball.locks; i++) M.lens(ctx, h.x - 22 + i * 44, h.y + 50, 5, '#ff4040', game.locked > i);
    }
    for (const kb of I.kickbacks) M.lens(ctx, kb.x, kb.y - 48, 7, '#ff4040', game.kickbackLit, null, 'arrow');

    // piezas
    for (const b of Object.values(I.drops)) { const hb = hot('drop', b.list[0]); for (const d of b.list) drawDrop(ctx, d, th.drop, hb, blink); }
    for (const tg of I.targets) drawTarget(ctx, tg, th, hot('target', tg), blink);
    for (const sp of I.spinners) drawSpinner(ctx, sp, th, hot('spinner', sp), blink);
    for (const s of I.slings) drawSling(ctx, s, th);
    const BUMPER_COLORS = ['#ffd36b', '#6fdc6a', '#58d8ff', '#c77dff', '#ff6b6b'];
    const capCol = game.multiball ? hslHex((time * 240) % 360, 85, 60) : BUMPER_COLORS[(game.bumperLevel - 1) % BUMPER_COLORS.length];
    for (const b of I.bumpers) drawBumper(ctx, b, th, hot('bumper', b) && blink, time, capCol);
    for (const f of t.flippers) drawFlipper(ctx, f, th, game.tilted);
    drawPlunger(ctx, t, game.plungerPull, th);

    // túnel: luces que recorren el trayecto subterráneo
    if (game.tunnelFx && game.time - game.tunnelFx.t0 < game.tunnelFx.dur) {
      const { from, to, t0, dur } = game.tunnelFx, p = (game.time - t0) / dur;
      for (let k = 0; k < 6; k++) {
        const q = p - k * 0.06; if (q < 0 || q > 1) continue;
        const x = from.x + (to.x - from.x) * q, y = from.y + (to.y - from.y) * q;
        A.glow(ctx, x, y, 26 - k * 3, th.accent2, 0.55 - k * 0.08);
      }
    }

    // bolas en el campo, después rampas (plástico encima), luego bolas en rampa
    for (const b of game.world.balls) if (!b.ramp && !b.hidden) { if (b.held && b.held.locked) { ctx.save(); ctx.globalAlpha = 0.6; drawBall(ctx, b); ctx.restore(); } else drawBall(ctx, b); }
    for (const r of I.ramps) drawRampPlastic(ctx, r, th, hot('ramp', r) ? pulse : 0);
    for (const b of game.world.balls) if (b.ramp) drawBall(ctx, b);

    // iluminación general (GI): cambia de color según el modo de juego
    let gi = null;
    if (game.tilted) gi = ['#000000', 0.45];
    else if (game.multiball) gi = [hslHex((time * 90) % 360, 80, 50), 0.22];
    else if (game.mission) gi = [game.mission.def.wizard ? '#ffd36b' : ['#58d8ff', '#6fdc6a', '#c77dff'][game.mission.def.tier] || '#58d8ff', 0.16 + 0.05 * Math.sin(time * 3)];
    if (gi) { ctx.save(); ctx.globalCompositeOperation = game.tilted ? 'source-over' : 'soft-light'; ctx.globalAlpha = gi[1]; ctx.fillStyle = gi[0]; ctx.fillRect(0, 0, 600, 1000); ctx.restore(); }

    // destellos de eventos
    for (const f of game.fx || []) {
      const age = game.time - f.t0; if (age > 0.9) continue;
      ctx.save();
      if (f.kind === 'sweep') { const y = 1000 - age / 0.9 * 1100; const g = ctx.createLinearGradient(0, y - 80, 0, y + 80); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, rgba(f.color || '#ffffff', 0.45)); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, y - 80, 600, 160); }
      else if (f.kind === 'flash') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - age / 0.9) * 0.35; ctx.fillStyle = f.color || '#ffffff'; ctx.fillRect(0, 0, 600, 1000); }
      ctx.restore();
    }

    if (game.tilted) M.decal(ctx, 'TILT', 280, 520, 70, `rgba(255,70,70,${0.5 + pulse * 0.5})`);
  }

  /* ---------------- proyección inclinada ---------------- */
  let buf = null, bctx = null;
  const VIEW = { tilt: true, top: 0.8, squash: 0.86 };
  // relación v(fuente 0..1) <-> y(pantalla 0..1) con ancho lineal w(v) = top + (1-top)·v
  function yOfV(v, s) { return (s * v + (1 - s) * v * v / 2) / (s + (1 - s) / 2); }
  function vOfY(y, s) { const k = s + (1 - s) / 2, a = (1 - s) / 2; if (a < 1e-6) return y; return (-s + Math.sqrt(s * s + 4 * a * y * k)) / (2 * a); }

  function draw(ctx, game, time, out) {
    // out = { w, h } en píxeles reales del canvas
    const scale = out.scaleX;
    if (!VIEW.tilt) { ctx.setTransform(scale, 0, 0, scale, 0, 0); drawFlat(ctx, game, time); return; }
    const bw = Math.round(600 * scale), bh = Math.round(1000 * scale);
    if (!buf || buf.width !== bw || buf.height !== bh) { buf = mkCanvas(bw, bh); bctx = buf.getContext('2d'); }
    bctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawFlat(bctx, game, time);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#050608'; ctx.fillRect(0, 0, out.w, out.h);
    const H = out.h, W = out.w, s = VIEW.top;
    const step = 2;
    for (let y = 0; y < H; y += step) {
      const v0 = vOfY(y / H, s), v1 = vOfY(Math.min(1, (y + step) / H), s);
      const w = W * (s + (1 - s) * v0);
      const sy = v0 * bh, sh = Math.max(1, (v1 - v0) * bh);
      ctx.drawImage(buf, 0, sy, bw, sh, (W - w) / 2, y, w, step + 0.5);
    }
    // sombra de profundidad en la parte alta
    const fog = ctx.createLinearGradient(0, 0, 0, H * 0.35); fog.addColorStop(0, 'rgba(0,0,0,0.35)'); fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H * 0.35);
  }
  /* Pantalla -> coordenadas de mesa (para el táctil) */
  function screenToTable(x, y, W, H) {
    if (!VIEW.tilt) return [x / W * 600, y / H * 1000];
    const v = vOfY(y / H, VIEW.top), w = W * (VIEW.top + (1 - VIEW.top) * v);
    return [((x - (W - w) / 2) / w) * 600, v * 1000];
  }

  PB.render = { draw, drawFlat, VIEW, screenToTable, loadTextures, aspect: () => (VIEW.tilt ? VIEW.squash : 1) };
  PB.art = A;
})(typeof globalThis !== 'undefined' ? globalThis : window);
