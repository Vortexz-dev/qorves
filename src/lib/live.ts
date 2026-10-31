/*
 * Canlı (Firestore) katmanı: çevrimiçi durumu, bildirimler, ghOS-Net, cüzdan, zar, işaretler, DM araçları.
 * Yalnız Firebase arka ucunda çalışır (Spark, ücretsiz); ?mock=1 iken sessizce boş döner.
 */
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy, limit, onSnapshot, writeBatch, runTransaction, arrayUnion, arrayRemove, increment, type Unsubscribe } from 'firebase/firestore';
import { db } from './backend/firebase';
import { backend, type UserProfile, type DeskItem } from './backend';
export const LIVE = backend.kind === 'firebase';
const off: Unsubscribe = () => {};
export const now = () => Date.now();
export const nid = () => now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- çevrimiçi durumu ----------
export interface Presence { uid: string; username: string; char: string; avatar: string; role: string; last: number; on: boolean }
export const ONLINE_MS = 150_000;
export const isOnline = (p?: Presence | null) => !!p && p.on && now() - p.last < ONLINE_MS;
let hb: ReturnType<typeof setInterval> | undefined;
export function startPresence(u: UserProfile) {
  if (!LIVE) return () => {};
  const av = u.avatar && u.avatar.length < 1500 ? u.avatar : '';
  const beat = (on = true) => setDoc(doc(db, 'presence', u.uid), { uid: u.uid, username: u.username, char: u.character?.name ?? '', avatar: av, role: u.role, last: now(), on }).catch(() => {});
  beat(); clearInterval(hb); hb = setInterval(() => document.visibilityState !== 'hidden' && beat(), 45_000);
  const vis = () => document.visibilityState === 'visible' && beat();
  const bye = () => beat(false);
  document.addEventListener('visibilitychange', vis); addEventListener('pagehide', bye);
  return () => { clearInterval(hb); document.removeEventListener('visibilitychange', vis); removeEventListener('pagehide', bye); beat(false); };
}
export function watchPresence(cb: (list: Presence[]) => void) {
  if (!LIVE) return off;
  return onSnapshot(collection(db, 'presence'), (s) => cb(s.docs.map((d) => d.data() as Presence)), () => cb([]));
}

// ---------- bildirimler ----------
export interface Notice { id: string; title: string; body: string; level: 'info' | 'warn' | 'crit'; at: number; seen: boolean; from?: string }
export function watchNotices(uid: string, cb: (n: Notice[]) => void) {
  if (!LIVE) return off;
  return onSnapshot(query(collection(db, 'users', uid, 'notify'), where('seen', '==', false)), (s) => cb(s.docs.map((d) => ({ ...(d.data() as Notice), id: d.id })).sort((a, b) => a.at - b.at)), () => {});
}
export const seenNotice = (uid: string, id: string) => updateDoc(doc(db, 'users', uid, 'notify', id), { seen: true }).catch(() => {});
export const sendNotice = (uid: string, n: Omit<Notice, 'id' | 'at' | 'seen'>) => setDoc(doc(db, 'users', uid, 'notify', nid()), { ...n, at: now(), seen: false });
/** DM: oyuncunun masaüstüne belge ya da görsel bırak. */
export async function dropToDesk(uid: string, it: { kind: 'doc' | 'image'; name: string; body?: string; src?: string }) {
  const x = 18 + 104 * (2 + Math.floor(Math.random() * 4)), y = 18 + 112 * Math.floor(Math.random() * 4);
  const d: DeskItem = { id: nid(), kind: it.kind, name: it.name.slice(0, 80), parent: '', x, y, updatedAt: now(), from: 'dm' };
  if (it.body) d.body = it.body.slice(0, 19000); if (it.src) d.src = it.src.slice(0, 590);
  await setDoc(doc(db, 'users', uid, 'items', d.id), d);
}

