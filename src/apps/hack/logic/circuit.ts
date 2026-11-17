/* Devre Akışı — döndürülebilir hat karoları. Kaynaktan tüm alıcılara kesintisiz enerji yolu kur. */
import { type Rng, rnd, ri, shuffle, dk, lerp, sigTime } from './common';
// bit maskesi: 1=Kuzey 2=Doğu 4=Güney 8=Batı
export const N = 1, E = 2, S = 4, W = 8;
export const rot = (m: number, k = 1) => { let x = m; for (let i = 0; i < ((k % 4) + 4) % 4; i++) x = ((x << 1) | (x >> 3)) & 15; return x; };
export interface Tile { m: number; r: number; kind: 'src' | 'sink' | 'wire' | 'block' }
export interface Circuit { w: number; h: number; tiles: Tile[]; src: number; sinks: number[]; time: number; minMoves: number }
export function params(diff: number, signal = 3) {
  const t = dk(diff);
  return { w: [5, 6, 6, 7, 8][diff - 1] ?? 6, h: [5, 5, 6, 6, 6][diff - 1] ?? 5, sinks: [1, 2, 2, 3, 3][diff - 1] ?? 2, blocks: [0, 1, 2, 3, 4][diff - 1] ?? 1, time: Math.round(lerp(90, 60, t) * sigTime(signal)) };
}
const DIRS = [[0, -1, N, S], [1, 0, E, W], [0, 1, S, N], [-1, 0, W, E]] as const;
export const eff = (t: Tile) => rot(t.m, t.r);
export function generate(diff: number, signal = 3, r: Rng = rnd): Circuit {
  const P = params(diff, signal);
  const { w, h } = P;
  for (let tries = 0; tries < 300; tries++) {
    const m = new Array(w * h).fill(0);
    const kind: Tile['kind'][] = new Array(w * h).fill('wire');
    const src = ri(r, 0, h - 1) * w; // sol kenar
    // rastgele kapsayan ağaç (DFS) tüm hücrelerde
    const seen = new Set<number>([src]); const stack = [src];
    const blocks = new Set<number>();
    while (blocks.size < P.blocks) { const b = ri(r, 0, w * h - 1); if (b !== src && b % w > 0) blocks.add(b); }
    blocks.forEach((b) => seen.add(b));
    while (stack.length) {
      const c = stack[stack.length - 1]!; const x = c % w, y = Math.floor(c / w);
      const nb = shuffle(r, DIRS.slice() as unknown as (typeof DIRS)[number][]).filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen.has(ny * w + nx); });
      if (!nb.length) { stack.pop(); continue; }
      const [dx, dy, a, b] = nb[0]!; const n = (y + dy) * w + x + dx;
      m[c] |= a; m[n] |= b; seen.add(n); stack.push(n);
    }
    // alıcılar: yapraklar arasından kaynağa uzak olanlar
    const leaves = m.map((v, i) => [v, i] as const).filter(([v, i]) => i !== src && !blocks.has(i) && [N, E, S, W].includes(v)).map(([, i]) => i);
    if (leaves.length < P.sinks) continue;
    const dist = (i: number) => Math.abs((i % w) - (src % w)) + Math.abs(Math.floor(i / w) - Math.floor(src / w));
    leaves.sort((a, b) => dist(b) - dist(a));
    const sinks = shuffle(r, leaves.slice(0, Math.max(P.sinks, Math.ceil(leaves.length / 2)))).slice(0, P.sinks);
    // gereksiz dalları buda: yalnız kaynaktan alıcılara giden yollar + biraz süs
    const keep = new Set<number>([src]);
    const par = new Map<number, number>(); const q = [src]; const vis = new Set([src]);
    while (q.length) { const c = q.shift()!; const x = c % w, y = Math.floor(c / w); for (const [dx, dy, a] of DIRS) { if (!(m[c] & a)) continue; const n = (y + dy) * w + x + dx; if (!vis.has(n)) { vis.add(n); par.set(n, c); q.push(n); } } }
    for (const s of sinks) { let c: number | undefined = s; while (c !== undefined) { keep.add(c); c = par.get(c); } }
    const mm = m.map((v, i) => {
      if (!keep.has(i)) return 0;
      const x = i % w, y = Math.floor(i / w); let o = 0;
      for (const [dx, dy, a, b] of DIRS) { const n = (y + dy) * w + x + dx; if ((v & a) && keep.has(n) && (m[n] & b)) o |= a; }
      return o;
    });
    // boş hücreleri yem karolarla doldur (yanıltıcı ama çözümü bozmaz)
    const tiles: Tile[] = mm.map((v, i) => {
      if (blocks.has(i)) return { m: 0, r: 0, kind: 'block' as const };
      if (i === src) return { m: v, r: 0, kind: 'src' as const };
      if (sinks.includes(i)) return { m: v, r: ri(r, 0, 3), kind: 'sink' as const };
      if (v) return { m: v, r: ri(r, 0, 3), kind: 'wire' as const };
      const dummy = [N | S, N | E, N | E | S, N | S][ri(r, 0, 3)]!;
      return { m: dummy, r: ri(r, 0, 3), kind: 'wire' as const };
    });
    // en az hamle (her karo doğru yöne en kısa tık sayısı; simetrikler için en kısası)
    let minMoves = 0;
    tiles.forEach((t, i) => { if (keep.has(i) && t.kind !== 'src') { let best = 4; for (let k = 0; k < 4; k++) if (rot(t.m, t.r + k) === mm[i]) { best = Math.min(best, k); } minMoves += best; } });
    if (minMoves < 3 + diff) continue;
    return { w, h, tiles, src, sinks, time: P.time, minMoves };
  }
  throw new Error('circuit gen');
}
/** Kaynaktan enerji alan hücreler. */
export function powered(c: Circuit): Set<number> {
  const { w, h, tiles } = c; const on = new Set<number>([c.src]); const q = [c.src];
  while (q.length) {
    const i = q.shift()!; const x = i % w, y = Math.floor(i / w); const m = eff(tiles[i]!);
    for (const [dx, dy, a, b] of DIRS) {
      if (!(m & a)) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx; const t = tiles[n]!; if (t.kind === 'block' || on.has(n)) continue;
      if (eff(t) & b) { on.add(n); q.push(n); }
    }
  }
  return on;
}
export const solved = (c: Circuit) => { const p = powered(c); return c.sinks.every((s) => p.has(s)); };
