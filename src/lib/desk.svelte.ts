// Masaüstü klasörleri ve kaydedilmiş görseller (oyuncu başına, Firestore users/{uid}/items).
import { backend, type DeskItem } from './backend';
import { session } from './session.svelte';
import { notes, updateNote } from './notes.svelte';
export const desk = $state({ items: [] as DeskItem[], loaded: false, toast: '' });
const uid = () => session.user!.uid;
const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const save = (it: DeskItem) => backend.saveItem(uid(), $state.snapshot(it) as DeskItem).catch((e) => { console.warn('desk save', e?.code ?? e); toast('Kaydedilemedi'); });
let tt: ReturnType<typeof setTimeout> | undefined;
export function toast(t: string) { desk.toast = t; clearTimeout(tt); tt = setTimeout(() => (desk.toast = ''), 2600); }
export async function loadItems() { if (!session.user) return; desk.items = await backend.listItems(uid()).catch((e) => { console.warn('desk load', e?.code ?? e); return []; }); desk.loaded = true; }
/** Masaüstünde boş ızgara hücresi (uygulama, not, öğe çakışmasın). */
export const GRID = { GX: 104, GY: 112, OX: 18, OY: 18 };
let taken: () => { x: number; y: number }[] = () => [];
export function setTakenProvider(f: () => { x: number; y: number }[]) { taken = f; }
export function freeCell(px = GRID.OX + GRID.GX, py = GRID.OY) {
  const { GX, GY, OX, OY } = GRID, maxY = innerHeight - 48 - GY, used = taken();
  let x = Math.max(OX, OX + Math.round((px - OX) / GX) * GX), y = Math.max(OY, OY + Math.round((py - OY) / GY) * GY);
  for (let n = 0; n < 400 && used.some((p) => p.x === x && p.y === y); n++) { y += GY; if (y > maxY) { y = OY; x += GX; } }
  return { x, y };
}
export async function createFolder(parent = '', at?: { x: number; y: number }) {
  const names = new Set(desk.items.filter((i) => i.parent === parent && i.kind === 'folder').map((i) => i.name));
  let name = 'Yeni klasör'; for (let k = 2; names.has(name); k++) name = `Yeni klasör (${k})`;
  const p = parent ? { x: 0, y: 0 } : freeCell(at?.x, at?.y);
  const it: DeskItem = { id: nid(), kind: 'folder', name, parent, x: p.x, y: p.y, updatedAt: Date.now() };
  desk.items.push(it); void save(it); return it.id;
}
export async function saveImage(src: string, name: string) {
  if (desk.items.some((i) => i.kind === 'image' && i.src === src && i.parent === '')) { toast('Bu görsel zaten masaüstünde'); return; }
  const p = freeCell(GRID.OX + GRID.GX, GRID.OY);
  const it: DeskItem = { id: nid(), kind: 'image', name: (name || 'Görsel').slice(0, 80), src, parent: '', x: p.x, y: p.y, updatedAt: Date.now() };
  desk.items.push(it); toast('Masaüstüne kaydedildi: ' + it.name); void save(it);
}
export function renameItem(id: string, name: string) {
  name = name.trim().slice(0, 80); if (!name) return;
  if (id.startsWith('note:')) { updateNote(id.slice(5), { title: name }, true); return; }
  const it = desk.items.find((i) => i.id === id); if (!it) return; it.name = name; it.updatedAt = Date.now(); save(it);
}
/** Öğeyi klasöre ya da masaüstüne taşı. Klasör kendi içine/altına taşınamaz. */
export function moveTo(id: string, parent: string, at?: { x: number; y: number }) {
  const p = parent ? { x: 0, y: 0 } : freeCell(at?.x, at?.y);
  if (id.startsWith('note:')) { const n = notes.list.find((x) => x.id === id.slice(5)); if (!n || (n.parent ?? '') === parent && parent) return; updateNote(n.id, { parent, x: p.x, y: p.y }, true); return; }
  const it = desk.items.find((i) => i.id === id); if (!it || it.id === parent) return;
  for (let q = parent; q; q = desk.items.find((i) => i.id === q)?.parent ?? '') if (q === it.id) return toast('Klasör kendi içine taşınamaz');
  if (it.parent === parent && parent) return;
  it.parent = parent; it.x = p.x; it.y = p.y; it.updatedAt = Date.now(); save(it);
}
export function placeItem(id: string, x: number, y: number) { const it = desk.items.find((i) => i.id === id); if (it) { it.x = x; it.y = y; save(it); } }
export async function removeItem(id: string) {
  const it = desk.items.find((i) => i.id === id); if (!it) return;
  if (it.kind === 'folder') { // içindekiler bir üst düzeye taşınır
    for (const c of desk.items.filter((i) => i.parent === id)) moveTo(c.id, it.parent);
    for (const n of notes.list.filter((n) => n.parent === id)) moveTo('note:' + n.id, it.parent);
  }
  desk.items = desk.items.filter((i) => i.id !== id); await backend.deleteItem(uid(), id).catch(() => {});
}
export const pathOf = (id: string) => { const out: DeskItem[] = []; for (let q = id; q; ) { const f = desk.items.find((i) => i.id === q); if (!f) break; out.unshift(f); q = f.parent; } return out; };
/** Sürükle-bırak: bırakılan noktadaki hedef (klasör simgesi / gezgin penceresi / masaüstü). */
export function dropTarget(x: number, y: number): { parent: string } | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null; if (!el) return null;
  const f = el.closest('[data-folder]') as HTMLElement | null; if (f) return { parent: f.dataset.folder! };
  const ex = el.closest('[data-explorer]') as HTMLElement | null; if (ex) return { parent: ex.dataset.explorer! };
  if (el.closest('[data-desk]')) return { parent: '' };
  return null;
}
