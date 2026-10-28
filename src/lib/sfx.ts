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
/** Ortam sesi: prosedürel, alçak uğultu. Ana ses düğmesine bağlı; açılışta yavaşça gelir, kapanışta söner. */
export function ambient(kind: 'codex' | 'starmap'): () => void {
  const c = ensure(); if (!master) return () => {};
  const out = c.createGain(), t0 = c.currentTime; out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(kind === 'codex' ? 0.22 : 0.26, t0 + 3);
  out.connect(master); const nodes: AudioScheduledSourceNode[] = [];
  const osc = (f: number, type: OscillatorType, g: number, dest: AudioNode, det = 0) => { const o = c.createOscillator(), a = c.createGain(); o.type = type; o.frequency.value = f; o.detune.value = det; a.gain.value = g; o.connect(a).connect(dest); o.start(); nodes.push(o); return { o, a }; };
  const lfo = (rate: number, depth: number, param: AudioParam) => { const o = c.createOscillator(), a = c.createGain(); o.frequency.value = rate; a.gain.value = depth; o.connect(a).connect(param); o.start(); nodes.push(o); };
  const noiseSrc = (dest: AudioNode, g: number) => { const b = c.createBuffer(1, c.sampleRate * 4, c.sampleRate), ch = b.getChannelData(0); let last = 0;
    for (let i = 0; i < ch.length; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.015; ch[i] = last * 6; }
    const s = c.createBufferSource(), a = c.createGain(); s.buffer = b; s.loop = true; a.gain.value = g; s.connect(a).connect(dest); s.start(); nodes.push(s); return a; };
  if (kind === 'codex') { // sıcak arşiv uğultusu: sunucu odası, hafif titreşen 55 Hz
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.7; lp.connect(out);
    osc(55, 'sawtooth', 0.22, lp, -6); osc(55, 'sawtooth', 0.22, lp, 7); osc(82.4, 'triangle', 0.12, lp); osc(110, 'sine', 0.05, out);
    lfo(0.07, 90, lp.frequency);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6; bp.connect(out); noiseSrc(bp, 0.06); lfo(0.05, 300, bp.frequency);
  } else { // derin uzay: alçak beşli, yavaş süpürülen rüzgâr, uzak ışıltı
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.connect(out);
    osc(41.2, 'sine', 0.5, lp); osc(61.7, 'sine', 0.22, lp, 4); osc(82.4, 'triangle', 0.08, lp, -5);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 1.4; bp.connect(out); noiseSrc(bp, 0.14); lfo(0.03, 260, bp.frequency);
    const sh = osc(1318.5, 'sine', 0.0, out); const tr = c.createGain(); tr.gain.value = 0.012; const tl = c.createOscillator(); tl.frequency.value = 0.11; tl.connect(tr).connect(sh.a.gain); tl.start(); nodes.push(tl);
  }
  let done = false;
  return () => { if (done) return; done = true; const t = c.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t); out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch {} }); out.disconnect(); }, 1400); };
}
