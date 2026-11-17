/* SPIRE//CLASH — belirlenimci simülasyon. Sabit adım 20 Hz. Yalnız + − × ÷ ve sqrt kullanılır
   (trigonometri yok) — böylece iki tarayıcı aynı komutlardan bit bit aynı sonucu üretir. Ağ katmanı yalnız komut taşır. */
import { CARD, type Card } from './cards';

export const HZ = 20, DT = 1 / HZ;
export const W = 18, H = 32, RIVER = 16, BRIDGES = [3.5, 14.5];
export const T_REG = 180, T_OT = 120;
export type Side = 0 | 1;
export interface Ent {
  id: number; side: Side; card: string; kind: 'troop' | 'building' | 'tower'; x: number; y: number; hp: number; max: number; r: number; fly: boolean;
  cd: number; tgt: number; dep: number; stun: number; life: number; fx: number; fy: number; atk: number; king?: boolean; lane?: number; active?: boolean; wake?: number;
}
export interface Proj { id: number; side: Side; kind: string; x: number; y: number; sx: number; sy: number; tgt: number; tx: number; ty: number; spd: number; dmg: number; splash: number; tow: number; t: number; T: number; from: number }
export interface Pend { side: Side; card: string; x: number; y: number; at: number }
export interface Cmd { t: number; side: Side; card: string; x: number; y: number; n: number }
export interface Fx { k: string; x: number; y: number; x2?: number; y2?: number; side?: Side; v?: number; card?: string; pts?: number[] }
export interface State {
  tick: number; nid: number; seed: number; ents: Ent[]; proj: Proj[]; pend: Pend[];
  elix: [number, number]; queue: [string[], string[]]; crowns: [number, number]; over: boolean; winner: -1 | 0 | 1 | 2; ot: boolean; reason: string;
}

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffle(a: string[], r: () => number) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; } return b; }

export const TOWER = { crown: { hp: 2600, dmg: 92, hs: 0.8, range: 7.5, r: 1.3 }, king: { hp: 4200, dmg: 112, hs: 1.0, range: 7.0, r: 1.8 } };
export function towerPos(side: Side) {
  const s = side === 0;
  return [
    { king: true, x: 9, y: s ? 29 : 3, lane: -1 },
    { king: false, x: 3.5, y: s ? 25.5 : 6.5, lane: 0 },
    { king: false, x: 14.5, y: s ? 25.5 : 6.5, lane: 1 },
  ];
}
export function init(seed: number, decks: [string[], string[]]): State {
  const r = rng(seed);
  const s: State = { tick: 0, nid: 1, seed, ents: [], proj: [], pend: [], elix: [5, 5], queue: [shuffle(decks[0], r), shuffle(decks[1], r)], crowns: [0, 0], over: false, winner: -1, ot: false, reason: '' };
  for (const side of [0, 1] as Side[]) for (const t of towerPos(side)) {
    const d = t.king ? TOWER.king : TOWER.crown;
    s.ents.push({ id: s.nid++, side, card: t.king ? 'king' : 'crown', kind: 'tower', x: t.x, y: t.y, hp: d.hp, max: d.hp, r: d.r, fly: false, cd: 0, tgt: 0, dep: 0, stun: 0, life: 0, fx: 0, fy: side === 0 ? -1 : 1, atk: 0, king: t.king, lane: t.lane, active: !t.king, wake: 0 });
  }
  return s;
}
export const hand = (s: State, side: Side) => s.queue[side].slice(0, 4);
export const nextCard = (s: State, side: Side) => s.queue[side][4]!;
export function elixRate(tick: number) { const t = tick / HZ; return t < 120 ? 1 : t < T_REG + 60 ? 2 : 3; }
export const timeLeft = (s: State) => { const t = s.tick / HZ; return t < T_REG ? T_REG - t : T_REG + T_OT - t; };

