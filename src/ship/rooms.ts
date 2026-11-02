/**
 * Kademe ve kat oda düzenleri (beta v0.2'de yok — non-canon öneri).
 * T1 odaları belgedeki gibi kalır; T2 bir alt kat odası ekler, T3 iki katlıdır (üst kat ayrı işlevli odalar),
 * T4 alt ve üst kata birer oda daha ekler. T2'de yalnız birkaç pahalı özel dorse iki katlıdır (daha ağır).
 */
import type { RoomKind } from './plan';
type R = [string, RoomKind];
interface TR { t1?: R; t2: R; up: [R, R]; t4: R; t4up: R }
export const TROOMS: Record<string, TR> = {
  harvest_hauler: { t2: ['Yük asansörü', 'ramp'], up: [['Konteyner rafları', 'hold'], ['Yük kontrol odası', 'desk']], t4: ['Soğuk zincir bölmesi', 'pantry'], t4up: ['Mürettebat dinlenme odası', 'commons'] },
  bulwark_freight: { t2: ['Kasa odası', 'armorlock'], up: [['Zırhlı gözetleme odası', 'turret'], ['Değerli yük kasası', 'hold']], t4: ['Muhafız odası', 'armory'], t4up: ['Mühürlü arşiv', 'samples'] },
  lantern_runner: { t2: ['Branda altı ambar', 'hold'], up: [['Üst yük platformu', 'hold'], ['Fenerci kulübesi', 'cabin']], t4: ['Tüccar tezgâhı', 'meeting'], t4up: ['Sinyal feneri odası', 'desk'] },
  emberwood_lodge: { t2: ['Banyo', 'wc'], up: [['Çatı katı kamaraları', 'cabin'], ['Okuma köşesi', 'lounge']], t4: ['Sauna', 'commons'], t4up: ['Kış bahçesi', 'lab'] },
  commissary_block: { t2: ['Yemekhane', 'commons'], up: [['Personel kamaraları', 'cabin'], ['Çamaşırhane', 'maint']], t4: ['Soğuk hava deposu', 'pantry'], t4up: ['Yönetici kamarası', 'cabin'] },
  forgefire_bastion: { t2: ['Mühimmat asansörü', 'armory'], up: [['Atış kontrol odası', 'desk'], ['Nişancı yuvası', 'turret']], t4: ['Silah atölyesi', 'maint'], t4up: ['Komuta kulesi', 'bridge2'] },
  wolfback: { t2: ['Kurt çeliği zırhlığı', 'armory'], up: [['İkinci taret yuvası', 'turret'], ['Topçu dinlenme odası', 'cabin']], t4: ['Dökümhane bölmesi', 'maint'], t4up: ['Sürü komuta odası', 'bridge2'] },
  bonespike: { t2: ['Ganimet deposu', 'hold'], up: [['Keskin nişancı yuvası', 'turret'], ['Hurda zırh atölyesi', 'maint']], t4: ['Korsan meyhanesi', 'commons'], t4up: ['Kaptan köşkü', 'cabin'] },
  blindspot: { t2: ['Soğutma odası', 'server'], up: [['Sinyal tarama odası', 'netrun'], ['Göz izleme merkezi', 'desk']], t4: ['Yedek sunucu odası', 'server'], t4up: ['Kuantum şifre odası', 'netrun'] },
  nameless: { t2: ['Kayıtsız terminal odası', 'netrun'], up: [['Karanlık ağ odası', 'server'], ['Uyuma bölmesi', 'bunk']], t4: ['Kaçak donanım deposu', 'hold'], t4up: ['İz silme odası', 'netrun'] },
  spotlight_studio: { t2: ['Makyaj odası', 'meeting'], up: [['Kurgu odası', 'desk'], ['İkinci yatak odası stüdyosu', 'studio']], t4: ['Dekor deposu', 'hold'], t4up: ['Yıldız kamarası', 'cabin'] },
  beacon_voice: { t1: ['Yatak odası stüdyosu', 'studio'], t2: ['Arşiv odası', 'samples'], up: [['Verici odası', 'server'], ['Misafir kamarası', 'cabin']], t4: ['Kayıt stüdyosu', 'studio'], t4up: ['Fener kulesi odası', 'desk'] },
  molten_river: { t2: ['Pompa odası', 'maint'], up: [['Tank üstü bakım geçidi', 'maint'], ['Isı kontrol odası', 'desk']], t4: ['Rün mühür odası', 'samples'], t4up: ['Yakıt analiz odası', 'lab'] },
  black_drip: { t2: ['Kaçak vana odası', 'maint'], up: [['Üst sızdırma geçidi', 'maint'], ['Gizli tank bölmesi', 'hidden']], t4: ['Seyreltme odası', 'lab'], t4up: ['Sahte gösterge odası', 'desk'] },
  mercy_capsule: { t2: ['Eczane', 'samples'], up: [['Ameliyathane', 'medbay'], ['Hasta koğuşu', 'cabin']], t4: ['Karantina odası', 'medbay'], t4up: ['Sentez laboratuvarı', 'lab'] },
  lifeline: { t2: ['Rehabilitasyon odası', 'commons'], up: [['Kriyo arşivi', 'cryo'], ['Doktor kamarası', 'cabin']], t4: ['Sterilizasyon odası', 'lab'], t4up: ['Yoğun bakım', 'medbay'] },
  deepdelve_borer: { t2: ['Matkap bakım odası', 'maint'], up: [['Jeolog odası', 'lab'], ['Madenci yatakhanesi', 'cabin']], t4: ['Eritme fırını', 'dig'], t4up: ['Sondaj kontrol odası', 'desk'] },
  rake: { t2: ['Kesim atölyesi', 'maint'], up: [['Vinç kontrol kabini', 'salvage'], ['Ayrıştırma odası', 'scrap']], t4: ['Pres odası', 'maint'], t4up: ['Lonca kayıt odası', 'desk'] },
  carrion_crow: { t2: ['Ayıklama bölmesi', 'scrap'], up: [['Leşçi gözetleme yeri', 'turret'], ['Hurdacı barakası', 'cabin']], t4: ['Parça tezgâhı', 'maint'], t4up: ['Hurda borsası', 'meeting'] },
  false_floor: { t2: ['Sahte gümrük bölmesi', 'hold'], up: [['Kaçakçı kamarası', 'cabin'], ['Çift tabanlı ambar', 'hidden']], t4: ['Koku maskeleme odası', 'lab'], t4up: ['Sahte belge odası', 'desk'] },
  blank_ledger: { t2: ['Sessiz oda', 'meeting'], up: [['Kayıt dışı ambar', 'hold'], ['Gölge ofisi', 'desk']], t4: ['Tarayıcı sönümleme odası', 'server'], t4up: ['Kasa dairesi', 'hidden'] },
  second_heart: { t2: ['Yedek seyir odası', 'desk'], up: [['Acil durum köprüsü', 'bridge2'], ['Mürettebat sığınağı', 'bunk']], t4: ['Yedek güç odası', 'maint'], t4up: ['Taktik masa odası', 'meeting'] },
  paper_bridge: { t2: ['Kablo ve makara odası', 'maint'], up: [['Harita odası', 'desk'], ['Mekanik telgraf odası', 'server']], t4: ['Dişli şanzıman odası', 'maint'], t4up: ['Analog hesap odası', 'lab'] },
  ravenroost: { t2: ['Pilot hazırlık odası', 'armory'], up: [['Uçuş kontrol odası', 'desk'], ['Dron rafları', 'hold']], t4: ['Yakıt ikmal bölmesi', 'maint'], t4up: ['Pilot kamaraları', 'cabin'] },
  shadow_stable: { t2: ['Gizli bakım çukuru', 'hidden'], up: [['Gözcü balkonu', 'turret'], ['Kayıtsız parça deposu', 'hold']], t4: ['Plaka değiştirme odası', 'maint'], t4up: ['Kaçış kapsülü yuvası', 'bridge2'] },
  refraction_lab: { t2: ['Optik kalibrasyon odası', 'lab'], up: [['Kristal büyütme odası', 'lab'], ['Lazer test tüneli', 'samples']], t4: ['Temiz oda', 'lab'], t4up: ['Mercek arşivi', 'samples'] },
  atlas_lab: { t2: ['Veri odası', 'server'], up: [['Gözlemevi', 'desk'], ['Araştırmacı kamarası', 'cabin']], t4: ['Numune hazırlama odası', 'samples'], t4up: ['Simülasyon odası', 'netrun'] },
  // yeni dorseler (non-canon)
  velvet_curtain: { t2: ['Soyunma odası', 'meeting'], up: [['İpek yatak odası stüdyosu', 'studio'], ['Işık deposu', 'hold']], t4: ['Banyo setli stüdyo', 'studio'], t4up: ['Yapımcı odası', 'desk'] },
  hearthwagon: { t2: ['Çocuk kamarası', 'cabin'], up: [['Aile yatak odası', 'cabin'], ['Kiler', 'pantry']], t4: ['Demirci köşesi', 'maint'], t4up: ['Çatı terası', 'commons'] },
  stonebreath_refinery: { t2: ['Cüruf odası', 'scrap'], up: [['Damıtma kulesi', 'dig'], ['Ustabaşı odası', 'desk']], t4: ['Külçe kasası', 'ore'], t4up: ['Soğutma galerisi', 'maint'] },
  mirage_box: { t2: ['Sahte yük bölmesi', 'hold'], up: [['Yansıtıcı odası', 'server'], ['Kaçakçı yatakhanesi', 'bunk']], t4: ['Görüntü bozucu odası', 'netrun'], t4up: ['Gizli kasa', 'hidden'] },
  quartermaster: { t2: ['Raf sistemi', 'hold'], up: [['Levazım subayı odası', 'desk'], ['Üniforma deposu', 'hold']], t4: ['Silah sandığı odası', 'armory'], t4up: ['Erzak dağıtım odası', 'pantry'] },
};
/** T2'de iki katlı, pahalı özel dorseler (daha ağır). */
export const TWO_T2 = new Set(['trl_blindspot', 'trl_refraction_lab', 'trl_ravenroost', 'trl_forgefire_bastion', 'trl_velvet_curtain']);
/** Üstü açık dorseler: alt katta koridor yok, odalar tam boy. */
export const OPEN = new Set(['trl_lantern_runner', 'trl_carrion_crow', 'trl_shadow_stable']);
export const isTanker = (type: string) => /tanker/i.test(type);
export function decksOf(base: string, size: string) { return size === 'T3' || size === 'T4' || (size === 'T2' && TWO_T2.has(base)) ? 2 : 1; }
/** Kademe/kat oda listesi: lo = alt kat, up = üst kat. */
export function tierRooms(base: string, size: string, t1: string[]) {
  const k = base.replace(/^trl_/, ''), x = TROOMS[k], z = +size.slice(1) || 1;
  const lo: { n: string; kind?: RoomKind }[] = t1.map((n) => ({ n }));
  if (x?.t1) lo.push({ n: x.t1[0], kind: x.t1[1] });
  if (x && z >= 2) lo.push({ n: x.t2[0], kind: x.t2[1] });
  if (x && z >= 4) lo.push({ n: x.t4[0], kind: x.t4[1] });
  const up: { n: string; kind?: RoomKind }[] = [];
  if (x && decksOf(base, size) === 2) { up.push(...x.up.map(([n, kind]) => ({ n, kind }))); if (z >= 4) up.push({ n: x.t4up[0], kind: x.t4up[1] }); }
  return { lo, up };
}

