/* shiftSEQ — ağ düğümleri. Ev düğümünden çık, enfekte düğümleri Boşluk ile yok et. Saldırılar eve ulaşırsa (sen evde değilsen) bağlantı sağlığı düşer.
   Enfekte düğümün içindeyken o düğüm saldıramaz. Pil biterse eve dön; genişleyen nabız halkayla çakışınca Boşluk = tam şarj. */
import { type Rng, rnd, shuffle, dk, lerp } from './common';
export type NodeId = 'H' | 'T' | 'B' | 'L' | 'R' | 'TL' | 'BL' | 'TR' | 'BR';
export const POS: Record<NodeId, [number, number]> = { H: [0, 0], T: [0, -2], B: [0, 2], L: [-2, 0], R: [2, 0], TL: [-2, -1.5], BL: [-2, 1.5], TR: [2, -1.5], BR: [2, 1.5] };
// komşuluk: [w,a,s,d]
export const MOVES: Record<NodeId, Partial<Record<'w' | 'a' | 's' | 'd', NodeId>>> = {
  H: { w: 'T', s: 'B', a: 'L', d: 'R' }, T: { s: 'H' }, B: { w: 'H' },
  L: { w: 'TL', s: 'BL', d: 'H' }, R: { w: 'TR', s: 'BR', a: 'H' },
  TL: { s: 'L' }, BL: { w: 'L' }, TR: { s: 'R' }, BR: { w: 'R' },
};
export const TARGETS: NodeId[] = ['T', 'B', 'TL', 'BL', 'TR', 'BR'];
// enfekte düğümden eve giden yol
export const ROUTE: Record<string, NodeId[]> = { T: ['T', 'H'], B: ['B', 'H'], TL: ['TL', 'L', 'H'], BL: ['BL', 'L', 'H'], TR: ['TR', 'R', 'H'], BR: ['BR', 'R', 'H'] };
export interface Packet { id: number; from: NodeId; t: number; dur: number }
export interface ShiftState {
  at: NodeId; hp: number; bat: number; batMax: number; inf: Record<string, number>; infMax: number;
  packets: Packet[]; cd: Record<string, number>; pulse: number; lock: number; over: 0 | 1 | -1; time: number; dmg: number;
  P: ReturnType<typeof params>; seq: number; hits: number;
}
export function params(diff: number) {
  const t = dk(diff);
  return {
    infected: [2, 3, 3, 4, 5][diff - 1] ?? 3,
    nodeHp: [5, 6, 6, 7, 7][diff - 1] ?? 6,
    interval: lerp(7, 4.2, t),      // her enfekte düğümün saldırı aralığı (sn)
    travel: lerp(4.5, 3.0, t),        // paketin eve varış süresi (sn)
    dmg: [8, 9, 10, 11, 11][diff - 1] ?? 10, // eve ulaşan paket hasarı (%)
    batMax: 10,
    pulsePeriod: 1.6, window: lerp(0.32, 0.22, t), // şarj nabzı: periyot ve tam çakışma penceresi (sn)
    lockout: 1.6,
  };
}
export function init(diff: number, r: Rng = rnd): ShiftState {
  const P = params(diff);
  const inf: Record<string, number> = {}; const cd: Record<string, number> = {};
  shuffle(r, TARGETS.slice()).slice(0, P.infected).forEach((n, i) => { inf[n] = P.nodeHp; cd[n] = 2.5 + i * (P.interval / P.infected) + r() * 0.8; });
  return { at: 'H', hp: 100, bat: P.batMax, batMax: P.batMax, inf, infMax: P.nodeHp, packets: [], cd, pulse: 0, lock: 0, over: 0, time: 0, dmg: 0, P, seq: 1, hits: 0 };
}
/** nabız fazı 0..1; 1'e yakınken halka ana çerçeveyle çakışır */
export const pulsePhase = (s: ShiftState) => (s.pulse % s.P.pulsePeriod) / s.P.pulsePeriod;
export const inWindow = (s: ShiftState) => { const p = (s.pulse % s.P.pulsePeriod); return Math.abs(p - s.P.pulsePeriod * 0.8) <= s.P.window / 2; };
export function step(s: ShiftState, dt: number, r: Rng = rnd) {
  if (s.over) return;
  s.time += dt; s.pulse += dt; if (s.lock > 0) s.lock = Math.max(0, s.lock - dt);
  for (const n of Object.keys(s.inf)) {
    if (s.at === n) { s.cd[n] = Math.max(s.cd[n]!, 1.2); continue; } // içindeyken saldıramaz
    s.cd[n]! -= dt;
    if (s.cd[n]! <= 0) { s.packets.push({ id: s.seq++, from: n as NodeId, t: 0, dur: s.P.travel }); s.cd[n] = s.P.interval * (0.85 + r() * 0.3); }
  }
  for (const p of s.packets) p.t += dt;
  const arrived = s.packets.filter((p) => p.t >= p.dur);
  s.packets = s.packets.filter((p) => p.t < p.dur);
  for (const _ of arrived) { if (s.at !== 'H') { s.hp -= s.P.dmg; s.dmg++; } else s.hits++; }
  if (s.hp <= 0) { s.hp = 0; s.over = -1; }
}
export function move(s: ShiftState, k: 'w' | 'a' | 's' | 'd') { const n = MOVES[s.at][k]; if (n && !s.over) { s.at = n; return true; } return false; }
/** Boşluk: enfekte düğümde vur, evde şarj dene. */
export function space(s: ShiftState): 'hit' | 'kill' | 'empty' | 'charge' | 'miss' | 'locked' | 'none' {
  if (s.over) return 'none';
  if (s.at === 'H') {
    if (s.lock > 0) return 'locked';
    if (inWindow(s)) { s.bat = s.batMax; return 'charge'; }
    s.lock = s.P.lockout; return 'miss';
  }
  if (s.inf[s.at] === undefined) return 'none';
  if (s.bat <= 0) return 'empty';
  s.bat--; s.inf[s.at]!--;
  if (s.inf[s.at]! <= 0) { delete s.inf[s.at]; delete s.cd[s.at]; s.packets = s.packets.filter((p) => p.from !== s.at); if (!Object.keys(s.inf).length) s.over = 1; return 'kill'; }
  return 'hit';
}
/** a'dan b'ye ilk hamle (BFS) */
export function nav(a: NodeId, b: NodeId): 'w' | 'a' | 's' | 'd' | null {
  if (a === b) return null;
  const q: [NodeId, 'w' | 'a' | 's' | 'd' | null][] = [[a, null]]; const seen = new Set([a]);
  while (q.length) { const [n, f] = q.shift()!; for (const [k, m] of Object.entries(MOVES[n]) as ['w' | 'a' | 's' | 'd', NodeId][]) { if (seen.has(m)) continue; const ff = f ?? k; if (m === b) return ff; seen.add(m); q.push([m, ff]); } }
  return null;
}
