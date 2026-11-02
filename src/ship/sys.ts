/*
 * Demir Kervan gemi sistemi (beta v0.2) — veri odaklı. Kaynak: t1.json (ship_t1_catalog.json).
 * Yalnız T1 Outrider uygulanır; T2–T4 şasi/parça eklenince aynı kurallarla çalışır.
 */
import CAT from './t1.json' with { type: 'json' };
import { XENGINES, XCORES, XPRICE, sized, truckSlots, CAB, MAX_PART } from './tiers';
export const cat = CAT;
export type Mount = 'Dış' | 'İç' | 'Her ikisi' | 'Motor' | 'Çekirdek';
export interface Engine { id: string; brand: string; model: string; size: string; mass: number; thrust: number; power_draw: number; efficiency: number; legality: string; rarity?: string; note?: string }
export interface Core { id: string; brand: string; model: string; size: string; mass: number; power_output: number; skarnit_per_day?: number; fuel?: string; tech: string; legality: string; rarity?: string; note?: string }
export interface TrailerDef { id: string; type: string; brand: string; model: string; size: string; mass: number; capacity: number; hidden: number; power_draw: number; armor: number; slots: { size: string; mount: string }[]; rooms: string[]; legality: string; special: string; mobility_penalty: number }
export interface Addon { id: string; cat: string; brand: string; model: string; size: string; mount: string; mass: number; power: number; effect: string; req: string; legality: string; thrust: number; mobility: number; capacity: number }
export interface Chassis { id: string; name: string; chassis_mass: number; base_mobility: number; max_trailers: number; trailer_sizes: string[]; engine_rule: string; core_rule: string; max_slot_size: string; slots: string; cab_armor: number; implemented: boolean }
const T1TR = CAT.trailers as TrailerDef[];
export const ENGINES = [...(CAT.engines as Engine[]), ...XENGINES.map((x) => ({ ...x, price: XPRICE[x.id] }))], CORES = [...(CAT.cores as Core[]), ...XCORES.map((x) => ({ ...x, price: XPRICE[x.id] }))];
export const TRAILERS: TrailerDef[] = [...T1TR, ...(['T2', 'T3', 'T4'] as const).flatMap((z) => T1TR.map((t) => sized(t, z)))];
export const ADDONS = CAT.addons as Addon[], CHASSIS = (CAT.chassis as Chassis[]).map((c) => ({ ...c, implemented: true }));
export const BRAND: Record<string, string> = Object.fromEntries(CAT.brands.map((b) => [b.id, b.name]));
export const START = CAT.starting_ship;
export type Kind = 'engine' | 'core' | 'trailer' | 'addon';
export type Part = (Engine & { k: 'engine' }) | (Core & { k: 'core' }) | (TrailerDef & { k: 'trailer' }) | (Addon & { k: 'addon' });
const ALL = new Map<string, Part>([
  ...ENGINES.map((x) => [x.id, { ...x, k: 'engine' as const }] as const), ...CORES.map((x) => [x.id, { ...x, k: 'core' as const }] as const),
  ...TRAILERS.map((x) => [x.id, { ...x, k: 'trailer' as const }] as const), ...ADDONS.map((x) => [x.id, { ...x, k: 'addon' as const }] as const)]);
export const part = (id: string) => ALL.get(id) ?? null;
export const allParts = () => [...ALL.values()];

