/* SPIRE//CLASH çizim: Canvas 2D. Sabit arena katmanı bir kez çizilir; birimler, mermiler, parçacıklar her karede.
   Konuk oyuncuda arena 180° döner: kendi kulelerin hep altta. */
import { CARD } from './cards';
import { W, H, RIVER, BRIDGES, HZ, canDeploy, type State, type Fx, type Side } from './engine';

const BASE = import.meta.env.BASE_URL + 'img/clash/';
const IMG: Record<string, HTMLImageElement> = {};
const DARK: Record<string, HTMLCanvasElement> = {};
export function preload(): Promise<void> {
  const names = ['chrome', 'breacher', 'archer', 'goblin', 'drone', 'ogre', 'tabaxi', 'runner', 'turret', 'turret_r', 'mech', 'bomber', 'king', 'king_r', 'crown', 'crown_r', 'floor'];
  return Promise.all(names.map((n) => new Promise<void>((res) => { const i = new Image(); i.onload = () => res(); i.onerror = () => res(); i.src = BASE + n + '.webp'; IMG[n] = i; }))).then(() => {
    for (const n of ['king', 'king_r', 'crown', 'crown_r']) { const i = IMG[n]!; const c = document.createElement('canvas'); c.width = i.naturalWidth || 1; c.height = i.naturalHeight || 1; const x = c.getContext('2d')!; x.drawImage(i, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(10,8,12,.78)'; x.fillRect(0, 0, c.width, c.height); DARK[n] = c; }
  });
}
type P = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; c: string; s: number; k: 'spark' | 'dust' | 'ring' | 'beam' | 'bolt' | 'text' | 'debris'; r?: number; t?: string; pts?: number[] };
const ME = '#00e5ff', FOE = '#ff2a55';
export class Renderer {
  c: HTMLCanvasElement; x: CanvasRenderingContext2D; flip: boolean; me: Side;
  ts = 20; ox = 0; oy = 0; dpr = 1; bg: HTMLCanvasElement | null = null;
  parts: P[] = []; shake = 0; disp = new Map<number, { x: number; y: number; hp: number; flash: number; mv: number; fx: number }>(); t = 0;
  constructor(c: HTMLCanvasElement, me: Side) { this.c = c; this.x = c.getContext('2d')!; this.me = me; this.flip = me === 1; }
  resize(w: number, h: number) {
    this.dpr = Math.min(2, devicePixelRatio || 1); this.c.width = Math.round(w * this.dpr); this.c.height = Math.round(h * this.dpr); this.c.style.width = w + 'px'; this.c.style.height = h + 'px';
    this.ts = Math.min(w / W, h / (H + 3.4)); this.ox = (w - this.ts * W) / 2; this.oy = Math.max(this.ts * 3, (h - this.ts * H) / 2 + this.ts * 1.5); this.bg = null;
  }
  sx(x: number) { return this.ox + (this.flip ? W - x : x) * this.ts; }
  sy(y: number) { return this.oy + (this.flip ? H - y : y) * this.ts; }
  world(px: number, py: number) { let x = (px - this.ox) / this.ts, y = (py - this.oy) / this.ts; if (this.flip) { x = W - x; y = H - y; } return { x, y }; }
  private drawBg() {
    const ts = this.ts, cw = Math.ceil(W * ts), ch = Math.ceil(H * ts);
    const b = document.createElement('canvas'); b.width = Math.round(cw * this.dpr); b.height = Math.round(ch * this.dpr); const g = b.getContext('2d')!; g.scale(this.dpr, this.dpr);
    g.fillStyle = '#07090f'; g.fillRect(0, 0, cw, ch);
    const fl = IMG.floor; if (fl?.naturalWidth) { const pat = g.createPattern(fl, 'repeat')!; const m = new DOMMatrix().scale((ts * 6) / 512); pat.setTransform(m); g.globalAlpha = 0.9; g.fillStyle = pat; g.fillRect(0, 0, cw, ch); g.globalAlpha = 1; }
    // yarı tonları: altta ben (camgöbeği), üstte rakip (kırmızı)
    let gr = g.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, 'rgba(255,42,85,.13)'); gr.addColorStop(0.45, 'rgba(255,42,85,.02)'); gr.addColorStop(0.55, 'rgba(0,229,255,.02)'); gr.addColorStop(1, 'rgba(0,229,255,.12)'); g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
    // kanat yolları
    g.fillStyle = 'rgba(160,190,210,.05)';
    for (const bx of BRIDGES) g.fillRect((bx - 1.1) * ts, 4 * ts, 2.2 * ts, 24 * ts);
    g.fillRect(4 * ts, 3.2 * ts, 10 * ts, 1.4 * ts); g.fillRect(4 * ts, 27.4 * ts, 10 * ts, 1.4 * ts);
    // ince ızgara
    g.strokeStyle = 'rgba(120,200,255,.045)'; g.lineWidth = 1; g.beginPath();
    for (let i = 1; i < W; i++) { g.moveTo(i * ts, 0); g.lineTo(i * ts, ch); } for (let j = 1; j < H; j++) { if (Math.abs(j - RIVER) <= 1) continue; g.moveTo(0, j * ts); g.lineTo(cw, j * ts); } g.stroke();
    // nehir
    const ry = (RIVER - 1) * ts, rh = 2 * ts;
    gr = g.createLinearGradient(0, ry, 0, ry + rh); gr.addColorStop(0, '#02060c'); gr.addColorStop(0.5, '#062236'); gr.addColorStop(1, '#02060c'); g.fillStyle = gr; g.fillRect(0, ry, cw, rh);
    g.strokeStyle = 'rgba(0,229,255,.55)'; g.lineWidth = 2; g.shadowColor = '#00e5ff'; g.shadowBlur = 10; g.beginPath(); g.moveTo(0, ry); g.lineTo(cw, ry); g.moveTo(0, ry + rh); g.lineTo(cw, ry + rh); g.stroke(); g.shadowBlur = 0;
    // köprüler
    for (const bx of BRIDGES) {
      const x0 = (bx - 1.1) * ts, y0 = ry - ts * 0.35, bw = 2.2 * ts, bh = rh + ts * 0.7;
      g.fillStyle = '#1a1f29'; g.fillRect(x0, y0, bw, bh);
      g.fillStyle = '#242b38'; for (let k = 0; k < 7; k++) g.fillRect(x0 + 2, y0 + 3 + k * (bh / 7), bw - 4, bh / 7 - 3);
      g.fillStyle = '#0d1016'; g.fillRect(x0 - 3, y0, 4, bh); g.fillRect(x0 + bw - 1, y0, 4, bh);
      g.shadowColor = '#fcee0a'; g.shadowBlur = 8; g.fillStyle = '#fcee0a'; for (let k = 0; k < 4; k++) { g.fillRect(x0 - 2, y0 + 6 + k * (bh - 12) / 3, 2, 4); g.fillRect(x0 + bw, y0 + 6 + k * (bh - 12) / 3, 2, 4); } g.shadowBlur = 0;
    }
    // kule kaideleri
    for (const [px, py, r] of [[3.5, 6.5, 1.8], [14.5, 6.5, 1.8], [9, 3, 2.3], [3.5, 25.5, 1.8], [14.5, 25.5, 1.8], [9, 29, 2.3]] as const) {
      const cx = px * ts, cy = py * ts; g.save(); g.translate(cx, cy); g.beginPath(); for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k + Math.PI / 6; g.lineTo(Math.cos(a) * r * ts, Math.sin(a) * r * ts * 0.8); } g.closePath();
      g.fillStyle = 'rgba(10,14,20,.85)'; g.fill(); g.strokeStyle = py > 16 ? 'rgba(0,229,255,.5)' : 'rgba(255,42,85,.5)'; g.lineWidth = 1.5; g.stroke(); g.restore();
    }
    // çerçeve
    g.strokeStyle = 'rgba(0,229,255,.35)'; g.lineWidth = 2; g.strokeRect(1, ch / 2, cw - 2, ch / 2 - 1); g.strokeStyle = 'rgba(255,42,85,.35)'; g.strokeRect(1, 1, cw - 2, ch / 2 - 1);
    gr = g.createRadialGradient(cw / 2, ch / 2, ch * 0.2, cw / 2, ch / 2, ch * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
    this.bg = b;
  }
  /** Simülasyon olaylarını görsel parçacığa çevir (ses dışarıda). */
  feed(fx: Fx[]) {
    for (const f of fx) {
      const col = f.side === undefined ? '#fff' : f.side === this.me ? ME : FOE, cc = CARD[f.card ?? '']?.color ?? col;
      if (f.k === 'deploy') { this.ring(f.x, f.y, col, 1.6, 0.45); this.burst(f.x, f.y, 14, '#8fa3b8', 'dust', 2.5); }
      else if (f.k === 'melee') this.burst(f.x, f.y, 6, cc, 'spark', 4);
      else if (f.k === 'die') { this.burst(f.x, f.y, 18, cc, 'spark', 5); this.burst(f.x, f.y, 8, '#555', 'debris', 3); this.ring(f.x, f.y, cc, 1, 0.3); }
      else if (f.k === 'tdie') { this.shake = Math.max(this.shake, 14); this.burst(f.x, f.y, 70, '#ffb340', 'spark', 9); this.burst(f.x, f.y, 30, '#444', 'debris', 6); this.ring(f.x, f.y, '#ffb340', 4, 0.7); this.ring(f.x, f.y, col, 3, 0.9); }
      else if (f.k === 'boom') { this.burst(f.x, f.y, 22, '#ff9b2f', 'spark', 5); this.ring(f.x, f.y, '#ff9b2f', (f.v ?? 1) * 1.2, 0.35); this.shake = Math.max(this.shake, 3); }
      else if (f.k === 'strike') { this.shake = Math.max(this.shake, 10); this.parts.push({ x: f.x, y: f.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.5, max: 0.5, c: '#ffd28a', s: 1, k: 'beam' }); this.ring(f.x, f.y, '#ff9b2f', f.v ?? 2.5, 0.6); this.ring(f.x, f.y, '#fff', (f.v ?? 2.5) * 0.6, 0.35); this.burst(f.x, f.y, 60, '#ff9b2f', 'spark', 8); this.burst(f.x, f.y, 20, '#333', 'debris', 5); }
      else if (f.k === 'emp') { this.ring(f.x, f.y, '#4da3ff', f.v ?? 2.5, 0.5); this.ring(f.x, f.y, '#c9e6ff', (f.v ?? 2.5) * 0.7, 0.3); this.burst(f.x, f.y, 40, '#7cc4ff', 'spark', 6); this.shake = Math.max(this.shake, 4); }
      else if (f.k === 'arc') this.parts.push({ x: f.x, y: f.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.16, max: 0.16, c: '#8fd0ff', s: 1, k: 'bolt', pts: f.pts });
      else if (f.k === 'shot' && (f.card === 'archer')) { /* mermi çizilir */ }
    }
  }
  private ring(x: number, y: number, c: string, r: number, life: number) { this.parts.push({ x, y, z: 0, vx: 0, vy: 0, vz: 0, life, max: life, c, s: 1, k: 'ring', r }); }
  private burst(x: number, y: number, n: number, c: string, k: P['k'], sp: number) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = (0.3 + Math.random()) * sp; const life = k === 'dust' ? 0.6 + Math.random() * 0.4 : 0.35 + Math.random() * 0.5;
      this.parts.push({ x, y, z: k === 'debris' ? 0.2 : 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8, vz: k === 'dust' ? 0.5 : 2 + Math.random() * 4, life, max: life, c, s: k === 'debris' ? 0.12 + Math.random() * 0.12 : k === 'dust' ? 0.3 + Math.random() * 0.4 : 0.05 + Math.random() * 0.08, k }); }
  }
  draw(s: State, dt: number, drag: { card: string; x: number; y: number; ok: boolean } | null) {
    this.t += dt; const x = this.x, ts = this.ts, d = this.dpr;
    if (!this.bg) this.drawBg();
    x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, this.c.width, this.c.height);
    let shx = 0, shy = 0; if (this.shake > 0.1) { shx = (Math.random() - 0.5) * this.shake; shy = (Math.random() - 0.5) * this.shake; this.shake *= Math.pow(0.02, dt); }
    x.translate(shx, shy);
    x.drawImage(this.bg!, this.ox, this.oy, W * ts, H * ts);
    // nehir akışı
    x.save(); x.beginPath(); x.rect(this.ox, this.oy + (RIVER - 1) * ts, W * ts, 2 * ts); x.clip();
    for (let i = 0; i < 26; i++) { const p = ((i * 0.37 + this.t * (0.06 + (i % 3) * 0.02)) % 1); const yy = this.oy + (RIVER - 0.9 + ((i * 0.61) % 1.8)) * ts; const xx = this.ox + p * W * ts * 1.2 - ts; x.strokeStyle = `rgba(0,229,255,${0.08 + (i % 4) * 0.04})`; x.lineWidth = 1 + (i % 2); x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + ts * (0.8 + (i % 3) * 0.5), yy); x.stroke(); }
    x.restore();
    // yasak bölge (sürüklerken)
    if (drag && CARD[drag.card]?.kind !== 'spell') {
      x.fillStyle = 'rgba(255,42,85,.13)';
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (!canDeploy(s, this.me, drag.card, i + 0.5, j + 0.5)) { const sx = this.sx(this.flip ? i + 1 : i), sy = this.sy(this.flip ? j + 1 : j); x.fillRect(sx, sy, ts, ts); }
      x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 1;
    }
    // bekleyen büyü nişangahı
    for (const p of s.pend) { const k = (p.at - s.tick) / 16; const r = (CARD[p.card]!.radius ?? 2.5) * ts; const cx = this.sx(p.x), cy = this.sy(p.y);
      x.strokeStyle = p.side === this.me ? ME : FOE; x.lineWidth = 2; x.setLineDash([6, 6]); x.lineDashOffset = -this.t * 40; x.beginPath(); x.ellipse(cx, cy, r, r * 0.8, 0, 0, 6.283); x.stroke(); x.setLineDash([]);
      x.fillStyle = `rgba(255,155,47,${0.1 + (1 - k) * 0.25})`; x.beginPath(); x.ellipse(cx, cy, r * (1 - k * 0.6), r * 0.8 * (1 - k * 0.6), 0, 0, 6.283); x.fill(); }
    // varlıklar: y sırası (ekran)
    const ents = s.ents.slice().sort((a, b) => this.sy(a.y) + (a.fly ? 1000 : 0) - (this.sy(b.y) + (b.fly ? 1000 : 0)));
    const seen = new Set<number>();
    for (const e of ents) {
      seen.add(e.id);
      let dp = this.disp.get(e.id); if (!dp) { dp = { x: e.x, y: e.y, hp: e.hp, flash: 0, mv: 0, fx: 1 }; this.disp.set(e.id, dp); }
      const k = 1 - Math.pow(0.0005, dt); const px = dp.x, py = dp.y; dp.x += (e.x - dp.x) * k; dp.y += (e.y - dp.y) * k;
      const moved = Math.hypot(dp.x - px, dp.y - py) / Math.max(dt, 1e-3); dp.mv += ((moved > 0.15 ? 1 : 0) - dp.mv) * Math.min(1, dt * 10);
      if (e.hp < dp.hp) dp.flash = 0.14; dp.hp = e.hp; dp.flash = Math.max(0, dp.flash - dt);
      const sfx = (this.flip ? -1 : 1) * e.fx; if (Math.abs(sfx) > 0.2) dp.fx = sfx > 0 ? 1 : -1;
      const cx = this.sx(dp.x), cy = this.sy(dp.y), mine = e.side === this.me, col = mine ? ME : FOE;
      if (e.kind === 'tower') { this.tower(e, cx, cy, mine); continue; }
      const c = CARD[e.card]!; const img = IMG[e.kind === 'building' && !mine ? e.card + '_r' : e.card];
      const hgt = ts * 1.2 * (e.kind === 'building' ? 2.5 : e.card === 'ogre' || e.card === 'mech' ? 2.5 : e.card === 'breacher' ? 2.15 : e.card === 'goblin' ? 1.3 : e.card === 'bomber' ? 2.2 : e.card === 'drone' ? 1.4 : 1.8);
      const dep = e.dep / HZ; const lift = e.fly ? ts * (1.3 + Math.sin(this.t * 3 + e.id) * 0.12) : 0;
      // gölge + takım halkası
      x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(cx, cy + ts * 0.15, e.r * ts * 1.1, e.r * ts * 0.55, 0, 0, 6.283); x.fill();
      x.strokeStyle = col; x.globalAlpha = 0.85 - dep * 0.5; x.lineWidth = 2; x.shadowColor = col; x.shadowBlur = 10; x.beginPath(); x.ellipse(cx, cy + ts * 0.12, e.r * ts * 1.05, e.r * ts * 0.5, 0, 0, 6.283); x.stroke(); x.shadowBlur = 0; x.globalAlpha = 1;
      if (!img?.naturalWidth) continue;
      const iw = (hgt * img.naturalWidth) / img.naturalHeight; let bob = 0, lx = 0, ly = 0;
      if (e.kind === 'troop') { bob = Math.abs(Math.sin(this.t * 9 + e.id)) * ts * 0.09 * dp.mv; if (e.atk > 0) { const a = e.atk / 6; lx = (this.flip ? -1 : 1) * e.fx * ts * 0.25 * a; ly = (this.flip ? -1 : 1) * e.fy * ts * 0.2 * a; } }
      const drop = dep > 0 ? (dep * dep) * ts * 6 : 0;
      x.save(); x.translate(cx + lx, cy + ts * 0.2 - lift - bob - drop + ly); if (e.kind === 'troop' && dp.fx < 0) x.scale(-1, 1);
      x.globalAlpha = dep > 0 ? 0.35 + (1 - dep) * 0.65 : 1;
      x.shadowColor = col; x.shadowBlur = 8; x.drawImage(img, -iw / 2, -hgt, iw, hgt); x.shadowBlur = 0;
      if (dp.flash > 0) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = dp.flash / 0.14 * 0.7; x.drawImage(img, -iw / 2, -hgt, iw, hgt); x.globalCompositeOperation = 'source-over'; }
      x.restore(); x.globalAlpha = 1;
      if (e.stun > 0) { for (let i = 0; i < 3; i++) { const a = this.t * 8 + i * 2.1; x.fillStyle = '#9fd6ff'; x.fillRect(cx + Math.cos(a) * ts * 0.4, cy - hgt - lift + Math.sin(a) * ts * 0.15, 3, 3); } }
      // can çubuğu
      if (e.hp < e.max || e.kind === 'building') { const bw = Math.max(ts * 1.1, e.r * ts * 2), by = cy - hgt - lift - 6 - drop; x.fillStyle = 'rgba(0,0,0,.7)'; x.fillRect(cx - bw / 2 - 1, by - 1, bw + 2, 6); x.fillStyle = mine ? '#29d3ff' : '#ff3355'; x.fillRect(cx - bw / 2, by, bw * Math.max(0, e.hp / e.max), 4); }
      void c;
    }
    for (const id of this.disp.keys()) if (!seen.has(id)) this.disp.delete(id);
    // mermiler
    for (const p of s.proj) {
      const k = p.t / p.T, cx = this.sx(p.x), cy = this.sy(p.y), mine = p.side === this.me, col = mine ? ME : FOE;
      x.save(); x.globalCompositeOperation = 'lighter';
      if (p.kind === 'rail') { const bx = this.sx(p.x - (p.x - p.sx) * 0.4), by = this.sy(p.y - (p.y - p.sy) * 0.4); x.strokeStyle = '#39ff8a'; x.lineWidth = 3; x.shadowColor = '#39ff8a'; x.shadowBlur = 12; x.beginPath(); x.moveTo(bx, by - ts); x.lineTo(cx, cy - ts); x.stroke(); }
      else if (p.kind === 'plasma') { const z = 4 * k * (1 - k) * ts * 3; x.fillStyle = '#ffb347'; x.shadowColor = '#ff7a1a'; x.shadowBlur = 20; x.beginPath(); x.arc(cx, cy - ts - z, ts * 0.28, 0, 6.283); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy - ts - z, ts * 0.12, 0, 6.283); x.fill(); }
      else if (p.kind === 'tracer') { const bx = this.sx(p.x - (p.x - p.sx) * 0.25), by = this.sy(p.y - (p.y - p.sy) * 0.25); x.strokeStyle = '#fcee0a'; x.lineWidth = 2; x.shadowColor = '#fcee0a'; x.shadowBlur = 8; x.beginPath(); x.moveTo(bx, by - ts * 1.4); x.lineTo(cx, cy - ts * 1.2); x.stroke(); }
      else { const z = ts * 2.2 * (1 - k) + ts * 0.6; const bx = this.sx(p.x - (p.x - p.sx) * 0.15), by = this.sy(p.y - (p.y - p.sy) * 0.15); x.strokeStyle = col; x.lineWidth = 3; x.shadowColor = col; x.shadowBlur = 14; x.beginPath(); x.moveTo(bx, by - z - ts * 0.2); x.lineTo(cx, cy - z); x.stroke(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy - z, ts * 0.12, 0, 6.283); x.fill(); }
      x.restore();
    }
    // parçacıklar
    const g = 14;
    for (const p of this.parts) {
      p.life -= dt; const k = Math.max(0, p.life / p.max);
      if (p.k === 'spark' || p.k === 'debris' || p.k === 'dust') { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= (p.k === 'dust' ? 1 : g) * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; } if (p.k === 'dust') { p.vx *= 0.96; p.vy *= 0.96; } }
      const cx = this.sx(p.x), cy = this.sy(p.y) - p.z * ts;
      if (p.k === 'spark') { x.globalCompositeOperation = 'lighter'; x.fillStyle = p.c; x.globalAlpha = k; x.fillRect(cx - p.s * ts / 2, cy - p.s * ts / 2, p.s * ts, p.s * ts); x.globalCompositeOperation = 'source-over'; }
      else if (p.k === 'debris') { x.fillStyle = p.c; x.globalAlpha = Math.min(1, k * 2); x.fillRect(cx, cy, p.s * ts, p.s * ts * 0.7); }
      else if (p.k === 'dust') { x.fillStyle = 'rgba(150,165,185,1)'; x.globalAlpha = k * 0.25; x.beginPath(); x.arc(cx, cy, p.s * ts * (1.4 - k * 0.6), 0, 6.283); x.fill(); }
      else if (p.k === 'ring') { const r = (p.r ?? 1) * ts * (1 - k * k * 0.85); x.globalCompositeOperation = 'lighter'; x.strokeStyle = p.c; x.globalAlpha = k; x.lineWidth = 2 + 6 * k; x.shadowColor = p.c; x.shadowBlur = 16; x.beginPath(); x.ellipse(this.sx(p.x), this.sy(p.y), r, r * 0.8, 0, 0, 6.283); x.stroke(); x.shadowBlur = 0; x.globalCompositeOperation = 'source-over'; }
      else if (p.k === 'beam') { const bx = this.sx(p.x), by = this.sy(p.y); const w = ts * 1.6 * k; x.globalCompositeOperation = 'lighter'; const gr = x.createLinearGradient(bx - w, 0, bx + w, 0); gr.addColorStop(0, 'rgba(255,155,47,0)'); gr.addColorStop(0.5, `rgba(255,240,200,${k})`); gr.addColorStop(1, 'rgba(255,155,47,0)'); x.fillStyle = gr; x.globalAlpha = 1; x.fillRect(bx - w, -50, w * 2, by + 50); x.globalCompositeOperation = 'source-over'; }
      else if (p.k === 'bolt' && p.pts) { x.globalCompositeOperation = 'lighter'; x.strokeStyle = p.c; x.lineWidth = 2.5; x.shadowColor = '#4da3ff'; x.shadowBlur = 14; x.globalAlpha = k; x.beginPath();
        for (let i = 0; i + 3 < p.pts.length; i += 2) { const ax = this.sx(p.pts[i]!), ay = this.sy(p.pts[i + 1]!) - ts, bx = this.sx(p.pts[i + 2]!), by = this.sy(p.pts[i + 3]!) - ts * 0.8; x.moveTo(ax, ay); for (let q = 1; q < 6; q++) { const f = q / 6; x.lineTo(ax + (bx - ax) * f + (Math.random() - 0.5) * ts * 0.6, ay + (by - ay) * f + (Math.random() - 0.5) * ts * 0.6); } x.lineTo(bx, by); }
        x.stroke(); x.shadowBlur = 0; x.globalCompositeOperation = 'source-over'; }
      x.globalAlpha = 1;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    // sürükleme hayaleti
    if (drag) {
      const c = CARD[drag.card]!; const cx = this.sx(drag.x), cy = this.sy(drag.y);
      if (c.kind === 'spell') { const r = c.radius! * ts; x.strokeStyle = drag.ok ? '#fff' : FOE; x.lineWidth = 2; x.setLineDash([5, 5]); x.beginPath(); x.ellipse(cx, cy, r, r * 0.8, 0, 0, 6.283); x.stroke(); x.setLineDash([]); x.fillStyle = 'rgba(255,255,255,.08)'; x.fill(); }
      else { const img = IMG[drag.card]; if (img?.naturalWidth) { const hgt = ts * 1.9, iw = (hgt * img.naturalWidth) / img.naturalHeight; x.globalAlpha = drag.ok ? 0.6 : 0.3; x.drawImage(img, cx - iw / 2, cy - hgt + ts * 0.2, iw, hgt); x.globalAlpha = 1; }
        x.strokeStyle = drag.ok ? ME : FOE; x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy + ts * 0.1, ts * 0.7, ts * 0.35, 0, 0, 6.283); x.stroke();
        if (c.range && c.range > 2) { x.strokeStyle = 'rgba(255,255,255,.18)'; x.setLineDash([4, 6]); x.beginPath(); x.ellipse(cx, cy, c.range * ts, c.range * ts * 0.8, 0, 0, 6.283); x.stroke(); x.setLineDash([]); } }
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
  }
  private tower(e: State['ents'][number], cx: number, cy: number, mine: boolean) {
    const x = this.x, ts = this.ts, key = (e.king ? 'king' : 'crown') + (mine ? '' : '_r');
    const img = e.hp > 0 ? IMG[key] : DARK[key]; const hgt = ts * (e.king ? 5.2 : 4.0);
    const w0 = img instanceof HTMLImageElement ? img.naturalWidth : img?.width, h0 = img instanceof HTMLImageElement ? img.naturalHeight : img?.height;
    if (!img || !w0) return;
    const iw = (hgt * w0) / h0!; const dp = this.disp.get(e.id)!;
    if (e.hp <= 0) { x.save(); x.beginPath(); x.rect(cx - iw, cy - hgt * 0.35, iw * 2, hgt); x.clip(); x.drawImage(img, cx - iw / 2, cy - hgt * 0.55, iw, hgt * 0.7); x.restore(); return; }
    x.save(); const asleep = e.king && !e.active;
    if (asleep) x.globalAlpha = 0.82;
    x.shadowColor = mine ? ME : FOE; x.shadowBlur = asleep ? 6 : 18 + Math.sin(this.t * 3) * 6;
    x.drawImage(img, cx - iw / 2, cy - hgt * 0.78, iw, hgt); x.shadowBlur = 0;
    if (dp.flash > 0) { x.globalCompositeOperation = 'lighter'; x.globalAlpha = dp.flash / 0.14 * 0.5; x.drawImage(img, cx - iw / 2, cy - hgt * 0.78, iw, hgt); x.globalCompositeOperation = 'source-over'; }
    x.restore();
    // can
    const bw = ts * (e.king ? 3.2 : 2.4), by = cy - hgt * 0.78 - 10;
    x.fillStyle = 'rgba(0,0,0,.75)'; x.fillRect(cx - bw / 2 - 2, by - 2, bw + 4, 10); x.fillStyle = mine ? '#29d3ff' : '#ff3355'; x.fillRect(cx - bw / 2, by, bw * (e.hp / e.max), 6);
    x.font = `700 ${Math.max(10, ts * 0.5)}px "JetBrains Mono", ui-monospace, monospace`; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 3; const tx = String(Math.ceil(e.hp)); x.strokeText(tx, cx, by - 4); x.fillText(tx, cx, by - 4);
    if (asleep) { x.font = `700 ${Math.max(9, ts * 0.42)}px "JetBrains Mono", monospace`; x.fillStyle = 'rgba(255,255,255,.6)'; x.fillText('UYKU', cx, cy + ts * 0.9); }
  }
}
