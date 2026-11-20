/* CROWN CLASH ses: sentez SFX (dosya yok) + arena başına yordamsal müzik. Sistem ses ayarına bağlı (sfxBus). */
import { sfxBus } from '../../lib/sfx';
import { tone, noise } from '../hack/hsfx';
import { THEMES, type Theme } from './themes';

let lastAt: Record<string, number> = {};
/** Aynı sesi kısa sürede üst üste çalma (kalabalık savaşta kulak yorulmasın) */
const rl = (k: string, ms: number, f: () => void) => { const n = performance.now(); if ((lastAt[k] ?? 0) + ms > n) return; lastAt[k] = n; f(); };
export const S = {
  // arayüz
  click: () => tone(1400, 0.03, 'square', 0.05),
  hover: () => rl('hv', 40, () => tone(2400, 0.018, 'sine', 0.022)),
  tab: () => { tone(900, 0.03, 'triangle', 0.06); tone(1350, 0.04, 'triangle', 0.05, 0, 0.03); },
  pick: () => { tone(660, 0.05, 'triangle', 0.1); tone(990, 0.06, 'triangle', 0.07, 0, 0.04); },
  unpick: () => { tone(800, 0.04, 'triangle', 0.07); tone(520, 0.05, 'triangle', 0.06, 0, 0.03); },
  deny: () => { tone(160, 0.12, 'square', 0.1, -40); tone(120, 0.1, 'square', 0.08, -20, 0.06); },
  whoosh: () => noise(0.4, 0.12, 400, 0.8, 'bandpass', 0, 3000),
  swoosh: () => noise(0.25, 0.1, 2400, 1.2, 'bandpass', 0, -1800),
  stamp: () => { tone(70, 0.3, 'sine', 0.5, -30); noise(0.15, 0.2, 800, 0.7, 'lowpass'); },
  coin: () => { tone(1568, 0.06, 'square', 0.06); tone(2093, 0.12, 'square', 0.06, 0, 0.06); },
  coins: (n = 6) => { for (let i = 0; i < n; i++) { tone(1500 + Math.random() * 900, 0.05, 'square', 0.035, 0, i * 0.045); } },
  gem: () => { [1318, 1760, 2637].forEach((f, i) => tone(f, 0.2, 'sine', 0.06, 0, i * 0.05)); noise(0.3, 0.03, 9000, 0.6, 'highpass', 0.05); },
  buy: () => { S.stamp(); setTimeout(S.gem, 150); },
  notify: () => { tone(880, 0.09, 'sine', 0.1); tone(1320, 0.14, 'sine', 0.09, 0, 0.1); },
  friend: () => { [659, 880, 1109].forEach((f, i) => tone(f, 0.12, 'triangle', 0.08, 0, i * 0.08)); },
  // kart / yükseltme
  upgrade: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'square', 0.06, 0, i * 0.07)); noise(0.6, 0.06, 5000, 0.5, 'highpass', 0.3, 3000); tone(60, 0.6, 'sine', 0.35, -20, 0.35); },
  evolve: () => { tone(110, 1.2, 'sawtooth', 0.12, 880); for (let i = 0; i < 8; i++) tone(880 + i * 220, 0.1, 'triangle', 0.05, 0, 0.5 + i * 0.06); noise(1.0, 0.08, 300, 0.7, 'bandpass', 0, 6000); setTimeout(() => S.boom(1.2), 1150); },
  cardFlip: () => { noise(0.08, 0.1, 3000, 1.5, 'bandpass'); tone(700, 0.05, 'triangle', 0.05, 400); },
  rarity: (r: string) => { const n = r === 'legendary' ? [523, 659, 784, 1046, 1318, 1568] : r === 'epic' ? [523, 659, 784, 1046] : r === 'rare' ? [659, 784, 988] : [784, 988]; n.forEach((f, i) => tone(f, 0.16, r === 'legendary' ? 'sawtooth' : 'square', 0.06, 0, i * 0.07)); if (r === 'legendary') noise(1.2, 0.08, 200, 0.6, 'bandpass', 0, 7000); },
  // sandık
  chestShake: () => { noise(0.12, 0.12, 300, 1, 'lowpass'); tone(90, 0.12, 'square', 0.08, -20); },
  chestCharge: () => { tone(80, 1.1, 'sawtooth', 0.08, 900); noise(1.1, 0.06, 400, 0.7, 'bandpass', 0, 4000); },
  chestOpen: (big = false) => { S.boom(big ? 1.6 : 1); noise(0.6, 0.14, 4000, 0.5, 'highpass'); [523, 784, 1046, 1568].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, 0, 0.1 + i * 0.06)); },
  // savaş
  deploy: () => rl('dp', 50, () => { noise(0.18, 0.18, 300, 0.7, 'lowpass', 0, -200); tone(90, 0.22, 'sine', 0.35, -50); tone(520, 0.08, 'triangle', 0.05, 300, 0.02); }),
  spellCast: () => { tone(400, 0.25, 'sine', 0.06, 1200); noise(0.25, 0.05, 2000, 1, 'bandpass', 0, 3000); },
  melee: () => rl('ml', 45, () => { noise(0.05, 0.12, 2400, 1.4); tone(140, 0.06, 'square', 0.06, -60); }),
  heavy: () => rl('hv2', 80, () => { noise(0.12, 0.25, 600, 0.8, 'lowpass'); tone(70, 0.18, 'sine', 0.3, -30); }),
  rail: () => rl('rl', 40, () => { tone(2400, 0.09, 'sawtooth', 0.05, -1800); noise(0.05, 0.05, 6000, 0.6, 'highpass'); }),
  snipe: () => rl('sn', 60, () => { noise(0.08, 0.25, 1800, 0.8, 'bandpass'); tone(300, 0.2, 'square', 0.06, -250); }),
  bolt: (k = false) => rl('bt' + k, 60, () => { tone(k ? 300 : 700, 0.12, 'square', 0.05, k ? -200 : -500); noise(0.06, 0.05, k ? 900 : 3000, 1); }),
  tracer: () => rl('tr', 35, () => { tone(1800, 0.03, 'square', 0.03); noise(0.03, 0.04, 5000, 1); }),
  flame: () => rl('fl', 70, () => noise(0.25, 0.1, 900, 0.6, 'bandpass', 0, -400)),
  frost: () => rl('fr', 70, () => { tone(2600, 0.12, 'sine', 0.04, -900); noise(0.12, 0.05, 7000, 1, 'highpass'); }),
  beam: (lvl = 0) => rl('bm', 90, () => tone(180 + lvl * 120, 0.1, 'sawtooth', 0.03 + lvl * 0.015, 40)),
  heal: () => rl('hl', 200, () => { tone(880, 0.15, 'sine', 0.04, 220); tone(1320, 0.15, 'sine', 0.03, 220, 0.05); }),
  arc: () => rl('ar', 60, () => { for (let i = 0; i < 4; i++) noise(0.04, 0.07, 3000 + i * 900, 3, 'bandpass', i * 0.025); tone(80, 0.15, 'sawtooth', 0.05); }),
  plasma: () => rl('pl', 80, () => { tone(220, 0.35, 'sawtooth', 0.08, 300); noise(0.3, 0.06, 1200, 0.8, 'bandpass', 0, 1500); }),
  boom: (big = 1) => { noise(0.5 * big, 0.3, 500, 0.5, 'lowpass', 0, -380); tone(60, 0.5 * big, 'sine', 0.4, -30); },
  shield: () => { tone(1800, 0.2, 'square', 0.05, -1500); noise(0.3, 0.12, 5000, 2, 'bandpass', 0, -3000); },
  charge: () => { tone(200, 0.35, 'sawtooth', 0.06, 500); },
  crit: () => { tone(1200, 0.06, 'square', 0.08); noise(0.1, 0.15, 2000, 1); },
  strikeWarn: () => tone(1200, 0.6, 'sine', 0.06, 900),
  strike: () => { noise(0.9, 0.4, 900, 0.4, 'lowpass', 0, -800); tone(45, 0.9, 'sine', 0.5, -20); tone(1800, 0.25, 'sawtooth', 0.06, -1500); },
  nova: () => { S.strike(); S.boom(2); },
  emp: () => { tone(80, 0.4, 'square', 0.12, 600); for (let i = 0; i < 6; i++) noise(0.05, 0.08, 4000 - i * 400, 4, 'bandpass', i * 0.04); },
  freeze: () => { noise(0.8, 0.12, 6000, 1, 'highpass', 0, -4000); [2093, 2637, 3136].forEach((f, i) => tone(f, 0.3, 'sine', 0.04, 0, i * 0.05)); },
  shatter: () => { for (let i = 0; i < 8; i++) tone(2000 + Math.random() * 3000, 0.06, 'square', 0.03, 0, i * 0.02); noise(0.3, 0.15, 6000, 0.8, 'highpass'); },
  roll: () => { noise(1.2, 0.12, 200, 0.8, 'lowpass'); tone(50, 1.2, 'sawtooth', 0.06, 10); },
  overclock: () => { tone(300, 0.5, 'sawtooth', 0.06, 1200); tone(150, 0.5, 'square', 0.04, 600); },
  pod: () => rl('pd', 90, () => { tone(1600, 0.2, 'sine', 0.03, -1300); setTimeout(() => { noise(0.12, 0.15, 500, 0.6, 'lowpass'); }, 220); }),
  spawn: () => rl('sp', 120, () => { tone(400, 0.08, 'square', 0.04, 300); noise(0.1, 0.06, 1500, 1); }),
  pump: () => { tone(330, 0.1, 'sine', 0.06, 330); tone(660, 0.15, 'sine', 0.05, 0, 0.08); },
  die: () => rl('di', 50, () => { noise(0.16, 0.12, 900, 1, 'bandpass', 0, -500); tone(300, 0.15, 'triangle', 0.05, -220); }),
  tower: () => { S.boom(1.8); [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, 0, 0.35 + i * 0.09)); },
  crown: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'square', 0.06, 0, i * 0.07)); },
  kingWake: () => { tone(110, 0.8, 'sawtooth', 0.1, 220); tone(55, 0.8, 'sine', 0.3); },
  elixFull: () => tone(1046, 0.05, 'sine', 0.04),
  count: (last = false) => tone(last ? 1320 : 660, last ? 0.4 : 0.15, 'square', 0.1),
  overtime: () => { [440, 440, 660].forEach((f, i) => tone(f, 0.18, 'sawtooth', 0.08, 0, i * 0.2)); },
  win: () => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, i === 6 ? 0.8 : 0.16, 'square', 0.09, 0, i * 0.12)); },
  lose: () => { [440, 415, 392, 330].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.25, 'sawtooth', 0.08, 0, i * 0.22)); },
  trophyUp: () => { for (let i = 0; i < 6; i++) tone(660 + i * 110, 0.06, 'triangle', 0.05, 0, i * 0.05); },
  trophyDown: () => { for (let i = 0; i < 5; i++) tone(660 - i * 80, 0.07, 'triangle', 0.05, 0, i * 0.06); },
  // emojiler
  emote: (e: string) => {
    if (e === 'laugh') { for (let i = 0; i < 5; i++) tone(520 - i * 20, 0.08, 'square', 0.05, 80, i * 0.1); }
    else if (e === 'cry') { tone(700, 0.6, 'sine', 0.06, -300); tone(690, 0.6, 'sine', 0.04, -320, 0.05); }
    else if (e === 'angry') { tone(110, 0.35, 'sawtooth', 0.1, 40); noise(0.3, 0.1, 600, 1); }
    else if (e === 'taunt') { tone(600, 0.08, 'square', 0.05, 300); tone(900, 0.08, 'square', 0.05, -300, 0.1); tone(600, 0.1, 'square', 0.05, 300, 0.2); }
    else if (e === 'thumb' || e === 'gg') { [784, 1046].forEach((f, i) => tone(f, 0.12, 'triangle', 0.07, 0, i * 0.09)); }
    else if (e === 'wow') tone(500, 0.35, 'sine', 0.07, 700);
    else if (e === 'facepalm') { noise(0.06, 0.2, 1500, 1); tone(300, 0.3, 'triangle', 0.05, -150, 0.05); }
    else if (e === 'think') { tone(440, 0.12, 'sine', 0.05); tone(494, 0.12, 'sine', 0.05, 0, 0.15); }
    else if (e === 'sleep') tone(300, 0.7, 'sine', 0.05, -120);
    else tone(880, 0.12, 'triangle', 0.06);
  },
};

