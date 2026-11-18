/* Páramo Pinball — arranque, selector de mesas, bucle, controles y HUD
 * © 2026 Sebastian Sotomontes.
 */
(function () {
  'use strict';
  const PB = window.PB;
  const $ = (id) => document.getElementById(id);
  const cv = $('table'), ctx = cv.getContext('2d');
  const hud = { score: $('score'), ball: $('ball'), mult: $('mult'), rank: $('rank'), msg: $('msg'), mission: $('mission'), mbar: $('mbar') };
  const overlay = $('overlay'), scoresEl = $('scores'), finalEl = $('final'), pauseEl = $('paused'), picker = $('picker');
  const fmt = (n) => n.toLocaleString('es-CO');
  const ORDER = ['paramo', 'nebulosa', 'corsario'];

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };
  const hashTable = /[#&]mesa=(\w+)/.exec(location.hash);
  let tableId = (hashTable && PB.tables[hashTable[1]]) ? hashTable[1] : store.get('paramo-pinball-table', 'paramo');
  if (!PB.tables[tableId]) tableId = 'paramo';

  const scoreKey = () => 'paramo-pinball-scores-' + tableId;
  function saveScore(s) {
    const list = store.get(scoreKey(), []); list.push({ s, d: new Date().toISOString().slice(0, 10) });
    list.sort((a, b) => b.s - a.s); store.set(scoreKey(), list.slice(0, 5));
  }
  function showScores() {
    const list = store.get(scoreKey(), []);
    scoresEl.innerHTML = list.length ? list.map((r, i) => `<li><span>${i + 1}.</span><b>${fmt(r.s)}</b><i>${r.d}</i></li>`).join('') : '<li class="empty">Aún no hay récords en esta mesa</li>';
  }
  function renderPicker() {
    picker.innerHTML = ORDER.map((id) => {
      const d = PB.tables[id];
      return `<button class="w95 tbl${id === tableId ? ' on' : ''}" data-id="${id}"><b>${d.name}</b><small>${d.subtitle}</small></button>`;
    }).join('');
    $('title').textContent = PB.tables[tableId].name.toUpperCase();
  }
  picker.addEventListener('click', (e) => {
    const b = e.target.closest('.tbl'); if (!b) return;
    selectTable(b.dataset.id);
  });
  function selectTable(id) {
    tableId = id; store.set('paramo-pinball-table', id);
    renderPicker(); showScores(); finalEl.textContent = '';
    game = makeGame(); game.start();
  }

  let game = makeGame();
  const bot = PB.makeBot();
  let demo = true, paused = false;
  function makeGame() {
    return new PB.Game({
      table: tableId,
      sfx: (n, a) => { if (!demo) PB.audio.play(n, a); },
      onGameOver: (s) => { if (!demo) { saveScore(s); finalEl.textContent = `Puntaje final: ${fmt(s)}`; setTimeout(() => toAttract(false), 1800); } },
    });
  }
  function startGame() {
    PB.audio.init();
    demo = false; paused = false; pauseEl.hidden = true;
    game = makeGame(); game.start();
    overlay.classList.add('hidden');
    PB.audio.music(tableId);
  }
  function togglePause() { if (demo) return; paused = !paused; pauseEl.hidden = !paused; }
  function toggleView() { PB.render.VIEW.tilt = !PB.render.VIEW.tilt; store.set('paramo-pinball-tilt', PB.render.VIEW.tilt); resize(); toast(PB.render.VIEW.tilt ? 'Vista inclinada' : 'Vista plana'); }
  function toggleSound() { PB.audio.toggle(); toast(PB.audio.enabled ? 'Sonido activado' : 'Sonido silenciado'); }
  function toggleMusic() { PB.audio.init(); const on = PB.audio.toggleMusic(demo ? null : tableId); toast(on ? 'Música activada' : 'Música desactivada'); }
  function toAttract(clearFinal) {
    demo = true;
    PB.audio.stopMusic();
    if (clearFinal) finalEl.textContent = '';
    showScores(); overlay.classList.remove('hidden');
    game = makeGame(); game.start();
  }

  PB.render.VIEW.tilt = store.get('paramo-pinball-tilt', true);
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const wrap = $('stage');
    const asp = PB.render.aspect();
    const scale = Math.min(wrap.clientWidth / 600, wrap.clientHeight / (1000 * asp));
    cv.style.width = Math.floor(600 * scale) + 'px'; cv.style.height = Math.floor(1000 * asp * scale) + 'px';
    cv.width = Math.floor(600 * scale * dpr); cv.height = Math.floor(1000 * asp * scale * dpr);
  }
  window.addEventListener('resize', resize);

  const keys = { L: ['KeyZ', 'ArrowLeft', 'ShiftLeft'], R: ['KeyM', 'ArrowRight', 'ShiftRight', 'Slash'], P: ['Space', 'ArrowDown'] };
  function onKey(e, down) {
    if (e.repeat) return;
    const c = e.code;
    // teclas de función clásicas
    if (down && c === 'F2') { e.preventDefault(); startGame(); return; }
    if (down && c === 'F3') { e.preventDefault(); togglePause(); return; }
    if (down && c === 'F4') { e.preventDefault(); toggleMusic(); return; }
    if (demo) {
      if (!down) return;
      if (c === 'Enter' || c === 'Space') { startGame(); e.preventDefault(); }
      else if (c === 'ArrowLeft' || c === 'ArrowRight') { const i = ORDER.indexOf(tableId); selectTable(ORDER[(i + (c === 'ArrowRight' ? 1 : ORDER.length - 1)) % ORDER.length]); e.preventDefault(); }
      else if (/^Digit[1-3]$/.test(c)) selectTable(ORDER[+c.slice(5) - 1]);
      return;
    }
    if (down && c === 'KeyV') { toggleView(); return; }
    if (down && c === 'KeyP') { togglePause(); return; }
    if (down && c === 'KeyS') { toggleSound(); return; }
    if (down && c === 'Escape') { toAttract(true); return; }
    if (paused) return;
    if (keys.L.includes(c)) { game.flip('L', down); e.preventDefault(); }
    else if (keys.R.includes(c)) { game.flip('R', down); e.preventDefault(); }
    else if (keys.P.includes(c)) { game.plunger(down); e.preventDefault(); }
    else if (down && c === 'KeyX') game.nudge(-1);
    else if (down && c === 'KeyN') game.nudge(1);
    else if (down && c === 'ArrowUp') { game.nudge(0); e.preventDefault(); }
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => { if (!demo) { game.flip('L', false); game.flip('R', false); } });

  const touches = new Map();
  function zoneFor(e) {
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (x > 0.86 && y > 0.6 && game.world.balls.some((b) => game.inLane(b))) return 'P';
    return x < 0.5 ? 'L' : 'R';
  }
  cv.addEventListener('pointerdown', (e) => {
    if (demo) return;
    const z = zoneFor(e); touches.set(e.pointerId, z);
    if (z === 'P') game.plunger(true); else game.flip(z, true);
    e.preventDefault();
  });
  const up = (e) => {
    const z = touches.get(e.pointerId); if (!z) return; touches.delete(e.pointerId);
    if (z === 'P') game.plunger(false); else if (![...touches.values()].includes(z)) game.flip(z, false);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('play').addEventListener('click', startGame);

  /* --- barra de menús clásica con desplegables --- */
  const MENUS = {
    juego: [['Nueva partida', 'F2', startGame], ['Pausa / continuar', 'F3', togglePause], null, ['Volver al menú', 'Esc', () => toAttract(true)]],
    mesa: ORDER.map((id, i) => [PB.tables[id].name, String(i + 1), () => { if (!demo) toAttract(true); selectTable(id); }]),
    opciones: [['Sonido', 'S', toggleSound], ['Música', 'F4', toggleMusic], ['Vista inclinada / plana', 'V', toggleView]],
    ayuda: [['Controles', '', () => toast('Z / M flippers · Espacio lanzar · X N ↑ empujar · F2 nueva · F3 pausa')], ['Acerca de…', '', () => toast('Páramo Pinball · © 2026 Sebastian Sotomontes · texturas CC0 de ambientCG')]],
  };
  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.el.remove(); openMenu.btn.classList.remove('open'); openMenu = null; } }
  document.querySelectorAll('.menubar [data-menu]').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const id = btn.dataset.menu;
      if (openMenu && openMenu.id === id) { closeMenu(); return; }
      closeMenu();
      const el = document.createElement('div'); el.className = 'dropdown bevel';
      for (const item of MENUS[id]) {
        if (!item) { el.appendChild(Object.assign(document.createElement('hr'))); continue; }
        const it = document.createElement('div'); it.className = 'mi';
        it.innerHTML = `<span>${item[0]}</span><span>${item[1]}</span>`;
        it.addEventListener('pointerup', () => { closeMenu(); item[2](); });
        el.appendChild(it);
      }
      const r = btn.getBoundingClientRect();
      el.style.left = r.left + 'px'; el.style.top = r.bottom + 'px';
      document.body.appendChild(el); btn.classList.add('open');
      openMenu = { id, el, btn };
    });
  });
  document.addEventListener('pointerdown', closeMenu);

  let toastT = 0;
  function toast(t) { hud.msg.textContent = t; toastT = performance.now() + 1500; }

  /* marcador de 7 segmentos (dígitos ámbar sobre LCD negro) */
  const seg = $('scoreSeg'), sctx = seg.getContext('2d');
  const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  let lastSeg = null;
  function drawSegs(n) {
    const str = String(n).padStart(10, ' ').slice(-10);
    if (str === lastSeg) return; lastSeg = str;
    const W = seg.width, H = seg.height, cw = W / 10, th = cw * 0.16, h = H * 0.42, w = cw * 0.62;
    sctx.fillStyle = '#050805'; sctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) {
      const x0 = i * cw + cw * 0.2, y0 = H * 0.08, on = SEGS[str[i]] || '';
      const S = {
        a: [x0 + th, y0, w - 2 * th, th], d: [x0 + th, y0 + 2 * h, w - 2 * th, th], g: [x0 + th, y0 + h, w - 2 * th, th],
        f: [x0, y0 + th, th, h - th], b: [x0 + w - th, y0 + th, th, h - th], e: [x0, y0 + h + th, th, h - th], c: [x0 + w - th, y0 + h + th, th, h - th],
      };
      for (const k of 'abcdefg') {
        const [x, y, ww, hh] = S[k];
        sctx.fillStyle = on.includes(k) ? '#ffb000' : 'rgba(255,176,0,0.08)';
        sctx.fillRect(x + 0.6, y + 0.6, ww - 1.2, hh - 1.2);
      }
      if (i < 9 && (9 - i) % 3 === 0 && str[i] !== ' ') { sctx.fillStyle = '#ffb000'; sctx.fillRect(x0 + w + cw * 0.06, y0 + 2 * h, th * 0.8, th); }
    }
  }

  function updateHud() {
    hud.score.textContent = fmt(game.score);
    drawSegs(game.score);
    hud.ball.textContent = game.state === 'over' ? '—' : `${game.ball}/3${game.extraBalls ? ' +' + game.extraBalls : ''}`;
    hud.mult.textContent = '×' + game.mult;
    hud.rank.textContent = game.rankName;
    if (performance.now() > toastT) {
      const m = game.message;
      const n = game.def.names;
      hud.msg.textContent = m || (demo ? `Demo · ${game.def.name} — Enter para jugar, ← → cambia de mesa`
        : game.mission ? '' : game.lockLit ? `Captura encendida en ${n.lock}` : game.missionLit ? `${n.missionHole}: ¡inicia una misión!` : 'Enciende la misión: ' + (game.def.hint || describeLight(game)));
    }
    if (game.mission) {
      const ms = game.mission, st = game.missionStep;
      hud.mission.hidden = false;
      hud.mission.querySelector('b').textContent = `${ms.def.name} · paso ${ms.step + 1}/${ms.def.steps.length}`;
      hud.mission.querySelector('span').textContent = `${st.label}: ${ms.count}/${st.n} · ${Math.ceil(ms.left)} s`;
      hud.mbar.style.width = (100 * (ms.step + ms.count / st.n) / ms.def.steps.length) + '%';
    } else hud.mission.hidden = true;
  }
  function describeLight(g) {
    const map = { 'bank:frailejones': 'derriba los frailejones', 'bank:satelites': 'derriba los satélites', 'targets:sondas': 'activa las sondas', 'targets:mapa': 'enciende M-A-P-A' };
    return (g.R.lightMission || []).map((k) => map[k] || k).join(' o ');
  }

  const DT = 1 / 60;
  let acc = 0, last = performance.now();
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= DT) {
      if (!paused) {
        if (demo) { bot(game, DT); if (game.state === 'over') { game = makeGame(); game.start(); } }
        game.update(DT);
      }
      acc -= DT;
    }
    PB.render.draw(ctx, game, now / 1000, { w: cv.width, h: cv.height, scaleX: cv.width / 600 });
    updateHud();
    requestAnimationFrame(frame);
  }

  // hooks de desarrollo: #demo oculta el overlay; #sim=N simula N segundos; #mesa=id elige mesa
  window.addEventListener('error', (e) => { hud.msg.textContent = 'ERROR: ' + e.message; document.title = 'ERROR ' + e.message; });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe($('stage'));
  const sim = /sim=(\d+)/.exec(location.hash);
  if (/demo/.test(location.hash) || sim) overlay.classList.add('hidden');
  renderPicker(); resize(); showScores();
  game.start();
  if (sim) for (let i = 0; i < +sim[1] * 60; i++) { bot(game, DT); game.update(DT); if (game.state === 'over') { game = makeGame(); game.start(); } }
  // texturas CC0 primero (máx. 3 s), luego primer fotograma inmediato y bucle
  Promise.race([PB.render.loadTextures('assets/textures/'), new Promise((r) => setTimeout(r, 3000))]).then(() => {
    last = performance.now();
    PB.render.draw(ctx, game, performance.now() / 1000, { w: cv.width, h: cv.height, scaleX: cv.width / 600 });
    updateHud();
    requestAnimationFrame(frame);
  });
})();
