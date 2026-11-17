/* SPIRE//CLASH ses: sentez SFX + yordamsal synthwave müzik (dosya yok). Sistem ses ayarına bağlı (sfxBus). */
import { sfxBus } from '../../lib/sfx';
import { tone, noise } from '../hack/hsfx';

export const S = {
  click: () => tone(1400, 0.03, 'square', 0.05),
  hover: () => tone(2200, 0.02, 'sine', 0.025),
  pick: () => { tone(660, 0.05, 'triangle', 0.1); tone(990, 0.06, 'triangle', 0.07, 0, 0.04); },
  deny: () => { tone(160, 0.12, 'square', 0.1, -40); },
  deploy: () => { noise(0.18, 0.18, 300, 0.7, 'lowpass', 0, -200); tone(90, 0.22, 'sine', 0.35, -50); tone(520, 0.08, 'triangle', 0.05, 300, 0.02); },
  melee: () => { noise(0.05, 0.12, 2400, 1.4); tone(140, 0.06, 'square', 0.06, -60); },
  rail: () => { tone(2400, 0.09, 'sawtooth', 0.05, -1800); noise(0.05, 0.05, 6000, 0.6, 'highpass'); },
  bolt: (k = false) => { tone(k ? 300 : 700, 0.12, 'square', 0.05, k ? -200 : -500); noise(0.06, 0.05, k ? 900 : 3000, 1); },
  tracer: () => { tone(1800, 0.03, 'square', 0.03); noise(0.03, 0.04, 5000, 1); },
  arc: () => { for (let i = 0; i < 4; i++) noise(0.04, 0.07, 3000 + i * 900, 3, 'bandpass', i * 0.025); tone(80, 0.15, 'sawtooth', 0.05); },
  plasma: () => { tone(220, 0.35, 'sawtooth', 0.08, 300); noise(0.3, 0.06, 1200, 0.8, 'bandpass', 0, 1500); },
  boom: (big = 1) => { noise(0.5 * big, 0.3, 500, 0.5, 'lowpass', 0, -380); tone(60, 0.5 * big, 'sine', 0.4, -30); },
  strikeWarn: () => { tone(1200, 0.6, 'sine', 0.06, 900); },
  strike: () => { noise(0.9, 0.4, 900, 0.4, 'lowpass', 0, -800); tone(45, 0.9, 'sine', 0.5, -20); tone(1800, 0.25, 'sawtooth', 0.06, -1500); },
  emp: () => { tone(80, 0.4, 'square', 0.12, 600); for (let i = 0; i < 6; i++) noise(0.05, 0.08, 4000 - i * 400, 4, 'bandpass', i * 0.04); },
  die: () => { noise(0.16, 0.12, 900, 1, 'bandpass', 0, -500); tone(300, 0.15, 'triangle', 0.05, -220); },
  tower: () => { S.boom(1.8); [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, 0, 0.35 + i * 0.09)); },
  crown: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'square', 0.06, 0, i * 0.07)); },
  elixFull: () => tone(1046, 0.05, 'sine', 0.04),
  count: (last = false) => tone(last ? 1320 : 660, last ? 0.4 : 0.15, 'square', 0.1),
  win: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, i === 6 ? 0.8 : 0.16, 'square', 0.09, 0, i * 0.12)); },
  lose: () => { [440, 415, 392, 330].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.25, 'sawtooth', 0.08, 0, i * 0.22)); },
  whoosh: () => noise(0.4, 0.12, 400, 0.8, 'bandpass', 0, 3000),
  stamp: () => { tone(70, 0.3, 'sine', 0.5, -30); noise(0.15, 0.2, 800, 0.7, 'lowpass'); },
};