/* ---- müzik: arena teması başına yordamsal ---- */
const N = (n: number) => 440 * 2 ** ((n - 69) / 12);
let timer: ReturnType<typeof setInterval> | null = null, out: GainNode | null = null, step = 0, nextT = 0, intensity = 0, th: Theme = THEMES[0]!;
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
function kick(c: AudioContext, t: number, f0: number, peak: number) { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18); o.connect(g).connect(out!); v(g, t, peak, 0.002, 0.2); o.start(t); o.stop(t + 0.25); }
function tick(c: AudioContext) {
  const m = th.music, bpm = m.bpm + (intensity >= 3 ? 16 : 0), spb = 60 / bpm / 4;
  while (nextT < c.currentTime + 0.15) {
    const t = nextT, st = step % 16, bar = Math.floor(step / 16) % 4, ch = m.prog[bar]!.map((n) => n + m.root);
    const dr = m.drum;
    if (intensity > 0) {
      if (dr === 'tribal') { if (st % 4 === 0 || st === 10) kick(c, t, 120, 0.7); if (st === 6 || st === 14) hit(c, t, 0.2, 0.18, 300, 'bandpass'); }
      else if (dr === 'industrial') { if (st % 4 === 0) kick(c, t, 160, 0.75); if (st === 4 || st === 12) { hit(c, t, 0.12, 0.28, 2400, 'bandpass'); hit(c, t, 0.05, 0.15, 6000, 'highpass'); } if (st % 2 === 1) hit(c, t, 0.03, 0.05, 3000, 'bandpass'); }
      else if (dr === 'airy') { if (st === 0 || st === 8) kick(c, t, 100, 0.5); if (st === 4 || st === 12) hit(c, t, 0.3, 0.1, 5000, 'highpass'); }
      else if (dr === 'dark') { if (st % 4 === 0 || st === 3) kick(c, t, 140, 0.8); if (st === 8) hit(c, t, 0.25, 0.25, 1200, 'bandpass'); if (st % 2) hit(c, t, 0.03, 0.06, 9000, 'highpass'); }
      else { if (st % 4 === 0) kick(c, t, 150, 0.7); if (st === 4 || st === 12) hit(c, t, 0.16, 0.25, 1800, 'bandpass'); if (st % 2 === 1) hit(c, t, 0.04, intensity >= 2 ? 0.1 : 0.06, 8000, 'highpass'); }
      if (intensity >= 2 && st % 2 === 0) hit(c, t, 0.03, 0.04, 10000, 'highpass');
    }
    if (st % 2 === 0) osc(c, m.wave, N(ch[0]! - 24), t, spb * 1.8, intensity ? 0.15 : 0.08, intensity ? 900 : 500);
    if (st === 0) for (const n of ch) { osc(c, 'sawtooth', N(n), t, spb * 15, 0.022, 1400, -8); osc(c, 'sawtooth', N(n), t, spb * 15, 0.022, 1400, 8); }
    if (intensity >= 1 && (intensity >= 2 || st % 2 === 0)) { const n = ch[(st >> (intensity >= 2 ? 0 : 1)) % 3]! + 12 + (st >= 8 && intensity >= 3 ? 12 : 0); osc(c, m.lead === 'sawtooth' ? 'square' : m.lead, N(n), t, spb * 0.9, 0.03, 3200); }
    if (intensity >= 3 && st % 8 === 0) osc(c, 'sawtooth', N(ch[2]! + 24 - (st === 8 ? 2 : 0)), t, spb * 6, 0.03, 2600, 5);
    nextT += spb; step++;
  }
}
export const music = {
  start(level = 0) { const { c, out: bus } = sfxBus(); if (!out) { out = c.createGain(); out.connect(bus); } out.gain.value = 0.45 * musVol; intensity = level; if (!timer) { nextT = c.currentTime + 0.05; step = 0; timer = setInterval(() => tick(c), 50); } },
  theme(t: Theme) { th = t; },
  level(l: number) { intensity = l; },
  pause(p: boolean) { if (out) out.gain.value = p ? 0 : 0.45 * musVol; },
  vol(x: number) { musVol = x; localStorage.setItem('qv.clash.mus', String(x)); if (out) out.gain.value = 0.45 * x; },
  get volume() { return musVol; },
  stop() { if (timer) clearInterval(timer); timer = null; if (out) { out.disconnect(); out = null; } },
};
