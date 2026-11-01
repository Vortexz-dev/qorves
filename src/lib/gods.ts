/*
 * God's Eye veri katmanı (Firestore, Spark planı; Cloud Storage yok).
 * ge_asg/main   {map:{uid:sid}}              — oyuncu → sahne ataması (DM yazar)
 * ge_scn/{sid}  {name,w,h,order,layers,imgs}  — sahne + katmanlar (DM yazar; yalnız atanan oyuncu okur)
 * ge_ink/{lid}  {sid,s:[{c,w,p}]}             — fırça katmanının çizgileri (katman kutusuna göre 0..10000)
 * ge_dep/{id}   depo öğesi (klasör/görsel/not) — yalnız DM
 * ge_blob/{img~i} {img,i,d}                   — görsel parçaları (base64, < 1 MiB); oyuncu yalnız sahnesindeki görseli okur
 * ge_tok/{sid_uid}, ge_ping/{sid_uid}          — jeton / işaret (oyuncu yalnız kendi + kendi sahnesi)
 * ge_log/{id}   oyuncu eylem kaydı (not, ekran görüntüsü, işaret) — oyuncu yazar, DM okur
 */
import { doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, collection, query, where, onSnapshot, writeBatch, orderBy, limit, type Unsubscribe } from 'firebase/firestore';
import { db } from './backend/firebase';
import { LIVE, nid, now } from './live';
export { nid, now };
const off: Unsubscribe = () => {};

export interface ImgRef { id: string; n: number; w: number; h: number }
export interface Layer {
  id: string; k: 'img' | 'text' | 'draw'; name: string; hid?: boolean;
  x: number; y: number; w: number; h: number; lock?: boolean;
  img?: ImgRef; t?: string; fs?: number; col?: string; al?: 'left' | 'center' | 'right'; bold?: boolean;
}
export interface Scene { id: string; name: string; w: number; h: number; order: number; layers: Layer[]; imgs: string[]; at: number }
export interface Stroke { c: string; w: number; p: number[] }
export interface Ink { sid: string; s: Stroke[] }
export interface DepItem { id: string; kind: 'folder' | 'image' | 'note'; name: string; parent: string; at: number; img?: ImgRef; size?: number; body?: string; thumb?: string }
export interface Token { sid: string; uid: string; name: string; img: string; col: string; x: number; y: number; at: number }
export interface Ping { sid: string; uid: string; name: string; col: string; x: number; y: number; at: number }
export interface GLog { id: string; uid: string; name: string; kind: 'note' | 'shot' | 'ping'; title: string; body?: string; sid: string; scene?: string; src?: string; thumb?: string; at: number }

export const STAGE = { w: 1920, h: 1080 };
const PAL = ['#00f0ff', '#fcee0a', '#ff2a55', '#39ff8a', '#b46cff', '#ff8a00', '#ff5cc8', '#7df9ff'];
export const colorOf = (uid: string) => { let h = 0; for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };

