/* CROWN CLASH ağ katmanı — Firestore (Spark) üstünde:
   • Komut kilit-adımı (lockstep) PvP: durum gönderilmez; yalnız "şu tikte şu kartı şuraya koydum" (maç başına ~50–120 yazma).
   • Profil (herkese açık: kupa, deste, seviye) + envanter (özel: BIT, QORE, kartlar, sandıklar).
   • Ortak sıralama: oyuncular + kalıcı botlar (clash_bots). Botlar oyuncuyu yenince yükselir; arka planda seyrek bot-bot maçları.
   • Arkadaşlar, düello davetleri, QORE satın alma (BK cüzdanından tek toplu yazım, kurallar bağlar). Bkz. docs/CLASH_NET.md */
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, query, where, getDocs, runTransaction, serverTimestamp, Timestamp, updateDoc, orderBy, limit, writeBatch, arrayUnion, arrayRemove, type Unsubscribe } from 'firebase/firestore';
import { db } from '../../lib/backend/firebase';
import { CARD, CARDS, validDeck, type DeckCard } from './cards';
import { init, step, type Cmd, type Side } from './engine';
import { makeBot } from './bot';
import { normInv, PACKS, trophyDelta, type Inv } from './economy';

const D = (c: string, id: string) => doc(db, c, id);
const now = () => Date.now();
export const nid = () => Math.random().toString(36).slice(2, 12);

/* ---------- profil + envanter ---------- */
export interface Pub { uid: string; name: string; cr: number; best: number; w: number; l: number; d: number; deck: string[]; dl: number[]; lv: number; bot?: boolean; at?: number }
export async function loadInv(uid: string): Promise<{ inv: Inv; fresh: boolean }> {
  const s = await getDoc(D('clash_inv', uid));
  if (s.exists()) return { inv: normInv(s.data() as Partial<Inv>), fresh: false };
  // eski (v1) profil varsa kupayı taşı
  let cr = 0; try { const p = await getDoc(D('clash_decks', uid)); cr = Math.max(0, Math.min(1500, (p.data()?.cr as number) ?? 0)); } catch { /* yok */ }
  const inv = normInv(undefined); inv.cr = cr; inv.best = cr;
  return { inv, fresh: true };
}
/** Envanter + herkese açık profil tek toplu yazımda (maç sonu, yükseltme, deste değişimi). */
export async function saveInv(uid: string, name: string, inv: Inv, opts: { pub?: boolean } = { pub: true }) {
  inv.at = now();
  const b = writeBatch(db);
  const { lb, ...rest } = inv;
  b.set(D('clash_inv', uid), lb ? { ...rest, lb } : rest);
  if (opts.pub !== false) b.set(D('clash_decks', uid), pubOf(uid, name, inv));
  await b.commit();
}
export function pubOf(uid: string, name: string, inv: Inv): Omit<Pub, 'uid'> & { uid: string } {
  const dl = inv.deck.map((id) => inv.cards[id]?.lv ?? 1);
  return { uid, name: name.slice(0, 40), cr: inv.cr, best: inv.best, w: inv.w, l: inv.l, d: inv.d, deck: inv.deck, dl, lv: Math.max(1, Math.round(dl.reduce((a, b) => a + b, 0) / 8)), at: now() };
}

