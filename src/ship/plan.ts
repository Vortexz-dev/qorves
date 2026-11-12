// 2D iç plan: tır (iki güverte) + bağlı dorselerin odaları. Birim: metre. Ön taraf +x (sağ), sol yan y=0 (üst).
import { part, slots as allSlots, type ShipDoc, type TrailerDef, type Slot } from './sys';
import { roomArt, corArt, slug } from './art';
import { tierRooms, OPEN, isTanker, TRUCK } from './rooms';

export type RoomKind = 'cockpit' | 'lounge' | 'bunk' | 'wc' | 'hold' | 'engine' | 'core' | 'corridor' | 'cabin' | 'commons' | 'galley' | 'pantry' | 'turret' | 'armory' | 'server' | 'netrun' | 'studio' | 'desk' | 'meeting' | 'tank' | 'medbay' | 'cryo' | 'dig' | 'ore' | 'salvage' | 'scrap' | 'hidden' | 'fakewall' | 'bridge2' | 'hangar' | 'maint' | 'lab' | 'samples' | 'ramp' | 'armorlock';
export interface Room { id: string; name: string; f: number; x: number; y: number; w: number; h: number; owner: string; kind: RoomKind; img?: string; hold?: string; dashed?: boolean; walk?: boolean; lx?: number }
export interface Door { x: number; y: number; f: number; v: boolean; w: number; kind: 'door' | 'hatch' | 'ramp' | 'armored' | 'secret' }
export interface Mech { x: number; y: number; w: number; h: number; f: number; kind: 'gear' | 'locker' | 'tank' | 'roof'; label?: string }
export interface Hull { owner: string; f: number; x: number; y: number; w: number; h: number; label: string; nose?: boolean; gear?: GearStyle }
export type GearStyle = 'craft' | 'heavy' | 'sleek' | 'scrap';
/** İniş takımı biçimi markaya göre: zanaat (Gnistborn vb.), ağır (döküm/askerî), ince (kurumsal/medikal), derme çatma (hurdacı/kaçakçı). */
export function gearStyle(brand: string): GearStyle {
  if (/^(kz|ic|dk|mil|pc)/.test(brand)) return 'heavy';
  if (/^(ara|emt|hd|vm)/.test(brand)) return 'sleek';
  if (/^(kk|gh|sr)/.test(brand)) return 'scrap';
  return 'craft';
}
/** Merdiven: iki katı bağlar (floors), yalnız o katlarda görünür. */
export interface Stair { x: number; y: number; w: number; h: number; floors: [number, number] }
export interface SlotPin { key: string; f: number; x: number; y: number; slot: Slot }
export interface Plan { floors: string[]; hulls: Hull[]; rooms: Room[]; doors: Door[]; mechs: Mech[]; stairs: Stair[]; couplings: { x: number; y: number; w: number; h: number }[]; pins: SlotPin[]; bounds: { x0: number; x1: number; y0: number; y1: number } }

export const FLOORS = ['Alt güverte', 'Üst güverte', 'Köprü güvertesi'];
const W = 6, IN = 0.4, CY = 1.8, BOT = W - IN, GAP = 2;
/** Ölçüler (m): şasi ölçeği ve dorse boyu/eni boyuta göre. T3/T4 dorseler iki katlı. */
export const CAB_K: Record<string, number> = { T1: 1, T2: 1.15, T3: 1.3, T4: 1.5 };
const TLEN: Record<string, number> = { T1: 14, T2: 19, T3: 24, T4: 30 }, TWID: Record<string, number> = { T1: 6, T2: 6.8, T3: 7.6, T4: 8.6 };