// ---------- izleyiciler ----------
const D = (c: string, id: string) => doc(db, c, id);
export function watchAsg(cb: (m: Record<string, string>) => void) {
  if (!LIVE) return off; return onSnapshot(D('ge_asg', 'main'), (s) => cb((s.data()?.map as Record<string, string>) ?? {}), () => cb({}));
}
export const setAsg = (uid: string, sid: string | null) => setDoc(D('ge_asg', 'main'), { map: { [uid]: sid ?? '' } }, { merge: true });
export function watchScenes(cb: (l: Scene[]) => void) {
  return onSnapshot(collection(db, 'ge_scn'), (s) => cb(s.docs.map((d) => d.data() as Scene).sort((a, b) => a.order - b.order || a.at - b.at)), () => cb([]));
}
export function watchScene(sid: string, cb: (s: Scene | null, local: boolean) => void, err?: () => void) {
  return onSnapshot(D('ge_scn', sid), (s) => cb(s.exists() ? (s.data() as Scene) : null, s.metadata.hasPendingWrites), () => err?.());
}
export const saveScene = (s: Scene) => setDoc(D('ge_scn', s.id), { ...s, imgs: [...new Set(s.layers.filter((l) => l.img).map((l) => l.img!.id))], at: now() });
export async function deleteScene(sid: string) {
  const b = writeBatch(db); b.delete(D('ge_scn', sid));
  for (const c of ['ge_ink', 'ge_tok', 'ge_ping']) for (const d of (await getDocs(query(collection(db, c), where('sid', '==', sid)))).docs) b.delete(d.ref);
  await b.commit();
}
function watchBySid<T>(c: string, sid: string, cb: (l: T[]) => void) {
  return onSnapshot(query(collection(db, c), where('sid', '==', sid)), (s) => cb(s.docs.map((d) => ({ ...(d.data() as T), _id: d.id }))), () => cb([]));
}
export const watchInks = (sid: string, cb: (m: Record<string, Ink>) => void) => watchBySid<Ink & { _id: string }>('ge_ink', sid, (l) => cb(Object.fromEntries(l.map((x) => [x._id, x]))));
export const saveInk = (lid: string, ink: Ink) => setDoc(D('ge_ink', lid), ink);
export const deleteInk = (lid: string) => deleteDoc(D('ge_ink', lid)).catch(() => {});
export const watchTokens = (sid: string, cb: (l: Token[]) => void) => watchBySid<Token>('ge_tok', sid, cb);
export const saveToken = (t: Token) => setDoc(D('ge_tok', t.sid + '_' + t.uid), t);
export const moveToken = (t: Token, x: number, y: number) => updateDoc(D('ge_tok', t.sid + '_' + t.uid), { x, y, at: now() });
export const deleteToken = (sid: string, uid: string) => deleteDoc(D('ge_tok', sid + '_' + uid));
export const watchPings = (sid: string, cb: (l: Ping[]) => void) => watchBySid<Ping>('ge_ping', sid, cb);
export const sendPing = (p: Ping) => setDoc(D('ge_ping', p.sid + '_' + p.uid), p);
export const addLog = (l: Omit<GLog, 'id'>) => { const id = nid(); return setDoc(D('ge_log', id), { ...l, id }); };
export function watchLogs(cb: (l: GLog[]) => void) {
  if (!LIVE) return off; return onSnapshot(query(collection(db, 'ge_log'), orderBy('at', 'desc'), limit(300)), (s) => cb(s.docs.map((d) => d.data() as GLog)), () => cb([]));
}
export const deleteLog = (id: string) => deleteDoc(D('ge_log', id));
export async function players() {
  const s = await getDocs(query(collection(db, 'users'), where('role', '==', 'player')));
  return s.docs.map((d) => { const u = d.data(); return { uid: u.uid as string, name: (u.character?.name as string) || (u.username as string), user: u.username as string, avatar: (u.avatar as string) || '' }; });
}

// ---------- depo ----------
export function watchDepot(cb: (l: DepItem[]) => void) { return onSnapshot(collection(db, 'ge_dep'), (s) => cb(s.docs.map((d) => d.data() as DepItem)), () => cb([])); }
export const saveDep = (it: DepItem) => setDoc(D('ge_dep', it.id), it);
export async function deleteDep(it: DepItem) {
  const b = writeBatch(db); b.delete(D('ge_dep', it.id));
  if (it.img) for (let i = 0; i < it.img.n; i++) b.delete(D('ge_blob', it.img.id + '~' + i));
  await b.commit(); void idb('delete', it.img?.id ?? '');
}

