/* CROWN CLASH — belirlenimci simülasyon. Sabit adım 20 Hz. Yalnız + − × ÷ ve sqrt kullanılır
   (trigonometri yok) — iki tarayıcı aynı komutlardan bit bit aynı sonucu üretir. Ağ katmanı yalnız komut taşır.
   Koordinatlar: x ∈ [0,18] (kanatlar), y ∈ [0,32] (taraf 0 altta y büyük). Ekranda yatay çizilir (render.ts). */
import { CARD, eff, type Card, type DeckCard } from './cards';

export const HZ = 20, DT = 1 / HZ;
export const W = 18, H = 32, RIVER = 16, BRIDGES = [3.5, 14.5];
export const T_REG = 180, T_OT = 120;
export type Side = 0 | 1;
export interface Ent {
  id: number; side: Side; card: string; lv: number; kind: 'troop' | 'building' | 'tower'; x: number; y: number; hp: number; max: number; sh: number; shMax: number; r: number; fly: boolean;
  cd: number; tgt: number; dep: number; stun: number; life: number; fx: number; fy: number; atk: number; king?: boolean; lane?: number; active?: boolean; wake?: number;
  src: string; slow: number; slowF: number; buf: number; bufF: number; chg: number; hits: number; rampT: number; spT: number; elT: number; frz: number;
}
export interface Proj { id: number; side: Side; kind: string; x: number; y: number; sx: number; sy: number; tgt: number; tx: number; ty: number; dmg: number; splash: number; both: boolean; slow: number; slowT: number; t: number; T: number; card: string; lv: number; vis: string }
export interface Pend { side: Side; card: string; lv: number; x: number; y: number; at: number; k?: string; m?: number }
export interface Zone { side: Side; k: 'oc' | 'pod'; x: number; y: number; r: number; until: number; f: number; n: number; every: number; next: number; lv: number; dmg: number }
export interface Roll { side: Side; x: number; y: number; dir: number; left: number; w: number; kb: number; dmg: number; tow: number; stun: number; hit: number[]; lv: number }
export interface Cmd { t: number; side: Side; card: string; x: number; y: number; n: number }
export interface Fx { k: string; x: number; y: number; x2?: number; y2?: number; side?: Side; v?: number; card?: string; pts?: number[]; id?: number; lv?: number }
export interface MatchStats { dmg: [Record<string, number>, Record<string, number>]; tdmg: [number, number]; spent: [number, number]; plays: [number, number]; kills: [number, number]; leak: [number, number] }
export interface State {
  tick: number; nid: number; seed: number; rs: number; ents: Ent[]; proj: Proj[]; pend: Pend[]; zones: Zone[]; rolls: Roll[];
  elix: [number, number]; queue: [string[], string[]]; lv: [Record<string, number>, Record<string, number>]; crowns: [number, number];
  over: boolean; winner: -1 | 0 | 1 | 2; ot: boolean; reason: string; st: MatchStats;
}

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rand(s: State) { s.rs = (s.rs + 0x6d2b79f5) >>> 0; let t = s.rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function shuffle(a: string[], r: () => number) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; } return b; }

