/* İhlal Protokolü — Cyberpunk 2077 kuralları: ilk seçim üst satırdan; sonra sütun/satır dönüşümlü. Ara bellek sınırlı. */
import { type Rng, rnd, ri, pick, shuffle, dk, lerp, sigTime } from './common';
export const CODES = ['1C', '55', 'BD', 'E9', '7A', 'FF'];
export const DAEMON_NAMES = ['ICEPICK', 'DATAMINE_V2', 'KANTAR.KÖPRÜ', 'SİS_KİLİDİ', 'NEURAL_BYPASS', 'GÜMRÜK.SPOOF'];
export interface Daemon { name: string; seq: string[] }
export interface Breach { n: number; grid: string[][]; buf: number; daemons: Daemon[]; time: number; solution: [number, number][] }
export function params(diff: number, signal = 3) {
  const t = dk(diff);
  return {
    n: diff <= 1 ? 5 : diff <= 3 ? 6 : 7,
    daemons: diff <= 2 ? 2 : 3,
    lens: diff <= 1 ? [2, 2] : diff === 2 ? [2, 3] : diff === 3 ? [2, 3, 3] : diff === 4 ? [3, 3, 3] : [3, 3, 4],
    slack: diff <= 2 ? 2 : 1,
    time: Math.round(lerp(75, 45, t) * sigTime(signal)),
  };
}
/** Yolu (r,c) dizisi; ilk adım satır 0, dönüşümlü eksen, tekrar yok. */
function randPath(r: Rng, n: number, len: number): [number, number][] | null {
  const used = new Set<string>(); const p: [number, number][] = [];
  let row = 0, col = ri(r, 0, n - 1), axis: 'row' | 'col' = 'col';
  p.push([row, col]); used.add(row + ',' + col);
  for (let k = 1; k < len; k++) {
    const opts: [number, number][] = [];
    for (let i = 0; i < n; i++) { const c: [number, number] = axis === 'col' ? [i, col] : [row, i]; if (!used.has(c[0] + ',' + c[1])) opts.push(c); }
    if (!opts.length) return null;
    const c = pick(r, opts); p.push(c); used.add(c[0] + ',' + c[1]); [row, col] = c; axis = axis === 'col' ? 'row' : 'col';
  }
  return p;
}
export function generate(diff: number, signal = 3, r: Rng = rnd): Breach {
  const P = params(diff, signal);
  for (let tries = 0; tries < 200; tries++) {
    const daemons: Daemon[] = shuffle(r, DAEMON_NAMES.slice()).slice(0, P.daemons).map((name, i) => ({ name, seq: Array.from({ length: P.lens[i]! }, () => pick(r, CODES)) }));
    const total = daemons.reduce((a, d) => a + d.seq.length, 0);
    const buf = total + P.slack;
    const path = randPath(r, P.n, total); if (!path) continue;
    const grid = Array.from({ length: P.n }, () => Array.from({ length: P.n }, () => pick(r, CODES)));
    const flat = daemons.flatMap((d) => d.seq);
    path.forEach(([y, x], i) => (grid[y]![x] = flat[i]!));
    const b: Breach = { n: P.n, grid, buf, daemons, time: P.time, solution: path };
    return b; // yol tohumlandığı için çözüm garanti (testler solve() ile ayrıca doğrular)
  }
  throw new Error('breach gen');
}
export const has = (buf: string[], seq: string[]) => { const a = buf.join(' '), s = seq.join(' '); return (' ' + a + ' ').includes(' ' + s + ' '); };
/** Tüm daemonları ara belleğe sığdıran en kısa yol (DFS, sınırlı derinlik). */
export function solve(b: Breach): [number, number][] | null {
  const n = b.n; let best: [number, number][] | null = null;
  const used = new Set<string>(); const path: [number, number][] = []; const buf: string[] = [];
  function rec(axis: 'row' | 'col', row: number, col: number) {
    if (b.daemons.every((d) => has(buf, d.seq))) { if (!best || path.length < best.length) best = path.slice(); return true; }
    if (buf.length >= b.buf || (best && path.length >= best.length - 1)) return false;
    for (let i = 0; i < n; i++) {
      const [y, x] = axis === 'row' ? [row, i] : [i, col];
      const k = y + ',' + x; if (used.has(k)) continue;
      used.add(k); path.push([y, x]); buf.push(b.grid[y]![x]!);
      rec(axis === 'row' ? 'col' : 'row', y, x);
      used.delete(k); path.pop(); buf.pop();
    }
    return false;
  }
  rec('row', 0, 0);
  return best;
}