// ---------- görseller: küçült → WebP → parçala; IndexedDB önbelleği ----------
const CH = 700_000; // base64 karakter/parça (< 1 MiB doküman)
const MAXD = 1600;
async function toWebp(src: Blob, max = MAXD, q = 0.86): Promise<{ data: string; w: number; h: number; blob: Blob }> {
  const bm = await createImageBitmap(src); const r = Math.min(1, max / Math.max(bm.width, bm.height));
  const w = Math.max(1, Math.round(bm.width * r)), h = Math.max(1, Math.round(bm.height * r));
  const c = new OffscreenCanvas(w, h); c.getContext('2d')!.drawImage(bm, 0, 0, w, h); bm.close();
  let blob = await c.convertToBlob({ type: 'image/webp', quality: q });
  for (let qq = q - 0.1; blob.size > 1_400_000 && qq > 0.5; qq -= 0.1) blob = await c.convertToBlob({ type: 'image/webp', quality: qq });
  return { data: await b64(blob), w, h, blob };
}
const b64 = (b: Blob) => new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(',')[1]); f.readAsDataURL(b); });
export async function thumbOf(src: Blob | HTMLCanvasElement, max = 160, q = 0.7) {
  const bm = await createImageBitmap(src); const r = Math.min(1, max / Math.max(bm.width, bm.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bm.width * r)); c.height = Math.max(1, Math.round(bm.height * r));
  c.getContext('2d')!.drawImage(bm, 0, 0, c.width, c.height); bm.close(); return c.toDataURL('image/webp', q);
}
export async function uploadImage(file: File, parent: string): Promise<DepItem> {
  const { data, w, h, blob } = await toWebp(file); const id = nid(), n = Math.ceil(data.length / CH);
  for (let i = 0; i < n; i += 4) { const b = writeBatch(db); for (let j = i; j < Math.min(n, i + 4); j++) b.set(D('ge_blob', id + '~' + j), { img: id, i: j, d: data.slice(j * CH, (j + 1) * CH) }); await b.commit(); }
  const it: DepItem = { id: nid(), kind: 'image', name: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80) || 'Görsel', parent, at: now(), img: { id, n, w, h }, size: Math.round(data.length * 1.0), thumb: await thumbOf(blob) };
  await saveDep(it); void idb('put', id, blob); return it;
}
let dbp: Promise<IDBDatabase> | null = null;
function idb(op: 'get' | 'put' | 'delete', k: string, v?: Blob): Promise<Blob | undefined> {
  if (!k || typeof indexedDB === 'undefined') return Promise.resolve(undefined);
  dbp ??= new Promise((r, j) => { const o = indexedDB.open('qv-gods', 1); o.onupgradeneeded = () => o.result.createObjectStore('img'); o.onsuccess = () => r(o.result); o.onerror = () => j(o.error); });
  return dbp.then((d) => new Promise<Blob | undefined>((r) => { const s = d.transaction('img', op === 'get' ? 'readonly' : 'readwrite').objectStore('img');
    const q = op === 'get' ? s.get(k) : op === 'put' ? s.put(v, k) : s.delete(k); q.onsuccess = () => r(op === 'get' ? (q.result as Blob | undefined) : undefined); q.onerror = () => r(undefined); })).catch(() => undefined);
}
const imgs = new Map<string, Promise<HTMLImageElement | null>>();
/** Görseli bellek → IndexedDB → Firestore sırasıyla getirir. */
export function loadImg(ref: ImgRef): Promise<HTMLImageElement | null> {
  let p = imgs.get(ref.id); if (p) return p;
  p = (async () => {
    let blob = await idb('get', ref.id);
    if (!blob) {
      const parts = await Promise.all(Array.from({ length: ref.n }, (_, i) => getDoc(D('ge_blob', ref.id + '~' + i)).then((s) => (s.data()?.d as string) ?? '')));
      if (parts.some((x) => !x)) throw new Error('eksik parça');
      const bin = atob(parts.join('')); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      blob = new Blob([u8], { type: 'image/webp' }); void idb('put', ref.id, blob);
    }
    const im = new Image(); im.src = URL.createObjectURL(blob); await im.decode(); return im;
  })().catch(() => { imgs.delete(ref.id); return null; });
  imgs.set(ref.id, p); return p;
}
/** Oyuncu portresi → 128 px yuvarlak jeton görseli (veri adresi). */
export async function tokenImg(avatar: string) {
  if (!avatar) return '';
  try { const im = new Image(); im.src = avatar; await im.decode(); const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d')!;
    const s = Math.min(im.width, im.height); g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.clip(); g.drawImage(im, (im.width - s) / 2, (im.height - s) * 0.3, s, s, 0, 0, S, S); return c.toDataURL('image/webp', 0.8); }
  catch { return ''; }
}
