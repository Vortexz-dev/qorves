// Gemi: tek ortak doküman (ship/main) + işlem kaydı (ship_log). Her düzenleme işlem (transaction) içinde doğrulanır.
import { doc, onSnapshot, runTransaction, setDoc, collection, query, orderBy, limit, addDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../lib/backend/firebase';
import { apply, startDoc, part, nameOf, slots, type ShipDoc, type Op, type Res } from './sys';
const REF = () => doc(db, 'ship', 'main');
export function watchShip(cb: (s: ShipDoc | null) => void) { return onSnapshot(REF(), (s) => cb(s.exists() ? (s.data() as ShipDoc) : null), () => cb(null)); }
/** Doküman yoksa başlangıç gemisini kurar (ilk açan kim olursa). */
export async function ensureShip(uid: string) {
  await runTransaction(db, async (tx) => { const s = await tx.get(REF()); if (!s.exists()) tx.set(REF(), { ...startDoc(), by: uid }); });
}
export interface ShipLog { id?: string; uid: string; name: string; op: string; text: string; at: number }
export function describe(s: ShipDoc, op: Op) {
  const sl = (k: string) => slots(s).find((x) => x.key === k); const own = (k: string) => (k.includes('#') ? ` (${nameOf(s.trailers.find((t) => t.k === k.split('#')[0])?.id ?? '')})` : '');
  switch (op.t) {
    case 'fit': return `${nameOf(op.id)} → ${sl(op.slot)?.label ?? op.slot}${own(op.slot)}`;
    case 'unfit': return `${nameOf(s.fit[op.slot] ?? '')} söküldü (${sl(op.slot)?.label ?? op.slot}${own(op.slot)})`;
    case 'engine': return `Motor: ${nameOf(s.engine)} → ${nameOf(op.id)}`;
    case 'core': return `Çekirdek: ${nameOf(s.core)} → ${nameOf(op.id)}`;
    case 'attach': return `Dorse bağlandı: ${nameOf(op.id)}`;
    case 'detach': return `Dorse ayrıldı: ${nameOf(s.trailers.find((t) => t.k === op.k)?.id ?? '')}`;
    case 'cargo': return `Yük eklendi: ${op.c.name} (${op.c.mass} t)`;
    case 'uncargo': return `Yük çıkarıldı: ${s.cargo.find((c) => c.id === op.id)?.name ?? ''}`;
  }
}
/** Düzenleme: güncel dokümanı okur, kuralları uygular, yazar. Aynı anda iki düzenleme olursa Firestore biri bitene kadar diğerini yeniden dener. */
export async function runOp(op: Op, who: { uid: string; name: string }): Promise<Res> {
  let res: Res = { ok: false }, text = '';
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(REF()); const cur = snap.exists() ? (snap.data() as ShipDoc) : startDoc();
    res = apply(cur, op); if (!res.ok || !res.next) return;
    text = describe(cur, op) ?? ''; tx.set(REF(), { ...res.next, rev: (cur.rev ?? 0) + 1, at: Date.now(), by: who.uid });
  });
  if (res.ok) void addDoc(collection(db, 'ship_log'), { uid: who.uid, name: who.name, op: op.t, text, at: Date.now() } satisfies ShipLog).catch(() => {});
  return res;
}
// ---------- DM ----------
export async function dmPatch(patch: Partial<ShipDoc>, who: { uid: string; name: string }, text: string) {
  await runTransaction(db, async (tx) => { const s = await tx.get(REF()); const cur = s.exists() ? (s.data() as ShipDoc) : startDoc(); tx.set(REF(), { ...cur, ...patch, rev: (cur.rev ?? 0) + 1, at: Date.now(), by: who.uid }); });
  void addDoc(collection(db, 'ship_log'), { uid: who.uid, name: who.name, op: 'dm', text, at: Date.now() }).catch(() => {});
}
export async function dmGrant(id: string, n: number, who: { uid: string; name: string }) {
  await runTransaction(db, async (tx) => { const s = await tx.get(REF()); const cur = s.exists() ? (s.data() as ShipDoc) : startDoc(); const inv = { ...cur.inv }; inv[id] = Math.max(0, (inv[id] ?? 0) + n); if (!inv[id]) delete inv[id];
    tx.set(REF(), { ...cur, inv, rev: (cur.rev ?? 0) + 1, at: Date.now(), by: who.uid }); });
  void addDoc(collection(db, 'ship_log'), { uid: who.uid, name: who.name, op: 'dm', text: `${n > 0 ? 'Depoya verildi' : 'Depodan alındı'}: ${part(id)?.model ?? id}${Math.abs(n) > 1 ? ' ×' + Math.abs(n) : ''}`, at: Date.now() }).catch(() => {});
}
export const dmReset = (who: { uid: string; name: string }) => setDoc(REF(), { ...startDoc(), by: who.uid }).then(() => addDoc(collection(db, 'ship_log'), { uid: who.uid, name: who.name, op: 'dm', text: 'Gemi başlangıç durumuna sıfırlandı', at: Date.now() }));
export function watchShipLog(cb: (l: ShipLog[]) => void) { return onSnapshot(query(collection(db, 'ship_log'), orderBy('at', 'desc'), limit(200)), (s) => cb(s.docs.map((d) => ({ ...(d.data() as ShipLog), id: d.id }))), () => cb([])); }
export async function clearShipLog() { for (const d of (await getDocs(collection(db, 'ship_log'))).docs) await deleteDoc(d.ref); }

// ---------- iç plan jetonları: her oyuncunun bir jetonu (ship_tok/{uid}) ----------
export interface ShipTok { uid: string; name: string; img: string; col: string; x: number; y: number; f: number; at: number }
export function watchToks(cb: (l: ShipTok[]) => void) { return onSnapshot(collection(db, 'ship_tok'), (s) => cb(s.docs.map((d) => d.data() as ShipTok)), () => cb([])); }
export const saveTok = (t: ShipTok) => setDoc(doc(db, 'ship_tok', t.uid), t);
export const moveTok = (uid: string, x: number, y: number, f: number) => updateDoc(doc(db, 'ship_tok', uid), { x, y, f, at: Date.now() });
export const dropTok = (uid: string) => deleteDoc(doc(db, 'ship_tok', uid));