/** Oda adı → tür + fotoğraf (public/img/ship/*.webp). */
export function kindOf(name: string): { kind: RoomKind; img?: string } {
  const n = name.toLocaleLowerCase('tr');
  const t: [RegExp, RoomKind, string?][] = [
    [/mekanik yedek kokpit|yedek kokpit/, 'bridge2', 'kokpit'], [/kokpit/, 'cockpit', 'kokpit'], [/oturma/, 'lounge', 'salon'], [/uyku/, 'bunk', 'ranza'], [/tuvalet/, 'wc', 'tuvalet'],
    [/motor/, 'engine', 'motor'], [/çekirdek/, 'core', 'cekirdek'], [/kamara/, 'cabin', 'ranzalar'], [/ortak alan/, 'commons', 'ortak'], [/mutfak/, 'galley', 'mutfak'], [/kiler/, 'pantry', 'cold'],
    [/taret/, 'turret', 'platform'], [/cephanelik/, 'armory', 'kilit'], [/sunucu/, 'server', 'sensor'], [/netrunner/, 'netrun', 'sensor'], [/stüdyo/, 'studio', 'salon'], [/yayın masası/, 'desk', 'sensor'],
    [/görüşme/, 'meeting', 'salon'], [/tank/, 'tank', 'tank'], [/revir/, 'medbay', 'lab'], [/kriyo/, 'cryo', 'cold'], [/kazı/, 'dig', 'bakim'], [/cevher/, 'ore', 'yuk'], [/kurtarma kolu/, 'salvage', 'bakim'],
    [/hurda/, 'scrap', 'yuk'], [/gizli bölme/, 'hidden', 'kilit'], [/sahte duvar/, 'fakewall'], [/hangar/, 'hangar', 'bakim'], [/bakım/, 'maint', 'bakim'], [/laboratuvar/, 'lab', 'lab'], [/örnek/, 'samples', 'sogutucu'],
    [/yükleme rampası/, 'ramp', 'yuk'], [/zırhlı kapı/, 'armorlock', 'kilit'], [/küçük ambar|kabin ambarı/, 'hold', 'depo'], [/ambar/, 'hold', 'yuk'],
  ];
  for (const [re, kind, img] of t) if (re.test(n)) return { kind, img };
  return { kind: 'hold', img: 'depo' };
}
/** Yeni odalarda (açık tür verilen) yedek genel fotoğraf. */
const KIMG: Partial<Record<RoomKind, string>> = { cockpit: 'kokpit', bridge2: 'kokpit', lounge: 'salon', bunk: 'ranza', wc: 'tuvalet', engine: 'motor', core: 'cekirdek', cabin: 'ranzalar', commons: 'ortak', galley: 'mutfak', pantry: 'cold', turret: 'platform', armory: 'kilit', server: 'sensor', netrun: 'sensor', studio: 'salon', desk: 'sensor', meeting: 'salon', tank: 'tank', medbay: 'lab', cryo: 'cold', dig: 'bakim', ore: 'yuk', salvage: 'bakim', scrap: 'yuk', hidden: 'kilit', hangar: 'bakim', maint: 'bakim', lab: 'lab', samples: 'sogutucu', ramp: 'yuk', armorlock: 'kilit', hold: 'yuk' };
const WEIGHT: Partial<Record<RoomKind, number>> = { hold: 3, hangar: 3, cabin: 2.2, lab: 2, medbay: 2, turret: 2, server: 1.6, studio: 1.8, dig: 1.8, ore: 2, scrap: 2.4, commons: 1.6, hidden: 0.7, fakewall: 0.35, netrun: 1, samples: 0.8, pantry: 0.8, ramp: 1, armorlock: 0.8, maint: 1.4, cryo: 1, desk: 1.2, meeting: 1.4, armory: 1.2, salvage: 1.2, bridge2: 1.6 };

