import { backend, type Note } from './backend';
import { session } from './session.svelte';
export const notes = $state({ list: [] as Note[], loaded: false });
const timers = new Map<string, ReturnType<typeof setTimeout>>();
export async function loadNotes() {
  const u = session.user; if (!u) return;
  notes.list = await backend.listNotes(u.uid).catch(() => []); notes.loaded = true;
}
export async function createNote(x: number, y: number) {
  const n: Note = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: 'Yeni not', body: '', x, y, updatedAt: Date.now() };
  notes.list.push(n); await backend.saveNote(session.user!.uid, n); return n.id;
}
export function updateNote(id: string, patch: Partial<Note>, now = false) {
  const n = notes.list.find((x) => x.id === id); if (!n) return;
  Object.assign(n, patch, { updatedAt: Date.now() });
  clearTimeout(timers.get(id));
  const go = () => backend.saveNote(session.user!.uid, $state.snapshot(n) as Note).catch(() => {});
  if (now) go(); else timers.set(id, setTimeout(go, 700));
}
export async function removeNote(id: string) {
  notes.list = notes.list.filter((x) => x.id !== id); await backend.deleteNote(session.user!.uid, id).catch(() => {});
}
export async function removeAllNotes() { notes.list = []; await backend.deleteAllNotes(session.user!.uid).catch(() => {}); }
