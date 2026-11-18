/* Páramo Pinball — reglas genéricas y estado de partida (sin DOM)
 * © 2026 Sebastian Sotomontes.
 * Cada mesa (src/tables/*.js) aporta geometría + reglas declarativas + misiones.
 */
(function (G) {
  'use strict';
  const PB = (G.PB = G.PB || {});
  const P = PB.phys;

  const BALLS_PER_GAME = 3;
  const BALL_SAVE_S = 10;
  const PTS = { bumper: 1000, sling: 110, drop: 750, bank: 5000, target: 1000, targets: 7500, lane: 500, spin: 150, ramp: 2500, hole: 3000, rollover: 1000, inlane: 250, outlane: 1500 };

  function bez(p, t) {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], y: a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1] };
  }
  const fmt = (n) => Math.round(n).toLocaleString('es-CO');

  /* Claves de evento que representa cada objeto (para resaltar objetivos de misión). */
  function keysOf(kind, o) {
    switch (kind) {
      case 'bumper': return ['bumper'];
      case 'drop': return ['drop', 'drop:' + o.bank, 'bank:' + o.bank];
      case 'target': return ['target', 'target:' + o.id, 'targets', 'targets:' + o.group];
      case 'lane': return ['lane', 'lanes'];
      case 'spinner': return ['spin', 'spin:' + o.id];
      case 'ramp': return ['ramp', 'ramp:' + o.id];
      case 'hole': return ['hole', 'hole:' + o.id];
      case 'rollover': return ['rollover:' + o.id].concat(o.orbit ? ['orbit'] : []);
      default: return [];
    }
  }

  class Game {
    constructor(opts) {
      this.opts = opts || {};
      this.sfx = this.opts.sfx || (() => {});
      this.def = PB.tables[this.opts.table || 'paramo'];
      this.reset();
      this.state = 'attract';
    }

    reset() {
      const k = PB.kit.create();
      this.def.build(k);
      const t = k.t;
      this.t = t;
      this.R = this.def.rules || {};
      this.world = { balls: [], colliders: t.colliders, flippers: t.flippers, sensors: t.sensors, gravity: 1350 };
      this.score = 0; this.ball = 1; this.extraBalls = 0;
      this.mult = 1; this.rank = 0; this.mission = null; this.completed = new Set(); this.wizardDone = 0;
      this.lanes = t.items.lanes.map(() => false); this.skillLane = -1; this.skillArmed = false;
      this.bumperLevel = 1; this.rampCombo = 0; this.rampTimer = 0;
      this.missionLit = true; this.multiball = false; this.jackpots = 0;
      this.counters = {}; this.lockLit = false; this.locked = 0; this.kickbackLit = !!this.R.kickback;
      this.ballSave = 0; this.ballSaveStarted = false; this.tiltMeter = 0; this.tilted = false;
      this.bonus = 0; this.messages = []; this.time = 0; this.plungerPull = 0; this.plungerHeld = false;
      this.stats = { bumpers: 0, spins: 0, drops: 0, ramps: 0, lanes: 0, missions: 0, saves: 0, drains: 0, holes: 0, targets: 0, locks: 0, multiballs: 0, jackpots: 0, kickbacks: 0 };
      this.timers = []; this.fx = []; this.tunnelFx = null;
      for (const b of Object.values(t.items.drops)) for (const d of b.list) d.enabled = true;
      for (const tg of t.items.targets) tg.lit = false;
    }

    get ranks() { return this.def.ranks; }
    get rankName() { return this.def.ranks[this.rank]; }
    msg(text, secs) { this.messages.push({ text, until: this.time + (secs || 2.5) }); if (this.messages.length > 4) this.messages.shift(); }
    get message() { const m = this.messages.filter((m) => m.until > this.time); return m.length ? m[m.length - 1].text : null; }
    add(pts) { if (!this.tilted) this.score += Math.round(pts); }
    after(secs, fn) { this.timers.push({ at: this.time + secs, fn }); }
    effect(kind, color) { this.fx.push({ kind, color, t0: this.time }); if (this.fx.length > 8) this.fx.shift(); }

    start() { this.reset(); this.state = 'playing'; this.newBall(); this.msg(this.def.welcome || '¡A jugar!', 3); }

    newBall() {
      const L = this.t.launch;
      this.world.balls.push(P.makeBall(L.x, L.y));
      this.tilted = false; this.tiltMeter = 0;
      this.ballSave = BALL_SAVE_S; this.ballSaveStarted = false;
      this.skillLane = Math.floor(Math.random() * Math.max(1, this.lanes.length)); this.skillArmed = this.lanes.length > 0;
      for (const f of this.world.flippers) f.enabled = true;
      this.sfx('ready');
    }

    inLane(b) { return b.x > 540 && b.y > 340; }

    /* --- controles ------------------------------------------------------- */
    flip(side, down) {
      const fl = this.world.flippers.filter((f) => f.group === side);
      if (down && fl.length && !fl[0].pressed && !this.tilted && this.state === 'playing') {
        this.sfx('flip');
        if (this.lanes.length) {
          if (side === 'L') this.lanes.push(this.lanes.shift()); else this.lanes.unshift(this.lanes.pop());
          if (this.skillArmed && this.world.balls.some((b) => this.inLane(b))) this.skillLane = (this.skillLane + (side === 'L' ? this.lanes.length - 1 : 1)) % this.lanes.length;
        }
      }
      for (const f of fl) f.pressed = !!down;
    }
    plunger(down) {
      if (this.state !== 'playing') return;
      if (down) this.plungerHeld = true;
      else if (this.plungerHeld) { this.plungerHeld = false; this.release(); }
    }
    release() {
      const power = this.plungerPull; this.plungerPull = 0;
      let launched = false;
      for (const b of this.world.balls) if (this.inLane(b) && b.y > 900 && !b.held) { b.vy = -(700 + power * 1650); b.vx = 0; launched = true; }
      if (launched) { this.sfx('launch'); if (!this.ballSaveStarted) { this.ballSaveStarted = true; this.ballSave = BALL_SAVE_S; } }
    }
    nudge(dir) {
      if (this.state !== 'playing' || this.tilted) return;
      for (const b of this.world.balls) { if (b.held || b.ramp) continue; b.vx += dir * 140; b.vy -= 90; }
      this.tiltMeter += 1; this.sfx('nudge');
      if (this.tiltMeter > 3.2) {
        this.tilted = true; this.msg('¡TILT!', 4); this.sfx('tilt');
        for (const f of this.world.flippers) { f.enabled = false; f.pressed = false; }
      } else if (this.tiltMeter > 2.2) this.msg('Cuidado…', 1.5);
    }

    /* --- bucle --------------------------------------------------------- */
    update(dt) {
      this.time += dt;
      if (this.state !== 'playing') { for (const f of this.world.flippers) P.updateFlipper(f, dt); return; }
      this.tiltMeter = Math.max(0, this.tiltMeter - dt * 0.7);
      if (this.plungerHeld) this.plungerPull = Math.min(1, this.plungerPull + dt * 1.1);
      if (this.ballSaveStarted && this.ballSave > 0) this.ballSave -= dt;
      if (this.rampTimer > 0) { this.rampTimer -= dt; if (this.rampTimer <= 0) this.rampCombo = 0; }
      if (this.timers.length) {
        const due = this.timers.filter((x) => x.at <= this.time);
        this.timers = this.timers.filter((x) => x.at > this.time);
        for (const x of due) x.fn();
      }

      for (const b of this.world.balls) {
        if (b.held && !b.held.locked && this.time >= b.held.until) {
          const to = b.held.tunnelTo;
          if (to) { b.x = to.x; b.y = to.y; b.sensors.add(to.sensor); b.hidden = false; }
          const e = b.held.eject; b.held = null; b.vx = e[0]; b.vy = e[1]; this.sfx('kick');
        }
        if (b.ramp) {
          const r = b.ramp.r;
          b.ramp.t += dt / r.dur;
          const p = bez(r.path, Math.min(1, b.ramp.t));
          b.x = p.x; b.y = p.y;
          if (b.ramp.t >= 1) { b.ramp = null; b.vx = r.exit[0]; b.vy = r.exit[1]; }
        }
      }

      const events = P.step(this.world, dt, 8);
      for (const ev of events) this.handle(ev);

      for (const sp of this.t.items.spinners) {
        if (sp.spin <= 0) continue;
        const before = Math.floor(sp.angle / Math.PI);
        sp.angle += sp.spin * dt; sp.spin = Math.max(0, sp.spin - dt * 18);
        const turns = Math.floor(sp.angle / Math.PI) - before;
        for (let i = 0; i < turns; i++) this.onSpin(sp);
      }
      for (const bm of this.t.items.bumpers) bm.flash = Math.max(0, bm.flash - dt * 4);
      for (const s of this.t.items.slings) s.flash = Math.max(0, s.flash - dt * 5);

      if (this.mission) {
        this.mission.left -= dt;
        if (this.mission.left <= 0) { this.msg(`Misión fallida: ${this.mission.def.name}`, 3); this.sfx('fail'); this.mission = null; }
      }

      for (const b of this.world.balls) if (b.alive && (b.y > this.t.drainY || !isFinite(b.x) || !isFinite(b.y))) b.alive = false;
      const lost = this.world.balls.filter((b) => !b.alive);
      if (lost.length) { this.world.balls = this.world.balls.filter((b) => b.alive); for (const _ of lost) this.onDrain(); }
    }

    activeBalls() { return this.world.balls.filter((b) => !(b.held && b.held.locked)); }

    onDrain() {
      const remaining = this.activeBalls().length;
      if (this.ballSave > 0 && this.ballSaveStarted && !this.tilted) {
        this.stats.saves++; this.msg('¡Bola salvada!', 2); this.sfx('save'); this.autoLaunch(); return;
      }
      if (remaining > 0) {
        if (remaining === 1 && this.multiball) { this.multiball = false; this.msg('Fin de la multibola', 2); }
        return;
      }
      this.stats.drains++;
      this.multiball = false;
      const bonus = this.tilted ? 0 : (this.bonus + 1000) * this.mult;
      this.add(bonus); this.lastBonus = bonus;
      this.msg(this.tilted ? 'Bola perdida (tilt)' : `Bonus ${fmt(bonus)}`, 3);
      this.sfx('drain');
      this.bonus = 0; this.mult = 1; this.mission = null;
      if (this.R.kickback) this.kickbackLit = true;
      if (this.extraBalls > 0) { this.extraBalls--; this.msg('¡Bola extra!', 3); this.newBall(); return; }
      this.ball++;
      if (this.ball > BALLS_PER_GAME) {
        this.state = 'over'; this.ball = BALLS_PER_GAME; this.sfx('over');
        // bolas retenidas en captura se descartan
        this.world.balls = [];
        if (this.opts.onGameOver) this.opts.onGameOver(this.score);
        return;
      }
      this.newBall();
    }

    autoLaunch() { const L = this.t.launch; this.world.balls.push(P.makeBall(L.x, L.y - 4, 0, -2100)); }
    serveToPlunger() { const L = this.t.launch; this.world.balls.push(P.makeBall(L.x, L.y)); }

    /* --- eventos físicos -> claves de regla ----------------------------- */
    handle(ev) {
      if (ev.type === 'flipper') return;
      const tag = ev.tag, o = ev.obj, b = ev.ball;
      if (ev.type === 'hit') {
        // un roce lento (bola apoyada) no cuenta como impacto
        if (ev.speed < (tag === 'drop' || tag === 'target' ? 60 : 25)) return;
        if (tag === 'bumper') {
          o.flash = 1; this.stats.bumpers++; this.add(PTS.bumper * this.bumperLevel); this.bonus += 50; this.sfx('bumper', o.idx % 3);
          if (this.stats.bumpers % 25 === 0 && this.bumperLevel < 5) { this.bumperLevel++; this.msg(`${this.def.names.bumper} nivel ${this.bumperLevel}`); }
          this.fire('bumper');
        } else if (tag === 'sling') {
          this.t.items.slings[o.idx].flash = 1; this.add(PTS.sling); this.sfx('sling'); this.fire('sling');
        } else if (tag === 'drop') {
          o.enabled = false; this.stats.drops++; this.add(PTS.drop); this.bonus += 150; this.sfx('drop');
          this.fire('drop'); this.fire('drop:' + o.bank);
          const bank = this.t.items.drops[o.bank];
          if (bank.list.every((d) => !d.enabled)) {
            this.add(PTS.bank); this.msg(`¡${bank.label} completos!`, 2.5); this.sfx('complete');
            this.after(bank.reset, () => { for (const d of bank.list) d.enabled = true; this.sfx('reset'); });
            this.fire('bank:' + o.bank);
          }
        } else if (tag === 'target') {
          this.stats.targets++; this.add(PTS.target); this.bonus += 100; this.sfx('drop');
          if (!o.lit) { o.lit = true; this.fire('target'); this.fire('target:' + o.id); }
          const grp = this.t.items.targets.filter((x) => x.group === o.group);
          if (grp.every((x) => x.lit)) {
            this.add(PTS.targets); this.sfx('complete');
            this.msg(`¡${this.def.names[o.group] || 'Dianas'} completas!`, 2.5);
            this.after(1.2, () => grp.forEach((x) => (x.lit = false)));
            this.fire('targets'); this.fire('targets:' + o.group);
          }
        }
        return;
      }
      if (ev.type !== 'sensor') return;
      if (tag === 'lane') this.onLane(o);
      else if (tag === 'spinner') { o.spin = Math.min(60, o.spin + Math.hypot(b.vx, b.vy) / 45); this.skillArmed = false; }
      else if (tag === 'ramp') {
        const r = this.t.items.ramps.find((x) => x.sensor === o);
        if (r && !b.ramp && b.vx * r.dir[0] + b.vy * r.dir[1] > 250) this.onRamp(b, r);
      } else if (tag === 'hole') {
        const h = this.t.items.holes.find((x) => x.sensor === o);
        if (h && !b.held && !b.ramp) this.onHole(b, h);
      } else if (tag === 'rollover') {
        this.add(PTS.rollover); this.sfx('roll'); this.fire('rollover:' + o.id); if (o.orbit) this.fire('orbit');
      } else if (tag === 'inlane') { this.add(PTS.inlane); this.sfx('roll'); this.skillArmed = false; }
      else if (tag === 'outlane') { this.add(PTS.outlane); this.sfx('roll'); }
      else if (tag === 'kickback') {
        if (this.kickbackLit && !this.tilted) {
          this.kickbackLit = false; this.stats.kickbacks++;
          b.vx = 30; b.vy = -1550; this.sfx('kick');
          this.msg(`¡${this.def.names.kickback || 'Kickback'}!`, 2);
        }
      }
    }

    onLane(o) {
      const i = o.idx;
      this.stats.lanes++; this.add(PTS.lane); this.bonus += 100; this.sfx('lane');
      if (this.skillArmed) {
        this.skillArmed = false;
        if (i === this.skillLane) { this.add(15000); this.msg('¡Tiro de habilidad! 15.000', 3); this.sfx('skill'); this.fire('skill'); }
      }
      if (!this.lanes[i]) { this.lanes[i] = true; this.fire('lane'); }
      if (this.lanes.every(Boolean)) {
        this.lanes = this.lanes.map(() => false);
        if (this.mult < 6) this.mult++;
        this.msg(`Multiplicador ×${this.mult}`); this.sfx('complete');
        this.effect('lanes');
        this.fire('lanes');
      }
    }

    onSpin(sp) {
      this.stats.spins++;
      const hot = this.isHot(['spin', 'spin:' + sp.id]);
      this.add(hot ? 600 : PTS.spin); this.bonus += 10; this.sfx('spin');
      this.fire('spin'); this.fire('spin:' + sp.id);
    }

    onRamp(b, r) {
      this.stats.ramps++;
      b.ramp = { t: 0, r }; b.vx = 0; b.vy = 0;
      this.rampCombo = this.rampTimer > 0 ? this.rampCombo + 1 : 1; this.rampTimer = 4;
      this.add(PTS.ramp * this.rampCombo); this.bonus += 300; this.sfx('ramp');
      if (this.rampCombo > 1) this.msg(`Combo ×${this.rampCombo}`);
      this.fire('ramp'); this.fire('ramp:' + r.id);
    }

    onHole(b, h) {
      this.stats.holes++;
      const lock = this.R.multiball && this.R.multiball.type === 'lock' && this.R.multiball.hole === h.id;
      b.x = h.x; b.y = h.y; b.vx = 0; b.vy = 0;
      if (h.tunnel) {
        // túnel subterráneo: la bola desaparece y sale por otro agujero
        const to = this.t.items.holes.find((x) => x.id === h.tunnel.to);
        const dur = h.tunnel.time || 1.2;
        b.hidden = true;
        b.held = { until: this.time + dur, eject: to.eject, tunnelTo: to };
        this.tunnelFx = { from: h, to, t0: this.time, dur };
        this.stats.tunnels = (this.stats.tunnels || 0) + 1;
        this.add(5000); this.bonus += 250; this.sfx('tunnel');
        this.msg(`¡${h.tunnel.name || 'Túnel'}! 5.000`, 2);
        this.effect('flash', this.def.theme.accent2);
        this.fire('hole'); this.fire('hole:' + h.id); this.fire('tunnel');
        return;
      }
      this.sfx('sink');
      if (lock && this.lockLit && !this.multiball) {
        b.held = { locked: true, until: Infinity, eject: h.eject };
        this.lockLit = false; this.locked++; this.stats.locks++;
        this.add(10000);
        const need = this.R.multiball.locks;
        if (this.locked >= need) { this.releaseLocks(h); }
        else { this.msg(`Bola capturada ${this.locked}/${need}`, 3); this.sfx('complete'); this.serveToPlunger(); }
        this.fire('hole'); this.fire('hole:' + h.id);
        return;
      }
      b.held = { until: this.time + h.hold, eject: h.eject };
      if (h.id === this.R.missionHole && this.missionLit && !this.mission) this.startMission();
      else this.add(PTS.hole);
      this.fire('hole'); this.fire('hole:' + h.id);
    }

    releaseLocks(h) {
      let k = 0;
      for (const b of this.world.balls) if (b.held && b.held.locked) { b.held = { until: this.time + 0.4 + k * 0.6, eject: h.eject }; k++; }
      this.locked = 0;
      this.startMultiball(0);
    }

    startMultiball(extra) {
      this.multiball = true; this.jackpots = 0; this.stats.multiballs++;
      this.msg(`¡${this.def.names.multiball}! Multibola`, 4); this.sfx('multiball');
      this.effect('sweep', '#ffffff'); this.effect('flash', '#ff6b6b');
      this.ballSave = 8; this.ballSaveStarted = true;
      for (let i = 0; i < extra; i++) this.after(0.6 * i, () => this.autoLaunch());
    }

    /* --- reglas declarativas ------------------------------------------- */
    fire(key) {
      const R = this.R;
      // progreso de misión
      if (this.mission) this.progress(key);
      // encender el agujero de misiones
      if (R.lightMission && R.lightMission.includes(key) && !this.mission && !this.missionLit) {
        this.missionLit = true; this.msg(`${this.def.names.missionHole} encendida: ¡nueva misión!`, 3); this.sfx('complete');
      }
      // multibola
      const mb = R.multiball;
      if (mb && !this.multiball) {
        if (mb.type === 'count' && key === mb.ev) {
          this.counters[key] = (this.counters[key] || 0) + 1;
          const c = this.counters[key] % mb.every;
          if (c === 0) this.startMultiball(mb.balls || 1);
          else this.msg(`${this.def.names.multiball}: ${c}/${mb.every}`);
        } else if (mb.type === 'lock' && key === mb.lightEv && !this.lockLit) {
          this.counters[key] = (this.counters[key] || 0) + 1;
          if (this.counters[key] % mb.lightN === 0) { this.lockLit = true; this.msg(`¡Captura encendida en ${this.def.names.lock}!`, 3); this.sfx('complete'); }
          else this.msg(`Captura ${this.counters[key] % mb.lightN}/${mb.lightN}`);
        }
      }
      // jackpot
      if (this.multiball && R.jackpot === key) {
        this.jackpots++; this.stats.jackpots++;
        const v = 25000 * this.jackpots; this.add(v); this.msg(`¡JACKPOT ${fmt(v)}!`, 3); this.sfx('jackpot');
        this.effect('flash', '#ffd36b'); this.effect('sweep', '#ffd36b');
      }
      // kickback
      if (R.kickback && R.kickback.relight === key && !this.kickbackLit) { this.kickbackLit = true; this.msg(`${this.def.names.kickback} listo`); }
      if (R.onEvent) R.onEvent(this, key);
    }

    tierOf(rank) { return Math.min(2, Math.floor(rank * 3 / this.ranks.length)); }

    startMission() {
      const all = this.def.missions;
      const tier = this.tierOf(this.rank);
      let pool = all.filter((m) => !m.wizard && m.tier <= tier && !this.completed.has(m.id));
      if (!pool.length) {
        const wiz = all.find((m) => m.wizard);
        const normalsDone = all.filter((m) => !m.wizard).every((m) => this.completed.has(m.id));
        if (wiz && normalsDone && this.rank >= this.ranks.length - 1) pool = [wiz];
        else { pool = all.filter((m) => !m.wizard && m.tier <= tier); }
      }
      const def = pool[Math.floor(Math.random() * pool.length)];
      this.missionLit = false;
      this.mission = { def, step: 0, count: 0, left: def.time };
      this.effect('sweep', '#58d8ff');
      this.add(5000);
      this.msg(`Misión: ${def.name} — ${def.steps[0].label}`, 4);
      this.sfx(def.wizard ? 'multiball' : 'complete');
      if (def.multiball && !this.multiball) this.startMultiball(def.multiball);
    }

    get missionStep() { return this.mission ? this.mission.def.steps[this.mission.step] : null; }
    isHot(keys) { const s = this.missionStep; return !!s && keys.includes(s.ev); }
    hotKind(kind, o) { return this.isHot(keysOf(kind, o)); }

    progress(key) {
      const m = this.mission, s = m.def.steps[m.step];
      if (s.ev !== key) return;
      m.count++;
      this.add(500 * (m.step + 1));
      if (m.count < s.n) return;
      m.step++; m.count = 0;
      if (m.step < m.def.steps.length) {
        const nx = m.def.steps[m.step];
        m.left += nx.bonusTime || 10;
        this.msg(`Siguiente: ${nx.label}`, 3); this.sfx('lane');
        return;
      }
      // misión completa
      const award = m.def.wizard ? 500000 : 25000 * (this.rank + 1) * (m.def.tier + 1);
      this.add(award); this.stats.missions++;
      this.completed.add(m.def.id);
      this.mission = null;
      this.effect('sweep', '#6fdc6a'); this.effect('flash', '#6fdc6a');
      if (m.def.wizard) {
        this.wizardDone++; this.completed.clear();
        this.msg(`¡${m.def.name} superada! ${fmt(award)}`, 5); this.sfx('jackpot');
      } else {
        if (this.rank < this.ranks.length - 1) this.rank++;
        this.msg(`¡Misión completa! Rango: ${this.rankName}`, 4); this.sfx('rankup');
        if (this.rank === 3 && !this.extraAwarded) { this.extraAwarded = true; this.extraBalls++; this.after(2, () => this.msg('¡Bola extra ganada!', 3)); }
      }
      if (this.R.relightAfterMission) this.missionLit = true;
    }
  }

  PB.Game = Game;
  PB.keysOf = keysOf;
  if (typeof module !== 'undefined') module.exports = Game;
})(typeof globalThis !== 'undefined' ? globalThis : window);
