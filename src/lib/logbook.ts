/*
 * Seyir Defteri: oyuncu başına oturum notları. users/{uid}/logs/{sid} { n, sub, at, pages: [{ id, t }] } + users/{uid}/logs/{sid}/p/{pid} { h, at }.
 * Kurallar: yalnız sahibi yazar; sahibi ve DM okur.
 */
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, writeBatch } from 'firebase/firestore';
import { db } from './backend/firebase';
import { backend } from './backend';
const LIVE = backend.kind === 'firebase';
export interface LogPage { id: string; t: string }
export interface LogSession { id: string; n: number; sub: string; at: number; pages: LogPage[] }
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const mem = new Map<string, LogSession>(), memP = new Map<string, string>(); // ?mock=1
export const sessName = (s: LogSession) => `Session ${s.n}` + (s.sub ? ' - ' + s.sub : '');
export async function listSessions(uid: string): Promise<LogSession[]> {
  if (!LIVE) return [...mem.values()].sort((a, b) => b.n - a.n);
  const s = await getDocs(collection(db, 'users', uid, 'logs'));
  return s.docs.map((d) => ({ ...(d.data() as LogSession), id: d.id })).sort((a, b) => b.n - a.n);
}
export async function createSession(uid: string, existing: LogSession[]): Promise<LogSession> {
  const n = existing.reduce((m, s) => Math.max(m, s.n), 0) + 1;
  const s: LogSession = { id: nid(), n, sub: '', at: Date.now(), pages: [{ id: nid(), t: '' }] };
  await saveMeta(uid, s); return s;
}
export async function saveMeta(uid: string, s: LogSession) {
  const { id, ...d } = s; d.sub = d.sub.slice(0, 80); d.at = Date.now();
  if (!LIVE) { mem.set(id, { ...s }); return; }
  await setDoc(doc(db, 'users', uid, 'logs', id), d);
}
export async function loadPage(uid: string, sid: string, pid: string): Promise<string> {
  if (!LIVE) return memP.get(sid + pid) ?? '';
  const s = await getDoc(doc(db, 'users', uid, 'logs', sid, 'p', pid));
  return s.exists() ? (s.data().h as string) ?? '' : '';
}
export async function savePage(uid: string, sid: string, pid: string, h: string) {
  if (h.length > 300000) throw new Error('Sayfa çok uzun');
  if (!LIVE) { memP.set(sid + pid, h); return; }
  await setDoc(doc(db, 'users', uid, 'logs', sid, 'p', pid), { h, at: Date.now() });
}
export async function deletePage(uid: string, s: LogSession, pid: string) {
  s.pages = s.pages.filter((p) => p.id !== pid); await saveMeta(uid, s);
  if (LIVE) await deleteDoc(doc(db, 'users', uid, 'logs', s.id, 'p', pid)).catch(() => {});
}
export async function deleteSession(uid: string, s: LogSession) {
  if (!LIVE) { mem.delete(s.id); return; }
  const b = writeBatch(db); for (const p of s.pages) b.delete(doc(db, 'users', uid, 'logs', s.id, 'p', p.id)); b.delete(doc(db, 'users', uid, 'logs', s.id)); await b.commit();
}
/** Yapıştırılan/kaydedilen HTML'i süz: yalnız biçim etiketleri, renk ve vurgu stilleri kalır. */
const TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'SPAN', 'FONT', 'H1', 'H2', 'H3', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'MARK']);
const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;
export function clean(html: string): string {
  const d = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html'), root = d.body.firstElementChild!;
  const walk = (el: Element) => {
    for (const c of [...el.children]) {
      if (!TAGS.has(c.tagName)) { if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|svg|SVG|IMG|VIDEO|AUDIO|LINK|META)$/.test(c.tagName)) { c.remove(); continue; } c.replaceWith(...c.childNodes); walk(el); return; }
      const col = (c as HTMLElement).style?.color, bg = (c as HTMLElement).style?.backgroundColor, fc = c.getAttribute('color');
      for (const a of [...c.attributes]) c.removeAttribute(a.name);
      const st: string[] = []; if (col && COLOR.test(col.replace(/\s/g, ''))) st.push('color:' + col); if (bg && COLOR.test(bg.replace(/\s/g, ''))) st.push('background-color:' + bg);
      if (fc && COLOR.test(fc)) st.push('color:' + fc);
      if (st.length) c.setAttribute('style', st.join(';'));
      walk(c);
    }
  };
  walk(root); return root.innerHTML;
}
