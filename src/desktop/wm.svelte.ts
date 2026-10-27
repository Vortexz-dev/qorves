import { appById } from './apps';
import { sfx } from '../lib/sfx';
export interface Win { id: number; app: string; x: number; y: number; w: number; h: number; z: number; min: boolean; max: boolean; closing?: boolean }
export const wm = $state<{ wins: Win[]; core: string | null; coreClosing: boolean; z: number; focus: number; start: boolean }>(
  { wins: [], core: null, coreClosing: false, z: 10, focus: -1, start: false });
let seq = 1;
export function openApp(id: string) {
  wm.start = false;
  const a = appById(id);
  if (a.core) { if (wm.core !== id) { wm.core = id; wm.coreClosing = false; sfx.open(); } return; }
  const ex = wm.wins.find((w) => w.app === id);
  if (ex) { ex.min = false; focus(ex.id); return; }
  const W = innerWidth, H = innerHeight - 48, w = Math.min(a.w ?? 720, W - 40), h = Math.min(a.h ?? 520, H - 40);
  const n = wm.wins.length;
  wm.wins.push({ id: seq++, app: id, w, h, x: Math.round((W - w) / 2 + n * 28 - 40), y: Math.round((H - h) / 2 + n * 24 - 30), z: ++wm.z, min: false, max: false });
  wm.focus = seq - 1; sfx.open();
}
export function focus(id: number) { const w = wm.wins.find((x) => x.id === id); if (w) { w.z = ++wm.z; wm.focus = id; } }
export function closeWin(id: number) {
  const w = wm.wins.find((x) => x.id === id); if (!w || w.closing) return;
  w.closing = true; sfx.close();
  setTimeout(() => { wm.wins = wm.wins.filter((x) => x.id !== id); }, 180);
}
export function minimize(id: number) { const w = wm.wins.find((x) => x.id === id); if (w) { w.min = true; wm.focus = -1; sfx.close(); } }
export function toggleTask(id: number) {
  const w = wm.wins.find((x) => x.id === id); if (!w) return;
  if (w.min) { w.min = false; focus(id); sfx.open(); } else if (wm.focus === id) minimize(id); else focus(id);
}
export function closeCore() {
  if (!wm.core || wm.coreClosing) return;
  wm.coreClosing = true; sfx.close();
  setTimeout(() => { wm.core = null; wm.coreClosing = false; }, 420);
}
export function resetWM() { wm.wins = []; wm.core = null; wm.start = false; }
