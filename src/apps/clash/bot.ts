/* Bot: aynı komut arayüzünü kullanır (hile yok: eli, iksiri ve yerleştirme kuralları oyuncununkiyle aynı). */
import { CARD } from './cards';
import { canDeploy, hand, RIVER, W, type Cmd, type Side, type State } from './engine';

export function makeBot(side: Side, seed: number, level = 1) {
  let a = seed >>> 0; const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  let wait = 40, n = 0, pushLane = r() < 0.5 ? 0 : 1, lastTank = -999;
  const me = side, foe = (1 - side) as Side, dir = side === 0 ? -1 : 1; // dir: düşmana doğru y yönü
  const ownHalf = (y: number) => (side === 0 ? y > RIVER : y < RIVER);
  return function think(s: State): Cmd | null {
    if (--wait > 0 || s.over) return null;
    wait = Math.round((level >= 2 ? 10 : 16) + r() * 14);
    const el = s.elix[me], h = hand(s, me).map((id) => CARD[id]!).filter(Boolean);
    const can = h.filter((c) => c.cost <= el);
    const enemies = s.ents.filter((e) => e.side === foe && e.kind === 'troop' && e.hp > 0);
    const threats = enemies.filter((e) => ownHalf(e.y) || Math.abs(e.y - RIVER) < 4);
    const mine = s.ents.filter((e) => e.side === me && e.kind === 'troop' && e.hp > 0);
    const cmd = (card: string, x: number, y: number): Cmd | null => {
      x = Math.max(1, Math.min(W - 1, x)); y = Math.max(1, Math.min(31, y));
      for (let k = 0; k < 6; k++) { if (canDeploy(s, me, card, x, y)) return { t: s.tick, side: me, card, x, y, n: n++ }; y += side === 0 ? 1 : -1; }
      return null;
    };
    // 1) bitirici büyü: kule ölmek üzereyse
    const plasma = can.find((c) => c.id === 'plasma');
    if (plasma) for (const t of s.ents) if (t.side === foe && t.kind === 'tower' && t.hp > 0 && t.hp <= 600 * 0.35) return cmd('plasma', t.x, t.y);
    // 2) savunma
    if (threats.length) {
      const air = threats.filter((e) => e.fly), tank = threats.reduce((m, e) => (e.max > (m?.max ?? 0) ? e : m), threats[0]!);
      // küme: 3+ birim 2.5 karo içinde → alan büyüsü
      for (const sp of can.filter((c) => c.kind === 'spell')) {
        for (const e of threats) { const near = threats.filter((o) => (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 6); const val = near.reduce((v, o) => v + (CARD[o.card]?.cost ?? 1) / (CARD[o.card]?.count ?? 1), 0); if (val >= sp.cost + 0.5) return cmd(sp.id, e.x, e.y + dir * 0.6); }
      }
      let pick = null as null | (typeof can)[number];
      if (air.length) pick = can.find((c) => c.tgt === 'both' && c.kind !== 'spell') ?? null;
      if (!pick && tank.max >= 2000) pick = can.find((c) => ['tabaxi', 'goblin', 'turret', 'chrome', 'runner'].includes(c.id)) ?? null;
      if (!pick) pick = can.filter((c) => c.kind !== 'spell' && c.tgt !== 'build').sort((x, y) => x.cost - y.cost)[0] ?? null;
      if (pick) {
        if (pick.kind === 'building') return cmd(pick.id, W / 2, side === 0 ? 22 : 10);
        const ranged = (pick.range ?? 0) > 3;
        return cmd(pick.id, tank.x + (r() - 0.5), tank.y - dir * (ranged ? 4 : 1.8));
      }
      return null;
    }
    // 3) saldırı: tankı arkadan başlat, destek arkasından gelsin
    const laneX = pushLane === 0 ? 3.5 : 14.5;
    const ally = mine.filter((e) => Math.abs(e.x - laneX) < 5);
    if (ally.length && el >= 3) {
      const lead = ally.reduce((m, e) => (dir * e.y > dir * m.y ? e : m), ally[0]!);
      const sup = can.filter((c) => c.kind === 'troop' && c.tgt !== 'build' && c.cost <= el - 1).sort((x, y) => (y.range ?? 0) - (x.range ?? 0))[0];
      if (sup && r() < 0.7) return cmd(sup.id, lead.x, lead.y - dir * 2.5);
    }
    if (el >= 9 || (el >= 7 && r() < 0.35)) {
      // zayıf kuleli kanadı seç
      const t0 = s.ents.find((e) => e.side === foe && e.lane === 0 && e.kind === 'tower'), t1 = s.ents.find((e) => e.side === foe && e.lane === 1 && e.kind === 'tower');
      pushLane = (t0?.hp ?? 0) <= 0 ? 1 : (t1?.hp ?? 0) <= 0 ? 0 : (t0!.hp < t1!.hp ? 0 : t1!.hp < t0!.hp ? 1 : pushLane);
      const lx = pushLane === 0 ? 3.5 : 14.5;
      const tank = can.filter((c) => c.kind === 'troop' && (c.hp ?? 0) >= 1100).sort((x, y) => (y.hp ?? 0) - (x.hp ?? 0))[0];
      if (tank && s.tick - lastTank > 200) { lastTank = s.tick; const fast = (tank.speed ?? 1) >= 1.4; return cmd(tank.id, lx, fast ? (side === 0 ? 18 : 14) : (side === 0 ? 29 : 3)); }
      const any = can.filter((c) => c.kind === 'troop').sort((x, y) => y.cost - x.cost)[0];
      if (any) return cmd(any.id, lx, side === 0 ? 18.5 : 13.5);
    }
    if (el >= 9.6) { const cheap = can.filter((c) => c.kind === 'troop').sort((x, y) => x.cost - y.cost)[0]; if (cheap) return cmd(cheap.id, W / 2 + (r() - 0.5) * 6, side === 0 ? 30 : 2); }
    return null;
  };
}
