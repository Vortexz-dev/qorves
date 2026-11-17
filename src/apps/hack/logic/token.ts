/* TOKENINE — üstteki yetki jetonunu parçalardan yeniden oluştur. Parça seçimi geri alınamaz; her seçim için süre sınırlı. */
import { type Rng, rnd, ri, shuffle, dk, lerp, sigTime } from './common';
// 4x6 kafes noktalarında kırık çizgi parçaları
export type Pt = [number, number];
export interface Piece { id: number; pts: Pt[] }
export interface Token { parts: number[] } // gereken parça kimlikleri
export interface Tokenine { pieces: Piece[]; tokens: Token[]; pick: number; noise: number; pool: number }
export function params(diff: number, signal = 3) {
  const t = dk(diff);
  return { tokens: [2, 2, 3, 3, 4][diff - 1] ?? 3, parts: [2, 2, 3, 3, 4][diff - 1] ?? 3, pick: Math.round(lerp(12, 7, t) * sigTime(signal) * 10) / 10, noise: [0, 0, 0.35, 0.6, 0.85][diff - 1] ?? 0, pool: 9 };
}
const GW = 4, GH = 6;
function randStroke(r: Rng): Pt[] {
  let x = ri(r, 0, GW), y = ri(r, 0, GH); const pts: Pt[] = [[x, y]];
  const len = ri(r, 2, 3);
  for (let i = 0; i < len; i++) {
    const opts: Pt[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = x + dx!, ny = y + dy!; if (nx >= 0 && ny >= 0 && nx <= GW && ny <= GH && !pts.some(([a, b]) => a === nx && b === ny)) opts.push([nx, ny]);
    }
    if (!opts.length) break; [x, y] = opts[Math.floor(r() * opts.length)]!; pts.push([x, y]);
  }
  return pts;
}
const sig = (p: Pt[]) => { const a = p.map((q) => q.join(',')).join(' '); const b = p.slice().reverse().map((q) => q.join(',')).join(' '); return a < b ? a : b; };
export function generate(diff: number, signal = 3, r: Rng = rnd): Tokenine {
  const P = params(diff, signal);
  const tokens: Token[] = []; let pieces: Piece[] = [];
  // her jeton için ayrı 9'luk havuz → oyun jeton başına yeni havuz gösterir
  const pools: Piece[][] = [];
  for (let k = 0; k < P.tokens; k++) {
    const seen = new Set<string>(); const pool: Piece[] = [];
    while (pool.length < P.pool) { const s = randStroke(r); const g = sig(s); if (seen.has(g)) continue; seen.add(g); pool.push({ id: k * 100 + pool.length, pts: s }); }
    pools.push(pool);
    tokens.push({ parts: shuffle(r, pool.map((p) => p.id)).slice(0, P.parts) });
    pieces = pieces.concat(pool);
  }
  return { pieces, tokens, pick: P.pick, noise: P.noise, pool: P.pool };
}
export const poolFor = (t: Tokenine, k: number) => t.pieces.filter((p) => Math.floor(p.id / 100) === k);
export const GRID = { w: GW, h: GH };
/** Parçaların oluşturduğu çizgi kümesi (sıra/yön önemsiz) — aynı görüntüyü veren farklı seçim de doğru sayılır. */
export function segSet(ps: Piece[]) {
  const s = new Set<string>();
  for (const p of ps) for (let i = 1; i < p.pts.length; i++) { const a = p.pts[i - 1]!.join(','), b = p.pts[i]!.join(','); s.add(a < b ? a + '|' + b : b + '|' + a); }
  return s;
}
export function matches(t: Tokenine, k: number, chosen: number[]) {
  const by = (ids: number[]) => segSet(t.pieces.filter((p) => ids.includes(p.id)));
  const a = by(t.tokens[k]!.parts), b = by(chosen);
  return a.size === b.size && [...a].every((x) => b.has(x));
}
