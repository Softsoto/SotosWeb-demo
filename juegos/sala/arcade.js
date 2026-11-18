/* Copia de la Sala clásica de sotomontes-web/arcade/arcade.js para Sotos, con <arcade-solo> al final. */
/* <arcade-cabinet> — sala arcade con 5 juegos en canvas: come-cocos, bloques, invasores, pong, ladrillos */
(function () {
  if (customElements.get('arcade-cabinet')) return;
  const W = 520, H = 600;

  class SFX {
    constructor() { this.ctx = null; this.muted = false; }
    ensure() { if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); } }
    beep(freq, dur = 0.06, type = 'square', vol = 0.03) {
      if (this.muted) return;
      try {
        this.ensure(); if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur);
      } catch (e) { }
    }
    sweep(f1, f2, dur = 0.2, vol = 0.03) {
      if (this.muted) return;
      try {
        this.ensure(); if (!this.ctx) return;
        const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur);
      } catch (e) { }
    }
  }

  function txt(ctx, s, x, y, size, color, align = 'left', weight = 800) {
    ctx.fillStyle = color; ctx.font = weight + ' ' + size + 'px Archivo, monospace';
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawPattern(ctx, pat, x, y, cell, color) {
    ctx.fillStyle = color;
    for (let r = 0; r < pat.length; r++) for (let c = 0; c < pat[r].length; c++)
      if (pat[r][c] === 'X') ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
  }
  function getHS(k) { try { return +localStorage.getItem('arcade-hs-' + k) || 0; } catch (e) { return 0; } }
  function setHS(k, v) { try { localStorage.setItem('arcade-hs-' + k, String(v)); } catch (e) { } }
  function getDiff() { try { return Math.min(2, Math.max(0, +localStorage.getItem('arcade-diff') || 1)); } catch (e) { return 1; } }
  function setDiff(v) { try { localStorage.setItem('arcade-diff', String(v)); } catch (e) { } }
  const DIFF_NAMES = ['FÁCIL', 'NORMAL', 'DIFÍCIL'];

  function pauseCheck(g, e) {
    if (e.hit('KeyP')) { g.paused = !g.paused; e.sfx.beep(g.paused ? 220 : 330, 0.06); }
    return g.paused;
  }
  function drawPause(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
    txt(ctx, 'PAUSA', W / 2, H / 2 - 12, 36, '#f3f2f2', 'center');
    txt(ctx, 'P continuar · ESC menú', W / 2, H / 2 + 30, 14, '#9b9797', 'center');
  }
  function drawOver(ctx, title, sub, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
    txt(ctx, title, W / 2, H / 2 - 20, 34, color || '#ec3013', 'center');
    txt(ctx, sub, W / 2, H / 2 + 18, 15, '#f3f2f2', 'center');
    txt(ctx, 'ENTER continuar · ESC menú', W / 2, H / 2 + 46, 14, '#9b9797', 'center');
  }

  class Engine {
    constructor(canvas, sfx) {
      this.cv = canvas; this.ctx = canvas.getContext('2d'); this.sfx = sfx;
      this.keys = new Set(); this.pressed = new Set(); this.clicks = []; this.rightClicks = []; this.mouseX = W / 2;
      this.scene = null; this.last = 0; this.raf = 0; this.toastMsg = null; this.toastT = 0;
    }
    setScene(s) { this.scene = s; }
    down(c) { return this.keys.has(c); }
    hit(c) { return this.pressed.has(c); }
    takeClicks() { const c = this.clicks; this.clicks = []; return c; }
    takeRightClicks() { const c = this.rightClicks; this.rightClicks = []; return c; }
    toast(m) { this.toastMsg = m; this.toastT = 1.4; }
    start() {
      const loop = (t) => {
        const dt = Math.min((t - this.last) / 1000, 0.05); this.last = t;
        const ctx = this.ctx;
        ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, W, H);
        if (this.scene) { this.scene.update(dt, this); if (this.scene) this.scene.draw(ctx, this); }
        if (this.toastT > 0) { this.toastT -= dt; txt(ctx, this.toastMsg, W / 2, H - 14, 13, '#9b9797', 'center'); }
        this.pressed.clear(); this.mouseMoved = false;
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
    stop() { cancelAnimationFrame(this.raf); }
  }

  /* ============================== MENÚ ============================== */
  class Menu {
    constructor(eng, defs, launch) { this.defs = defs; this.launch = launch; this.sel = 0; this.t = 0; this.rects = []; }
    update(dt, e) {
      this.t += dt;
      const n = this.defs.length;
      if (e.hit('ArrowUp') || e.hit('KeyW')) { this.sel = (this.sel + n - 1) % n; e.sfx.beep(320, 0.05); }
      if (e.hit('ArrowDown') || e.hit('KeyS')) { this.sel = (this.sel + 1) % n; e.sfx.beep(280, 0.05); }
      if (e.hit('ArrowLeft') || e.hit('KeyA')) { setDiff((getDiff() + 2) % 3); e.sfx.beep(360, 0.05); }
      if (e.hit('ArrowRight') || e.hit('KeyD')) { setDiff((getDiff() + 1) % 3); e.sfx.beep(400, 0.05); }
      if (e.hit('Enter') || e.hit('Space')) { e.sfx.sweep(200, 700, 0.25); this.launch(this.sel); return; }
      for (const c of e.takeClicks()) {
        this.rects.forEach((r, i) => {
          if (c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h) {
            if (this.sel === i) { e.sfx.sweep(200, 700, 0.25); this.launch(i); }
            else { this.sel = i; e.sfx.beep(320, 0.05); }
          }
        });
      }
    }
    draw(ctx) {
      const blink = Math.floor(this.t * 2) % 2 === 0;
      txt(ctx, 'GAME ROOM', W / 2, 42, 36, '#ec3013', 'center');
      txt(ctx, '· EASTER EGG · 7 JUEGOS ·', W / 2, 72, 13, '#9b9797', 'center');
      this.rects = [];
      this.defs.forEach((d, i) => {
        const y = 112 + i * 52, selected = i === this.sel;
        const r = { x: 70, y: y - 20, w: W - 140, h: 42 }; this.rects.push(r);
        if (selected) {
          ctx.strokeStyle = '#ec3013'; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
          if (blink) txt(ctx, '►', r.x - 24, y, 18, '#ec3013');
        }
        txt(ctx, d.name, r.x + 16, y - 6, 17, selected ? '#f3f2f2' : '#7d7979');
        txt(ctx, d.desc, r.x + 16, y + 12, 10, selected ? '#9b9797' : '#605d5d');
        txt(ctx, d.hs > 0 ? 'HI ' + d.hs : '', r.x + r.w - 14, y, 12, '#605d5d', 'right');
      });
      const dn = DIFF_NAMES[getDiff()];
      txt(ctx, '◄ DIFICULTAD: ' + dn + ' ►', W / 2, 494, 15, '#f2c94c', 'center');
      txt(ctx, '↑↓ elegir · ←→ dificultad · ENTER jugar · P pausa en partida', W / 2, 520, 12, '#9b9797', 'center');
      if (blink) txt(ctx, 'INSERTA UNA FICHA', W / 2, 546, 14, '#f2c94c', 'center');
      const px = ((this.t * 60) % (W + 80)) - 40;
      ctx.fillStyle = '#ffd23c'; ctx.beginPath();
      const m = Math.abs(Math.sin(this.t * 8)) * 0.7;
      ctx.moveTo(px, 578); ctx.arc(px, 578, 9, m * 0.5, Math.PI * 2 - m * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffb897';
      for (let i = 1; i < 8; i++) { const dx = px + 30 + i * 26; if (dx < W) ctx.fillRect(dx, 576, 4, 4); }
    }
  }

  /* ============================== PONG ============================== */
  class Pong {
    constructor(e, exit) {
      this.e = e; this.exit = exit; this.hsKey = 'pong'; this.diff = getDiff();
      this.ph = 90; this.pw = 12; this.lvl = 1; this.paused = false;
      this.startMatch();
    }
    startMatch() {
      this.py = H / 2; this.ay = H / 2; this.ps = 0; this.as = 0;
      this.state = 'play'; this.rally = 0;
      this.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, sp: 300 };
      this.serve(Math.random() < 0.5 ? 1 : -1);
    }
    aiSpeed() { return [175, 230, 285][this.diff] + (this.lvl - 1) * 28 + Math.min(120, this.rally * 10); }
    serve(dir) {
      this.ball.sp = 280 + this.lvl * 18; this.rally = 0;
      const a = (Math.random() * 0.9 - 0.45);
      this.ball.x = W / 2; this.ball.y = H / 2;
      this.ball.vx = Math.cos(a) * this.ball.sp * dir; this.ball.vy = Math.sin(a) * this.ball.sp;
      this.serveT = 0.9;
    }
    update(dt, e) {
      if (e.hit('Escape')) { this.exit(); return; }
      if (this.state === 'over') { if (e.hit('Enter')) { this.lvl = 1; this.startMatch(); } return; }
      if (this.state === 'won') { if (e.hit('Enter')) { this.lvl++; this.startMatch(); } return; }
      if (pauseCheck(this, e)) return;
      const spd = 400;
      if (e.down('ArrowUp') || e.down('KeyW')) this.py -= spd * dt;
      if (e.down('ArrowDown') || e.down('KeyS')) this.py += spd * dt;
      this.py = Math.max(this.ph / 2 + 6, Math.min(H - this.ph / 2 - 6, this.py));
      const target = this.ball.vx > 0 ? this.ball.y : H / 2;
      if (Math.abs(target - this.ay) > 10) this.ay += Math.sign(target - this.ay) * this.aiSpeed() * dt;
      this.ay = Math.max(this.ph / 2 + 6, Math.min(H - this.ph / 2 - 6, this.ay));
      if (this.serveT > 0) { this.serveT -= dt; return; }
      const b = this.ball;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < 12 || b.y > H - 12) { b.vy = Math.abs(b.vy) * (b.y < 12 ? 1 : -1); b.y = Math.max(12, Math.min(H - 12, b.y)); e.sfx.beep(220, 0.05); }
      const hitPad = (px, py) => Math.abs(b.x - px) < this.pw / 2 + 6 && Math.abs(b.y - py) < this.ph / 2 + 7;
      if (b.vx < 0 && hitPad(28, this.py)) this.bounce(this.py, 1, e);
      if (b.vx > 0 && hitPad(W - 28, this.ay)) this.bounce(this.ay, -1, e);
      if (b.x < -20) { this.as++; e.sfx.sweep(300, 120, 0.3); this.checkEnd(); if (this.state === 'play') this.serve(-1); }
      if (b.x > W + 20) { this.ps++; e.sfx.sweep(300, 600, 0.3); this.checkEnd(); if (this.state === 'play') this.serve(1); }
    }
    bounce(py, dir, e) {
      const b = this.ball, rel = Math.max(-1, Math.min(1, (b.y - py) / (this.ph / 2)));
      b.sp = Math.min(660, b.sp * 1.05); this.rally++;
      const a = rel * 0.85;
      b.vx = Math.cos(a) * b.sp * dir; b.vy = Math.sin(a) * b.sp;
      b.x = dir === 1 ? 28 + this.pw / 2 + 7 : W - 28 - this.pw / 2 - 7;
      e.sfx.beep(440 + this.rally * 15, 0.05);
    }
    checkEnd() {
      if (this.ps >= 7) { this.state = 'won'; if (this.lvl > getHS(this.hsKey)) setHS(this.hsKey, this.lvl); }
      else if (this.as >= 7) { this.state = 'over'; }
    }
    draw(ctx) {
      ctx.fillStyle = '#2d2b2b'; for (let y = 10; y < H; y += 24) ctx.fillRect(W / 2 - 2, y, 4, 12);
      txt(ctx, String(this.ps), W / 2 - 60, 50, 42, '#f3f2f2', 'center');
      txt(ctx, String(this.as), W / 2 + 60, 50, 42, '#f3f2f2', 'center');
      txt(ctx, 'NIVEL ' + this.lvl, W / 2, 96, 13, '#f2c94c', 'center');
      ctx.fillStyle = '#f3f2f2';
      ctx.fillRect(28 - this.pw / 2, this.py - this.ph / 2, this.pw, this.ph);
      ctx.fillRect(W - 28 - this.pw / 2, this.ay - this.ph / 2, this.pw, this.ph);
      ctx.fillRect(this.ball.x - 6, this.ball.y - 6, 12, 12);
      txt(ctx, 'TÚ', 28, H - 16, 11, '#605d5d', 'center');
      txt(ctx, 'CPU NV.' + this.lvl, W - 40, H - 16, 11, '#605d5d', 'center');
      if (this.state === 'won') drawOver(ctx, '¡NIVEL ' + this.lvl + ' SUPERADO!', 'La CPU sube de nivel', '#f2c94c');
      if (this.state === 'over') drawOver(ctx, 'GANA LA CPU', 'Llegaste al nivel ' + this.lvl + ' · HI ' + Math.max(this.lvl, getHS(this.hsKey)));
      if (this.paused) drawPause(ctx);
    }
  }

  /* ============================== LADRILLOS (breakout neón) ============================== */
  const BK_COLORS = ['#ff2e63', '#ff7a2e', '#ffd166', '#3ae374', '#17c0eb', '#7d5fff'];
  const DROPS = [
    { t: 'EXP', c: '#3ae374', w: 26 }, { t: 'MUL', c: '#17c0eb', w: 26 },
    { t: 'FUE', c: '#ff7a2e', w: 20 }, { t: 'LEN', c: '#7d5fff', w: 20 }, { t: 'VID', c: '#ff2e63', w: 8 }
  ];
  class Breakout {
    constructor(e, exit) {
      this.e = e; this.exit = exit; this.hsKey = 'bricks'; this.diff = getDiff();
      this.score = 0; this.lives = [4, 3, 3][this.diff]; this.level = 1; this.paused = false;
      this.padWBase = [106, 88, 74][this.diff]; this.padW = this.padWBase; this.padX = W / 2;
      this.baseSpeed = [255, 295, 340][this.diff];
      this.expandT = 0; this.fireT = 0;
      this.drops = []; this.particles = []; this.msgs = [];
      this.build(); this.resetBalls();
    }
    layout(lv) {
      const pat = (lv - 1) % 5, mask = [];
      for (let r = 0; r < 6; r++) { mask.push([]); for (let c = 0; c < 10; c++) {
        let on = true;
        if (pat === 1) on = (r + c) % 2 === 0;
        if (pat === 2) on = Math.abs(c - 4.5) <= r + 0.6;
        if (pat === 3) on = c !== 2 && c !== 7;
        if (pat === 4) on = Math.abs(c - 4.5) + Math.abs(r - 2.5) <= 4.6;
        mask[r].push(on);
      } }
      return mask;
    }
    build() {
      this.bricks = [];
      const mask = this.layout(this.level);
      const armored = Math.min(2, Math.floor((this.level - 1) / 2));
      for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) {
        if (!mask[r][c]) continue;
        this.bricks.push({ x: 22 + c * 48, y: 78 + r * 21, w: 44, h: 17, row: r, hp: r < armored ? 2 : 1 });
      }
      this.speed = Math.min(560, this.baseSpeed + (this.level - 1) * 22);
    }
    resetBalls() {
      this.state = 'stick'; this.fireT = 0;
      this.balls = [{ x: this.padX, y: 548, vx: 0, vy: 0, trail: [] }];
    }
    spawnDrop(x, y) {
      if (Math.random() > 0.16) return;
      const total = DROPS.reduce((s, d) => s + d.w, 0);
      let n = Math.random() * total, pick = DROPS[0];
      for (const d of DROPS) { n -= d.w; if (n <= 0) { pick = d; break; } }
      this.drops.push({ x, y, type: pick.t, color: pick.c });
    }
    burst(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160;
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.5 + Math.random() * 0.3, color });
      }
    }
    apply(type, e) {
      const label = { EXP: 'PALETA XL', MUL: 'MULTIBOLA', FUE: 'BOLA DE FUEGO', LEN: 'CÁMARA LENTA', VID: '+1 VIDA' }[type];
      this.msgs.push({ s: label, t: 1.2 });
      e.sfx.sweep(400, 900, 0.25);
      if (type === 'EXP') this.expandT = 12;
      if (type === 'VID') this.lives++;
      if (type === 'FUE') this.fireT = 8;
      if (type === 'LEN') for (const b of this.balls) {
        const sp = Math.hypot(b.vx, b.vy); if (sp > 210) { b.vx *= 210 / sp; b.vy *= 210 / sp; }
      }
      if (type === 'MUL') {
        const src = this.balls.slice(0, 2);
        for (const b of src) {
          if (this.balls.length >= 6) break;
          const sp = Math.hypot(b.vx, b.vy) || this.speed, a0 = Math.atan2(b.vy, b.vx);
          for (const off of [-0.5, 0.5]) {
            if (this.balls.length >= 6) break;
            this.balls.push({ x: b.x, y: b.y, vx: Math.cos(a0 + off) * sp, vy: Math.sin(a0 + off) * sp, trail: [] });
          }
        }
      }
    }
    update(dt, e) {
      if (e.hit('Escape')) { this.exit(); return; }
      if (this.state === 'over') {
        if (e.hit('Enter')) { this.score = 0; this.lives = [4, 3, 3][this.diff]; this.level = 1; this.expandT = 0; this.drops = []; this.build(); this.resetBalls(); this.state = 'stick'; }
        return;
      }
      if (this.state === 'nextlvl') {
        if (e.hit('Enter')) { this.level++; this.drops = []; this.expandT = 0; this.build(); this.resetBalls(); }
        return;
      }
      if (pauseCheck(this, e)) return;
      if (this.expandT > 0) this.expandT -= dt;
      if (this.fireT > 0) this.fireT -= dt;
      const targetW = this.expandT > 0 ? this.padWBase * 1.45 : this.padWBase;
      this.padW += (targetW - this.padW) * Math.min(1, dt * 10);
      if (e.down('ArrowLeft') || e.down('KeyA')) this.padX -= 430 * dt;
      if (e.down('ArrowRight') || e.down('KeyD')) this.padX += 430 * dt;
      if (e.mouseMoved) this.padX = e.mouseX;
      this.padX = Math.max(this.padW / 2 + 6, Math.min(W - this.padW / 2 - 6, this.padX));
      if (this.state === 'stick') {
        const b = this.balls[0]; b.x = this.padX; b.y = 548;
        if (e.hit('Space') || e.hit('Enter') || e.takeClicks().length) {
          const a = -Math.PI / 2 + (Math.random() * 0.6 - 0.3);
          b.vx = Math.cos(a) * this.speed; b.vy = Math.sin(a) * this.speed;
          this.state = 'play'; e.sfx.beep(500, 0.06);
        }
      } else {
        for (const b of this.balls) this.stepBall(b, dt, e);
        this.balls = this.balls.filter(b => !b.dead);
        if (this.balls.length === 0) {
          this.lives--; e.sfx.sweep(400, 90, 0.4);
          if (this.lives <= 0) { this.state = 'over'; if (this.score > getHS(this.hsKey)) setHS(this.hsKey, this.score); }
          else this.resetBalls();
        }
        if (this.bricks.length === 0 && this.state === 'play') { this.state = 'nextlvl'; e.sfx.sweep(300, 900, 0.4); }
      }
      for (const d of this.drops) {
        d.y += 130 * dt;
        if (d.y > 550 && d.y < 574 && Math.abs(d.x - this.padX) < this.padW / 2 + 12) { d.dead = true; this.apply(d.type, e); }
      }
      this.drops = this.drops.filter(d => !d.dead && d.y < H + 20);
      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt; }
      this.particles = this.particles.filter(p => p.life > 0);
      this.msgs = this.msgs.filter(m => (m.t -= dt) > 0);
    }
    stepBall(b, dt, e) {
      b.trail.unshift({ x: b.x, y: b.y }); if (b.trail.length > 9) b.trail.pop();
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 4));
      for (let i = 0; i < steps; i++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (b.x < 9) { b.x = 9; b.vx = Math.abs(b.vx); e.sfx.beep(200, 0.04); }
        if (b.x > W - 9) { b.x = W - 9; b.vx = -Math.abs(b.vx); e.sfx.beep(200, 0.04); }
        if (b.y < 46) { b.y = 46; b.vy = Math.abs(b.vy); e.sfx.beep(200, 0.04); }
        if (b.vy > 0 && b.y > 552 && b.y < 568 && Math.abs(b.x - this.padX) < this.padW / 2 + 7) {
          const rel = Math.max(-1, Math.min(1, (b.x - this.padX) / (this.padW / 2)));
          const sp = Math.hypot(b.vx, b.vy), a = -Math.PI / 2 + rel * 1.05;
          b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.y = 551;
          e.sfx.beep(350, 0.05);
        }
        for (const br of this.bricks) {
          if (b.x > br.x - 7 && b.x < br.x + br.w + 7 && b.y > br.y - 7 && b.y < br.y + br.h + 7) {
            const fire = this.fireT > 0;
            br.hp -= fire ? 2 : 1;
            const col = BK_COLORS[br.row];
            if (br.hp <= 0) {
              br.dead = true;
              this.score += (6 - br.row) * 10 + (this.level - 1) * 5;
              this.burst(br.x + br.w / 2, br.y + br.h / 2, col, fire ? 14 : 9);
              this.spawnDrop(br.x + br.w / 2, br.y + br.h / 2);
              e.sfx.beep(600 + (5 - br.row) * 60, 0.05);
            } else { this.burst(b.x, b.y, '#f3f2f2', 4); e.sfx.beep(260, 0.05); }
            if (!fire) {
              const oxl = b.x - (br.x - 7), oxr = (br.x + br.w + 7) - b.x, oyt = b.y - (br.y - 7), oyb = (br.y + br.h + 7) - b.y;
              const m = Math.min(oxl, oxr, oyt, oyb);
              if (m === oxl) b.vx = -Math.abs(b.vx); else if (m === oxr) b.vx = Math.abs(b.vx);
              else if (m === oyt) b.vy = -Math.abs(b.vy); else b.vy = Math.abs(b.vy);
              const spMax = Math.min(580, Math.hypot(b.vx, b.vy) + 5), cur = Math.hypot(b.vx, b.vy);
              b.vx *= spMax / cur; b.vy *= spMax / cur;
            }
            this.bricks = this.bricks.filter(x => !x.dead);
            break;
          }
        }
        if (b.y > H + 16) { b.dead = true; return; }
      }
    }
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0c1024'); g.addColorStop(1, '#131c38');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'; ctx.lineWidth = 1;
      for (let x = 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 80; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      txt(ctx, 'PUNTOS ' + this.score, 14, 22, 15, '#f3f2f2');
      txt(ctx, 'NIVEL ' + this.level, W / 2, 22, 15, '#ffd166', 'center');
      txt(ctx, '', 0, 0, 1, '#000');
      for (let i = 0; i < this.lives; i++) { ctx.fillStyle = '#ff2e63'; ctx.beginPath(); ctx.arc(W - 20 - i * 18, 22, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 42); ctx.lineTo(W, 42); ctx.stroke();
      // ladrillos
      for (const br of this.bricks) {
        const col = BK_COLORS[br.row];
        ctx.shadowColor = col; ctx.shadowBlur = 9;
        ctx.fillStyle = br.hp > 1 ? '#4a5568' : col;
        rrect(ctx, br.x, br.y, br.w, br.h, 4); ctx.fill();
        ctx.shadowBlur = 0;
        if (br.hp > 1) { ctx.strokeStyle = col; ctx.lineWidth = 2; rrect(ctx, br.x + 2, br.y + 2, br.w - 4, br.h - 4, 3); ctx.stroke(); }
        else { ctx.fillStyle = 'rgba(255,255,255,0.25)'; rrect(ctx, br.x + 2, br.y + 2, br.w - 4, 4, 2); ctx.fill(); }
      }
      // power-ups cayendo
      for (const d of this.drops) {
        ctx.shadowColor = d.color; ctx.shadowBlur = 10;
        ctx.fillStyle = '#101426'; rrect(ctx, d.x - 17, d.y - 10, 34, 20, 9); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = d.color; ctx.lineWidth = 2; rrect(ctx, d.x - 17, d.y - 10, 34, 20, 9); ctx.stroke();
        txt(ctx, d.type, d.x, d.y + 1, 10, d.color, 'center');
      }
      // partículas
      for (const p of this.particles) {
        ctx.globalAlpha = Math.max(0, p.life * 2);
        ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
      // paleta
      const pg = ctx.createLinearGradient(this.padX - this.padW / 2, 0, this.padX + this.padW / 2, 0);
      pg.addColorStop(0, '#17c0eb'); pg.addColorStop(0.5, '#f3f2f2'); pg.addColorStop(1, '#17c0eb');
      ctx.shadowColor = '#17c0eb'; ctx.shadowBlur = 14;
      ctx.fillStyle = pg; rrect(ctx, this.padX - this.padW / 2, 556, this.padW, 13, 6); ctx.fill();
      ctx.shadowBlur = 0;
      // bolas con estela
      for (const b of this.balls) {
        const fire = this.fireT > 0, col = fire ? '#ff7a2e' : '#f3f2f2';
        b.trail.forEach((t, i) => {
          ctx.globalAlpha = 0.28 * (1 - i / b.trail.length);
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(t.x, t.y, 6 * (1 - i / b.trail.length), 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.shadowColor = col; ctx.shadowBlur = fire ? 18 : 10;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(b.x, b.y, 6.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
      // estado de poderes
      let ix = 14;
      if (this.expandT > 0) { txt(ctx, 'XL ' + Math.ceil(this.expandT), ix, H - 14, 12, '#3ae374'); ix += 60; }
      if (this.fireT > 0) { txt(ctx, 'FUEGO ' + Math.ceil(this.fireT), ix, H - 14, 12, '#ff7a2e'); }
      for (const m of this.msgs) txt(ctx, m.s, W / 2, 420 - (1.2 - m.t) * 26, 17, '#ffd166', 'center');
      if (this.state === 'stick') txt(ctx, 'ESPACIO lanzar · ←→ o ratón · atrapa los power-ups', W / 2, 440, 13, '#9b9797', 'center');
      if (this.state === 'nextlvl') drawOver(ctx, '¡NIVEL ' + this.level + ' LIMPIO!', 'PUNTOS ' + this.score, '#3ae374');
      if (this.state === 'over') drawOver(ctx, 'FIN DEL JUEGO', 'PUNTOS ' + this.score + ' · HI ' + Math.max(this.score, getHS(this.hsKey)));
      if (this.paused) drawPause(ctx);
    }
  }

  /* ============================== INVASORES ============================== */
  const INV = [
    [["...XX...", "..XXXX..", ".XXXXXX.", "XX.XX.XX", "XXXXXXXX", ".X.XX.X.", "X......X", ".X....X."],
     ["...XX...", "..XXXX..", ".XXXXXX.", "XX.XX.XX", "XXXXXXXX", "..X..X..", ".X.XX.X.", "X.X..X.X"]],
    [["..X....X..", "...X..X...", "..XXXXXX..", ".XX.XX.XX.", "XXXXXXXXXX", "X.XXXXXX.X", "X.X....X.X", "...XX.XX.."],
     ["..X....X..", "X..X..X..X", "X.XXXXXX.X", "XXX.XX.XXX", ".XXXXXXXX.", "..XXXXXX..", "..X....X..", ".X......X."]],
    [["....XX....", "..XXXXXX..", ".XXXXXXXX.", "XXX.XX.XXX", "XXXXXXXXXX", "..XX..XX..", ".XX.XX.XX.", "XX......XX"],
     ["....XX....", "..XXXXXX..", ".XXXXXXXX.", "XXX.XX.XXX", "XXXXXXXXXX", ".XX.XX.XX.", "XX.XXXX.XX", "..X....X.."]]
  ];
  const SHIP = ["....X....", "...XXX...", "...XXX...", ".XXXXXXX.", "XXXXXXXXX", "XXXXXXXXX"];
  const SAUCER = ["...XXXX...", ".XXXXXXXX.", "XXXXXXXXXX", "XX.XX.X.XX", ".XXXXXXXX.", "..X....X.."];

  class Invaders {
    constructor(e, exit) {
      this.e = e; this.exit = exit; this.hsKey = 'invaders'; this.diff = getDiff();
      this.score = 0; this.lives = [4, 3, 3][this.diff]; this.wave = 1; this.state = 'play'; this.paused = false;
      this.px = W / 2; this.bullet = null; this.bombs = []; this.deadT = 0;
      this.saucer = null; this.saucerT = 8 + Math.random() * 8;
      this.popups = [];
      this.newWave();
    }
    newWave() {
      this.aliens = [];
      const types = [0, 1, 1, 2, 2];
      const oy = 90 + Math.min(3, this.wave - 1) * 18;
      for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++)
        this.aliens.push({ c, r, type: types[r], alive: true });
      this.ox = 40; this.oy = oy; this.dir = 1; this.stepT = 0; this.frame = 0; this.beepHi = false;
      this.buildBunkers();
    }
    buildBunkers() {
      this.bunkers = [];
      const xs = [46, 166, 286, 406];
      for (const bx of xs) {
        const cells = new Set();
        for (let r = 0; r < 6; r++) for (let c = 0; c < 12; c++) {
          if (r === 0 && (c < 2 || c > 9)) continue;
          if (r >= 4 && c > 3 && c < 8) continue;
          cells.add(c + ',' + r);
        }
        this.bunkers.push({ x: bx, y: 470, cells });
      }
    }
    alive() { return this.aliens.filter(a => a.alive); }
    alienPos(a) { return { x: this.ox + a.c * 42, y: this.oy + a.r * 36 }; }
    update(dt, e) {
      if (e.hit('Escape')) { this.exit(); return; }
      if (this.state === 'over') { if (e.hit('Enter')) { this.score = 0; this.lives = [4, 3, 3][this.diff]; this.wave = 1; this.state = 'play'; this.px = W / 2; this.bullet = null; this.bombs = []; this.newWave(); } return; }
      if (pauseCheck(this, e)) return;
      if (this.deadT > 0) { this.deadT -= dt; if (this.deadT <= 0) { this.bombs = []; } else return; }
      const alive = this.alive();
      if (alive.length === 0) { this.wave++; this.bullet = null; this.bombs = []; this.newWave(); e.sfx.sweep(300, 900, 0.4); return; }
      if (e.down('ArrowLeft') || e.down('KeyA')) this.px -= 260 * dt;
      if (e.down('ArrowRight') || e.down('KeyD')) this.px += 260 * dt;
      this.px = Math.max(20, Math.min(W - 20, this.px));
      if ((e.hit('Space') || e.hit('ArrowUp')) && !this.bullet) { this.bullet = { x: this.px, y: 536 }; e.sfx.beep(700, 0.07, 'sawtooth'); }
      const interval = Math.max(0.05, (0.028 * alive.length + 0.04) * [1.18, 1, 0.84][this.diff]);
      this.stepT += dt;
      if (this.stepT >= interval) {
        this.stepT = 0; this.frame = 1 - this.frame;
        this.beepHi = !this.beepHi; e.sfx.beep(this.beepHi ? 130 : 100, 0.05, 'square', 0.02);
        let minX = 1e9, maxX = -1e9, maxY = -1e9;
        for (const a of alive) { const p = this.alienPos(a); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + 30); maxY = Math.max(maxY, p.y + 24); }
        if ((this.dir === 1 && maxX + 10 > W - 10) || (this.dir === -1 && minX - 10 < 10)) { this.dir *= -1; this.oy += 16; }
        else this.ox += 10 * this.dir;
        if (maxY >= 500) { this.gameOver(e); return; }
      }
      this.saucerT -= dt;
      if (this.saucerT <= 0 && !this.saucer) { this.saucer = { x: -40, v: 130 }; this.saucerT = 12 + Math.random() * 10; }
      if (this.saucer) { this.saucer.x += this.saucer.v * dt; if (Math.floor(e.last / 120) % 2 === 0) e.sfx.beep(900, 0.03, 'sine', 0.012); if (this.saucer.x > W + 40) this.saucer = null; }
      if (this.bullet) {
        this.bullet.y -= 480 * dt;
        if (this.bullet.y < 40) this.bullet = null;
        else if (this.hitBunker(this.bullet.x, this.bullet.y)) this.bullet = null;
        else {
          if (this.saucer && Math.abs(this.bullet.x - (this.saucer.x + 15)) < 18 && Math.abs(this.bullet.y - 66) < 12) {
            const pts = [50, 100, 150][Math.floor(Math.random() * 3)];
            this.score += pts; this.popups.push({ x: this.saucer.x + 15, y: 66, s: '+' + pts, t: 0.9 });
            this.saucer = null; this.bullet = null; e.sfx.sweep(1000, 300, 0.3);
          } else {
            for (const a of this.alive()) {
              const p = this.alienPos(a);
              if (this.bullet.x > p.x - 2 && this.bullet.x < p.x + 32 && this.bullet.y > p.y - 2 && this.bullet.y < p.y + 26) {
                a.alive = false; this.score += [30, 20, 10][a.type]; this.bullet = null;
                e.sfx.sweep(500, 150, 0.12); break;
              }
            }
          }
        }
      }
      this.bombT = (this.bombT || 0) - dt;
      if (this.bombT <= 0) {
        this.bombT = Math.max(0.32, (1.15 - this.wave * 0.08 - (50 - alive.length) * 0.008) * [1.35, 1, 0.76][this.diff]);
        const cols = {}; for (const a of alive) { if (!cols[a.c] || a.r > cols[a.c].r) cols[a.c] = a; }
        const arr = Object.values(cols), src = arr[Math.floor(Math.random() * arr.length)];
        const p = this.alienPos(src); this.bombs.push({ x: p.x + 15, y: p.y + 26 });
      }
      const bs = (150 + this.wave * 12) * [0.85, 1, 1.18][this.diff];
      for (const b of this.bombs) {
        b.y += bs * dt;
        if (this.hitBunker(b.x, b.y)) { b.dead = true; continue; }
        if (b.y > 536 && b.y < 566 && Math.abs(b.x - this.px) < 15) { b.dead = true; this.playerHit(e); }
      }
      this.bombs = this.bombs.filter(b => !b.dead && b.y < H);
      this.popups = this.popups.filter(p => (p.t -= dt) > 0);
    }
    hitBunker(x, y) {
      for (const bk of this.bunkers) {
        if (x < bk.x || x > bk.x + 72 || y < bk.y || y > bk.y + 36) continue;
        const c = Math.floor((x - bk.x) / 6), r = Math.floor((y - bk.y) / 6);
        if (bk.cells.has(c + ',' + r)) {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++)
            if (Math.random() < 0.75) bk.cells.delete((c + dc) + ',' + (r + dr));
          return true;
        }
      }
      return false;
    }
    playerHit(e) {
      this.lives--; e.sfx.sweep(300, 60, 0.5, 0.05); this.deadT = 1.2;
      if (this.lives <= 0) this.gameOver(e);
    }
    gameOver(e) { this.state = 'over'; if (this.score > getHS(this.hsKey)) setHS(this.hsKey, this.score); }
    draw(ctx, e) {
      txt(ctx, 'PUNTOS ' + this.score, 14, 24, 15, '#f3f2f2');
      txt(ctx, 'OLEADA ' + this.wave, W / 2, 24, 15, '#9b9797', 'center');
      txt(ctx, 'VIDAS ' + this.lives, W - 14, 24, 15, '#f3f2f2', 'right');
      ctx.fillStyle = '#2d2b2b'; ctx.fillRect(0, 40, W, 2);
      const colors = ['#5fd068', '#41d9d9', '#f2c94c'];
      for (const a of this.aliens) {
        if (!a.alive) continue;
        const p = this.alienPos(a);
        drawPattern(ctx, INV[a.type][this.frame], p.x, p.y, 3, colors[a.type]);
      }
      if (this.saucer) drawPattern(ctx, SAUCER, this.saucer.x, 58, 3, '#ec3013');
      for (const bk of this.bunkers) {
        ctx.fillStyle = '#5fd068';
        for (const key of bk.cells) { const [c, r] = key.split(',').map(Number); ctx.fillRect(bk.x + c * 6, bk.y + r * 6, 6, 6); }
      }
      if (this.deadT > 0 && Math.floor(this.deadT * 10) % 2 === 0) { } else drawPattern(ctx, SHIP, this.px - 13, 540, 3, '#f3f2f2');
      if (this.bullet) { ctx.fillStyle = '#f3f2f2'; ctx.fillRect(this.bullet.x - 2, this.bullet.y - 8, 4, 10); }
      ctx.fillStyle = '#ec3013';
      for (const b of this.bombs) ctx.fillRect(b.x - 2, b.y - 6, 4, 8);
      for (const p of this.popups) txt(ctx, p.s, p.x, p.y - (0.9 - p.t) * 30, 13, '#f2c94c', 'center');
      ctx.fillStyle = '#2d2b2b'; ctx.fillRect(0, 572, W, 2);
      if (this.state === 'over') drawOver(ctx, 'FIN DEL JUEGO', 'PUNTOS ' + this.score + ' · HI ' + Math.max(this.score, getHS(this.hsKey)));
      if (this.paused) drawPause(ctx);
    }
  }

  /* ============================== BLOQUES (tetris con poderes) ============================== */
  const TSHAPES = {
    I: { m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], c: '#41d9d9' },
    J: { m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], c: '#4c7bf0' },
    L: { m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], c: '#f2994a' },
    O: { m: [[1, 1], [1, 1]], c: '#f2c94c' },
    S: { m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], c: '#5fd068' },
    T: { m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], c: '#b06ee8' },
    Z: { m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], c: '#ec3013' }
  };
  function rotCW(m) { const n = m.length, o = []; for (let c = 0; c < n; c++) { o.push([]); for (let r = n - 1; r >= 0; r--) o[c].push(m[r][c]); } return o; }
  const POWERS = [
    { key: 'Digit1', name: 'BOMBA', desc: 'borra 2 filas', unlock: 5, cost: 4, color: '#ec3013' },
    { key: 'Digit2', name: 'LENTO', desc: 'caída lenta 15s', unlock: 15, cost: 6, color: '#41d9d9' },
    { key: 'Digit3', name: 'CAMBIO', desc: 'pieza actual → I', unlock: 25, cost: 8, color: '#f2c94c' }
  ];

  class Tetris {
    constructor(e, exit) {
      this.e = e; this.exit = exit; this.hsKey = 'blocks'; this.diff = getDiff();
      this.cols = 10; this.rows = 20; this.cell = 26; this.bx = 40; this.by = 40;
      this.paused = false;
      this.reset();
    }
    reset() {
      this.board = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
      this.score = 0; this.lines = 0; this.level = [1, 1, 3][this.diff]; this.state = 'play';
      this.bag = []; this.next = this.take();
      this.gravT = 0; this.das = 0; this.arr = 0;
      this.flashRows = []; this.flashT = 0;
      this.charge = 0; this.slowT = 0; this.bombFlash = 0; this.powerMsg = null; this.powerMsgT = 0;
      this.spawn();
    }
    take() {
      if (!this.bag.length) { this.bag = Object.keys(TSHAPES).sort(() => Math.random() - 0.5); }
      return this.bag.pop();
    }
    spawn() {
      this.pieceId = this.next; this.next = this.take();
      const s = TSHAPES[this.pieceId];
      this.m = s.m.map(r => r.slice()); this.color = s.c;
      this.pxc = Math.floor((this.cols - this.m.length) / 2); this.pyc = this.pieceId === 'I' ? -1 : 0;
      if (this.collide(this.m, this.pxc, this.pyc)) { this.state = 'over'; if (this.score > getHS(this.hsKey)) setHS(this.hsKey, this.score); }
    }
    collide(m, x, y) {
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) {
        if (!m[r][c]) continue;
        const bc = x + c, br = y + r;
        if (bc < 0 || bc >= this.cols || br >= this.rows) return true;
        if (br >= 0 && this.board[br][bc]) return true;
      }
      return false;
    }
    tryMove(dx, dy) { if (!this.collide(this.m, this.pxc + dx, this.pyc + dy)) { this.pxc += dx; this.pyc += dy; return true; } return false; }
    rotate(ccw) {
      let m = this.m; const times = ccw ? 3 : 1;
      for (let i = 0; i < times; i++) m = rotCW(m);
      for (const k of [0, -1, 1, -2, 2]) {
        if (!this.collide(m, this.pxc + k, this.pyc)) { this.m = m; this.pxc += k; this.e.sfx.beep(380, 0.04); return; }
      }
    }
    ghostY() { let y = this.pyc; while (!this.collide(this.m, this.pxc, y + 1)) y++; return y; }
    lock(e) {
      for (let r = 0; r < this.m.length; r++) for (let c = 0; c < this.m.length; c++)
        if (this.m[r][c] && this.pyc + r >= 0) this.board[this.pyc + r][this.pxc + c] = this.color;
      const full = [];
      for (let r = 0; r < this.rows; r++) if (this.board[r].every(v => v)) full.push(r);
      if (full.length) {
        this.flashRows = full; this.flashT = 0.22;
        const pts = { 1: 100, 2: 300, 3: 500, 4: 800 }[full.length] * this.level;
        this.score += pts; this.lines += full.length;
        this.charge = Math.min(12, this.charge + full.length);
        this.level = [1, 1, 3][this.diff] + Math.floor(this.lines / 10);
        e.sfx.sweep(400, 400 + full.length * 200, 0.25);
      } else e.sfx.beep(180, 0.05);
      this.spawn();
    }
    usePower(i, e) {
      const p = POWERS[i];
      if (this.lines < p.unlock || this.charge < p.cost) { e.sfx.beep(140, 0.08); return; }
      if (p.name === 'BOMBA') {
        this.board.splice(this.rows - 2, 2);
        this.board.unshift(Array(this.cols).fill(0), Array(this.cols).fill(0));
        this.bombFlash = 0.18;
        e.sfx.sweep(500, 80, 0.4, 0.05);
      } else if (p.name === 'LENTO') {
        this.slowT = 15;
        e.sfx.sweep(600, 200, 0.4);
      } else if (p.name === 'CAMBIO') {
        const s = TSHAPES.I, m = s.m.map(r => r.slice());
        let placed = false;
        for (const k of [0, -1, 1, -2, 2, -3, 3]) {
          const nx = Math.min(Math.max(this.pxc + k, 0), this.cols - 4);
          if (!this.collide(m, nx, this.pyc)) { this.m = m; this.pxc = nx; this.pieceId = 'I'; this.color = s.c; placed = true; break; }
        }
        if (!placed) { e.sfx.beep(140, 0.08); return; }
        e.sfx.sweep(300, 800, 0.3);
      }
      this.charge -= p.cost;
      this.powerMsg = p.name; this.powerMsgT = 1.1;
    }
    update(dt, e) {
      if (e.hit('Escape')) { this.exit(); return; }
      if (this.state === 'over') { if (e.hit('Enter')) this.reset(); return; }
      if (pauseCheck(this, e)) return;
      if (this.slowT > 0) this.slowT -= dt;
      if (this.bombFlash > 0) this.bombFlash -= dt;
      if (this.powerMsgT > 0) this.powerMsgT -= dt;
      POWERS.forEach((p, i) => { if (e.hit(p.key)) this.usePower(i, e); });
      if (this.flashT > 0) {
        this.flashT -= dt;
        if (this.flashT <= 0) {
          for (const r of this.flashRows) { this.board.splice(r, 1); this.board.unshift(Array(this.cols).fill(0)); }
          this.flashRows = [];
        }
        return;
      }
      const dir = (e.down('ArrowLeft') || e.down('KeyA') ? -1 : 0) + (e.down('ArrowRight') || e.down('KeyD') ? 1 : 0);
      if (e.hit('ArrowLeft') || e.hit('KeyA')) { this.tryMove(-1, 0); this.das = 0; }
      if (e.hit('ArrowRight') || e.hit('KeyD')) { this.tryMove(1, 0); this.das = 0; }
      if (dir !== 0) {
        this.das += dt;
        if (this.das > 0.17) { this.arr += dt; if (this.arr > 0.045) { this.arr = 0; this.tryMove(dir, 0); } }
      } else this.das = 0;
      if (e.hit('ArrowUp') || e.hit('KeyX')) this.rotate(false);
      if (e.hit('KeyZ')) this.rotate(true);
      if (e.hit('Space')) {
        const gy = this.ghostY(); this.score += (gy - this.pyc) * 2; this.pyc = gy; this.lock(e); return;
      }
      const soft = e.down('ArrowDown') || e.down('KeyS');
      let interval = Math.max(0.07, 0.75 * Math.pow(0.85, this.level - 1)) * [1.25, 1, 0.8][this.diff];
      if (this.slowT > 0) interval *= 2.6;
      if (soft) interval = 0.04;
      this.gravT += dt;
      if (this.gravT >= interval) {
        this.gravT = 0;
        if (!this.tryMove(0, 1)) this.lock(e);
        else if (soft) this.score += 1;
      }
    }
    drawCell(ctx, c, r, color, ghost) {
      const x = this.bx + c * this.cell, y = this.by + r * this.cell;
      if (ghost) { ctx.strokeStyle = 'rgba(243,242,242,0.28)'; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, this.cell - 4, this.cell - 4); return; }
      ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, this.cell - 2, this.cell - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 1, y + 1, this.cell - 2, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x + 1, y + this.cell - 6, this.cell - 2, 5);
    }
    draw(ctx) {
      ctx.fillStyle = '#0c0c0c'; ctx.fillRect(this.bx, this.by, this.cols * this.cell, this.rows * this.cell);
      ctx.strokeStyle = '#2d2b2b'; ctx.lineWidth = 2;
      ctx.strokeRect(this.bx - 2, this.by - 2, this.cols * this.cell + 4, this.rows * this.cell + 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
      for (let c = 1; c < this.cols; c++) { ctx.beginPath(); ctx.moveTo(this.bx + c * this.cell, this.by); ctx.lineTo(this.bx + c * this.cell, this.by + this.rows * this.cell); ctx.stroke(); }
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
        if (this.flashRows.includes(r)) { ctx.fillStyle = '#f3f2f2'; ctx.fillRect(this.bx + c * this.cell + 1, this.by + r * this.cell + 1, this.cell - 2, this.cell - 2); }
        else if (this.board[r][c]) this.drawCell(ctx, c, r, this.board[r][c]);
      }
      if (this.bombFlash > 0) { ctx.fillStyle = 'rgba(236,48,19,0.35)'; ctx.fillRect(this.bx, this.by + (this.rows - 2) * this.cell, this.cols * this.cell, this.cell * 2); }
      if (this.state !== 'over' && this.flashT <= 0) {
        const gy = this.ghostY();
        for (let r = 0; r < this.m.length; r++) for (let c = 0; c < this.m.length; c++) {
          if (!this.m[r][c]) continue;
          if (gy + r >= 0 && gy !== this.pyc) this.drawCell(ctx, this.pxc + c, gy + r, null, true);
        }
        for (let r = 0; r < this.m.length; r++) for (let c = 0; c < this.m.length; c++)
          if (this.m[r][c] && this.pyc + r >= 0) this.drawCell(ctx, this.pxc + c, this.pyc + r, this.color);
      }
      const px = 330;
      txt(ctx, 'SIGUIENTE', px, 56, 12, '#9b9797');
      ctx.strokeStyle = '#2d2b2b'; ctx.lineWidth = 2; ctx.strokeRect(px, 68, 120, 78);
      const ns = TSHAPES[this.next], nm = ns.m, sz = 18;
      const offx = px + 60 - nm.length * sz / 2, offy = 107 - nm.length * sz / 2;
      for (let r = 0; r < nm.length; r++) for (let c = 0; c < nm.length; c++)
        if (nm[r][c]) { ctx.fillStyle = ns.c; ctx.fillRect(offx + c * sz + 1, offy + r * sz + 1, sz - 2, sz - 2); }
      txt(ctx, 'PUNTOS', px, 170, 12, '#9b9797'); txt(ctx, String(this.score), px, 192, 20, '#f3f2f2');
      txt(ctx, 'NIVEL ' + this.level + ' · LÍNEAS ' + this.lines, px, 222, 12, '#9b9797');
      txt(ctx, 'HI ' + Math.max(this.score, getHS(this.hsKey)), px, 244, 12, '#ec3013');
      // poderes
      txt(ctx, 'PODERES', px, 282, 12, '#f2c94c');
      POWERS.forEach((p, i) => {
        const y = 304 + i * 58;
        const unlocked = this.lines >= p.unlock;
        const ready = unlocked && this.charge >= p.cost;
        txt(ctx, '[' + (i + 1) + '] ' + p.name, px, y, 13, unlocked ? (ready ? p.color : '#f3f2f2') : '#4a4747');
        if (!unlocked) {
          txt(ctx, 'se desbloquea a ' + p.unlock + ' líneas', px, y + 17, 10, '#4a4747');
        } else {
          txt(ctx, p.desc + ' · coste ' + p.cost, px, y + 17, 10, '#605d5d');
          ctx.fillStyle = '#1c1a19'; ctx.fillRect(px, y + 27, 120, 7);
          ctx.fillStyle = ready ? p.color : '#605d5d';
          ctx.fillRect(px, y + 27, 120 * Math.min(1, this.charge / p.cost), 7);
          if (ready) txt(ctx, 'LISTO', px + 128, y + 30, 10, p.color);
        }
      });
      txt(ctx, 'CARGA ' + this.charge + ' (limpia líneas)', px, 490, 11, '#9b9797');
      if (this.slowT > 0) txt(ctx, 'LENTO ' + Math.ceil(this.slowT) + 's', px, 512, 12, '#41d9d9');
      txt(ctx, '←→ mover · ↑ girar · ↓ bajar', px, 542, 10, '#605d5d');
      txt(ctx, 'ESPACIO caída · 1-3 poderes', px, 558, 10, '#605d5d');
      if (this.powerMsgT > 0) txt(ctx, '¡' + this.powerMsg + '!', this.bx + this.cols * this.cell / 2, 300, 22, '#f2c94c', 'center');
      if (this.state === 'over') drawOver(ctx, 'FIN DEL JUEGO', 'PUNTOS ' + this.score + ' · LÍNEAS ' + this.lines);
      if (this.paused) drawPause(ctx);
    }
  }

  /* ============================== COME-COCOS ============================== */
  const MAP = [
    "###################",
    "#o.......#.......o#",
    "#.##.###.#.###.##.#",
    "#.................#",
    "#.##.#.#####.#.##.#",
    "#....#...#...#....#",
    "####.###.#.###.####",
    "####.#.......#.####",
    "####.#.##=##.#.####",
    "T....#.#   #.#....T",
    "####.#.#####.#.####",
    "####.#.......#.####",
    "####.#.#####.#.####",
    "#........#........#",
    "#.##.###.#.###.##.#",
    "#o.#.....P.....#.o#",
    "##.#.#.#####.#.#.##",
    "#....#...#...#....#",
    "#.######.#.######.#",
    "#.................#",
    "###################"
  ];
  const MC = 19, MR = 21, PTS = 24, POX = 32, POY = 52;

  class Pacman {
    constructor(e, exit) {
      this.e = e; this.exit = exit; this.hsKey = 'pac'; this.diff = getDiff();
      this.score = 0; this.lives = [4, 3, 3][this.diff]; this.level = 1; this.speedMul = 1;
      this.paused = false;
      this.loadPellets(); this.resetPositions();
      this.state = 'ready'; this.readyT = 1.8; this.popups = []; this.clearT = 0;
    }
    loadPellets() {
      this.pellets = new Map();
      for (let r = 0; r < MR; r++) for (let c = 0; c < MC; c++) {
        const ch = MAP[r][c];
        if (ch === '.') this.pellets.set(c + ',' + r, 1);
        if (ch === 'o') this.pellets.set(c + ',' + r, 2);
      }
    }
    resetPositions() {
      this.pac = { c: 9, r: 15, p: 0, dir: { x: -1, y: 0 }, speed: 5 * this.speedMul };
      this.desired = { x: -1, y: 0 };
      this.mouthT = 0; this.deathT = 0;
      const corners = [[17, 1], [1, 1], [17, 19], [1, 19]];
      const colors = ['#ec3013', '#ff9de2', '#41d9d9', '#f2994a'];
      this.ghosts = colors.map((col, i) => ({
        i, color: col, corner: corners[i],
        state: i === 0 ? 'out' : 'house',
        c: 9, r: 7, p: 0, dir: { x: -1, y: 0 },
        houseX: [9, 8, 9, 10][i], releaseT: [0, 2, 5, 8][i],
        frightened: false, lx: 0, ly: 0
      }));
      for (const g of this.ghosts) { g.lx = POX + g.houseX * PTS + PTS / 2; g.ly = POY + 9 * PTS + PTS / 2; }
      this.modeT = 7; this.chase = false; this.fright = 0; this.chain = 0; this.tGlobal = 0;
    }
    open(c, r, door) {
      c = ((c % MC) + MC) % MC;
      if (r < 0 || r >= MR) return false;
      const ch = MAP[r][c];
      if (ch === '#') return false;
      if (ch === '=' && !door) return false;
      return true;
    }
    centerX(c) { return POX + c * PTS + PTS / 2; }
    centerY(r) { return POY + r * PTS + PTS / 2; }
    pos(ent) { return { x: this.centerX(ent.c) + ent.dir.x * ent.p * PTS, y: this.centerY(ent.r) + ent.dir.y * ent.p * PTS }; }
    advance(ent, dt, choose, door) {
      let move = ent.speed * dt;
      let guard = 0;
      while (move > 0 && guard++ < 10) {
        if (ent.dir.x === 0 && ent.dir.y === 0) { choose(ent); if (ent.dir.x === 0 && ent.dir.y === 0) break; }
        const nc = ent.c + ent.dir.x, nr = ent.r + ent.dir.y;
        if (!this.open(nc, nr, door)) { ent.p = 0; choose(ent); if (!this.open(ent.c + ent.dir.x, ent.r + ent.dir.y, door)) break; continue; }
        const step = Math.min(move / PTS, 1 - ent.p);
        ent.p += step; move -= step * PTS;
        if (ent.p >= 1 - 1e-9) { ent.c = ((nc % MC) + MC) % MC; ent.r = nr; ent.p = 0; choose(ent); }
      }
    }
    pacChoose(ent) {
      const d = this.desired;
      if (d && this.open(ent.c + d.x, ent.r + d.y, false)) { ent.dir = { x: d.x, y: d.y }; return; }
      if (!this.open(ent.c + ent.dir.x, ent.r + ent.dir.y, false)) ent.dir = { x: 0, y: 0 };
    }
    ghostChoose(g) {
      if (g.state !== 'out' && g.state !== 'eaten') return;
      const dirs = [[0, -1], [-1, 0], [0, 1], [1, 0]];
      const opts = dirs.filter(([dx, dy]) => !(dx === -g.dir.x && dy === -g.dir.y) && this.open(g.c + dx, g.r + dy, false));
      if (!opts.length) { g.dir = { x: -g.dir.x, y: -g.dir.y }; return; }
      let pick;
      if (g.state === 'out' && this.fright > 0 && g.frightened) {
        pick = opts[Math.floor(Math.random() * opts.length)];
      } else {
        const t = g.state === 'eaten' ? [9, 7] : this.target(g);
        let best = 1e18;
        for (const o of opts) {
          const nc = g.c + o[0], nr = g.r + o[1];
          const d = (t[0] - nc) * (t[0] - nc) + (t[1] - nr) * (t[1] - nr);
          if (d < best) { best = d; pick = o; }
        }
      }
      g.dir = { x: pick[0], y: pick[1] };
    }
    target(g) {
      if (!this.chase) return g.corner;
      const p = this.pac, d = p.dir;
      if (g.i === 0) return [p.c, p.r];
      if (g.i === 1) return [p.c + d.x * 4, p.r + d.y * 4];
      if (g.i === 2) {
        const red = this.ghosts[0], mx = p.c + d.x * 2, my = p.r + d.y * 2;
        return [mx + (mx - red.c), my + (my - red.r)];
      }
      const dist = (p.c - g.c) * (p.c - g.c) + (p.r - g.r) * (p.r - g.r);
      return dist > 64 ? [p.c, p.r] : g.corner;
    }
    reverse(ent) {
      if (ent.dir.x === 0 && ent.dir.y === 0) return;
      const nc = ent.c + ent.dir.x, nr = ent.r + ent.dir.y;
      if (ent.p > 0 && this.open(nc, nr, false)) { ent.c = ((nc % MC) + MC) % MC; ent.r = nr; ent.p = 1 - ent.p; }
      ent.dir = { x: -ent.dir.x, y: -ent.dir.y };
    }
    update(dt, e) {
      if (e.hit('Escape')) { this.exit(); return; }
      this.tGlobal += dt;
      if (this.state === 'over') {
        if (e.hit('Enter')) { this.score = 0; this.lives = [4, 3, 3][this.diff]; this.level = 1; this.speedMul = 1; this.loadPellets(); this.resetPositions(); this.state = 'ready'; this.readyT = 1.8; }
        return;
      }
      if (this.state === 'play' || this.state === 'ready') { if (pauseCheck(this, e)) return; }
      if (this.state === 'clear') {
        this.clearT -= dt;
        if (this.clearT <= 0) {
          this.level++; this.speedMul = Math.min(1.35, this.speedMul + 0.06);
          this.loadPellets(); this.resetPositions(); this.state = 'ready'; this.readyT = 1.6;
        }
        return;
      }
      if (this.state === 'ready') { this.readyT -= dt; if (this.readyT <= 0) this.state = 'play'; return; }
      if (this.state === 'dying') {
        this.deathT -= dt;
        if (this.deathT <= 0) {
          this.lives--;
          if (this.lives <= 0) { this.state = 'over'; if (this.score > getHS(this.hsKey)) setHS(this.hsKey, this.score); }
          else { this.resetPositions(); this.state = 'ready'; this.readyT = 1.5; }
        }
        return;
      }
      if (e.down('ArrowUp') || e.down('KeyW')) this.desired = { x: 0, y: -1 };
      else if (e.down('ArrowDown') || e.down('KeyS')) this.desired = { x: 0, y: 1 };
      else if (e.down('ArrowLeft') || e.down('KeyA')) this.desired = { x: -1, y: 0 };
      else if (e.down('ArrowRight') || e.down('KeyD')) this.desired = { x: 1, y: 0 };
      this.mouthT += dt;
      this.pac.speed = 5.2 * this.speedMul * PTS;
      this.advance(this.pac, dt, (ent) => this.pacChoose(ent), false);
      const key = this.pac.c + ',' + this.pac.r;
      if (this.pac.p < 0.5 && this.pellets.has(key)) {
        const v = this.pellets.get(key); this.pellets.delete(key);
        if (v === 1) { this.score += 10; if (Math.floor(this.tGlobal * 10) % 2 === 0) e.sfx.beep(340, 0.03, 'square', 0.02); }
        else {
          this.score += 50;
          this.fright = Math.max(3, 7 + [2, 0, -1.5][this.diff] - this.level * 0.5); this.chain = 0;
          for (const g of this.ghosts) if (g.state === 'out') { g.frightened = true; this.reverse(g); }
          e.sfx.sweep(200, 500, 0.3);
        }
        if (this.pellets.size === 0) { this.state = 'clear'; this.clearT = 2; e.sfx.sweep(300, 1000, 0.6); return; }
      }
      if (this.fright > 0) {
        this.fright -= dt;
        if (this.fright <= 0) { for (const g of this.ghosts) g.frightened = false; this.chain = 0; }
      } else {
        this.modeT -= dt;
        if (this.modeT <= 0) {
          this.chase = !this.chase; this.modeT = this.chase ? 20 : 7;
          for (const g of this.ghosts) if (g.state === 'out') this.reverse(g);
        }
      }
      const doorX = this.centerX(9), doorTopY = this.centerY(7), houseY = this.centerY(9);
      for (const g of this.ghosts) {
        if (g.state === 'house') {
          g.releaseT -= dt;
          g.ly = houseY + Math.sin(this.tGlobal * 4 + g.i) * 4;
          if (g.releaseT <= 0) g.state = 'leaving';
        } else if (g.state === 'leaving') {
          const sp = 70;
          if (Math.abs(g.lx - doorX) > 2) g.lx += Math.sign(doorX - g.lx) * sp * dt;
          else { g.lx = doorX; g.ly -= sp * dt; if (g.ly <= doorTopY) { g.state = 'out'; g.c = 9; g.r = 7; g.p = 0; g.dir = { x: -1, y: 0 }; } }
        } else if (g.state === 'entering') {
          g.ly += 90 * dt;
          if (g.ly >= houseY) { g.ly = houseY; g.state = 'leaving'; }
        } else {
          const base = 4.6 * this.speedMul * [0.85, 1, 1.1][this.diff];
          let mul = 1;
          if (g.state === 'eaten') mul = 1.8;
          else if (this.fright > 0 && g.frightened) mul = 0.55;
          else if (g.r === 9 && (g.c < 4 || g.c > 14)) mul = 0.55;
          g.speed = base * mul * PTS;
          this.advance(g, dt, (ent) => this.ghostChoose(ent), false);
          if (g.state === 'eaten' && g.c === 9 && g.r === 7 && g.p < 0.05) {
            g.state = 'entering'; g.lx = doorX; g.ly = doorTopY; g.frightened = false;
          }
        }
      }
      const pp = this.pos(this.pac);
      for (const g of this.ghosts) {
        if (g.state !== 'out') continue;
        const gp = this.pos(g);
        if (Math.abs(gp.x - pp.x) < 13 && Math.abs(gp.y - pp.y) < 13) {
          if (this.fright > 0 && g.frightened) {
            g.state = 'eaten'; g.frightened = false;
            this.chain++;
            const pts = 100 * Math.pow(2, this.chain);
            this.score += pts;
            this.popups.push({ x: gp.x, y: gp.y, s: '+' + pts, t: 0.9 });
            e.sfx.sweep(300, 900, 0.25);
          } else {
            this.state = 'dying'; this.deathT = 1.4; e.sfx.sweep(600, 80, 1.0, 0.05);
            return;
          }
        }
      }
      this.popups = this.popups.filter(p => (p.t -= dt) > 0);
    }
    draw(ctx) {
      txt(ctx, 'PUNTOS ' + this.score, 14, 22, 15, '#f3f2f2');
      txt(ctx, 'HI ' + Math.max(this.score, getHS(this.hsKey)), W / 2, 22, 15, '#ec3013', 'center');
      txt(ctx, 'NIVEL ' + this.level, W - 14, 22, 15, '#9b9797', 'right');
      const flash = this.state === 'clear' && Math.floor(this.clearT * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#f3f2f2' : '#2a3cc4';
      for (let r = 0; r < MR; r++) for (let c = 0; c < MC; c++) {
        if (MAP[r][c] !== '#') continue;
        const x = POX + c * PTS, y = POY + r * PTS;
        ctx.fillRect(x + 7, y + 7, PTS - 14, PTS - 14);
        if (c + 1 < MC && MAP[r][c + 1] === '#') ctx.fillRect(x + 7, y + 7, PTS, PTS - 14);
        if (r + 1 < MR && MAP[r + 1][c] === '#') ctx.fillRect(x + 7, y + 7, PTS - 14, PTS);
      }
      ctx.fillStyle = '#ffb8de'; ctx.fillRect(POX + 9 * PTS + 2, POY + 8 * PTS + 10, PTS - 4, 4);
      for (const [k, v] of this.pellets) {
        const [c, r] = k.split(',').map(Number);
        const x = this.centerX(c), y = this.centerY(r);
        if (v === 1) { ctx.fillStyle = '#ffb897'; ctx.fillRect(x - 2, y - 2, 4, 4); }
        else {
          const pulse = 4 + Math.sin(this.tGlobal * 6) * 2;
          ctx.fillStyle = '#ffb897'; ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.fill();
        }
      }
      const pp = this.pos(this.pac);
      if (this.state === 'dying') {
        const k = Math.max(0, this.deathT / 1.4);
        ctx.fillStyle = '#ffd23c'; ctx.beginPath();
        ctx.arc(pp.x, pp.y, 10 * k, 0, Math.PI * 2); ctx.fill();
      } else {
        const ang = Math.atan2(this.pac.dir.y, this.pac.dir.x) || 0;
        const m = this.state === 'play' ? Math.abs(Math.sin(this.mouthT * 10)) * 0.9 : 0.4;
        ctx.fillStyle = '#ffd23c'; ctx.beginPath();
        ctx.moveTo(pp.x, pp.y);
        ctx.arc(pp.x, pp.y, 10, ang + m * 0.5, ang + Math.PI * 2 - m * 0.5);
        ctx.closePath(); ctx.fill();
      }
      for (const g of this.ghosts) {
        let gp;
        if (g.state === 'house' || g.state === 'leaving' || g.state === 'entering') gp = { x: g.lx, y: g.ly };
        else gp = this.pos(g);
        const fr = this.fright > 0 && g.frightened && g.state === 'out';
        const blink = fr && this.fright < 2 && Math.floor(this.fright * 5) % 2 === 0;
        if (g.state !== 'eaten') {
          ctx.fillStyle = fr ? (blink ? '#f3f2f2' : '#3a4ecc') : g.color;
          ctx.beginPath();
          ctx.arc(gp.x, gp.y - 2, 9, Math.PI, 0);
          ctx.rect(gp.x - 9, gp.y - 2, 18, 10);
          ctx.fill();
        }
        const ex = g.dir ? g.dir.x * 2 : 0, ey = g.dir ? g.dir.y * 2 : 0;
        ctx.fillStyle = '#f3f2f2';
        ctx.fillRect(gp.x - 6, gp.y - 6, 5, 6); ctx.fillRect(gp.x + 1, gp.y - 6, 5, 6);
        ctx.fillStyle = fr ? '#3a4ecc' : '#201e1d';
        ctx.fillRect(gp.x - 5 + ex, gp.y - 5 + ey, 3, 3); ctx.fillRect(gp.x + 2 + ex, gp.y - 5 + ey, 3, 3);
      }
      for (const p of this.popups) txt(ctx, p.s, p.x, p.y - (0.9 - p.t) * 24, 12, '#41d9d9', 'center');
      for (let i = 0; i < this.lives - 1; i++) {
        ctx.fillStyle = '#ffd23c'; ctx.beginPath();
        ctx.moveTo(24 + i * 26, H - 18);
        ctx.arc(24 + i * 26, H - 18, 8, 0.5, Math.PI * 2 - 0.5); ctx.closePath(); ctx.fill();
      }
      if (this.state === 'ready') txt(ctx, '¡LISTO!', W / 2, POY + 11 * PTS + PTS / 2, 18, '#f2c94c', 'center');
      if (this.state === 'over') drawOver(ctx, 'FIN DEL JUEGO', 'PUNTOS ' + this.score + ' · NIVEL ' + this.level);
      if (this.paused) drawPause(ctx);
    }
  }

  /* ============================== BUSCAMINAS ============================== */
  function bevel(ctx, x, y, w, h, inset) {
    ctx.fillStyle = '#c0c0c0'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = inset ? '#7b7b7b' : '#ffffff'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 2, h);
    ctx.fillStyle = inset ? '#ffffff' : '#7b7b7b'; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x + w - 2, y, 2, h);
  }
  function led(ctx, x, y, s) {
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, 58, 32);
    txt(ctx, s, x + 29, y + 17, 24, '#ff2020', 'center');
  }
  const NUMC = ['', '#1d24c8', '#0f7a0f', '#d02020', '#101073', '#7a1010', '#0f7a7a', '#202020', '#787878'];

  class Mines {
    constructor(e, exit) {
      this.e = e; this.exit = exit; this.diff = getDiff(); this.hsKey = 'mines' + this.diff;
      this.cfg = [{ c: 9, r: 9, m: 10, s: 38 }, { c: 14, r: 14, m: 30, s: 27 }, { c: 18, r: 22, m: 80, s: 20 }][this.diff];
      this.ox = Math.floor((W - this.cfg.c * this.cfg.s) / 2);
      this.oy = 108;
      this.paused = false;
      this.reset();
    }
    reset() {
      const { c, r } = this.cfg;
      this.grid = Array.from({ length: r }, () => Array(c).fill(0));
      this.openc = Array.from({ length: r }, () => Array(c).fill(false));
      this.flag = Array.from({ length: r }, () => Array(c).fill(false));
      this.state = 'fresh'; this.time = 0; this.boomAt = null; this.opened = 0;
    }
    place(fc, fr) {
      const { c, r, m } = this.cfg;
      let placed = 0;
      while (placed < m) {
        const cc = Math.floor(Math.random() * c), rr = Math.floor(Math.random() * r);
        if (Math.abs(cc - fc) <= 1 && Math.abs(rr - fr) <= 1) continue;
        if (this.grid[rr][cc] === -1) continue;
        this.grid[rr][cc] = -1; placed++;
      }
      for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) {
        if (this.grid[y][x] === -1) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < c && ny >= 0 && ny < r && this.grid[ny][nx] === -1) n++;
        }
        this.grid[y][x] = n;
      }
    }
    cellAt(px, py) {
      const { c, r, s } = this.cfg;
      const x = Math.floor((px - this.ox) / s), y = Math.floor((py - this.oy) / s);
      return (x >= 0 && x < c && y >= 0 && y < r) ? { x, y } : null;
    }
    reveal(x, y) {
      if (this.openc[y][x] || this.flag[y][x]) return;
      this.openc[y][x] = true; this.opened++;
      if (this.grid[y][x] === -1) { this.state = 'over'; this.boomAt = { x, y }; this.e.sfx.sweep(300, 60, 0.5, 0.05); return; }
      if (this.grid[y][x] === 0) {
        const { c, r } = this.cfg;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < c && ny >= 0 && ny < r) this.reveal(nx, ny);
        }
      }
    }
    chord(x, y) {
      const { c, r } = this.cfg; let f = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < c && ny >= 0 && ny < r && this.flag[ny][nx]) f++;
      }
      if (f !== this.grid[y][x]) return;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < c && ny >= 0 && ny < r && !this.flag[ny][nx] && !this.openc[ny][nx] && this.state !== 'over') this.reveal(nx, ny);
      }
    }
    checkWin() {
      const { c, r, m } = this.cfg;
      if (this.state === 'play' && this.opened === c * r - m) {
        this.state = 'win';
        const t = Math.max(1, Math.floor(this.time)), best = getHS(this.hsKey);
        if (!best || t < best) setHS(this.hsKey, t);
        this.e.sfx.sweep(300, 900, 0.5);
      }
    }
    update(dt, e) {
      if (e.hit('Escape')) { this.exit(); return; }
      if (e.hit('Enter') && (this.state === 'over' || this.state === 'win')) { this.reset(); return; }
      if (this.state === 'play' || this.state === 'fresh') { if (pauseCheck(this, e)) return; }
      if (this.state === 'play') this.time = Math.min(999, this.time + dt);
      for (const c of e.takeClicks()) {
        if (Math.abs(c.x - W / 2) < 20 && Math.abs(c.y - 62) < 20) { this.reset(); e.sfx.beep(400, 0.05); continue; }
        if (this.state === 'over' || this.state === 'win') continue;
        const cell = this.cellAt(c.x, c.y);
        if (!cell) continue;
        if (this.state === 'fresh') { this.place(cell.x, cell.y); this.state = 'play'; }
        if (this.openc[cell.y][cell.x]) this.chord(cell.x, cell.y);
        else if (!this.flag[cell.y][cell.x]) { this.reveal(cell.x, cell.y); e.sfx.beep(520, 0.03, 'square', 0.015); }
        this.checkWin();
      }
      for (const c of e.takeRightClicks()) {
        if (this.state !== 'play' && this.state !== 'fresh') continue;
        const cell = this.cellAt(c.x, c.y);
        if (!cell || this.openc[cell.y][cell.x]) continue;
        this.flag[cell.y][cell.x] = !this.flag[cell.y][cell.x];
        e.sfx.beep(300, 0.04);
      }
    }
    draw(ctx) {
      ctx.fillStyle = '#8f8f8f'; ctx.fillRect(0, 0, W, H);
      const { c, r, s, m } = this.cfg, bw = c * s, bh = r * s;
      bevel(ctx, 8, 14, W - 16, H - 26, false);
      bevel(ctx, this.ox - 6, 36, bw + 12, 54, true);
      const flags = this.flag.flat().filter(Boolean).length;
      const left = m - flags;
      led(ctx, this.ox + 2, 47, left < 0 ? '-' + String(Math.min(99, -left)).padStart(2, '0') : String(Math.min(999, left)).padStart(3, '0'));
      led(ctx, this.ox + bw - 62, 47, String(Math.floor(this.time)).padStart(3, '0'));
      // botón cara
      bevel(ctx, W / 2 - 18, 45, 36, 36, false);
      ctx.fillStyle = '#ffd23c'; ctx.beginPath(); ctx.arc(W / 2, 63, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#201e1d'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#201e1d';
      if (this.state === 'over') {
        // ojos X
        ctx.strokeStyle = '#201e1d'; ctx.lineWidth = 2;
        [[-5, 0], [3, 0]].forEach(([dx]) => {
          ctx.beginPath(); ctx.moveTo(W / 2 + dx - 2, 57); ctx.lineTo(W / 2 + dx + 2, 61); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(W / 2 + dx + 2, 57); ctx.lineTo(W / 2 + dx - 2, 61); ctx.stroke();
        });
        ctx.beginPath(); ctx.arc(W / 2, 70, 4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else if (this.state === 'win') {
        ctx.fillRect(W / 2 - 9, 56, 8, 4); ctx.fillRect(W / 2 + 1, 56, 8, 4); ctx.fillRect(W / 2 - 6, 57, 12, 2);
        ctx.strokeStyle = '#201e1d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, 66, 5, 0.25, Math.PI - 0.25); ctx.stroke();
      } else {
        ctx.fillRect(W / 2 - 6, 57, 3, 3); ctx.fillRect(W / 2 + 3, 57, 3, 3);
        ctx.strokeStyle = '#201e1d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, 65, 5, 0.25, Math.PI - 0.25); ctx.stroke();
      }
      // tablero
      bevel(ctx, this.ox - 6, this.oy - 6, bw + 12, bh + 12, true);
      for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) {
        const px = this.ox + x * s, py = this.oy + y * s;
        const isOpen = this.openc[y][x] || ((this.state === 'over' || this.state === 'win') && this.grid[y][x] === -1 && !this.flag[y][x] && this.state === 'over');
        if (!this.openc[y][x] && !isOpen) {
          bevel(ctx, px, py, s, s, false);
          if (this.flag[y][x]) {
            ctx.fillStyle = '#201e1d'; ctx.fillRect(px + s / 2 - 1, py + s * 0.25, 2, s * 0.5);
            ctx.fillStyle = '#d02020'; ctx.beginPath();
            ctx.moveTo(px + s / 2, py + s * 0.22); ctx.lineTo(px + s * 0.24, py + s * 0.34); ctx.lineTo(px + s / 2, py + s * 0.46);
            ctx.closePath(); ctx.fill();
            if (this.state === 'over' && this.grid[y][x] !== -1) {
              ctx.strokeStyle = '#d02020'; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.moveTo(px + 3, py + 3); ctx.lineTo(px + s - 3, py + s - 3); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(px + s - 3, py + 3); ctx.lineTo(px + 3, py + s - 3); ctx.stroke();
            }
          }
        } else {
          const boom = this.boomAt && this.boomAt.x === x && this.boomAt.y === y;
          ctx.fillStyle = boom ? '#d02020' : '#bdbdbd'; ctx.fillRect(px, py, s, s);
          ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
          const v = this.grid[y][x];
          if (v === -1) {
            ctx.fillStyle = '#201e1d'; ctx.beginPath(); ctx.arc(px + s / 2, py + s / 2, s * 0.26, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#201e1d'; ctx.lineWidth = 1.5;
            for (const a of [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75]) {
              ctx.beginPath();
              ctx.moveTo(px + s / 2 - Math.cos(a) * s * 0.38, py + s / 2 - Math.sin(a) * s * 0.38);
              ctx.lineTo(px + s / 2 + Math.cos(a) * s * 0.38, py + s / 2 + Math.sin(a) * s * 0.38);
              ctx.stroke();
            }
            ctx.fillStyle = '#f3f2f2'; ctx.fillRect(px + s * 0.38, py + s * 0.38, s * 0.1, s * 0.1);
          } else if (v > 0) {
            txt(ctx, String(v), px + s / 2, py + s / 2 + 1, Math.floor(s * 0.62), NUMC[v], 'center');
          }
        }
      }
      const msgY = this.oy + bh + 26;
      if (this.state === 'win') {
        const best = getHS(this.hsKey);
        txt(ctx, '¡CAMPO LIMPIO! ' + Math.floor(this.time) + 's · MEJOR ' + best + 's · ENTER otra', W / 2, msgY, 14, '#0f7a0f', 'center');
      } else if (this.state === 'over') {
        txt(ctx, 'BOOM · ENTER o cara para reiniciar', W / 2, msgY, 14, '#d02020', 'center');
      } else {
        txt(ctx, 'clic abrir · clic derecho bandera · clic en número: acorde', W / 2, msgY, 11, '#4a4747', 'center');
      }
      if (this.paused) drawPause(ctx);
    }
  }

  /* ============================== PINBALL ESPACIAL ============================== */
  const RANKS = ['CADETE', 'PILOTO', 'CAPITÁN', 'COMANDANTE', 'ALMIRANTE', 'LEYENDA'];
  const MISSIONS = [
    { name: 'CALENTAMIENTO', goal: 'golpea 6 bumpers', type: 'bumper', n: 6, t: 45 },
    { name: 'DIANAS', goal: 'derriba las 3 dianas', type: 'target', n: 3, t: 45 },
    { name: 'ÓRBITA', goal: 'completa 2 órbitas', type: 'loop', n: 2, t: 50 },
    { name: 'REFLEJOS', goal: '4 slingshots', type: 'sling', n: 4, t: 40 },
    { name: 'CAOS', goal: '10 bumpers', type: 'bumper', n: 10, t: 40 }
  ];

  class Pinball {
    constructor(e, exit) {
      this.e = e; this.exit = exit; this.hsKey = 'pinball'; this.diff = getDiff();
      this.paused = false;
      this.gravity = [820, 900, 980][this.diff];
      this.ballsLeft = [4, 3, 3][this.diff];
      this.score = 0; this.rank = 0; this.missionIdx = -1; this.mission = null; this.missionsDone = 0;
      this.lanes = [false, false, false]; this.laneCool = [0, 0, 0];
      this.msgs = []; this.state = 'plunge'; this.charging = false; this.bankReset = 0;
      this.stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, a: Math.random() * 0.5 + 0.12 }));
      this.buildTable();
      this.newBall();
    }
    buildTable() {
      const S = (x1, y1, x2, y2, rest) => ({ x1, y1, x2, y2, rest: rest == null ? 0.5 : rest });
      this.segs = [
        S(14, 150, 14, 470),
        S(14, 150, 26, 96), S(26, 96, 64, 48), S(64, 48, 130, 20), S(130, 20, 200, 12),
        S(200, 12, 330, 12),
        S(330, 12, 400, 22), S(400, 22, 462, 52), S(462, 52, 494, 100), S(494, 100, 506, 160),
        S(506, 160, 506, 560),
        S(470, 200, 470, 470),
        S(14, 470, 150, 542, 0.3), S(470, 470, 370, 542, 0.3),
        S(150, 542, 183, 556, 0.2), S(370, 542, 337, 556, 0.2)
      ];
      this.oneWay = S(468, 172, 508, 172);
      this.slings = [
        { x1: 120, y1: 468, x2: 158, y2: 522, cool: 0, flash: 0 },
        { x1: 400, y1: 468, x2: 362, y2: 522, cool: 0, flash: 0 }
      ];
      this.bumpers = [
        { x: 170, y: 205, r: 24, flash: 0, c: '#ffd166' },
        { x: 310, y: 205, r: 24, flash: 0, c: '#17c0eb' },
        { x: 240, y: 292, r: 24, flash: 0, c: '#b06ee8' }
      ];
      this.lanesPos = [{ x: 195, y: 74 }, { x: 252, y: 64 }, { x: 309, y: 74 }];
      this.targets = [{ y: 240 }, { y: 286 }, { y: 332 }].map(t => ({ x: 26, y: t.y, w: 12, h: 36, up: true }));
      this.loop = { x: 84, y: 130, r: 20, cool: 0 };
    }
    newBall() {
      this.ball = { x: 488, y: 528, vx: 0, vy: 0 };
      this.state = 'plunge'; this.power = 0; this.charging = false;
      this.lf = { a: 0.42, vel: 0 }; this.rf = { a: 0.42, vel: 0 };
    }
    msg(s) { this.msgs.push({ s, t: 1.6 }); }
    event(type, e) {
      if (!this.mission || this.mission.type !== type) return;
      this.mission.count++;
      if (this.mission.count >= this.mission.n) {
        const bonus = 25000 * (this.rank + 1);
        this.score += bonus; this.missionsDone++;
        this.rank = Math.min(this.rank + 1, RANKS.length - 1);
        this.msg('¡MISIÓN CUMPLIDA! +' + bonus);
        this.msg('ASCENSO: ' + RANKS[this.rank]);
        this.mission = null;
        e.sfx.sweep(300, 1100, 0.6, 0.04);
      }
    }
    startMission(e) {
      this.missionIdx = (this.missionIdx + 1) % MISSIONS.length;
      const m = MISSIONS[this.missionIdx];
      this.mission = { name: m.name, goal: m.goal, type: m.type, n: m.n, count: 0, left: m.t + [10, 0, -5][this.diff] };
      this.lanes = [false, false, false];
      this.msg('MISIÓN: ' + m.name);
      this.msg(m.goal.toUpperCase());
      e.sfx.sweep(200, 800, 0.4);
    }
    segHit(b, s, rr) {
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len2 = dx * dx + dy * dy || 1;
      let t = ((b.x - s.x1) * dx + (b.y - s.y1) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const cx = s.x1 + t * dx, cy = s.y1 + t * dy;
      const ddx = b.x - cx, ddy = b.y - cy, d = Math.hypot(ddx, ddy);
      if (d >= rr || d === 0) return null;
      return { nx: ddx / d, ny: ddy / d, d, t, cx, cy };
    }
    resolveSeg(b, s, rr, rest) {
      const h = this.segHit(b, s, rr);
      if (!h) return null;
      b.x = h.cx + h.nx * rr; b.y = h.cy + h.ny * rr;
      const vn = b.vx * h.nx + b.vy * h.ny;
      if (vn < 0) { b.vx -= (1 + rest) * vn * h.nx; b.vy -= (1 + rest) * vn * h.ny; }
      return h;
    }
    capSpeed(b, max) {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
    }
    updFlipper(f, pressed, dt) {
      const target = pressed ? -0.58 : 0.42, prev = f.a, sp = 15;
      if (f.a > target) f.a = Math.max(target, f.a - sp * dt);
      else if (f.a < target) f.a = Math.min(target, f.a + sp * dt);
      f.vel = (f.a - prev) / Math.max(dt, 1e-4);
    }
    flipperSeg(side) {
      const len = 66;
      if (side === 'L') { const p = { x: 183, y: 548 }; return { x1: p.x, y1: p.y, x2: p.x + Math.cos(this.lf.a) * len, y2: p.y + Math.sin(this.lf.a) * len }; }
      const p = { x: 337, y: 548 }; return { x1: p.x, y1: p.y, x2: p.x - Math.cos(this.rf.a) * len, y2: p.y + Math.sin(this.rf.a) * len };
    }
    update(dt, e) {
      if (e.hit('Escape')) { this.exit(); return; }
      if (this.state === 'over') {
        if (e.hit('Enter')) {
          this.score = 0; this.rank = 0; this.missionIdx = -1; this.mission = null; this.missionsDone = 0;
          this.ballsLeft = [4, 3, 3][this.diff]; this.lanes = [false, false, false];
          this.buildTable(); this.newBall();
        }
        return;
      }
      if (pauseCheck(this, e)) return;
      const b = this.ball;
      this.updFlipper(this.lf, e.down('ArrowLeft') || e.down('KeyZ'), dt);
      this.updFlipper(this.rf, e.down('ArrowRight') || e.down('KeyX'), dt);
      // émbolo
      const holding = e.down('ArrowDown') || e.down('Space');
      if (this.state === 'plunge') {
        if (holding) { this.charging = true; this.power = Math.min(1, this.power + dt * 1.1); }
        else if (this.charging) {
          if (this.power > 0.05) { b.vy = -(560 + this.power * 540); e.sfx.sweep(150, 600, 0.25); }
          this.charging = false; this.power = 0;
        }
      } else if (b.x > 470 && b.y > 480 && Math.abs(b.vy) < 30 && Math.abs(b.vx) < 30) {
        this.state = 'plunge'; this.power = 0; this.charging = false;
      }
      if (this.state === 'plunge' && b.y < 200) this.state = 'play';
      // física
      const steps = 6, sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        b.vy += this.gravity * sdt;
        b.x += b.vx * sdt; b.y += b.vy * sdt;
        b.vx *= 0.9998; b.vy *= 0.9998;
        for (const s of this.segs) this.resolveSeg(b, s, 8, s.rest);
        if (b.vy > 0 && b.x > 462) this.resolveSeg(b, this.oneWay, 8, 0.2);
        for (const sl of this.slings) {
          if (sl.cool > 0) continue;
          const h = this.resolveSeg(b, sl, 10, 0.4);
          if (h) {
            b.vx += h.nx * 360; b.vy += h.ny * 360 - 60;
            sl.cool = 0.18; sl.flash = 0.15;
            this.score += 300; this.event('sling', e);
            e.sfx.beep(200, 0.06, 'sawtooth', 0.04);
          }
        }
        for (const bp of this.bumpers) {
          const dx = b.x - bp.x, dy = b.y - bp.y, d = Math.hypot(dx, dy);
          if (d < bp.r + 8 && d > 0) {
            const nx = dx / d, ny = dy / d;
            b.x = bp.x + nx * (bp.r + 8); b.y = bp.y + ny * (bp.r + 8);
            const sp = Math.max(380, Math.hypot(b.vx, b.vy) * 1.05);
            b.vx = nx * sp; b.vy = ny * sp;
            if (bp.flash <= 0) { this.score += 150; this.event('bumper', e); e.sfx.beep(520 + Math.random() * 200, 0.05, 'square', 0.035); }
            bp.flash = 0.15;
          }
        }
        for (const t of this.targets) {
          if (!t.up) continue;
          const h = this.resolveSeg(b, { x1: t.x + t.w, y1: t.y, x2: t.x + t.w, y2: t.y + t.h }, 8, 0.6);
          if (h) {
            t.up = false; this.score += 1200; this.event('target', e);
            e.sfx.sweep(700, 300, 0.15, 0.04);
            if (this.targets.every(x => !x.up)) { this.score += 5000; this.msg('BANCO COMPLETO +5000'); this.bankReset = 10; }
          }
        }
        // flippers
        for (const side of ['L', 'R']) {
          const f = side === 'L' ? this.lf : this.rf;
          const seg = this.flipperSeg(side);
          const h = this.resolveSeg(b, seg, 16, 0.25);
          if (h && f.vel < -2) {
            const boost = 400 + 500 * h.t;
            b.vx += h.nx * boost; b.vy += h.ny * boost - 100;
            e.sfx.beep(160, 0.05, 'triangle', 0.03);
          }
        }
        this.capSpeed(b, 980);
      }
      // sensores
      this.lanesPos.forEach((lp, i) => {
        this.laneCool[i] = Math.max(0, this.laneCool[i] - dt);
        if (this.laneCool[i] <= 0 && Math.hypot(b.x - lp.x, b.y - lp.y) < 15) {
          this.laneCool[i] = 0.8;
          if (!this.lanes[i]) { this.lanes[i] = true; this.score += 500; e.sfx.beep(660, 0.06); }
          if (this.lanes.every(Boolean) && !this.mission) this.startMission(e);
        }
      });
      this.loop.cool = Math.max(0, this.loop.cool - dt);
      if (this.loop.cool <= 0 && Math.hypot(b.x - this.loop.x, b.y - this.loop.y) < this.loop.r) {
        this.loop.cool = 1.2; this.score += 3000; this.event('loop', e);
        this.msg('ÓRBITA +3000'); e.sfx.sweep(400, 1000, 0.3);
      }
      // misión
      if (this.mission) {
        this.mission.left -= dt;
        if (this.mission.left <= 0) { this.mission = null; this.msg('MISIÓN FALLIDA'); e.sfx.sweep(400, 100, 0.5); }
      }
      if (this.bankReset > 0) {
        this.bankReset -= dt;
        if (this.bankReset <= 0) for (const t of this.targets) t.up = true;
      }
      for (const sl of this.slings) { sl.cool = Math.max(0, sl.cool - dt); sl.flash = Math.max(0, sl.flash - dt); }
      for (const bp of this.bumpers) bp.flash = Math.max(0, bp.flash - dt);
      this.msgs = this.msgs.filter(m => (m.t -= dt) > 0);
      // desagüe
      if (b.y > H + 24) {
        this.ballsLeft--;
        if (this.ballsLeft <= 0) {
          this.state = 'over';
          if (this.score > getHS(this.hsKey)) setHS(this.hsKey, this.score);
        } else { this.msg('BOLA PERDIDA'); this.mission = null; this.newBall(); }
        e.sfx.sweep(300, 70, 0.5, 0.05);
      }
    }
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#070a1e'); g.addColorStop(1, '#170b30');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const s of this.stars) { ctx.globalAlpha = s.a; ctx.fillStyle = '#f3f2f2'; ctx.fillRect(s.x, s.y, 2, 2); }
      ctx.globalAlpha = 1;
      // muros
      ctx.strokeStyle = '#4d5dff'; ctx.lineWidth = 3; ctx.shadowColor = '#4d5dff'; ctx.shadowBlur = 6;
      for (const s of this.segs) { ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke(); }
      ctx.shadowBlur = 0;
      // órbita
      ctx.strokeStyle = '#3ae374'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(this.loop.x, this.loop.y, this.loop.r, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      txt(ctx, 'ÓRBITA', this.loop.x, this.loop.y, 8, '#3ae374', 'center');
      // luces de carril
      this.lanesPos.forEach((lp, i) => {
        if (this.lanes[i]) {
          ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 12;
          ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(lp.x, lp.y, 9, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(lp.x, lp.y, 9, 0, Math.PI * 2); ctx.stroke();
        }
      });
      // bumpers
      for (const bp of this.bumpers) {
        const lit = bp.flash > 0;
        ctx.shadowColor = bp.c; ctx.shadowBlur = lit ? 22 : 10;
        const rg = ctx.createRadialGradient(bp.x, bp.y, 3, bp.x, bp.y, bp.r);
        rg.addColorStop(0, lit ? '#ffffff' : bp.c); rg.addColorStop(1, '#101426');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(bp.x, bp.y, bp.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = bp.c; ctx.lineWidth = 2; ctx.stroke();
      }
      // slingshots
      for (const sl of this.slings) {
        ctx.fillStyle = sl.flash > 0 ? '#ffffff' : '#ff2e63';
        ctx.shadowColor = '#ff2e63'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(sl.x1, sl.y1); ctx.lineTo(sl.x2, sl.y2);
        ctx.lineTo(sl.x1 + (sl.x1 < W / 2 ? 6 : -6), sl.y2); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
      }
      // dianas
      for (const t of this.targets) {
        if (t.up) {
          ctx.shadowColor = '#ffd166'; ctx.shadowBlur = 8;
          ctx.fillStyle = '#ffd166'; ctx.fillRect(t.x, t.y, t.w, t.h);
          ctx.shadowBlur = 0;
        } else { ctx.strokeStyle = 'rgba(255,209,102,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(t.x, t.y, t.w, t.h); }
      }
      // flippers
      for (const side of ['L', 'R']) {
        const seg = this.flipperSeg(side);
        ctx.strokeStyle = '#f3f2f2'; ctx.lineWidth = 15; ctx.lineCap = 'round';
        ctx.shadowColor = '#17c0eb'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ec3013'; ctx.beginPath(); ctx.arc(seg.x1, seg.y1, 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineCap = 'butt';
      // émbolo
      const ph = 26 - this.power * 18;
      ctx.fillStyle = '#ec3013'; ctx.fillRect(478, 566 - ph + 26, 20, ph);
      ctx.fillStyle = '#9b9797'; ctx.fillRect(476, 590, 24, 6);
      // bola
      const b = this.ball;
      const rg = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, 8);
      rg.addColorStop(0, '#ffffff'); rg.addColorStop(1, '#8a8f9e');
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 8;
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // HUD
      txt(ctx, 'PUNTOS ' + this.score, 24, 26, 14, '#f3f2f2');
      txt(ctx, 'BOLAS ' + this.ballsLeft, 24, 46, 12, '#9b9797');
      txt(ctx, RANKS[this.rank], 446, 26, 12, '#ffd166', 'right');
      if (this.mission) {
        txt(ctx, this.mission.name + ' ' + this.mission.count + '/' + this.mission.n + ' · ' + Math.ceil(this.mission.left) + 's', W / 2, 105, 13, '#3ae374', 'center');
      } else {
        txt(ctx, 'enciende las 3 luces → misión', W / 2, 105, 11, 'rgba(243,242,242,0.45)', 'center');
      }
      this.msgs.forEach((m, i) => txt(ctx, m.s, W / 2, 360 + i * 24, 17, '#ffd166', 'center'));
      if (this.state === 'plunge') txt(ctx, 'MANTÉN ↓ Y SUELTA', 424, 500, 10, '#9b9797', 'center');
      txt(ctx, '←→ flippers', 24, H - 14, 10, '#605d5d');
      if (this.state === 'over') drawOver(ctx, 'FIN DEL JUEGO', 'PUNTOS ' + this.score + ' · RANGO ' + RANKS[this.rank] + ' · HI ' + Math.max(this.score, getHS(this.hsKey)));
      if (this.paused) drawPause(ctx);
    }
  }

  /* ============================== GABINETE ============================== */
  class ArcadeCabinet extends HTMLElement {
    connectedCallback() {
      if (this._built) return;
      this._built = true;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap');</style>
        <div style="max-width:640px;margin:0 auto;background:#1c1a19;border:2px solid rgba(243,242,242,0.14);box-shadow:0 24px 60px rgba(0,0,0,0.5)">
          <div style="background:#ec3013;padding:14px 20px;display:flex;align-items:baseline;justify-content:space-between;border-bottom:2px solid rgba(0,0,0,0.3)">
            <span style="font-family:Archivo,sans-serif;font-weight:800;font-size:26px;letter-spacing:0.12em;color:#f3f2f2">GAME ROOM</span>
            <span style="font-family:Archivo,sans-serif;font-weight:600;font-size:11px;letter-spacing:0.14em;color:rgba(243,242,242,0.75)">EASTER EGG · ARCADE</span>
          </div>
          <div style="background:#000;padding:20px;position:relative">
            <canvas width="${W}" height="${H}" style="display:block;width:100%;background:#060606" tabindex="0"></canvas>
            <div style="position:absolute;inset:20px;pointer-events:none;background:repeating-linear-gradient(rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)"></div>
            <div style="position:absolute;inset:20px;pointer-events:none;background:radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.4) 100%)"></div>
          </div>
          <div style="padding:16px 20px 20px;display:flex;align-items:center;gap:24px;border-top:2px solid rgba(243,242,242,0.14)">
            <div style="display:flex;align-items:center;gap:18px;flex:none">
              <div style="width:52px;height:52px;background:#141212;border:2px solid rgba(243,242,242,0.14);display:grid;place-items:center">
                <div style="width:18px;height:18px;background:#ec3013;border-radius:50%;box-shadow:0 -8px 0 -4px rgba(243,242,242,0.25)"></div>
              </div>
              <div style="display:flex;gap:10px">
                <div style="width:26px;height:26px;background:#ec3013;border-radius:50%;box-shadow:inset 0 -4px 0 rgba(0,0,0,0.35)"></div>
                <div style="width:26px;height:26px;background:#ec3013;border-radius:50%;box-shadow:inset 0 -4px 0 rgba(0,0,0,0.35)"></div>
              </div>
            </div>
            <div style="font-family:Archivo,sans-serif;font-size:11px;line-height:1.7;color:#9b9797;letter-spacing:0.04em">
              FLECHAS / WASD mover · ESPACIO acción · ENTER aceptar · P pausa<br>
              1-3 poderes en TETRIS · ratón en MINESWEEPER · ESC menú · M silenciar
            </div>
          </div>
        </div>`;
      const canvas = root.querySelector('canvas');
      this.sfx = new SFX();
      const eng = this.eng = new Engine(canvas, this.sfx);
      const keys = ['pac', 'blocks', 'invaders', 'pong', 'bricks', '', ''];
      const defs = [
        { name: 'PAC-MAN', desc: 'Laberinto, pastillas y cuatro fantasmas', hs: getHS('pac'), make: (ex) => new Pacman(eng, ex) },
        { name: 'TETRIS', desc: 'Encaja piezas y desbloquea poderes', hs: getHS('blocks'), make: (ex) => new Tetris(eng, ex) },
        { name: 'SPACE INVADERS', desc: 'Defiende la base del enjambre', hs: getHS('invaders'), make: (ex) => new Invaders(eng, ex) },
        { name: 'PONG', desc: 'Duelo de paletas · la CPU sube de nivel', hs: getHS('pong'), make: (ex) => new Pong(eng, ex) },
        { name: 'BREAKOUT', desc: 'Neón, power-ups y multibola', hs: getHS('bricks'), make: (ex) => new Breakout(eng, ex) },
        { name: 'MINESWEEPER', desc: 'Clásico de escritorio · se juega con ratón', hs: getHS('mines' + getDiff()), make: (ex) => new Mines(eng, ex) },
        { name: 'DOOM', desc: 'Shooter clásico · niveles completos con Freedoom', hs: 0, external: true }
      ];
      const toMenu = () => { defs.forEach((d, i) => d.hs = i === 5 ? getHS('mines' + getDiff()) : getHS(keys[i])); eng.setScene(new Menu(eng, defs, launch)); };
      const launch = (i) => {
        const d = defs[i];
        if (d.external) { window.dispatchEvent(new CustomEvent('arcade-open-doom')); return; }
        eng.setScene(d.make(toMenu));
      };
      eng.setScene(new Menu(eng, defs, launch));

      this._onKeyDown = (ev) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
        if (ev.code === 'KeyM' && !ev.repeat) { this.sfx.muted = !this.sfx.muted; eng.toast(this.sfx.muted ? 'SONIDO: OFF' : 'SONIDO: ON'); }
        if (!ev.repeat) eng.pressed.add(ev.code);
        eng.keys.add(ev.code);
        this.sfx.ensure();
      };
      this._onKeyUp = (ev) => eng.keys.delete(ev.code);
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      canvas.addEventListener('click', (ev) => {
        const r = canvas.getBoundingClientRect();
        eng.clicks.push({ x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height });
        this.sfx.ensure();
      });
      canvas.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        const r = canvas.getBoundingClientRect();
        eng.rightClicks.push({ x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height });
        this.sfx.ensure();
      });
      canvas.addEventListener('mousemove', (ev) => {
        const r = canvas.getBoundingClientRect();
        eng.mouseX = (ev.clientX - r.left) * W / r.width;
        eng.mouseMoved = true;
      });
      eng.start();
    }
    disconnectedCallback() {
      if (this.eng) this.eng.stop();
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
    }
  }
  /* ============================== SOTOS: UN JUEGO SUELTO ==============================
     <arcade-solo game="pac|blocks|invaders|pong|bricks|mines">: el mismo motor, sin gabinete ni menú.
     Esc sale (evento "arcade-exit"); cualquier otra salida del juego vuelve a empezar la partida.
     Añadido para Sotos · © 2026 Sebastian Sotomontes */
  class ArcadeSolo extends HTMLElement {
    connectedCallback() {
      if (this._built) return;
      this._built = true;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>:host{display:grid;place-items:center;width:100%;height:100%;background:#060606;overflow:hidden}
        .wrap{position:relative;height:100%;max-width:100%;aspect-ratio:${W}/${H}}
        canvas{display:block;width:100%;height:100%;outline:none;background:#060606}
        .crt{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(rgba(0,0,0,0.22) 0px,rgba(0,0,0,0.22) 1px,transparent 1px,transparent 3px)}</style>
        <div class="wrap"><canvas width="${W}" height="${H}" tabindex="0"></canvas><div class="crt"></div></div>`;
      const canvas = root.querySelector('canvas');
      this.sfx = new SFX();
      const eng = this.eng = new Engine(canvas, this.sfx);
      const MAKERS = { pac: (ex) => new Pacman(eng, ex), blocks: (ex) => new Tetris(eng, ex), invaders: (ex) => new Invaders(eng, ex), pong: (ex) => new Pong(eng, ex), bricks: (ex) => new Breakout(eng, ex), mines: (ex) => new Mines(eng, ex) };
      const make = MAKERS[this.getAttribute('game')] || MAKERS.pac;
      const exit = () => {
        if (eng.pressed.has('Escape') || eng.keys.has('Escape')) { this.dispatchEvent(new CustomEvent('arcade-exit', { bubbles: true, composed: true })); eng.setScene(null); return; }
        eng.setScene(make(exit));
      };
      eng.setScene(make(exit));
      this._onKeyDown = (ev) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
        if (ev.code === 'KeyM' && !ev.repeat) { this.sfx.muted = !this.sfx.muted; eng.toast(this.sfx.muted ? 'SONIDO: OFF' : 'SONIDO: ON'); }
        if (!ev.repeat) eng.pressed.add(ev.code);
        eng.keys.add(ev.code);
        this.sfx.ensure();
      };
      this._onKeyUp = (ev) => eng.keys.delete(ev.code);
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      const at = (ev) => { const r = canvas.getBoundingClientRect(); return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height }; };
      canvas.addEventListener('click', (ev) => { eng.clicks.push(at(ev)); this.sfx.ensure(); canvas.focus(); });
      canvas.addEventListener('contextmenu', (ev) => { ev.preventDefault(); eng.rightClicks.push(at(ev)); this.sfx.ensure(); });
      canvas.addEventListener('mousemove', (ev) => { eng.mouseX = at(ev).x; eng.mouseMoved = true; });
      eng.start();
      canvas.focus();
    }
    disconnectedCallback() {
      if (this.eng) this.eng.stop();
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
    }
  }
  customElements.define('arcade-solo', ArcadeSolo);

  customElements.define('arcade-cabinet', ArcadeCabinet);
})();