// ---------- ghOS-Net ----------
export interface Npc { id: string; name: string; avatar: string; style: string; bio: string; color: string }
export interface Conv { id: string; members: string[]; npc?: string | null; names: Record<string, string>; last?: { from: string; text: string; at: number }; read?: Record<string, number>; at: number }
export interface Msg { id: string; from: string; text: string; at: number }
export const convId = (a: string, b: string) => 'c_' + [a, b].sort().join('_').replace(/[^a-zA-Z0-9_:-]/g, '');
export function watchNpcs(cb: (n: Npc[]) => void) { if (!LIVE) return off; return onSnapshot(collection(db, 'npcs'), (s) => cb(s.docs.map((d) => ({ ...(d.data() as Npc), id: d.id }))), () => cb([])); }
export const saveNpc = (n: Npc) => setDoc(doc(db, 'npcs', n.id), n);
export const deleteNpc = (id: string) => deleteDoc(doc(db, 'npcs', id));
export function watchConvs(uid: string | null, cb: (c: Conv[]) => void) {
  if (!LIVE) return off;
  const q = uid ? query(collection(db, 'convs'), where('members', 'array-contains', uid)) : collection(db, 'convs');
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...(d.data() as Conv), id: d.id })).sort((a, b) => (b.last?.at ?? b.at) - (a.last?.at ?? a.at))), () => cb([]));
}
export function watchMsgs(cid: string, cb: (m: Msg[]) => void) {
  if (!LIVE) return off;
  return onSnapshot(query(collection(db, 'convs', cid, 'm'), orderBy('at', 'desc'), limit(150)), (s) => cb(s.docs.map((d) => ({ ...(d.data() as Msg), id: d.id })).reverse()), () => cb([]));
}
/** Konuşmayı yoksa aç. a: gönderen kimliği (uid ya da npc:ID), b: karşı taraf uid'i. */
export async function ensureConv(a: string, b: string, names: Record<string, string>, npc: string | null = null) {
  const id = convId(a, b), ref = doc(db, 'convs', id);
  const s = await getDoc(ref).catch(() => null);
  if (!s || !s.exists()) await setDoc(ref, { members: [a, b], npc, names, read: {}, at: now() });
  return id;
}
export async function sendMsg(cid: string, from: string, text: string) {
  text = text.trim().slice(0, 2000); if (!text) return;
  const at = now(); await setDoc(doc(db, 'convs', cid, 'm', nid()), { from, text, at });
  await updateDoc(doc(db, 'convs', cid), { last: { from, text: text.slice(0, 140), at }, ['read.' + from.replace(/\./g, '_')]: at }).catch(() => {});
}
export const markRead = (cid: string, who: string) => updateDoc(doc(db, 'convs', cid), { ['read.' + who.replace(/\./g, '_')]: now() }).catch(() => {});
export const unreadFor = (c: Conv, who: string) => !!c.last && c.last.from !== who && (c.read?.[who.replace(/\./g, '_')] ?? 0) < c.last.at;

// ---------- cüzdan ----------
export const CURRENCIES = [{ id: 'BK', name: 'Birleşik Kredisi', sym: 'BK', note: 'dijital, enflasyonlu' }, { id: 'Mark', name: 'Cumhuriyet Markı', sym: 'M', note: 'İnsan Cumhuriyeti' }, { id: 'Kantar', name: 'Kantar', sym: 'K', note: 'altın karşılıklı; cüce + Ostrav' }];
export interface Wallet { bal: Record<string, number>; at: number }
export interface Tx { id: string; cur: string; amt: number; reason: string; at: number; bal?: number; tr?: string; peer?: string }
export interface Transfer { id: string; from: string; to: string; cur: string; amt: number; at: number; note?: string; fromName?: string; toName?: string }
export function watchWallet(uid: string, cb: (w: Wallet | null, tx: Tx[]) => void) {
  if (!LIVE) return off;
  let w: Wallet | null = null, t: Tx[] = [];
  const a = onSnapshot(doc(db, 'wallet', uid), (s) => { w = s.exists() ? (s.data() as Wallet) : null; cb(w, t); }, () => cb(null, []));
  const b = onSnapshot(query(collection(db, 'wallet', uid, 'tx'), orderBy('at', 'desc'), limit(100)), (s) => { t = s.docs.map((d) => ({ ...(d.data() as Tx), id: d.id })); cb(w, t); }, () => {});
  return () => { a(); b(); };
}
/** DM: bakiyeye ekle/çıkar ya da (set) doğrudan belirle; her değişiklik gerekçesiyle kayda geçer. */
export async function adjustWallet(uid: string, cur: string, amt: number, reason: string, set = false) {
  const ref = doc(db, 'wallet', uid); const s = await getDoc(ref); const old = (s.exists() ? (s.data() as Wallet).bal?.[cur] : 0) ?? 0;
  const nb = set ? amt : old + amt; const delta = nb - old;
  const b = writeBatch(db);
  b.set(ref, { bal: { ...(s.exists() ? (s.data() as Wallet).bal : {}), [cur]: nb }, at: now() });
  b.set(doc(db, 'wallet', uid, 'tx', nid()), { cur, amt: delta, reason: reason.slice(0, 200) || (set ? 'Bakiye belirlendi' : 'Düzeltme'), at: now(), bal: nb });
  await b.commit(); return nb;
}

