/* CROWN CLASH ekonomisi — saf fonksiyonlar (test edilebilir). BIT: maç sonu kazanılan yumuşak para. QORE: yalnız gerçek BK ile alınan premium para. */
import { CARDS, CARD, STARTER, DEFAULT_DECK, MAX_LV, upCost, type Rarity } from './cards';

export interface Owned { lv: number; n: number }
export interface Slot { t: ChestId; id: string; open: number /* açılma zamanı (ms), 0 = kilitli bekliyor */ }
export interface Inv { bit: number; qore: number; cards: Record<string, Owned>; chests: Slot[]; deck: string[]; cr: number; best: number; w: number; l: number; d: number; streak: number; at: number; lb?: string }
export type ChestId = 'win' | 'tour' | 'neon' | 'leg';
export interface ChestDef { id: ChestId; name: string; img: string; cards: number; bit: [number, number]; odds: Record<Rarity, number>; guar?: Rarity; mins: number; price?: number; desc: string }
/** Olasılıklar kart başına nadirlik payı (%). */
export const CHESTS: Record<ChestId, ChestDef> = {
  win: { id: 'win', name: 'Veri Kasası', img: 'chest_win', cards: 8, bit: [60, 110], odds: { common: 78, rare: 18, epic: 3.6, legendary: 0.4 }, mins: 30, desc: 'Her galibiyette kazanılır.' },
  tour: { id: 'tour', name: 'Turnuva Kasası', img: 'chest_tour', cards: 20, bit: [220, 300], odds: { common: 60, rare: 30, epic: 9, legendary: 1 }, guar: 'rare', mins: 0, desc: 'Etkinlik ödülü (şimdilik kapalı).' },
  neon: { id: 'neon', name: 'Neon Kasa', img: 'chest_neon', cards: 30, bit: [450, 600], odds: { common: 45, rare: 38, epic: 15, legendary: 2 }, guar: 'epic', mins: 0, price: 160, desc: 'En az 1 Destansı garantili.' },
  leg: { id: 'leg', name: 'Taç Kasası', img: 'chest_leg', cards: 24, bit: [900, 1100], odds: { common: 35, rare: 40, epic: 20, legendary: 5 }, guar: 'legendary', mins: 0, price: 520, desc: 'En az 1 Efsanevi garantili.' },
};
/** QORE paketleri: BK ile (gerçek karakter parası). Kurallar aynı tabloyu doğrular. */
export const PACKS = [
  { id: 'p1', qore: 100, bk: 500, name: 'Qore Çekirdeği' },
  { id: 'p2', qore: 550, bk: 2500, name: 'Qore Hücresi', tag: '+10%' },
  { id: 'p3', qore: 1200, bk: 5000, name: 'Qore Reaktörü', tag: '+20%' },
] as const;
/** QORE ile BIT paketleri (hafif pay-to-win: yükseltme hızlanır) */
export const BITPACKS = [{ qore: 60, bit: 1000 }, { qore: 250, bit: 5000 }, { qore: 900, bit: 20000 }];
export const SLOTS = 4;
export const skipCost = (msLeft: number) => Math.max(1, Math.ceil(msLeft / 60000 / 5));

