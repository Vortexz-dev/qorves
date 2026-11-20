/* Starmap oyuncu notları ve işaretleri (mapnotes/{id}).
   Görünürlük: 'pub' → herkes, 'priv' → yalnız yazan + DM. Kurallar firestore.rules › mapnotes.
   Okuma: DM tüm koleksiyon; oyuncu iki dar sorgu (herkese açık + kendi notları). Yazma yalnız kaydet/sil anında. */
import { collection, doc, onSnapshot, query, setDoc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../lib/backend/firebase';
import { LIVE, nid } from '../lib/live';

export type NoteVis = 'pub' | 'priv';
export type NoteIcon = 'pin' | 'note' | 'flag' | 'eye' | 'skull' | 'cache';
export interface MapNote {
  id: string; uid: string; by: string; sys: string; body?: string;
  x?: number; y?: number; z?: number;
  icon: NoteIcon; col: string; label: string; text: string; vis: NoteVis;
  at: number; upd: number;
}
export const NOTE_ICONS: { id: NoteIcon; g: string; l: string }[] = [
  { id: 'pin', g: '◆', l: 'İşaret' }, { id: 'note', g: '✎', l: 'Not' }, { id: 'flag', g: '⚑', l: 'Bayrak' },
  { id: 'eye', g: '◉', l: 'Gözlem' }, { id: 'skull', g: '☠', l: 'Tehlike' }, { id: 'cache', g: '▣', l: 'Zula' },
];
export const NOTE_COLS = ['#00f0ff', '#fcee0a', '#ff2a6d', '#39ff8a', '#b06bff', '#ff9b2f'];
export const glyph = (i: string) => NOTE_ICONS.find((x) => x.id === i)?.g ?? '◆';
export const LABEL_MAX = 60, TEXT_MAX = 600;

const off = () => {};
/** DM: hepsi. Oyuncu: herkese açık + kendi (özel dahil). İki sorgu birleştirilir. */
export function watchNotes(uid: string, dm: boolean, cb: (xs: MapNote[]) => void) {
  if (!LIVE) return off;
  const col = collection(db, 'mapnotes');
  const map = (s: { docs: { id: string; data: () => unknown }[] }) => s.docs.map((d) => ({ ...(d.data() as MapNote), id: d.id }));
  if (dm) return onSnapshot(col, (s) => cb(map(s)), () => cb([]));
  let a: MapNote[] = [], b: MapNote[] = [];
  const emit = () => { const m = new Map<string, MapNote>(); for (const n of [...a, ...b]) m.set(n.id, n); cb([...m.values()]); };
  const s1 = onSnapshot(query(col, where('vis', '==', 'pub')), (s) => { a = map(s); emit(); }, () => { a = []; emit(); });
  const s2 = onSnapshot(query(col, where('uid', '==', uid)), (s) => { b = map(s); emit(); }, () => { b = []; emit(); });
  return () => { s1(); s2(); };
}
export function blankNote(uid: string, by: string, sys: string, p: Partial<MapNote> = {}): MapNote {
  const t = Date.now();
  return { id: nid(), uid, by, sys, icon: 'note', col: NOTE_COLS[0], label: '', text: '', vis: 'pub', at: t, upd: t, ...p };
}
/** Yalnız izinli alanlar yazılır (kurallar hasOnly ile denetler). */
export function saveNote(n: MapNote) {
  const o: Record<string, unknown> = { id: n.id, uid: n.uid, by: n.by.slice(0, 48), sys: n.sys, icon: n.icon, col: n.col, label: n.label.trim().slice(0, LABEL_MAX), text: n.text.slice(0, TEXT_MAX), vis: n.vis, at: n.at, upd: Date.now() };
  if (n.body) o.body = n.body;
  for (const k of ['x', 'y', 'z'] as const) if (typeof n[k] === 'number' && isFinite(n[k]!)) o[k] = Math.round(n[k]! * 100) / 100;
  return setDoc(doc(db, 'mapnotes', n.id), o);
}
export const dropNote = (id: string) => deleteDoc(doc(db, 'mapnotes', id));
/** Yazara göre sabit renk tonu (kimlik ipucu). */
export function authorHue(uid: string) { let h = 0; for (const c of uid) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
export function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'şimdi'; if (m < 60) return m + ' dk önce'; const h = Math.round(m / 60); if (h < 24) return h + ' sa önce';
  const d = Math.round(h / 24); return d < 30 ? d + ' gün önce' : new Date(t).toLocaleDateString('tr-TR');
}
