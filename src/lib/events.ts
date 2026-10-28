/*
 * Gerçek zamanlı yol olayları (PLAN §11). Sunucu yok: herkes aynı ortak tohumdan aynı olayları hesaplar.
 * Her sistemde 2 yuva; zaman 5 dk'lık dilimler; boş yuvada dilim başına başlama şansı; süre 1–12 dilim (5–60 dk).
 * Günlük çapa (288 dilim): son 12 dilimde başlama yok → her gün boş başlar, hesap her yerde tutarlı.
 * DM kancaları: world/events { overrides[], cleared[], disabled[], paused } — aktif = deterministik ⊕ overrides − cleared.
 */
import { backend, type WorldEvents } from './backend';
export interface Tpl { id: string; name: string; cat: string; where: string; effect: string; sev: number; freq: string; w: number; by: string; msg: string; sys: string[]; lanes: string[]; all: boolean }
export interface EvData { seed: string; cats: Record<string, string>; sev: Record<string, { label: string; color: string }>; templates: Tpl[] }
export interface ActiveEvent { key: string; tpl: Tpl; sys: string; lane?: string; start: number; end: number; forced?: boolean }
interface SysRef { id: string; name: string }
interface LaneRef { id: string; a: string; b: string }
const SLOT = 300_000, DAY = 288, P = [0.045, 0.02];
let data: EvData | null = null, world: WorldEvents | null = null;
const elig = new Map<string, { t: Tpl; w: number; lanes: string[] }[]>();

function hash(s: string) { // FNV-1a → [0,1)
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13; return (h >>> 0) / 4294967296;
}
export async function loadEvents(systems: SysRef[], lanes: LaneRef[]) {
  if (!data) data = await (await fetch(import.meta.env.BASE_URL + 'data/events.json')).json();
  world = await backend.worldEvents().catch(() => null);
  const dis = new Set(world?.disabled ?? []);
  elig.clear();
  for (const s of systems) {
    const list: { t: Tpl; w: number; lanes: string[] }[] = [];
    for (const t of data!.templates) {
      if (dis.has(t.id)) continue;
      const ln = t.lanes.filter((id) => { const l = lanes.find((x) => x.id === id); return l && (l.a === s.id || l.b === s.id); });
      const named = t.sys.includes(s.name);
      if (!named && !ln.length && !t.all) continue;
      let w = t.w * (named ? 3 : ln.length ? 2 : 1);
      if (t.sev >= 4) w *= 0.12;
      list.push({ t, w, lanes: ln });
    }
    elig.set(s.id, list);
  }
  return data!;
}
export const evData = () => data;
const CUSTOM: Tpl = { id: 'custom', name: 'Resmî Duyuru', cat: 'GUV', where: '', effect: '', sev: 2, freq: '', w: 0, by: 'Ortak Hat Yayın Ağı', msg: '', sys: [], lanes: [], all: false };
/** world/events canlı güncellemesi (DM paneli değiştirince harita anında görür). */
export function setWorldLive(w: WorldEvents | null) { world = w; }
function pick(sys: string, slot: number, j: number) {
  const list = elig.get(sys); if (!list?.length) return null;
  const tot = list.reduce((a, b) => a + b.w, 0); let r = hash(`${data!.seed}|${sys}|${slot}|${j}|t`) * tot;
  for (const c of list) { r -= c.w; if (r <= 0) return c; }
  return list[list.length - 1];
}
/** Şu an etkin olaylar (now: ms). */
export function activeAt(now: number, systems: SysRef[]): ActiveEvent[] {
  if (!data) return [];
  const seed = world?.seed ?? data.seed, tick = Math.floor(now / SLOT), d0 = Math.floor(tick / DAY) * DAY, out: ActiveEvent[] = [];
  if (!world?.paused) for (const s of systems) {
    const got: string[] = [];
    for (let slot = 0; slot < 2; slot++) {
      let busy = -1, cur: ActiveEvent | null = null;
      for (let j = d0; j <= tick; j++) {
        if (j <= busy || j % DAY >= DAY - 12) continue;
        if (hash(`${seed}|${s.id}|${slot}|${j}|p`) >= P[slot]) continue;
        const c = pick(s.id, slot, j); if (!c) continue;
        const dur = 1 + Math.floor(hash(`${seed}|${s.id}|${slot}|${j}|d`) * 12);
        const lane = c.lanes.length ? c.lanes[Math.floor(hash(`${seed}|${s.id}|${j}|l`) * c.lanes.length)] : undefined;
        cur = { key: `${s.id}:${slot}:${j}`, tpl: c.t, sys: s.id, lane, start: j * SLOT, end: (j + dur) * SLOT };
        busy = j + dur - 1;
      }
      if (cur && cur.end > now && !got.includes(cur.tpl.id)) { out.push(cur); got.push(cur.tpl.id); }
    }
  }
  const cleared = new Set(world?.cleared ?? []);
  const res = out.filter((e) => !cleared.has(e.key));
  for (const o of world?.overrides ?? []) {
    const base = data.templates.find((x) => x.id === o.tpl) ?? (o.tpl === 'custom' ? CUSTOM : null);
    if (!base || o.start > now || o.end <= now) continue;
    const t: Tpl = { ...base, id: o.tpl === 'custom' ? 'custom:' + o.start : base.id, name: o.name || base.name, msg: o.msg || base.msg, effect: o.effect ?? base.effect, by: o.by || base.by, sev: o.sev ?? base.sev, cat: o.cat || base.cat };
    res.push({ key: `ovr:${o.tpl}:${o.sys}:${o.start}`, tpl: t, sys: o.sys, lane: o.lane, start: o.start, end: o.end, forced: true });
  }
  return res;
}
