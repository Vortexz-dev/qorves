/* Hack minioyunları: ortak yardımcılar. Mantık saf TS — tarayıcısız test/çözücü betikleri de kullanır. */
export type Rng = () => number;
export const rnd: Rng = Math.random;
export function seeded(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const ri = (r: Rng, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
export const pick = <T>(r: Rng, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
export function shuffle<T>(r: Rng, xs: T[]) { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; } return xs; }
/** 1–5 zorluk → 0..1 */
export const dk = (d: number) => (Math.max(1, Math.min(5, d)) - 1) / 4;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Düşük sinyal süreyi biraz kısar (en fazla %15) — zorluk ayrıca effectiveDiff ile yükselir. */
export const sigTime = (signal: number) => 1 - Math.max(0, 3 - Math.max(1, Math.min(5, signal))) * 0.05;
