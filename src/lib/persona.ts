/* Persona.ID — karakter kağıdı, envanter, krom, günlük. Oyuncu istatistiklerini değiştirmez; sadece harcanmamış puan ve envanter ekler. */
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './backend/firebase';
import { LIVE, nid, now, type Wallet } from './live';
import { RACE_GROUPS, CHROME_TIERS } from './data/character';

export const STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
export type StatId = (typeof STATS)[number];

export const ITEM_TYPES = [
  { id: 'weapon', label: 'Silah' }, { id: 'armor', label: 'Zırh' }, { id: 'throwable', label: 'Fırlatılık' },
  { id: 'consumable', label: 'Tüketilir' }, { id: 'gear', label: 'Ekipman' }, { id: 'misc', label: 'Misc' }, { id: 'other', label: 'Diğer' },
] as const;
export type ItemType = (typeof ITEM_TYPES)[number]['id'];

export const CHROME_SLOTS = [
  { id: 'brain', label: 'Frontal korteks', zone: 'head' },
  { id: 'os', label: 'İşletim sistemi', zone: 'head' },
  { id: 'face', label: 'Yüz', zone: 'head' },
  { id: 'nervous', label: 'Sinir sistemi', zone: 'torso' },
  { id: 'skeleton', label: 'İskelet', zone: 'torso' },
  { id: 'circulatory', label: 'Dolaşım', zone: 'torso' },
  { id: 'skin', label: 'Dış doku', zone: 'torso' },
  { id: 'arms', label: 'Kollar', zone: 'arm' },
  { id: 'hands', label: 'Eller', zone: 'arm' },
  { id: 'legs', label: 'Bacaklar', zone: 'leg' },
] as const;
export type ChromeSlot = (typeof CHROME_SLOTS)[number]['id'];

export const QUEST_KINDS = [
  { id: 'main', label: 'Ana görev' }, { id: 'side', label: 'Yan görev' },
  { id: 'faction', label: 'Hizip görevi' }, { id: 'group', label: 'Grup görevi' },
] as const;

export interface StatusFx { id: string; name: string; desc: string; kind: 'buff' | 'debuff' | 'cond'; at: number }
export interface Sheet {
  hp: number; kopus: number; unspent: number; lvlSeen: number; armor: number;
  status: StatusFx[]; wanted: Record<string, number>; reps: Record<string, number>; at: number;
}
export interface InvItem {
  id: string; name: string; kg: number; type: ItemType; qty: number;
  img?: string; note?: string; eq?: boolean; at: number;
}
export interface ChromePiece {
  id: string; slot: ChromeSlot; name: string; desc: string; stats?: string; img?: string; at: number;
}
export interface Quest {
  id: string; kind: (typeof QUEST_KINDS)[number]['id']; title: string; body: string;
  status: 'open' | 'done' | 'failed'; faction?: string; players: string[]; at: number;
}
export interface Bounty {
  id: string; name: string; by: string; amount: string; note?: string; players: string[]; at: number;
}
export interface NpcRel {
  id: string; name: string; score: number; note: string; players: string[]; at: number;
}

export const blankSheet = (level: number): Sheet => ({
  hp: -1, kopus: 0, unspent: 0, lvlSeen: Math.max(1, level || 1), armor: 0, status: [], wanted: {}, reps: {}, at: now(),
});

export function raceHp(race: string) {
  for (const g of RACE_GROUPS) for (const r of g.races) if (r.id === race) return r.hp;
  return 100;
}
export function maxHp(race: string, con: number) { return Math.max(1, raceHp(race) + (con - 10) * 5); }
export function maxCarry(str: number) { return Math.round(15 + str * 2.5); }
export function hardCarry(str: number) { return Math.round(maxCarry(str) * 1.5); }
export function chromeSlots(tier: string) {
  const t = CHROME_TIERS.find((x) => x.id === String(tier));
  const n = { '0': 0, '1': 2, '2': 4, '3': 6, '4': 9, '5': 12 }[String(tier)] ?? 0;
  return n;
}
export const hasChip = (tier: string | undefined) => !!tier && tier !== '0';
export const isDwarfRace = (race: string) => ['ondrum', 'vargrund', 'skarn', 'dolgrim', 'hrothmar'].includes(race);
export function poolPoints(level: number) { return 9 + 3 * (Math.max(1, level) - 1); }

export function syncLevel(sh: Sheet, level: number): Sheet {
  const lv = Math.max(1, level || 1);
  if (lv <= sh.lvlSeen) return sh;
  return { ...sh, unspent: sh.unspent + 3 * (lv - sh.lvlSeen), lvlSeen: lv };
}

export function carryOf(items: InvItem[]) { return items.reduce((a, it) => a + it.kg * it.qty, 0); }
export function armorOf(items: InvItem[], bonus: number) {
  return bonus + items.filter((i) => i.eq && i.type === 'armor').reduce((a, i) => a + Math.max(0, i.qty), 0);
}

