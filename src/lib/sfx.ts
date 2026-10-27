// Sentezlenmiş arayüz sesleri (dosya yok). AudioContext ilk kullanıcı etkileşiminde açılır.
let ctx: AudioContext | null = null, master: GainNode | null = null;
let vol = Number(localStorage.getItem('qv.vol') ?? '0.5'), muted = localStorage.getItem('qv.mute') === '1';
function ensure() {
  if (!ctx) { ctx = new AudioContext(); master = ctx.createGain(); master.connect(ctx.destination); apply(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function apply() { if (master) master.gain.value = muted ? 0 : vol * 0.35; }
export const audio = {
  get volume() { return vol; }, get muted() { return muted; },
  setVolume(v: number) { vol = v; localStorage.setItem('qv.vol', String(v)); apply(); },
  setMuted(m: boolean) { muted = m; localStorage.setItem('qv.mute', m ? '1' : '0'); apply(); },
  suspend() { ctx?.suspend(); },
};
function tone(f: number, d: number, type: OscillatorType = 'square', g = 0.25, slide = 0, delay = 0) {
  const c = ensure(); if (!master) return;
  const t = c.currentTime + delay, o = c.createOscillator(), a = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + 0.008); a.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(a).connect(master); o.start(t); o.stop(t + d + 0.02);
}
function noise(d: number, g = 0.12, hp = 1800) {
  const c = ensure(); if (!master) return;
  const b = c.createBuffer(1, Math.floor(c.sampleRate * d), c.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), a = c.createGain();
  f.type = 'highpass'; f.frequency.value = hp; a.gain.value = g; s.buffer = b; s.connect(f).connect(a).connect(master); s.start();
}
export const sfx = {
  click: () => tone(1800, 0.04, 'square', 0.08),
  hover: () => tone(2600, 0.02, 'sine', 0.03),
  key: () => tone(900 + Math.random() * 300, 0.025, 'square', 0.05),
  open: () => { tone(420, 0.12, 'sawtooth', 0.12, 600); noise(0.08, 0.05); },
  close: () => tone(900, 0.12, 'sawtooth', 0.1, -700),
  error: () => { tone(160, 0.18, 'square', 0.18); tone(120, 0.22, 'square', 0.14, 0, 0.12); },
  granted: () => { tone(660, 0.09, 'triangle', 0.16); tone(990, 0.12, 'triangle', 0.16, 0, 0.08); tone(1320, 0.2, 'triangle', 0.12, 0, 0.16); },
  glitch: () => noise(0.18, 0.12, 900),
  boot: () => { tone(55, 1.2, 'sawtooth', 0.12, 110); noise(0.4, 0.04, 400); },
};
