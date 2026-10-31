/* Gemi verisi: world/ship (DM yazar, herkes okur). Değer yoksa varsayılanlar gösterilir. */
export type TrailerKind = 'konteyner' | 'tanker' | 'lab' | 'depo' | 'yasam' | 'hangar';
export interface Trailer { id: string; kind: TrailerKind; name: string; hp: number; hpMax: number; cargo: number; cargoMax: number; note: string }
export interface ShipState {
  name: string; hp: number; hpMax: number; sh: number; shMax: number; cargo: number; cargoMax: number;
  fuel: number; fuelMax: number; fuelType: string; speed: string; note: string; trailers: Trailer[];
}
export const MAX_TRAILERS = 5;
export const DEFAULT_SHIP: ShipState = {
  name: 'Demir Kervan', hp: 1200, hpMax: 1200, sh: 400, shMax: 400, cargo: 0, cargoMax: 12, fuel: 100, fuelMax: 100,
  fuelType: 'Skarnit (rünle işlenmiş, eritilerek itki için kullanılır)', speed: 'DM belirler', note: '', trailers: [],
};
export const KINDS: Record<TrailerKind, { name: string; desc: string; cap: number; rooms: { n: string; a: number; b: number; img: string }[] }> = {
  konteyner: { name: 'Kargo dorsesi', desc: 'Standart kapalı yük kutusu. Her türlü sandık ve palet.', cap: 60, rooms: [{ n: 'Yük bölmesi', a: 0, b: 1, img: 'yuk' }] },
  tanker: { name: 'Tanker dorse', desc: 'Sıvı ve gaz yük; yakıt ya da erimiş metal taşır.', cap: 50, rooms: [{ n: 'Ön tank', a: 0, b: 0.48, img: 'tank' }, { n: 'Arka tank', a: 0.52, b: 1, img: 'tank' }] },
  lab: { name: 'Laboratuvar dorsesi', desc: 'Analiz tezgâhları, numune soğutucu ve sensör odası.', cap: 8, rooms: [{ n: 'Sensör odası', a: 0, b: 0.25, img: 'sensor' }, { n: 'Analiz tezgâhları', a: 0.25, b: 0.7, img: 'lab' }, { n: 'Numune soğutucu', a: 0.7, b: 1, img: 'cold' }] },
  depo: { name: 'Depo dorsesi', desc: 'Raflı, soğutmalı depo. Bozulabilir yük ve malzeme.', cap: 45, rooms: [{ n: 'Soğutucu ünite', a: 0, b: 0.12, img: 'sogutucu' }, { n: 'Raflı depo', a: 0.12, b: 1, img: 'depo' }] },
  yasam: { name: 'Yaşam dorsesi', desc: 'Ek ranzalar, ortak alan ve küçük mutfak.', cap: 4, rooms: [{ n: 'Ranzalar', a: 0, b: 0.4, img: 'ranzalar' }, { n: 'Ortak alan', a: 0.4, b: 0.8, img: 'ortak' }, { n: 'Mutfak', a: 0.8, b: 1, img: 'mutfak' }] },
  hangar: { name: 'Hangar dorsesi', desc: 'Açık platform; küçük araç ya da mekik bağlanır.', cap: 20, rooms: [{ n: 'Araç platformu', a: 0, b: 0.8, img: 'platform' }, { n: 'Bakım dolabı', a: 0.8, b: 1, img: 'bakim' }] },
};
/** Kabin iç planı (yan kesit, metre benzeri birim). İki kat: alt güverte ve üst güverte. */
export interface Room { id: string; img?: string; n: string; x0: number; x1: number; y0: number; y1: number; d: string }
export const ROOMS: Room[] = [
  { id: 'kokpit', n: 'Kokpit', x0: 0.6, x1: 4.4, y0: 7.6, y1: 11.6, d: 'İki koltuk, geniş ön cam, pilot ve yardımcı pilot konsolu.' },
  { id: 'salon', n: 'Oturma alanı', x0: -3.4, x1: 0.5, y0: 2.9, y1: 7.4, d: 'Masa ve L koltuk; yemek, harita ve plan için.' },
  { id: 'ranza', n: 'Yatak bölmesi', x0: -7.8, x1: -3.5, y0: 7.6, y1: 12.9, d: 'Üst üste iki ranza, perde ve dolap.' },
  { id: 'tuvalet', n: 'Tuvalet', x0: -7.8, x1: -5.6, y0: 2.9, y1: 7.4, d: 'Küçük tuvalet ve lavabo.' },
  { id: 'kilit', n: 'Hava kilidi', x0: -5.5, x1: -3.5, y0: 2.9, y1: 7.4, d: 'Kabin kapısı ve uzay giysisi dolabı.' },
  { id: 'motor', n: 'Motor bölmesi', x0: 4.7, x1: 12.3, y0: 2.8, y1: 7.6, d: 'Ön kaputun altı: güç ünitesi ve manevra iticilerinin denetimi.' },
  { id: 'cekirdek', n: 'Skarn çekirdeği', x0: -11.5, x1: -8.3, y0: 2.9, y1: 6.2, d: 'Ana motorları besleyen erimiş Skarnit odası. Rünlerle mühürlü.' },
];

/** Bölme fotoğrafı (public/img/ship). Oda kimliği ya da dorse bölmesinin img anahtarı. */
export const roomImg = (k: string) => import.meta.env.BASE_URL + 'img/ship/' + k + '.webp';