const off = () => () => {};
export function watchSheet(uid: string, cb: (s: Sheet | null) => void) {
  if (!LIVE) return off();
  return onSnapshot(doc(db, 'persona', uid), (s) => cb(s.exists() ? (s.data() as Sheet) : null), () => cb(null));
}
export async function ensureSheet(uid: string, level: number) {
  if (!LIVE) return blankSheet(level);
  const r = doc(db, 'persona', uid);
  const s = await getDoc(r);
  if (!s.exists()) { const sh = blankSheet(level); await setDoc(r, sh); return sh; }
  const cur = s.data() as Sheet;
  const nx = syncLevel({ ...blankSheet(level), ...cur, status: cur.status ?? [], wanted: cur.wanted ?? {}, reps: cur.reps ?? {} }, level);
  if (nx.unspent !== cur.unspent || nx.lvlSeen !== cur.lvlSeen) await updateDoc(r, { unspent: nx.unspent, lvlSeen: nx.lvlSeen, at: now() });
  return nx;
}
export const saveSheet = (uid: string, patch: Partial<Sheet>) => setDoc(doc(db, 'persona', uid), { ...patch, at: now() }, { merge: true });

export function watchInv(uid: string, cb: (xs: InvItem[]) => void) {
  if (!LIVE) return off();
  return onSnapshot(collection(db, 'persona', uid, 'inv'), (s) => cb(s.docs.map((d) => ({ ...(d.data() as InvItem), id: d.id }))), () => cb([]));
}
export const saveItem = (uid: string, it: InvItem) => setDoc(doc(db, 'persona', uid, 'inv', it.id), it);
export const dropItem = (uid: string, id: string) => deleteDoc(doc(db, 'persona', uid, 'inv', id));

export function watchChrome(uid: string, cb: (xs: ChromePiece[]) => void) {
  if (!LIVE) return off();
  return onSnapshot(collection(db, 'persona', uid, 'chrome'), (s) => cb(s.docs.map((d) => ({ ...(d.data() as ChromePiece), id: d.id }))), () => cb([]));
}
export const saveChrome = (uid: string, c: ChromePiece) => setDoc(doc(db, 'persona', uid, 'chrome', c.id), c);
export const dropChrome = (uid: string, id: string) => deleteDoc(doc(db, 'persona', uid, 'chrome', id));

export function watchQuests(uid: string | null, cb: (xs: Quest[]) => void) {
  if (!LIVE) return off();
  return onSnapshot(collection(db, 'journal'), (s) => {
    const all = s.docs.map((d) => ({ ...(d.data() as Quest), id: d.id }));
    cb(uid ? all.filter((q) => q.players?.includes(uid)) : all);
  }, () => cb([]));
}
export const saveQuest = (q: Quest) => setDoc(doc(db, 'journal', q.id), q);
export const dropQuest = (id: string) => deleteDoc(doc(db, 'journal', id));

export function watchBounties(uid: string | null, cb: (xs: Bounty[]) => void) {
  if (!LIVE) return off();
  return onSnapshot(collection(db, 'bounties'), (s) => {
    const all = s.docs.map((d) => ({ ...(d.data() as Bounty), id: d.id }));
    cb(uid ? all.filter((q) => q.players?.includes(uid)) : all);
  }, () => cb([]));
}
export const saveBounty = (b: Bounty) => setDoc(doc(db, 'bounties', b.id), b);
export const dropBounty = (id: string) => deleteDoc(doc(db, 'bounties', id));

export function watchRels(uid: string | null, cb: (xs: NpcRel[]) => void) {
  if (!LIVE) return off();
  return onSnapshot(collection(db, 'rels'), (s) => {
    const all = s.docs.map((d) => ({ ...(d.data() as NpcRel), id: d.id }));
    cb(uid ? all.filter((q) => q.players?.includes(uid)) : all);
  }, () => cb([]));
}
export const saveRel = (r: NpcRel) => setDoc(doc(db, 'rels', r.id), r);
export const dropRel = (id: string) => deleteDoc(doc(db, 'rels', id));

export async function resetStats(uid: string, level: number) {
  const { updateDoc: up } = await import('firebase/firestore');
  await up(doc(db, 'users', uid), { 'character.stats': { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 } });
  await saveSheet(uid, { unspent: poolPoints(level), lvlSeen: Math.max(1, level) });
}

/** Seviye L → L+1 için gereken XP: L × 1000. Toplam XP'den seviye: (1+sqrt(1+8xp/1000))/2 */
export const xpToReach = (level: number) => Math.round(1000 * Math.max(0, level - 1) * level / 2);
export function levelFromXp(xp: number) {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + 8 * Math.max(0, xp) / 1000)) / 2));
}
export async function grantXp(uid: string, add: number, curLevel: number, curXp?: number | null) {
  const lv0 = Math.max(1, curLevel || 1);
  const base = curXp != null && curXp >= 0 ? curXp : xpToReach(lv0);
  const xp = Math.max(0, base + Math.round(add));
  const lv = levelFromXp(xp);
  await updateDoc(doc(db, 'users', uid), { 'character.xp': xp, 'character.level': lv });
  await ensureSheet(uid, lv);
  return { from: lv0, to: lv, xp, gained: Math.round(add) };
}

export const newItem = (): InvItem => ({ id: nid(), name: '', kg: 0.5, type: 'misc', qty: 1, at: now() });
export const moneyLine = (w: Wallet | null) => {
  if (!w?.bal) return '0 BK';
  return (['BK', 'Mark', 'Kantar'] as const).map((k) => `${w.bal[k] ?? 0} ${k === 'Mark' ? 'M' : k === 'Kantar' ? 'K' : 'BK'}`).join('  ·  ');
};
export { nid, now, writeBatch };