/** Bu taraf burada açabilir mi? Kendi yarısı; karşı kanattaki kule düşmüşse o kanadın cebi de açılır. Büyü her yere. */
export function canDeploy(s: State, side: Side, card: string, x: number, y: number) {
  const c = CARD[card]; if (!c) return false;
  if (x < 0.5 || x > W - 0.5 || y < 0.5 || y > H - 0.5) return false;
  if (c.kind === 'spell') return true;
  const own = side === 0 ? y >= RIVER + 1 : y <= RIVER - 1;
  let ok = own;
  if (!ok) {
    const foe = (1 - side) as Side;
    for (const lane of [0, 1]) {
      const alive = s.ents.some((e) => e.kind === 'tower' && e.side === foe && e.lane === lane && e.hp > 0);
      const inLane = lane === 0 ? x < W / 2 : x >= W / 2;
      const pocket = side === 0 ? y >= 10 : y <= H - 10;
      if (!alive && inLane && pocket) ok = true;
    }
  }
  if (!ok) return false;
  // kulelerin üstüne bina konmaz
  for (const e of s.ents) if (e.kind === 'tower' && e.hp > 0 && Math.abs(e.x - x) < e.r + 0.4 && Math.abs(e.y - y) < e.r + 0.4) return false;
  return true;
}

export function apply(s: State, cmd: Cmd, fx?: Fx[]) {
  if (s.over) return false;
  const c = CARD[cmd.card]; const q = s.queue[cmd.side];
  const hi = q.slice(0, 4).indexOf(cmd.card);
  if (!c || hi < 0 || s.elix[cmd.side] < c.cost - 1e-9 || !canDeploy(s, cmd.side, cmd.card, cmd.x, cmd.y)) return false;
  s.elix[cmd.side] -= c.cost;
  // el [0..3] + sıra. Oynanan kartın yuvasına sıradaki (5.) kart girer, oynanan sıranın sonuna gider.
  q[hi] = q[4]!; q.splice(4, 1); q.push(cmd.card);
  const x = Math.round(cmd.x * 2) / 2, y = Math.round(cmd.y * 2) / 2;
  if (c.kind === 'spell') { s.pend.push({ side: cmd.side, card: c.id, x, y, at: s.tick + (c.id === 'plasma' ? 16 : 1) }); fx?.push({ k: 'cast', x, y, side: cmd.side, card: c.id }); return true; }
  const n = c.count ?? 1;
  for (let i = 0; i < n; i++) {
    const ox = n === 1 ? 0 : n === 2 ? (i ? 0.45 : -0.45) : [0, -0.55, 0.55][i]!, oy = n === 3 && i ? 0.45 : 0;
    s.ents.push({ id: s.nid++, side: cmd.side, card: c.id, kind: c.kind === 'building' ? 'building' : 'troop', x: x + ox, y: y + (cmd.side === 0 ? oy : -oy), hp: c.hp!, max: c.hp!, r: c.r ?? 0.45, fly: !!c.fly,
      cd: 0, tgt: 0, dep: HZ, stun: 0, life: c.life ? c.life * HZ : 0, fx: 0, fy: cmd.side === 0 ? -1 : 1, atk: 0 });
  }
  fx?.push({ k: 'deploy', x, y, side: cmd.side, card: c.id });
  return true;
}