/** Oyuncudan oyuncuya aktarım: tek işlemde aktarım kaydı + iki cüzdan + iki tx (kurallar hepsini birlikte doğrular). */
export async function sendMoney(from: { uid: string; name: string }, to: { uid: string; name: string }, cur: string, amt: number, note: string) {
  if (!(amt > 0) || from.uid === to.uid) throw new Error('Geçersiz aktarım');
  const tid = nid(), at = now(), n = note.trim().slice(0, 140);
  return runTransaction(db, async (t) => {
    const wr = doc(db, 'wallet', from.uid); const s = await t.get(wr);
    const old = (s.exists() ? (s.data() as Wallet).bal?.[cur] : 0) ?? 0;
    if (old < amt) throw new Error('Bakiye yetersiz');
    const nb = old - amt;
    t.set(doc(db, 'transfers', tid), { from: from.uid, to: to.uid, cur, amt, at, ...(n ? { note: n } : {}), fromName: from.name.slice(0, 60), toName: to.name.slice(0, 60) });
    t.set(wr, { bal: { [cur]: nb }, at, lt: tid }, { merge: true });
    t.set(doc(db, 'wallet', to.uid), { bal: { [cur]: increment(amt) }, at, ri: tid }, { merge: true });
    const r = (who: string) => (`Aktarım ${who}` + (n ? ` · ${n}` : '')).slice(0, 200);
    t.set(doc(db, 'wallet', from.uid, 'tx', tid), { cur, amt: -amt, reason: r('→ ' + to.name), at, bal: nb, tr: tid, peer: to.uid });
    t.set(doc(db, 'wallet', to.uid, 'tx', tid), { cur, amt, reason: r('← ' + from.name), at, tr: tid, peer: from.uid });
    return nb;
  });
}
/** DM: bütün aktarımların kaydı. */
export function watchTransfers(cb: (t: Transfer[]) => void, n = 100) {
  if (!LIVE) return off;
  return onSnapshot(query(collection(db, 'transfers'), orderBy('at', 'desc'), limit(n)), (s) => cb(s.docs.map((d) => ({ ...(d.data() as Transfer), id: d.id }))), () => cb([]));
}

// ---------- zar ----------
export interface Roll { id?: string; uid: string; user: string; char: string; expr: string; groups: { n: number; d: number; vals: number[]; keep?: number[] }[]; mod: number; adv: '' | 'adv' | 'dis'; total: number; nat: '' | 'nat20' | 'nat1'; at: number; label?: string }
export const saveRoll = (r: Roll) => setDoc(doc(db, 'rolls', nid()), r);
export function watchRolls(uid: string | null, cb: (r: Roll[]) => void, n = 60) {
  if (!LIVE) return off;
  const q = uid ? query(collection(db, 'rolls'), where('uid', '==', uid)) : query(collection(db, 'rolls'), orderBy('at', 'desc'), limit(n));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...(d.data() as Roll), id: d.id })).sort((a, b) => b.at - a.at).slice(0, n)), () => cb([]));
}
let hook: string | null | undefined;
export async function diceHook() { if (hook !== undefined) return hook; try { const s = await getDoc(doc(db, 'config', 'dice')); hook = s.exists() ? (s.data().webhook as string) : null; } catch { hook = null; } return hook; }

// ---------- yıldız haritası işaretleri ----------
export interface Marker { id: string; sys: string; kind: 'ship' | 'mission'; label: string; note: string; players: string[]; at: number }
export function watchMarkers(uid: string | null, cb: (m: Marker[]) => void) {
  if (!LIVE) return off;
  const q = uid ? query(collection(db, 'markers'), where('players', 'array-contains', uid)) : collection(db, 'markers');
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...(d.data() as Marker), id: d.id }))), () => cb([]));
}
export const saveMarker = (m: Marker) => setDoc(doc(db, 'markers', m.id), m);
export const deleteMarker = (id: string) => deleteDoc(doc(db, 'markers', id));

