/* CROWN CLASH çizim — Canvas 2D, dürüst 2D (sahte 3D yok). Arena YATAY çizilir: kendi tarafın solda, rakip sağda.
   Motor koordinatı (x: kanat 0–18, y: 0–32) → ekran: sx = (H−y) (taraf 0) / y (taraf 1), sy = x (taraf 0) / W−x (taraf 1).
   Sabit zemin katmanı (tema dokusu + nehir + köprüler + şeritler) bir kez çizilir; birimler/mermiler/parçacıklar her karede. */
import { CARD, evoTier } from './cards';
import { W, H, RIVER, BRIDGES, HZ, canDeploy, type State, type Fx, type Side, type Ent } from './engine';
import { THEMES, type Theme } from './themes';

const BASE = import.meta.env.BASE_URL + 'img/clash/';
export const IMG: Record<string, HTMLImageElement> = {};
const SPRITES = ['chrome', 'breacher', 'archer', 'goblin', 'drone', 'ogre', 'tabaxi', 'runner', 'turret', 'mech', 'bomber', 'scrap', 'enforcer', 'rider', 'exo', 'swarm', 'sharp', 'drake', 'medic', 'cryo', 'pylon', 'foundry', 'pump', 'king', 'king_r', 'crown', 'crown_r'];
export const EMOTES = ['laugh', 'cry', 'angry', 'taunt', 'thumb', 'wow', 'facepalm', 'think', 'sleep', 'gg', 'smug'] as const;
export type Emote = (typeof EMOTES)[number];
export const EMOTE_TR: Record<Emote, string> = { laugh: 'Kahkaha', cry: 'Ağla', angry: 'Öfke', taunt: 'Dil çıkar', thumb: 'Aferin', wow: 'Vay!', facepalm: 'Tüh', think: 'Hmm', sleep: 'Esneme', gg: 'GG', smug: 'Kendini beğen' };
const DARK: Record<string, HTMLCanvasElement> = {};
let loaded: Promise<void> | null = null;
function load(n: string) { return new Promise<void>((res) => { const i = new Image(); i.onload = () => res(); i.onerror = () => res(); i.src = BASE + n + '.webp'; IMG[n] = i; }); }
export function preload(): Promise<void> {
  if (loaded) return loaded;
  const names = [...SPRITES, ...EMOTES.map((e) => 'emo_' + e), ...THEMES.map((t) => t.ground)];
  loaded = Promise.all(names.map(load)).then(() => {
    for (const n of ['king', 'king_r', 'crown', 'crown_r']) { const i = IMG[n]!; const c = document.createElement('canvas'); c.width = i.naturalWidth || 1; c.height = i.naturalHeight || 1; const x = c.getContext('2d')!; x.drawImage(i, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(14,10,12,.8)'; x.fillRect(0, 0, c.width, c.height); DARK[n] = c; }
  });
  return loaded;
}
/** Sprite'ın doğal baktığı yön (+1 sağ, −1 sol). Yürüyüş yönüne göre aynalanır. */
const FACE: Record<string, number> = { goblin: -1, swarm: -1 };
/** Birim boyu (karo cinsinden, sprite yüksekliği) */
const sz = (id: string) => (SIZE[id] ?? 1.6) * 1.3;
const SIZE: Record<string, number> = { scrap: 1.0, goblin: 1.15, swarm: 0.9, drone: 1.05, archer: 1.55, runner: 1.6, sharp: 1.6, medic: 1.6, chrome: 1.75, tabaxi: 1.6, enforcer: 1.8, rider: 1.7, cryo: 1.75, drake: 2.1, bomber: 2.2, breacher: 2.0, ogre: 2.5, exo: 2.6, mech: 2.7, turret: 2.3, pylon: 2.9, foundry: 2.4, pump: 2.4 };
type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; c: string; s: number; k: 'spark' | 'dust' | 'ring' | 'beam' | 'bolt' | 'text' | 'debris' | 'flash' | 'smoke' | 'shard'; r?: number; t?: string; pts?: number[]; add?: boolean };
const ME = '#29d3ff', FOE = '#ff3355';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
export class Renderer {
  c: HTMLCanvasElement; x: CanvasRenderingContext2D; me: Side; th: Theme;
  ts = 20; ox = 0; oy = 0; dpr = 1; cw = 0; ch = 0; bg: HTMLCanvasElement | null = null;
  parts: P[] = []; amb: P[] = []; shake = 0; t = 0; flashA = 0; flashC = '#fff';
  disp = new Map<number, { x: number; y: number; hp: number; flash: number; mv: number; face: number; bob: number; sh: number }>();
  emo: { side: Side; e: Emote; t: number }[] = [];
  constructor(c: HTMLCanvasElement, me: Side, theme: Theme = THEMES[0]!) { this.c = c; this.x = c.getContext('2d')!; this.me = me; this.th = theme; }
  resize(w: number, h: number) {
    this.dpr = Math.min(2, devicePixelRatio || 1); this.cw = w; this.ch = h;
    this.c.width = Math.round(w * this.dpr); this.c.height = Math.round(h * this.dpr); this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
    // yatay: H (32) ekran genişliği, W (18) ekran yüksekliği. Üstte kule boyları için ~1.6 karo pay.
    this.ts = Math.min(w / (H + 0.6), h / (W + 1.9)); this.ox = (w - this.ts * H) / 2; this.oy = (h - this.ts * W) / 2 + this.ts * 0.75; this.bg = null;
  }
  sx(x: number, y: number) { return this.ox + (this.me === 0 ? H - y : y) * this.ts; }
  sy(x: number, _y?: number) { return this.oy + (this.me === 0 ? x : W - x) * this.ts; }
  P(x: number, y: number) { return { X: this.sx(x, y), Y: this.sy(x, y) }; }
  world(px: number, py: number) { const a = (px - this.ox) / this.ts, b = (py - this.oy) / this.ts; return this.me === 0 ? { x: b, y: H - a } : { x: W - b, y: a }; }
  /** dünya yönünü ekran yönüne çevir */
  dir(dx: number, dy: number) { return this.me === 0 ? { X: -dy, Y: dx } : { X: dy, Y: -dx }; }
  emote(side: Side, e: Emote) { this.emo = this.emo.filter((m) => m.side !== side); this.emo.push({ side, e, t: 0 }); }

  private drawBg() {
    const ts = this.ts, cw = this.cw, ch = this.ch, th = this.th;
    const b = document.createElement('canvas'); b.width = Math.round(cw * this.dpr); b.height = Math.round(ch * this.dpr); const g = b.getContext('2d')!; g.scale(this.dpr, this.dpr);
    const AX = this.ox, AY = this.oy, AW = H * ts, AH = W * ts;
    // çevre: aynı doku, karartılmış ve bulanık
    const gi = IMG[th.ground];
    g.fillStyle = '#05070c'; g.fillRect(0, 0, cw, ch);
    if (gi?.naturalWidth) {
      g.save(); g.filter = 'blur(6px) brightness(.35) saturate(.8)'; const sc = Math.max(cw / gi.naturalWidth, ch / gi.naturalHeight) * 1.05; g.drawImage(gi, (cw - gi.naturalWidth * sc) / 2, (ch - gi.naturalHeight * sc) / 2, gi.naturalWidth * sc, gi.naturalHeight * sc); g.restore();
    }
    // arena tabanı
    g.save(); g.beginPath(); g.roundRect(AX, AY, AW, AH, ts * 0.6); g.clip();
    if (gi?.naturalWidth) { const sc = Math.max(AW / gi.naturalWidth, AH / gi.naturalHeight); g.drawImage(gi, AX + (AW - gi.naturalWidth * sc) / 2, AY + (AH - gi.naturalHeight * sc) / 2, gi.naturalWidth * sc, gi.naturalHeight * sc); }
    g.fillStyle = th.shade; g.fillRect(AX, AY, AW, AH);
    // taraf tonları (sol ben, sağ rakip)
    let gr = g.createLinearGradient(AX, 0, AX + AW, 0); gr.addColorStop(0, th.tint[0]); gr.addColorStop(0.46, 'rgba(0,0,0,0)'); gr.addColorStop(0.54, 'rgba(0,0,0,0)'); gr.addColorStop(1, th.tint[1]); g.fillStyle = gr; g.fillRect(AX, AY, AW, AH);
    // yerleştirme ızgarası (ince)
    g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
    for (let i = 1; i < H; i++) { const X = AX + i * ts; g.beginPath(); g.moveTo(X, AY); g.lineTo(X, AY + AH); g.stroke(); }
    for (let i = 1; i < W; i++) { const Y = AY + i * ts; g.beginPath(); g.moveTo(AX, Y); g.lineTo(AX + AW, Y); g.stroke(); }
    // kanat yolları: kule → köprü → kule
    for (const bx of BRIDGES) {
      const Y = this.sy(bx); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = ts * 1.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(this.sx(bx, 29), Y); g.lineTo(this.sx(bx, 3), Y); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = ts * 1.3; g.setLineDash([ts * 0.5, ts * 0.5]); g.beginPath(); g.moveTo(this.sx(bx, 28), Y); g.lineTo(this.sx(bx, 4), Y); g.stroke(); g.setLineDash([]);
    }
    // kral yolu
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = ts * 2.2; g.beginPath(); g.moveTo(this.sx(9, 29), this.sy(3.5)); g.lineTo(this.sx(9, 29), this.sy(14.5)); g.stroke(); g.beginPath(); g.moveTo(this.sx(9, 3), this.sy(3.5)); g.lineTo(this.sx(9, 3), this.sy(14.5)); g.stroke();
    // nehir (dikey bant ortada)
    const RX = this.sx(0, RIVER), rw = ts * 1.9;
    gr = g.createLinearGradient(RX - rw / 2, 0, RX + rw / 2, 0); gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.15, th.river[0]); gr.addColorStop(0.5, th.river[0]); gr.addColorStop(0.85, th.river[0]); gr.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = gr; g.fillRect(RX - rw / 2, AY, rw, AH);
    g.strokeStyle = th.river[1]; g.globalAlpha = 0.55; g.lineWidth = 2; g.shadowColor = th.river[1]; g.shadowBlur = 14;
    g.beginPath(); g.moveTo(RX - rw / 2, AY); g.lineTo(RX - rw / 2, AY + AH); g.moveTo(RX + rw / 2, AY); g.lineTo(RX + rw / 2, AY + AH); g.stroke(); g.globalAlpha = 1; g.shadowBlur = 0;
    // köprüler
    for (const bx of BRIDGES) this.bridge(g, RX, this.sy(bx), rw);
    // kenar gölgesi
    const vg = g.createRadialGradient(AX + AW / 2, AY + AH / 2, AH * 0.35, AX + AW / 2, AY + AH / 2, AW * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = vg; g.fillRect(AX, AY, AW, AH);
    g.restore();
    // çerçeve
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.beginPath(); g.roundRect(AX, AY, AW, AH, ts * 0.6); g.stroke();
    g.strokeStyle = th.accent; g.globalAlpha = 0.35; g.lineWidth = 1; g.beginPath(); g.roundRect(AX - 5, AY - 5, AW + 10, AH + 10, ts * 0.8); g.stroke(); g.globalAlpha = 1;
    this.bg = b;
  }
  private bridge(g: CanvasRenderingContext2D, X: number, Y: number, rw: number) {
    const ts = this.ts, bw = rw + ts * 1.4, bh = ts * 2.1, st = this.th.bridge;
    const col = st === 'rust' ? ['#3b2a1e', '#6b4a2e'] : st === 'stone' ? ['#2b2622', '#4a403a'] : st === 'glass' ? ['rgba(160,220,255,.18)', 'rgba(200,240,255,.45)'] : st === 'obsidian' ? ['#120c1c', '#3a2a50'] : ['#1d2632', '#3e4e60'];
    g.save(); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 16; g.shadowOffsetY = 6;
    g.fillStyle = col[0]!; g.beginPath(); g.roundRect(X - bw / 2, Y - bh / 2, bw, bh, 6); g.fill(); g.restore();
    // kalaslar
    g.strokeStyle = col[1]!; g.lineWidth = 2;
    for (let i = 0; i <= 6; i++) { const xx = X - bw / 2 + 4 + i * ((bw - 8) / 6); g.beginPath(); g.moveTo(xx, Y - bh / 2 + 4); g.lineTo(xx, Y + bh / 2 - 4); g.stroke(); }
    // korkuluk
    g.strokeStyle = this.th.accent; g.globalAlpha = 0.6; g.lineWidth = 2.5; g.beginPath(); g.moveTo(X - bw / 2, Y - bh / 2 + 2); g.lineTo(X + bw / 2, Y - bh / 2 + 2); g.moveTo(X - bw / 2, Y + bh / 2 - 2); g.lineTo(X + bw / 2, Y + bh / 2 - 2); g.stroke(); g.globalAlpha = 1;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { g.fillStyle = '#0a0d12'; g.beginPath(); g.arc(X + (sx * bw) / 2, Y + (sy * bh) / 2, 4, 0, 7); g.fill(); g.fillStyle = this.th.accent; g.beginPath(); g.arc(X + (sx * bw) / 2, Y + (sy * bh) / 2, 1.8, 0, 7); g.fill(); }
  }
  feed(fx: Fx[]) {
    const ts = this.ts;
    for (const f of fx) {
      const { X, Y } = this.P(f.x, f.y); const own = f.side === this.me; const tc = own ? ME : FOE;
      switch (f.k) {
        case 'deploy': { this.ring(X, Y, ts * 1.4, tc, 0.45); this.burst(X, Y, 10, tc, 2.2, 'dust'); const d = this.disp; void d; break; }
        case 'cast': { const c = CARD[f.card ?? '']; if (c?.radius) this.ring(X, Y, c.radius * ts, tc, (c.delay ?? 0.3) + 0.2, 'beam'); break; }
        case 'hit': { const d = this.disp.get(f.id ?? -1); if (d) d.flash = 0.12; if ((f.v ?? 0) >= 150) this.text(X, Y - ts, String(Math.round(f.v!)), '#fff'); break; }
        case 'shbreak': this.burst(X, Y, 18, '#9fe8ff', 5, 'shard'); this.ring(X, Y, ts * 1.2, '#9fe8ff', 0.3); break;
        case 'die': this.burst(X, Y, 14, '#ffb86b', 4, 'spark'); this.burst(X, Y, 8, '#555', 1.5, 'smoke'); break;
        case 'tdie': this.burst(X, Y, 60, '#ffd27a', 9, 'debris'); this.burst(X, Y, 30, '#666', 3, 'smoke'); this.ring(X, Y, ts * 4, '#ffcf6b', 0.7); this.shake = 16; this.flash('#ffcf6b', 0.35); break;
        case 'crown': this.text(X, Y - ts * 2.5, '♛', '#fcee0a', 2.2, 1.6); break;
        case 'boom': this.ring(X, Y, (f.v ?? 1) * ts, '#ff9b40', 0.35); this.burst(X, Y, 14, '#ff9b40', 4, 'spark'); this.shake = Math.max(this.shake, 3); break;
        case 'healwave': case 'healpulse': this.ring(X, Y, (f.v ?? 3) * ts, '#3ff0c0', 0.5); this.burst(X, Y, 6, '#3ff0c0', 1.5, 'spark'); break;
        case 'deathspawn': this.ring(X, Y, ts, '#fcee0a', 0.35); break;
        case 'frostnova': case 'freeze': this.ring(X, Y, (f.v ?? 3) * ts, '#bff4ff', 0.6); this.burst(X, Y, 40, '#dff8ff', 5, 'shard'); this.flash('#bff4ff', 0.18); break;
        case 'shatter': this.burst(X, Y, 50, '#dff8ff', 7, 'shard'); this.ring(X, Y, (f.v ?? 3) * ts, '#ffffff', 0.4); break;
        case 'roll': this.burst(X, Y, 10, '#ffb347', 3, 'dust'); break;
        case 'oc': this.ring(X, Y, (f.v ?? 4) * ts, '#ff3df2', 0.6); this.burst(X, Y, 24, '#ff3df2', 4, 'spark'); break;
        case 'podzone': this.ring(X, Y, (f.v ?? 2.5) * ts, '#ffd166', 0.5); break;
        case 'pod': { this.parts.push({ x: X, y: Y, z: ts * 7, vx: 0, vy: 0, vz: -ts * 30, life: 0.24, max: 0.24, c: '#ffb347', s: 4, k: 'bolt' }); setTimeout(() => { this.burst(X, Y, 10, '#ffb347', 3, 'spark'); this.ring(X, Y, ts * 0.9, '#ffd166', 0.25); }, 230); break; }
        case 'emp': this.ring(X, Y, (f.v ?? 2.5) * ts, '#9fe8ff', 0.45); for (let i = 0; i < 10; i++) this.zap(X, Y, (f.v ?? 2.5) * ts); this.flash('#9fe8ff', 0.2); break;
        case 'nova': this.ring(X, Y, (f.v ?? 2) * ts * 1.3, '#ffcf6b', 0.7); this.burst(X, Y, 50, '#ffcf6b', 9, 'debris'); this.burst(X, Y, 20, '#555', 3, 'smoke'); this.shake = 20; this.flash('#fff1c2', 0.45); break;
        case 'strike': this.parts.push({ x: X, y: Y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.35, max: 0.35, c: '#bff4ff', s: (f.v ?? 2.5) * ts, k: 'beam' }); this.ring(X, Y, (f.v ?? 2.5) * ts, '#9fe8ff', 0.5); this.burst(X, Y, 30, '#9fe8ff', 6, 'spark'); this.shake = 10; this.flash('#bff4ff', 0.3); break;
        case 'chargehit': this.ring(X, Y, ts * 1.4, '#ff9b2f', 0.3); this.burst(X, Y, 16, '#ffcf6b', 5, 'spark'); this.shake = Math.max(this.shake, 5); break;
        case 'crit': this.text(X, Y - ts * 1.4, 'KRİTİK', '#fcee0a', 1.1); this.burst(X, Y, 10, '#fcee0a', 4, 'spark'); break;
        case 'melee': { this.burst(X, Y, 4, '#fff2c0', 3, 'spark'); const d = this.disp.get(f.id ?? -1); if (d) d.mv = 0.1; break; }
        case 'beam': { const a = this.P(f.x2!, f.y2!); this.parts.push({ x: a.X, y: a.Y - ts * 1.6, z: 0, vx: X, vy: Y, vz: f.v ?? 0, life: 0.09, max: 0.09, c: ['#ff9b40', '#ff5a1a', '#ffffff'][f.v ?? 0]!, s: 2 + (f.v ?? 0) * 2.5, k: 'beam' }); break; }
        case 'arc': { const pts: number[] = []; const p = f.pts ?? []; for (let i = 0; i < p.length; i += 2) { const q = this.P(p[i]!, p[i + 1]!); pts.push(q.X, q.Y - (i === 0 ? ts * 1.2 : ts * 0.5)); } this.parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0.16, max: 0.16, c: f.card === 'king' || f.card === 'crown' ? tc : '#7fd8ff', s: 2, k: 'bolt', pts }); break; }
        case 'shot': { const d = this.disp.get(f.id ?? -1); if (d) d.mv = 0.08; break; }
        case 'spawn': case 'pump': this.ring(X, Y, ts, f.k === 'pump' ? '#ff3df2' : '#ffb347', 0.4); if (f.k === 'pump' && own) this.text(X, Y - ts * 2.4, '+1 ⚡', '#ff7ff5', 1.1); break;
        case 'charge': this.burst(X, Y, 8, '#ff9b2f', 2, 'dust'); break;
        case 'ot': this.flash('#ff3355', 0.25); break;
      }
    }
  }
  flash(c: string, a: number) { this.flashC = c; this.flashA = Math.max(this.flashA, a); }
  private ring(x: number, y: number, r: number, c: string, life: number, k: P['k'] = 'ring') { this.parts.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life, max: life, c, s: r, k: k === 'beam' ? 'ring' : 'ring', r: k === 'beam' ? 1 : 0 }); }
  private text(x: number, y: number, t: string, c: string, s = 1, life = 0.8) { this.parts.push({ x, y, z: 0, vx: 0, vy: -30, vz: 0, life, max: life, c, s, k: 'text', t }); }
  private zap(x: number, y: number, r: number) { const pts = [x, y]; let a = Math.random() * 6.28, cx = x, cy = y; for (let i = 0; i < 4; i++) { cx += Math.cos(a) * r / 4; cy += Math.sin(a) * r / 4; a += (Math.random() - 0.5) * 1.2; pts.push(cx, cy); } this.parts.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.2, max: 0.2, c: '#bff4ff', s: 1.5, k: 'bolt', pts }); }
  private burst(x: number, y: number, n: number, c: string, sp: number, k: P['k']) {
    const ts = this.ts;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = (0.3 + Math.random()) * sp * ts;
      const life = k === 'smoke' ? 0.9 + Math.random() * 0.6 : k === 'debris' ? 0.9 : 0.35 + Math.random() * 0.35;
      this.parts.push({ x, y, z: k === 'smoke' ? ts * 0.5 : 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, vz: k === 'debris' || k === 'shard' ? (2 + Math.random() * 4) * ts : k === 'smoke' ? ts * 0.8 : Math.random() * ts * 2, life, max: life, c, s: k === 'smoke' ? ts * (0.4 + Math.random() * 0.5) : k === 'debris' ? 2 + Math.random() * 4 : 1.5 + Math.random() * 2, k, add: k === 'spark' || k === 'shard' });
    }
  }
  private ambient(dt: number) {
    const k = this.th.particles, ts = this.ts, AX = this.ox, AY = this.oy, AW = H * ts, AH = W * ts;
    const want = k === 'rain' ? 70 : k === 'stars' ? 40 : 30;
    while (this.amb.length < want) this.amb.push({ x: AX + Math.random() * AW, y: AY + Math.random() * AH, z: 0, vx: 0, vy: 0, vz: 0, life: Math.random() * 3, max: 3, c: '', s: Math.random(), k: 'spark' });
    const x = this.x;
    for (const p of this.amb) {
      p.life -= dt;
      if (k === 'rain') { p.x -= 60 * dt; p.y += 520 * dt; if (p.y > AY + AH) { p.y = AY - 10; p.x = AX + Math.random() * AW; } x.strokeStyle = 'rgba(170,210,255,.16)'; x.lineWidth = 1; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x + 3, p.y - 12); x.stroke(); }
      else { if (k === 'embers' || k === 'ash') { p.y -= (k === 'embers' ? 30 : 12) * dt; p.x += Math.sin(this.t + p.s * 9) * 10 * dt; } if (p.life <= 0 || p.y < AY) { p.life = 3; p.x = AX + Math.random() * AW; p.y = AY + Math.random() * AH; }
        const a = Math.sin((p.life / 3) * Math.PI); x.fillStyle = k === 'embers' ? `rgba(255,140,40,${0.7 * a})` : k === 'ash' ? `rgba(200,190,180,${0.3 * a})` : k === 'stars' ? `rgba(200,230,255,${0.5 * a})` : `rgba(190,120,255,${0.5 * a})`;
        x.beginPath(); x.arc(p.x, p.y, k === 'embers' ? 1.6 : 1.2 + p.s, 0, 7); x.fill(); }
    }
  }
  draw(s: State, dt: number, drag: { card: string; x: number; y: number; ok: boolean } | null) {
    const x = this.x, ts = this.ts; this.t += dt;
    if (!this.bg) this.drawBg();
    x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0, sh2 = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0; this.shake = Math.max(0, this.shake - dt * 40);
    x.clearRect(0, 0, this.cw, this.ch); x.save(); x.translate(sh, sh2);
    x.drawImage(this.bg!, 0, 0, this.cw, this.ch);
    // nehir akışı
    const RX = this.sx(0, RIVER), rw = ts * 1.9; x.save(); x.beginPath(); x.rect(RX - rw / 2, this.oy, rw, W * ts); x.clip(); x.strokeStyle = this.th.river[2]; x.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { const yy = this.oy + ((i * 53 + this.t * 40) % (W * ts)); const xx = RX - rw / 2 + ((i * 37) % rw); x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + 2, yy + ts * 0.8); x.stroke(); }
    x.restore();
    for (const bx of BRIDGES) { const Y = this.sy(bx); x.fillStyle = 'rgba(0,0,0,0)'; void Y; }
    // yerleştirme bölgesi (sürüklerken)
    if (drag) this.zones(s, drag);
    // alanlar ve bekleyen büyüler
    for (const z of s.zones) { const { X, Y } = this.P(z.x, z.y); const c = z.k === 'oc' ? '#ff3df2' : '#ffd166'; x.save(); x.globalAlpha = 0.18 + Math.sin(this.t * 6) * 0.05; x.fillStyle = c; x.beginPath(); x.ellipse(X, Y, z.r * ts, z.r * ts * 0.92, 0, 0, 7); x.fill(); x.globalAlpha = 0.8; x.strokeStyle = c; x.lineWidth = 2; x.setLineDash([8, 6]); x.lineDashOffset = -this.t * 30; x.stroke(); x.restore(); }
    for (const p of s.pend) { if (p.k) continue; const c = CARD[p.card]; if (!c?.radius) continue; const { X, Y } = this.P(p.x, p.y); const left = Math.max(0, (p.at - s.tick) / HZ); x.save(); x.strokeStyle = p.side === this.me ? ME : FOE; x.lineWidth = 2; x.globalAlpha = 0.85; x.beginPath(); x.arc(X, Y, c.radius * ts, 0, 7); x.stroke(); x.globalAlpha = 0.25; x.fillStyle = x.strokeStyle; x.beginPath(); x.moveTo(X, Y); x.arc(X, Y, c.radius * ts, -Math.PI / 2, -Math.PI / 2 + 6.283 * (1 - left / Math.max(0.05, c.delay ?? 0.5))); x.fill(); x.restore();
      if (p.card === 'nova' || p.card === 'plasma') { const k = 1 - left / Math.max(0.05, c.delay ?? 1); x.save(); x.globalAlpha = 0.9; x.fillStyle = p.card === 'nova' ? '#ffcf6b' : '#bff4ff'; x.shadowColor = x.fillStyle; x.shadowBlur = 20; x.beginPath(); x.arc(X, Y - (1 - k) * ts * 9, ts * (p.card === 'nova' ? 0.35 : 0.2), 0, 7); x.fill(); if (p.card === 'plasma') { x.globalAlpha = 0.3 * k; x.fillRect(X - 2, this.oy - 20, 4, Y - this.oy + 20); } x.restore(); } }
    // yuvarlananlar
    for (const r of s.rolls) { const { X, Y } = this.P(r.x, r.y); const d = this.dir(0, r.dir); const len = r.w * ts; x.save(); x.translate(X, Y); x.rotate(Math.atan2(d.Y, d.X) + Math.PI / 2); const gr = x.createLinearGradient(-len / 2, 0, len / 2, 0); gr.addColorStop(0, '#2a2a2a'); gr.addColorStop(0.5, '#8a8a8a'); gr.addColorStop(1, '#2a2a2a'); x.fillStyle = gr; x.shadowColor = '#ffb347'; x.shadowBlur = 16; x.fillRect(-len / 2, -ts * 0.45, len, ts * 0.9); x.fillStyle = '#ffb347'; for (let i = -2; i <= 2; i++) x.fillRect(i * len / 5 - 2, -ts * 0.45, 4, ts * 0.9); x.restore(); }
    // varlıklar (derinlik: ekran y)
    const ents = s.ents.filter((e) => e.hp > 0 || e.kind === 'tower').slice().sort((a, b) => (a.fly ? 1 : 0) - (b.fly ? 1 : 0) || this.sy(a.x) - this.sy(b.x));
    const seen = new Set<number>();
    for (const e of ents) { seen.add(e.id); this.ent(e, dt, s); }
    for (const id of [...this.disp.keys()]) if (!seen.has(id)) this.disp.delete(id);
    // mermiler
    for (const p of s.proj) this.proj(p.kind, p.side, p.x, p.y, p.sx, p.sy, p.tx, p.ty, p.t / p.T, p.vis);
    // parçacıklar
    this.ambient(dt); this.particles(dt);
    // emojiler
    this.emotes(s, dt);
    // sürükleme hayaleti
    if (drag) this.ghost(drag);
    x.restore();
    if (this.flashA > 0.01) { x.fillStyle = this.flashC; x.globalAlpha = this.flashA; x.fillRect(0, 0, this.cw, this.ch); x.globalAlpha = 1; this.flashA *= Math.pow(0.02, dt); }
  }
  private zones(s: State, d: { card: string; ok: boolean }) {
    const x = this.x, ts = this.ts, c = CARD[d.card]; if (!c || c.kind === 'spell') return;
    x.save(); x.fillStyle = 'rgba(255,40,70,.16)';
    for (let gx = 0; gx < W; gx++) for (let gy = 0; gy < H; gy++) if (!canDeploy(s, this.me, d.card, gx + 0.5, gy + 0.5)) { const { X, Y } = this.P(gx + 0.5, gy + 0.5); x.fillRect(X - ts / 2, Y - ts / 2, ts, ts); }
    x.restore();
  }
  private ghost(d: { card: string; x: number; y: number; ok: boolean }) {
    const x = this.x, ts = this.ts, c = CARD[d.card]; if (!c) return; const { X, Y } = this.P(Math.round(d.x * 2) / 2, Math.round(d.y * 2) / 2);
    x.save(); x.globalAlpha = 0.9; x.strokeStyle = d.ok ? '#fff' : '#ff3355'; x.lineWidth = 2; x.setLineDash([6, 5]);
    const r = c.radius ?? (c.range && c.kind !== 'spell' ? 0 : 0); if (r) { x.beginPath(); x.arc(X, Y, r * ts, 0, 7); x.stroke(); }
    if (c.kind !== 'spell' && c.range && c.range > 2) { x.globalAlpha = 0.35; x.beginPath(); x.arc(X, Y, c.range * ts, 0, 7); x.stroke(); }
    x.setLineDash([]); x.globalAlpha = 0.55; const img = IMG[c.sprite ?? c.id];
    if (img?.naturalWidth) { const h = ts * sz(c.id); const w = (h * img.naturalWidth) / img.naturalHeight; x.drawImage(img, X - w / 2, Y - h * 0.85, w, h); }
    else { x.fillStyle = d.ok ? '#fff' : '#ff3355'; x.beginPath(); x.arc(X, Y, ts * 0.4, 0, 7); x.fill(); }
    x.restore();
  }
  private ent(e: Ent, dt: number, s: State) {
    const ts = this.ts, x = this.x; let d = this.disp.get(e.id);
    const tX = this.sx(e.x, e.y), tY = this.sy(e.x);
    if (!d) { d = { x: tX, y: tY, hp: e.hp, flash: 0, mv: 0, face: e.side === this.me ? 1 : -1, bob: Math.random() * 6, sh: e.sh }; this.disp.set(e.id, d); }
    const k = 1 - Math.pow(0.0005, dt); const vx = tX - d.x; d.x += (tX - d.x) * k; d.y += (tY - d.y) * k;
    if (Math.abs(vx) > 0.3) d.face = vx > 0 ? 1 : -1; d.flash = Math.max(0, d.flash - dt); d.mv = Math.max(0, d.mv - dt);
    if (e.kind === 'tower') return this.tower(e, d, s);
    const c = CARD[e.card]!; const mine = e.side === this.me; const img = IMG[c.sprite ?? c.id]; const tier = evoTier(e.lv);
    const hgt = ts * sz(e.card) * (e.dep > 0 ? 1 - e.dep / HZ * 0.3 : 1);
    const lift = e.fly ? ts * 1.1 + Math.sin(this.t * 3 + d.bob) * ts * 0.12 : 0;
    const walk = e.kind === 'troop' && !e.fly ? Math.abs(Math.sin(this.t * 9 + d.bob)) * ts * 0.06 : 0;
    // gölge + takım halkası
    x.save(); x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(d.x, d.y + ts * 0.1, ts * (e.kind === 'building' ? 1.0 : 0.55) * sz(e.card) / 1.6, ts * 0.22 * sz(e.card) / 1.6, 0, 0, 7); x.fill();
    x.strokeStyle = mine ? ME : FOE; x.lineWidth = 2; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(d.x, d.y + ts * 0.1, ts * 0.5 * sz(e.card) / 1.6 + 2, ts * 0.2 * sz(e.card) / 1.6 + 1, 0, 0, 7); x.stroke();
    if (tier > 0) { x.globalAlpha = 0.5 + Math.sin(this.t * 4) * 0.2; x.strokeStyle = tier === 2 ? '#ffcf3f' : '#c77dff'; x.lineWidth = tier === 2 ? 3 : 2; x.beginPath(); x.ellipse(d.x, d.y + ts * 0.1, ts * 0.65 * sz(e.card) / 1.6 + 4, ts * 0.26 * sz(e.card) / 1.6 + 2, 0, 0, 7); x.stroke(); }
    x.restore();
    const top = d.y - lift - walk - hgt * 0.92;
    if (img?.naturalWidth) {
      const w = (hgt * img.naturalWidth) / img.naturalHeight; const flip = d.face * (FACE[e.card] ?? 1) < 0;
      x.save(); x.translate(d.x, 0); if (flip) x.scale(-1, 1);
      const lunge = d.mv > 0 ? ts * 0.18 * (flip ? -1 : 1) * (d.mv / 0.1) : 0;
      if (tier > 0) { x.shadowColor = tier === 2 ? '#ffcf3f' : '#c77dff'; x.shadowBlur = tier === 2 ? 22 : 14; }
      if (e.frz > 0) x.filter = 'saturate(.2) brightness(1.3) hue-rotate(160deg)';
      else if (e.stun > 0) x.filter = 'brightness(.75)';
      x.drawImage(img, -w / 2 + lunge * (flip ? -1 : 1), top, w, hgt); x.filter = 'none'; x.shadowBlur = 0;
      if (d.flash > 0) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = (d.flash / 0.12) * 0.55; x.drawImage(img, -w / 2, top, w, hgt); }
      x.restore();
    } else { x.fillStyle = c.color; x.beginPath(); x.arc(d.x, d.y - ts * 0.5 - lift, ts * 0.4, 0, 7); x.fill(); }
    // durum efektleri
    if (e.buf > 0) { x.save(); x.strokeStyle = '#ff3df2'; x.globalAlpha = 0.6; x.lineWidth = 2; x.beginPath(); x.ellipse(d.x, top + hgt * 0.5, hgt * 0.35, hgt * 0.5, 0, 0, 7); x.stroke(); x.restore(); }
    if (e.stun > 0 && e.frz <= 0) { x.save(); x.fillStyle = '#fcee0a'; for (let i = 0; i < 3; i++) { const a = this.t * 6 + i * 2.1; x.beginPath(); x.arc(d.x + Math.cos(a) * ts * 0.35, top - 4 + Math.sin(a) * 3, 2.5, 0, 7); x.fill(); } x.restore(); }
    if (e.slow > 0) { x.save(); x.fillStyle = 'rgba(160,230,255,.35)'; x.beginPath(); x.ellipse(d.x, d.y, ts * 0.6, ts * 0.22, 0, 0, 7); x.fill(); x.restore(); }
    if (tier === 2 && Math.random() < dt * 8) this.parts.push({ x: d.x + (Math.random() - 0.5) * ts, y: d.y - Math.random() * hgt, z: 0, vx: 0, vy: -20, vz: 0, life: 0.6, max: 0.6, c: '#ffcf3f', s: 1.5, k: 'spark', add: true });
    // can / kalkan çubuğu (hasar almışsa veya kalkanlıysa)
    if (e.hp < e.max || e.shMax > 0 || e.kind === 'building') {
      const bw = Math.max(ts * 0.9, hgt * 0.5), by = top - 7 - (e.fly ? 0 : 0);
      x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(d.x - bw / 2 - 1, by - 1, bw + 2, 5); x.fillStyle = mine ? ME : FOE; x.fillRect(d.x - bw / 2, by, bw * Math.max(0, e.hp / e.max), 3);
      if (e.shMax > 0 && e.sh > 0) { x.fillStyle = '#e8f4ff'; x.fillRect(d.x - bw / 2, by - 4, bw * (e.sh / e.shMax), 2.5); }
      if (e.kind === 'building' && e.life > 0) { x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(d.x - bw / 2, by + 4, bw * (e.life / ((CARD[e.card]!.life ?? 30) * HZ)), 1.5); }
      x.font = `700 ${Math.max(8, ts * 0.26)}px ${MONO}`; x.textAlign = 'right'; x.fillStyle = tier === 2 ? '#ffcf3f' : tier === 1 ? '#d6a8ff' : '#cfe3ee'; x.fillText(String(e.lv), d.x - bw / 2 - 3, by + 4);
    }
  }
  private tower(e: Ent, d: { x: number; y: number; flash: number }, s: State) {
    const x = this.x, ts = this.ts, mine = e.side === this.me, key = (e.king ? 'king' : 'crown') + (mine ? '' : '_r');
    const img = e.hp > 0 ? IMG[key] : DARK[key]; const hgt = ts * (e.king ? 4.4 : 3.5);
    const cx = d.x, cy = d.y + ts * (e.king ? 1.2 : 0.9);
    const w0 = img instanceof HTMLImageElement ? img.naturalWidth : img?.width, h0 = img instanceof HTMLImageElement ? img.naturalHeight : img?.height;
    // taban plakası
    x.save(); x.fillStyle = 'rgba(0,0,0,.5)'; x.beginPath(); x.ellipse(cx, cy - ts * 0.1, ts * (e.king ? 2.0 : 1.6), ts * 0.6, 0, 0, 7); x.fill();
    if (e.hp > 0) { x.strokeStyle = mine ? ME : FOE; x.globalAlpha = 0.7; x.lineWidth = 3; x.shadowColor = x.strokeStyle; x.shadowBlur = 14; x.beginPath(); x.ellipse(cx, cy - ts * 0.1, ts * (e.king ? 2.0 : 1.6), ts * 0.6, 0, 0, 7); x.stroke(); }
    x.restore();
    if (!img || !w0) return;
    const iw = (hgt * w0) / h0!;
    if (e.hp <= 0) { x.save(); x.globalAlpha = 0.9; x.drawImage(img, cx - iw / 2, cy - hgt * 0.45, iw, hgt * 0.45); x.restore(); return; }
    x.save(); const asleep = e.king && !e.active;
    if (asleep) x.globalAlpha = 0.85;
    x.shadowColor = mine ? ME : FOE; x.shadowBlur = asleep ? 6 : 16 + Math.sin(this.t * 3) * 5;
    if (e.frz > 0) x.filter = 'saturate(.2) brightness(1.3) hue-rotate(160deg)';
    x.drawImage(img, cx - iw / 2, cy - hgt, iw, hgt); x.shadowBlur = 0; x.filter = 'none';
    if (d.flash > 0) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = (d.flash / 0.12) * 0.45; x.drawImage(img, cx - iw / 2, cy - hgt, iw, hgt); }
    x.restore();
    // bayrak şeridi: takım rengi
    x.save(); x.fillStyle = mine ? ME : FOE; x.globalAlpha = 0.9; x.fillRect(cx - iw * 0.22, cy - hgt * 0.42, iw * 0.44, 3); x.restore();
    const bw = ts * (e.king ? 2.8 : 2.2), by = cy - hgt - 10;
    x.fillStyle = 'rgba(0,0,0,.8)'; x.beginPath(); x.roundRect(cx - bw / 2 - 2, by - 2, bw + 4, 10, 3); x.fill(); x.fillStyle = mine ? '#29d3ff' : '#ff3355'; x.fillRect(cx - bw / 2, by, bw * (e.hp / e.max), 6);
    x.font = `700 ${Math.max(10, ts * 0.38)}px ${MONO}`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.85)'; x.lineWidth = 3; const tx = String(Math.ceil(e.hp)); x.strokeText(tx, cx, by - 4); x.fillText(tx, cx, by - 4);
    if (e.king) { x.font = `${Math.max(12, ts * 0.5)}px serif`; x.fillStyle = mine ? ME : FOE; x.fillText('♛', cx - bw / 2 - 12, by + 7); }
    if (asleep) { x.font = `700 ${Math.max(9, ts * 0.3)}px ${MONO}`; x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText('UYKUDA', cx, cy + ts * 0.55); }
    void s;
  }
  private proj(kind: string, side: Side, wx: number, wy: number, sx0: number, sy0: number, tx: number, ty: number, k: number, vis: string) {
    const x = this.x, ts = this.ts; const { X, Y } = this.P(wx, wy); const a = this.P(sx0, sy0), b = this.P(tx, ty); const yy = Y - ts * 1.0 - (kind === 'plasma' || kind === 'flame' ? Math.sin(k * Math.PI) * ts * 1.2 : 0);
    const col = vis === 'king' || vis === 'crown' ? (side === this.me ? ME : FOE) : kind === 'rail' ? '#39ff8a' : kind === 'snipe' ? '#ff5470' : kind === 'tracer' ? '#fcee0a' : kind === 'plasma' ? '#ff9b40' : kind === 'flame' ? '#ff7a1a' : kind === 'frost' ? '#9fe8ff' : '#ffffff';
    x.save(); x.globalCompositeOperation = 'lighter'; x.shadowColor = col; x.shadowBlur = 12;
    if (kind === 'rail' || kind === 'snipe' || kind === 'tracer' || kind === 'bolt') { const ang = Math.atan2(b.Y - a.Y, b.X - a.X); const L = kind === 'tracer' ? ts * 0.5 : ts * 1.1; x.strokeStyle = col; x.lineWidth = kind === 'snipe' ? 3 : 2.2; x.beginPath(); x.moveTo(X - Math.cos(ang) * L, yy - Math.sin(ang) * L); x.lineTo(X, yy); x.stroke(); }
    else if (kind === 'flame') { for (let i = 0; i < 3; i++) { x.fillStyle = i === 0 ? '#ffe2a0' : col; x.globalAlpha = 0.7 - i * 0.2; x.beginPath(); x.arc(X - i * 4, yy, ts * (0.22 - i * 0.04), 0, 7); x.fill(); } }
    else { x.fillStyle = col; x.beginPath(); x.arc(X, yy, ts * (kind === 'plasma' ? 0.28 : 0.16), 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(X, yy, ts * 0.08, 0, 7); x.fill(); }
    x.restore();
  }
  private particles(dt: number) {
    const x = this.x;
    this.parts = this.parts.filter((p) => (p.life -= dt) > 0);
    for (const p of this.parts) {
      const f = p.life / p.max;
      if (p.k === 'ring') { const r = p.s * (p.r ? 1 : 1 - f * 0.65); x.save(); x.strokeStyle = p.c; x.globalAlpha = p.r ? 0.5 * f + 0.2 : f; x.lineWidth = p.r ? 2 : 3 * f + 1; if (p.r) x.setLineDash([6, 6]); x.shadowColor = p.c; x.shadowBlur = 12; x.beginPath(); x.ellipse(p.x, p.y, r, r * 0.92, 0, 0, 7); x.stroke(); x.restore(); continue; }
      if (p.k === 'beam') {
        if (p.vx && p.vy) { x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = p.c; x.lineWidth = p.s; x.shadowColor = p.c; x.shadowBlur = 16; x.globalAlpha = f; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.vx, p.vy - this.ts * 0.6); x.stroke(); x.restore(); continue; }
        x.save(); x.globalCompositeOperation = 'lighter'; const gr = x.createLinearGradient(p.x - p.s, 0, p.x + p.s, 0); gr.addColorStop(0, 'rgba(160,230,255,0)'); gr.addColorStop(0.5, `rgba(220,250,255,${f})`); gr.addColorStop(1, 'rgba(160,230,255,0)'); x.fillStyle = gr; x.fillRect(p.x - p.s, 0, p.s * 2, p.y); x.restore(); continue; }
      if (p.k === 'bolt') {
        if (p.pts) { x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = p.c; x.lineWidth = p.s + 1; x.shadowColor = p.c; x.shadowBlur = 14; x.globalAlpha = f; x.beginPath(); for (let i = 0; i < p.pts.length; i += 2) { const jx = p.pts[i]! + (i && i < p.pts.length - 2 ? (Math.random() - 0.5) * 8 : 0), jy = p.pts[i + 1]! + (Math.random() - 0.5) * 6; if (i === 0) x.moveTo(jx, jy); else { const px = p.pts[i - 2]!, py = p.pts[i - 1]!; x.lineTo((px + jx) / 2 + (Math.random() - 0.5) * 10, (py + jy) / 2 + (Math.random() - 0.5) * 10); x.lineTo(jx, jy); } } x.stroke(); x.restore(); continue; }
        p.z += p.vz * dt; x.save(); x.strokeStyle = p.c; x.lineWidth = p.s; x.shadowColor = p.c; x.shadowBlur = 16; x.beginPath(); x.moveTo(p.x, p.y - Math.max(0, p.z) - 30); x.lineTo(p.x, p.y - Math.max(0, p.z)); x.stroke(); x.restore(); continue; }
      if (p.k === 'text') { p.y += p.vy * dt; x.save(); x.globalAlpha = Math.min(1, f * 2); x.font = `900 ${Math.round(14 * p.s)}px ${MONO}`; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,.8)'; x.strokeText(p.t!, p.x, p.y); x.fillStyle = p.c; x.fillText(p.t!, p.x, p.y); x.restore(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.k !== 'smoke') p.vz -= this.ts * 18 * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
      p.vx *= 0.96; p.vy *= 0.96;
      x.save(); if (p.add) x.globalCompositeOperation = 'lighter'; x.globalAlpha = p.k === 'smoke' ? f * 0.35 : f; x.fillStyle = p.c;
      if (p.k === 'smoke') { x.beginPath(); x.arc(p.x, p.y - p.z, p.s * (1.6 - f), 0, 7); x.fill(); }
      else if (p.k === 'shard') { x.translate(p.x, p.y - p.z); x.rotate(p.life * 9); x.fillRect(-p.s, -p.s / 3, p.s * 2, p.s / 1.5); }
      else { x.fillRect(p.x - p.s / 2, p.y - p.z - p.s / 2, p.s, p.s); }
      x.restore();
    }
  }
  private emotes(s: State, dt: number) {
    const x = this.x, ts = this.ts;
    this.emo = this.emo.filter((m) => (m.t += dt) < 2.8);
    for (const m of this.emo) {
      const k = s.ents.find((e) => e.king && e.side === m.side); if (!k) continue;
      const { X, Y } = this.P(k.x, k.y); const img = IMG['emo_' + m.e];
      const pop = m.t < 0.25 ? 1 + (1 - m.t / 0.25) * 0.6 * Math.sin((m.t / 0.25) * Math.PI) : 1; const fade = m.t > 2.4 ? (2.8 - m.t) / 0.4 : Math.min(1, m.t / 0.12);
      const sz = ts * 2.6 * pop * (m.t < 0.12 ? m.t / 0.12 : 1); const cy = Y - ts * 5.6 + Math.sin(m.t * 5) * 3;
      const wob = m.e === 'angry' ? Math.sin(m.t * 40) * 0.08 : m.e === 'laugh' ? Math.sin(m.t * 18) * 0.1 : m.e === 'cry' ? Math.sin(m.t * 3) * 0.05 : m.e === 'taunt' ? Math.sin(m.t * 10) * 0.12 : 0;
      x.save(); x.globalAlpha = fade; x.translate(X, cy); x.rotate(wob);
      x.fillStyle = 'rgba(8,12,20,.85)'; x.strokeStyle = m.side === this.me ? ME : FOE; x.lineWidth = 2.5; x.beginPath(); x.arc(0, 0, sz * 0.56, 0, 7); x.fill(); x.stroke();
      x.beginPath(); x.moveTo(-6, sz * 0.52); x.lineTo(0, sz * 0.72); x.lineTo(6, sz * 0.52); x.fill();
      if (img?.naturalWidth) { x.save(); x.beginPath(); x.arc(0, 0, sz * 0.52, 0, 7); x.clip(); const w = sz * 1.05, h = (w * img.naturalHeight) / img.naturalWidth; x.drawImage(img, -w / 2, -h / 2 + sz * 0.06, w, h); x.restore(); }
      if (m.e === 'gg') { x.font = `900 ${Math.round(sz * 0.3)}px ${MONO}`; x.textAlign = 'center'; x.fillStyle = '#fcee0a'; x.strokeStyle = '#000'; x.lineWidth = 4; x.strokeText('GG', 0, sz * 0.5); x.fillText('GG', 0, sz * 0.5); }
      x.restore();
      if (m.e === 'cry' && Math.random() < dt * 14) this.parts.push({ x: X + (Math.random() - 0.5) * sz * 0.4, y: cy, z: 0, vx: 0, vy: 0, vz: -10, life: 0.6, max: 0.6, c: '#7fd8ff', s: 2.5, k: 'spark' });
      if (m.e === 'angry' && Math.random() < dt * 10) this.parts.push({ x: X + (Math.random() - 0.5) * sz * 0.8, y: cy - sz * 0.4, z: 0, vx: 0, vy: -40, vz: 0, life: 0.5, max: 0.5, c: '#ff5a3a', s: 3, k: 'spark', add: true });
    }
  }
}
