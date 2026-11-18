/* Páramo Pinball — efectos de sonido sintetizados (WebAudio, sin muestras)
 * © 2026 Sebastian Sotomontes.
 */
(function (G) {
  'use strict';
  const PB = (G.PB = G.PB || {});
  let ctx = null, master = null, enabled = true, noiseBuf = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = G.AudioContext || G.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, freq, vol, q, delay) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
  }
  const arp = (notes, step, type, vol) => notes.forEach((n, i) => tone(n, step * 1.6, type || 'triangle', vol || 0.22, null, i * step));

  const SFX = {
    flip: () => noise(0.05, 1800, 0.25, 2),
    bumper: (i) => { tone([520, 620, 740][i || 0], 0.12, 'square', 0.18, 260); noise(0.06, 900, 0.2); },
    sling: () => { tone(300, 0.08, 'square', 0.15, 180); noise(0.05, 1400, 0.2); },
    drop: () => { tone(220, 0.1, 'sawtooth', 0.18, 110); noise(0.08, 500, 0.25); },
    lane: () => tone(880, 0.1, 'triangle', 0.2, 1320),
    roll: () => tone(660, 0.07, 'triangle', 0.15),
    spin: () => tone(1500 + Math.random() * 300, 0.03, 'square', 0.06),
    ramp: () => { tone(300, 0.6, 'sawtooth', 0.12, 1200); noise(0.6, 2500, 0.08, 0.6); },
    sink: () => tone(180, 0.3, 'sine', 0.3, 70),
    tunnel: () => { tone(220, 0.9, 'sawtooth', 0.1, 55); noise(0.9, 300, 0.18, 0.5); tone(660, 0.15, 'square', 0.12, 990, 0.85); },
    kick: () => { noise(0.08, 600, 0.35); tone(140, 0.1, 'square', 0.2, 300); },
    launch: () => noise(0.25, 700, 0.3, 0.7),
    ready: () => arp([392, 523], 0.08),
    complete: () => arp([523, 659, 784, 1046], 0.07),
    skill: () => arp([784, 988, 1175, 1568], 0.06, 'square', 0.15),
    rankup: () => arp([392, 494, 587, 784, 988, 1175], 0.09),
    multiball: () => arp([262, 330, 392, 523, 659, 784, 1046], 0.07, 'square', 0.16),
    jackpot: () => arp([1046, 784, 1046, 1318, 1568], 0.08, 'square', 0.18),
    save: () => arp([659, 880], 0.08),
    fail: () => arp([392, 330, 262], 0.12, 'sawtooth', 0.14),
    drain: () => tone(400, 0.7, 'sawtooth', 0.16, 60),
    tilt: () => tone(90, 0.9, 'square', 0.25, 60),
    nudge: () => noise(0.12, 200, 0.4, 0.5),
    reset: () => tone(440, 0.08, 'square', 0.1, 660),
    over: () => arp([523, 466, 392, 330, 262], 0.16, 'triangle', 0.2),
  };

  /* ---------------- música de fondo estilo MIDI de los 90 ----------------
     Composición original generada: progresión fija por mesa + melodía por
     caminata aleatoria sobre notas del acorde (semilla fija => siempre igual). */
  const SONGS = {
    paramo:   { bpm: 104, swing: 0.12, root: 57, scale: [0, 3, 5, 7, 10], chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]], lead: 'triangle', seed: 17, drums: 'andina' },
    nebulosa: { bpm: 92,  swing: 0,    root: 50, scale: [0, 2, 3, 5, 7, 8, 10], chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [3, 7, 10]], lead: 'sawtooth', seed: 29, drums: 'espacio' },
    corsario: { bpm: 126, swing: 0.2,  root: 55, scale: [0, 2, 4, 5, 7, 9, 11], chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], lead: 'square', seed: 41, drums: 'marcha' },
  };
  let musicOn = true, musicTimer = null, musicGain = null, song = null, step = 0, nextT = 0, pattern = null;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function buildPattern(s) {
    let seed = s.seed; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const steps = 16 * s.chords.length * 2; // 2 vueltas de la progresión, semicorcheas
    const mel = [];
    let deg = 2;
    for (let i = 0; i < steps; i++) {
      const bar = Math.floor(i / 16) % s.chords.length, beat = i % 16;
      const strong = beat % 4 === 0;
      const play = strong ? r() < 0.85 : r() < (beat % 2 === 0 ? 0.45 : 0.18);
      if (!play) { mel.push(null); continue; }
      const ch = s.chords[bar];
      if (strong && r() < 0.6) { mel.push(s.root + 12 + ch[Math.floor(r() * 3)]); continue; }
      deg = Math.max(0, Math.min(s.scale.length * 2 - 1, deg + Math.floor(r() * 5) - 2));
      mel.push(s.root + 12 + s.scale[deg % s.scale.length] + 12 * Math.floor(deg / s.scale.length));
    }
    // la segunda vuelta repite la primera con variación de final (frase pregunta/respuesta)
    const half = steps / 2;
    for (let i = half; i < steps - 8; i++) mel[i] = mel[i - half];
    return { mel, steps };
  }

  function voice(type, freq, t, dur, vol, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(kind, t) {
    if (kind === 'kick') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.16); return; }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = ctx.createGain(); const d = kind === 'hat' ? 0.04 : 0.12; g.gain.setValueAtTime(kind === 'hat' ? 0.12 : 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); s.stop(t + d + 0.01);
  }

  function schedule() {
    if (!ctx || !song) return;
    const s = song, spb = 60 / s.bpm / 4; // segundos por semicorchea
    while (nextT < ctx.currentTime + 0.2) {
      const i = step % pattern.steps, beat = i % 16, bar = Math.floor(i / 16) % s.chords.length;
      const t = nextT + (i % 2 ? s.swing * spb : 0);
      const ch = s.chords[bar];
      const n = pattern.mel[i]; if (n) voice(s.lead, mtof(n), t, spb * 1.8, 0.07, musicGain);
      if (beat === 0 || beat === 8) voice('triangle', mtof(s.root - 12 + ch[0]), t, spb * 7, 0.16, musicGain);
      if (beat % 4 === 2) for (const c of ch) voice('square', mtof(s.root + c), t, spb * 1.2, 0.025, musicGain);
      if (s.drums === 'andina') { if (beat === 0 || beat === 6 || beat === 10) drum('kick', t); if (beat === 4 || beat === 12) drum('snare', t); if (beat % 2 === 0) drum('hat', t); }
      else if (s.drums === 'espacio') { if (beat === 0) drum('kick', t); if (beat === 8) drum('snare', t); if (beat % 4 === 2) drum('hat', t); }
      else { if (beat % 4 === 0) drum('kick', t); if (beat === 4 || beat === 12) drum('snare', t); if (beat % 2 === 1) drum('hat', t); }
      nextT += spb; step++;
    }
  }

  function playMusic(tableId) {
    if (!ctx) return;
    stopMusic();
    if (!musicOn || !SONGS[tableId]) return;
    song = SONGS[tableId]; pattern = buildPattern(song); step = 0; nextT = ctx.currentTime + 0.1;
    musicGain = ctx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master);
    musicTimer = setInterval(schedule, 50);
  }
  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer); musicTimer = null;
    if (musicGain) { try { musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } catch (e) { /* */ } musicGain = null; }
    song = null;
  }

  PB.audio = {
    init,
    play: (name, arg) => { const f = SFX[name]; if (f) try { f(arg); } catch (e) { /* audio no disponible */ } },
    toggle: () => (enabled = !enabled),
    get enabled() { return enabled; },
    music: playMusic, stopMusic,
    toggleMusic(tableId) { musicOn = !musicOn; if (musicOn) playMusic(tableId); else stopMusic(); return musicOn; },
    get musicOn() { return musicOn; },
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