/* ---- müzik ---- */
const N = (n: number) => 440 * 2 ** ((n - 69) / 12);
const PROG = [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]]; // Am F Dm E
let timer: ReturnType<typeof setInterval> | null = null, out: GainNode | null = null, step = 0, nextT = 0, intensity = 0, bpm = 112;
let musVol = Number(localStorage.getItem('qv.clash.mus') ?? '0.8');
function v(g: GainNode, t: number, peak: number, a: number, d: number) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function osc(c: AudioContext, type: OscillatorType, f: number, t: number, d: number, peak: number, lp = 0, det = 0) {
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; o.detune.value = det;
  let n: AudioNode = o; if (lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(lp, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, lp * 0.3), t + d); o.connect(fl); n = fl; }
  n.connect(g).connect(out!); v(g, t, peak, 0.005, d); o.start(t); o.stop(t + d + 0.05);
}
function hit(c: AudioContext, t: number, d: number, peak: number, f: number, type: BiquadFilterType) {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * d), c.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); fl.type = type; fl.frequency.value = f; s.buffer = b; s.connect(fl).connect(g).connect(out!); v(g, t, peak, 0.002, d); s.start(t);
}
function tick(c: AudioContext) {
  const spb = 60 / bpm / 4;
  while (nextT < c.currentTime + 0.15) {
    const t = nextT, st = step % 16, bar = Math.floor(step / 16) % 4, ch = PROG[bar]!;
    if (intensity > 0 && st % 4 === 0) { osc(c, 'sine', 110, t, 0.22, 0.55, 0); const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18); o.connect(g).connect(out!); v(g, t, 0.7, 0.002, 0.2); o.start(t); o.stop(t + 0.25); }
    if (intensity > 0 && (st === 4 || st === 12)) hit(c, t, 0.16, 0.25, 1800, 'bandpass');
    if (intensity > 0 && st % 2 === 1) hit(c, t, 0.04, intensity >= 2 ? 0.1 : 0.06, 8000, 'highpass');
    if (intensity >= 2 && st % 2 === 0) hit(c, t, 0.03, 0.04, 10000, 'highpass');
    // bas: sekizlik nabız
    if (st % 2 === 0) osc(c, 'sawtooth', N(ch[0]! - 24), t, spb * 1.8, intensity ? 0.16 : 0.09, intensity ? 900 : 500);
    // ped: her ölçü başı
    if (st === 0) for (const n of ch) { osc(c, 'sawtooth', N(n), t, spb * 15, 0.025, 1400, -8); osc(c, 'sawtooth', N(n), t, spb * 15, 0.025, 1400, 8); }
    // arp
    if (intensity >= 1 && (intensity >= 2 || st % 2 === 0)) { const n = ch[(st >> (intensity >= 2 ? 0 : 1)) % 3]! + 12 + (st >= 8 && intensity >= 3 ? 12 : 0); osc(c, 'square', N(n), t, spb * 0.9, 0.035, 3200); }
    // lead (uzatma)
    if (intensity >= 3 && st % 8 === 0) osc(c, 'sawtooth', N(ch[2]! + 24 - (st === 8 ? 2 : 0)), t, spb * 6, 0.03, 2600, 5);
    nextT += spb; step++;
  }
}
export const music = {
  start(level = 0) { const { c, out: bus } = sfxBus(); if (!out) { out = c.createGain(); out.connect(bus); } out.gain.value = 0.5 * musVol; intensity = level; bpm = level >= 3 ? 128 : 112; if (!timer) { nextT = c.currentTime + 0.05; step = 0; timer = setInterval(() => tick(c), 50); } },
  level(l: number) { intensity = l; bpm = l >= 3 ? 128 : 112; },
  pause(p: boolean) { if (out) out.gain.value = p ? 0 : 0.5 * musVol; },
  vol(x: number) { musVol = x; localStorage.setItem('qv.clash.mus', String(x)); if (out) out.gain.value = 0.5 * x; },
  get volume() { return musVol; },
  stop() { if (timer) clearInterval(timer); timer = null; if (out) { out.disconnect(); out = null; } },
};