/** Tır kademeleri: gövde ölçüsü ve kat başına odalar (T1 = belgedeki tır; T2–T4 non-canon büyüme). */
export interface TruckRoom { id: string; n: string; kind?: RoomKind; hold?: 'cab'; row?: 0 | 1 }
export interface TruckTier { L: number; W: number; decks: { x0: number; x1: number; rooms: TruckRoom[]; cor: string; ckp?: boolean; rows?: 1 | 2 }[] }
export const TRUCK: Record<string, TruckTier> = {
  T2: { L: 22, W: 6.8, decks: [
    { x0: 0, x1: 22, cor: 'Servis koridoru', rooms: [{ id: 'cab_eng', n: 'Motor bölmesi' }, { id: 'cab_core', n: 'Çekirdek odası' }, { id: 'cab_hold', n: 'Kabin ambarı', hold: 'cab' }, { id: 'cab_shop', n: 'Atölye', kind: 'maint' }] },
    { x0: 2.4, x1: 22, cor: 'Üst koridor', ckp: true, rooms: [{ id: 'cab_bunk', n: 'Uyku odası' }, { id: 'cab_wc', n: 'Tuvalet ve duş', kind: 'wc' }, { id: 'cab_galley', n: 'Mutfak köşesi', kind: 'galley' }, { id: 'cab_lng', n: 'Oturma alanı' }] },
  ] },
  T3: { L: 26, W: 7.6, decks: [
    { x0: 0, x1: 26, cor: 'Servis koridoru', rows: 2, rooms: [{ id: 'cab_eng', n: 'Motor bölmesi', row: 1 }, { id: 'cab_core', n: 'Çekirdek odası', row: 1 }, { id: 'cab_hold', n: 'Kabin ambarı', hold: 'cab', row: 1 }, { id: 'cab_parts', n: 'Yedek parça deposu', kind: 'hold', row: 0 }, { id: 'cab_shop', n: 'Atölye', kind: 'maint', row: 0 }, { id: 'cab_arms', n: 'Silah dolabı', kind: 'armory', row: 0 }] },
    { x0: 2.4, x1: 26, cor: 'Üst koridor', ckp: true, rows: 2, rooms: [{ id: 'cab_crew', n: 'Mürettebat kamarası', kind: 'cabin', row: 1 }, { id: 'cab_capt', n: 'Kaptan kamarası', kind: 'cabin', row: 1 }, { id: 'cab_nav', n: 'Seyir odası', kind: 'desk', row: 1 }, { id: 'cab_wc', n: 'Tuvalet ve duş', kind: 'wc', row: 0 }, { id: 'cab_galley', n: 'Mutfak', kind: 'galley', row: 0 }, { id: 'cab_lng', n: 'Oturma alanı', row: 0 }] },
  ] },
  T4: { L: 30, W: 8.6, decks: [
    { x0: 0, x1: 30, cor: 'Servis koridoru', rows: 2, rooms: [{ id: 'cab_eng', n: 'Motor bölmesi', row: 1 }, { id: 'cab_core', n: 'Çekirdek odası', row: 1 }, { id: 'cab_hold', n: 'Kabin ambarı', hold: 'cab', row: 1 }, { id: 'cab_parts', n: 'Yedek parça deposu', kind: 'hold', row: 0 }, { id: 'cab_shop', n: 'Atölye', kind: 'maint', row: 0 }, { id: 'cab_arms', n: 'Cephanelik', row: 0 }, { id: 'cab_med', n: 'Revir köşesi', kind: 'medbay', row: 0 }] },
    { x0: 2.4, x1: 30, cor: 'Üst koridor', ckp: true, rows: 2, rooms: [{ id: 'cab_crew', n: 'Mürettebat kamarası', kind: 'cabin', row: 1 }, { id: 'cab_bunk', n: 'Uyku odası', row: 1 }, { id: 'cab_nav', n: 'Seyir odası', kind: 'desk', row: 1 }, { id: 'cab_wc', n: 'Tuvalet ve duş', kind: 'wc', row: 0 }, { id: 'cab_galley', n: 'Mutfak', kind: 'galley', row: 0 }, { id: 'cab_lng', n: 'Oturma alanı', row: 0 }] },
    { x0: 8, x1: 27, cor: 'Köprü koridoru', rooms: [{ id: 'cab_capt', n: 'Kaptan kamarası', kind: 'cabin' }, { id: 'cab_comm', n: 'Haberleşme odası', kind: 'server' }, { id: 'cab_dome', n: 'Gözlem kubbesi', kind: 'lounge' }] },
  ] },
};
