/*
 * Yerel geliştirme / geçiş arka ucu (localStorage + IndexedDB).
 * Gerçek Firebase yapılandırması gelince src/lib/backend/index.ts bunu devre dışı bırakır.
 * DİKKAT: Bu dosyada hiçbir şifre yoktur. DungeonMaster kaydı şifresiz tohumlanır;
 * bir tarayıcıda ilk DM girişi, girilen şifreyi yalnız o tarayıcıda (tuzlu SHA-256) kaydeder.
 */
import type { Backend, Character, UserProfile, World , Note } from './types';
import { AuthError } from './types';

const K_USERS = 'qv.users.v1', K_SESSION = 'qv.session.v1';
type Rec = { profile: UserProfile; salt: string; hash: string | null };

const enc = new TextEncoder();
async function sha(salt: string, pw: string) {
  const b = await crypto.subtle.digest('SHA-256', enc.encode(salt + '\u0000' + pw));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const rnd = () => [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join('');
const norm = (u: string) => u.trim().toLowerCase();

function load(): Record<string, Rec> {
  let db: Record<string, Rec> = {};
  try { db = JSON.parse(localStorage.getItem(K_USERS) || '{}'); } catch { db = {}; }
  if (!db['dungeonmaster']) {
    db['dungeonmaster'] = {
      salt: rnd(), hash: null,
      profile: { uid: 'dm-0001', username: 'DungeonMaster', role: 'dm', avatar: import.meta.env.BASE_URL + 'img/dm-dice.webp',
        createdAt: Date.now(), character: null, file: null, desktop: { icons: {} }, apps: [] },
    };
    save(db);
  }
  return db;
}
function save(db: Record<string, Rec>) { localStorage.setItem(K_USERS, JSON.stringify(db)); }

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('qv-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function putFile(id: string, f: File) {
  const db = await idb();
  await new Promise<void>((res, rej) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put(f, id); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}

export const mockBackend: Backend = {
  kind: 'mock',
  async restore() {
    const s = localStorage.getItem(K_SESSION); if (!s) return null;
    const rec = Object.values(load()).find((r) => r.profile.uid === s);
    return rec ? rec.profile : null;
  },
  async login(username, password) {
    const db = load(); const rec = db[norm(username)];
    if (!rec) throw new AuthError('Kullanıcı bulunamadı.');
    if (rec.hash === null) {
      if (password.length < 8) throw new AuthError('Şifre en az 8 karakter olmalı.');
      rec.hash = await sha(rec.salt, password); save(db); // yalnız bu tarayıcıda ilk sahiplenme
    } else if ((await sha(rec.salt, password)) !== rec.hash) throw new AuthError('Erişim reddedildi: şifre hatalı.');
    localStorage.setItem(K_SESSION, rec.profile.uid);
    return rec.profile;
  },
  async register(username, password, avatar, character: Character, file) {
    const db = load(); const key = norm(username);
    if (db[key]) throw new AuthError('Bu kullanıcı adı alınmış.');
    const uid = 'u-' + rnd(); const salt = rnd();
    let meta = null;
    if (file) { const id = 'f-' + rnd(); await putFile(id, file); meta = { id, name: file.name, type: file.type, size: file.size, uploadedAt: Date.now() }; }
    const profile: UserProfile = { uid, username: username.trim(), role: 'player', avatar, createdAt: Date.now(), character, file: meta, desktop: { icons: {} }, apps: [] };
    db[key] = { profile, salt, hash: await sha(salt, password) }; save(db);
    localStorage.setItem(K_SESSION, uid);
    return profile;
  },
  async logout() { localStorage.removeItem(K_SESSION); },
  async patchProfile(uid, patch) {
    const db = load(); const rec = Object.values(db).find((r) => r.profile.uid === uid); if (!rec) return;
    rec.profile = { ...rec.profile, ...patch }; save(db);
  },
  async usernameTaken(u) { return !!load()[norm(u)]; },
  async world(): Promise<World> {
    try { const w = JSON.parse(localStorage.getItem('qv.world.v1') || 'null'); if (w) return w; } catch {}
    return { era: 'SS', year: 214, day: 1 };
  },
  // Notlar yerel depoda; gizli içerik anahtarları mock'ta yok (yalnız herkese açık bilgi).
  async listNotes(uid) { return JSON.parse(localStorage.getItem('qv.notes.' + uid) || '[]'); },
  async saveNote(uid, n) {
    const a: Note[] = JSON.parse(localStorage.getItem('qv.notes.' + uid) || '[]');
    const i = a.findIndex((x) => x.id === n.id); if (i >= 0) a[i] = n; else a.push(n);
    localStorage.setItem('qv.notes.' + uid, JSON.stringify(a));
  },
  async deleteNote(uid, id) {
    const a: Note[] = JSON.parse(localStorage.getItem('qv.notes.' + uid) || '[]');
    localStorage.setItem('qv.notes.' + uid, JSON.stringify(a.filter((x) => x.id !== id)));
  },
  async deleteAllNotes(uid) { localStorage.removeItem('qv.notes.' + uid); },
  async vaultKeys() { return []; },
  async worldEvents() { try { return JSON.parse(localStorage.getItem('qv.worldEvents') || 'null'); } catch { return null; } },
};
