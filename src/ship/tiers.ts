/*
 * T2–T4 genişletmesi (belge v0.2 §8: Tablo 8.1 dorse boyutları, Tablo 8.2 büyük motor/çekirdekler, Tablo 4 şasiler).
 * Belgede olmayan değerler (güç çekişi, verim, fiyat, kabin ambarı, Skarnit tankı, büyük dorse yuvaları/cezası) BETA tahminidir.
 * Ad, marka, model ve kademe adları belgedeki gibi kalır (çevrilmez).
 */
import type { Engine, Core, TrailerDef } from './sys';
export const MULT: Record<string, number> = { T1: 1, T2: 1.8, T3: 3, T4: 5 };          // Tablo 8.1
export const MAX_PART: Record<string, string> = { T1: 'S1', T2: 'S2', T3: 'S3', T4: 'S4' }; // Tablo 4: motor/çekirdek tek parça üst sınırı
/** Şasi başına kabin değerleri (T1 belgeden; T2–T4 tahmin: Tablo 8.1 çarpanı). */
export const CAB: Record<string, { hold: number; tank: number; draw: number }> = {
  T1: { hold: 15, tank: 10, draw: 15 }, T2: { hold: 27, tank: 18, draw: 20 }, T3: { hold: 45, tank: 30, draw: 30 }, T4: { hold: 75, tank: 50, draw: 45 },
};
// Tablo 8.2 (üretici: Gnistborn Motor Evi). Mass/Thrust/Power Output belgeden; diğerleri tahmin.
export const XENGINES: Engine[] = [
  { id: 'eng_tempest_forge', brand: 'gn', model: 'Tempest Forge', size: 'S2', mass: 26, thrust: 380, power_draw: 35, efficiency: 620, legality: 'Yasal', rarity: 'Nadir', note: 'S2 Skarn Motoru; Longhaul için yapılmış uzun yol motoru.' },
  { id: 'eng_magnetar_heart', brand: 'gn', model: 'Magnetar Heart', size: 'S3', mass: 42, thrust: 650, power_draw: 60, efficiency: 640, legality: 'Yasal', rarity: 'Çok nadir', note: 'S3 Skarn Motoru; Juggernaut sınıfı ağır çekici.' },
  { id: 'eng_brute_voyage', brand: 'gn', model: 'Brute Voyage', size: 'S4', mass: 66, thrust: 1100, power_draw: 95, efficiency: 660, legality: 'Yasal', rarity: 'Efsanevi', note: 'S4 Skarn Motoru; yalnız Leviathan taşıyabilir.' },
];
export const XCORES: Core[] = [
  { id: 'core_kilnheart', brand: 'gn', model: 'Kilnheart', size: 'S2', mass: 14, power_output: 180, skarnit_per_day: 0.35, legality: 'Yasal', rarity: 'Nadir', tech: 'skarn', note: 'S2 Skarn Çekirdeği.' },
  { id: 'core_hearthstar', brand: 'gn', model: 'Hearthstar', size: 'S3', mass: 24, power_output: 320, skarnit_per_day: 0.6, legality: 'Yasal', rarity: 'Çok nadir', tech: 'skarn', note: 'S3 Skarn Çekirdeği.' },
  { id: 'core_allfathers_ember', brand: 'gn', model: "Allfather's Ember", size: 'S4', mass: 38, power_output: 550, skarnit_per_day: 1, legality: 'Yasal', rarity: 'Efsanevi', tech: 'skarn', note: 'S4 Skarn Çekirdeği.' },
];
export const XPRICE: Record<string, number> = { eng_tempest_forge: 260000, eng_magnetar_heart: 720000, eng_brute_voyage: 1900000, core_kilnheart: 240000, core_hearthstar: 650000, core_allfathers_ember: 1700000 };
const UP: Record<string, string> = { S1: 'S2', S2: 'S3', S3: 'S3' };
/** Bir T1 dorse modelinin büyük boyutu: aynı marka/model/tip/odalar; kütle ve kapasite Tablo 8.1 çarpanıyla, yuvalar 8.1 aralığında. */
export function sized(t: TrailerDef, size: 'T2' | 'T3' | 'T4'): TrailerDef {
  const m = MULT[size], n = size === 'T2' ? 1 : size === 'T3' ? 2 : 3;
  let sl = t.slots.map((x) => ({ ...x }));
  for (let i = 0; i < n; i++) sl.push({ ...t.slots[i % t.slots.length] });
  sl[0].size = UP[sl[0].size] ?? sl[0].size;                                   // T2+: ilk yuva bir boy büyür
  if (size !== 'T2') sl[0].size = 'S3';                                         // T3/T4: bir S3 yuva
  if (size === 'T4') sl = sl.map((x) => ({ ...x, size: x.size === 'S1' ? 'S2' : x.size }));  // T4: S2–S3
  const r = (x: number) => Math.round(x * m);
  return { ...t, id: `${t.id}__${size.toLowerCase()}`, size, mass: r(t.mass), capacity: r(t.capacity), hidden: r(t.hidden), power_draw: Math.round(t.power_draw * (1 + (m - 1) * 0.6)),
    armor: t.armor ? t.armor + n : 0, slots: sl, price: (t as TrailerDef & { price?: number }).price ? Math.round((t as TrailerDef & { price: number }).price * m * 1.3) : null, mobility_penalty: size === 'T2' ? 6 : size === 'T3' ? 8 : 10, base: t.id } as unknown as TrailerDef;
}
/** Tablo 4 "Tır yuva düzeni" metninden tır yuvaları. Anahtarlar kademeler arasında korunur (T1 → T2 geçişte takılı parçalar yerinde kalır). */
export function truckSlots(rule: string, eng: string) {
  const out: { id: string; size: string; mount: string; label: string }[] = [];
  const big = [['truck_roof', 'Tavan'], ['truck_roof2', 'Arka tavan'], ['truck_sh_l', 'Sol omuz'], ['truck_sh_r', 'Sağ omuz'], ['truck_nose', 'Burun'], ['truck_tail', 'Kuyruk']];
  const side = [['truck_flank_l', 'Sol yan'], ['truck_flank_r', 'Sağ yan']], bay = [['truck_bay', 'Kabin bölmesi'], ['truck_bay2', 'Kabin bölmesi 2'], ['truck_bay3', 'Kabin bölmesi 3']];
  let bi = 0, si = 0, ii = 0;
  const parts = [...rule.matchAll(/(\d+)\s*×\s*(S\d)\s*(Dış|İç)/g)].map((m) => ({ n: +m[1], size: m[2], mount: m[3] }));
  for (const p of parts) for (let i = 0; i < p.n; i++) {
    const [id, label] = p.mount === 'İç' ? bay[ii++] : p.size === 'S1' && si < 2 ? side[si++] : big[bi++];
    out.push({ id, size: p.size, mount: p.mount, label });
  }
  out.push({ id: 'engine_mount', size: eng, mount: 'Motor', label: 'Motor bölmesi' }, { id: 'core_mount', size: eng, mount: 'Çekirdek', label: 'Çekirdek odası' });
  return out;
}