// ---------- durum (Firestore ship/main) ----------
export interface Cargo { id: string; name: string; mass: number; loc: string; hidden?: boolean; hazardous?: boolean }
export interface ShipDoc {
  rev: number; at: number; by: string; name: string; chassis: string; engine: string; core: string; skarnit: number;
  fit: Record<string, string>;            // yuva anahtarı → eklenti id
  trailers: { k: string; id: string }[];  // takılı dorseler (k: örnek anahtarı)
  inv: Record<string, number>;            // ortak tersane deposu: parça id → adet
  cargo: Cargo[];
}
export function startDoc(): ShipDoc {
  const inv: Record<string, number> = {}; for (const id of CAT.starting_inventory) inv[id] = (inv[id] ?? 0) + 1;
  return { rev: 1, at: Date.now(), by: '', name: START.name, chassis: START.chassis, engine: START.engine, core: START.core, skarnit: START.skarnit_start, fit: {}, trailers: [], inv, cargo: [] };
}
export const chassisOf = (s: ShipDoc) => CHASSIS.find((c) => c.id === s.chassis) ?? CHASSIS[0];
export interface Slot { key: string; owner: string; size: string; mount: Mount; label: string; idx: number }
/** Bütün yuvalar: tır (başlangıç gemisinden) + takılı dorselerinkiler. */
export function slots(s: ShipDoc): Slot[] {
  const ch = chassisOf(s), base = ch.id === 'T1' ? START.slots : truckSlots(ch.slots, MAX_PART[ch.id]);
  const out: Slot[] = base.map((x, i) => ({ key: x.id, owner: 'truck', size: x.size, mount: x.mount as Mount, label: x.label, idx: i }));
  for (const t of s.trailers) { const d = part(t.id) as TrailerDef | null; d?.slots.forEach((x, i) => out.push({ key: `${t.k}#${i}`, owner: t.k, size: x.size, mount: x.mount as Mount, label: `${x.mount} yuva ${i + 1}`, idx: i })); }
  return out;
}
export const addonSlots = (s: ShipDoc) => slots(s).filter((x) => x.mount !== 'Motor' && x.mount !== 'Çekirdek');

// ---------- hesap ----------
const rhu = (x: number) => Math.floor(x + 0.5);
const C = CAT.constants;
export interface Stats {
  mass: number; maxMass: number; load: number; thrust: number; powerDraw: number; powerOutput: number; mobility: number; mobilityRaw: number; band: string;
  deltaV: number; endurance: number | null; pilot: number; armor: number; shield: number; regen: number; skarnit: number; skarnitMax: number;
  holds: { loc: string; name: string; cap: number; used: number; hidden: number; hiddenUsed: number }[]; cargoUsed: number; cargoCap: number;
  slotsTruck: [number, number]; slotsTrailer: [number, number]; traits: Record<string, number>; warnings: string[];
}
const num = (re: RegExp, t: string) => { const m = t.match(re); return m ? +m[1] : 0; };
export function stats(s: ShipDoc): Stats {
  const ch = chassisOf(s), eng = part(s.engine) as Engine | null, core = part(s.core) as Core | null;
  const trs = s.trailers.map((t) => ({ ...t, d: part(t.id) as TrailerDef })).filter((t) => t.d);
  const adds = Object.entries(s.fit).map(([k, id]) => ({ k, p: part(id) })).filter((x) => x.p?.k === 'addon').map((x) => ({ k: x.k, a: x.p as Addon }));
  const cargoMass = s.cargo.reduce((a, c) => a + c.mass, 0);
  const mass = ch.chassis_mass + (eng?.mass ?? 0) + (core?.mass ?? 0) + trs.reduce((a, t) => a + t.d.mass, 0) + adds.reduce((a, x) => a + x.a.mass, 0) + cargoMass + s.skarnit;
  const thrust = (eng?.thrust ?? 0) + adds.reduce((a, x) => a + x.a.thrust, 0), maxMass = thrust, load = maxMass ? mass / maxMass : Infinity;
  const cab = CAB[ch.id] ?? CAB.T1;
  const powerDraw = cab.draw + (eng?.power_draw ?? 0) + adds.reduce((a, x) => a + x.a.power, 0) + trs.reduce((a, t) => a + t.d.power_draw, 0);
  const powerOutput = core?.power_output ?? 0;
  const pen = trs.reduce((a, t) => a + (t.d.mobility_penalty ?? C.trailer_mobility_penalty), 0);
  const mobilityRaw = ch.base_mobility * (1 - Math.min(load, 10) ** 2) + adds.reduce((a, x) => a + x.a.mobility, 0) - pen;
  const mobility = Math.max(0, Math.min(100, rhu(mobilityRaw)));
  const band = C.mobility_bands.find((b) => mobility >= b.min && mobility <= b.max)?.name ?? '';
  const deltaV = mass ? rhu(((eng?.efficiency ?? 0) * s.skarnit) / mass) : 0;
  const endurance = core?.skarnit_per_day ? rhu(s.skarnit / core.skarnit_per_day) : null;
  const all = [...adds.map((x) => x.a.effect), ...trs.map((t) => t.d.special)].join(' · ');
  const armor = ch.cab_armor + trs.reduce((a, t) => a + t.d.armor, 0) + adds.reduce((a, x) => a + num(/Armor \+(\d+)/, x.a.effect), 0);
  const shield = adds.reduce((a, x) => a + num(/Shield (\d+)/, x.a.effect), 0), regen = adds.reduce((a, x) => a + num(/Regen (\d+)/, x.a.effect), 0);
  const traits: Record<string, number> = {};
  for (const m of all.matchAll(/\b(EW|Scan|Accuracy|Comms|Healing|Mining|Salvage|Analysis|Broadcast|Diplomacy) \+(\d+)/g)) traits[m[1]] = (traits[m[1]] ?? 0) + +m[2];
  const holds = [{ loc: 'cab', name: 'Kabin ambarı', cap: cab.hold + adds.filter((x) => !x.k.includes('#')).reduce((a, x) => a + x.a.capacity, 0), used: 0, hidden: 0, hiddenUsed: 0 },
    ...trs.map((t) => ({ loc: t.k, name: t.d.model, cap: t.d.capacity + adds.filter((x) => x.k.startsWith(t.k + '#')).reduce((a, x) => a + x.a.capacity, 0), used: 0, hidden: t.d.hidden, hiddenUsed: 0 }))];
  for (const c of s.cargo) { const h = holds.find((x) => x.loc === c.loc) ?? holds[0]; if (c.hidden && h.hidden) h.hiddenUsed += c.mass; else h.used += c.mass; }
  const sl = slots(s).filter((x) => x.mount !== 'Motor' && x.mount !== 'Çekirdek'), filled = (o: (x: Slot) => boolean) => [sl.filter((x) => o(x) && s.fit[x.key]).length, sl.filter(o).length] as [number, number];
  const warnings: string[] = [];
  if (load > C.warn_load) warnings.push(`Load %${Math.round(load * 100)}: ağır yük.`);
  if (powerOutput && powerDraw / powerOutput > C.warn_power) warnings.push(`Power %${Math.round((powerDraw / powerOutput) * 100)}: sınıra yakın.`);
  if (mobility <= C.warn_mobility) warnings.push(`Mobility ${mobility}: ${band}.`);
  return { mass, maxMass, load, thrust, powerDraw, powerOutput, mobility, mobilityRaw, band, deltaV, endurance, pilot: Math.floor((mobility - 50) / 10), armor, shield, regen,
    skarnit: s.skarnit, skarnitMax: cab.tank, holds, cargoUsed: holds.reduce((a, h) => a + h.used, 0), cargoCap: holds.reduce((a, h) => a + h.cap, 0),
    slotsTruck: filled((x) => x.owner === 'truck'), slotsTrailer: filled((x) => x.owner !== 'truck'), traits, warnings };
}