export const TOWER = { crown: { hp: 2600, dmg: 92, hs: 0.8, range: 7.5, r: 1.3 }, king: { hp: 4200, dmg: 112, hs: 1.0, range: 7.0, r: 1.8 } };
export function towerPos(side: Side) {
  const s = side === 0;
  return [{ king: true, x: 9, y: s ? 29 : 3, lane: -1 }, { king: false, x: 3.5, y: s ? 25.5 : 6.5, lane: 0 }, { king: false, x: 14.5, y: s ? 25.5 : 6.5, lane: 1 }];
}
const blank = () => ({ src: '', sh: 0, shMax: 0, slow: 0, slowF: 0, buf: 0, bufF: 0, chg: 0, hits: 0, rampT: 0, spT: 0, elT: 0, frz: 0 });
export function normDeck(d: (string | DeckCard)[]): DeckCard[] { return d.map((x) => (typeof x === 'string' ? { id: x, lv: 1 } : { id: x.id, lv: Math.max(1, Math.min(9, x.lv | 0 || 1)) })); }
export function init(seed: number, decks: [(string | DeckCard)[], (string | DeckCard)[]]): State {
  const r = rng(seed); const d0 = normDeck(decks[0]), d1 = normDeck(decks[1]);
  const s: State = { tick: 0, nid: 1, seed, rs: (seed ^ 0x9e3779b9) >>> 0, ents: [], proj: [], pend: [], zones: [], rolls: [], elix: [5, 5],
    queue: [shuffle(d0.map((c) => c.id), r), shuffle(d1.map((c) => c.id), r)], lv: [Object.fromEntries(d0.map((c) => [c.id, c.lv])), Object.fromEntries(d1.map((c) => [c.id, c.lv]))],
    crowns: [0, 0], over: false, winner: -1, ot: false, reason: '', st: { dmg: [{}, {}], tdmg: [0, 0], spent: [0, 0], plays: [0, 0], kills: [0, 0], leak: [0, 0] } };
  for (const side of [0, 1] as Side[]) for (const t of towerPos(side)) {
    const d = t.king ? TOWER.king : TOWER.crown;
    s.ents.push({ id: s.nid++, side, card: t.king ? 'king' : 'crown', lv: 1, kind: 'tower', x: t.x, y: t.y, hp: d.hp, max: d.hp, r: d.r, fly: false, cd: 0, tgt: 0, dep: 0, stun: 0, life: 0, fx: 0, fy: side === 0 ? -1 : 1, atk: 0, king: t.king, lane: t.lane, active: !t.king, wake: 0, ...blank(), src: t.king ? 'king' : 'crown' });
  }
  return s;
}
export const hand = (s: State, side: Side) => s.queue[side].slice(0, 4);
export const nextCard = (s: State, side: Side) => s.queue[side][4]!;
export function elixRate(tick: number) { const t = tick / HZ; return t < 120 ? 1 : t < T_REG + 60 ? 2 : 3; }
export const timeLeft = (s: State) => { const t = s.tick / HZ; return t < T_REG ? T_REG - t : T_REG + T_OT - t; };
export const ec = (e: Ent): Card => eff(e.card, e.lv);

/** Bu taraf burada açabilir mi? Kendi yarısı; karşı kanattaki kule düşmüşse o kanadın cebi de açılır. Büyü her yere. */
export function canDeploy(s: State, side: Side, card: string, x: number, y: number) {
  const c = CARD[card]; if (!c) return false;
  if (x < 0.5 || x > W - 0.5 || y < 0.5 || y > H - 0.5) return false;
  if (c.kind === 'spell') return true;
  let ok = side === 0 ? y >= RIVER + 1 : y <= RIVER - 1;
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
  for (const e of s.ents) if (e.kind === 'tower' && e.hp > 0 && Math.abs(e.x - x) < e.r + 0.4 && Math.abs(e.y - y) < e.r + 0.4) return false;
  return true;
}
function spawnUnit(s: State, side: Side, id: string, lv: number, x: number, y: number, dep: number, src = id) {
  const c = eff(id, lv);
  const e: Ent = { id: s.nid++, side, card: id, lv, kind: c.kind === 'building' ? 'building' : 'troop', x: Math.max(0.4, Math.min(W - 0.4, x)), y: Math.max(0.4, Math.min(H - 0.4, y)), hp: c.hp!, max: c.hp!, r: c.r ?? 0.45, fly: !!c.fly,
    cd: 0, tgt: 0, dep, stun: 0, life: c.life ? c.life * HZ : 0, fx: 0, fy: side === 0 ? -1 : 1, atk: 0, ...blank(), src };
  if (c.shield) { e.sh = c.shield; e.shMax = c.shield; }
  if (c.spawn) e.spT = Math.round(c.spawn.every * HZ * 0.5);
  if (c.elixirEvery) e.elT = Math.round(c.elixirEvery * HZ);
  s.ents.push(e); return e;
}
export function apply(s: State, cmd: Cmd, fx?: Fx[]) {
  if (s.over) return false;
  const base = CARD[cmd.card]; const q = s.queue[cmd.side];
  const hi = q.slice(0, 4).indexOf(cmd.card);
  if (!base || hi < 0 || s.elix[cmd.side] < base.cost - 1e-9 || !canDeploy(s, cmd.side, cmd.card, cmd.x, cmd.y)) return false;
  const lv = s.lv[cmd.side][cmd.card] ?? 1; const c = eff(cmd.card, lv);
  s.elix[cmd.side] -= c.cost; s.st.spent[cmd.side] += c.cost; s.st.plays[cmd.side]++;
  q[hi] = q[4]!; q.splice(4, 1); q.push(cmd.card);
  // y'de taraf-simetrik yuvarlama (nehre göre ayna); x arena sol-sağ simetrik olduğu için ortak
  const x = Math.round(cmd.x * 2) / 2, y = cmd.side === 0 ? Math.round(cmd.y * 2) / 2 : H - Math.round((H - cmd.y) * 2) / 2;
  if (c.kind === 'spell') {
    const delay = c.roll ? 0 : Math.round((c.delay ?? 0) * HZ);
    s.pend.push({ side: cmd.side, card: c.id, lv, x, y, at: s.tick + Math.max(1, delay) });
    fx?.push({ k: 'cast', x, y, side: cmd.side, card: c.id, lv }); return true;
  }
  const n = c.count ?? 1;
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? 0 : (i / n) * 6.2832; // yerleşim: sabit tablo (trig yok)
    const ring = [[0, 0], [-0.45, 0], [0.45, 0], [0, 0.5], [-0.5, 0.45], [0.5, 0.45], [0, -0.5]] as const;
    const off = n === 1 ? ring[0] : n === 2 ? ring[1 + i]! : ring[(i % 7)]!; void a;
    spawnUnit(s, cmd.side, c.id, lv, x + off[0], y + (cmd.side === 0 ? off[1] : -off[1]), HZ);
  }
  if (c.deployNova) s.pend.push({ side: cmd.side, card: c.id, lv, x, y, at: s.tick + HZ, k: 'nova' });
  fx?.push({ k: 'deploy', x, y, side: cmd.side, card: c.id, lv });
  return true;
}