const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
function canHit(c: Card | undefined, e: Ent, isTower: boolean) {
  if (e.hp <= 0) return false;
  if (isTower) return true;
  if (!c) return true;
  if (c.tgt === 'build') return e.kind !== 'troop';
  if (c.tgt === 'ground') return !e.fly;
  return true;
}
function damage(s: State, e: Ent, dmg: number, fx?: Fx[], src?: Side) {
  if (e.hp <= 0) return;
  e.hp -= dmg; fx?.push({ k: 'hit', x: e.x, y: e.y, v: dmg, side: e.side });
  if (e.king && !e.active) { e.active = true; e.wake = HZ; }
  if (e.hp <= 0) {
    e.hp = 0; fx?.push({ k: e.kind === 'tower' ? 'tdie' : 'die', x: e.x, y: e.y, side: e.side, card: e.card });
    if (e.kind === 'tower') {
      const foe = (1 - e.side) as Side;
      if (e.king) { s.crowns[foe] = 3; } else { s.crowns[foe] = Math.min(3, s.crowns[foe] + 1); const k = s.ents.find((t) => t.king && t.side === e.side); if (k && !k.active) { k.active = true; k.wake = HZ; } }
      fx?.push({ k: 'crown', x: e.x, y: e.y, side: foe });
    }
    const c = CARD[e.card];
    if (c?.deathDmg) { area(s, e.side, e.x, e.y, c.splash ?? 1, c.deathDmg, 1, 'ground', fx); fx?.push({ k: 'boom', x: e.x, y: e.y, v: 1.2 }); }
  }
  void src;
}
function area(s: State, side: Side, x: number, y: number, rad: number, dmg: number, tow: number, tgt: 'ground' | 'both', fx?: Fx[], stun = 0) {
  const r2 = rad * rad;
  for (const e of s.ents) {
    if (e.side === side || e.hp <= 0) continue;
    if (tgt === 'ground' && e.fly) continue;
    const rr = rad + e.r * 0.6;
    if (d2(e, { x, y }) <= Math.max(r2, rr * rr)) { damage(s, e, e.kind === 'tower' ? Math.round(dmg * tow) : dmg, fx); if (stun && e.kind !== 'tower') e.stun = Math.max(e.stun, Math.round(stun * HZ)); if (stun && e.kind === 'tower') e.stun = Math.max(e.stun, Math.round(stun * HZ)); }
  }
}
function findTarget(s: State, e: Ent): Ent | null {
  const c = CARD[e.card]; const isT = e.kind === 'tower';
  const range = isT ? (e.king ? TOWER.king.range : TOWER.crown.range) : c!.range!;
  const sight = isT || e.kind === 'building' ? range + e.r : Math.max(5.5, range + 1);
  let best: Ent | null = null, bd = 1e9;
  for (const o of s.ents) {
    if (o.side === e.side || o.hp <= 0) continue;
    if (isT ? false : !canHit(c, o, false)) continue;
    if (!isT && c && c.tgt === 'ground' && o.fly) continue;
    const dd = Math.sqrt(d2(e, o)) - o.r;
    if (isT || e.kind === 'building') { if (dd <= range && dd < bd) { bd = dd; best = o; } continue; }
    if (c!.tgt === 'build') { if (o.kind === 'troop') continue; if (dd < bd) { bd = dd; best = o; } continue; }
    if (dd <= sight && dd < bd) { bd = dd; best = o; }
  }
  if (best || isT || e.kind === 'building') return best;
  // görüşte kimse yoksa: kanattaki en yakın düşman kulesi / yapısı
  for (const o of s.ents) {
    if (o.side === e.side || o.hp <= 0 || o.kind === 'troop') continue;
    const dd = Math.sqrt(d2(e, o)) + (o.king ? 3 : 0); // önce prenses kulesi
    if (dd < bd) { bd = dd; best = o; }
  }
  return best;
}
function moveToward(e: Ent, tx: number, ty: number, spd: number) {
  let wx = tx, wy = ty;
  if (!e.fly) {
    const cross = (e.y - RIVER) * (ty - RIVER) < 0 || (Math.abs(e.y - RIVER) < 1.1 && Math.abs(ty - RIVER) >= 1.1 && (ty - RIVER) * (e.y - RIVER) <= 0);
    const inRiver = Math.abs(e.y - RIVER) < 1.1;
    if (cross || inRiver && Math.abs(ty - RIVER) > 1) {
      const bx = Math.abs(e.x - BRIDGES[0]!) < Math.abs(e.x - BRIDGES[1]!) ? BRIDGES[0]! : BRIDGES[1]!;
      if (Math.abs(e.x - bx) > 0.35 && !inRiver) { wx = bx; wy = RIVER + (e.y > RIVER ? 1.3 : -1.3); }
      else { wx = bx; wy = ty > RIVER ? RIVER + 1.4 : RIVER - 1.4; }
    }
  }
  const dx = wx - e.x, dy = wy - e.y, l = Math.sqrt(dx * dx + dy * dy);
  if (l < 1e-6) return;
  const st = Math.min(l, spd * DT);
  e.x += (dx / l) * st; e.y += (dy / l) * st; e.fx = dx / l; e.fy = dy / l;
}
export function step(s: State, cmds: Cmd[], fx?: Fx[]) {
  if (s.over) return;
  for (const c of cmds) apply(s, c, fx);
  const rate = elixRate(s.tick);
  for (const side of [0, 1] as Side[]) s.elix[side] = Math.min(10, s.elix[side] + (DT / 2.8) * rate);
  // büyüler
  for (const p of s.pend) if (p.at === s.tick) {
    const c = CARD[p.card]!;
    area(s, p.side, p.x, p.y, c.radius!, c.dmg, c.tower ?? 1, 'both', fx, c.stun ?? 0);
    fx?.push({ k: p.card === 'plasma' ? 'strike' : 'emp', x: p.x, y: p.y, v: c.radius });
  }
  s.pend = s.pend.filter((p) => p.at > s.tick);
  // varlıklar
  for (const e of s.ents) {
    if (e.hp <= 0) continue;
    if (e.dep > 0) { e.dep--; continue; }
    if (e.kind === 'building' && e.life > 0) { e.life--; if (e.life % HZ === 0) { e.hp -= Math.ceil(e.max / (CARD[e.card]!.life ?? 30)); if (e.hp <= 0) { e.hp = 0; fx?.push({ k: 'die', x: e.x, y: e.y, side: e.side, card: e.card }); continue; } } }
    if (e.stun > 0) { e.stun--; continue; }
    if (e.king && !e.active) continue;
    if (e.wake && e.wake > 0) { e.wake--; continue; }
    if (e.cd > 0) e.cd--;
    if (e.atk > 0) e.atk--;
    const c = CARD[e.card];
    const isT = e.kind === 'tower';
    const range = isT ? (e.king ? TOWER.king.range : TOWER.crown.range) : c!.range!;
    let t = e.tgt ? s.ents.find((o) => o.id === e.tgt && o.hp > 0) ?? null : null;
    if (t) { const dd = Math.sqrt(d2(e, t)) - t.r - e.r * (isT ? 0 : 0.5); if ((isT || e.kind === 'building') && dd > range) t = null; else if (!isT && e.kind === 'troop' && dd > range && s.tick % 10 === e.id % 10) t = null; }
    if (!t) { t = findTarget(s, e); e.tgt = t ? t.id : 0; }
    if (!t) continue;
    const dd = Math.sqrt(d2(e, t)) - t.r - (isT ? 0 : e.r * 0.5);
    if (dd <= range) {
      if (e.kind === 'troop') { const dx = t.x - e.x, dy = t.y - e.y, l = Math.sqrt(dx * dx + dy * dy) || 1; e.fx = dx / l; e.fy = dy / l; }
      if (e.cd <= 0) {
        const hs = isT ? (e.king ? TOWER.king.hs : TOWER.crown.hs) : c!.hs!;
        const dmg = isT ? (e.king ? TOWER.king.dmg : TOWER.crown.dmg) : c!.dmg;
        e.cd = Math.round(hs * HZ); e.atk = 6;
        const kind = isT ? 'bolt' : c!.proj ?? 'none';
        if (kind === 'none') {
          if (c?.splash && c.id !== 'mech') area(s, e.side, t.x, t.y, c.splash, dmg, 1, 'ground', fx); else damage(s, t, dmg, fx);
          fx?.push({ k: 'melee', x: t.x, y: t.y, side: e.side, card: e.card });
        } else if (kind === 'arc') {
          const pts = [e.x, e.y, t.x, t.y]; damage(s, t, dmg, fx); if (c?.stun) t.stun = Math.max(t.stun, Math.round(c.stun * HZ));
          let last = t; const hitIds = new Set([t.id]);
          for (let k = 0; k < (c?.chain ?? 0); k++) {
            let nb: Ent | null = null, nd = 4 * 4;
            for (const o of s.ents) { if (o.side === e.side || o.hp <= 0 || hitIds.has(o.id) || o.kind === 'tower') continue; const q = d2(o, last); if (q < nd) { nd = q; nb = o; } }
            if (!nb) break; hitIds.add(nb.id); damage(s, nb, dmg, fx); if (c?.stun) nb.stun = Math.max(nb.stun, Math.round(c.stun * HZ)); pts.push(nb.x, nb.y); last = nb;
          }
          fx?.push({ k: 'arc', x: e.x, y: e.y, side: e.side, pts });
        } else {
          const spd = kind === 'plasma' ? 7 : kind === 'rail' ? 22 : kind === 'tracer' ? 18 : 14;
          const L = Math.sqrt(d2(e, t)); const T = Math.max(1, Math.round((L / spd) * HZ));
          s.proj.push({ id: s.nid++, side: e.side, kind, x: e.x, y: e.y, sx: e.x, sy: e.y, tgt: t.id, tx: t.x, ty: t.y, spd, dmg, splash: c?.splash ?? 0, tow: 1, t: 0, T, from: e.id });
          fx?.push({ k: 'shot', x: e.x, y: e.y, side: e.side, card: isT ? (e.king ? 'king' : 'crown') : e.card });
        }
      }
    } else if (e.kind === 'troop') {
      moveToward(e, t.x, t.y, c!.speed!);
    }
  }
  // mermiler
  for (const p of s.proj) {
    p.t++;
    const t = s.ents.find((o) => o.id === p.tgt);
    if (t && t.hp > 0) { p.tx = t.x; p.ty = t.y; }
    const k = Math.min(1, p.t / p.T);
    p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k;
    if (p.t >= p.T) {
      if (p.splash) { area(s, p.side, p.tx, p.ty, p.splash, p.dmg, 1, 'ground', fx); fx?.push({ k: 'boom', x: p.tx, y: p.ty, v: p.splash }); }
      else if (t && t.hp > 0) damage(s, t, p.dmg, fx);
    }
  }
  s.proj = s.proj.filter((p) => p.t < p.T);
  // ayrışma (aynı katmandaki birlikler üst üste binmez; kuleler iter)
  const live = s.ents.filter((e) => e.hp > 0);
  for (let i = 0; i < live.length; i++) {
    const a = live[i]!; if (a.kind !== 'troop') continue;
    for (let j = 0; j < live.length; j++) {
      if (i === j) continue; const b = live[j]!; if (a.fly !== b.fly && b.kind === 'troop') continue; if (a.fly && b.kind !== 'troop') continue;
      const dx = a.x - b.x, dy = a.y - b.y, rr = a.r * 0.8 + b.r * (b.kind === 'troop' ? 0.8 : 1), q = dx * dx + dy * dy;
      if (q < rr * rr && q > 1e-9) { const l = Math.sqrt(q), push = (rr - l) * (b.kind === 'troop' ? 0.5 : 1); a.x += (dx / l) * push; a.y += (dy / l) * push; }
      else if (q <= 1e-9) { a.x += a.id % 2 ? 0.05 : -0.05; }
    }
    a.x = Math.max(0.4, Math.min(W - 0.4, a.x)); a.y = Math.max(0.4, Math.min(H - 0.4, a.y));
    if (!a.fly && Math.abs(a.y - RIVER) < 1.0 && Math.abs(a.x - BRIDGES[0]!) > 1.1 && Math.abs(a.x - BRIDGES[1]!) > 1.1) a.y = a.y > RIVER ? RIVER + 1.0 : RIVER - 1.0;
  }
  s.ents = s.ents.filter((e) => e.hp > 0 || e.kind === 'tower');
  s.tick++;
  // bitiş
  const t = s.tick / HZ;
  if (s.crowns[0] >= 3 || s.crowns[1] >= 3) return end(s, s.crowns[0] >= 3 ? 0 : 1, '3 taç');
  if (!s.ot && t >= T_REG) { if (s.crowns[0] !== s.crowns[1]) return end(s, s.crowns[0] > s.crowns[1] ? 0 : 1, 'süre'); s.ot = true; s.reason = 'uzatma'; fx?.push({ k: 'ot', x: 9, y: 16 }); }
  if (s.ot) {
    if (s.crowns[0] !== s.crowns[1]) return end(s, s.crowns[0] > s.crowns[1] ? 0 : 1, 'ani ölüm');
    if (t >= T_REG + T_OT) {
      const lo = (side: Side) => Math.min(...s.ents.filter((e) => e.kind === 'tower' && e.side === side && e.hp > 0).map((e) => e.hp));
      const a = lo(0), b = lo(1); return end(s, a === b ? 2 : a > b ? 0 : 1, 'eşitlik bozucu');
    }
  }
}
function end(s: State, w: 0 | 1 | 2, why: string) { s.over = true; s.winner = w; s.reason = why; }
export function hash(s: State) { let h = 2166136261; const add = (n: number) => { h ^= Math.round(n * 100) | 0; h = Math.imul(h, 16777619); }; add(s.tick); for (const e of s.ents) { add(e.id); add(e.hp); add(e.x); add(e.y); } add(s.crowns[0]); add(s.crowns[1]); return (h >>> 0).toString(16); }
export const clone = (s: State): State => structuredClone(s);