// ---------- DM: oyuncular, bilgi izinleri ----------
export async function listUsers(): Promise<UserProfile[]> { const s = await getDocs(collection(db, 'users')); return s.docs.map((d) => d.data() as UserProfile); }
export async function grantsOf(uid: string): Promise<string[]> { const g = await getDoc(doc(db, 'grants', uid)).catch(() => null); return g?.exists() ? (g.data().keys ?? []) : []; }
export async function setPack(uid: string, key: string, on: boolean) {
  const b = writeBatch(db);
  b.set(doc(db, 'grants', uid), { keys: on ? arrayUnion(key) : arrayRemove(key) }, { merge: true });
  b.update(doc(db, 'vault', key), { readers: on ? arrayUnion(uid) : arrayRemove(uid) });
  await b.commit();
}
export interface Reveal { id: string; e: Record<string, unknown>; s: { t: string; x: string; o: number }[]; b?: Record<string, unknown>[]; at: number }
export async function revealsOf(uid: string): Promise<Reveal[]> { const s = await getDocs(collection(db, 'users', uid, 'reveals')).catch(() => null); return s ? s.docs.map((d) => ({ ...(d.data() as Reveal), id: d.id })) : []; }
export const setReveal = (uid: string, r: Reveal) => setDoc(doc(db, 'users', uid, 'reveals', r.id), r);
export const dropReveal = (uid: string, id: string) => deleteDoc(doc(db, 'users', uid, 'reveals', id));
export async function fileOf(uid: string, id: string): Promise<{ name: string; type: string; url: string } | null> {
  const m = await getDoc(doc(db, 'users', uid, 'files', id)); if (!m.exists()) return null;
  const meta = m.data() as { name: string; type: string; chunks: number };
  const parts: string[] = [];
  for (let i = 0; i < meta.chunks; i++) { const c = await getDoc(doc(db, 'users', uid, 'files', id, 'chunks', String(i))); parts.push(c.data()?.d ?? ''); }
  const bin = atob(parts.join('')); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { name: meta.name, type: meta.type, url: URL.createObjectURL(new Blob([u8], { type: meta.type || 'application/octet-stream' })) };
}

// ---------- dünya: takvim, olaylar, timeline ----------
export function watchDoc<T>(path: [string, string], cb: (v: T | null) => void) { if (!LIVE) return off; return onSnapshot(doc(db, path[0], path[1]), (s) => cb(s.exists() ? (s.data() as T) : null), () => cb(null)); }
export const setWorld = (patch: Record<string, unknown>) => setDoc(doc(db, 'world', 'state'), patch, { merge: true });
export const setEvents = (patch: Record<string, unknown>) => setDoc(doc(db, 'world', 'events'), patch, { merge: true });
export interface TlEvent { id: string; name: string; date: string; ys: number; summary: string; text: string; race: string; published: boolean; at: number }
export function watchTl(all: boolean, cb: (t: TlEvent[]) => void) {
  if (!LIVE) return off;
  const q = all ? collection(db, 'tlevents') : query(collection(db, 'tlevents'), where('published', '==', true));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...(d.data() as TlEvent), id: d.id }))), () => cb([]));
}
export const saveTl = (t: TlEvent) => setDoc(doc(db, 'tlevents', t.id), t);
export const deleteTl = (id: string) => deleteDoc(doc(db, 'tlevents', id));
export const setProfileField = (uid: string, patch: Record<string, unknown>) => updateDoc(doc(db, 'users', uid), patch);
export { increment, addDoc };
/** Oyuncunun bilgi erişimi (paket izinleri + tek tek açılan kayıtlar) değişince haber verir; ilk anlık görüntü sayılmaz. */
export function watchKnowledge(uid: string, cb: () => void) {
  if (!LIVE) return off;
  let a = false, b = false, t: ReturnType<typeof setTimeout> | undefined;
  const fire = () => { clearTimeout(t); t = setTimeout(cb, 600); };
  const s1 = onSnapshot(doc(db, 'grants', uid), () => (a ? fire() : (a = true)), () => {});
  const s2 = onSnapshot(collection(db, 'users', uid, 'reveals'), () => (b ? fire() : (b = true)), () => {});
  return () => { s1(); s2(); clearTimeout(t); };
}
/** DM'den masaüstüne gelen öğeler (canlı). İlk anlık görüntü dahil tüm liste döner. */
export function watchDrops(uid: string, cb: (items: DeskItem[]) => void) {
  if (!LIVE) return off;
  return onSnapshot(query(collection(db, 'users', uid, 'items'), where('from', '==', 'dm')), (s) => cb(s.docs.map((d) => d.data() as DeskItem)), () => {});
}
/** DM'in yüklediği görsel (base64 veri adresi) — users/{uid}/media; öğe src'si 'media:<id>'. */
export async function putMedia(uid: string, data: string) { const id = nid(); await setDoc(doc(db, 'users', uid, 'media', id), { d: data, at: now() }); return 'media:' + id; }
const mcache = new Map<string, string>();
export async function mediaUrl(uid: string, src: string) {
  if (!src.startsWith('media:')) return src; const k = uid + '/' + src; if (mcache.has(k)) return mcache.get(k)!;
  const s = await getDoc(doc(db, 'users', uid, 'media', src.slice(6))).catch(() => null); const v = (s?.exists() ? (s.data().d as string) : '') || ''; mcache.set(k, v); return v;
}