const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
function canHit(c: Card | undefined, e: Ent) {
  if (e.hp <= 0) return false;
  if (!c) return true;
  if (c.tgt === 'build') return e.kind !== 'troop';
  if (c.tgt === 'ground') return !e.fly;
  if (c.tgt === 'air') return e.fly;
  return true;
}
function heal(e: Ent, v: number) { if (e.hp > 0 && e.kind !== 'tower') e.hp = Math.min(e.max, e.hp + v); }
function damage(s: State, e: Ent, dmg: number, fx: Fx[] | undefined, src: Side, card: string) {
  if (e.hp <= 0 || dmg <= 0) return;
  let left = dmg;
  if (e.sh > 0) { const a = Math.min(e.sh, left); e.sh -= a; left -= a; if (e.sh <= 0) fx?.push({ k: 'shbreak', x: e.x, y: e.y, side: e.side, id: e.id }); }
  const real = Math.min(e.hp, left) + (dmg - left);
  e.hp -= left; s.st.dmg[src][card] = (s.st.dmg[src][card] ?? 0) + real; if (e.kind === 'tower') s.st.tdmg[src] += Math.min(real, real);
  fx?.push({ k: 'hit', x: e.x, y: e.y, v: dmg, side: e.side, id: e.id });
  if (e.king && !e.active) { e.active = true; e.wake = HZ; }
  if (e.hp <= 0) {
    e.hp = 0; fx?.push({ k: e.kind === 'tower' ? 'tdie' : 'die', x: e.x, y: e.y, side: e.side, card: e.card, id: e.id });
    if (e.kind !== 'tower') s.st.kills[src]++;
    if (e.kind === 'tower') {
      const foe = (1 - e.side) as Side;
      if (e.king) s.crowns[foe] = 3; else { s.crowns[foe] = Math.min(3, s.crowns[foe] + 1); const k = s.ents.find((t) => t.king && t.side === e.side); if (k && !k.active) { k.active = true; k.wake = HZ; } }
      fx?.push({ k: 'crown', x: e.x, y: e.y, side: foe });
    } else onDeath(s, e, fx);
  }
}
function onDeath(s: State, e: Ent, fx?: Fx[]) {
  const c = ec(e);
  if (c.deathDmg && c.deathDmg > 0) { area(s, e.side, e.x, e.y, c.deathR ?? 1, c.deathDmg, 1, e.fly ? 'both' : 'ground', fx, e.card); fx?.push({ k: 'boom', x: e.x, y: e.y, v: c.deathR ?? 1, card: e.card }); }
  if (c.deathDmg && c.deathDmg < 0) { for (const o of s.ents) if (o.side === e.side && o.hp > 0 && o.kind !== 'tower' && d2(o, e) <= (c.deathR ?? 3) ** 2) heal(o, -c.deathDmg); fx?.push({ k: 'healwave', x: e.x, y: e.y, v: c.deathR ?? 3 }); }
  if (c.deathSpawn) for (let i = 0; i < c.deathSpawn.n; i++) spawnUnit(s, e.side, c.deathSpawn.card, e.lv, e.x + (i - (c.deathSpawn.n - 1) / 2) * 0.6, e.y, 6, e.src);
  if (c.deathElixir) s.elix[e.side] = Math.min(10, s.elix[e.side] + c.deathElixir);
  if (c.deathSpawn || c.deathElixir) fx?.push({ k: 'deathspawn', x: e.x, y: e.y, side: e.side, card: e.card });
}
function area(s: State, side: Side, x: number, y: number, rad: number, dmg: number, tow: number, tgt: 'ground' | 'both', fx: Fx[] | undefined, card: string, stun = 0, slow = 0, slowT = 0, knock = 0) {
  const r2 = rad * rad;
  for (const e of s.ents) {
    if (e.side === side || e.hp <= 0) continue;
    if (tgt === 'ground' && e.fly) continue;
    const rr = rad + e.r * 0.6;
    if (d2(e, { x, y }) <= Math.max(r2, rr * rr)) {
      damage(s, e, e.kind === 'tower' ? Math.round(dmg * tow) : dmg, fx, side, card);
      if (stun) { e.stun = Math.max(e.stun, Math.round(stun * HZ)); e.chg = 0; e.rampT = 0; }
      if (slow && e.kind !== 'tower') { e.slow = Math.max(e.slow, Math.round(slowT * HZ)); e.slowF = Math.max(e.slowF, slow); }
      if (knock && e.kind === 'troop' && e.hp > 0) { const dx = e.x - x, dy = e.y - y, l = Math.sqrt(dx * dx + dy * dy) || 1; e.x += (dx / l) * knock; e.y += (dy / l) * knock; }
    }
  }
}
function findTarget(s: State, e: Ent): Ent | null {
  const isT = e.kind === 'tower'; const c = isT ? undefined : ec(e);
  const range = isT ? (e.king ? TOWER.king.range : TOWER.crown.range) : c!.range ?? 0;
  const sight = isT || e.kind === 'building' ? range + e.r : Math.max(5.5, range + 1);
  let best: Ent | null = null, bd = 1e9;
  for (const o of s.ents) {
    if (o.side === e.side || o.hp <= 0) continue;
    if (!isT && !canHit(c, o)) continue;
    const dd = Math.sqrt(d2(e, o)) - o.r;
    if (isT || e.kind === 'building') { if (dd <= range && dd < bd) { bd = dd; best = o; } continue; }
    if (c!.tgt === 'build') { if (dd < bd) { bd = dd; best = o; } continue; }
    if (dd <= sight && dd < bd) { bd = dd; best = o; }
  }
  if (best || isT || e.kind === 'building') return best;
  for (const o of s.ents) {
    if (o.side === e.side || o.hp <= 0 || o.kind === 'troop') continue;
    const dd = Math.sqrt(d2(e, o)) + (o.king ? 3 : 0);
    if (dd < bd) { bd = dd; best = o; }
  }
  return best;
}
function moveToward(e: Ent, tx: number, ty: number, spd: number, jump: boolean) {
  let wx = tx, wy = ty;
  if (!e.fly && !jump) {
    const cross = (e.y - RIVER) * (ty - RIVER) < 0 || (Math.abs(e.y - RIVER) < 1.1 && Math.abs(ty - RIVER) >= 1.1 && (ty - RIVER) * (e.y - RIVER) <= 0);
    const inRiver = Math.abs(e.y - RIVER) < 1.1;
    if (cross || (inRiver && Math.abs(ty - RIVER) > 1)) {
      const bx = Math.abs(e.x - BRIDGES[0]!) < Math.abs(e.x - BRIDGES[1]!) ? BRIDGES[0]! : BRIDGES[1]!;
      if (Math.abs(e.x - bx) > 0.35 && !inRiver) { wx = bx; wy = RIVER + (e.y > RIVER ? 1.3 : -1.3); }
      else { wx = bx; wy = ty > RIVER ? RIVER + 1.4 : RIVER - 1.4; }
    }
  }
  const dx = wx - e.x, dy = wy - e.y, l = Math.sqrt(dx * dx + dy * dy);
  if (l < 1e-6) return 0;
  const st = Math.min(l, spd * DT);
  e.x += (dx / l) * st; e.y += (dy / l) * st; e.fx = dx / l; e.fy = dy / l; return st;
}
function castSpell(s: State, p: Pend, fx?: Fx[]) {
  const c = eff(p.card, p.lv); const m = p.m ?? 1;
  if (p.k === 'nova') { area(s, p.side, p.x, p.y, 3, c.deployNova ?? 0, 0.3, 'both', fx, p.card, 0, c.slow ?? 0.35, 2.5); fx?.push({ k: 'frostnova', x: p.x, y: p.y, v: 3 }); return; }
  if (p.k === 'shatter') { area(s, p.side, p.x, p.y, c.radius!, c.shatter ?? 0, 0.5, 'both', fx, p.card); fx?.push({ k: 'shatter', x: p.x, y: p.y, v: c.radius }); return; }
  if (c.roll) { s.rolls.push({ side: p.side, x: p.x, y: p.y, dir: p.side === 0 ? -1 : 1, left: c.roll.len, w: c.roll.w, kb: c.roll.kb, dmg: c.dmg, tow: c.tower ?? 0.4, stun: c.stun ?? 0, hit: [], lv: p.lv }); fx?.push({ k: 'roll', x: p.x, y: p.y, side: p.side }); return; }
  if (c.buff) { s.zones.push({ side: p.side, k: 'oc', x: p.x, y: p.y, r: c.radius!, until: s.tick + Math.round(c.dur! * HZ), f: c.buff, n: 0, every: 0, next: 0, lv: p.lv, dmg: 0 }); fx?.push({ k: 'oc', x: p.x, y: p.y, v: c.radius, side: p.side }); return; }
  if (c.pods) { const every = Math.max(1, Math.round((c.dur! * HZ) / c.pods)); s.zones.push({ side: p.side, k: 'pod', x: p.x, y: p.y, r: c.radius!, until: s.tick + Math.round(c.dur! * HZ) + 2, f: 0, n: c.pods, every, next: s.tick + 4, lv: p.lv, dmg: c.podDmg ?? 0 }); fx?.push({ k: 'podzone', x: p.x, y: p.y, v: c.radius, side: p.side }); return; }
  if (c.freeze) {
    area(s, p.side, p.x, p.y, c.radius!, c.dmg, c.tower ?? 1, 'both', fx, p.card, c.freeze);
    for (const e of s.ents) if (e.side !== p.side && e.hp > 0 && d2(e, p) <= (c.radius! + e.r * 0.6) ** 2) e.frz = Math.round(c.freeze * HZ);
    if (c.shatter) s.pend.push({ side: p.side, card: p.card, lv: p.lv, x: p.x, y: p.y, at: s.tick + Math.round(c.freeze * HZ), k: 'shatter' });
    fx?.push({ k: 'freeze', x: p.x, y: p.y, v: c.radius, side: p.side, card: p.card }); return;
  }
  area(s, p.side, p.x, p.y, c.radius!, Math.round(c.dmg * m), c.tower ?? 1, 'both', fx, p.card, c.stun ?? 0, 0, 0, c.knock ? 0.9 : 0);
  if (c.pulses && m === 1) s.pend.push({ side: p.side, card: p.card, lv: p.lv, x: p.x, y: p.y, at: s.tick + 12, m: 0.4 });
  fx?.push({ k: p.card === 'emp' ? 'emp' : p.card === 'nova' ? 'nova' : 'strike', x: p.x, y: p.y, v: c.radius, side: p.side, card: p.card });
}
function attack(s: State, e: Ent, t: Ent, c: Card | undefined, fx?: Fx[]) {
  const isT = e.kind === 'tower';
  const hs = isT ? (e.king ? TOWER.king.hs : TOWER.crown.hs) : c!.hs ?? 1;
  let dmg = isT ? (e.king ? TOWER.king.dmg : TOWER.crown.dmg) : c!.dmg;
  const tempo = (e.buf > 0 ? 1 + e.bufF : 1) * (e.slow > 0 ? 1 - e.slowF : 1);
  e.cd = Math.max(1, Math.round((hs * HZ) / tempo)); e.atk = 6; e.hits++;
  if (!isT && c) {
    if (c.ramp) { const st = e.rampT < 40 ? 0 : e.rampT < 80 ? 1 : 2; dmg = c.ramp[st]; }
    if (c.firstHit && e.hits === 1) dmg *= c.firstHit;
    if (c.charge && e.chg >= 3) { dmg *= 2; fx?.push({ k: 'chargehit', x: t.x, y: t.y, side: e.side, card: e.card }); if (c.stun) t.stun = Math.max(t.stun, Math.round(c.stun * HZ)); }
    if (c.every3 && e.hits % 3 === 0) { dmg *= c.every3; fx?.push({ k: 'crit', x: t.x, y: t.y, side: e.side, card: e.card }); }
    e.chg = 0;
  }
  const kind = isT ? 'bolt' : c!.proj ?? 'none';
  const card = isT ? (e.king ? 'king' : 'crown') : e.src || e.card;
  const onHit = (o: Ent) => {
    if (!c) return;
    if (c.towerStun && o.kind === 'tower') o.stun = Math.max(o.stun, Math.round(c.towerStun * HZ));
    if (c.lifesteal) heal(e, dmg * c.lifesteal);
  };
  if (kind === 'none' || kind === 'beam' || kind === 'heal') {
    const splashNow = c?.splash && (!c.every3 || e.hits % 3 === 0) && kind === 'none';
    if (splashNow) area(s, e.side, t.x, t.y, c!.splash!, dmg, 1, c!.tgt === 'both' ? 'both' : 'ground', fx, card, c!.charge && e.chg >= 3 ? c!.stun ?? 0 : 0); else damage(s, t, dmg, fx, e.side, card);
    onHit(t);
    fx?.push({ k: kind === 'beam' ? 'beam' : 'melee', x: t.x, y: t.y, x2: e.x, y2: e.y, side: e.side, card: e.card, v: kind === 'beam' ? (e.rampT < 40 ? 0 : e.rampT < 80 ? 1 : 2) : 0, id: e.id });
  } else if (kind === 'arc') {
    const pts = [e.x, e.y, t.x, t.y]; damage(s, t, dmg, fx, e.side, card); onHit(t); if (c?.stun) { t.stun = Math.max(t.stun, Math.round(c.stun * HZ)); t.rampT = 0; t.chg = 0; }
    let last = t; const hitIds = new Set([t.id]);
    for (let k = 0; k < (c?.chain ?? 0); k++) {
      let nb: Ent | null = null, nd = 4 * 4;
      for (const o of s.ents) { if (o.side === e.side || o.hp <= 0 || hitIds.has(o.id) || o.kind === 'tower') continue; const q = d2(o, last); if (q < nd) { nd = q; nb = o; } }
      if (!nb) break; hitIds.add(nb.id); damage(s, nb, dmg, fx, e.side, card); if (c?.stun) { nb.stun = Math.max(nb.stun, Math.round(c.stun * HZ)); nb.rampT = 0; nb.chg = 0; } pts.push(nb.x, nb.y); last = nb;
    }
    fx?.push({ k: 'arc', x: e.x, y: e.y, side: e.side, pts, card: isT ? card : e.card });
  } else {
    const spd = kind === 'plasma' ? 7 : kind === 'rail' || kind === 'snipe' ? 24 : kind === 'tracer' ? 18 : kind === 'frost' ? 11 : kind === 'flame' ? 10 : 14;
    const L = Math.sqrt(d2(e, t)); const T = Math.max(1, Math.round((L / spd) * HZ));
    s.proj.push({ id: s.nid++, side: e.side, kind, x: e.x, y: e.y, sx: e.x, sy: e.y, tgt: t.id, tx: t.x, ty: t.y, dmg, splash: c?.splash ?? 0, both: c?.tgt === 'both', slow: c?.slow ?? 0, slowT: c?.slowT ?? 0, t: 0, T, card, lv: e.lv, vis: isT ? card : e.card });
    if (c?.towerStun || c?.lifesteal) onHit(t);
    fx?.push({ k: 'shot', x: e.x, y: e.y, x2: t.x, y2: t.y, side: e.side, card: isT ? card : e.card, id: e.id });
  }
}
export function step(s: State, cmds: Cmd[], fx?: Fx[]) {
  if (s.over) return;
  // sıra yanlılığını yok et: tek tiklerde ters sırada işle (iki taraf da 'önce davranan' avantajını eşit paylaşır)
  const odd = s.tick % 2 === 1;
  for (const c of odd ? cmds.slice().reverse() : cmds) apply(s, c, fx);
  const rate = elixRate(s.tick);
  for (const side of [0, 1] as Side[]) s.elix[side] = Math.min(10, s.elix[side] + (DT / 2.8) * rate);
  // büyüler
  for (const p of odd ? s.pend.slice().reverse() : s.pend) if (p.at === s.tick) castSpell(s, p, fx);
  s.pend = s.pend.filter((p) => p.at > s.tick);
  // alanlar
  for (const z of s.zones) {
    if (z.k === 'oc') { for (const e of s.ents) if (e.side === z.side && e.hp > 0 && e.kind === 'troop' && d2(e, z) <= z.r * z.r) { e.buf = 3; e.bufF = z.f; } }
    else if (z.k === 'pod' && s.tick >= z.next && z.n > 0) {
      z.next = s.tick + z.every; z.n--;
      const ox = (rand(s) - 0.5) * 2 * z.r * 0.8, oy = (rand(s) - 0.5) * 2 * z.r * 0.8;
      const x = Math.max(0.6, Math.min(W - 0.6, z.x + ox)), y = Math.max(0.6, Math.min(H - 0.6, z.y + oy));
      spawnUnit(s, z.side, 'scrap', z.lv, x, y, 8, 'pod');
      if (z.dmg) area(s, z.side, x, y, 1.0, z.dmg, 0.5, 'ground', fx, 'pod');
      fx?.push({ k: 'pod', x, y, side: z.side });
    }
  }
  s.zones = s.zones.filter((z) => z.until > s.tick);
  // yuvarlanan
  for (const r of s.rolls) {
    const stp = Math.min(r.left, 8 * DT); r.y += r.dir * stp; r.left -= stp;
    for (const e of s.ents) {
      if (e.side === r.side || e.hp <= 0 || e.fly || r.hit.includes(e.id)) continue;
      if (Math.abs(e.x - r.x) <= r.w / 2 + e.r * 0.5 && Math.abs(e.y - r.y) <= 0.7 + e.r * 0.5) {
        r.hit.push(e.id); damage(s, e, e.kind === 'tower' ? Math.round(r.dmg * r.tow) : r.dmg, fx, r.side, 'roller');
        if (e.kind === 'troop') { e.y += r.dir * r.kb; if (r.stun) e.stun = Math.max(e.stun, Math.round(r.stun * HZ)); }
      }
    }
  }
  s.rolls = s.rolls.filter((r) => r.left > 1e-6 && r.y > 0.3 && r.y < H - 0.3);
  // varlıklar
  const order = odd ? s.ents.slice().reverse() : s.ents.slice();
  for (const e of order) {
    if (e.hp <= 0) continue;
    if (e.dep > 0) { e.dep--; continue; }
    if (e.slow > 0) e.slow--; else e.slowF = 0;
    if (e.buf > 0) e.buf--;
    const c = e.kind === 'tower' ? undefined : ec(e);
    if (e.kind === 'building' && e.life > 0) { e.life--; if (e.life % HZ === 0) { e.hp -= Math.ceil(e.max / (c!.life ?? 30)); if (e.hp <= 0) { e.hp = 0; fx?.push({ k: 'die', x: e.x, y: e.y, side: e.side, card: e.card, id: e.id }); onDeath(s, e, fx); continue; } } }
    if (e.frz > 0) { e.frz--; e.stun = Math.max(e.stun, 1); }
    if (e.stun > 0) { e.stun--; e.chg = 0; e.rampT = 0; continue; }
    if (e.king && !e.active) continue;
    if (e.wake && e.wake > 0) { e.wake--; continue; }
    if (c?.spawn && --e.spT <= 0) { e.spT = Math.round(c.spawn.every * HZ); for (let i = 0; i < c.spawn.n; i++) spawnUnit(s, e.side, c.spawn.card, e.lv, e.x + (i ? 0.6 : -0.6), e.y + (e.side === 0 ? -1.2 : 1.2), 6, e.src); fx?.push({ k: 'spawn', x: e.x, y: e.y, side: e.side, card: e.card }); }
    if (c?.elixirEvery && --e.elT <= 0) { e.elT = Math.round(c.elixirEvery * HZ); s.elix[e.side] = Math.min(10, s.elix[e.side] + (c.elixir ?? 1)); fx?.push({ k: 'pump', x: e.x, y: e.y, side: e.side }); }
    if (c?.heal && s.tick % 10 === e.id % 10) { let any = false; for (const o of s.ents) if (o.side === e.side && o.hp > 0 && o.kind !== 'tower' && o.hp < o.max && d2(o, e) <= (c.healR ?? 3) ** 2) { heal(o, c.heal * 0.5); any = true; } if (any) fx?.push({ k: 'healpulse', x: e.x, y: e.y, v: c.healR, side: e.side }); }
    if (c && !c.dmg && !c.ramp) continue; // saldırmayan yapı
    if (e.cd > 0) e.cd--;
    if (e.atk > 0) e.atk--;
    const isT = e.kind === 'tower';
    const range = isT ? (e.king ? TOWER.king.range : TOWER.crown.range) : c!.range ?? 0.8;
    let t = e.tgt ? s.ents.find((o) => o.id === e.tgt && o.hp > 0) ?? null : null;
    if (t) { const dd = Math.sqrt(d2(e, t)) - t.r - e.r * (isT ? 0 : 0.5); if ((isT || e.kind === 'building') && dd > range) t = null; else if (!isT && e.kind === 'troop' && dd > range && s.tick % 10 === e.id % 10) t = null; }
    if (!t) { const nt = findTarget(s, e); if ((nt?.id ?? 0) !== e.tgt) e.rampT = 0; t = nt; e.tgt = t ? t.id : 0; }
    if (!t) continue;
    const dd = Math.sqrt(d2(e, t)) - t.r - (isT ? 0 : e.r * 0.5);
    if (dd <= range) {
      if (e.kind === 'troop') { const dx = t.x - e.x, dy = t.y - e.y, l = Math.sqrt(dx * dx + dy * dy) || 1; e.fx = dx / l; e.fy = dy / l; }
      if (c?.ramp) e.rampT++;
      if (e.cd <= 0) attack(s, e, t, c, fx);
    } else if (e.kind === 'troop') {
      const spd = (c!.speed ?? 1) * (e.buf > 0 ? 1 + e.bufF : 1) * (e.slow > 0 ? 1 - e.slowF : 1) * (c!.charge && e.chg >= 3 ? 2 : 1);
      const moved = moveToward(e, t.x, t.y, spd, !!c!.jump);
      if (c!.charge) { const was = e.chg < 3; e.chg += moved; if (was && e.chg >= 3) fx?.push({ k: 'charge', x: e.x, y: e.y, side: e.side, id: e.id }); }
    }
  }
  // mermiler
  for (const p of odd ? s.proj.slice().reverse() : s.proj) {
    p.t++;
    const t = s.ents.find((o) => o.id === p.tgt);
    if (t && t.hp > 0) { p.tx = t.x; p.ty = t.y; }
    const k = Math.min(1, p.t / p.T);
    p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k;
    if (p.t >= p.T) {
      if (p.splash) { area(s, p.side, p.tx, p.ty, p.splash, p.dmg, 1, p.both ? 'both' : 'ground', fx, p.card, 0, p.slow, p.slowT); fx?.push({ k: 'boom', x: p.tx, y: p.ty, v: p.splash, card: p.vis }); }
      else if (t && t.hp > 0) { damage(s, t, p.dmg, fx, p.side, p.card); if (p.slow && t.kind !== 'tower') { t.slow = Math.max(t.slow, Math.round(p.slowT * HZ)); t.slowF = Math.max(t.slowF, p.slow); } }
    }
  }
  s.proj = s.proj.filter((p) => p.t < p.T);
  // ayrışma
  const live = s.ents.filter((e) => e.hp > 0); if (odd) live.reverse();
  for (let i = 0; i < live.length; i++) {
    const a = live[i]!; if (a.kind !== 'troop') continue;
    for (let j = 0; j < live.length; j++) {
      if (i === j) continue; const b = live[j]!; if (a.fly !== b.fly && b.kind === 'troop') continue; if (a.fly && b.kind !== 'troop') continue;
      const dx = a.x - b.x, dy = a.y - b.y, rr = a.r * 0.8 + b.r * (b.kind === 'troop' ? 0.8 : 1), q = dx * dx + dy * dy;
      if (q < rr * rr && q > 1e-9) { const l = Math.sqrt(q), push = (rr - l) * (b.kind === 'troop' ? 0.5 : 1); a.x += (dx / l) * push; a.y += (dy / l) * push; }
      else if (q <= 1e-9) { a.x += a.id % 2 ? 0.05 : -0.05; }
    }
    a.x = Math.max(0.4, Math.min(W - 0.4, a.x)); a.y = Math.max(0.4, Math.min(H - 0.4, a.y));
    if (!a.fly && Math.abs(a.y - RIVER) < 1.0 && Math.abs(a.x - BRIDGES[0]!) > 1.1 && Math.abs(a.x - BRIDGES[1]!) > 1.1) {
      if (!ec(a).jump) a.y = a.y > RIVER || (a.y === RIVER && a.side === 0) ? RIVER + 1.0 : RIVER - 1.0;
    }
  }
  s.ents = s.ents.filter((e) => e.hp > 0 || e.kind === 'tower');
  s.tick++;
  const t = s.tick / HZ;
  if (s.crowns[0] >= 3 || s.crowns[1] >= 3) return end(s, s.crowns[0] === s.crowns[1] ? 2 : s.crowns[0] >= 3 ? 0 : 1, '3 taç');
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
export function hash(s: State) { let h = 2166136261; const add = (n: number) => { h ^= Math.round(n * 100) | 0; h = Math.imul(h, 16777619); }; add(s.tick); for (const e of s.ents) { add(e.id); add(e.hp); add(e.x); add(e.y); add(e.sh); } add(s.crowns[0]); add(s.crowns[1]); add(s.elix[0]); add(s.elix[1]); return (h >>> 0).toString(16); }
export const clone = (s: State): State => structuredClone(s);
