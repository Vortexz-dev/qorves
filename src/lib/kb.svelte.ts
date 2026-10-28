/*
 * GM-ONLY uyarısı: bu modülün yüklediği paketler Qorves FRP'nin GİZLİ oyun bilgisini içerir; oyunculara açıklanmaz.
 * Herkese açık paket data/pub.json; diğerleri data/s/<ad>.bin (AES-GCM). Anahtarlar Firestore vault'tan, yalnız izinli hesaba gelir.
 */
import MiniSearch from 'minisearch';
import { backend, type UserProfile } from './backend';
import { TYPE_ORDER } from './types';
export interface Section { t: string; x: string; k?: string; o: number }
export interface Entry {
  id: string; type: string; name: string; aliases?: string[]; summary?: string; key: string; parent?: string;
  date?: string; ys?: number; race?: string; ends?: string[]; region?: string; range?: string; ord?: number; sections: Section[];
}
export interface Body {
  id: string; sys: string; name: string; pop?: string; note?: string; kind: string; cls: string; type: string; orbit?: string; au?: number; au2?: number; parent?: string; l4?: string;
  star?: string; grav?: string; atm?: string; temp?: string; life?: string; count?: number; ring?: boolean; city?: boolean; key: string; ent?: string; desc?: string; img?: string; dm?: string; o: number;
}
interface Bundle { e: Omit<Entry, 'sections'>[]; s: { id: string; o: number; t: string; x: string }[]; b?: Body[]; bx?: { id: string; x: string }[] }
export const kb = $state({ ready: false, loading: false, count: 0, keys: [] as string[] });
const map = new Map<string, Entry>();
let linkRe: RegExp | null = null;
const nameId = new Map<string, string>();
const back = new Map<string, Set<string>>();
const kids = new Map<string, string[]>();
const bodies = new Map<string, Body>();
let ms: MiniSearch | null = null;
let pending: Promise<void> | null = null;
const STOP = new Set(['Kapı', 'Kapılar', 'Yeni', 'Eski']);
const BASE = import.meta.env.BASE_URL + 'data/';

