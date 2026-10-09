/* Desk sounds and the generated harbor music.
   Desk scripts share one script scope (classic scripts, loaded in order by index.html); app.js boots the desk. */
'use strict';

// ------------------------------------------------------------ audio: desk sounds + generated harbor music
let actx = null;
const ctx = () => (actx ||= new (window.AudioContext || window.webkitAudioContext)());
function noise(dur) { const b = ctx().createBuffer(1, ctx().sampleRate * dur, ctx().sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx().createBufferSource(); s.buffer = b; return s; }
function snd(kind, pitch = 1) {
  if (!S.prefs.sound) return;
  try {
    const t = ctx().currentTime, g = ctx().createGain(); g.connect(ctx().destination);
    if (kind === 'thud') { const o = ctx().createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140 * pitch, t); o.frequency.exponentialRampToValueAtTime(40 * pitch, t + .18); g.gain.setValueAtTime(.7, t); g.gain.exponentialRampToValueAtTime(.001, t + .25); o.connect(g); o.start(t); o.stop(t + .26); const n = noise(.08); const f = ctx().createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; n.connect(f); f.connect(g); n.start(t); }
    else if (kind === 'slide') { const n = noise(.35); const f = ctx().createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2400, t + .3); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .35); n.connect(f); f.connect(g); n.start(t); }
    else if (kind === 'ding') { for (const [f, d] of [[880, 0], [1320, .05]]) { const o = ctx().createOscillator(); o.type = 'triangle'; o.frequency.value = f; const gg = ctx().createGain(); gg.gain.setValueAtTime(.18, t + d); gg.gain.exponentialRampToValueAtTime(.001, t + d + .6); o.connect(gg); gg.connect(ctx().destination); o.start(t + d); o.stop(t + d + .62); } }
    else if (kind === 'coin') { for (const [f, d] of [[1760, 0], [2217, .07]]) { const o = ctx().createOscillator(); o.type = 'square'; o.frequency.value = f * pitch; const gg = ctx().createGain(); gg.gain.setValueAtTime(.05, t + d); gg.gain.exponentialRampToValueAtTime(.001, t + d + .25); o.connect(gg); gg.connect(ctx().destination); o.start(t + d); o.stop(t + d + .3); } }
    else if (kind === 'tick') { const o = ctx().createOscillator(); o.type = 'square'; o.frequency.value = 1800; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .05); o.connect(g); o.start(t); o.stop(t + .06); }
    else if (kind === 'whistle') { const o = ctx().createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1900, t); o.frequency.linearRampToValueAtTime(2300, t + .12); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .03); g.gain.exponentialRampToValueAtTime(.001, t + .22); o.connect(g); o.start(t); o.stop(t + .24); }
    else if (kind === 'flip') { const n = noise(.12); const f = ctx().createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500; g.gain.setValueAtTime(.1, t); g.gain.exponentialRampToValueAtTime(.001, t + .12); n.connect(f); f.connect(g); n.start(t); }
  } catch (e) { /* no audio */ }
}
// Original ambient loop: slow pad chords (I - IV - vi - V-ish in D), filtered-noise surf, occasional gull chirp. Nothing sampled or fetched.
// It follows the desk: one more layer per item cleared today (bass, harp, bells, brushes, counter-melody), and it
// settles on the home chord with a rising chime once the harbor is clear. The chandlery sells a second tune.
const TRACKS = { harbor: [[146.8, 185, 220, 277.2], [196, 246.9, 293.7, 370], [123.5, 146.8, 185, 220], [110, 164.8, 220, 246.9]], night: [[146.8, 174.6, 220, 261.6], [116.5, 146.8, 174.6, 220], [174.6, 220, 261.6, 349.2], [130.8, 164.8, 196, 261.6]] };
const music = { on: false, master: null, nodes: [], timers: [], resolved: false };
function musicLayers(c, t, chord, n) {
  const tone = (f, at, len, type, vol) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + .02); g.gain.exponentialRampToValueAtTime(.001, at + len); o.connect(g); g.connect(music.master); o.start(at); o.stop(at + len + .05); };
  if (n >= 1) { tone(chord[0] / 2, t + .1, 4.2, 'sine', .07); tone(chord[0] / 2, t + 4.6, 4.2, 'sine', .06); }
  if (n >= 2) for (let k = 0; k < 8; k++) tone(chord[k % 4] * 2, t + .5 + k * 1.05, .9, 'triangle', .025);
  if (n >= 3) for (const [j, d] of [[2, 1.2], [3, 5.7]]) tone(chord[j] * 4, t + d, 2.4, 'sine', .018);
  if (n >= 4) for (let k = 0; k < 16; k++) { const s = noise(.05); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000; const g = c.createGain(); g.gain.value = k % 4 ? .012 : .022; s.connect(f); f.connect(g); g.connect(music.master); s.start(t + k * .5625); }
  if (n >= 5) for (const [j, d] of [[1, 0], [2, 2.25], [3, 4.5], [2, 6.75]]) tone(chord[j] * 3, t + d, 2, 'triangle', .015);
}
function musicResolve(c, t) { [587.3, 740, 880, 1174.7].forEach((f, k) => { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0, t + k * .18); g.gain.linearRampToValueAtTime(.04, t + k * .18 + .02); g.gain.exponentialRampToValueAtTime(.001, t + k * .18 + 1.6); o.connect(g); g.connect(music.master); o.start(t + k * .18); o.stop(t + k * .18 + 1.7); }); }
function musicStart() {
  if (music.on) return; const c = ctx(); music.on = true;
  music.master = c.createGain(); music.master.gain.value = 0; music.master.connect(c.destination);
  music.master.gain.linearRampToValueAtTime(S.prefs.musicVol / 100 * .5, c.currentTime + 2);
  // surf: brown-ish noise through a slow-swelling lowpass
  const n = noise(4); n.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; const sg = c.createGain(); sg.gain.value = .08;
  const lfo = c.createOscillator(); lfo.frequency.value = .09; const lg = c.createGain(); lg.gain.value = .05; lfo.connect(lg); lg.connect(sg.gain); lfo.start();
  n.connect(lp); lp.connect(sg); sg.connect(music.master); n.start(); music.nodes.push(n, lfo);
  // pad: chord every 9 s
  let i = 0; music.resolved = false;
  const pad = () => {
    if (!music.on) return; const t = c.currentTime; const chords = TRACKS[S.fun.track] || TRACKS.harbor; const clear = harborClear();
    const chord = clear ? chords[0] : chords[i++ % chords.length];
    if (clear && !music.resolved) musicResolve(c, t + .4); music.resolved = clear;
    musicLayers(c, t, chord, G.musicLayers(clearedToday()));
    for (const f of chord) for (const det of [-4, 4]) {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 900;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.035, t + 3); g.gain.setValueAtTime(.035, t + 6.5); g.gain.linearRampToValueAtTime(0, t + 10);
      o.connect(f2); f2.connect(g); g.connect(music.master); o.start(t); o.stop(t + 10.2);
    }
    music.timers.push(setTimeout(pad, 9000));
  };
  pad();
  const gull = () => { if (!music.on) return; const t = c.currentTime; const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1500, t); o.frequency.linearRampToValueAtTime(2300, t + .12); o.frequency.linearRampToValueAtTime(1300, t + .35); const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.03, t + .06); g.gain.linearRampToValueAtTime(0, t + .4); o.connect(g); g.connect(music.master); o.start(t); o.stop(t + .45); music.timers.push(setTimeout(gull, 9000 + Math.random() * 18000)); };
  music.timers.push(setTimeout(gull, 5000));
}
function musicStop() { if (!music.on) return; music.on = false; const c = ctx(); music.master.gain.linearRampToValueAtTime(0, c.currentTime + 1.2); music.timers.forEach(clearTimeout); music.timers = []; const m = music.master, nodes = music.nodes; music.nodes = []; setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch (e) {} }); m.disconnect(); }, 1500); }
function musicVolume() { if (music.on && music.master) music.master.gain.linearRampToValueAtTime(S.prefs.musicVol / 100 * .5, ctx().currentTime + .2); }
