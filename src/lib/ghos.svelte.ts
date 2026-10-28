// ghOS-Net ortak durumu: konuşmalar, kişiler, okunmamış sayısı (masaüstü rozeti ve bildirim için).
import { watchConvs, watchPresence, watchNpcs, unreadFor, type Conv, type Presence, type Npc } from './live';
export const ghos = $state({ convs: [] as Conv[], people: [] as Presence[], npcs: [] as Npc[], unread: 0, ping: 0 });
let stops: (() => void)[] = [];
let seen = new Map<string, number>();
export function startGhos(uid: string, dm: boolean, onNew: (c: Conv) => void) {
  stopGhos(); let first = true;
  stops.push(watchPresence((p) => (ghos.people = p)));
  stops.push(watchNpcs((n) => (ghos.npcs = n)));
  stops.push(watchConvs(dm ? null : uid, (c) => {
    ghos.convs = c;
    const me = (x: Conv) => (dm && x.npc ? 'npc:' + x.npc : uid);
    ghos.unread = c.filter((x) => (dm ? !!x.npc : true) && unreadFor(x, me(x))).length;
    for (const x of c) { const at = x.last?.at ?? 0, was = seen.get(x.id) ?? 0;
      if (!first && (!dm || !!x.npc) && at > was && x.last && x.last.from !== me(x) && unreadFor(x, me(x))) onNew(x); seen.set(x.id, at); }
    first = false;
  }));
}
export function stopGhos() { stops.forEach((f) => f()); stops = []; seen = new Map(); ghos.convs = []; ghos.unread = 0; }
