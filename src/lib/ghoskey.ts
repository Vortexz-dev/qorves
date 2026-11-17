/* ghOS-Key: DM ağları, saldırı kaydı, oyuncu PC'sine karşı saldırı. */
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from './backend/firebase';
import { LIVE, nid, now } from './live';

export const GAMES = [
  { id: 'breach', label: 'İhlal Protokolü' },
  { id: 'circuit', label: 'Devre Akışı' },
  { id: 'kernel', label: 'K3RN3LC0MP1L3R' },
  { id: 'memde', label: 'memDEALLOCATER' },
  { id: 'shift', label: 'shiftSEQ' },
  { id: 'token', label: 'TOKENINE' },
  { id: 'tunnel', label: 'Veri Tüneli' },
] as const;
export type GameId = (typeof GAMES)[number]['id'];

export interface Net {
  id: string; name: string; signal: number; diff: number; game?: GameId | '';
  players: string[]; note?: string; decoy?: boolean; at: number;
}
export interface HackLog {
  id: string; uid: string; net?: string; name: string; game: GameId; ok: boolean; diff: number; at: number; kind: 'out' | 'def';
}
export interface Atk { id: string; uid: string; game: GameId | ''; diff: number; signal?: number; at: number; done?: boolean; ok?: boolean }

export const randGame = (): GameId => GAMES[Math.floor(Math.random() * GAMES.length)].id;
export const gameLabel = (id: string) => GAMES.find((g) => g.id === id)?.label ?? id;

/** Sinyal 1–5; düşük sinyal zorluğu yükseltir (süre kısar, glitch artar). */
export function effectiveDiff(diff: number, signal: number) {
  const s = Math.max(1, Math.min(5, signal));
  return Math.max(1, Math.min(5, Math.round(diff + (3 - s) * 0.5)));
}

const off = () => () => {};
export function watchNets(uid: string | null, cb: (xs: Net[]) => void) {
  if (!LIVE) return off();
  const qy = uid ? query(collection(db, 'hacknet'), where('players', 'array-contains', uid)) : collection(db, 'hacknet');
  return onSnapshot(qy, (s) => cb(s.docs.map((d) => ({ ...(d.data() as Net), id: d.id }))), () => cb([]));
}
export const saveNet = (n: Net) => setDoc(doc(db, 'hacknet', n.id), n);
export const dropNet = (id: string) => deleteDoc(doc(db, 'hacknet', id));
export const blankNet = (): Net => ({ id: nid(), name: '', signal: 4, diff: 2, game: '', players: [], at: now() });

export function watchLogs(uid: string | null, cb: (xs: HackLog[]) => void) {
  if (!LIVE) return off();
  const qy = uid ? query(collection(db, 'hacklog'), where('uid', '==', uid)) : collection(db, 'hacklog');
  return onSnapshot(qy, (s) => cb(s.docs.map((d) => ({ ...(d.data() as HackLog), id: d.id })).sort((a, b) => b.at - a.at)), () => cb([]));
}
export const writeLog = (l: Omit<HackLog, 'id' | 'at'> & { id?: string; at?: number }) => {
  const id = l.id || nid();
  return setDoc(doc(db, 'hacklog', id), { ...l, id, at: l.at ?? now() });
};

export function watchAtk(cb: (a: Atk | null) => void) {
  if (!LIVE) return off();
  return onSnapshot(doc(db, 'world', 'hackatk'), (s) => cb(s.exists() ? (s.data() as Atk) : null), () => cb(null));
}
export const sendAtk = (a: Omit<Atk, 'id' | 'at' | 'done'>) => setDoc(doc(db, 'world', 'hackatk'), { ...a, id: nid(), at: now(), done: false });
export const resolveAtk = (ok: boolean) => setDoc(doc(db, 'world', 'hackatk'), { done: true, ok, at: now() }, { merge: true });
export const clearAtk = () => setDoc(doc(db, 'world', 'hackatk'), { uid: '', done: true, at: now() }, { merge: true });

export const DECOYS: { name: string; signal: number }[] = [
  { name: '█▓▒░///???.net', signal: 1 }, { name: 'ORTH-relay#??', signal: 1 },
  { name: 'ssdp://0.0.0.0', signal: 2 }, { name: 'HAT-KIRIĞI', signal: 1 },
  { name: 'prae.ghost (düşük)', signal: 1 },
];
export const DECOY_POOL = [
  '█▓▒░///???.net', 'ORTH-relay#??', 'ssdp://0.0.0.0', 'HAT-KIRIĞI', 'prae.ghost (düşük)',
  'NUL-GATE ::drop', 'MESH/black.line', 'icmp://void', 'KANTAR-echo??', 'cellax.whisper',
  'YILDIZ-fail', 'boot://lost-tty', 'FENER-0x00', 'gümrük.spoof', '???-HROTH-loop',
  'saelis.hole', 'north.static', 'relay#DEAD', '0x7f.ghostnet', 'kor.gece.bak',
];
