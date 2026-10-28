/*
 * Firebase (Spark) arka ucu. Kullanıcı adı → sahte e-posta: <ad>@qorves-sistem.firebaseapp.com (e-posta gönderilmez).
 * Background dosyası Cloud Storage yerine Firestore'da parça parça (base64) tutulur: users/{uid}/files/{id}/chunks/{n}.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, writeBatch, collection, getDocs, deleteDoc } from 'firebase/firestore';
import type { Backend, UserProfile, World, Note, VaultKey, WorldEvents, DeskItem } from './types';
import { AuthError } from './types';

export const firebaseConfig = {
  apiKey: 'AIzaSyBAUwur0_ufMJvpuxsEP6Pk5ucdjLeRmz0',
  authDomain: 'qorves-sistem.firebaseapp.com',
  projectId: 'qorves-sistem',
  storageBucket: 'qorves-sistem.firebasestorage.app',
  messagingSenderId: '285999705743',
  appId: '1:285999705743:web:ba86689beb5223757e8afa',
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const USER_RE = /^[a-z0-9][a-z0-9._-]{2,23}$/i;
export const toEmail = (u: string) => `${u.trim().toLowerCase()}@qorves-sistem.firebaseapp.com`;
const CHUNK = 600_000; // base64 karakter, < 1 MiB doküman sınırı

function msg(e: unknown): string {
  const c = (e as { code?: string })?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Erişim reddedildi: kullanıcı adı ya da şifre hatalı.';
  if (c.includes('email-already-in-use')) return 'Bu kullanıcı adı alınmış.';
  if (c.includes('weak-password')) return 'Şifre çok zayıf (en az 6 karakter).';
  if (c.includes('too-many-requests')) return 'Çok fazla deneme. Biraz bekle.';
  if (c.includes('network')) return 'Ağ bağlantısı yok.';
  return 'Sistem hatası: ' + (c || (e as Error)?.message || 'bilinmiyor');
}
async function readProfile(uid: string): Promise<UserProfile> {
  const s = await getDoc(doc(db, 'users', uid));
  if (!s.exists()) throw new AuthError('Profil kaydı bulunamadı.');
  return s.data() as UserProfile;
}
function b64(buf: ArrayBuffer) {
  let s = ''; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export const firebaseBackend: Backend = {
  kind: 'firebase',
  restore() {
    return new Promise((res) => {
      const off = onAuthStateChanged(auth, async (u) => {
        off();
        if (!u) return res(null);
        try { res(await readProfile(u.uid)); } catch { res(null); }
      });
    });
  },
  async login(username, password) {
    try { const c = await signInWithEmailAndPassword(auth, toEmail(username), password); return await readProfile(c.user.uid); }
    catch (e) { if (e instanceof AuthError) throw e; throw new AuthError(msg(e)); }
  },
  async register(username, password, avatar, character, file) {
    if (!USER_RE.test(username)) throw new AuthError('Kullanıcı adı 3–24 karakter: harf, rakam, . _ -');
    let uid = '';
    try { uid = (await createUserWithEmailAndPassword(auth, toEmail(username), password)).user.uid; }
    catch (e) { throw new AuthError(msg(e)); }
    let meta = null;
    if (file) {
      const id = 'f' + Date.now().toString(36);
      const data = b64(await file.arrayBuffer());
      const n = Math.ceil(data.length / CHUNK);
      for (let i = 0; i < n; i += 4) {
        const batch = writeBatch(db);
        for (let j = i; j < Math.min(n, i + 4); j++) batch.set(doc(db, 'users', uid, 'files', id, 'chunks', String(j)), { i: j, d: data.slice(j * CHUNK, (j + 1) * CHUNK) });
        await batch.commit();
      }
      meta = { id, name: file.name, type: file.type, size: file.size, uploadedAt: Date.now() };
      await setDoc(doc(db, 'users', uid, 'files', id), { ...meta, chunks: n });
    }
    const profile: UserProfile = { uid, username: username.trim(), role: 'player', avatar, createdAt: Date.now(), character, file: meta, desktop: { icons: {} }, apps: [] };
    await setDoc(doc(db, 'users', uid), profile);
    return profile;
  },
  async logout() { await signOut(auth); },
  async patchProfile(uid, patch) { await updateDoc(doc(db, 'users', uid), patch as Record<string, unknown>); },
  async usernameTaken() { return false; }, // Auth e-posta benzersizliği kayıtta zaten denetler
  async world(): Promise<World> {
    try { const s = await getDoc(doc(db, 'world', 'state')); if (s.exists()) return s.data() as World; } catch {}
    return { era: 'SS', year: 214, day: 1 };
  },
  async listNotes(uid) {
    const s = await getDocs(collection(db, 'users', uid, 'notes'));
    return s.docs.map((d) => ({ ...(d.data() as Note), id: d.id }));
  },
  async saveNote(uid, n) { await setDoc(doc(db, 'users', uid, 'notes', n.id), n); },
  async deleteNote(uid, id) { await deleteDoc(doc(db, 'users', uid, 'notes', id)); },
  async deleteAllNotes(uid) {
    const s = await getDocs(collection(db, 'users', uid, 'notes'));
    const b = writeBatch(db); s.docs.forEach((d) => b.delete(d.ref)); await b.commit();
  },
  async listItems(uid) {
    const s = await getDocs(collection(db, 'users', uid, 'items'));
    return s.docs.map((d) => ({ ...(d.data() as DeskItem), id: d.id }));
  },
  async saveItem(uid, it) { await setDoc(doc(db, 'users', uid, 'items', it.id), it); },
  async deleteItem(uid, id) { await deleteDoc(doc(db, 'users', uid, 'items', id)); },
  async vaultKeys(user) {
    if (user.role === 'dm') {
      const s = await getDocs(collection(db, 'vault'));
      return s.docs.map((d) => ({ id: d.id, ...(d.data() as { k: string; f: string }) }));
    }
    try {
      const g = await getDoc(doc(db, 'grants', user.uid));
      const ids: string[] = g.exists() ? (g.data().keys ?? []) : [];
      const out: VaultKey[] = [];
      for (const id of ids) { try { const v = await getDoc(doc(db, 'vault', id)); if (v.exists()) out.push({ id, ...(v.data() as { k: string; f: string }) }); } catch {} }
      return out;
    } catch { return []; }
  },
  async worldEvents() {
    try { const s = await getDoc(doc(db, 'world', 'events')); return s.exists() ? (s.data() as WorldEvents) : null; } catch { return null; }
  },
};
