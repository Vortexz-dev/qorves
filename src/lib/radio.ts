/* DM radyosu: YouTube + Firestore'a parçalı MP3 (Spark, Cloud Storage yok). Senkron play/pause/seek/volume/loop. */
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from './backend/firebase';
import { LIVE, nid, now } from './live';

export const MP3_MAX = 8 * 1024 * 1024; // 8 MiB / parça; 128 kbps ≈ 8 dk
export const CHUNK = 600_000;
export type TrackKind = 'yt' | 'mp3';
export interface Track { id: string; kind: TrackKind; title: string; src: string; dur?: number }
export interface RadioState {
  playing: boolean; i: number; pos: number; t0: number; vol: number; loop: boolean;
  list: Track[]; at: number;
}
export interface OneShot { id: string; kind: TrackKind; src: string; title: string; at: number }
export const emptyRadio = (): RadioState => ({ playing: false, i: 0, pos: 0, t0: now(), vol: 0.7, loop: false, list: [], at: now() });

export function parseYt(url: string): { video?: string; list?: string } | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    let video = u.searchParams.get('v') || undefined;
    const list = u.searchParams.get('list') || undefined;
    if (host === 'youtu.be') video = u.pathname.slice(1).split('/')[0] || video;
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const m = u.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
      if (m) video = m[1];
    }
    if (!video && !list) return null;
    return { video, list };
  } catch { return null; }
}

const off = () => () => {};
export function watchRadio(cb: (s: RadioState | null) => void) {
  if (!LIVE) return off();
  return onSnapshot(doc(db, 'world', 'radio'), (s) => cb(s.exists() ? (s.data() as RadioState) : null), () => cb(null));
}
export const setRadio = (patch: Partial<RadioState>) => setDoc(doc(db, 'world', 'radio'), { ...patch, at: now() }, { merge: true });

export function watchShot(cb: (s: OneShot | null) => void) {
  if (!LIVE) return off();
  return onSnapshot(doc(db, 'world', 'oneshot'), (s) => cb(s.exists() ? (s.data() as OneShot) : null), () => cb(null));
}
export const fireShot = (s: Omit<OneShot, 'id' | 'at'>) => setDoc(doc(db, 'world', 'oneshot'), { ...s, id: nid(), at: now() });

function b64(buf: ArrayBuffer) {
  let s = ''; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function uploadMp3(file: File): Promise<Track> {
  if (file.size > MP3_MAX) throw new Error(`Dosya ${MP3_MAX / 1024 / 1024} MB sınırını aşıyor.`);
  const id = 'a' + nid();
  const data = b64(await file.arrayBuffer());
  const n = Math.ceil(data.length / CHUNK);
  for (let i = 0; i < n; i += 4) {
    const b = writeBatch(db);
    for (let j = i; j < Math.min(n, i + 4); j++) b.set(doc(db, 'radio_files', id, 'chunks', String(j)), { i: j, d: data.slice(j * CHUNK, (j + 1) * CHUNK) });
    await b.commit();
  }
  const meta = { id, name: file.name, type: file.type || 'audio/mpeg', size: file.size, chunks: n, at: now() };
  await setDoc(doc(db, 'radio_files', id), meta);
  return { id, kind: 'mp3', title: file.name.replace(/\.[^.]+$/, ''), src: id };
}

export async function loadMp3(id: string): Promise<string | null> {
  const m = await getDoc(doc(db, 'radio_files', id)); if (!m.exists()) return null;
  const meta = m.data() as { chunks: number; type?: string };
  const parts: string[] = [];
  for (let i = 0; i < meta.chunks; i++) { const c = await getDoc(doc(db, 'radio_files', id, 'chunks', String(i))); parts.push(c.data()?.d ?? ''); }
  const bin = atob(parts.join('')); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([u8], { type: meta.type || 'audio/mpeg' }));
}

export async function dropMp3(id: string) {
  const m = await getDoc(doc(db, 'radio_files', id)); if (!m.exists()) return;
  const n = (m.data() as { chunks: number }).chunks || 0;
  const b = writeBatch(db);
  for (let i = 0; i < n; i++) b.delete(doc(db, 'radio_files', id, 'chunks', String(i)));
  b.delete(doc(db, 'radio_files', id));
  await b.commit();
}

export async function listMp3(): Promise<{ id: string; name: string; size: number }[]> {
  const s = await getDocs(collection(db, 'radio_files'));
  return s.docs.map((d) => { const x = d.data() as { name: string; size: number }; return { id: d.id, name: x.name, size: x.size }; });
}

/** Yayındaki gerçek konum (sunucu pos + geçen süre). */
export function radioPos(s: RadioState) {
  if (!s.playing) return s.pos;
  return Math.max(0, s.pos + (now() - s.t0) / 1000);
}
