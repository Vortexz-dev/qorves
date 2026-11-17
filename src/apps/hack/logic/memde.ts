/* memDEALLOCATER — en alttaki satıra bak: sol yeşil → A/←, sağ yeşil → D/→, ikisi yeşil → Boşluk. */
import { type Rng, rnd, dk, lerp, sigTime } from './common';
export type Row = 'L' | 'R' | 'B'; // hangi taraf yeşil (geçilebilir)
export interface Memde { need: number; penalty: number; prompt: boolean; time: number; rows: Row[] }
export function params(diff: number, signal = 3) {
  const t = dk(diff);
  return { need: Math.round(lerp(16, 28, t)), penalty: diff <= 2 ? 1 : diff <= 4 ? 2 : 3, prompt: diff <= 2, time: Math.round(lerp(40, 42, t) * sigTime(signal)) };
}
export function genRow(r: Rng = rnd): Row { const x = r(); return x < 0.38 ? 'L' : x < 0.76 ? 'R' : 'B'; }
export const keyFor = (row: Row) => (row === 'L' ? 'left' : row === 'R' ? 'right' : 'space');
export function generate(diff: number, signal = 3, r: Rng = rnd): Memde {
  const P = params(diff, signal);
  return { ...P, rows: Array.from({ length: 400 }, () => genRow(r)) };
}
/** satır için ikili dizi doku (her yarım 13 karakter) */
export function bits(r: Rng = rnd, n = 13) { let s = ''; for (let i = 0; i < n; i++) s += r() < 0.5 ? '0' : '1'; return s; }