// ---------- işlemler + doğrulama (Tablo 5.2 sırası) ----------
export type Op =
  | { t: 'fit'; slot: string; id: string } | { t: 'unfit'; slot: string }
  | { t: 'engine'; id: string } | { t: 'core'; id: string }
  | { t: 'attach'; id: string } | { t: 'detach'; k: string }
  | { t: 'cargo'; c: Cargo } | { t: 'uncargo'; id: string } | { t: 'chassis'; id: string };
export interface Res { ok: boolean; code?: string; msg?: string; next?: ShipDoc }
const SZ = (x: string) => +x.slice(1);
const nextChassis = (s: ShipDoc) => CHASSIS[CHASSIS.findIndex((c) => c.id === s.chassis) + 1]?.name ?? 'daha büyük';
const PLURAL: Record<string, string> = { Silah: 'Silahlar', İtici: 'İticiler', Zırh: 'Zırhlar', Sensör: 'Sensörler', Kalkan: 'Kalkanlar', EW: 'EW parçaları', Yardımcı: 'Yardımcı parçalar' };
const fail = (code: string, msg: string): Res => ({ ok: false, code, msg });
const clone = (s: ShipDoc): ShipDoc => JSON.parse(JSON.stringify(s));
const take = (s: ShipDoc, id: string) => { s.inv[id] = (s.inv[id] ?? 0) - 1; if (s.inv[id] <= 0) delete s.inv[id]; };
const give = (s: ShipDoc, id: string) => { s.inv[id] = (s.inv[id] ?? 0) + 1; };
export const mountOk = (a: Addon, sl: Slot) => a.mount === 'Her ikisi' ? sl.mount === 'Dış' || sl.mount === 'İç' : a.mount === sl.mount;
function mountMsg(a: Addon, sl: Slot) {
  if (sl.mount === 'Motor' || sl.mount === 'Çekirdek') return `${sl.label} yalnız ${sl.mount === 'Motor' ? 'Skarn Motoru' : 'güç çekirdeği'} alır.`;
  return a.mount === 'Dış' ? `${PLURAL[a.cat] ?? a.cat} yalnız Dış yuvaya takılır.` : `${a.model} yalnız ${a.mount} yuvaya takılır.`;
}
function reqMet(s: ShipDoc, a: Addon) {
  const r = a.req; if (!r || r === '—') return true;
  const trs = s.trailers.map((t) => part(t.id) as TrailerDef).filter(Boolean);
  const ew = trs.some((t) => t.type.startsWith('EW')), net = trs.some((t) => t.rooms.some((x) => /netrunner/i.test(x)));
  if (/^Skarn Çekirdeği/.test(r)) return (part(s.core) as Core | null)?.tech === 'skarn';
  if (/EW dorsesi ya da netrunner/.test(r)) return ew || net;
  if (/EW dorsesi/.test(r)) return ew;
  return true;
}
/** Son durum limitleri: kütle ve güç. */
function limits(prev: Stats, n: ShipDoc, removing: boolean, what: string, power = true): Res | null {
  const st = stats(n);
  // Zaten aşım varsa (ör. şasi büyütüldü) aşımı azaltan değişikliklere izin ver; yalnızca kötüleştiren reddedilir.
  const mEx = st.mass - st.maxMass, mEx0 = Math.max(0, prev.mass - prev.maxMass), pEx = st.powerDraw - st.powerOutput, pEx0 = Math.max(0, prev.powerDraw - prev.powerOutput);
  const swap = what === 'motor' || what === 'çekirdek'; // aşırı yüklü gemide motor/çekirdek değişimi serbest (çıkış yolu)
  if (mEx > 0 && mEx > mEx0 && !(swap && mEx0 > 0)) return removing ? fail('THRUST_TOO_LOW', `Bu ${what} sökülürse Max Mass aşılır (${st.mass} / ${st.maxMass} t). Önce yük boşaltın.`)
    : fail('MASS_LIMIT', `Takılamaz: Max Mass ${st.mass - st.maxMass} t aşılıyor (${st.mass} / ${st.maxMass} t).`);
  if (power && pEx > 0 && pEx > pEx0) return fail('POWER_LIMIT', `Takılamaz: Power ${st.powerDraw - st.powerOutput} aşılıyor (${st.powerDraw} / ${st.powerOutput}).`);
  return null;
}
export function apply(s0: ShipDoc, op: Op): Res {
  const s = clone(s0), ch = chassisOf(s), prev = stats(s0);
  const have = (id: string) => (s.inv[id] ?? 0) > 0;
  if (op.t === 'attach') {
    const d = part(op.id); if (!d || d.k !== 'trailer') return fail('NOT_FOUND', 'Dorse bulunamadı.'); if (!have(op.id)) return fail('NOT_OWNED', 'Bu dorse depoda yok.');
    if (!ch.trailer_sizes.includes(d.size)) return fail('TIER_MISMATCH', `Bu dorse ${d.size} boyutunda. ${ch.name} şasi yalnız ${ch.trailer_sizes.join(' / ')} dorse çeker.`);
    if (s.trailers.length >= ch.max_trailers) return fail('TRAILER_LIMIT', `Dorse sınırı dolu (${s.trailers.length} / ${ch.max_trailers}). Daha fazlası için ${nextChassis(s)} şasi gerekir.`);
    take(s, op.id); s.trailers.push({ k: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), id: op.id });
    return limits(prev, s, false, 'dorse') ?? { ok: true, next: s };
  }
  if (op.t === 'detach') {
    const i = s.trailers.findIndex((t) => t.k === op.k); if (i < 0) return fail('NOT_FOUND', 'Dorse takılı değil.');
    const ld = s.cargo.filter((c) => c.loc === op.k).reduce((a, c) => a + c.mass, 0); if (ld) return fail('CAPACITY_FULL', `Dorsede ${ld} t yük var. Ayırmadan önce yükü boşaltın.`);
    for (const k of Object.keys(s.fit)) if (k.startsWith(op.k + '#')) { give(s, s.fit[k]); delete s.fit[k]; }
    give(s, s.trailers[i].id); s.trailers.splice(i, 1);
    return limits(prev, s, true, 'dorse', false) ?? { ok: true, next: s };
  }
  if (op.t === 'engine' || op.t === 'core') {
    const d = part(op.id); if (!d || d.k !== op.t) return fail('NOT_FOUND', 'Parça bulunamadı.'); if (!have(op.id)) return fail('NOT_OWNED', 'Bu parça depoda yok.');
    const max = SZ(MAX_PART[ch.id] ?? 'S1'); // Tablo 4: T1 S1 · T2 S2 · T3 S3 · T4 S4 (tek parça)
    if (SZ(d.size) > max) return op.t === 'engine' ? fail('ENGINE_LIMIT', `${d.size} motor için en az ${nextChassis(s)} şasi gerekir.`) : fail('CORE_LIMIT', `${d.size} çekirdek için en az ${nextChassis(s)} şasi gerekir.`);
    if (op.t === 'core') { const mixed = false; if (mixed) return fail('MIXED_POWER', 'Skarn Çekirdeği ve insan reaktörü birlikte takılamaz (yalnız DM istisnası).'); }
    const old = op.t === 'engine' ? s.engine : s.core; take(s, op.id); if (old) give(s, old); if (op.t === 'engine') s.engine = op.id; else s.core = op.id;
    // çekirdek değişince Skarn Çekirdeği gerektiren eklentiler kontrol edilir
    if (op.t === 'core') for (const [k, id] of Object.entries(s.fit)) { const a = part(id) as Addon; if (a && !reqMet(s, a)) return fail('REQUIREMENT_MISSING', `${a.model} takılıyken bu çekirdek olmaz: ${a.model} için ${a.req} gerekir.`); void k; }
    return limits(prev, s, true, op.t === 'engine' ? 'motor' : 'çekirdek') ?? { ok: true, next: s };
  }
  if (op.t === 'fit') {
    const a = part(op.id); if (!a || a.k !== 'addon') return fail('NOT_FOUND', 'Eklenti bulunamadı.'); if (!have(op.id)) return fail('NOT_OWNED', 'Bu parça depoda yok.');
    const sl = slots(s).find((x) => x.key === op.slot); if (!sl) return fail('NO_FREE_SLOT', 'Yuva bulunamadı.');
    if (s.fit[sl.key]) return fail('NO_FREE_SLOT', `${sl.label} dolu. Önce takılı parçayı sökün.`);
    if (SZ(a.size) > SZ(sl.size)) return fail('NO_FREE_SLOT', `Bu yuva ${sl.size}. ${a.model} ${a.size} ya da daha büyük bir yuva ister.`);
    if (!mountOk(a, sl)) return fail('WRONG_MOUNT', mountMsg(a, sl));
    if (!reqMet(s, a)) return fail('REQUIREMENT_MISSING', `${a.model} için ${a.req} gerekir.`);
    take(s, a.id); s.fit[sl.key] = a.id;
    return limits(prev, s, false, 'parça') ?? { ok: true, next: s };
  }
  if (op.t === 'unfit') {
    const id = s.fit[op.slot]; if (!id) return fail('NOT_FOUND', 'Yuva zaten boş.'); const a = part(id) as Addon;
    delete s.fit[op.slot]; give(s, id);
    // kapasite düşüyorsa yük sığmalı
    const st = stats(s); for (const h of st.holds) if (h.used > h.cap) return fail('CAPACITY_FULL', `${h.name} dolu (${h.used} / ${h.cap} t). Önce yükü azaltın.`);
    return limits(prev, s, true, a?.cat === 'İtici' ? 'itici' : 'parça', false) ?? { ok: true, next: s };
  }
  if (op.t === 'cargo') {
    const st = stats(s), h = st.holds.find((x) => x.loc === op.c.loc); if (!h) return fail('NOT_FOUND', 'Ambar bulunamadı.');
    const hid = op.c.hidden && h.hidden; const used = (hid ? h.hiddenUsed : h.used) + op.c.mass, cap = hid ? h.hidden : h.cap;
    if (used > cap) return fail('CAPACITY_FULL', `${h.name}${hid ? ' gizli bölmesi' : ''} dolu (${used} / ${cap} t).`);
    s.cargo.push(op.c); return limits(prev, s, false, 'yük') ?? { ok: true, next: s };
  }
  if (op.t === 'chassis') {
    // Yalnız DM: şasi değişimi. Artık olmayan yuvalardaki parçalar depoya döner; uymayan dorse/motor varsa reddedilir.
    const nc = CHASSIS.find((c) => c.id === op.id); if (!nc) return fail('NOT_FOUND', 'Şasi bulunamadı.');
    if (s.trailers.length > nc.max_trailers) return fail('TRAILER_LIMIT', `${nc.name} en fazla ${nc.max_trailers} dorse çeker. Önce dorse ayırın.`);
    const bad = s.trailers.map((t) => part(t.id) as TrailerDef).find((d) => d && !nc.trailer_sizes.includes(d.size)); if (bad) return fail('TIER_MISMATCH', `${bad.model} (${bad.size}) ${nc.name} şasiye bağlanamaz. Önce ayırın.`);
    for (const id of [s.engine, s.core]) { const p = part(id); if (p && SZ(p.size) > SZ(MAX_PART[nc.id])) return fail('ENGINE_LIMIT', `${p.model} (${p.size}) ${nc.name} şasiye sığmaz. Önce değiştirin.`); }
    s.chassis = nc.id; const keys = new Map(slots(s).map((x) => [x.key, x]));
    for (const [k, id] of Object.entries(s.fit)) { const sl = keys.get(k), a = part(id) as Addon | null; if (!sl || !a || SZ(a.size) > SZ(sl.size) || !mountOk(a, sl)) { give(s, id); delete s.fit[k]; } }
    s.skarnit = Math.min(s.skarnit, (CAB[nc.id] ?? CAB.T1).tank);
    return { ok: true, next: s };
  }
  if (op.t === 'uncargo') { s.cargo = s.cargo.filter((c) => c.id !== op.id); return { ok: true, next: s }; }
  return fail('BAD_OP', 'Bilinmeyen işlem.');
}
/** Bir parçanın şu an takılabileceği yuvalar (ve takılamıyorsa ilk ret nedeni). */
export function fitInfo(s: ShipDoc, id: string, slot?: string): { ok: boolean; slots: string[]; msg?: string; code?: string } {
  const p = part(id); if (!p) return { ok: false, slots: [], msg: 'Bilinmeyen parça.' };
  if (p.k === 'trailer') { const r = apply({ ...s, inv: { ...s.inv, [id]: 1 } }, { t: 'attach', id }); return { ok: r.ok, slots: r.ok ? ['hitch'] : [], msg: r.msg, code: r.code }; }
  if (p.k === 'engine' || p.k === 'core') { const r = apply({ ...s, inv: { ...s.inv, [id]: 1 } }, { t: p.k, id }); return { ok: r.ok, slots: r.ok ? [p.k === 'engine' ? 'engine_mount' : 'core_mount'] : [], msg: r.msg, code: r.code }; }
  const cand = slot ? slots(s).filter((x) => x.key === slot) : addonSlots(s).filter((x) => !s.fit[x.key]);
  if (!cand.length) return { ok: false, slots: [], code: 'NO_FREE_SLOT', msg: `Boş ${p.size} yuvası yok. Bu parça ${p.size} ya da daha büyük bir yuva ister.` };
  const ok: string[] = []; let first: Res | null = null;
  const sorted = [...cand].sort((a, b) => SZ(a.size) - SZ(b.size));
  let fitOnly = true;
  for (const sl of sorted) { const r = apply({ ...s, inv: { ...s.inv, [id]: 1 } }, { t: 'fit', slot: sl.key, id }); if (r.ok) ok.push(sl.key); else { first ??= r; if (r.code !== 'WRONG_MOUNT' && r.code !== 'NO_FREE_SLOT') fitOnly = false; } }
  if (!ok.length && !slot && fitOnly) { const a = p as Addon; first = { ok: false, code: 'NO_FREE_SLOT', msg: `Uygun boş yuva yok. ${a.model} ${a.size} ya da daha büyük${a.mount === 'Her ikisi' ? ' bir' : ' bir ' + a.mount} yuva ister.` }; }
  return { ok: ok.length > 0, slots: ok, msg: first?.msg, code: first?.code };
}
export const nameOf = (id: string) => { const p = part(id); return p ? (p.k === 'trailer' && p.size !== 'T1' ? `${p.model} · ${p.size}` : p.model) : id; };
export const CAT_ICON: Record<string, string> = { Silah: '⌖', İtici: '⇶', Zırh: '▣', Sensör: '◎', Kalkan: '◠', EW: '⌁', Yardımcı: '✚', engine: '⚙', core: '◈', trailer: '▭' };
