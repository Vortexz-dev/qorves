/* Qorves Times: harita olaylarından türetilen haber + DM haberleri. Görüntülenme sayısı tohumdan sabit. */
import { collection, onSnapshot, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from './backend/firebase';
import { LIVE, nid, now } from './live';
import type { ActiveEvent, EvData } from './events';

export interface News {
  id: string; kind: 'event' | 'corp' | 'faction' | 'ad' | 'dm';
  title: string; body: string; kicker?: string; by?: string; img?: string; views: number; at: number; ev?: string;
}
export const KINDS = [
  { id: 'event', label: 'Saha' }, { id: 'faction', label: 'Hizip' }, { id: 'corp', label: 'Şirket' },
  { id: 'ad', label: 'Reklam' }, { id: 'dm', label: 'Özel' },
] as const;

function fnv(s: string) {
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
export function viewsOf(key: string) {
  const h = fnv('qt|' + key);
  return 1_200_000 + (h % 48_800_000);
}

const PHONE = ['riot', 'dock', 'lane', 'street', 'flare', 'yard', 'ion', 'nebula', 'debris', 'magnetar', 'corona', 'rift', 'rune', 'pollen', 'quarantine', 'foundry', 'raid', 'quake'] as const;
export function phoneImg(key: string, sev: number) {
  if (sev < 2 && (fnv(key) & 3) !== 0) return '';
  return PHONE[fnv(key + '|img') % PHONE.length];
}
export const eventImg = (tplId: string) => `img/times/ev/${tplId}.webp`;

export function fromEvent(e: ActiveEvent, evd: EvData | null, sysName: (id: string) => string): News {
  const loc = sysName(e.sys);
  const cat = evd?.cats[e.tpl.cat] ?? e.tpl.cat;
  const sev = evd?.sev[e.tpl.sev]?.label ?? '';
  const kicker = [sev, cat].filter(Boolean).join(' · ');
  const body = [e.tpl.msg, e.tpl.effect && `Etkisi: ${e.tpl.effect}`, loc && `Konum: ${loc}.`, e.lane && 'Hiperhat üzerinde hareket kısıtı bildirildi.'].filter(Boolean).join(' ');
  return {
    id: 'ev:' + e.key, kind: 'event', title: e.tpl.name, body, kicker, by: e.tpl.by || 'Saha muhabiri',
    img: eventImg(e.tpl.id), views: viewsOf(e.key), at: e.start, ev: e.key,
  };
}

const ADS: Omit<News, 'id' | 'views' | 'at'>[] = [
  { kind: 'ad', title: 'EMTEKK · Evde kal, hattın açık kalsın', body: 'Yeni ev terminali paketi: iki yıl bakım, bir yıl sessizlik garantisi. EMTEKK — güvenin adı değil, alışkanlığınız.', kicker: 'Reklam', by: 'EMTEKK' },
  { kind: 'ad', title: 'MILISAN sahra rasyonu, üçüncü nesil', body: 'Isıt, aç, unut. Askerî standart, sivil fiyat. Stoklar Ortak Hat depolarında.', kicker: 'Reklam', by: 'MILISAN' },
  { kind: 'ad', title: 'Hür Liman serbest antrepo', body: 'Gümrük yok, soru az, vinç çok. Konteyneriniz sabaha yerinde — ya da biz aramayız.', kicker: 'Reklam', by: 'Hür Liman' },
  { kind: 'corp', title: 'ARASAKA güvenlik danışmanlığı', body: 'Şirket kampüsleri için çevre ağı, beden tarama ve “kaybolan evrak” hizmeti. Teklif almak resmi kanaldan.', kicker: 'Kurumsal', by: 'ARASAKA Basın' },
  { kind: 'faction', title: 'Birleşik İnsanlık iç bülteni', body: 'Prosperion ofisi haftalık hat güvenliği özetini yayımladı. Sivil uçuşlara ara verilmedi; yine de geçiş belgenizi yenileyin.', kicker: 'Resmî', by: 'B.İ. Basın Bürosu' },
];

export function filler(nowMs: number): News[] {
  return ADS.map((a, i) => ({ ...a, id: 'ad:' + i, views: viewsOf('ad|' + i + '|' + Math.floor(nowMs / 86400000)), at: nowMs - (i + 2) * 3600_000 }));
}

const off = () => () => {};
export function watchNews(cb: (xs: News[]) => void) {
  if (!LIVE) return off();
  return onSnapshot(collection(db, 'news'), (s) => cb(s.docs.map((d) => ({ ...(d.data() as News), id: d.id })).sort((a, b) => b.at - a.at)), () => cb([]));
}
export const saveNews = (n: News) => setDoc(doc(db, 'news', n.id), n);
export const dropNews = (id: string) => deleteDoc(doc(db, 'news', id));
export const blankNews = (): News => ({ id: nid(), kind: 'dm', title: '', body: '', kicker: 'Özel haber', by: 'Qorves Times', views: viewsOf('n' + now()), at: now() });
