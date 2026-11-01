// God's Eye sahne çizici: tek yol (DM, oyuncu, ekran görüntüsü). Sahne içeriği saf: filtre/efekt yok.
import { loadImg, type Scene, type Ink, type Layer, type Token, type Ping } from '../../lib/gods';
export const FONTS = ['Rajdhani', 'Orbitron', 'Share Tech Mono', 'Georgia', 'system-ui'];
const cache = new Map<string, HTMLImageElement | null>();
let onLoad = () => {};
export function setImgListener(f: () => void) { onLoad = f; }
export function img(l: Layer) {
  const r = l.img!; if (cache.has(r.id)) return cache.get(r.id) ?? null;
  cache.set(r.id, null); loadImg(r).then((im) => { cache.set(r.id, im); if (!im) setTimeout(() => cache.delete(r.id), 4000); onLoad(); }); return null;
}
const tokImgs = new Map<string, HTMLImageElement>();
function tokImg(t: Token) { if (!t.img) return null; let im = tokImgs.get(t.img); if (!im) { im = new Image(); im.onload = () => onLoad(); im.src = t.img; tokImgs.set(t.img, im); } return im.complete && im.naturalWidth ? im : null; }
export function wrap(g: CanvasRenderingContext2D, t: string, w: number) {
  const out: string[] = [];
  for (const para of t.split('\n')) { let line = ''; for (const word of para.split(/(\s+)/)) { const nx = line + word; if (g.measureText(nx).width > w && line.trim()) { out.push(line.trimEnd()); line = word.trimStart(); } else line = nx; } out.push(line); }
  return out;
}
export const fontOf = (l: Layer) => `${l.bold ? 700 : 500} ${l.fs ?? 48}px "${FONTS[0]}", system-ui, sans-serif`;
export function drawLayer(g: CanvasRenderingContext2D, l: Layer, ink?: Ink) {
  if (l.hid) return;
  if (l.k === 'img' && l.img) { const im = img(l); if (im) g.drawImage(im, l.x, l.y, l.w, l.h); }
  else if (l.k === 'text') {
    g.font = fontOf(l); g.fillStyle = l.col ?? '#ffffff'; g.textBaseline = 'top'; const fs = l.fs ?? 48, lh = fs * 1.18;
    g.textAlign = l.al ?? 'left'; const ax = l.al === 'center' ? l.x + l.w / 2 : l.al === 'right' ? l.x + l.w : l.x;
    wrap(g, l.t ?? '', l.w).forEach((ln, i) => g.fillText(ln, ax, l.y + i * lh)); g.textAlign = 'left';
  } else if (l.k === 'draw' && ink) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of ink.s) { const p = s.p; if (p.length < 2) continue; g.strokeStyle = s.c; g.lineWidth = Math.max(0.5, s.w * l.w);
      g.beginPath(); g.moveTo(l.x + (p[0] / 1e4) * l.w, l.y + (p[1] / 1e4) * l.h); if (p.length === 2) g.lineTo(l.x + (p[0] / 1e4) * l.w + 0.01, l.y + (p[1] / 1e4) * l.h);
      for (let i = 2; i < p.length; i += 2) g.lineTo(l.x + (p[i] / 1e4) * l.w, l.y + (p[i + 1] / 1e4) * l.h); g.stroke(); }
  }
}
export function drawScene(g: CanvasRenderingContext2D, s: Scene, inks: Record<string, Ink>, extra?: Layer) {
  for (const l of s.layers) drawLayer(g, l, inks[l.id]);
  if (extra) drawLayer(g, extra, undefined);
}
export const TOK = 72; // sahne px
export function drawTokens(g: CanvasRenderingContext2D, toks: Token[], sel?: string) {
  for (const t of toks) {
    const r = TOK / 2; g.save(); g.beginPath(); g.arc(t.x, t.y, r, 0, Math.PI * 2); g.closePath();
    g.fillStyle = '#0a0f18'; g.fill(); const im = tokImg(t);
    if (im) { g.save(); g.clip(); g.drawImage(im, t.x - r, t.y - r, TOK, TOK); g.restore(); }
    else { g.fillStyle = t.col; g.font = `700 ${r * 1.1}px "Rajdhani", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((t.name || '?').trim()[0]?.toLocaleUpperCase('tr') ?? '?', t.x, t.y + 2); }
    g.lineWidth = sel === t.uid ? 5 : 3.5; g.strokeStyle = t.col; g.stroke();
    g.font = '600 17px "Rajdhani", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top'; const nm = (t.name || '').split(' ')[0];
    const tw = g.measureText(nm).width + 12; g.fillStyle = 'rgba(4,6,10,.78)'; g.fillRect(t.x - tw / 2, t.y + r + 5, tw, 21); g.fillStyle = t.col; g.fillText(nm, t.x, t.y + r + 7);
    g.restore();
  }
}
export const PING_MS = 2600;
export function drawPings(g: CanvasRenderingContext2D, pings: Ping[], t: number, k = 1) {
  let live = false;
  for (const p of pings) {
    const a = (t - p.at) / PING_MS; if (a < 0 || a > 1) continue; live = true;
    g.save(); g.strokeStyle = p.col; g.fillStyle = p.col;
    for (let i = 0; i < 3; i++) { const q = (a * 1.6 - i * 0.22); if (q < 0 || q > 1) continue; g.globalAlpha = (1 - q) * 0.9; g.lineWidth = 4 / k; g.beginPath(); g.arc(p.x, p.y, (10 + q * 70) / k, 0, Math.PI * 2); g.stroke(); }
    g.globalAlpha = Math.min(1, (1 - a) * 2); g.beginPath(); g.arc(p.x, p.y, 7 / k, 0, Math.PI * 2); g.fill();
    g.font = `700 ${16 / k}px "Rajdhani", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(p.name, p.x, p.y - 16 / k);
    g.restore();
  }
  return live;
}
export function hitLayer(s: Scene, x: number, y: number) {
  for (let i = s.layers.length - 1; i >= 0; i--) { const l = s.layers[i]; if (!l.hid && x >= l.x && y >= l.y && x <= l.x + l.w && y <= l.y + l.h) return l; }
  return null;
}
export const hitToken = (toks: Token[], x: number, y: number) => [...toks].reverse().find((t) => Math.hypot(t.x - x, t.y - y) <= TOK / 2 + 4) ?? null;
/** Ekran görüntüsü: yalnız sahne sınırı, saf içerik + jetonlar. */
export function capture(s: Scene, inks: Record<string, Ink>, toks: Token[]) {
  const c = document.createElement('canvas'); c.width = s.w; c.height = s.h; const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, s.w, s.h); drawScene(g, s, inks); drawTokens(g, toks); return c;
}
