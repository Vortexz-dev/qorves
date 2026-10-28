// DM Paneli ortak durumu: oyuncu listesi, seçili oyuncu, harita verisi.
import { listUsers, watchPresence, type Presence } from '../../lib/live';
import type { UserProfile } from '../../lib/backend';
export interface SysLite { id: string; name: string; owner: string }
export interface LaneLite { id: string; name: string; a: string; b: string }
export const dm = $state({ users: [] as UserProfile[], pres: [] as Presence[], pid: '', systems: [] as SysLite[], lanes: [] as LaneLite[], loaded: false });
let stopP: (() => void) | null = null;
export async function loadDm() {
  stopP?.(); stopP = watchPresence((p) => (dm.pres = p));
  const [u, m] = await Promise.all([listUsers(), fetch(import.meta.env.BASE_URL + 'data/starmap.json').then((r) => r.json())]);
  dm.users = u.filter((x) => x.role !== 'dm').sort((a, b) => (b.lastLogin ?? 0) - (a.lastLogin ?? 0));
  dm.systems = (m.systems as SysLite[]).map((s) => ({ id: s.id, name: s.name, owner: s.owner })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  dm.lanes = (m.lanes as LaneLite[]).map((l) => ({ id: l.id, name: l.name, a: l.a, b: l.b }));
  if (!dm.pid && dm.users[0]) dm.pid = dm.users[0].uid;
  dm.loaded = true;
}
export function stopDm() { stopP?.(); stopP = null; }
export const pname = (uid: string) => { const u = dm.users.find((x) => x.uid === uid); return u ? (u.character?.name ? `${u.character.name} (@${u.username})` : '@' + u.username) : uid.slice(0, 6); };
export const sysName = (id: string) => dm.systems.find((s) => s.id === id)?.name ?? id;
export const when = (t?: number) => (t ? new Date(t).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