export function layout(doc: ShipDoc): Plan {
  const P: Plan = { floors: FLOORS.slice(0, 2), hulls: [], rooms: [], doors: [], mechs: [], stairs: [], couplings: [], pins: [], bounds: { x0: 0, x1: 18, y0: 0, y1: W } };
  const R = (o: Omit<Room, 'kind' | 'img'> & { kind?: RoomKind; img?: string }) => { const k = kindOf(o.name); P.rooms.push({ kind: o.kind ?? k.kind, img: o.img ?? k.img, walk: true, ...o } as Room); };
  const z = doc.chassis, TT = TRUCK[z];
  let L = 18, TW = W;
  if (!TT) {
    // ---- T1 tır (belgedeki düzen): alt güverte
    P.hulls.push({ owner: 'truck', f: 0, x: 0, y: 0, w: 18, h: W, label: 'TIR · ALT GÜVERTE', nose: true, gear: 'craft' }, { owner: 'truck', f: 1, x: 2.4, y: 0, w: 15.6, h: W, label: 'TIR · ÜST GÜVERTE', nose: true });
    R({ id: 'cab_cor', name: 'Servis koridoru', f: 0, x: IN, y: IN, w: 14.6, h: CY - IN, owner: 'truck', kind: 'corridor', img: corArt('servis-koridoru'), lx: 8.75 });
    R({ id: 'cab_eng', name: 'Motor bölmesi', f: 0, x: IN, y: CY, w: 5.2, h: BOT - CY, owner: 'truck' });
    R({ id: 'cab_core', name: 'Çekirdek odası', f: 0, x: 5.6, y: CY, w: 4.6, h: BOT - CY, owner: 'truck' });
    R({ id: 'cab_hold', name: 'Kabin ambarı', f: 0, x: 10.2, y: CY, w: 4.8, h: BOT - CY, owner: 'truck', hold: 'cab' });
    P.mechs.push({ f: 0, x: 15, y: IN, w: 2.6, h: BOT - IN, kind: 'gear', label: 'Ön iniş takımı' });
    P.doors.push({ f: 0, x: 3, y: CY, v: false, w: 1, kind: 'door' }, { f: 0, x: 9.4, y: CY, v: false, w: 1, kind: 'door' }, { f: 0, x: 12.6, y: CY, v: false, w: 1.4, kind: 'door' }, { f: 0, x: IN, y: 1.1, v: true, w: 1, kind: 'hatch' });
    // üst güverte
    R({ id: 'cab_ckp', name: 'Kokpit', f: 1, x: 13.6, y: IN, w: 4, h: BOT - IN, owner: 'truck' });
    R({ id: 'cab_lng', name: 'Oturma alanı', f: 1, x: 7.2, y: IN, w: 6.4, h: BOT - IN, owner: 'truck', lx: 1.95 });
    R({ id: 'cab_cor2', name: 'Koridor', f: 1, x: 2.8, y: 2.4, w: 4.4, h: 1.2, owner: 'truck', kind: 'corridor', img: corArt('kabin-koridoru') });
    R({ id: 'cab_wc', name: 'Tuvalet', f: 1, x: 2.8, y: IN, w: 2.2, h: 2, owner: 'truck' });
    R({ id: 'cab_bunk', name: 'Uyku odası', f: 1, x: 2.8, y: 3.6, w: 4.4, h: BOT - 3.6, owner: 'truck' });
    P.mechs.push({ f: 1, x: 5, y: IN, w: 2.2, h: 2, kind: 'locker', label: 'Dolap' });
    P.doors.push({ f: 1, x: 13.6, y: 3, v: true, w: 1.2, kind: 'door' }, { f: 1, x: 7.2, y: 3, v: true, w: 1, kind: 'door' }, { f: 1, x: 3.9, y: 2.4, v: false, w: 0.9, kind: 'door' }, { f: 1, x: 5.4, y: 3.6, v: false, w: 1, kind: 'door' });
    P.stairs.push({ x: 7.3, y: IN + 0.05, w: 1.6, h: 1.3, floors: [0, 1] });
  } else {
    // ---- T2–T4 tır: daha uzun/geniş gövde, daha çok oda; T3–T4 iki sıra oda, T4 üç güverte
    L = TT.L; TW = TT.W; const bot = TW - IN, mid = (CY + bot) / 2, tz = z.toLowerCase();
    const art = (n: string, fb?: string) => corArt(`tir-${tz}--${slug(n)}`, fb);
    const TWT: Partial<Record<RoomKind, number>> = { engine: 1.4, core: 1.2, hold: 1.2, cabin: 1.3, lounge: 1.4, galley: 1.1, wc: 0.8, desk: 1.1 };
    if (TT.decks.length > 2) P.floors = FLOORS.slice(0, 3);
    TT.decks.forEach((d, f) => {
      P.hulls.push({ owner: 'truck', f, x: d.x0, y: 0, w: d.x1 - d.x0, h: TW, label: 'TIR · ' + FLOORS[f].toLocaleUpperCase('tr'), nose: f < 2, gear: f === 0 ? 'craft' : undefined });
      const rx0 = d.x0 + IN, rx1 = f === 0 ? L - 3.4 : d.ckp ? L - 4.6 : d.x1 - IN;
      R({ id: f ? `cab_cor${f + 1}` : 'cab_cor', name: d.cor, f, x: rx0, y: IN, w: rx1 - rx0, h: CY - IN, owner: 'truck', kind: 'corridor', img: art(d.cor, corArt(f ? 'kabin-koridoru' : 'servis-koridoru')), lx: (rx1 - rx0) / 2 + 1.5 });
      const rows = d.rows ?? 1;
      for (let r = 0; r < rows; r++) {
        const list = d.rooms.filter((q) => (q.row ?? 0) === r), y0 = rows === 1 ? CY : r ? mid : CY, y1 = rows === 1 ? bot : r ? bot : mid;
        const tot = list.reduce((a, q) => a + (TWT[q.kind ?? kindOf(q.n).kind] ?? 1), 0); let x = rx0;
        for (const q of list) { const k = q.kind ?? kindOf(q.n).kind, w = ((rx1 - rx0) * (TWT[k] ?? 1)) / tot;
          R({ id: q.id, name: q.n, f, x, y: y0, w, h: y1 - y0, owner: 'truck', kind: k, hold: q.hold, img: art(q.n, KIMG[k] ?? kindOf(q.n).img) });
          P.doors.push({ f, x: x + w / 2, y: y0, v: false, w: Math.min(1.2, w * 0.4), kind: k === 'armory' ? 'armored' : 'door' }); x += w; }
      }
      if (d.ckp) { R({ id: 'cab_ckp', name: 'Kokpit', f, x: L - 4.6, y: IN, w: 4.6 - IN, h: bot - IN, owner: 'truck', img: art('Kokpit', 'kokpit') }); P.doors.push({ f, x: L - 4.6, y: (IN + CY) / 2, v: true, w: 1, kind: 'door' }); }
      if (f === 0) { P.mechs.push({ f: 0, x: L - 3.2, y: IN, w: 2.6, h: bot - IN, kind: 'gear', label: 'Ön iniş takımı' }); P.doors.push({ f: 0, x: IN, y: 1.1, v: true, w: 1, kind: 'hatch' }); }
    });
    P.stairs.push({ x: 9, y: IN + 0.05, w: 1.6, h: 1.3, floors: [0, 1] });
    if (TT.decks.length > 2) P.stairs.push({ x: 13, y: IN + 0.05, w: 1.6, h: 1.3, floors: [1, 2] });
  }
  const pid = (id: string) => (id || '').replace(/^(eng|core|rx)_/, '');
  for (const r of P.rooms) { if (r.id === 'cab_eng') r.img = corArt('motor--' + pid(doc.engine), r.img); if (r.id === 'cab_core') r.img = corArt('cekirdek--' + pid(doc.core), r.img); }
  // ---- dorseler: boyuta göre boy/en, kademeyle oda sayısı artar; iki katlılarda üst kat ayrı odalardan oluşur
  let xr = 0, maxW = TW;
  doc.trailers.forEach((t, i) => {
    const d = part(t.id) as TrailerDef | null; if (!d) return;
    const base = (d as TrailerDef & { base?: string }).base ?? d.id, short = base.replace(/^trl_/, ''), TL = TLEN[d.size] ?? 14, Wt = TWID[d.size] ?? W, bot = Wt - IN;
    const { lo, up } = tierRooms(base, d.size, d.rooms), two = up.length > 0, open = OPEN.has(base), tank = isTanker(d.type);
    maxW = Math.max(maxW, Wt);
    const x1 = xr - GAP, x0 = x1 - TL; xr = x0;
    P.couplings.push({ x: x1, y: 0.55, w: GAP, h: 1.1 });
    const nm = `DORSE ${i + 1} · ${d.model.toLocaleUpperCase('tr')}${d.size !== 'T1' ? ' · ' + d.size : ''}`;
    P.hulls.push({ owner: t.k, f: 0, x: x0, y: 0, w: TL, h: Wt, label: nm + (two ? ' · ALT' : ''), gear: gearStyle(d.brand) });
    P.doors.push({ f: 0, x: x1 - IN, y: 1.1, v: true, w: 1, kind: 'hatch' });
    const ix0 = x0 + IN, ix1 = x1 - IN, stairX = ix1 - 2;
    type RR = { n: string; kind: RoomKind; img?: string };
    const rr = (q: { n: string; kind?: RoomKind }): RR => { const k = q.kind ?? kindOf(q.n).kind; return { n: q.n, kind: k, img: roomArt(base, q.n, q.kind ? KIMG[k] : kindOf(q.n).img) }; };
    const holdOf = (k: RoomKind) => (k === 'hold' || k === 'ore' || k === 'scrap' || k === 'ramp' || k === 'hidden' ? t.k : undefined);
    const doorK = (k: RoomKind): Door['kind'] => (k === 'hidden' ? 'secret' : k === 'armorlock' || k === 'armory' ? 'armored' : 'door');
    /** Bir sıra oda: x aralığına ağırlığa göre bölünür; kapı y'de (null = odalar arası geçiş). */
    const row = (f: number, list: RR[], xa: number, xb: number, y0: number, y1: number, doorY: number | null, pre: string) => {
      const tot = list.reduce((a, r) => a + (WEIGHT[r.kind] ?? 1), 0); let x = xa;
      list.forEach((r, j) => {
        const w = ((xb - xa) * (WEIGHT[r.kind] ?? 1)) / tot;
        R({ id: `${t.k}_${pre}${j}`, name: r.n, f, x, y: y0, w, h: y1 - y0, owner: t.k, kind: r.kind, hold: holdOf(r.kind), img: r.img, dashed: r.kind === 'hidden' || r.kind === 'fakewall', walk: r.kind !== 'fakewall' });
        if (r.kind !== 'fakewall') { if (doorY !== null) P.doors.push({ f, x: x + w / 2, y: doorY, v: false, w: Math.min(1.2, w * 0.5), kind: doorK(r.kind) }); else if (j) P.doors.push({ f, x, y: (y0 + y1) / 2, v: true, w: 1, kind: doorK(r.kind) }); }
        x += w;
      });
    };
    const loR = lo.map(rr);
    // ---- alt kat
    if (tank) {
      const acc = loR.find((r) => r.kind === 'tank') ?? loR[0], rest = loR.filter((r) => r !== acc);
      R({ id: t.k + '_0', name: acc.n, f: 0, x: ix0, y: IN, w: ix1 - ix0, h: CY - IN, owner: t.k, kind: 'tank', img: acc.img ?? 'tank' });
      const rw = 3.4; row(0, rest, ix0, ix0 + rw * rest.length, CY, bot, CY, 'x');
      P.mechs.push({ f: 0, x: ix0 + rw * rest.length + 0.3, y: CY + 0.2, w: ix1 - ix0 - rw * rest.length - 0.6, h: bot - CY - 0.4, kind: 'tank', label: 'Skarnit tankı' });
    } else {
      const ord = [...loR.filter((r) => r.kind !== 'hidden' && r.kind !== 'fakewall'), ...loR.filter((r) => r.kind === 'fakewall'), ...loR.filter((r) => r.kind === 'hidden')].reverse();
      if (!open) { R({ id: `${t.k}_cor`, name: 'Dorse koridoru', f: 0, x: ix0, y: IN, w: ix1 - ix0, h: CY - IN, owner: t.k, kind: 'corridor', img: corArt('dorse-koridoru--' + short) }); row(0, ord, ix0, ix1, CY, bot, CY, ''); }
      else row(0, ord, ix0, ix1 - (two ? 2.2 : 0), IN, bot, null, '');
    }
    // ---- üst kat: ayrı işlevli odalar; koridor alt kenarda, merdiven sahanlığı ön uçta (alt katın aynası değil)
    if (two) {
      P.hulls.push({ owner: t.k, f: 1, x: x0, y: 0, w: TL, h: Wt, label: nm + ' · ÜST' });
      const upR = up.map(rr), cb = bot - (CY - IN);
      R({ id: `${t.k}_land`, name: 'Merdiven sahanlığı', f: 1, x: ix1 - 2.2, y: IN, w: 2.2, h: bot - IN, owner: t.k, kind: 'corridor', img: roomArt(base, 'Merdiven sahanlığı') });
      if (open) row(1, upR, ix0, ix1 - 2.2, IN, bot, null, 'u');
      else { R({ id: `${t.k}_cor1`, name: 'Üst kat koridoru', f: 1, x: ix0, y: cb, w: ix1 - 2.2 - ix0, h: bot - cb, owner: t.k, kind: 'corridor', img: corArt('ust-koridor--' + short) }); row(1, upR, ix0, ix1 - 2.2, IN, cb, cb, 'u'); }
      P.doors.push({ f: 1, x: ix1 - 2.2, y: open ? Wt / 2 : (cb + bot) / 2, v: true, w: 1, kind: 'door' });
      P.stairs.push({ x: stairX, y: IN + 0.05, w: 1.6, h: 1.3, floors: [0, 1] });
    }
    const ramp = loR.some((r) => r.kind === 'ramp' || r.kind === 'hangar');
    P.doors.push({ f: 0, x: ix0, y: open ? Wt / 2 : (CY + bot) / 2, v: true, w: ramp ? 3.4 : 1.4, kind: ramp ? 'ramp' : 'door' });
  });
  if (doc.trailers.some((t) => { const d = part(t.id) as TrailerDef | null; return d && tierRooms((d as TrailerDef & { base?: string }).base ?? d.id, d.size, d.rooms).up.length; }) && P.floors.length < 2) P.floors = FLOORS.slice(0, 2);
  P.bounds = { x0: Math.min(0, xr), x1: L, y0: 0, y1: maxW };
  const sx = L / 18, sy = TW / W;
  // ---- yuva işaretleri
  const sl = allSlots(doc);
  const at: Record<string, [number, number, number]> = { truck_roof: [1, 10.4, 1.6], truck_flank_l: [0, 7.8, 0], truck_flank_r: [0, 7.8, W], truck_bay: [0, 13.6, 4.4], engine_mount: [0, 3, 3.9], core_mount: [0, 7.9, 3.9] };
  for (const s of sl) {
    if (at[s.key]) { const [f, x, y] = at[s.key]; P.pins.push({ key: s.key, f, x: x * sx, y: y * sy, slot: s }); continue; }
    if (s.owner === 'truck') { const ex: Record<string, [number, number, number]> = { truck_roof2: [1, 5.2, 1.6], truck_sh_l: [1, 12.6, 0], truck_sh_r: [1, 12.6, W], truck_nose: [0, 16.4, 3], truck_tail: [0, 0.4, 3], truck_bay2: [0, 11.6, 4.4], truck_bay3: [0, 7.9, 5.2] };
      const e = ex[s.key]; if (e) { P.pins.push({ key: s.key, f: e[0], x: e[1] * sx, y: e[2] * sy, slot: s }); continue; } }
    const h = P.hulls.find((x) => x.owner === s.owner); if (!h) continue;
    const mine = sl.filter((x) => x.owner === s.owner), n = mine.length, j = mine.indexOf(s);
    const px = h.x + h.w * ((j + 0.5) / n);
    P.pins.push({ key: s.key, f: 0, x: px, y: s.mount === 'İç' ? h.h / 2 + 0.6 : j % 2 ? h.h : 0, slot: s });
  }
  return P;
}
/** Bir noktanın yürünebilir bir odada olup olmadığı (jeton bırakma). */
export function roomAt(P: Plan, f: number, x: number, y: number) { return P.rooms.find((r) => r.f === f && r.walk !== false && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ?? null; }
