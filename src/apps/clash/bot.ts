/* Bot: oyuncuyla aynı komut arayüzü (hile yok: aynı el, iksir ve yerleştirme kuralları). Kart etiketlerine göre oynar,
   böylece 30 kartın hepsini anlamlı kullanır. level 1–5: tepki süresi, hata payı ve kombo kullanımı. */
import { CARD, type Card } from './cards';
import { canDeploy, hand, RIVER, W, type Cmd, type Ent, type Side, type State } from './engine';

export function makeBot(side: Side, seed: number, level = 2) {
  let a = seed >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  let wait = 40, n = 0, pushLane = r() < 0.5 ? 0 : 1, lastWin = -999;
  const me = side, foe = (1 - side) as Side, dir = side === 0 ? -1 : 1;
  const ownHalf = (y: number) => (side === 0 ? y > RIVER : y < RIVER);
  const back = side === 0 ? 29.5 : 2.5, bridge = side === 0 ? 17.5 : 14.5;
  const react = Math.max(4, 18 - level * 3), sloppy = Math.max(0, 0.25 - level * 0.05);
  const has = (c: Card, t: string) => (c.tags as string[]).includes(t);
  return function think(s: State): Cmd | null {
    if (--wait > 0 || s.over) return null;
    wait = Math.round(react + r() * 12);
    const el = s.elix[me], h = hand(s, me).map((id) => CARD[id]!).filter(Boolean);
    const can = h.filter((c) => c.cost <= el);
    if (!can.length) return null;
    const enemies = s.ents.filter((e) => e.side === foe && e.kind !== 'tower' && e.hp > 0);
    const threats = enemies.filter((e) => ownHalf(e.y) || Math.abs(e.y - RIVER) < 3.5);
    const mine = s.ents.filter((e) => e.side === me && e.kind === 'troop' && e.hp > 0);
    const cmd = (card: string, x: number, y: number): Cmd | null => {
      if (r() < sloppy) { x += (r() - 0.5) * 3; y += (r() - 0.5) * 3; }
      x = Math.max(1, Math.min(W - 1, x)); y = Math.max(1, Math.min(31, y));
      for (let k = 0; k < 8; k++) { if (canDeploy(s, me, card, x, y)) return { t: s.tick, side: me, card, x, y, n: n++ }; y += side === 0 ? 1 : -1; }
      return null;
    };
    const towers = s.ents.filter((e) => e.side === foe && e.kind === 'tower' && e.hp > 0);
    // 1) bitirici büyü
    for (const sp of can.filter((c) => c.kind === 'spell' && c.dmg > 0 && !c.roll)) for (const t of towers) if (t.hp <= sp.dmg * (sp.tower ?? 1)) return cmd(sp.id, t.x, t.y);
    // 2) savunma
    if (threats.length) {
      const val = (e: Ent) => (CARD[e.card]?.cost ?? 1) / (CARD[e.card]?.count ?? 1);
      // küme → alan büyüsü / alan birimi
      for (const sp of can.filter((c) => c.kind === 'spell' && (c.radius || c.roll) && c.dmg > 0)) {
        for (const e of threats) {
          if (sp.roll && e.fly) continue;
          const near = threats.filter((o) => (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 6 && (!sp.roll || !o.fly) && o.hp <= sp.dmg * 1.3);
          if (near.reduce((v, o) => v + val(o), 0) >= sp.cost + 0.5) return sp.roll ? cmd(sp.id, e.x, e.y - dir * 2.5) : cmd(sp.id, e.x, e.y + dir * 0.6);
        }
      }
      const air = threats.filter((e) => e.fly), tank = threats.reduce((m, e) => (e.max > (m?.max ?? 0) ? e : m), threats[0]!);
      const swarm = threats.filter((e) => (CARD[e.card]?.count ?? 1) >= 3).length >= 3;
      let pick: Card | null = null;
      if (swarm) pick = can.find((c) => c.kind !== 'spell' && has(c, 'splash')) ?? null;
      if (!pick && air.length) pick = can.find((c) => c.kind !== 'spell' && (c.tgt === 'both')) ?? null;
      if (!pick && tank.max >= 2000) pick = can.find((c) => c.kind !== 'spell' && (c.id === 'pylon' || has(c, 'dps') || c.id === 'turret') && c.tgt !== 'build' && !(tank.fly && c.tgt === 'ground')) ?? null;
      if (!pick) pick = can.filter((c) => c.kind !== 'spell' && c.tgt !== 'build' && !has(c, 'econ') && !(tank.fly && c.tgt === 'ground')).sort((x, y) => x.cost - y.cost)[0] ?? null;
      if (pick) {
        if (pick.kind === 'building') return cmd(pick.id, W / 2 + (tank.x < W / 2 ? -1.5 : 1.5), side === 0 ? 22 : 10);
        const ranged = (pick.range ?? 0) > 3;
        return cmd(pick.id, tank.x + (r() - 0.5), tank.y - dir * (ranged ? 4 : 1.6));
      }
      if (threats.length >= 2 || el < 8) return null;
    }
    // 3) saldırı
    const laneX = pushLane === 0 ? 3.5 : 14.5;
    const ally = mine.filter((e) => Math.abs(e.x - laneX) < 5 && (side === 0 ? e.y < 24 : e.y > 8));
    if (ally.length) {
      const lead = ally.reduce((m, e) => (dir * e.y > dir * m.y ? e : m), ally[0]!);
      const nearTower = towers.find((t) => (t.x - lead.x) ** 2 + (t.y - lead.y) ** 2 < 60);
      if (level >= 3 && nearTower && ally.length >= 2) {
        const oc = can.find((c) => c.buff); if (oc) return cmd(oc.id, lead.x, lead.y);
        const fr = can.find((c) => c.freeze); if (fr && (lead.x - nearTower.x) ** 2 + (lead.y - nearTower.y) ** 2 < 20) return cmd(fr.id, nearTower.x, nearTower.y + dir * -1);
      }
      if (el >= 3) {
        const sup = can.filter((c) => c.kind === 'troop' && c.tgt !== 'build' && c.cost <= el - 1 && !has(c, 'win')).sort((x, y) => (y.range ?? 0) - (x.range ?? 0))[0];
        if (sup && r() < 0.65) return cmd(sup.id, lead.x, lead.y - dir * 2.5);
      }
    }
    const pod = can.find((c) => c.pods);
    if (pod && el >= 7 && towers.length) { const t = towers.filter((t) => !t.king)[0] ?? towers[0]!; return cmd(pod.id, t.x, t.y - dir * -1.5); }
    if (el >= 9 || (el >= 7 && r() < 0.35)) {
      const t0 = towers.find((e) => e.lane === 0), t1 = towers.find((e) => e.lane === 1);
      pushLane = !t0 ? 1 : !t1 ? 0 : t0.hp < t1.hp ? 0 : t1.hp < t0.hp ? 1 : pushLane;
      const lx = pushLane === 0 ? 3.5 : 14.5;
      const pump = can.find((c) => c.elixirEvery); if (pump && !threats.length && s.tick < 2400 && r() < 0.5) return cmd(pump.id, W / 2, side === 0 ? 27 : 5);
      const win = can.filter((c) => c.kind === 'troop' && (has(c, 'win') || has(c, 'tank'))).sort((x, y) => (y.hp ?? 0) - (x.hp ?? 0))[0];
      if (win && s.tick - lastWin > 160) { lastWin = s.tick; const fast = (win.speed ?? 1) >= 1.4; return cmd(win.id, lx, fast ? bridge : back); }
      const spawner = can.find((c) => c.spawn); if (spawner) return cmd(spawner.id, W / 2 + (r() - 0.5) * 4, side === 0 ? 24 : 8);
      const any = can.filter((c) => c.kind === 'troop').sort((x, y) => y.cost - x.cost)[0];
      if (any) return cmd(any.id, lx, side === 0 ? 18.5 : 13.5);
    }
    if (el >= 9.6) { const cheap = can.filter((c) => c.kind === 'troop').sort((x, y) => x.cost - y.cost)[0]; if (cheap) return cmd(cheap.id, W / 2 + (r() - 0.5) * 6, back); }
    return null;
  };
}
