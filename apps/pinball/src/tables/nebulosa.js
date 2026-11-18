/* Mesa 2 — NEBULOSA: observatorio en el espacio profundo
 * © 2026 Sebastian Sotomontes.
 */
(function (G) {
  'use strict';
  const PB = (G.PB = G.PB || {});
  PB.tables = PB.tables || {};

  PB.tables.nebulosa = {
    id: 'nebulosa', name: 'Nebulosa', subtitle: 'Observatorio del espacio profundo',
    welcome: 'Observatorio en línea',
    theme: {
      ui: '#3a4a7a', accent: '#58d8ff', accent2: '#ffcf5c', cabinet: '#2a2c33', rail: '#a9b1bc', railDark: '#1c1f25', railLight: '#eef3f8',
      decal: '#e6dcff', apron: '#40465a', plastic: '#d6c6ff', plasticSling: '#5b48b0', bumper: '#9c5a2e', bumperCap: '#ffb454',
      rubber: '#1d1d22', flipper: '#eceff4', drop: '#7fd6ff', spinner: '#d8dde5', rubberPost: '#cfd3d9',
    },
    ranks: ['Aprendiz', 'Piloto', 'Navegante', 'Explorador Estelar', 'Astrónomo', 'Guardián de la Nebulosa'],
    names: { bumper: 'Asteroides', missionHole: 'El Observatorio', multiball: 'Lluvia de Meteoros', lock: 'el Pozo Gravitacional', sondas: 'Sondas' },
    rules: {
      missionHole: 'observatorio',
      lightMission: ['bank:satelites', 'targets:sondas'],
      multiball: { type: 'lock', hole: 'pozo', lightEv: 'ramp:anillo', lightN: 2, locks: 2 },
      jackpot: 'ramp:anillo',
    },
    missions: [
      { id: 'despegue', tier: 0, name: 'Despegue', time: 40, steps: [{ ev: 'lane', n: 3, label: 'Enciende L-U-Z' }] },
      { id: 'cinturon', tier: 0, name: 'Cinturón de Asteroides', time: 40, steps: [{ ev: 'bumper', n: 15, label: 'Asteroides ×15' }] },
      { id: 'sondeo', tier: 0, name: 'Sondeo', time: 45, steps: [{ ev: 'target', n: 3, label: 'Activa las 3 sondas' }] },
      { id: 'anillo', tier: 1, name: 'Vuelta al Anillo', time: 55, steps: [{ ev: 'ramp:anillo', n: 2, label: 'Anillo Solar ×2' }, { ev: 'hole:observatorio', n: 1, label: 'Vuelve al Observatorio' }] },
      { id: 'reparacion', tier: 1, name: 'Reparación de Satélites', time: 55, steps: [{ ev: 'drop', n: 3, label: 'Derriba 3 satélites' }, { ev: 'hole:pozo', n: 1, label: 'Entra al Pozo Gravitacional' }] },
      { id: 'cometa', tier: 1, name: 'Caza del Cometa', time: 55, steps: [{ ev: 'ramp:cometa', n: 1, label: 'Rampa Cometa' }, { ev: 'bumper', n: 10, label: 'Asteroides ×10' }, { ev: 'ramp:anillo', n: 1, label: 'Anillo Solar' }] },
      { id: 'portal', tier: 1, name: 'Salto Cuántico', time: 50, steps: [{ ev: 'hole:portal', n: 2, label: 'Cruza el Portal ×2' }, { ev: 'ramp:cometa', n: 1, label: 'Rampa Cometa' }] },
      { id: 'eclipse', tier: 2, name: 'Eclipse', time: 60, steps: [{ ev: 'targets:sondas', n: 1, label: 'Completa las sondas' }, { ev: 'bank:satelites', n: 1, label: 'Completa los satélites' }, { ev: 'hole:observatorio', n: 1, label: 'Observatorio' }] },
      { id: 'supernova', tier: 2, name: 'Supernova', time: 60, steps: [{ ev: 'bumper', n: 25, label: 'Asteroides ×25' }, { ev: 'ramp:anillo', n: 2, label: 'Anillo Solar ×2' }] },
      { id: 'singularidad', tier: 3, wizard: true, multiball: 2, name: 'Singularidad', time: 80, steps: [{ ev: 'ramp:anillo', n: 2, label: 'Anillo Solar ×2' }, { ev: 'ramp:cometa', n: 2, label: 'Cometa ×2' }, { ev: 'hole:portal', n: 1, label: 'Portal' }, { ev: 'hole:observatorio', n: 1, label: 'Observatorio final' }] },
    ],

    build(k) {
      k.frame({ bottom: 'standard' });
      k.lanes([200, 260, 320, 380], 112, ['L', 'U', 'Z']);
      k.bumper(210, 255, 22); k.bumper(150, 325, 22); k.bumper(255, 335, 22);
      // rampa izquierda: Anillo Solar, rodea la mesa y baja al inlane derecho
      k.ramp('anillo', {
        walls: [[[155, 470], [130, 395]], [[90, 500], [60, 420]]],
        mouth: [128, 404, 62, 428], dir: [-0.35, -0.94],
        path: [[95, 410], [20, 110], [530, 40], [476, 680]], exit: [-40, 380], label: 'ANILLO', dur: 1.1,
      });
      // flipper superior derecho + guía que lo alimenta
      k.flipper(452, 345, 58, -1);
      k.wall([[530, 300], [448, 337]]);
      // pozo gravitacional (captura de bolas) bajo los carriles
      k.hole('pozo', 320, 208, { back: [[296, 194], [320, 188], [344, 194]], eject: [-380, 380], label: 'POZO' });
      // observatorio (misiones) en el centro
      k.hole('observatorio', 280, 520, { back: [[255, 505], [280, 498], [305, 505]], eject: [-330, 430], label: 'OBSERVATORIO' });
      // portal: túnel que lleva al Observatorio (objetivo del flipper superior)
      k.hole('portal', 450, 240, { back: [[428, 226], [450, 219], [472, 226]], label: 'PORTAL', tunnel: { to: 'observatorio', time: 1.1, name: 'Salto por el Portal' } });
      // segunda rampa: Cola del Cometa (derecha) cruza la mesa hasta el inlane izquierdo
      k.ramp('cometa', {
        walls: [[[405, 470], [430, 395]], [[470, 500], [500, 420]]],
        mouth: [432, 404, 498, 428], dir: [0.35, -0.94],
        path: [[465, 410], [570, 40], [30, 70], [84, 680]], exit: [40, 380], label: 'COMETA', dur: 1.1,
      });
      k.drops('satelites', [[528, 430, 528, 458], [528, 468, 528, 496], [528, 506, 528, 534]], 'Satélites');
      k.cap(540, 526, 430);
      k.target('s1', 27, 540, 27, 568, '1', 'sondas');
      k.target('s2', 27, 580, 27, 608, '2', 'sondas');
      k.target('s3', 27, 620, 27, 648, '3', 'sondas');
      k.label(498, 575, 'SATÉLITES', { rot: -Math.PI / 2 });
      k.label(48, 594, 'SONDAS', { rot: -Math.PI / 2 });
      k.t.inserts = { rankY: 610, multY: 655 };
    },

    paint(ctx, t, A) {
      // espacio profundo
      const g = ctx.createLinearGradient(0, 0, 0, t.H);
      g.addColorStop(0, '#0a0b1e'); g.addColorStop(0.6, '#121433'); g.addColorStop(1, '#1b1c2e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, t.W, t.H);
      // nebulosa pintada: nubes superpuestas cálidas y frías
      let s = 41; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const clouds = [['#c2477a', 0.10], ['#e8894a', 0.08], ['#4a6fc2', 0.10], ['#7a4ac2', 0.09]];
      for (let i = 0; i < 70; i++) {
        const [c, a] = clouds[i % clouds.length];
        const x = 120 + r() * 380 + Math.sin(i) * 60, y = 120 + r() * 520, rr = 40 + r() * 110;
        A.glow(ctx, x, y, rr, c, a);
      }
      A.stars(ctx, t, 220, 800, 23);
      // planeta gigante con sombra y anillos
      ctx.save(); ctx.translate(430, 740);
      ctx.strokeStyle = 'rgba(235,205,160,0.5)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, 150, 34, -0.3, Math.PI, Math.PI * 2); ctx.stroke();
      const pg = ctx.createRadialGradient(-40, -40, 10, 0, 0, 95); pg.addColorStop(0, '#f2c58e'); pg.addColorStop(0.5, '#b4693c'); pg.addColorStop(1, '#3a1c18');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.clip();
      for (let i = -4; i <= 4; i++) { ctx.fillStyle = i % 2 ? 'rgba(90,40,20,0.22)' : 'rgba(255,220,170,0.12)'; ctx.fillRect(-100, i * 18 - 6, 200, 10); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(235,205,160,0.7)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(0, 0, 150, 34, -0.3, 0, Math.PI); ctx.stroke();
      ctx.restore();
      // luna
      const mg = ctx.createRadialGradient(118, 640, 2, 125, 648, 26); mg.addColorStop(0, '#d9d9e8'); mg.addColorStop(1, '#4a4a66');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(125, 648, 24, 0, Math.PI * 2); ctx.fill();
      // casco de la estación: placas metálicas en la zona baja
      const hull = ctx.createLinearGradient(0, 860, 0, 1000); hull.addColorStop(0, 'rgba(60,66,84,0)'); hull.addColorStop(0.3, 'rgba(60,66,84,0.85)'); hull.addColorStop(1, '#2a2e3a');
      ctx.fillStyle = hull; ctx.fillRect(0, 860, t.W, 140);
      A.texture(ctx, 'sheetmetal', 0.7, 'overlay', () => { ctx.beginPath(); ctx.rect(0, 880, 600, 120); }, 0.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      for (let y = 900; y < 1000; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(600, y); ctx.stroke(); }
      for (let x = 0; x < 600; x += 60) { ctx.beginPath(); ctx.moveTo(x, 900); ctx.lineTo(x, 1000); ctx.stroke(); }
      // cúpula del observatorio
      ctx.save(); ctx.translate(280, 452);
      const dome = ctx.createRadialGradient(-14, -24, 4, 0, 0, 52); dome.addColorStop(0, '#e9edf3'); dome.addColorStop(1, '#5a6272');
      ctx.fillStyle = dome; ctx.beginPath(); ctx.arc(0, 0, 50, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1b1f2a'; ctx.fillRect(-7, -50, 14, 46);
      ctx.fillStyle = '#4b5262'; ctx.fillRect(-58, 0, 116, 10);
      ctx.restore();
      A.title(ctx, 'NEBULOSA', 280, 800, 'rgba(230,220,255,0.6)', 30);
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
