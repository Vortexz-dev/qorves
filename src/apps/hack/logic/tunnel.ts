/* Veri Tüneli — silindirik veri borusunda ilerleyen paket. Kesit (x,y) diski içinde fareyle yönlendir; engellere değme.
   Oyun mantığı tüp yerel koordinatında: z ileri, kesit yarıçapı R=1. Tüp dönüşü engellerin açısını zamana bağlar. */
import { type Rng, rnd, ri, dk, lerp } from './common';
export const R = 1, PR = 0.085, VMAX = 3.4; // VMAX: paketin kesitteki en yüksek hızı (R/sn) // tüp ve paket yarıçapı
export type ObKind = 'plate' | 'bar' | 'iris' | 'cross' | 'blocks';
export interface Ob { z: number; kind: ObKind; a: number; span: number; spin: number; hole?: [number, number, number]; blocks?: [number, number, number][]; th: number }
export interface Tunnel { len: number; obs: Ob[]; speed: (z: number) => number; spinAt: (t: number) => number; lives: number; grace: number; curve: number; D: number }
export function params(diff: number) {
  const t = dk(diff);
  return {
    len: Math.round(lerp(260, 520, t)),          // parkur uzunluğu
    v0: lerp(9, 15, t), vVar: [0, 0, 0.18, 0.3, 0.4][diff - 1] ?? 0, // hız ve hız dalgası
    gap: lerp(15, 9, t),                          // engel aralığı (birim)
    spin: [0, 0.18, 0.35, 0.55, 0.8][diff - 1] ?? 0.3, // tüp dönüş hızı (rad/sn)
    obSpin: [0, 0, 0.4, 0.7, 1.0][diff - 1] ?? 0,  // tek tek dönen engeller
    curve: [0.2, 0.45, 0.7, 0.9, 1.0][diff - 1] ?? 0.5,
    lives: [3, 3, 2, 2, 2][diff - 1] ?? 2,
    kinds: (diff <= 1 ? ['plate', 'bar', 'blocks'] : diff <= 2 ? ['plate', 'bar', 'blocks', 'iris'] : ['plate', 'bar', 'blocks', 'iris', 'cross']) as ObKind[],
  };
}
const TAU = Math.PI * 2;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
/** (x,y) engel tarafından kapanıyor mu? rot: o anki toplam dönüş açısı. pad: paket yarıçapı payı */
export function hit(o: Ob, x: number, y: number, rot: number, pad = PR): boolean {
  const ang = o.a + rot; const c = Math.cos(-ang), s = Math.sin(-ang);
  const lx = x * c - y * s, ly = x * s + y * c; // engelin yerel çerçevesi
  const r = Math.hypot(x, y);
  switch (o.kind) {
    case 'plate': { // açı aralığı [0,span] boyunca kesit dilimi
      const th = wrap(Math.atan2(ly, lx));
      const padA = pad / Math.max(r, 0.15);
      return th <= o.span + padA || th >= TAU - padA;
    }
    case 'bar': return Math.abs(ly) < o.span / 2 + pad; // tüpü kesen kiriş
    case 'cross': return Math.abs(ly) < o.span / 2 + pad || Math.abs(lx) < o.span / 2 + pad;
    case 'iris': { const [hx, hy, hr] = o.hole!; return Math.hypot(lx - hx, ly - hy) > hr - pad; }
    case 'blocks': return o.blocks!.some(([bx, by, bs]) => Math.abs(lx - bx) < bs + pad && Math.abs(ly - by) < bs + pad);
  }
}
export function generate(diff: number, r: Rng = rnd): Tunnel {
  const P = params(diff);
  const obs: Ob[] = [];
  const grace = P.v0 * 3.2; // ilk ~3 sn boş: oyuncu kontrolü hisseder
  let z = grace + 10;
  while (z < P.len - 10) {
    const kind = P.kinds[ri(r, 0, P.kinds.length - 1)]!;
    const o: Ob = { z, kind, a: r() * TAU, span: 0, spin: (r() < 0.5 ? -1 : 1) * P.obSpin * (0.6 + r() * 0.6), th: 0.9 };
    if (kind === 'plate') o.span = lerp(2.2, 4.4, dk(diff)) * (0.85 + r() * 0.2); // açık kalan dilim ≥ ~1.9 rad
    if (kind === 'bar') o.span = lerp(0.28, 0.46, r());
    if (kind === 'cross') o.span = lerp(0.2, 0.3, r());
    if (kind === 'iris') { const hr = lerp(0.42, 0.3, dk(diff)) * (0.95 + r() * 0.15); const d = r() * (R - hr - 0.08); const ha = r() * TAU; o.hole = [Math.cos(ha) * d, Math.sin(ha) * d, hr]; }
    if (kind === 'blocks') { const n = ri(r, 3, 4 + diff); o.blocks = Array.from({ length: n }, () => { const rr = Math.sqrt(r()) * 0.8, aa = r() * TAU; return [Math.cos(aa) * rr, Math.sin(aa) * rr, lerp(0.1, 0.17, r())] as [number, number, number]; }); }
    obs.push(o);
    z += P.gap * (0.8 + r() * 0.5);
  }
  const speed = (zz: number) => P.v0 * (1 + P.vVar * Math.sin(zz / 37) * (zz > grace ? 1 : 0));
  const spinAt = (t: number) => P.spin * t + (diff >= 4 ? 0.6 * Math.sin(t * 0.35) : 0);
  return { len: P.len, obs, speed, spinAt, lives: P.lives, grace, curve: P.curve, D: diff };
}
/** Engelin o anki toplam açısı (tüp dönüşü + kendi dönüşü). */
export const obRot = (tn: Tunnel, o: Ob, t: number) => tn.spinAt(t) + o.spin * t;
/** Kesitte serbest noktalar (örnekleme) */
export function freePoints(o: Ob, rot: number, step = 0.06) {
  const out: [number, number][] = [];
  for (let x = -R; x <= R; x += step) for (let y = -R; y <= R; y += step) if (Math.hypot(x, y) <= R - PR - 0.02 && !hit(o, x, y, rot, PR + 0.04)) out.push([x, y]);
  return out;
}
