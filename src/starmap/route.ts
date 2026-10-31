// Rota hesaplayıcı: hiperhat yolu (gün + aktif olay gecikmeleri) ve doğrudan ışık-altı yolculuk (zaman genişlemesi).
import type { MapData, LaneData, SysData } from './scene';
import type { ActiveEvent } from '../lib/events';

/** Harita ölçeği: kanonda verilen iki uzaklık (Nys–Morwen ≈ 1,1 ıy; Aurum–Kestrel 0,6 ıy) harita koordinatlarıyla tutarsız.
 *  İkisinin geometrik ortalaması alındı: 1 harita birimi ≈ 0,0137 ışık yılı. Bu iki çift için kanon değeri kullanılır. */
export const LY_PER_UNIT = 0.0137;
const CANON: Record<string, number> = { 'sys-morwen|sys-nys': 1.1, 'sys-aurum|sys-kestrel': 0.6 };
export function distLy(a: SysData, b: SysData): { ly: number; canon: boolean } {
  const k = [a.id, b.id].sort().join('|');
  if (CANON[k]) return { ly: CANON[k], canon: true };
  return { ly: Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) * LY_PER_UNIT, canon: false };
}

type R = [number, number]; // en az–en çok (gün)
const num = (s: string) => Number(s.replace(',', '.'));
/** "2 gün", "6–9 gün" → [min,max]; geçilemezse null */
export function parseDays(s: string): R | null {
  const m = s.match(/(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*gün/);
  return m ? [num(m[1]), num(m[2] ?? m[1])] : null;
}
/** Olay metninden gecikme: "+1 gün", "+12–24 saat", "6–9 yerine 9–14 gün" (taban süreyi değiştirir) */
export function parseDelay(effect: string): { add?: R; set?: R } | null {
  const y = effect.match(/(\d+(?:\s*[–-]\s*\d+)?)\s*yerine\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*gün/);
  if (y) return { set: [num(y[2]), num(y[3] ?? y[2])] };
  const m = effect.match(/\+\s*(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*(gün|saat)/);
  if (!m) return null;
  const f = m[3] === 'saat' ? 1 / 24 : 1;
  return { add: [num(m[1]) * f, num(m[2] ?? m[1]) * f] };
}

export interface Hop { lane: LaneData; from: string; to: string; base: R; set?: R; danger: boolean }
export interface Delay { ev: ActiveEvent; add: R; where: string }
export interface LaneRoute { hops: Hop[]; base: R; delays: Delay[]; total: R; ly: number; avoided: boolean }

export function laneRoute(map: MapData, ok: (laneId: string, a: string, b: string) => boolean, from: string, to: string, ev: ActiveEvent[], avoidDanger: boolean): LaneRoute | null {
  const setOf = new Map<string, R>();
  for (const e of ev) if (e.lane) { const d = parseDelay(e.tpl.effect); if (d?.set) setOf.set(e.lane, d.set); }
  const adj = new Map<string, { l: LaneData; o: string; w: R }[]>();
  for (const l of map.lanes) {
    if (l.status !== 'open' && l.status !== 'danger') continue;
    if (avoidDanger && l.status === 'danger') continue;
    if (!ok(l.id, l.a, l.b)) continue;
    const w = setOf.get(l.id) ?? parseDays(l.days); if (!w) continue;
    for (const [x, y] of [[l.a, l.b], [l.b, l.a]]) { if (!adj.has(x)) adj.set(x, []); adj.get(x)!.push({ l, o: y, w }); }
  }
  // Dijkstra (ortalama süreye göre)
  const dist = new Map<string, number>([[from, 0]]), prev = new Map<string, { l: LaneData; p: string; w: R }>(), done = new Set<string>();
  for (;;) {
    let u: string | null = null, best = Infinity;
    for (const [k, v] of dist) if (!done.has(k) && v < best) { best = v; u = k; }
    if (u === null || u === to) break;
    done.add(u);
    for (const e of adj.get(u) ?? []) { const nd = best + (e.w[0] + e.w[1]) / 2; if (nd < (dist.get(e.o) ?? Infinity)) { dist.set(e.o, nd); prev.set(e.o, { l: e.l, p: u, w: e.w }); } }
  }
  if (!dist.has(to) || from === to) return null;
  const hops: Hop[] = [];
  for (let c = to; c !== from; ) { const p = prev.get(c)!; hops.unshift({ lane: p.l, from: p.p, to: c, base: parseDays(p.l.days) ?? p.w, set: setOf.get(p.l.id), danger: p.l.status === 'danger' }); c = p.p; }
  const base: R = [0, 0];
  for (const h of hops) { const w = h.set ?? h.base; base[0] += w[0]; base[1] += w[1]; }
  const onPath = new Set([from, ...hops.map((h) => h.to)]), laneIds = new Set(hops.map((h) => h.lane.id)), delays: Delay[] = [];
  for (const e of ev) {
    const d = parseDelay(e.tpl.effect); if (!d?.add) continue;
    if (e.lane ? laneIds.has(e.lane) : onPath.has(e.sys)) delays.push({ ev: e, add: d.add, where: e.lane ? 'hat' : 'sistem' });
  }
  const total: R = [base[0], base[1]];
  for (const d of delays) { total[0] += d.add[0]; total[1] += d.add[1]; }
  const S = new Map(map.systems.map((s) => [s.id, s]));
  const ly = hops.reduce((s, h) => s + distLy(S.get(h.from)!, S.get(h.to)!).ly, 0);
  return { hops, base, delays, total, ly, avoided: avoidDanger };
}

/** Doğrudan yolculuk: hız β (ışık hızına oran). Hızlanma açıksa 1 g ile hızlanıp ortada yavaşlamaya başlar.
 *  Dönüşler: evren (dış gözlemci) zamanı ve gemi (öz) zamanı, yıl cinsinden. */
export const G_LY_YR2 = 1.032; // 1 g ≈ 1,03 ıy/yıl²
export function direct(ly: number, beta: number, accel: boolean): { tU: number; tS: number; gamma: number; peak: number } {
  const gamma = 1 / Math.sqrt(1 - beta * beta);
  if (!accel) return { tU: ly / beta, tS: ly / beta / gamma, gamma, peak: beta };
  const a = G_LY_YR2, da = (gamma - 1) / a; // tam hıza ulaşana dek alınan yol
  if (2 * da >= ly) { // tepe hıza ulaşamadan ortada döner
    const h = ly / 2, g2 = 1 + a * h, tU = 2 * Math.sqrt(g2 * g2 - 1) / a, tS = 2 * Math.acosh(g2) / a;
    return { tU, tS, gamma: g2, peak: Math.sqrt(1 - 1 / (g2 * g2)) };
  }
  const phi = Math.atanh(beta), tAcc = Math.sinh(phi) / a, cruise = ly - 2 * da;
  return { tU: 2 * tAcc + cruise / beta, tS: 2 * phi / a + cruise / beta / gamma, gamma, peak: beta };
}

export function fmtDays(r: [number, number]): string {
  const f = (d: number) => (d < 1 ? `${Math.round(d * 24)} saat` : `${(Math.round(d * 10) / 10).toLocaleString('tr-TR')} gün`);
  return Math.abs(r[0] - r[1]) < 0.01 ? f(r[0]) : `${f(r[0])} – ${f(r[1])}`;
}
export function fmtYears(y: number): string {
  if (y < 1 / 12) return `${Math.max(1, Math.round(y * 365.25))} gün`;
  if (y < 1) return `${Math.round(y * 12 * 10) / 10} ay`.replace('.', ',');
  const yr = Math.floor(y), mo = Math.round((y - yr) * 12);
  return mo === 12 ? `${yr + 1} yıl` : mo ? `${yr} yıl ${mo} ay` : `${yr} yıl`;
}
