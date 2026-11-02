// 2D iç plan: tır (iki güverte) + bağlı dorselerin odaları. Birim: metre. Ön taraf +x (sağ), sol yan y=0 (üst).
import { part, slots as allSlots, type ShipDoc, type TrailerDef, type Slot } from './sys';

export type RoomKind = 'cockpit' | 'lounge' | 'bunk' | 'wc' | 'hold' | 'engine' | 'core' | 'corridor' | 'cabin' | 'commons' | 'galley' | 'pantry' | 'turret' | 'armory' | 'server' | 'netrun' | 'studio' | 'desk' | 'meeting' | 'tank' | 'medbay' | 'cryo' | 'dig' | 'ore' | 'salvage' | 'scrap' | 'hidden' | 'fakewall' | 'bridge2' | 'hangar' | 'maint' | 'lab' | 'samples' | 'ramp' | 'armorlock';
export interface Room { id: string; name: string; f: number; x: number; y: number; w: number; h: number; owner: string; kind: RoomKind; img?: string; hold?: string; dashed?: boolean; walk?: boolean; lx?: number }
export interface Door { x: number; y: number; f: number; v: boolean; w: number; kind: 'door' | 'hatch' | 'ramp' | 'armored' | 'secret' }
export interface Mech { x: number; y: number; w: number; h: number; f: number; kind: 'axle' | 'locker' | 'tank' | 'roof'; label?: string }
export interface Hull { owner: string; f: number; x: number; y: number; w: number; h: number; label: string; nose?: boolean }
export interface SlotPin { key: string; f: number; x: number; y: number; slot: Slot }
export interface Plan { floors: string[]; hulls: Hull[]; rooms: Room[]; doors: Door[]; mechs: Mech[]; stairs: { x: number; y: number; w: number; h: number }[]; couplings: { x: number; y: number; w: number; h: number }[]; pins: SlotPin[]; bounds: { x0: number; x1: number; y0: number; y1: number } }

export const FLOORS = ['Alt güverte', 'Üst güverte'];
const W = 6, IN = 0.4, CY = 1.8, BOT = W - IN, TL = 14, GAP = 2;

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
const WEIGHT: Partial<Record<RoomKind, number>> = { hold: 3, hangar: 3, cabin: 2.2, lab: 2, medbay: 2, turret: 2, server: 1.6, studio: 1.8, dig: 1.8, ore: 2, scrap: 2.4, commons: 1.6, hidden: 0.7, fakewall: 0.35, netrun: 1, samples: 0.8, pantry: 0.8, ramp: 1, armorlock: 0.8, maint: 1.4, cryo: 1, desk: 1.2, meeting: 1.4, armory: 1.2, salvage: 1.2, bridge2: 1.6 };

