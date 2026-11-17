/* Hack ses kiti — her minioyunun kendi tınısı. Sentez + tek bir örnek (kahkaha). Sistem ses ayarına bağlı. */
import { sfxBus } from '../../lib/sfx';
type OT = OscillatorType;
function env(g: GainNode, t: number, a: number, peak: number, d: number) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
export function tone(f: number, d: number, type: OT = 'square', g = 0.2, slide = 0, delay = 0, a = 0.006) {
  const { c, out } = sfxBus(); const t = c.currentTime + delay; const o = c.createOscillator(), v = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
  env(v, t, a, g, d); o.connect(v).connect(out); o.start(t); o.stop(t + a + d + 0.05);
}
export function noise(d: number, g = 0.1, f = 2000, q = 0.8, type: BiquadFilterType = 'bandpass', delay = 0, sweep = 0) {
  const { c, out } = sfxBus(); const t = c.currentTime + delay;
  const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * d)), c.sampleRate), ch = b.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), fl = c.createBiquadFilter(), v = c.createGain();
  fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (sweep) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f + sweep), t + d);
  env(v, t, 0.004, g, d); s.buffer = b; s.connect(fl).connect(v).connect(out); s.start(t);
}
let laughBuf: AudioBuffer | null = null, laughLoading: Promise<void> | null = null;
export function preloadLaugh() {
  if (laughBuf || laughLoading) return laughLoading;
  const { c } = sfxBus();
  laughLoading = fetch(import.meta.env.BASE_URL + 'img/hack/laugh.mp3').then((r) => r.arrayBuffer()).then((a) => c.decodeAudioData(a)).then((b) => { laughBuf = b; }).catch(() => {});
  return laughLoading;
}
/** Bozuk mekanik kahkaha: örnek + gerçek zamanlı halka modülasyonu + alt oktav. Döndürdüğü fonksiyon sesi söndürür. */
export function laugh(gain = 1.0): () => void {
  const { c, out } = sfxBus(); const t = c.currentTime;
  const master = c.createGain(); master.gain.setValueAtTime(gain, t); master.connect(out);
  const nodes: AudioScheduledSourceNode[] = [];
  if (laughBuf) {
    const s = c.createBufferSource(); s.buffer = laughBuf;
    const ws = c.createWaveShaper(); const k = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; k[i] = Math.tanh(x * 2.4); } ws.curve = k;
    s.connect(ws).connect(master);
    // alt katman: aynı örnek yavaş (daha kalın, makine boğazı)
    const s2 = c.createBufferSource(); s2.buffer = laughBuf; s2.playbackRate.value = 0.82; const g2 = c.createGain(); g2.gain.value = 0.45;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; s2.connect(lp).connect(g2).connect(master);
    s.start(t); s2.start(t + 0.03); nodes.push(s, s2);
  } else {
    // örnek yüklenemediyse: sentezlenmiş "HA" darbeleri
    for (let i = 0; i < 9; i++) { tone(150 - i * 6, 0.16, 'sawtooth', 0.35, -40, i * 0.2); noise(0.12, 0.2, 900, 1.2, 'bandpass', i * 0.2); }
  }
  // elektrik vızıltısı + düşük gümbürtü
  const hum = c.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 55; const hg = c.createGain(); hg.gain.setValueAtTime(0.0001, t); hg.gain.exponentialRampToValueAtTime(0.07, t + 0.1); hg.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  hum.connect(hg).connect(master); hum.start(t); hum.stop(t + 2.8); nodes.push(hum);
  noise(0.35, 0.35, 160, 0.7, 'lowpass'); tone(48, 1.2, 'sine', 0.5, -18);
  return () => { const n = c.currentTime; master.gain.cancelScheduledValues(n); master.gain.setValueAtTime(master.gain.value, n); master.gain.exponentialRampToValueAtTime(0.0001, n + 0.6); setTimeout(() => { nodes.forEach((x) => { try { x.stop(); } catch { /* bitti */ } }); master.disconnect(); }, 700); };
}
/** Oyuna özel ses paletleri */
export const H = {
  // ortak
  tick: () => tone(2200, 0.018, 'square', 0.04),
  warn: () => { tone(880, 0.07, 'square', 0.08); tone(660, 0.07, 'square', 0.08, 0, 0.09); },
  boom: () => { noise(0.5, 0.35, 120, 0.6, 'lowpass'); tone(70, 0.5, 'sine', 0.4, -40); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, 0, i * 0.07)); noise(0.3, 0.05, 6000, 0.5, 'highpass', 0.2); },
  lose: () => { tone(220, 0.5, 'sawtooth', 0.18, -150); tone(110, 0.7, 'square', 0.12, -60, 0.1); noise(0.6, 0.15, 400, 0.5, 'lowpass', 0.05); },
  intro: () => { tone(90, 0.6, 'sawtooth', 0.12, 600, 0, 0.2); noise(0.6, 0.08, 300, 0.7, 'bandpass', 0, 4000); },
  start: () => { tone(1200, 0.05, 'square', 0.08); tone(1800, 0.08, 'square', 0.07, 0, 0.05); },
  // İhlal Protokolü: kuru dijital tıklar, CP77 tarzı vurgulu onay
  bpHover: () => tone(3200, 0.012, 'sine', 0.025),
  bpPick: () => { tone(1400, 0.035, 'square', 0.09); tone(2800, 0.03, 'sine', 0.05, 0, 0.012); },
  bpSeq: () => { tone(988, 0.08, 'triangle', 0.14); tone(1480, 0.12, 'triangle', 0.12, 0, 0.06); },
  bpBad: () => tone(160, 0.12, 'square', 0.12, -40),
  // Devre: elektrik çatırtısı, mekanik döndürme
  ciRot: () => { noise(0.04, 0.12, 2400, 2); tone(320, 0.04, 'square', 0.05, 80); },
  ciZap: () => { noise(0.15, 0.12, 5000, 3, 'bandpass', 0, -3000); tone(120, 0.18, 'sawtooth', 0.06, 60); },
  ciHum: () => tone(60, 0.4, 'sawtooth', 0.05, 0),
  // Kernel: mekanik klavye + derleyici bip
  kKey: () => { noise(0.012, 0.07, 3000 + Math.random() * 1500, 3); tone(140 + Math.random() * 30, 0.015, 'square', 0.03); },
  kErr: () => { tone(180, 0.09, 'sawtooth', 0.12); tone(150, 0.09, 'sawtooth', 0.1, 0, 0.09); },
  kLine: () => { tone(1320, 0.05, 'square', 0.08); tone(1760, 0.07, 'square', 0.06, 0, 0.05); },
  kBlock: () => { [660, 880, 1320].forEach((f, i) => tone(f, 0.08, 'square', 0.08, 0, i * 0.05)); noise(0.2, 0.06, 7000, 0.6, 'highpass'); },
  // memDEALLOCATER: bellek silme "tık", hata vızıltısı
  mOk: () => { tone(740, 0.04, 'square', 0.08, 300); noise(0.03, 0.05, 6000, 1, 'highpass'); },
  mBad: () => { tone(100, 0.16, 'sawtooth', 0.16); noise(0.12, 0.1, 300, 0.8, 'lowpass'); },
  // shiftSEQ: düğüm atlama, vuruş, şarj
  sMove: () => { tone(500, 0.05, 'triangle', 0.1, 400); },
  sHit: () => { noise(0.05, 0.14, 1800, 1.4); tone(240, 0.06, 'square', 0.1, -80); },
  sKill: () => { noise(0.35, 0.22, 800, 0.6, 'lowpass', 0, -600); tone(400, 0.3, 'sawtooth', 0.12, -320); },
  sCharge: () => { tone(300, 0.35, 'triangle', 0.14, 1400); tone(600, 0.35, 'sine', 0.08, 2000, 0.05); },
  sMiss: () => { tone(200, 0.2, 'square', 0.14, -120); },
  sDmg: () => { noise(0.2, 0.25, 200, 0.7, 'lowpass'); tone(90, 0.25, 'sawtooth', 0.18, -30); },
  sFire: () => tone(1900, 0.03, 'sine', 0.035, -900),
  // TOKENINE: cam/kristal
  tPick: () => { tone(1568, 0.12, 'sine', 0.1); tone(2349, 0.1, 'sine', 0.05, 0, 0.02); },
  tOk: () => { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.14, 'sine', 0.09, 0, i * 0.05)); },
  tBad: () => { tone(330, 0.2, 'triangle', 0.14, -160); tone(311, 0.2, 'triangle', 0.1, -150, 0.04); },
  // Veri tüneli
  tuHit: () => { noise(0.4, 0.35, 500, 0.6, 'lowpass', 0, -300); tone(60, 0.4, 'square', 0.18, -20); },
  tuPass: () => noise(0.18, 0.06, 1200, 0.7, 'bandpass', 0, 2400),
};