async function decrypt(k: string, f: string): Promise<Bundle | null> {
  try {
    const raw = Uint8Array.from(atob(k), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    const buf = new Uint8Array(await (await fetch(BASE + 's/' + f + '.bin')).arrayBuffer());
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch { return null; }
}
const fold = (s: string) => s.toLocaleLowerCase('tr').replace(/[ıİ]/g, 'i').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[âà]/g, 'a').replace(/[îì]/g, 'i').replace(/[ûù]/g, 'u').replace(/ë/g, 'e');
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function loadKb(user: UserProfile) {
  if (pending) return pending;
  kb.loading = true;
  pending = (async () => {
    const bundles: Bundle[] = [await (await fetch(BASE + 'pub.json')).json()];
    const keys = await backend.vaultKeys(user).catch(() => []);
    const sealed = await Promise.all(keys.map((k) => decrypt(k.k, k.f)));
    sealed.forEach((b) => b && bundles.push(b));
    kb.keys = ['k.public', ...keys.map((k) => k.id)];
    for (const b of bundles) for (const e of b.e) map.set(e.id, { ...e, sections: [] } as Entry);
    for (const b of bundles) for (const s of b.s) map.get(s.id)?.sections.push({ t: s.t, x: s.x, o: s.o });
    for (const b of bundles) for (const x of b.b ?? []) bodies.set(x.id, { ...x });
    for (const b of bundles) for (const x of b.bx ?? []) { const o = bodies.get(x.id); if (o) o.dm = x.x; }
    for (const e of map.values()) {
      e.sections.sort((a, b) => a.o - b.o);
      if (e.parent && map.has(e.parent)) { const a = kids.get(e.parent) ?? []; a.push(e.id); kids.set(e.parent, a); }
    }
    // ad → id (sistemler ve ırklar önce); 4+ harf, büyük/küçük harf duyarlı
    const prio = (t: string) => TYPE_ORDER.indexOf(t);
    const sorted = [...map.values()].sort((a, b) => prio(a.type) - prio(b.type));
    for (const e of sorted) for (const n of [e.name, ...(e.aliases ?? [])]) if (n.length >= 4 && !STOP.has(n) && !nameId.has(n)) nameId.set(n, e.id);
    const names = [...nameId.keys()].sort((a, b) => b.length - a.length).map(esc);
    linkRe = new RegExp(`(?<![\\p{L}\\p{N}])(${names.join('|')})(?![\\p{L}\\p{N}])`, 'gu');
    for (const e of map.values()) {
      const txt = [e.summary ?? '', ...e.sections.map((s) => s.x)].join(' \n ');
      for (const m of txt.matchAll(linkRe)) {
        const t = nameId.get(m[1]); if (!t || t === e.id) continue;
        let s = back.get(t); if (!s) back.set(t, (s = new Set())); s.add(e.id);
      }
    }
    ms = new MiniSearch({
      fields: ['name', 'alias', 'summary', 'body'], storeFields: [],
      processTerm: (t) => fold(t),
      searchOptions: { boost: { name: 3, alias: 2, summary: 1, body: 0.4 }, prefix: true, fuzzy: 0.2,
        boostDocument: (id) => { const e = map.get(String(id)); return e && ['system', 'race', 'state', 'company'].includes(e.type) ? 1.25 : 1; } },
    });
    ms.addAll([...map.values()].map((e) => ({ id: e.id, name: e.name, alias: (e.aliases ?? []).join(' '), summary: e.summary ?? '', body: e.sections.map((s) => s.x).join(' ') })));
    kb.count = map.size; kb.ready = true; kb.loading = false;
  })();
  return pending;
}
export function resetKb() { bodies.clear(); map.clear(); nameId.clear(); back.clear(); kids.clear(); ms = null; linkRe = null; pending = null; kb.ready = false; kb.count = 0; }
export const getEntry = (id: string) => map.get(id);
/** Bir sistemin, kullanıcının anahtarlarıyla görebildiği gök cisimleri (Kodeks sırasıyla). */
export const bodiesOf = (sys: string) => [...bodies.values()].filter((b) => b.sys === sys).sort((a, b) => a.o - b.o);
export const allEntries = () => [...map.values()];
export const childrenOf = (id: string) => (kids.get(id) ?? []).map((k) => map.get(k)!).filter(Boolean);
export const backlinksOf = (id: string) => [...(back.get(id) ?? [])].map((k) => map.get(k)!).filter(Boolean);
export const idByName = (n: string) => nameId.get(n);
export type Part = string | { id: string; text: string };
export function linkify(text: string, self?: string): Part[] {
  if (!linkRe || !text) return [text];
  const out: Part[] = []; let last = 0;
  for (const m of text.matchAll(linkRe)) {
    const id = nameId.get(m[1]); if (!id || id === self) continue;
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ id, text: m[1] }); last = m.index! + m[1].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
/** Ön ek + bulanık + bitişik harf yer değiştirmesi ("ats" → "ast"). */
export function searchKb(q: string, limit = 40) {
  if (!ms || !q.trim()) return [];
  const words = fold(q).split(/\s+/).filter(Boolean);
  const variants = new Set([words.join(' ')]);
  words.forEach((w, wi) => {
    for (let i = 0; i < w.length - 1; i++) {
      const v = w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
      variants.add(words.map((x, j) => (j === wi ? v : x)).join(' '));
    }
  });
  const score = new Map<string, number>();
  let first = true;
  for (const v of variants) {
    for (const r of ms.search(v, { combineWith: 'AND' })) {
      const e = map.get(r.id)!, nm = [e.name, ...(e.aliases ?? [])];
      const lw = nm.map((n) => n.toLocaleLowerCase('tr')), fw = nm.map(fold);
      // ad başı eşleşmesine bonus; harfi birebir (aksan katlamasız) eşleşen daha önde
      const tier = lw.some((n) => n.startsWith(v)) ? 3 : fw.some((n) => n.startsWith(v)) ? 2 : fw.some((n) => n.split(/\s+/).some((x) => x.startsWith(v))) ? 1 : 0;
      const s = tier * 1e4 + Math.min(r.score * (first ? 1 : 0.85), 9999);
      if ((score.get(r.id) ?? 0) < s) score.set(r.id, s);
    }
    first = false;
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id, s]) => ({ e: map.get(id)!, s }));
}
