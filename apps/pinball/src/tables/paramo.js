/* Mesa 1 — PÁRAMO: expedición andina nocturna
 * © 2026 Sebastian Sotomontes.
 */
(function (G) {
  'use strict';
  const PB = (G.PB = G.PB || {});
  PB.tables = PB.tables || {};

  PB.tables.paramo = {
    id: 'paramo', name: 'Páramo', subtitle: 'Expedición andina',
    welcome: '¡Bienvenido al Páramo!',
    theme: {
      ui: '#8a5a2b', accent: '#ffb347', accent2: '#6fdc6a', cabinet: '#5b3a22', rail: '#b9bec6', railDark: '#262a30', railLight: '#f5f8fb',
      decal: '#f6ead0', apron: '#3d4f62', plastic: '#bfe3ff', plasticSling: '#c8442c', bumper: '#2f6e9c', bumperCap: '#ffd36b',
      rubber: '#b8322a', flipper: '#f3efe6', drop: '#e8b22e', spinner: '#dfe4ea', rubberPost: '#d4d8dd',
    },
    ranks: ['Caminante', 'Explorador', 'Montañista', 'Guía', 'Guardián del Páramo', 'Cóndor'],
    names: { bumper: 'Géiseres', missionHole: 'Laguna', multiball: 'Vuelo del Cóndor' },
    rules: {
      missionHole: 'laguna',
      lightMission: ['bank:frailejones'],
      multiball: { type: 'count', ev: 'ramp:cumbre', every: 3, balls: 1 },
      jackpot: 'ramp:cumbre',
    },
    missions: [
      { id: 'viento', tier: 0, name: 'Sendero del Viento', time: 45, steps: [{ ev: 'spin', n: 20, label: 'Gira el Viento ×20' }] },
      { id: 'geiser', tier: 0, name: 'Géiseres', time: 40, steps: [{ ev: 'bumper', n: 15, label: 'Géiseres ×15' }] },
      { id: 'nieblas', tier: 0, name: 'Nieblas Altas', time: 45, steps: [{ ev: 'lane', n: 3, label: 'Enciende S-O-L' }] },
      { id: 'cumbre', tier: 1, name: 'Ascenso a la Cumbre', time: 50, steps: [{ ev: 'ramp:cumbre', n: 2, label: 'Sube la Cumbre ×2' }, { ev: 'hole:laguna', n: 1, label: 'Descansa en la Laguna' }] },
      { id: 'siembra', tier: 1, name: 'Siembra de Frailejones', time: 50, steps: [{ ev: 'drop', n: 4, label: 'Derriba 4 frailejones' }, { ev: 'ramp:cumbre', n: 1, label: 'Sube la Cumbre' }] },
      { id: 'osos', tier: 1, name: 'La Cueva del Oso', time: 50, steps: [{ ev: 'hole:cueva', n: 2, label: 'Entra a la Cueva ×2' }, { ev: 'ramp:cumbre', n: 1, label: 'Escapa por la Cumbre' }] },
      { id: 'travesia', tier: 1, name: 'Travesía', time: 55, steps: [{ ev: 'spin', n: 10, label: 'Viento ×10' }, { ev: 'bumper', n: 8, label: 'Géiseres ×8' }, { ev: 'ramp:cumbre', n: 1, label: 'Cumbre' }] },
      { id: 'tormenta', tier: 2, name: 'Tormenta Andina', time: 55, steps: [{ ev: 'bumper', n: 20, label: 'Géiseres ×20' }, { ev: 'ramp:cumbre', n: 2, label: 'Cumbre ×2' }] },
      { id: 'deshielo', tier: 2, name: 'Deshielo', time: 60, steps: [{ ev: 'bank:frailejones', n: 1, label: 'Completa los frailejones' }, { ev: 'lanes', n: 1, label: 'Completa S-O-L' }, { ev: 'hole:laguna', n: 1, label: 'Laguna' }] },
      { id: 'condor', tier: 3, wizard: true, multiball: 2, name: 'Vuelo del Cóndor', time: 80, steps: [{ ev: 'ramp:cumbre', n: 3, label: 'Cumbre ×3' }, { ev: 'spin', n: 20, label: 'Viento ×20' }, { ev: 'hole:laguna', n: 1, label: 'Laguna final' }] },
    ],

    build(k) {
      k.frame({ bottom: 'safeLeft' });
      k.lanes([190, 250, 310, 370], 112, ['S', 'O', 'L']);
      k.bumper(215, 255); k.bumper(345, 255); k.bumper(280, 335);
      // órbita izquierda con spinner
      k.wall([[78, 640], [78, 330], ...k.ellipseArc(250, 330, 172, 165, Math.PI, Math.PI * 1.32, 10)]);
      k.post(78, 640, 5);
      k.spinner('viento', 22, 470, 76, 470, 'VIENTO');
      k.drops('frailejones', [0, 1, 2, 3].map((i) => [86, 410 + i * 42, 86, 440 + i * 42]), 'Frailejones');
      k.ramp('cumbre', {
        walls: [[[405, 470], [430, 395]], [[470, 500], [500, 420]]],
        mouth: [432, 404, 498, 428], dir: [0.35, -0.94],
        path: [[465, 410], [520, 120], [140, 60], [84, 680]], exit: [40, 380], label: 'CUMBRE',
      });
      k.hole('laguna', 470, 590, { back: [[440, 575], [470, 568], [500, 580]], eject: [-520, 420], label: 'LAGUNA' });
      // túnel: la Cueva conecta por debajo de la mesa con la Laguna
      k.hole('cueva', 150, 300, { back: [[128, 288], [148, 280], [170, 286]], label: 'CUEVA', tunnel: { to: 'laguna', time: 1.3, name: 'Túnel de la Cueva' } });
      k.t.inserts = { rankY: 620, multY: 665 };
    },

    paint(ctx, t, A) {
      // cielo de atardecer andino
      const sky = ctx.createLinearGradient(0, 0, 0, 470);
      sky.addColorStop(0, '#1b2a55'); sky.addColorStop(0.55, '#5a4a7a'); sky.addColorStop(0.85, '#e0866a'); sky.addColorStop(1, '#f6c27a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, t.W, 470);
      A.stars(ctx, t, 60, 200, 11);
      A.glow(ctx, 300, 430, 260, '#ffd9a0', 0.5);
      // cordilleras en capas con nieve
      A.mountain(ctx, [[0, 470], [70, 360], [130, 395], [210, 290], [290, 370], [360, 260], [440, 350], [520, 300], [600, 380], [600, 470]], '#6d6f9a', '#4a4f7a', 60);
      A.mountain(ctx, [[0, 470], [60, 420], [150, 380], [240, 430], [330, 360], [420, 420], [510, 380], [600, 430], [600, 470]], '#4f5f7d', '#3c4a63', 26);
      // páramo: pastizal ocre y verde
      const land = ctx.createLinearGradient(0, 460, 0, 1000);
      land.addColorStop(0, '#6f7c4c'); land.addColorStop(0.35, '#55663e'); land.addColorStop(1, '#2c3a26');
      ctx.fillStyle = land; ctx.fillRect(0, 460, t.W, 540);
      let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      A.texture(ctx, 'grass', 0.75, 'multiply', () => { ctx.beginPath(); ctx.rect(0, 460, 600, 540); }, 0.45);
      for (let i = 0; i < 700; i++) { const x = r() * 600, y = 470 + r() * 530, h = 3 + r() * 7; ctx.strokeStyle = r() > 0.5 ? 'rgba(214,190,120,0.35)' : 'rgba(40,70,35,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 3, y - h); ctx.stroke(); }
      A.texture(ctx, 'paper', 0.25, 'multiply', () => { ctx.beginPath(); ctx.rect(0, 0, 600, 470); }, 0.8);
      // laguna con reflejo del cielo
      ctx.save(); ctx.beginPath(); ctx.ellipse(300, 560, 190, 46, 0, 0, Math.PI * 2);
      const wg = ctx.createLinearGradient(0, 515, 0, 605); wg.addColorStop(0, '#f2b98a'); wg.addColorStop(0.4, '#7a6c95'); wg.addColorStop(1, '#2b3a5a');
      ctx.fillStyle = wg; ctx.fill(); ctx.clip();
      for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(140 + r() * 300, 530 + i * 8, 40 + r() * 80, 1.5); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(30,40,25,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(300, 560, 190, 46, 0, 0, Math.PI * 2); ctx.stroke();
      [[70, 700, 1.1], [500, 690, 1.0], [150, 640, 0.8], [440, 630, 0.75], [110, 820, 1.0], [470, 820, 0.95], [230, 660, 0.6], [370, 650, 0.6]].forEach(([x, y, k]) => A.frailejon(ctx, x, y, k));
      A.condor(ctx, 175, 190, 0.75, '#1a1a24', 0.85);
      A.title(ctx, 'PÁRAMO', 300, 760, 'rgba(246,234,208,0.55)', 30);
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
