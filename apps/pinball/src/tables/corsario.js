/* Mesa 3 — CORSARIO: la ciudad amurallada del Caribe
 * © 2026 Sebastian Sotomontes.
 */
(function (G) {
  'use strict';
  const PB = (G.PB = G.PB || {});
  PB.tables = PB.tables || {};

  PB.tables.corsario = {
    id: 'corsario', name: 'Corsario', subtitle: 'La ciudad amurallada del Caribe',
    welcome: '¡Leven anclas!',
    theme: {
      ui: '#6a3a1a', accent: '#ffcc33', accent2: '#4fe0c0', cabinet: '#6b4426', rail: '#c9a86a', railDark: '#3a2a14', railLight: '#fff1c9',
      decal: '#fff1d0', apron: '#5a4030', plastic: '#ffe7b0', plasticSling: '#a8322a', bumper: '#1f6f6a', bumperCap: '#ffe08a',
      rubber: '#1b1b1b', flipper: '#f6efe0', drop: '#a8672f', spinner: '#f2e6c8', rubberPost: '#e1d6c0',
    },
    ranks: ['Grumete', 'Marinero', 'Contramaestre', 'Corsario', 'Capitán de Mar', 'Leyenda del Caribe'],
    names: { bumper: 'Remolinos', missionHole: 'El Cofre', multiball: 'Abordaje', kickback: 'Cañón', mapa: 'Letras del mapa' },
    rules: {
      missionHole: 'cofre',
      lightMission: ['targets:mapa'],
      multiball: { type: 'count', ev: 'bank:barriles', every: 2, balls: 1 },
      jackpot: 'hole:cofre',
      kickback: { relight: 'lanes' },
    },
    missions: [
      { id: 'velas', tier: 0, name: 'Izar Velas', time: 40, steps: [{ ev: 'spin', n: 15, label: 'Gira la Vela ×15' }] },
      { id: 'remolinos', tier: 0, name: 'Remolinos', time: 40, steps: [{ ev: 'bumper', n: 15, label: 'Remolinos ×15' }] },
      { id: 'oro', tier: 0, name: 'Fiebre del Oro', time: 45, steps: [{ ev: 'lane', n: 3, label: 'Enciende O-R-O' }] },
      { id: 'cruzada', tier: 1, name: 'Travesía Cruzada', time: 50, steps: [{ ev: 'ramp:muralla', n: 1, label: 'Rampa Muralla' }, { ev: 'ramp:galeon', n: 1, label: 'Rampa Galeón' }] },
      { id: 'polvora', tier: 1, name: 'Pólvora Seca', time: 55, steps: [{ ev: 'drop', n: 5, label: 'Derriba 5 barriles' }, { ev: 'hole:cofre', n: 1, label: 'Al Cofre' }] },
      { id: 'mapa', tier: 1, name: 'El Mapa Perdido', time: 55, steps: [{ ev: 'target', n: 4, label: 'Enciende M-A-P-A' }, { ev: 'ramp', n: 2, label: 'Dos rampas' }] },
      { id: 'pasadizo', tier: 1, name: 'El Pasadizo Secreto', time: 55, steps: [{ ev: 'hole:pasadizo', n: 1, label: 'Encuentra el Pasadizo' }, { ev: 'ramp:galeon', n: 1, label: 'Huye por el Galeón' }, { ev: 'hole:pasadizo', n: 1, label: 'Vuelve al Pasadizo' }] },
      { id: 'altamar', tier: 2, name: 'Tormenta en Alta Mar', time: 60, steps: [{ ev: 'bumper', n: 20, label: 'Remolinos ×20' }, { ev: 'ramp:galeon', n: 2, label: 'Galeón ×2' }] },
      { id: 'asedio', tier: 2, name: 'Asedio a la Muralla', time: 60, steps: [{ ev: 'ramp:muralla', n: 3, label: 'Muralla ×3' }, { ev: 'hole:cofre', n: 1, label: 'Cofre' }] },
      { id: 'tesoro', tier: 3, wizard: true, multiball: 2, name: 'El Gran Tesoro', time: 85, steps: [{ ev: 'ramp', n: 4, label: 'Cuatro rampas' }, { ev: 'bank:barriles', n: 1, label: 'Todos los barriles' }, { ev: 'hole:cofre', n: 1, label: 'Abre el Cofre' }] },
    ],

    build(k) {
      k.frame({ bottom: 'standard', kickback: 'L' });
      k.lanes([220, 280, 340, 400], 112, ['O', 'R', 'O']);
      k.bumper(330, 255, 22); k.bumper(412, 270, 22); k.bumper(372, 345, 22);
      // rampas cruzadas
      k.ramp('muralla', {
        walls: [[[155, 470], [130, 395]], [[90, 500], [60, 420]]],
        mouth: [128, 404, 62, 428], dir: [-0.35, -0.94],
        path: [[95, 410], [30, 40], [520, 30], [476, 680]], exit: [-40, 380], label: 'MURALLA', dur: 1.05,
      });
      k.ramp('galeon', {
        walls: [[[405, 470], [430, 395]], [[470, 500], [500, 420]]],
        mouth: [432, 404, 498, 428], dir: [0.35, -0.94],
        path: [[465, 410], [540, 60], [40, 70], [84, 680]], exit: [40, 380], label: 'GALEÓN', dur: 1.05,
      });
      k.spinner('vela', 416, 446, 486, 470, 'VELA');
      // cofre (misiones) bajo los carriles, protegido por los barriles
      k.hole('cofre', 280, 225, { r: 15, back: [[253, 210], [280, 203], [307, 210]], eject: [-300, 420], label: 'COFRE' });
      // pasadizo secreto: túnel bajo la muralla que sale por el Cofre
      k.hole('pasadizo', 150, 320, { back: [[128, 308], [148, 300], [170, 306]], label: 'PASADIZO', tunnel: { to: 'cofre', time: 1.3, name: 'Pasadizo Secreto' } });
      k.drops('barriles', [0, 1, 2, 3, 4].map((i) => [200 + i * 32, 560, 226 + i * 32, 560]), 'Barriles', { reset: 9 });
      ['M', 'A', 'P', 'A'].forEach((l, i) => k.target('m' + i, 528, 540 + i * 34, 528, 566 + i * 34, l, 'mapa'));
      k.cap(540, 526, 540);
      k.t.inserts = { rankY: 615, multY: 660 };
    },

    paint(ctx, t, A) {
      // carta náutica sobre pergamino (parte alta) que se funde con el mar
      const parch = ctx.createLinearGradient(0, 0, 0, 520);
      parch.addColorStop(0, '#d9bf8c'); parch.addColorStop(0.7, '#c9a46a'); parch.addColorStop(1, '#8a6a42');
      ctx.fillStyle = parch; ctx.fillRect(0, 0, t.W, 520);
      let s = 9; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      A.texture(ctx, 'paper', 0.8, 'multiply', () => { ctx.beginPath(); ctx.rect(0, 0, 600, 520); }, 0.9);
      for (let i = 0; i < 40; i++) A.glow(ctx, r() * 600, r() * 500, 30 + r() * 70, '#6b4a24', 0.12);
      // costa dibujada a mano con la ciudad amurallada
      ctx.fillStyle = '#b48a52'; ctx.strokeStyle = '#4a3218'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 300); ctx.bezierCurveTo(90, 260, 140, 340, 220, 300); ctx.bezierCurveTo(300, 260, 340, 330, 420, 290); ctx.bezierCurveTo(500, 250, 560, 300, 600, 280);
      ctx.lineTo(600, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      // baluartes y muralla
      const wall = ctx.createLinearGradient(0, 230, 0, 290); wall.addColorStop(0, '#c8b089'); wall.addColorStop(1, '#7c6444');
      ctx.fillStyle = wall;
      ctx.beginPath(); ctx.moveTo(60, 285); ctx.lineTo(60, 250); ctx.lineTo(100, 230); ctx.lineTo(500, 230); ctx.lineTo(540, 250); ctx.lineTo(540, 285); ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let x = 104; x < 496; x += 18) { ctx.fillStyle = '#6a5236'; ctx.fillRect(x, 222, 10, 8); }
      [[160, 'casas'], [250, 'iglesia'], [360, 'casas'], [440, 'casas']].forEach(([x, kind]) => {
        if (kind === 'iglesia') { ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 12, 170, 24, 60); ctx.beginPath(); ctx.moveTo(x - 14, 170); ctx.lineTo(x, 145); ctx.lineTo(x + 14, 170); ctx.fill(); ctx.stroke(); }
        else for (let k = 0; k < 4; k++) { ctx.fillStyle = ['#e9c9a0', '#d98f6a', '#f0e2b8', '#c9a0c0'][k]; ctx.fillRect(x - 30 + k * 16, 196 + (k % 2) * 6, 15, 34 - (k % 2) * 6); }
      });
      // mar del Caribe
      const sea = ctx.createLinearGradient(0, 280, 0, 1000);
      sea.addColorStop(0, '#3aa6a0'); sea.addColorStop(0.35, '#1f6f86'); sea.addColorStop(1, '#0d2f45');
      ctx.save(); ctx.beginPath(); ctx.moveTo(0, 300); ctx.bezierCurveTo(90, 260, 140, 340, 220, 300); ctx.bezierCurveTo(300, 260, 340, 330, 420, 290); ctx.bezierCurveTo(500, 250, 560, 300, 600, 280);
      ctx.lineTo(600, 1000); ctx.lineTo(0, 1000); ctx.closePath(); ctx.fillStyle = sea; ctx.fill(); ctx.clip();
      for (let i = 0; i < 260; i++) { const x = r() * 600, y = 300 + r() * 700, w = 8 + r() * 26; ctx.strokeStyle = `rgba(255,255,255,${0.06 + r() * 0.12})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y - 3, x + w, y); ctx.stroke(); }
      ctx.restore();
      // galeón pintado
      ctx.save(); ctx.translate(300, 760);
      const hull = ctx.createLinearGradient(0, -10, 0, 34); hull.addColorStop(0, '#8a5a2e'); hull.addColorStop(1, '#3a2312');
      ctx.fillStyle = hull; ctx.beginPath(); ctx.moveTo(-100, -4); ctx.lineTo(96, -10); ctx.lineTo(74, 30); ctx.lineTo(-82, 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9b46a'; ctx.fillRect(-90, 4, 176, 3);
      for (let k = -70; k < 70; k += 20) { ctx.fillStyle = '#1a1008'; ctx.fillRect(k, 12, 6, 5); }
      ctx.strokeStyle = '#3a2312'; ctx.lineWidth = 3;
      [[-50, 110], [5, 140], [55, 100]].forEach(([x, h]) => {
        ctx.beginPath(); ctx.moveTo(x, -6); ctx.lineTo(x, -h); ctx.stroke();
        for (let k = 0; k < 2; k++) {
          const y0 = -h + 12 + k * h * 0.42, hh = h * 0.36;
          const sail = ctx.createLinearGradient(x - 30, 0, x + 30, 0); sail.addColorStop(0, '#d9ccb0'); sail.addColorStop(1, '#f6eedc');
          ctx.fillStyle = sail; ctx.beginPath(); ctx.moveTo(x - 30 + k * 4, y0); ctx.quadraticCurveTo(x, y0 + hh * 0.4, x + 30 - k * 4, y0); ctx.lineTo(x + 26 - k * 4, y0 + hh); ctx.quadraticCurveTo(x, y0 + hh * 1.25, x - 26 + k * 4, y0 + hh); ctx.closePath(); ctx.fill();
        }
      });
      ctx.fillStyle = '#a8322a'; ctx.beginPath(); ctx.moveTo(5, -140); ctx.lineTo(28, -134); ctx.lineTo(5, -128); ctx.fill();
      ctx.restore();
      // rosa de los vientos en tinta
      ctx.save(); ctx.translate(470, 120);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 22 : 40; ctx.fillStyle = i % 2 ? '#7a5a30' : '#3a2412'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.18) * 8, Math.sin(a - 0.18) * 8); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); ctx.lineTo(Math.cos(a + 0.18) * 8, Math.sin(a + 0.18) * 8); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      A.title(ctx, 'CORSARIO', 300, 880, 'rgba(255,241,208,0.7)', 30);
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