export function freshInv(): Inv {
  return { bit: 300, qore: 0, cards: Object.fromEntries(STARTER.map((id) => [id, { lv: 1, n: 0 }])), chests: [{ t: 'win', id: 'c0', open: 0 }], deck: DEFAULT_DECK.slice(), cr: 0, best: 0, w: 0, l: 0, d: 0, streak: 0, at: Date.now() };
}
export function normInv(x: Partial<Inv> | undefined): Inv {
  const f = freshInv(); if (!x) return f;
  const cards: Record<string, Owned> = {};
  for (const [k, v] of Object.entries(x.cards ?? {})) if (CARD[k]) cards[k] = { lv: Math.max(1, Math.min(MAX_LV, v.lv | 0 || 1)), n: Math.max(0, v.n | 0) };
  for (const id of STARTER) cards[id] ??= { lv: 1, n: 0 };
  const deck = Array.isArray(x.deck) && x.deck.length === 8 && x.deck.every((d) => cards[d]) && new Set(x.deck).size === 8 ? x.deck : f.deck;
  return { ...f, ...x, cards, deck, chests: (x.chests ?? []).filter((c) => CHESTS[c.t]).slice(0, SLOTS) } as Inv;
}
export interface Drop { id: string; n: number; isNew: boolean }
/** Sandık içeriği üret. r: [0,1) rastgele. Kartlar CR gibi birkaç yığına bölünür. */
export function rollChest(c: ChestId, inv: Inv, r: () => number = Math.random): { bit: number; drops: Drop[] } {
  const d = CHESTS[c]; const by: Record<Rarity, string[]> = { common: [], rare: [], epic: [], legendary: [] };
  for (const k of CARDS) by[k.rarity].push(k.id);
  const pickR = (): Rarity => { let x = r() * 100; for (const k of ['legendary', 'epic', 'rare', 'common'] as Rarity[]) { x -= d.odds[k]; if (x < 0) return k; } return 'common'; };
  const counts: Record<string, number> = {};
  const stacks = Math.min(6, 2 + Math.floor(d.cards / 8));
  const ids: string[] = []; for (let i = 0; i < stacks; i++) { const rr = pickR(); const pool = by[rr]; ids.push(pool[Math.floor(r() * pool.length)]!); }
  if (d.guar && !ids.some((id) => CARD[id]!.rarity === d.guar || (d.guar === 'rare' && CARD[id]!.rarity !== 'common') || (d.guar === 'epic' && CARD[id]!.rarity === 'legendary'))) { const pool = by[d.guar]; ids[ids.length - 1] = pool[Math.floor(r() * pool.length)]!; }
  // yığın büyüklükleri: nadirlik ağırlığıyla dağıt
  const wt = (id: string) => ({ common: 6, rare: 3, epic: 1.2, legendary: 0.5 })[CARD[id]!.rarity];
  const tw = ids.reduce((s, id) => s + wt(id), 0);
  for (const id of ids) counts[id] = (counts[id] ?? 0) + Math.max(1, Math.round((d.cards * wt(id)) / tw));
  const drops = Object.entries(counts).map(([id, n]) => ({ id, n, isNew: !inv.cards[id] }))
    .sort((a, b) => ['common', 'rare', 'epic', 'legendary'].indexOf(CARD[a.id]!.rarity) - ['common', 'rare', 'epic', 'legendary'].indexOf(CARD[b.id]!.rarity));
  return { bit: Math.round(d.bit[0] + r() * (d.bit[1] - d.bit[0])), drops };
}
export function applyDrops(inv: Inv, bit: number, drops: Drop[]) {
  inv.bit += bit;
  for (const d of drops) { const o = inv.cards[d.id]; if (o) o.n += d.n; else inv.cards[d.id] = { lv: 1, n: d.n - 1 }; }
}
export function canUpgrade(inv: Inv, id: string) { const o = inv.cards[id]; if (!o) return false; const c = upCost(id, o.lv); return !!c && o.n >= c.copies && inv.bit >= c.gold; }
export function upgrade(inv: Inv, id: string) { const o = inv.cards[id]!, c = upCost(id, o.lv)!; o.n -= c.copies; inv.bit -= c.gold; o.lv++; return o.lv; }
/** Kupa değişimi: rakip daha yüksekse daha çok. */
export function trophyDelta(me: number, opp: number, res: 'win' | 'lose' | 'draw') {
  if (res === 'draw') return 0;
  const k = Math.max(20, Math.min(40, Math.round(30 + (opp - me) / 12)));
  return res === 'win' ? k : -Math.max(18, Math.min(38, Math.round(30 - (opp - me) / 12)));
}
export function bitReward(res: 'win' | 'lose' | 'draw', crowns: number, cr: number) { const base = res === 'win' ? 40 : res === 'draw' ? 20 : 10; return base + crowns * 10 + Math.floor(cr / 200) * 2; }
/** Oyuncu "seviyesi": destedeki kart seviyelerinin ortalaması (yuvarlak). */
export const kingLv = (deck: { lv: number }[]) => Math.max(1, Math.round(deck.reduce((s, c) => s + c.lv, 0) / Math.max(1, deck.length)));
export interface EndInfo { res: 'win' | 'lose' | 'draw'; why: string; crowns: [number, number]; dcr: number; cr: number; bit: number; chest: 'yes' | 'full' | 'no'; foe: string; foeBot: boolean; friendly: boolean; tag: string; desync: boolean; theme: string }