export function layout(doc: ShipDoc): Plan {
  const P: Plan = { floors: FLOORS, hulls: [], rooms: [], doors: [], mechs: [], stairs: [], couplings: [], pins: [], bounds: { x0: 0, x1: 18, y0: 0, y1: W } };
  const R = (o: Omit<Room, 'kind' | 'img'> & { kind?: RoomKind; img?: string }) => { const k = kindOf(o.name); P.rooms.push({ kind: o.kind ?? k.kind, img: o.img ?? k.img, walk: true, ...o } as Room); };
  // ---- tır: alt güverte
  P.hulls.push({ owner: 'truck', f: 0, x: 0, y: 0, w: 18, h: W, label: 'TIR · ALT GÜVERTE', nose: true }, { owner: 'truck', f: 1, x: 2.4, y: 0, w: 15.6, h: W, label: 'TIR · ÜST GÜVERTE', nose: true });
  R({ id: 'cab_cor', name: 'Servis koridoru', f: 0, x: IN, y: IN, w: 14.6, h: CY - IN, owner: 'truck', kind: 'corridor', img: undefined, lx: 8.75 });
  R({ id: 'cab_eng', name: 'Motor bölmesi', f: 0, x: IN, y: CY, w: 5.2, h: BOT - CY, owner: 'truck' });
  R({ id: 'cab_core', name: 'Çekirdek odası', f: 0, x: 5.6, y: CY, w: 4.6, h: BOT - CY, owner: 'truck' });
  R({ id: 'cab_hold', name: 'Kabin ambarı', f: 0, x: 10.2, y: CY, w: 4.8, h: BOT - CY, owner: 'truck', hold: 'cab' });
  P.mechs.push({ f: 0, x: 15, y: IN, w: 2.6, h: BOT - IN, kind: 'axle', label: 'Ön aks' });
  P.doors.push({ f: 0, x: 3, y: CY, v: false, w: 1, kind: 'door' }, { f: 0, x: 9.4, y: CY, v: false, w: 1, kind: 'door' }, { f: 0, x: 12.6, y: CY, v: false, w: 1.4, kind: 'door' }, { f: 0, x: IN, y: 1.1, v: true, w: 1, kind: 'hatch' });
  // ---- tır: üst güverte
  R({ id: 'cab_ckp', name: 'Kokpit', f: 1, x: 13.6, y: IN, w: 4, h: BOT - IN, owner: 'truck' });
  R({ id: 'cab_lng', name: 'Oturma alanı', f: 1, x: 7.2, y: IN, w: 6.4, h: BOT - IN, owner: 'truck', lx: 1.95 });
  R({ id: 'cab_cor2', name: 'Koridor', f: 1, x: 2.8, y: 2.4, w: 4.4, h: 1.2, owner: 'truck', kind: 'corridor', img: undefined });
  R({ id: 'cab_wc', name: 'Tuvalet', f: 1, x: 2.8, y: IN, w: 2.2, h: 2, owner: 'truck' });
  R({ id: 'cab_bunk', name: 'Uyku odası', f: 1, x: 2.8, y: 3.6, w: 4.4, h: BOT - 3.6, owner: 'truck' });
  P.mechs.push({ f: 1, x: 5, y: IN, w: 2.2, h: 2, kind: 'locker', label: 'Dolap' });
  P.doors.push({ f: 1, x: 13.6, y: 3, v: true, w: 1.2, kind: 'door' }, { f: 1, x: 7.2, y: 3, v: true, w: 1, kind: 'door' }, { f: 1, x: 3.9, y: 2.4, v: false, w: 0.9, kind: 'door' }, { f: 1, x: 5.4, y: 3.6, v: false, w: 1, kind: 'door' });
  P.stairs.push({ x: 7.3, y: IN + 0.05, w: 1.6, h: 1.3 });
  // ---- dorseler (alt güverte)
  let xr = 0;
  doc.trailers.forEach((t, i) => {
    const d = part(t.id) as TrailerDef | null; if (!d) return;
    const x1 = xr - GAP, x0 = x1 - TL; xr = x0;
    P.couplings.push({ x: x1, y: 0.55, w: GAP, h: 1.1 });
    P.hulls.push({ owner: t.k, f: 0, x: x0, y: 0, w: TL, h: W, label: `DORSE ${i + 1} · ${d.model.toLocaleUpperCase('tr')}` });
    P.doors.push({ f: 0, x: x1 - IN, y: 1.1, v: true, w: 1, kind: 'hatch' });
    const rs = d.rooms.map((n) => ({ n, ...kindOf(n) }));
    const ix0 = x0 + IN, ix1 = x1 - IN;
    if (rs.length === 1 && rs[0].kind === 'tank') {
      R({ id: t.k + '_0', name: rs[0].n, f: 0, x: ix0, y: IN, w: ix1 - ix0, h: CY - IN, owner: t.k });
      P.mechs.push({ f: 0, x: ix0 + 0.3, y: CY + 0.2, w: ix1 - ix0 - 0.6, h: BOT - CY - 0.4, kind: 'tank', label: 'Skarnit tankı' });
      P.doors.push({ f: 0, x: ix0, y: 1.1, v: true, w: 1, kind: 'hatch' });
      return;
    }
    // koridor (ön kapıdan arkaya), odalar altında, ağırlığa göre bölünür. Gizli bölmeler en arkada.
    const open = rs.length === 1 && (rs[0].kind === 'hangar' || rs[0].kind === 'hold' || rs[0].kind === 'scrap');
    if (!open) R({ id: t.k + '_cor', name: 'Dorse koridoru', f: 0, x: ix0, y: IN, w: ix1 - ix0, h: CY - IN, owner: t.k, kind: 'corridor', img: undefined });
    const ord = [...rs.filter((r) => r.kind !== 'hidden' && r.kind !== 'fakewall'), ...rs.filter((r) => r.kind === 'fakewall'), ...rs.filter((r) => r.kind === 'hidden')].reverse(); // arkadan öne: x0 → x1
    const tot = ord.reduce((a, r) => a + (WEIGHT[r.kind] ?? 1), 0); let x = ix0;
    ord.forEach((r, j) => {
      const w = ((ix1 - ix0) * (WEIGHT[r.kind] ?? 1)) / tot, y = open ? IN : CY, h = open ? BOT - IN : BOT - CY;
      const hold = r.kind === 'hold' || r.kind === 'ore' || r.kind === 'scrap' || r.kind === 'ramp' ? t.k : r.kind === 'hidden' ? t.k : undefined;
      R({ id: `${t.k}_${j}`, name: r.n, f: 0, x, y, w, h, owner: t.k, hold, dashed: r.kind === 'hidden' || r.kind === 'fakewall', walk: r.kind !== 'fakewall' });
      if (!open && r.kind !== 'fakewall') P.doors.push({ f: 0, x: x + w / 2, y: CY, v: false, w: Math.min(1.2, w * 0.5), kind: r.kind === 'hidden' ? 'secret' : r.kind === 'armorlock' || r.kind === 'armory' ? 'armored' : 'door' });
      x += w;
    });
    // arka kapı/rampa
    const ramp = rs.some((r) => r.kind === 'ramp' || r.kind === 'hangar');
    P.doors.push({ f: 0, x: ix0, y: open ? W / 2 : (CY + BOT) / 2, v: true, w: ramp ? 3.4 : 1.4, kind: ramp ? 'ramp' : 'door' });
  });
  P.bounds = { x0: Math.min(0, xr), x1: 18, y0: 0, y1: W };
  // ---- yuva işaretleri
  const sl = allSlots(doc);
  const at: Record<string, [number, number, number]> = { truck_roof: [1, 10.4, 1.6], truck_flank_l: [0, 7.8, 0], truck_flank_r: [0, 7.8, W], truck_bay: [0, 13.6, 4.4], engine_mount: [0, 3, 3.9], core_mount: [0, 7.9, 3.9] };
  for (const s of sl) {
    if (at[s.key]) { const [f, x, y] = at[s.key]; P.pins.push({ key: s.key, f, x, y, slot: s }); continue; }
    const h = P.hulls.find((x) => x.owner === s.owner); if (!h) continue;
    const mine = sl.filter((x) => x.owner === s.owner), n = mine.length, j = mine.indexOf(s);
    const px = h.x + h.w * ((j + 0.5) / n);
    P.pins.push({ key: s.key, f: 0, x: px, y: s.mount === 'İç' ? W / 2 + 0.6 : j % 2 ? W : 0, slot: s });
  }
  return P;
}
/** Bir noktanın yürünebilir bir odada olup olmadığı (jeton bırakma). */
export function roomAt(P: Plan, f: number, x: number, y: number) { return P.rooms.find((r) => r.f === f && r.walk !== false && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ?? null; }