/* ---------- kalıcı botlar ---------- */
const BOT_NAMES = ['Kr0z', 'NeonVex', 'Hrothmar_Jr', 'Ash.Rin', 'VantaBlak', 'Mira-7', 'Scrapjaw', 'KadeRunner', 'Dusk0', 'Ignis_Prime', 'TalonKCX', 'Sable//Null', 'RookOfAurum', 'Juno.exe', 'Grimwick', 'VesperDrift', 'NyxByte', 'Oskar_Q', 'BoltBrann', 'TessaChrome', 'Ozymandi4s', 'RedLantern', 'HexaDolgrim', 'Kurogane', 'Wraith.sys', 'PipTheKobold', 'TorqueDwarf', 'LyraStarborn', 'Nebbin_Rust', 'MoxRipper', 'Zephyrine', 'CinderOrk', 'Halvard_Ironjaw', 'QuillNet', 'BrambleRoot', 'StaticVoid', 'OrrinTheDock', 'FenGhost', 'Volt_Corvallis', 'Morrow.Crown'];
const ARCH: string[][] = [
  ['chrome', 'archer', 'goblin', 'drone', 'breacher', 'tabaxi', 'plasma', 'emp'],
  ['ogre', 'bomber', 'medic', 'archer', 'emp', 'plasma', 'turret', 'scrap'],
  ['rider', 'tabaxi', 'goblin', 'freeze', 'emp', 'sharp', 'cryo', 'roller'],
  ['exo', 'pump', 'drake', 'runner', 'nova', 'emp', 'enforcer', 'drone'],
  ['mech', 'medic', 'drake', 'swarm', 'emp', 'plasma', 'archer', 'enforcer'],
  ['breacher', 'foundry', 'pylon', 'chrome', 'roller', 'emp', 'archer', 'scrap'],
  ['pod', 'overclock', 'goblin', 'scrap', 'tabaxi', 'emp', 'turret', 'sharp'],
  ['rider', 'ogre', 'cryo', 'drone', 'bomber', 'freeze', 'roller', 'enforcer'],
];
export const botLv = (cr: number) => Math.max(1, Math.min(9, 1 + Math.floor(cr / 420)));
export const botSkill = (cr: number) => Math.max(1, Math.min(5, 1 + Math.floor(cr / 700)));
export function seedBots(): Pub[] {
  return BOT_NAMES.map((name, i) => {
    const cr = Math.round(40 + (i * 3150) / (BOT_NAMES.length - 1) + ((i * 37) % 60)); const deck = ARCH[i % ARCH.length]!.slice(); const lv = botLv(cr);
    return { uid: 'b' + String(i).padStart(2, '0'), name, cr, best: cr, w: 0, l: 0, d: 0, deck, dl: deck.map((id) => Math.max(1, lv - (CARD[id]!.rarity === 'legendary' ? 2 : CARD[id]!.rarity === 'epic' ? 1 : 0))), lv, bot: true, at: 0 };
  });
}
export async function ensureBots(): Promise<void> {
  const s = await getDocs(query(collection(db, 'clash_bots'), limit(1)));
  if (!s.empty) return;
  const b = writeBatch(db); for (const p of seedBots()) { const { uid, ...r } = p; b.set(D('clash_bots', uid), r); } await b.commit();
}
export async function leaderboard(): Promise<Pub[]> {
  const [a, b] = await Promise.all([
    getDocs(query(collection(db, 'clash_decks'), orderBy('cr', 'desc'), limit(50))),
    getDocs(query(collection(db, 'clash_bots'), orderBy('cr', 'desc'), limit(50))),
  ]);
  const ps = a.docs.map((d) => { const x = d.data() as Partial<Pub>; return { ...x, uid: d.id, bot: false, dl: Array.isArray(x.dl) ? x.dl : Array(8).fill(1), lv: x.lv ?? 1, best: x.best ?? x.cr ?? 0, w: x.w ?? 0, l: x.l ?? 0 } as Pub; }).filter((p) => validDeck(p.deck));
  const bs = b.docs.map((d) => ({ ...(d.data() as Pub), uid: d.id, bot: true }));
  return [...ps, ...bs].sort((x, y) => y.cr - x.cr).slice(0, 60);
}
/** Kupası yakın bir bot seç (sıralamadaki gerçek botlardan). */
export async function pickBot(cr: number): Promise<Pub> {
  const s = await getDocs(query(collection(db, 'clash_bots'), orderBy('cr', 'desc'), limit(60)));
  const all = s.docs.map((d) => ({ ...(d.data() as Pub), uid: d.id, bot: true }));
  const near = all.sort((a, b) => Math.abs(a.cr - cr) - Math.abs(b.cr - cr)).slice(0, 5);
  return near[Math.floor(Math.random() * near.length)] ?? seedBots()[0]!;
}
/** Bot sonucu: |Δ| ≤ 60, kurallar sınırlar. */
export async function botResult(b: Pub, res: 'win' | 'lose' | 'draw', vsCr: number) {
  const dl = trophyDelta(b.cr, vsCr, res); const cr = Math.max(0, b.cr + dl); const lv = botLv(cr);
  await updateDoc(D('clash_bots', b.uid), { cr, best: Math.max(b.best ?? 0, cr), w: (b.w ?? 0) + (res === 'win' ? 1 : 0), l: (b.l ?? 0) + (res === 'lose' ? 1 : 0), lv, dl: b.deck.map((id, i) => Math.max(b.dl[i] ?? 1, Math.max(1, lv - (CARD[id]!.rarity === 'legendary' ? 2 : CARD[id]!.rarity === 'epic' ? 1 : 0)))), at: now() }).catch(() => {});
  return dl;
}
/** Arka plan bot-bot maçları: tüm istemciler arasında en fazla 10 dakikada bir, en çok 4 maç (≤9 yazma). */
export async function backgroundSims(): Promise<number> {
  const m = await getDoc(D('clash_meta', 'sim')); const last = (m.data()?.at as Timestamp | undefined)?.toMillis() ?? 0;
  if (now() - last < 10.5 * 60_000) return 0;
  const s = await getDocs(query(collection(db, 'clash_bots'), orderBy('cr', 'desc'), limit(60)));
  const bots = s.docs.map((d) => ({ ...(d.data() as Pub), uid: d.id })); if (bots.length < 4) return 0;
  const used = new Set<string>(); const upd = new Map<string, Pub>(); let n = 0;
  for (let k = 0; k < 4; k++) {
    const a = bots[Math.floor(Math.random() * bots.length)]!; if (used.has(a.uid)) continue;
    const b = bots.filter((x) => x.uid !== a.uid && !used.has(x.uid)).sort((x, y) => Math.abs(x.cr - a.cr) - Math.abs(y.cr - a.cr))[Math.floor(Math.random() * 3)]; if (!b) continue;
    used.add(a.uid); used.add(b.uid);
    const w = await headless(a, b); n++;
    for (const [p, o, r] of [[a, b, w === 0 ? 'win' : w === 1 ? 'lose' : 'draw'], [b, a, w === 1 ? 'win' : w === 0 ? 'lose' : 'draw']] as [Pub, Pub, 'win' | 'lose' | 'draw'][]) {
      const cr = Math.max(0, p.cr + trophyDelta(p.cr, o.cr, r)); upd.set(p.uid, { ...p, cr, w: (p.w ?? 0) + (r === 'win' ? 1 : 0), l: (p.l ?? 0) + (r === 'lose' ? 1 : 0) });
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  const bt = writeBatch(db);
  bt.set(D('clash_meta', 'sim'), { at: serverTimestamp(), n });
  for (const p of upd.values()) bt.update(D('clash_bots', p.uid), { cr: p.cr, best: Math.max(p.best ?? 0, p.cr), w: p.w, l: p.l, lv: botLv(p.cr), at: now() });
  await bt.commit();
  return n;
}
/** Başsız bot-bot maçı (UI yok). Ana iş parçacığını bloklamamak için dilimler halinde. */
async function headless(a: Pub, b: Pub): Promise<number> {
  const deck = (p: Pub): DeckCard[] => p.deck.map((id, i) => ({ id, lv: p.dl[i] ?? 1 }));
  const s = init((Math.random() * 2 ** 31) | 0, [deck(a), deck(b)]);
  const b0 = makeBot(0, 11, botSkill(a.cr)), b1 = makeBot(1, 23, botSkill(b.cr)); let n = 0;
  while (!s.over) {
    for (let i = 0; i < 400 && !s.over; i++) { const cs: Cmd[] = []; for (const [bb, sd] of [[b0, 0], [b1, 1]] as const) { const c = bb(s); if (c) cs.push({ ...c, side: sd, t: s.tick, n: n++ }); } step(s, cs); }
    await new Promise((r) => setTimeout(r, 0));
  }
  return s.winner;
}

/* ---------- arkadaşlar ---------- */
export interface Fr { f: string[]; in: string[]; name: string }
export const watchFr = (uid: string, cb: (f: Fr) => void) => onSnapshot(D('clash_fr', uid), (s) => cb({ f: [], in: [], name: '', ...(s.data() as Partial<Fr>) }), () => cb({ f: [], in: [], name: '' }));
export async function allPlayers(): Promise<Pub[]> { const s = await getDocs(collection(db, 'clash_decks')); return s.docs.map((d) => { const x = d.data() as Partial<Pub>; return { ...x, uid: d.id, dl: Array.isArray(x.dl) ? x.dl : Array(8).fill(1), lv: x.lv ?? 1, cr: x.cr ?? 0 } as Pub; }).filter((p) => p.name); }
export async function ensureFr(uid: string, name: string) { const s = await getDoc(D('clash_fr', uid)); if (!s.exists()) await setDoc(D('clash_fr', uid), { f: [], in: [], name: name.slice(0, 40) }); }
export async function requestFriend(me: string, to: string) {
  const s = await getDoc(D('clash_fr', to));
  if (s.exists()) await updateDoc(D('clash_fr', to), { in: arrayUnion(me) }); else await setDoc(D('clash_fr', to), { f: [], in: [me], name: '' });
}
export async function acceptFriend(me: string, from: string) {
  const b = writeBatch(db);
  b.update(D('clash_fr', me), { f: arrayUnion(from), in: arrayRemove(from) });
  const s = await getDoc(D('clash_fr', from));
  if (s.exists()) b.update(D('clash_fr', from), { f: arrayUnion(me) }); else b.set(D('clash_fr', from), { f: [me], in: [], name: '' });
  await b.commit();
}
export const declineFriend = (me: string, from: string) => updateDoc(D('clash_fr', me), { in: arrayRemove(from) });
export async function removeFriend(me: string, who: string) { const b = writeBatch(db); b.update(D('clash_fr', me), { f: arrayRemove(who) }); b.update(D('clash_fr', who), { f: arrayRemove(me) }); await b.commit().catch(() => updateDoc(D('clash_fr', me), { f: arrayRemove(who) })); }

/* ---------- düello davetleri ---------- */
import type { DuelInv } from './invites';
export type { DuelInv };
export async function sendDuel(me: { uid: string; name: string; deck: DeckCard[]; cr: number }, to: string, toName: string) {
  const id = nid(); const d: Omit<DuelInv, 'id'> = { from: me.uid, to, fromName: me.name.slice(0, 40), toName: toName.slice(0, 40), deck: me.deck, cr: me.cr, st: 'open', at: now() };
  await setDoc(D('clash_duels', id), d); return id;
}
export { watchInvites } from './invites';
export const watchDuel = (id: string, cb: (d: DuelInv | null) => void) => onSnapshot(D('clash_duels', id), (s) => cb(s.exists() ? { ...(s.data() as DuelInv), id } : null));
export const cancelDuel = (id: string) => updateDoc(D('clash_duels', id), { st: 'gone' }).catch(() => {});
export const declineDuel = (id: string) => updateDoc(D('clash_duels', id), { st: 'no' }).catch(() => {});
export async function getDuel(id: string): Promise<DuelInv | null> { const s = await getDoc(D('clash_duels', id)); return s.exists() ? { ...(s.data() as DuelInv), id } : null; }
/** Daveti kabul et: maçı ben kurarım (davet eden = taraf 0). */
export async function acceptDuel(dv: DuelInv, me: { uid: string; name: string; deck: DeckCard[]; cr: number }): Promise<{ m: Match; off: number }> {
  const off = await serverOffset(me.uid); const id = nid(); const seed = (Math.random() * 2 ** 31) | 0;
  const m: Omit<Match, 'id'> = { players: [dv.from, me.uid], names: [dv.fromName, me.name.slice(0, 40)], decks: { 0: dv.deck, 1: me.deck }, cr: [dv.cr, me.cr], seed, t0: now() + off + 6000, friendly: true, left: [] };
  await setDoc(D('clash_matches', id), { ...m, at: serverTimestamp() });
  await updateDoc(D('clash_duels', dv.id), { st: 'ok', match: id });
  return { m: { ...m, id }, off };
}
export async function loadMatch(id: string): Promise<Match> { const s = await getDoc(D('clash_matches', id)); return { ...(s.data() as Omit<Match, 'id'>), id }; }

/* ---------- QORE satın alma (gerçek BK) ---------- */
/** Tek toplu yazım: clash_buys/{bid} + cüzdan BK düşüşü (lq = bid) + tx kaydı + envanter QORE artışı (lb = bid). Kurallar her parçayı bağlar. */
export async function buyQore(u: { uid: string; name: string }, packId: string): Promise<{ qore: number; bal: number; bid: string }> {
  const p = PACKS.find((x) => x.id === packId); if (!p) throw new Error('Paket yok');
  const bid = nid(), at = now();
  return runTransaction(db, async (t) => {
    const wr = D('wallet', u.uid), ir = D('clash_inv', u.uid);
    const [ws, is] = [await t.get(wr), await t.get(ir)];
    const old = ws.exists() ? ((ws.data().bal?.BK as number) ?? 0) : 0;
    if (old < p.bk) throw new Error('BK bakiyesi yetersiz');
    if (!is.exists()) throw new Error('Envanter yok');
    const q0 = (is.data().qore as number) ?? 0; const nb = old - p.bk;
    t.set(D('clash_buys', bid), { uid: u.uid, name: u.name.slice(0, 60), pack: p.id, qore: p.qore, bk: p.bk, at, bal: nb });
    t.update(wr, { 'bal.BK': nb, at, lq: bid });
    t.set(doc(db, 'wallet', u.uid, 'tx', bid), { cur: 'BK', amt: -p.bk, reason: `CROWN CLASH · ${p.qore} QORE`, at, bal: nb, q: bid });
    t.update(ir, { qore: q0 + p.qore, lb: bid, at });
    return { qore: q0 + p.qore, bal: nb, bid };
  });
}
export async function walletBK(uid: string) { const s = await getDoc(D('wallet', uid)); return (s.data()?.bal?.BK as number) ?? 0; }
export interface Buy { id: string; uid: string; name: string; pack: string; qore: number; bk: number; at: number; bal: number }
export const watchBuys = (cb: (b: Buy[]) => void) => onSnapshot(query(collection(db, 'clash_buys'), orderBy('at', 'desc'), limit(200)), (s) => cb(s.docs.map((d) => ({ ...(d.data() as Buy), id: d.id }))), () => cb([]));

/* ---------- PvP eşleşme + komut kanalı ---------- */
export interface Match { id: string; players: [string, string]; names: [string, string]; decks: { 0: DeckCard[]; 1: DeckCard[] }; cr: [number, number]; seed: number; t0: number; friendly?: boolean; left?: string[]; res?: Record<string, { w: number; h: string; c: number[] }> }

/** Sunucu saati farkı: kendi kuyruk belgemize serverTimestamp yazıp geri okuruz. */
export async function serverOffset(uid: string): Promise<number> {
  const r = D('clash_queue', uid);
  const a = now(); await setDoc(r, { ping: serverTimestamp() }, { merge: true });
  const b = now(); const s = await getDoc(r); const ts = (s.data()?.ping as Timestamp | undefined)?.toMillis();
  return ts ? ts - (a + b) / 2 : 0;
}
const okDeck = (d: unknown): d is DeckCard[] => Array.isArray(d) && d.length === 8 && d.every((c) => c && typeof c === 'object' && CARD[(c as DeckCard).id]);

/** Rakip ara. Bulunca onMatch çağrılır. Dönen fonksiyon aramayı iptal eder. */
export function seek(me: { uid: string; name: string; deck: DeckCard[]; cr: number }, onMatch: (m: Match, side: Side, offset: number) => void, onErr: (e: unknown) => void): () => void {
  let stop = false, un: Unsubscribe | null = null, poll: ReturnType<typeof setInterval> | null = null, off = 0;
  const qref = D('clash_queue', me.uid);
  const done = async (mid: string) => {
    if (stop) return; stop = true; un?.(); if (poll) clearInterval(poll);
    const m = await loadMatch(mid);
    await deleteDoc(qref).catch(() => {});
    onMatch(m, m.players[0] === me.uid ? 0 : 1, off);
  };
  (async () => {
    off = await serverOffset(me.uid);
    await setDoc(qref, { uid: me.uid, name: me.name.slice(0, 40), deck: me.deck, cr: me.cr, at: serverTimestamp(), match: null });
    un = onSnapshot(qref, (s) => { const m = s.data()?.match; if (m) done(m); });
    const tryPair = async () => {
      if (stop) return;
      const since = Timestamp.fromMillis(now() + off - 45000);
      const qs = await getDocs(query(collection(db, 'clash_queue'), where('at', '>', since)));
      const others = qs.docs.filter((d) => d.id !== me.uid && !d.data().match && okDeck(d.data().deck)).sort((a, b) => (a.data().at?.toMillis?.() ?? 0) - (b.data().at?.toMillis?.() ?? 0));
      for (const o of others) {
        try {
          const mid = await runTransaction(db, async (tx) => {
            const mine = await tx.get(qref), theirs = await tx.get(o.ref);
            if (!mine.exists() || !theirs.exists() || mine.data()!.match || theirs.data()!.match) return null;
            const t = theirs.data()!; const id = nid(); const seed = (Math.random() * 2 ** 31) | 0;
            // eski kuyruktaki (önce gelen) host = taraf 0
            tx.set(D('clash_matches', id), { players: [o.id, me.uid], names: [String(t.name).slice(0, 40), me.name.slice(0, 40)], decks: { 0: t.deck, 1: me.deck }, cr: [t.cr ?? 0, me.cr], seed, t0: now() + off + 5000, at: serverTimestamp(), left: [] });
            tx.update(o.ref, { match: id }); tx.update(qref, { match: id });
            return id;
          });
          if (mid) return;
        } catch { /* yarış: başka biri aldı */ }
      }
    };
    await tryPair(); poll = setInterval(tryPair, 3500);
  })().catch(onErr);
  return () => { stop = true; un?.(); if (poll) clearInterval(poll); deleteDoc(qref).catch(() => {}); };
}

/** Maç kanalı: komut + emoji gönder/al, ayrılma ve sonuç. Emoji = kart adı "~laugh" olan komut (motor yok sayar). */
export function channel(m: Match, side: Side, onCmd: (c: Cmd) => void, onLeft: (who: string) => void, onEmote: (s: Side, e: string) => void) {
  const col = collection(db, 'clash_matches', m.id, 'cmds');
  let n = 0;
  const un1 = onSnapshot(col, (s) => {
    for (const ch of s.docChanges()) if (ch.type === 'added') {
      const d = ch.doc.data() as { t: number; s: Side; c: string; x: number; y: number; n: number };
      if (d.c.startsWith('~')) { if (d.s !== side) onEmote(d.s, d.c.slice(1)); continue; }
      onCmd({ t: d.t, side: d.s, card: d.c, x: d.x, y: d.y, n: d.n });
    }
  });
  const un2 = onSnapshot(D('clash_matches', m.id), (s) => { const l = (s.data()?.left as string[] | undefined) ?? []; for (const u of l) if (u !== m.players[side]) onLeft(u); });
  return {
    send: (c: Omit<Cmd, 'n' | 'side'>) => { const k = n++; const id = `${side}_${String(k).padStart(4, '0')}`; return setDoc(doc(col, id), { u: m.players[side], s: side, t: c.t, c: c.card, x: c.x, y: c.y, n: k }); },
    emote: (e: string, t: number) => { const k = n++; return setDoc(doc(col, `${side}_${String(k).padStart(4, '0')}`), { u: m.players[side], s: side, t, c: '~' + e, x: 0, y: 0, n: k }).catch(() => {}); },
    leave: () => updateDoc(D('clash_matches', m.id), { left: [m.players[side]] }).catch(() => {}),
    result: (w: number, h: string, c: number[]) => updateDoc(D('clash_matches', m.id), { [`res.${side}`]: { w, h, c } }).catch(() => {}),
    close: () => { un1(); un2(); },
  };
}
export const ALL_IDS = CARDS.map((c) => c.id);
