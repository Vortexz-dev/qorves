<script lang="ts">
  /* CROWN CLASH — Qorves arena ligi. Ekranlar: giriş · ana sayfa (arena, sandıklar) · kartlar (deste + yükseltme) · mağaza · sıralama · arkadaşlar · arama · VS · maç · maç sonu. */
  import { onMount, onDestroy } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { wm, coreBack } from '../desktop/wm.svelte';
  import { ask } from '../lib/confirm.svelte';
  import { CARDS, CARD, avgCost, eff, upCost, evoTier, EVO_LV, MAX_LV, RARITY_TR, type DeckCard } from './clash/cards';
  import { init, step, hand, nextCard, timeLeft, elixRate, canDeploy, clone, hash, HZ, type State, type Cmd, type Side, type Fx, type MatchStats } from './clash/engine';
  import { makeBot } from './clash/bot';
  import * as N from './clash/net';
  import type { Pub, Match, DuelInv, Fr } from './clash/net';
  import { CHESTS, PACKS, BITPACKS, SLOTS, skipCost, rollChest, applyDrops, canUpgrade, upgrade, trophyDelta, bitReward, freshInv, type Inv, type ChestId, type Drop, type EndInfo } from './clash/economy';
  import { Renderer, preload, EMOTES, EMOTE_TR, type Emote } from './clash/render';
  import { THEMES, themeFor, type Theme } from './clash/themes';
  import { S, music } from './clash/audio';
  import { crownLink } from './clash/link.svelte';
  import Logo from './clash/Logo.svelte';
  import CardTile from './clash/CardTile.svelte';
  import ChestOpen from './clash/ChestOpen.svelte';
  import MatchEnd from './clash/MatchEnd.svelte';
  import Trophy from './clash/Trophy.svelte';

  const u = session.user!;
  const NAME = (u.character?.name || u.username).slice(0, 40);
  const IMG = import.meta.env.BASE_URL + 'img/clash/';
  type Scr = 'intro' | 'home' | 'cards' | 'shop' | 'rank' | 'friends' | 'seek' | 'vs' | 'match' | 'end';
  let scr = $state<Scr>('intro'), introStep = $state(0), ready = $state(false), loadErr = $state('');
  let inv = $state<Inv>(freshInv());
  let bk = $state<number | null>(null);
  let note = $state(''), noteT: ReturnType<typeof setTimeout> | null = null;
  const say = (m: string, ms = 2600) => { note = m; if (noteT) clearTimeout(noteT); noteT = setTimeout(() => (note = ''), ms); };
  const theme = $derived(themeFor(inv.cr));
  const nextTheme = $derived(THEMES.find((t) => t.cr > inv.cr));
  const deckLv = $derived(inv.deck.map((id) => ({ id, lv: inv.cards[id]?.lv ?? 1 })) as DeckCard[]);
  const kLv = $derived(Math.max(1, Math.round(deckLv.reduce((a, c) => a + c.lv, 0) / 8)));
  let clock = $state(Date.now());
  async function persist() { try { await N.saveInv(u.uid, NAME, $state.snapshot(inv) as Inv); } catch (e) { say('Kaydedilemedi: ' + String((e as Error)?.message ?? e).slice(0, 80)); throw e; } }
  function go(s: Scr) { if (scr === s) return; if (scr === 'cards' && deckDirty) saveDeck(); scr = s; S.tab(); if (s === 'rank') loadRank(); if (s === 'friends') loadFriends(); if (s === 'shop') refreshBK(); }

  /* ---------- sandıklar ---------- */
  let opening = $state<{ chest: ChestId; bit: number; drops: Drop[] } | null>(null);
  const unlocking = $derived(inv.chests.find((c) => c.open > 0 && c.open > clock));
  async function slotClick(i: number) {
    const c = inv.chests[i]; if (!c) return;
    if (c.open > 0 && c.open <= clock) return openChest(i);
    if (c.open > 0) {
      const cost = skipCost(c.open - clock);
      if (inv.qore < cost) { S.deny(); say(`${cost} QORE gerekiyor. Mağazadan QORE alabilirsin.`); return; }
      if (!(await ask('Hemen aç?', `${CHESTS[c.t].name} için ${cost} QORE harcanacak.`, `${cost} QORE`, false))) return;
      inv.qore -= cost; return openChest(i);
    }
    if (unlocking) { S.deny(); say('Aynı anda tek sandık açılabilir.'); return; }
    c.open = Date.now() + CHESTS[c.t].mins * 60_000; S.click(); persist().catch(() => {});
  }
  async function openChest(i: number) {
    const c = inv.chests[i]!; const r = rollChest(c.t, inv);
    inv.chests.splice(i, 1); applyDrops(inv, r.bit, r.drops);
    try { await persist(); } catch { return; }
    opening = { chest: c.t, ...r };
  }
  async function buyChest(t: ChestId) {
    const d = CHESTS[t]; if (!d.price) return;
    if (inv.qore < d.price) { S.deny(); say('QORE yetersiz.'); return; }
    if (!(await ask(`${d.name} al?`, `${d.price} QORE harcanacak. ${d.desc}`, `${d.price} QORE`, false))) return;
    inv.qore -= d.price; const r = rollChest(t, inv); applyDrops(inv, r.bit, r.drops);
    try { await persist(); } catch { return; }
    S.buy(); opening = { chest: t, ...r };
  }
  async function buyBits(i: number) {
    const p = BITPACKS[i]!; if (inv.qore < p.qore) { S.deny(); say('QORE yetersiz.'); return; }
    if (!(await ask(`${p.bit.toLocaleString('tr-TR')} BIT al?`, `${p.qore} QORE harcanacak.`, `${p.qore} QORE`, false))) return;
    inv.qore -= p.qore; inv.bit += p.bit; try { await persist(); S.coins(10); say(`+${p.bit.toLocaleString('tr-TR')} BIT`); } catch { /* */ }
  }
  /* ---------- QORE (gerçek BK) ---------- */
  let buying = $state(false);
  async function refreshBK() { try { bk = await N.walletBK(u.uid); } catch { bk = null; } }
  async function buyPack(id: string) {
    const p = PACKS.find((x) => x.id === id)!; await refreshBK();
    if (bk !== null && bk < p.bk) { S.deny(); say(`Cüzdanında ${bk.toLocaleString('tr-TR')} BK var; ${p.bk.toLocaleString('tr-TR')} BK gerekiyor.`); return; }
    if (!(await ask(`${p.qore} QORE satın al?`, `Karakterinin cüzdanından ${p.bk.toLocaleString('tr-TR')} BK düşülecek (gerçek para). Mevcut: ${(bk ?? 0).toLocaleString('tr-TR')} BK. Bu işlem DM kayıtlarına düşer ve geri alınamaz.`, `${p.bk.toLocaleString('tr-TR')} BK öde`, true))) return;
    buying = true;
    try { const r = await N.buyQore({ uid: u.uid, name: NAME }, id); inv.qore = r.qore; inv.lb = r.bid; bk = r.bal; S.buy(); say(`+${p.qore} QORE · Yeni bakiye ${r.bal.toLocaleString('tr-TR')} BK`, 4000); }
    catch (e) { S.deny(); say('Satın alma başarısız: ' + String((e as Error)?.message ?? e).slice(0, 90), 4000); }
    buying = false;
  }

  /* ---------- kartlar / deste / yükseltme ---------- */
  let selId = $state<string>(inv.deck[0] ?? 'chrome'), swapIn = $state<string | null>(null), deckDirty = false, upFx = $state<{ id: string; lv: number; evo: number } | null>(null);
  const sortedAll = $derived([...CARDS].sort((a, b) => Number(!!inv.cards[b.id]) - Number(!!inv.cards[a.id]) || a.cost - b.cost));
  function cardClick(id: string) {
    if (swapIn && inv.deck.includes(id)) { const i = inv.deck.indexOf(id); inv.deck[i] = swapIn; swapIn = null; deckDirty = true; S.pick(); return; }
    selId = id; swapIn = null; S.click();
  }
  function useCard(id: string) { if (!inv.cards[id]) return; swapIn = id; S.whoosh(); }
  async function saveDeck() { deckDirty = false; try { await persist(); } catch { /* */ } }
  async function doUpgrade(id: string) {
    if (!canUpgrade(inv, id)) { S.deny(); return; }
    const c = upCost(id, inv.cards[id]!.lv)!;
    if (c.gold >= 2500 && !(await ask(`${CARD[id]!.name} yükseltilsin mi?`, `${c.copies} kopya ve ${c.gold.toLocaleString('tr-TR')} BIT harcanacak.`, 'Yükselt', false))) return;
    const lv = upgrade(inv, id); const ev = lv === EVO_LV[0] ? 1 : lv === EVO_LV[1] ? 2 : 0;
    upFx = { id, lv, evo: ev }; if (ev) S.evolve(); else S.upgrade();
    persist().catch(() => {});
    setTimeout(() => (upFx = null), ev ? 3600 : 2200);
  }
  const fmt = (n: number) => n.toLocaleString('tr-TR');

  /* ---------- sıralama ---------- */
  let board = $state<Pub[]>([]), boardErr = $state(''), boardAt = 0, peek = $state<Pub | null>(null);
  async function loadRank(force = false) {
    if (!force && Date.now() - boardAt < 30_000 && board.length) return;
    try { await N.ensureBots().catch(() => {}); board = await N.leaderboard(); boardAt = Date.now(); boardErr = ''; } catch (e) { boardErr = 'Sıralama yüklenemedi: ' + String((e as Error)?.message ?? e).slice(0, 80); }
  }
  const myRank = $derived(board.findIndex((p) => p.uid === u.uid) + 1);

  /* ---------- arkadaşlar + düello ---------- */
  let fr = $state<Fr>({ f: [], in: [], name: '' }), people = $state<Pub[]>([]), fq = $state(''), sent = $state<Record<string, boolean>>({});
  const pmap = $derived(Object.fromEntries(people.map((p) => [p.uid, p])));
  async function loadFriends() { try { people = await N.allPlayers(); } catch { /* */ } }
  const found = $derived(fq.trim().length >= 1 ? people.filter((p) => p.uid !== u.uid && !fr.f.includes(p.uid) && p.name.toLowerCase().includes(fq.trim().toLowerCase())).slice(0, 8) : []);
  async function addFriend(p: Pub) { try { await N.requestFriend(u.uid, p.uid); sent[p.uid] = true; S.friend(); say(`${p.name} kişisine istek gönderildi.`); } catch (e) { S.deny(); say('İstek gönderilemedi: ' + String((e as Error)?.message ?? e).slice(0, 60)); } }
  async function acceptF(uid: string) { try { await N.acceptFriend(u.uid, uid); S.friend(); } catch (e) { S.deny(); say('Kabul edilemedi: ' + String((e as Error)?.message ?? e).slice(0, 60)); } }
  async function declineF(uid: string) { await N.declineFriend(u.uid, uid).catch(() => {}); S.click(); }
  async function removeF(uid: string) { if (await ask('Arkadaşlıktan çıkar?', `${pmap[uid]?.name ?? 'Oyuncu'} listenden çıkarılacak.`, 'Çıkar')) { await N.removeFriend(u.uid, uid).catch(() => {}); S.unpick(); } }
  let waitDuel = $state<{ id: string; to: string; t: number } | null>(null), duelUn: (() => void) | null = null, duelOff = 0;
  let invites = $state<DuelInv[]>([]);
  async function challenge(uid: string) {
    try {
      duelOff = await N.serverOffset(u.uid);
      const id = await N.sendDuel({ uid: u.uid, name: NAME, deck: deckLv, cr: inv.cr }, uid, pmap[uid]?.name ?? '');
      waitDuel = { id, to: pmap[uid]?.name ?? 'Rakip', t: Date.now() }; S.whoosh();
      duelUn = N.watchDuel(id, async (d) => {
        if (!d || !waitDuel) return;
        if (d.st === 'ok' && d.match) { const m = await N.loadMatch(d.match); stopWait(false); startPvp(m, 0, duelOff); }
        else if (d.st === 'no') { stopWait(false); S.deny(); say(`${waitDuel?.to ?? 'Rakip'} daveti reddetti.`); }
      });
    } catch (e) { S.deny(); say('Davet gönderilemedi: ' + String((e as Error)?.message ?? e).slice(0, 60)); }
  }
  function stopWait(cancel = true) { duelUn?.(); duelUn = null; if (cancel && waitDuel) N.cancelDuel(waitDuel.id); waitDuel = null; }
  async function acceptInvite(d: DuelInv) {
    invites = invites.filter((x) => x.id !== d.id); S.click();
    try { const { m, off } = await N.acceptDuel(d, { uid: u.uid, name: NAME, deck: deckLv, cr: inv.cr }); startPvp(m, 1, off); }
    catch (e) { S.deny(); say('Düelloya katılınamadı: ' + String((e as Error)?.message ?? e).slice(0, 60)); }
  }
  function declineInvite(d: DuelInv) { invites = invites.filter((x) => x.id !== d.id); N.declineDuel(d.id); S.unpick(); }
  async function linkDuel(id: string) { crownLink.duel = ''; const d = await N.getDuel(id).catch(() => null); if (d && d.st === 'open' && d.to === u.uid && Date.now() - d.at < 120_000) acceptInvite(d); else say('Davet artık geçerli değil.'); }
  $effect(() => { if (ready && crownLink.duel && scr === 'intro') { scr = 'home'; music.level(0); } if (ready && crownLink.duel && (scr === 'home' || scr === 'cards' || scr === 'shop' || scr === 'rank' || scr === 'friends')) linkDuel(crownLink.duel); });

  /* ---------- arama ---------- */
  let seekT = $state(0), seekStop: (() => void) | null = null, seekTimer: ReturnType<typeof setInterval> | null = null, seekErr = $state('');
  const SEEK_BOT_AFTER = 9;
  function startSeek() {
    scr = 'seek'; seekT = 0; seekErr = ''; S.whoosh();
    seekTimer = setInterval(() => { seekT++; if (seekT === SEEK_BOT_AFTER && scr === 'seek') botFallback(); }, 1000);
    seekStop = N.seek({ uid: u.uid, name: NAME, deck: deckLv, cr: inv.cr }, (m, side, off) => { stopSeek(false); startPvp(m, side, off); }, (e) => { seekErr = 'Arama başarısız: ' + String((e as Error)?.message ?? e).slice(0, 80); });
  }
  async function botFallback() {
    stopSeek(false); seekStop = null;
    const b = await N.pickBot(inv.cr).catch(() => N.seedBots()[0]!);
    startBot(b, 'ranked');
  }
  function stopSeek(cancel = true) { if (seekTimer) clearInterval(seekTimer); seekTimer = null; if (seekStop) seekStop(); seekStop = null; if (cancel) { scr = 'home'; S.unpick(); } }

  /* ---------- maç ---------- */
  let canvas: HTMLCanvasElement | undefined = $state(), arenaBox: HTMLDivElement | undefined = $state();
  let R: Renderer | null = null, st = $state.raw<State | null>(null), me: Side = 0, mode = $state<'ranked' | 'practice' | 'pvp' | 'friendly'>('practice');
  let foe = $state<{ name: string; cr: number; lv: number; bot: boolean }>({ name: 'BOT', cr: 0, lv: 1, bot: true }), foeBot: Pub | null = null;
  let mTheme = $state<Theme>(THEMES[0]!);
  let raf = 0, t0 = 0, off = 0, bot: ((s: State) => Cmd | null) | null = null;
  let cmds = new Map<number, Cmd[]>(), snaps: State[] = [], net: ReturnType<typeof N.channel> | null = null, match: Match | null = null, seq = 0;
  let pending = $state<Cmd[]>([]), pick = $state<number>(-1), drag = $state<{ card: string; x: number; y: number; ok: boolean } | null>(null), dragging = false;
  let ui = $state({ elix: 5, hand: [] as string[], next: '', time: 180, crowns: [0, 0] as number[], rate: 1, ot: false, count: 0 });
  let end = $state<{ info: EndInfo; st: MatchStats; me: Side; deck: string[] } | null>(null);
  let emoOpen = $state(false), emoCd = 0, botEmoCd = 0, nextBait = 0;
  const DELAY_PVP = 22, DELAY_BOT = 3;
  let lastSec = -1, lastRate = 1, fullBeep = false, hk: Record<number, string> = {};
  const myLv = () => Object.fromEntries(deckLv.map((c) => [c.id, c.lv]));

  function addCmd(c: Cmd) { const a = cmds.get(c.t) ?? []; if (a.some((x) => x.side === c.side && x.n === c.n)) return false; a.push(c); a.sort((x, y) => x.side - y.side || x.n - y.n); cmds.set(c.t, a); return true; }
  function startBot(b: Pub | null, m: 'ranked' | 'practice') {
    mode = m; me = 0; net = null; match = null;
    let deck1: DeckCard[]; let skill = 2;
    if (b) { foeBot = b; deck1 = b.deck.map((id, i) => ({ id, lv: b.dl[i] ?? 1 })); skill = N.botSkill(b.cr); foe = { name: b.name, cr: b.cr, lv: b.lv, bot: true }; }
    else { foeBot = null; const pool = CARDS.map((c) => c.id).sort(() => Math.random() - 0.5).slice(0, 8); deck1 = pool.map((id) => ({ id, lv: Math.max(1, kLv - 1) })); foe = { name: 'Antrenman Botu', cr: inv.cr, lv: Math.max(1, kLv - 1), bot: true }; }
    const seed = (Math.random() * 2 ** 31) | 0;
    bot = makeBot(1, seed ^ 0x5bd1e995, skill);
    mTheme = themeFor(Math.max(inv.cr, b?.cr ?? 0));
    begin(seed, [deckLv.slice(), deck1], -1);
  }
  function startPvp(m: Match, side: Side, o: number) {
    mode = m.friendly ? 'friendly' : 'pvp'; me = side; match = m; off = o; bot = null; foeBot = null;
    const fd = (m.decks as Record<number, DeckCard[]>)[1 - side]!;
    foe = { name: m.names[1 - side] ?? 'Rakip', cr: m.cr[1 - side] ?? 0, lv: Math.max(1, Math.round(fd.reduce((a, c) => a + (c.lv ?? 1), 0) / 8)), bot: false };
    mTheme = themeFor(Math.max(m.cr[0] ?? 0, m.cr[1] ?? 0));
    net = N.channel(m, side, (c) => { if (c.side === me) return; onRemote(c); }, () => { if (st && !st.over) finish(true); }, (s, e) => { R?.emote(s, e as Emote); S.emote(e); });
    const dk = m.decks as Record<number, DeckCard[]>; begin(m.seed, [dk[0]!.slice(), dk[1]!.slice()], 0);
  }
  function begin(seed: number, decks: [DeckCard[], DeckCard[]], startAt: number) {
    finished = false; cmds = new Map(); hk = {}; snaps = []; pending = []; seq = 0; end = null; lastRate = 1; lastSec = -1; emoOpen = false; emoCd = 0; botEmoCd = 0; nextBait = 0;
    st = init(seed, decks); snaps.push(clone(st));
    music.theme(mTheme);
    scr = 'vs'; S.whoosh(); setTimeout(() => S.stamp(), 650);
    setTimeout(() => { t0 = startAt < 0 ? performance.now() + 3200 : startAt; scr = 'match'; music.level(1); requestAnimationFrame(() => { setupCanvas(); loop(); }); }, 2800);
  }
  function now() { return mode === 'pvp' || mode === 'friendly' ? Date.now() + off - match!.t0 : performance.now() - t0; }
  function setupCanvas() { if (!canvas || !arenaBox) return; R = new Renderer(canvas, me, mTheme); const r = arenaBox.getBoundingClientRect(); R.resize(r.width, r.height); }
  function onRemote(c: Cmd) {
    if (!st) return;
    if (!addCmd(c)) return;
    if (c.t < st.tick) {
      const target = st.tick; const base = snaps.filter((s) => s.tick <= c.t).pop() ?? snaps[0]!;
      snaps = snaps.filter((x) => x.tick <= base.tick);
      const s = clone(base); while (s.tick < target && !s.over) { step(s, cmds.get(s.tick) ?? []); if (s.tick % HZ === 0) { snaps.push(clone(s)); if (snaps.length > 40) snaps.splice(1, 1); } if (s.tick % 100 === 0) hk[s.tick] = hash(s); }
      st = s;
    }
  }
  function sounds(fx: Fx[]) {
    for (const f of fx) {
      switch (f.k) {
        case 'deploy': S.deploy(); break; case 'cast': if (f.card === 'plasma' || f.card === 'nova') S.strikeWarn(); else S.spellCast(); break;
        case 'melee': S.melee(); break; case 'hit': break; case 'die': S.die(); break; case 'tdie': S.tower(); break; case 'crown': setTimeout(S.crown, 400); break;
        case 'boom': S.boom(Math.min(1.6, 0.5 + (f.v ?? 1) * 0.3)); break; case 'strike': S.strike(); break; case 'frostnova': case 'freeze': S.freeze(); break; case 'shatter': S.shatter(); break;
        case 'emp': S.emp(); break; case 'arc': S.arc(); break; case 'roll': S.roll(); break; case 'oc': S.overclock(); break; case 'pod': case 'podzone': S.pod(); break;
        case 'spawn': case 'deathspawn': S.spawn(); break; case 'pump': S.pump(); break; case 'crit': S.crit(); break; case 'charge': S.charge(); break; case 'chargehit': S.heavy(); break;
        case 'healpulse': case 'healwave': S.heal(); break; case 'shbreak': S.shield(); break; case 'ot': S.overtime(); break;
        case 'shot': {
          const c = f.card ?? ''; const p = CARD[c]?.proj;
          if (c === 'king' || c === 'crown') S.bolt(c === 'king'); else if (p === 'rail') S.rail(); else if (p === 'tracer') S.tracer(); else if (p === 'plasma') S.plasma(); else if (p === 'snipe') S.snipe();
          else if (p === 'flame') S.flame(); else if (p === 'frost') S.frost(); else if (p === 'beam') S.beam(); else if (p === 'arc') S.arc(); else if (p === 'heal') S.heal(); else if (CARD[c]?.hp && (CARD[c]!.hp ?? 0) > 1500) S.heavy(); else S.melee();
          break;
        }
      }
    }
  }
  /* bot emojileri: kule alınca, iyi oyunda, yem olarak ve oyuncuya cevap */
  function botEmote(pool: Emote[], chance: number, delay = 700) {
    if (!bot || !R || Math.random() > chance || performance.now() < botEmoCd) return;
    botEmoCd = performance.now() + 5000; const e = pool[Math.floor(Math.random() * pool.length)]!;
    setTimeout(() => { if (R && st && !end) { R.emote(1, e); S.emote(e); } }, delay);
  }
  function botReact(fx: Fx[]) {
    if (!bot || !st) return;
    let myDeaths = 0;
    for (const f of fx) {
      if (f.k === 'tdie') { if (f.side === me) botEmote(['laugh', 'taunt', 'smug'], 0.75, 900); else botEmote(['angry', 'cry', 'facepalm'], 0.55, 1100); }
      if (f.k === 'die' && f.side === me) myDeaths++;
    }
    if (myDeaths >= 3) botEmote(['smug', 'thumb', 'laugh'], 0.4, 600);
    const t = st.tick / HZ;
    if (!nextBait) nextBait = 25 + Math.random() * 30;
    if (t > nextBait) { nextBait = t + 35 + Math.random() * 40; if (st.elix[1] >= 7) botEmote(['think', 'sleep', 'taunt'], 0.35, 200); }
  }
  const REPLY: Record<string, Emote[]> = { laugh: ['angry', 'laugh'], taunt: ['taunt', 'laugh', 'smug'], gg: ['gg'], thumb: ['thumb', 'smug'], cry: ['laugh', 'smug'], angry: ['laugh', 'sleep'], wow: ['smug'], facepalm: ['laugh'], think: ['think', 'sleep'], sleep: ['angry', 'taunt'], smug: ['angry', 'facepalm'] };
  function sendEmote(e: Emote) {
    emoOpen = false; if (!R || !st || performance.now() < emoCd) { S.deny(); return; }
    emoCd = performance.now() + 2500; R.emote(me, e); S.emote(e);
    if (net) net.emote(e, st.tick);
    if (bot) { botEmoCd = 0; botEmote(REPLY[e] ?? ['thumb'], 0.5, 1200 + Math.random() * 900); }
  }
  let lastFrame = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!st || !R) return;
    const tnow = performance.now(), dt = Math.min(0.05, (tnow - (lastFrame || tnow)) / 1000); lastFrame = tnow;
    const ms = now();
    if (ms < 0) { const c = Math.ceil(-ms / 1000); if (c !== ui.count && c <= 3) { ui.count = c; S.count(false); } R.draw(st, dt, null); sync(); return; }
    if (ui.count) { ui.count = 0; S.count(true); }
    const target = Math.floor(ms / (1000 / HZ)); let n = 0; const fx: Fx[] = [];
    const s = st;
    while (s.tick < target && !s.over && n++ < 400) {
      if (bot) { const c = bot(s); if (c) { c.t = s.tick + DELAY_BOT; addCmd(c); } }
      step(s, cmds.get(s.tick) ?? [], fx);
      if (s.tick % HZ === 0) { snaps.push(clone(s)); if (snaps.length > 40) snaps.splice(1, 1); }
      if (s.tick % 100 === 0) hk[s.tick] = hash(s);
    }
    pending = pending.filter((c) => c.t >= s.tick);
    R.feed(fx); sounds(fx); botReact(fx);
    R.draw(s, dt, drag);
    st = s; sync();
    if (s.over) finish(false);
  }
  function sync() {
    if (!st) return;
    const res = pending.reduce((a, c) => a + (CARD[c.card]?.cost ?? 0), 0);
    ui.elix = Math.max(0, st.elix[me] - res); ui.hand = hand(st, me); ui.next = nextCard(st, me); ui.time = Math.max(0, timeLeft(st)); ui.ot = st.ot;
    ui.crowns = me === 0 ? [st.crowns[0], st.crowns[1]] : [st.crowns[1], st.crowns[0]]; ui.rate = elixRate(st.tick);
    if (ui.rate !== lastRate) { lastRate = ui.rate; music.level(ui.rate >= 3 || st.ot ? 3 : 2); S.crown(); }
    if (ui.elix >= 10 && !fullBeep) { fullBeep = true; S.elixFull(); } if (ui.elix < 9.9) fullBeep = false;
    const sec = Math.ceil(ui.time); if (sec !== lastSec) { lastSec = sec; if (sec <= 10 && sec > 0 && ui.count === 0) S.count(false); }
  }
  function play(card: string, x: number, y: number) {
    if (!st || st.over || now() < 0) return false;
    const c = CARD[card]!;
    if (c.cost > ui.elix + 1e-9) { S.deny(); return false; }
    if (pending.some((p) => p.card === card)) { S.deny(); return false; }
    if (!canDeploy(st, me, card, x, y)) { S.deny(); return false; }
    const cmd: Cmd = { t: st.tick + (net ? DELAY_PVP : DELAY_BOT), side: me, card, x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2, n: seq++ };
    addCmd(cmd); pending = [...pending, cmd]; pick = -1; S.pick();
    if (net) net.send(cmd).catch(() => {});
    return true;
  }
  function arenaPt(e: PointerEvent) { const r = arenaBox!.getBoundingClientRect(); return R!.world(e.clientX - r.left, e.clientY - r.top); }
  function cardDown(i: number, e: PointerEvent) { const id = ui.hand[i]; if (!id) return; pick = i; dragging = true; S.click(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
  function inside(e: PointerEvent) { const r = arenaBox!.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }
  function move(e: PointerEvent) {
    if (pick < 0 || !R || !st || !arenaBox) return;
    const p = arenaPt(e); const id = ui.hand[pick]!;
    drag = inside(e) ? { card: id, x: p.x, y: p.y, ok: canDeploy(st, me, id, p.x, p.y) && CARD[id]!.cost <= ui.elix } : dragging ? null : drag;
  }
  function up(e: PointerEvent) {
    if (pick < 0 || !R || !arenaBox) return;
    if (dragging && inside(e)) { const p = arenaPt(e); play(ui.hand[pick]!, p.x, p.y); drag = null; }
    dragging = false;
  }
  function arenaClick(e: PointerEvent) { if (pick >= 0 && !dragging && R) { const p = arenaPt(e); play(ui.hand[pick]!, p.x, p.y); drag = null; } }
  function key(e: KeyboardEvent) {
    if (scr !== 'match') return; const k = Number(e.key);
    if (k >= 1 && k <= 4) { pick = pick === k - 1 ? -1 : k - 1; S.click(); } else if (e.key === 'e' || e.key === 'E') { emoOpen = !emoOpen; S.click(); }
  }

  let finished = false;
  async function finish(forfeit: boolean) {
    if (finished || end || !st) return; finished = true;
    cancelAnimationFrame(raf);
    const w = forfeit ? me : st.winner; const res: 'win' | 'lose' | 'draw' = w === me ? 'win' : w === 2 || w === -1 ? 'draw' : 'lose';
    const crowns: [number, number] = [ui.crowns[0]!, ui.crowns[1]!];
    const ranked = mode === 'ranked' || mode === 'pvp';
    const dcr = ranked ? trophyDelta(inv.cr, foe.cr, res) : 0;
    const bit = mode === 'practice' ? 0 : bitReward(res, crowns[0], inv.cr);
    let chest: EndInfo['chest'] = 'no';
    if (ranked && res === 'win') { if (inv.chests.length < SLOTS) { inv.chests.push({ t: 'win', id: N.nid(), open: 0 }); chest = 'yes'; } else chest = 'full'; }
    if (net && match) await net.result(w, hash(st), st.crowns);
    // bot sonucu
    if (mode === 'ranked' && foeBot) N.botResult(foeBot, res === 'win' ? 'lose' : res === 'lose' ? 'win' : 'draw', inv.cr).catch(() => {});
    if (bot) setTimeout(() => { if (R) { const e: Emote = res === 'lose' ? (Math.random() < 0.5 ? 'laugh' : 'gg') : Math.random() < 0.6 ? 'gg' : 'cry'; R.emote(1, e); S.emote(e); } }, 500);
    if (ranked) { inv.cr = Math.max(0, inv.cr + dcr); inv.best = Math.max(inv.best, inv.cr); }
    if (mode !== 'practice') { if (res === 'win') inv.w++; else if (res === 'lose') inv.l++; else inv.d++; inv.streak = res === 'win' ? inv.streak + 1 : 0; }
    inv.bit += bit;
    if (mode !== 'practice') persist().catch(() => {});
    const why = forfeit ? 'Rakip maçı terk etti' : st.reason === '3 taç' ? 'Ana kule düştü' : st.reason === 'süre' ? 'Süre doldu · taç farkı' : st.reason === 'ani ölüm' ? 'Uzatmada ani ölüm' : st.reason === 'eşitlik bozucu' ? 'Kule canı farkı' : st.reason || '';
    const desync = await checkDesync();
    const info: EndInfo = { res, why, crowns, dcr, cr: inv.cr, bit, chest, foe: foe.name, foeBot: foe.bot, friendly: mode === 'friendly' || mode === 'practice', tag: mode === 'practice' ? 'Antrenman · kupasız' : mode === 'friendly' ? 'Dostluk maçı · kupasız' : '', desync, theme: mTheme.id };
    const ss = st.st, deck = inv.deck.slice(), side = me;
    music.level(0); setTimeout(() => (res === 'win' ? S.win() : res === 'lose' ? S.lose() : S.crown()), 600);
    setTimeout(() => { end = { info, st: ss, me: side, deck: match ? (match.decks as Record<number, DeckCard[]>)[side]!.map((c) => c.id) : deck }; scr = 'end'; net?.close(); net = null; }, 2000);
  }
  async function checkDesync() {
    if (!match) return false;
    await new Promise((r) => setTimeout(r, 1500));
    try { const m = await N.loadMatch(match.id); const a = m.res?.[0], b = m.res?.[1]; return !!(a && b && a.h !== b.h); } catch { return false; }
  }
  async function quitMatch() {
    if (scr !== 'match' || !st || st.over) { toHome(); return; }
    const ranked = mode === 'ranked' || mode === 'pvp';
    if (await ask('Maçtan çık?', ranked ? 'Çıkarsan maçı kaybedersin ve kupa düşer.' : 'Maç sonlanacak.', 'Çık', true)) {
      if (finished) return; finished = true;
      if (net) { net.leave(); net.close(); net = null; }
      cancelAnimationFrame(raf);
      if (ranked) { inv.cr = Math.max(0, inv.cr + trophyDelta(inv.cr, foe.cr, 'lose')); inv.l++; inv.streak = 0; persist().catch(() => {}); if (foeBot) N.botResult(foeBot, 'win', inv.cr).catch(() => {}); }
      toHome();
    }
  }
  function toHome() { cancelAnimationFrame(raf); st = null; R = null; end = null; scr = 'home'; music.theme(theme); music.level(0); }

  $effect(() => { const s = scr; coreBack.go = s === 'cards' || s === 'shop' || s === 'rank' || s === 'friends' ? () => go('home') : s === 'seek' ? () => stopSeek() : s === 'match' ? () => quitMatch() : s === 'end' ? () => toHome() : null; });
  $effect(() => { music.pause(wm.coreMin); });
  let ro: ResizeObserver | null = null;
  $effect(() => { if (arenaBox && scr === 'match') { ro?.disconnect(); ro = new ResizeObserver(() => { if (R && arenaBox) { const r = arenaBox.getBoundingClientRect(); R.resize(r.width, r.height); } }); ro.observe(arenaBox); } });
  let mvol = $state(music.volume);
  let unFr: (() => void) | null = null, unInv: (() => void) | null = null, clockT: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    Promise.all([preload(), N.loadInv(u.uid)]).then(async ([, r]) => {
      inv = r.inv; selId = inv.deck[0]!; ready = true; music.theme(themeFor(inv.cr));
      if (r.fresh) persist().catch(() => {});
      N.ensureFr(u.uid, NAME).catch(() => {});
      setTimeout(() => { N.ensureBots().then(() => N.backgroundSims()).catch(() => {}); }, 6000);
    }).catch((e) => { loadErr = 'Yüklenemedi: ' + String((e as Error)?.message ?? e).slice(0, 100); });
    S.whoosh(); music.start(0);
    const ts = [setTimeout(() => (introStep = 1), 200), setTimeout(() => { introStep = 2; S.stamp(); }, 1300), setTimeout(() => (introStep = 3), 1900)];
    addEventListener('keydown', key);
    unFr = N.watchFr(u.uid, (f) => { if (f.in.length > fr.in.length) S.notify(); fr = f; if (f.f.length || f.in.length) loadFriends(); });
    unInv = N.watchInvites(u.uid, (d) => { const fresh = d.filter((x) => !invites.some((y) => y.id === x.id)); if (fresh.length) S.notify(); invites = d; });
    clockT = setInterval(() => (clock = Date.now()), 1000);
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) (window as unknown as Record<string, unknown>).__clash = { get st() { return st; }, play, get ui() { return ui; }, get scr() { return scr; }, get inv() { return inv; }, practice: () => startBot(null, 'practice'), ranked: async () => startBot(await N.pickBot(inv.cr), 'ranked'), me: () => me, hk: () => hk, emote: sendEmote, go, slotClick, finishNow: () => { if (st) { st.over = true; st.winner = me; st.reason = '3 taç'; st.crowns[me] = 3; } } };
    return () => { ts.forEach(clearTimeout); removeEventListener('keydown', key); };
  });
  onDestroy(() => { cancelAnimationFrame(raf); stopSeek(false); stopWait(); if (net && st && !st.over) net.leave(); net?.close(); music.stop(); coreBack.go = null; ro?.disconnect(); unFr?.(); unInv?.(); if (clockT) clearInterval(clockT); });
  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const hms = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}sa ${m}dk` : m ? `${m}dk ${s % 60}sn` : `${s}sn`; };
  const skip = () => { if (scr === 'intro' && ready) { S.click(); scr = 'home'; music.level(0); } };
  const sel = $derived(CARD[selId]!);
  const selO = $derived(inv.cards[selId]);
  const selLv = $derived(selO?.lv ?? 1);
  const cur = $derived(eff(selId, selLv)), nxt = $derived(selLv < MAX_LV ? eff(selId, selLv + 1) : null);
  const selCost = $derived(upCost(selId, selLv));
</script>

<svelte:window onpointermove={move} onpointerup={up} />

<div class="cl" data-nolb style={`--acc:${(scr === 'match' || scr === 'vs' ? mTheme : theme).accent}`}>
  <div class="bgk" style={`background-image:url(${IMG}${scr === 'intro' ? 'key' : theme.ground}.webp)`} class:dim={scr !== 'intro'}></div>
  <div class="scan"></div>

  {#if scr === 'intro'}
    <button class="intro" onclick={skip} type="button">
      {#if introStep >= 1}<Logo size={1.25} sub="QORVES ARENA LİGİ · SEZON 01" />{/if}
      <div class="press mono" class:on={introStep >= 3}>{loadErr || (ready ? 'BAŞLAMAK İÇİN TIKLA' : 'YÜKLENİYOR…')}</div>
    </button>
  {:else if scr === 'home' || scr === 'cards' || scr === 'shop' || scr === 'rank' || scr === 'friends'}
    <div class="shell">
      <header class="top">
        <div class="me"><div class="klv">{kLv}</div><div><b>{NAME}</b><small>{theme.name} · Kral seviyesi {kLv}</small></div></div>
        <div class="pill tro"><Trophy size={18} /><b>{fmt(inv.cr)}</b></div>
        <div class="pill"><img src={`${IMG}cur_bit.webp`} alt="" /><b>{fmt(inv.bit)}</b><small>BIT</small></div>
        <button class="pill q" onclick={() => go('shop')} type="button"><img src={`${IMG}cur_qore.webp`} alt="" /><b>{fmt(inv.qore)}</b><small>QORE</small><i>+</i></button>
        <label class="vol mono">MÜZİK <input type="range" min="0" max="1" step="0.05" bind:value={mvol} oninput={() => music.vol(mvol)} /></label>
      </header>

      {#key scr}
      <main class="page">
        {#if scr === 'home'}
          <div class="home">
            <div class="hero" style={`background-image:linear-gradient(90deg,color-mix(in srgb,${theme.accent} 18%,transparent),transparent 50%),url(${IMG}key.webp)`}>
              <div class="hshade"></div>
              <div class="hl"><Logo size={0.62} anim={false} /></div>
              <div class="arena"><small class="mono">ARENA {THEMES.indexOf(theme) + 1}/5</small><b>{theme.name}</b><p>{theme.desc}</p>
                {#if nextTheme}<div class="prog"><i style={`width:${Math.min(100, ((inv.cr - theme.cr) / (nextTheme.cr - theme.cr)) * 100)}%`}></i><span>{nextTheme.name}: {fmt(nextTheme.cr)} <Trophy size={12} /></span></div>{:else}<div class="prog max"><span>Son arena · en iyi {fmt(inv.best)}</span></div>{/if}
              </div>
              <div class="cta">
                <button class="battle" onclick={startSeek} onmouseenter={S.hover} type="button"><b>SAVAŞ</b><small>Kupalı maç · oyuncu ya da sıralama botu</small></button>
                <button class="train" onclick={() => { S.click(); startBot(null, 'practice'); }} onmouseenter={S.hover} type="button">Antrenman <small>kupasız</small></button>
              </div>
              <div class="wl mono"><span>G {inv.w}</span><span>M {inv.l}</span><span>B {inv.d}</span>{#if inv.streak >= 2}<span class="hot">{inv.streak} galibiyet serisi</span>{/if}</div>
            </div>
            <div class="slots">
              {#each Array(SLOTS) as _, i}{@const c = inv.chests[i]}
                {#if c}{@const d = CHESTS[c.t]}{@const rdy = c.open > 0 && c.open <= clock}{@const ul = c.open > clock}
                  <button class="slot" class:rdy class:ul onclick={() => slotClick(i)} onmouseenter={S.hover} style={`--d:${i * 80}ms`} type="button">
                    <img src={`${IMG}${d.img}.webp`} alt="" /><b>{d.name}</b>
                    <small>{rdy ? 'AÇ!' : ul ? hms(c.open - clock) : `Kilit aç · ${d.mins} dk`}</small>
                    {#if ul}<em class="skip"><img src={`${IMG}cur_qore.webp`} alt="" />{skipCost(c.open - clock)}</em>{/if}
                  </button>
                {:else}<div class="slot empty" style={`--d:${i * 80}ms`}><span>Boş yuva</span><small>Kupalı maç kazan</small></div>{/if}
              {/each}
            </div>
          </div>
        {:else if scr === 'cards'}
          <div class="cards">
            <div class="cl-left">
              <div class="h mono">SAVAŞ DESTESİ · ort. {avgCost(inv.deck).toFixed(1)} iksir {#if swapIn}<em class="swap">{CARD[swapIn]!.name} için değiştirilecek kartı seç · <button onclick={() => (swapIn = null)} type="button">vazgeç</button></em>{/if}</div>
              <div class="deck8" class:swapping={!!swapIn}>{#each inv.deck as id, i (id)}{@const o = inv.cards[id]!}<div class="dwrap"><CardTile {id} lv={o.lv} n={o.n} sel={selId === id} up={canUpgrade(inv, id)} delay={i * 40} onclick={() => cardClick(id)} /></div>{/each}</div>
              <div class="h mono">KOLEKSİYON · {Object.keys(inv.cards).length}/{CARDS.length}</div>
              <div class="coll">{#each sortedAll.filter((c) => !inv.deck.includes(c.id)) as c, i (c.id)}{@const o = inv.cards[c.id]}<CardTile id={c.id} lv={o?.lv ?? 1} n={o ? o.n : -1} locked={!o} small sel={selId === c.id} up={!!o && canUpgrade(inv, c.id)} delay={i * 20} onclick={() => cardClick(c.id)} />{/each}</div>
            </div>
            <aside class="det">
              {#key selId}
              <div class={'big r-' + sel.rarity}><img src={`${IMG}card_${selId}.webp`} alt="" />{#if evoTier(selLv)}<span class={'evb e' + evoTier(selLv)}>EVO {evoTier(selLv) === 2 ? 'II' : 'I'}</span>{/if}</div>
              <div class="dt"><b>{sel.name}</b><span class="mono">{RARITY_TR[sel.rarity]} · {sel.role} · {sel.cost} iksir</span></div>
              <p class="desc">{sel.desc}</p>
              {#if selO}
                <div class="lvrow"><span class="lvb">Seviye {selLv}</span>{#if selLv < MAX_LV}<span class="mono">→ {selLv + 1}: %8 güç</span>{:else}<span class="mono">MAKSİMUM</span>{/if}</div>
                <div class="statg">
                  {#if cur.hp}<div><i>Can</i><b>{fmt(Math.round(cur.hp))}</b>{#if nxt?.hp}<em>+{fmt(Math.round(nxt.hp - cur.hp))}</em>{/if}</div>{/if}
                  {#if cur.dmg}<div><i>Hasar</i><b>{fmt(Math.round(cur.dmg))}</b>{#if nxt?.dmg}<em>+{fmt(Math.round(nxt.dmg - cur.dmg))}</em>{/if}</div>{/if}
                  {#if cur.hs && cur.dmg && sel.kind !== 'spell'}<div><i>DPS</i><b>{fmt(Math.round(cur.dmg / cur.hs))}</b></div>{/if}
                  {#if cur.range}<div><i>Menzil</i><b>{cur.range}</b></div>{/if}
                  {#if cur.speed}<div><i>Hız</i><b>{cur.speed}</b></div>{/if}
                  {#if cur.count && cur.count > 1}<div><i>Adet</i><b>×{cur.count}</b></div>{/if}
                  {#if cur.radius}<div><i>Yarıçap</i><b>{cur.radius}</b></div>{/if}
                  {#if cur.tgt}<div><i>Hedef</i><b>{cur.tgt === 'both' ? 'Kara+Hava' : cur.tgt === 'build' ? 'Yapılar' : cur.tgt === 'air' ? 'Hava' : 'Kara'}</b></div>{/if}
                </div>
                <div class="evos">{#each [0, 1] as k}<div class:on={evoTier(selLv) > k}><b>EVO {k ? 'II' : 'I'} · Sv {EVO_LV[k]}</b><span>{sel.evoTxt?.[k] ?? '—'}</span></div>{/each}</div>
                <div class="acts">
                  {#if selCost}<button class="upb" disabled={!canUpgrade(inv, selId)} onclick={() => doUpgrade(selId)} type="button"><b>YÜKSELT</b><small>{selO.n}/{selCost.copies} kopya · {fmt(selCost.gold)} BIT</small></button>{/if}
                  {#if !inv.deck.includes(selId)}<button class="use" onclick={() => useCard(selId)} type="button">Desteye al</button>{/if}
                </div>
                <div class="ctr mono">Karşı: {sel.counters}</div>
              {:else}<div class="lockd">Bu kart henüz yok. Sandıklardan çıkar.</div>{/if}
              {/key}
            </aside>
          </div>
        {:else if scr === 'shop'}
          <div class="shop">
            <section>
              <h3>QORE <small>Premium para · yalnız karakterinin BK'sı ile · bakiye: {bk === null ? '…' : fmt(bk) + ' BK'}</small></h3>
              <div class="row3">{#each PACKS as p, i (p.id)}
                <button class="offer q" disabled={buying} onclick={() => buyPack(p.id)} onmouseenter={S.hover} style={`--d:${i * 70}ms`} type="button">
                  {#if 'tag' in p}<em class="tag">{p.tag}</em>{/if}<img src={`${IMG}cur_qore.webp`} alt="" class:x2={i === 1} class:x3={i === 2} /><b>{fmt(p.qore)} QORE</b><small>{p.name}</small><span class="price">{fmt(p.bk)} BK</span>
                </button>{/each}</div>
            </section>
            <section>
              <h3>PREMIUM SANDIKLAR <small>QORE ile · anında açılır</small></h3>
              <div class="row3">{#each ['neon', 'leg'] as t, i}{@const d = CHESTS[t as ChestId]}
                <button class="offer ch" onclick={() => buyChest(t as ChestId)} onmouseenter={S.hover} style={`--d:${200 + i * 70}ms`} type="button">
                  <img src={`${IMG}${d.img}.webp`} alt="" class="cimg" /><b>{d.name}</b><small>{d.desc} · {d.cards} kart · {d.bit[0]}–{d.bit[1]} BIT</small>
                  <div class="odds mono">{#each Object.entries(d.odds) as [r, v]}<span class={'o-' + r}>{RARITY_TR[r as keyof typeof RARITY_TR]} %{v}</span>{/each}</div>
                  <span class="price"><img src={`${IMG}cur_qore.webp`} alt="" />{d.price}</span>
                </button>{/each}
                <div class="offer info"><b>Veri Kasası</b><small>Kupalı galibiyetlerde düşer · {CHESTS.win.mins} dk kilit · {CHESTS.win.cards} kart</small><div class="odds mono">{#each Object.entries(CHESTS.win.odds) as [r, v]}<span class={'o-' + r}>{RARITY_TR[r as keyof typeof RARITY_TR]} %{v}</span>{/each}</div></div>
              </div>
            </section>
            <section>
              <h3>BIT PAKETLERİ <small>QORE ile yükseltme hızlandır</small></h3>
              <div class="row3">{#each BITPACKS as b, i}
                <button class="offer b" onclick={() => buyBits(i)} onmouseenter={S.hover} style={`--d:${400 + i * 70}ms`} type="button"><img src={`${IMG}cur_bit.webp`} alt="" /><b>{fmt(b.bit)} BIT</b><span class="price"><img src={`${IMG}cur_qore.webp`} alt="" />{b.qore}</span></button>{/each}</div>
            </section>
          </div>
        {:else if scr === 'rank'}
          <div class="rank">
            <div class="rh"><h3>SIRALAMA <small>Oyuncular ve arena botları · botlar da maç yapar, kupa kazanır</small></h3><button class="btn" onclick={() => loadRank(true)} type="button">Yenile</button></div>
            {#if boardErr}<p class="err">{boardErr}</p>{/if}
            <div class="list">
              {#each board as p, i (p.uid)}
                <button class="lr" class:mine={p.uid === u.uid} class:bot={p.bot} onclick={() => { peek = p; S.click(); }} style={`--d:${Math.min(i, 20) * 25}ms`} type="button">
                  <span class={'pos p' + (i + 1)}>{i + 1}</span><span class="klv sm">{p.lv}</span><span class="pn">{p.name}{#if p.bot}<em>BOT</em>{/if}{#if p.uid === u.uid}<em class="you">SEN</em>{/if}</span>
                  <span class="ar mono">{themeFor(p.cr).name}</span><span class="lwl mono">{p.w}G {p.l}M</span><b><Trophy size={14} /> {fmt(p.cr)}</b>
                </button>
              {:else}<p class="mono dim">Yükleniyor…</p>{/each}
            </div>
            {#if board.length && !myRank}<p class="mono dim">Sen: {fmt(inv.cr)} kupa · ilk 60'ta değilsin.</p>{/if}
            {#if peek}
              <div class="peek" role="presentation" onclick={() => (peek = null)}>
                <div class="pk" role="presentation" onclick={(e) => e.stopPropagation()}>
                  <b>{peek.name}{#if peek.bot}<em>BOT</em>{/if}</b><span class="mono">{fmt(peek.cr)} kupa · en iyi {fmt(peek.best ?? peek.cr)} · Kral Sv {peek.lv}</span>
                  <div class="pd">{#each peek.deck as id, i}<CardTile {id} lv={peek.dl[i] ?? 1} small delay={i * 40} />{/each}</div>
                </div>
              </div>
            {/if}
          </div>
        {:else if scr === 'friends'}
          <div class="friends">
            <section>
              <h3>ARKADAŞLAR · {fr.f.length}</h3>
              {#each fr.f as id (id)}{@const p = pmap[id]}
                <div class="fr"><span class="klv sm">{p?.lv ?? 1}</span><span class="pn">{p?.name ?? 'Oyuncu'}</span><span class="mono dim"><Trophy size={12} /> {fmt(p?.cr ?? 0)}</span>
                  <button class="duel" onclick={() => challenge(id)} disabled={!!waitDuel} type="button">DÜELLO</button><button class="x" onclick={() => removeF(id)} type="button" title="Çıkar">×</button></div>
              {:else}<p class="dim">Henüz arkadaşın yok. Sağdan oyuncu ara.</p>{/each}
              {#if fr.in.length}<h3 class="mt">İSTEKLER · {fr.in.length}</h3>
                {#each fr.in as id (id)}<div class="fr req"><span class="pn">{pmap[id]?.name ?? 'Oyuncu'}</span><button class="ok" onclick={() => acceptF(id)} type="button">Kabul</button><button class="x" onclick={() => declineF(id)} type="button">Reddet</button></div>{/each}
              {/if}
            </section>
            <section>
              <h3>OYUNCU ARA</h3>
              <input class="search" placeholder="İsim yaz…" bind:value={fq} />
              {#each found as p (p.uid)}<div class="fr"><span class="klv sm">{p.lv}</span><span class="pn">{p.name}</span><span class="mono dim"><Trophy size={12} /> {fmt(p.cr)}</span>
                {#if fr.in.includes(p.uid)}<button class="ok" onclick={() => acceptF(p.uid)} type="button">Kabul</button>{:else}<button class="ok" disabled={sent[p.uid]} onclick={() => addFriend(p)} type="button">{sent[p.uid] ? 'Gönderildi' : 'Ekle'}</button>{/if}</div>{/each}
              <p class="dim sm">Düello: kupasız dostluk maçı. Davet, karşı tarafın masaüstüne bildirim olarak düşer.</p>
            </section>
          </div>
        {/if}
      </main>
      {/key}

      <nav class="nav">
        {#each [['shop', 'Mağaza'], ['cards', 'Kartlar'], ['home', 'Savaş'], ['rank', 'Sıralama'], ['friends', 'Arkadaşlar']] as [k, l] (k)}
          <button class:on={scr === k} class:mid={k === 'home'} onclick={() => go(k as Scr)} onmouseenter={S.hover} type="button">{l}{#if k === 'friends' && fr.in.length + invites.length}<em>{fr.in.length + invites.length}</em>{/if}{#if k === 'cards' && Object.keys(inv.cards).some((id) => canUpgrade(inv, id))}<em class="g">▲</em>{/if}</button>
        {/each}
      </nav>
    </div>
  {:else if scr === 'seek'}
    <div class="seek">
      <div class="radar"><i></i><i></i><i></i></div>
      <b>RAKİP ARANIYOR</b><span class="mono">{seekT} sn · {fmt(inv.cr)} kupa · {theme.name}</span>
      <small class="mono dim">{seekT < SEEK_BOT_AFTER ? 'Gerçek oyuncu aranıyor…' : 'Sıralamadan bir bot eşleşiyor…'}</small>
      {#if seekErr}<p class="err">{seekErr}</p>{/if}
      <button class="btn" onclick={() => stopSeek()} type="button">Vazgeç</button>
    </div>
  {:else if scr === 'vs'}
    <div class="vs" style={`background-image:url(${IMG}${mTheme.ground}.webp)`}>
      <div class="vsl"><b>{NAME}</b><span><Trophy size={16} /> {fmt(inv.cr)} · Sv {kLv}</span></div>
      <div class="vsm">VS<small>{mTheme.name}{mode === 'friendly' ? ' · dostluk' : mode === 'practice' ? ' · antrenman' : ''}</small></div>
      <div class="vsr"><b>{foe.name}{#if foe.bot && mode !== 'practice'}<em>BOT</em>{/if}</b><span><Trophy size={16} /> {fmt(foe.cr)} · Sv {foe.lv}</span></div>
    </div>
  {:else if scr === 'match' || scr === 'end'}
    <div class="match">
      <div class="side">
        <div class="mi"><b>{NAME}</b><span class="cr">{#each [0, 1, 2] as i}<i class:on={i < ui.crowns[0]!}>♛</i>{/each}</span></div>
        <div class="hand">
          {#each ui.hand as id, i (id + i)}{@const c = CARD[id]!}
            <button class={'hc r-' + c.rarity} class:pick={pick === i} class:poor={c.cost > ui.elix} onpointerdown={(e) => cardDown(i, e)} type="button">
              <img src={`${IMG}card_${id}.webp`} alt="" draggable="false" /><b class="cost">{c.cost}</b><span>{c.name}</span><em class="k mono">{i + 1}</em>
              {#if evoTier(myLv()[id] ?? 1)}<i class="evg"></i>{/if}
            </button>
          {/each}
        </div>
        <div class="nx mono">SIRADAKİ {#if ui.next}<img src={`${IMG}card_${ui.next}.webp`} alt="" />{/if}</div>
        <div class="elix"><div class="ebar">{#each Array(10) as _, i}<i class:f={i < Math.floor(ui.elix)} style={i === Math.floor(ui.elix) ? `--p:${(ui.elix % 1) * 100}%` : ''} class:p={i === Math.floor(ui.elix)}></i>{/each}</div><b>{Math.floor(ui.elix)}</b>{#if ui.rate > 1}<em>{ui.rate}×</em>{/if}</div>
        <div class="emo">
          <button class="eb" onclick={() => { emoOpen = !emoOpen; S.click(); }} type="button" title="Emoji (E)"><img src={`${IMG}emo_laugh.webp`} alt="" /></button>
          {#if emoOpen}<div class="ep">{#each EMOTES as e, i}<button onclick={() => sendEmote(e)} title={EMOTE_TR[e]} style={`--d:${i * 25}ms`} type="button"><img src={`${IMG}emo_${e}.webp`} alt={EMOTE_TR[e]} /></button>{/each}</div>{/if}
          <button class="quit" onclick={quitMatch} type="button">Çık</button>
        </div>
      </div>
      <div class="arena-box" bind:this={arenaBox} onpointerdown={arenaClick} role="presentation">
        <canvas bind:this={canvas}></canvas>
        <div class="hud">
          <div class="tm" class:ot={ui.ot} class:low={ui.time <= 30}><b>{mmss(ui.time)}</b>{#if ui.ot}<small>UZATMA</small>{:else if ui.rate > 1}<small>{ui.rate}× İKSİR</small>{/if}</div>
          <div class="fo"><span class="cr">{#each [0, 1, 2] as i}<i class:on={i < ui.crowns[1]!}>♛</i>{/each}</span><b>{foe.name}{#if foe.bot && mode !== 'practice'}<em>BOT</em>{/if}</b></div>
        </div>
        {#if ui.count}<div class="count">{ui.count}</div>{/if}
      </div>
    </div>
    {#if scr === 'end' && end}<MatchEnd info={end.info} st={end.st} me={end.me} deck={end.deck} onclose={toHome} />{/if}
  {/if}

  {#if opening}<ChestOpen chest={opening.chest} bit={opening.bit} drops={opening.drops} onclose={() => (opening = null)} />{/if}
  {#if upFx}{@const c = CARD[upFx.id]!}
    <div class="upfx" class:evo={upFx.evo > 0} role="presentation" onclick={() => (upFx = null)}>
      <div class="ucard"><img src={`${IMG}card_${upFx.id}.webp`} alt="" /><div class="sweep"></div></div>
      <div class="ut"><b>{c.name}</b><span class="lv"><s>{upFx.lv - 1}</s> → <em>{upFx.lv}</em></span>
        {#if upFx.evo}<div class="et">EVRİM {upFx.evo === 2 ? 'II' : 'I'} AÇILDI</div><p>{c.evoTxt?.[upFx.evo - 1] ?? ''}</p>{/if}</div>
    </div>
  {/if}
  {#if waitDuel}
    <div class="wait"><div class="radar sm"><i></i><i></i></div><b>{waitDuel.to} bekleniyor</b><small class="mono">Davet masaüstüne bildirim olarak gitti · {Math.max(0, 120 - Math.floor((clock - waitDuel.t) / 1000))} sn</small><button class="btn" onclick={() => { stopWait(); S.unpick(); }} type="button">İptal</button></div>
  {/if}
  {#if invites.length && scr !== 'match' && scr !== 'vs' && scr !== 'end' && scr !== 'intro'}
    <div class="invs">{#each invites as d (d.id)}<div class="inv"><b>{d.fromName}</b><span>seni düelloya davet etti</span><button class="ok" onclick={() => acceptInvite(d)} type="button">Kabul</button><button class="x" onclick={() => declineInvite(d)} type="button">Reddet</button></div>{/each}</div>
  {/if}
  {#if note}<div class="note">{note}</div>{/if}
</div>

<style>
  .cl{position:absolute;inset:0;overflow:hidden;color:#dfeaf2;font-family:var(--f-body,system-ui);user-select:none;background:#05060b}
  .mono{font-family:var(--f-mono,'JetBrains Mono',monospace)}
  .dim{color:#7d97a8}.err{color:#ff7b96}
  .bgk{position:absolute;inset:-4%;background-size:cover;background-position:center;animation:kb 30s ease-in-out infinite alternate;transition:filter .8s}
  .bgk.dim{filter:blur(14px) brightness(.32) saturate(1.3)}
  @keyframes kb{to{transform:scale(1.08) translate(-1%,1%)}}
  .scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.02) 0 1px,transparent 1px 3px);mix-blend-mode:overlay;z-index:1}
  button{font:inherit;color:inherit}
  .btn{padding:9px 18px;border-radius:8px;background:rgba(8,14,22,.8);border:1px solid rgba(0,229,255,.35);color:#dff;cursor:pointer}
  .btn:hover{background:rgba(0,229,255,.15)}
  /* giriş */
  .intro{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:26px;background:radial-gradient(ellipse at center,rgba(0,0,0,.15),rgba(0,0,0,.78));border:0;cursor:pointer;z-index:2}
  .press{font-size:13px;letter-spacing:.4em;color:#fcee0a;opacity:0}.press.on{opacity:1;animation:bl 1.2s ease-in-out infinite}
  @keyframes bl{50%{opacity:.25}}
  /* kabuk */
  .shell{position:absolute;inset:46px 0 0 0;z-index:2;display:grid;grid-template-rows:64px 1fr 66px}
  .top{display:flex;align-items:center;gap:14px;padding:0 22px;background:linear-gradient(180deg,rgba(3,6,12,.92),rgba(3,6,12,.55));border-bottom:1px solid rgba(255,255,255,.07);animation:tdown .45s cubic-bezier(.2,1.2,.3,1) both}
  @keyframes tdown{from{transform:translateY(-100%)}}
  .top .me{display:flex;align-items:center;gap:10px;margin-right:auto}
  .top .me b{display:block;font:800 16px var(--f-disp,sans-serif);letter-spacing:.04em}.top .me small{color:#8aa3b3;font-size:11.5px}
  .klv{width:38px;height:38px;display:grid;place-items:center;font:900 17px var(--f-disp,sans-serif);color:#04131a;background:linear-gradient(180deg,#7ff6ff,#13b7d6);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
  .klv.sm{width:26px;height:26px;font-size:12px;flex:none}
  .pill{display:flex;align-items:center;gap:7px;padding:5px 12px 5px 6px;border-radius:20px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.12);font-size:15px}
  .pill img{width:26px;height:26px;object-fit:contain}.pill b{font-family:var(--f-mono,monospace)}.pill small{font-size:9.5px;letter-spacing:.2em;color:#8aa3b3}
  .pill.tro{padding-left:10px}.pill.tro b{color:#ffd257}
  .pill.q{cursor:pointer;border-color:rgba(176,107,255,.5)}.pill.q i{font-style:normal;margin-left:2px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:#7ddc3a;color:#04220a;font-weight:900}
  .pill.q:hover{background:rgba(176,107,255,.2)}
  .vol{display:flex;align-items:center;gap:8px;font-size:9.5px;letter-spacing:.2em;color:#7d97a8}.vol input{accent-color:var(--acc);width:90px}
  .page{position:relative;min-height:0;overflow:hidden;animation:pin .4s cubic-bezier(.2,1,.3,1) both}
  @keyframes pin{from{opacity:0;transform:translateY(18px) scale(.985)}}
  .nav{display:grid;grid-template-columns:1fr 1fr 1.3fr 1fr 1fr;background:linear-gradient(0deg,rgba(3,6,12,.96),rgba(3,6,12,.7));border-top:1px solid rgba(255,255,255,.08);animation:bup .45s cubic-bezier(.2,1.2,.3,1) both}
  @keyframes bup{from{transform:translateY(100%)}}
  .nav button{position:relative;background:none;border:0;border-right:1px solid rgba(255,255,255,.05);font:800 14px var(--f-disp,sans-serif);letter-spacing:.14em;text-transform:uppercase;color:#8aa3b3;cursor:pointer;transition:all .15s}
  .nav button:hover{color:#fff;background:rgba(255,255,255,.04)}
  .nav button.on{color:#fff;background:linear-gradient(0deg,color-mix(in srgb,var(--acc) 30%,transparent),transparent);box-shadow:inset 0 3px 0 var(--acc)}
  .nav button.mid{font-size:17px}
  .nav em{position:absolute;top:8px;right:18%;min-width:18px;height:18px;border-radius:9px;background:#ff2a55;color:#fff;font:800 11px/18px var(--f-mono,monospace);font-style:normal;padding:0 4px}
  .nav em.g{background:#2fae4a}
  /* ana sayfa */
  .home{position:absolute;inset:14px 22px;display:grid;grid-template-rows:1fr auto;gap:14px}
  .hero{position:relative;border-radius:16px;overflow:hidden;background-size:cover;background-position:center;border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 50px rgba(0,0,0,.5);display:grid;grid-template-columns:1fr minmax(300px,420px);grid-template-rows:auto 1fr auto;padding:22px 28px;animation:hz 24s ease-in-out infinite alternate}
  @keyframes hz{to{background-position:60% 40%}}
  .hshade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(2,4,10,.82),rgba(2,4,10,.25) 60%,rgba(2,4,10,.6))}
  .hl{position:relative;grid-column:1;justify-self:start;margin-left:-20px;animation:pin .6s .1s both}
  .arena{position:relative;grid-column:1;align-self:end;max-width:520px;animation:pin .6s .2s both}
  .arena small{letter-spacing:.3em;color:var(--acc);font-size:11px}.arena b{display:block;font:900 40px var(--f-disp,sans-serif);letter-spacing:.04em;text-shadow:0 0 20px color-mix(in srgb,var(--acc) 60%,transparent)}
  .arena p{color:#c7d6e0;margin:4px 0 12px;font-size:14px}
  .prog{position:relative;height:22px;border-radius:11px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.15);overflow:hidden;max-width:420px}
  .prog i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#b8770d,#ffd257);transition:width .8s}
  .prog span{position:relative;display:block;text-align:center;font:700 11.5px/22px var(--f-mono,monospace);text-shadow:0 1px 2px #000}
  .cta{position:relative;grid-column:2;grid-row:1/4;align-self:center;display:grid;gap:12px;animation:pin .6s .25s both}
  .battle{padding:26px 20px;border:0;border-radius:16px;cursor:pointer;background:linear-gradient(180deg,#ffe27a,#f2a400 60%,#b86e00);box-shadow:0 8px 0 #7a4600,0 18px 40px rgba(242,164,0,.35);color:#2b1500;display:grid;gap:4px;transition:transform .12s;animation:breath 2.4s ease-in-out infinite}
  @keyframes breath{50%{box-shadow:0 8px 0 #7a4600,0 18px 60px rgba(255,200,40,.6)}}
  .battle:hover{transform:translateY(-3px) scale(1.02)}.battle:active{transform:translateY(5px);box-shadow:0 3px 0 #7a4600}
  .battle b{font:900 44px var(--f-disp,sans-serif);letter-spacing:.2em}.battle small{font-weight:700;font-size:12.5px;opacity:.8}
  .train{padding:12px;border-radius:12px;border:1px solid rgba(0,229,255,.4);background:rgba(4,12,20,.75);cursor:pointer;font:800 15px var(--f-disp,sans-serif);letter-spacing:.12em}
  .train small{font:600 11px var(--f-mono,monospace);color:#8aa3b3;letter-spacing:.1em;margin-left:6px}
  .train:hover{background:rgba(0,229,255,.16)}
  .wl{position:relative;grid-column:1;display:flex;gap:14px;margin-top:10px;font-size:13px;color:#cfe0ea;text-shadow:0 1px 3px #000}.wl .hot{color:#ffb347}
  .slots{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;height:150px}
  .slot{position:relative;border-radius:14px;background:linear-gradient(180deg,rgba(14,22,34,.92),rgba(6,10,18,.92));border:1px solid rgba(255,255,255,.12);display:grid;grid-template-rows:1fr auto auto;justify-items:center;padding:8px;cursor:pointer;animation:sin .5s cubic-bezier(.2,1.3,.4,1) var(--d) both;transition:transform .15s}
  @keyframes sin{from{opacity:0;transform:translateY(30px)}}
  .slot:hover{transform:translateY(-4px)}
  .slot img{height:82px;width:auto;object-fit:contain;filter:drop-shadow(0 6px 10px rgba(0,0,0,.6))}
  .slot b{font:800 13px var(--f-disp,sans-serif)}.slot small{font:700 11px var(--f-mono,monospace);color:#9fb6c6}
  .slot.ul{border-color:rgba(0,229,255,.5)}.slot.ul small{color:#7ff6ff}
  .slot.rdy{border-color:#ffd257;box-shadow:0 0 24px rgba(255,210,87,.35)}.slot.rdy img{animation:wob 1s ease-in-out infinite}.slot.rdy small{color:#ffd257;font-size:13px}
  @keyframes wob{25%{transform:rotate(-5deg) scale(1.05)}75%{transform:rotate(5deg) scale(1.05)}}
  .slot .skip{position:absolute;top:6px;right:8px;display:flex;align-items:center;gap:3px;font:700 11px var(--f-mono,monospace);font-style:normal;color:#d7b8ff}.slot .skip img{height:16px}
  .slot.empty{cursor:default;border-style:dashed;align-content:center;color:#5d7383;grid-template-rows:auto auto}.slot.empty span{font-weight:700}
  /* kartlar */
  .cards{position:absolute;inset:12px 22px;display:grid;grid-template-columns:1fr 380px;gap:20px}
  .cl-left{min-height:0;overflow:auto;padding-right:6px}
  .h{font-size:11px;letter-spacing:.3em;color:var(--acc);margin:4px 0 10px}
  .swap{font-style:normal;color:#fcee0a;letter-spacing:.05em;margin-left:10px}.swap button{background:none;border:0;color:#ff7b96;cursor:pointer;text-decoration:underline}
  .deck8{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px;margin-bottom:18px;padding:12px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08)}
  .deck8.swapping{border-color:#fcee0a;animation:sw 1s ease-in-out infinite}
  @keyframes sw{50%{box-shadow:0 0 22px rgba(252,238,10,.35)}}
  .coll{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px}
  .det{min-height:0;overflow:auto;background:rgba(6,10,18,.82);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:16px;display:grid;gap:10px;align-content:start;animation:pin .4s both}
  .det .big{position:relative;width:170px;height:227px;flex:none;justify-self:center;border-radius:12px;overflow:hidden;border:3px solid var(--rc);box-shadow:0 0 30px color-mix(in srgb,var(--rc) 50%,transparent);animation:bigin .45s cubic-bezier(.2,1.4,.4,1) both}
  @keyframes bigin{from{transform:rotateY(70deg) scale(.8);opacity:0}}
  .det .big img{width:100%;height:100%;object-fit:cover}
  .r-common{--rc:#6f8aa3}.r-rare{--rc:#ff9b2f}.r-epic{--rc:#c060ff}.r-legendary{--rc:#5ff2d6}
  .evb{position:absolute;top:6px;right:6px;font:900 10px var(--f-mono,monospace);padding:2px 6px;border-radius:4px;background:#6a26b0}.evb.e2{background:linear-gradient(90deg,#b07900,#ffd257);color:#1a0d00}
  .dt b{display:block;font:900 22px var(--f-disp,sans-serif);text-align:center}.dt span{display:block;text-align:center;font-size:11.5px;color:#9fb6c6}
  .desc{margin:0;color:#c7d6e0;font-size:13px;line-height:1.5}
  .lvrow{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#9fb6c6}.lvb{font:800 14px var(--f-disp,sans-serif);color:#7ff6ff}
  .statg{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .statg div{background:rgba(255,255,255,.04);border-radius:8px;padding:6px 9px;display:grid;grid-template-columns:1fr auto;align-items:baseline}
  .statg i{font-style:normal;font-size:10.5px;color:#8aa3b3;grid-column:1/3}.statg b{font:700 15px var(--f-mono,monospace)}.statg em{font-style:normal;color:#7dff7a;font:700 11px var(--f-mono,monospace)}
  .evos{display:grid;gap:6px}.evos div{padding:7px 10px;border-radius:8px;border:1px dashed rgba(166,92,255,.4);color:#8a7aa3;font-size:12px;display:grid}
  .evos div b{font:800 11px var(--f-mono,monospace);letter-spacing:.1em}
  .evos div.on{border-style:solid;border-color:#a65cff;background:rgba(166,92,255,.12);color:#e8d8ff}
  .acts{display:flex;gap:8px}
  .upb{flex:1;display:grid;padding:10px;border:0;border-radius:10px;cursor:pointer;background:linear-gradient(180deg,#8dff7a,#25a83a);color:#042a08;box-shadow:0 5px 0 #136a20}
  .upb b{font:900 17px var(--f-disp,sans-serif);letter-spacing:.15em}.upb small{font-weight:700;font-size:11.5px}
  .upb:disabled{filter:grayscale(1) brightness(.55);cursor:not-allowed}
  .upb:not(:disabled){animation:glow 1.6s ease-in-out infinite}
  @keyframes glow{50%{box-shadow:0 5px 0 #136a20,0 0 22px rgba(125,255,122,.5)}}
  .use{padding:10px 14px;border-radius:10px;border:1px solid #fcee0a;background:rgba(252,238,10,.08);color:#fcee0a;cursor:pointer;font-weight:800}
  .ctr{font-size:11px;color:#8aa3b3}.lockd{color:#8aa3b3;text-align:center;padding:20px}
  /* mağaza */
  .shop{position:absolute;inset:12px 22px;overflow:auto;display:grid;gap:18px;align-content:start;padding-bottom:20px}
  .shop h3,.rank h3,.friends h3{margin:0 0 10px;font:900 18px var(--f-disp,sans-serif);letter-spacing:.14em}
  .shop h3 small,.rank h3 small{font:600 11.5px var(--f-mono,monospace);letter-spacing:.05em;color:#8aa3b3;margin-left:10px}
  .row3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .offer{position:relative;display:grid;justify-items:center;gap:6px;padding:16px 14px 14px;border-radius:14px;background:linear-gradient(180deg,rgba(20,28,44,.95),rgba(8,12,22,.95));border:1px solid rgba(255,255,255,.12);cursor:pointer;animation:sin .5s cubic-bezier(.2,1.3,.4,1) var(--d) both;transition:transform .15s,box-shadow .15s}
  .offer:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,0,0,.5)}
  .offer.q{border-color:rgba(176,107,255,.45);background:linear-gradient(180deg,rgba(50,20,80,.9),rgba(12,8,24,.95))}
  .offer img{height:64px;object-fit:contain}.offer img.x2{height:78px}.offer img.x3{height:92px;filter:drop-shadow(0 0 14px #b06bff)}
  .offer .cimg{height:110px}
  .offer b{font:900 20px var(--f-disp,sans-serif)}.offer small{color:#9fb6c6;font-size:12px;text-align:center}
  .offer .price{display:flex;align-items:center;gap:5px;margin-top:4px;padding:7px 18px;border-radius:9px;background:linear-gradient(180deg,#7ddc3a,#3c9a14);color:#06210a;font:900 15px var(--f-mono,monospace)}
  .offer .price img{height:18px}
  .offer.q .price{background:linear-gradient(180deg,#ffd257,#d99a1e);color:#2b1600}
  .offer .tag{position:absolute;top:8px;right:8px;font-style:normal;background:#ff2a55;color:#fff;font:800 11px var(--f-mono,monospace);padding:2px 6px;border-radius:4px}
  .offer.info{cursor:default;align-content:center}.offer.info:hover{transform:none}
  .odds{display:flex;flex-wrap:wrap;gap:4px 8px;justify-content:center;font-size:10.5px}
  .o-common{color:#9fb6c6}.o-rare{color:#ff9b2f}.o-epic{color:#c060ff}.o-legendary{color:#5ff2d6}
  .offer:disabled{opacity:.6;cursor:wait}
  /* sıralama */
  .rank{position:absolute;inset:12px 22px;display:grid;grid-template-rows:auto 1fr auto;min-height:0}
  .rh{display:flex;align-items:center;justify-content:space-between}
  .list{overflow:auto;display:grid;gap:5px;align-content:start;padding-right:6px}
  .lr{display:grid;grid-template-columns:44px 30px 1fr 150px 90px 110px;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(8,14,24,.78);border:1px solid rgba(255,255,255,.06);cursor:pointer;text-align:left;animation:rin .35s var(--d) both}
  @keyframes rin{from{opacity:0;transform:translateX(-24px)}}
  .lr:hover{background:rgba(0,229,255,.08)}
  .lr.mine{border-color:#fcee0a;background:rgba(252,238,10,.08)}
  .pos{font:900 18px var(--f-disp,sans-serif);color:#8aa3b3;text-align:center}.pos.p1{color:#ffd257}.pos.p2{color:#d6e2ea}.pos.p3{color:#e0904a}
  .pn{font-weight:800}.pn em{font:800 9px var(--f-mono,monospace);background:#33475a;padding:2px 5px;border-radius:3px;margin-left:8px;font-style:normal;vertical-align:middle}.pn em.you{background:#fcee0a;color:#111}
  .lr .ar{font-size:11px;color:#8aa3b3}.lr .lwl{font-size:11px;color:#8aa3b3}.lr b{text-align:right;font-family:var(--f-mono,monospace);color:#ffd257}
  .peek{position:absolute;inset:0;background:rgba(0,0,0,.6);display:grid;place-items:center;z-index:5;animation:fd .2s both}
  @keyframes fd{from{opacity:0}}
  .pk{background:#0a111c;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:18px;display:grid;gap:8px;width:min(760px,90%);animation:pin .3s both}
  .pk b{font:900 22px var(--f-disp,sans-serif)}.pk b em{font:800 10px var(--f-mono,monospace);background:#33475a;padding:2px 6px;border-radius:3px;margin-left:8px;font-style:normal}.pk span{color:#9fb6c6;font-size:12px}
  .pd{display:grid;grid-template-columns:repeat(8,1fr);gap:8px}
  /* arkadaşlar */
  .friends{position:absolute;inset:12px 22px;display:grid;grid-template-columns:1fr 1fr;gap:22px}
  .friends section{background:rgba(6,10,18,.8);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:16px;overflow:auto;animation:pin .4s both}
  .mt{margin-top:18px !important}
  .fr{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;background:rgba(255,255,255,.04);margin-bottom:6px;animation:rin .3s both}
  .fr .pn{margin-right:auto}
  .fr .duel{padding:7px 14px;border:0;border-radius:8px;background:linear-gradient(180deg,#ffe27a,#f2a400);color:#2b1500;font:900 12px var(--f-disp,sans-serif);letter-spacing:.12em;cursor:pointer}
  .fr .duel:disabled{filter:grayscale(1);cursor:not-allowed}
  .ok{padding:6px 12px;border:0;border-radius:7px;background:#2fae4a;color:#fff;font-weight:800;cursor:pointer}.ok:disabled{background:#33475a}
  .x{padding:6px 10px;border:1px solid rgba(255,123,150,.5);border-radius:7px;background:none;color:#ff7b96;cursor:pointer}
  .search{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:9px;background:rgba(0,0,0,.5);border:1px solid rgba(0,229,255,.35);color:#fff;margin-bottom:10px;font-size:14px}
  .sm{font-size:12px}
  /* arama / vs */
  .seek{position:absolute;inset:0;z-index:2;display:grid;place-content:center;justify-items:center;gap:10px;animation:fd .3s both}
  .seek b{font:900 30px var(--f-disp,sans-serif);letter-spacing:.25em}
  .radar{position:relative;width:180px;height:180px;margin-bottom:16px}
  .radar i{position:absolute;inset:0;border-radius:50%;border:2px solid var(--acc);animation:rad 2.4s ease-out infinite;opacity:0}
  .radar i:nth-child(2){animation-delay:.8s}.radar i:nth-child(3){animation-delay:1.6s}
  .radar.sm{width:80px;height:80px;margin:0}
  @keyframes rad{from{transform:scale(.1);opacity:1}to{transform:scale(1);opacity:0}}
  .vs{position:absolute;inset:46px 0 0 0;z-index:2;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;background-size:cover;background-position:center;overflow:hidden}
  .vs::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,40,70,.88),rgba(0,0,0,.5) 50%,rgba(70,0,20,.88))}
  .vsl,.vsr,.vsm{position:relative;display:grid;gap:8px;padding:0 5vw}
  .vsl{justify-items:end;animation:vl .55s cubic-bezier(.2,1.3,.3,1) both}.vsr{justify-items:start;animation:vr .55s cubic-bezier(.2,1.3,.3,1) both}
  @keyframes vl{from{transform:translateX(-60vw)}}@keyframes vr{from{transform:translateX(60vw)}}
  .vsl b,.vsr b{font:900 clamp(28px,4vw,56px) var(--f-disp,sans-serif)}.vsl b{color:#7ff6ff;text-shadow:0 0 20px #00e5ff}.vsr b{color:#ffc2d0;text-shadow:0 0 20px #ff2a55}
  .vsr b em{font:800 12px var(--f-mono,monospace);background:#33475a;color:#cfe;padding:3px 7px;border-radius:4px;margin-left:10px;font-style:normal;vertical-align:middle}
  .vsl span,.vsr span{font:700 15px var(--f-mono,monospace);color:#e0e8ee}
  .vsm{justify-items:center;font:900 92px var(--f-disp,sans-serif);color:#fcee0a;text-shadow:0 0 30px #fcee0a;animation:vm .5s .5s cubic-bezier(.2,1.8,.4,1) both}
  .vsm small{font:700 13px var(--f-mono,monospace);letter-spacing:.3em;color:#fff;text-shadow:none}
  @keyframes vm{from{transform:scale(4);opacity:0}}
  /* maç */
  .match{position:absolute;inset:46px 0 0 0;z-index:2;display:grid;grid-template-columns:178px 1fr;animation:fd .4s both}
  .side{display:grid;grid-template-rows:auto 1fr auto auto auto;gap:8px;padding:10px;background:linear-gradient(90deg,rgba(2,6,12,.96),rgba(2,6,12,.82));border-right:1px solid rgba(0,229,255,.2);min-height:0}
  .mi b{display:block;font:800 14px var(--f-disp,sans-serif);color:#7ff6ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cr i{font-style:normal;font-size:20px;color:#26313d;margin-right:2px}.cr i.on{color:#3ff0ff;text-shadow:0 0 10px #3ff0ff;animation:cpop .4s cubic-bezier(.2,1.8,.4,1)}
  @keyframes cpop{from{transform:scale(2.4)}}
  .hand{display:grid;grid-template-rows:repeat(4,1fr);gap:8px;min-height:0}
  .hc{position:relative;border-radius:10px;overflow:hidden;border:2px solid var(--rc);padding:0;cursor:grab;background:#0b0f16;min-height:0;transition:transform .12s,filter .2s;animation:hin .3s cubic-bezier(.2,1.4,.4,1) both;touch-action:none}
  @keyframes hin{from{transform:translateX(-60px);opacity:0}}
  .hc img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 30%;pointer-events:none}
  .hc::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(0,0,0,.85));pointer-events:none}
  .hc span{position:absolute;left:6px;bottom:4px;z-index:2;font:800 11.5px var(--f-disp,sans-serif);text-shadow:0 1px 2px #000}
  .hc .cost{position:absolute;top:4px;left:4px;z-index:2;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#ff9df3,#b0129a 60%,#4a003f);border:2px solid #ffd0f6;font:900 14px var(--f-disp,sans-serif)}
  .hc .k{position:absolute;top:5px;right:6px;z-index:2;font-size:10px;font-style:normal;color:rgba(255,255,255,.6)}
  .hc .evg{position:absolute;inset:0;z-index:1;box-shadow:inset 0 0 18px rgba(166,92,255,.8);pointer-events:none}
  .hc.pick{transform:translateX(10px) scale(1.04);outline:3px solid #fcee0a;outline-offset:-1px;box-shadow:0 0 22px rgba(252,238,10,.5)}
  .hc.poor{filter:grayscale(.85) brightness(.55)}
  .nx{display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:.2em;color:#7d97a8}.nx img{width:34px;height:45px;object-fit:cover;border-radius:5px;border:1px solid rgba(255,255,255,.2)}
  .elix{display:flex;align-items:center;gap:6px}
  .ebar{flex:1;display:grid;grid-template-columns:repeat(10,1fr);gap:2px;height:22px;padding:2px;border-radius:6px;background:rgba(0,0,0,.6);border:1px solid rgba(255,80,220,.35)}
  .ebar i{border-radius:2px;background:rgba(255,255,255,.06)}
  .ebar i.f{background:linear-gradient(180deg,#ff9df3,#c014a8);box-shadow:0 0 6px rgba(255,80,220,.6)}
  .ebar i.p{background:linear-gradient(0deg,#c014a8 var(--p),rgba(255,255,255,.06) var(--p))}
  .elix b{font:900 20px var(--f-disp,sans-serif);color:#ff9df3;width:24px;text-align:center}.elix em{font:800 11px var(--f-mono,monospace);color:#fcee0a;font-style:normal}
  .emo{position:relative;display:flex;gap:8px;align-items:center}
  .eb{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.5);cursor:pointer;padding:4px}.eb img{width:100%;height:100%;object-fit:contain}
  .ep{position:absolute;bottom:52px;left:0;z-index:10;display:grid;grid-template-columns:repeat(4,52px);gap:6px;padding:8px;border-radius:12px;background:rgba(4,8,16,.95);border:1px solid rgba(255,255,255,.15);animation:pin .25s both}
  .ep button{width:52px;height:52px;border:0;background:rgba(255,255,255,.05);border-radius:10px;cursor:pointer;padding:4px;animation:sin .3s var(--d) both}.ep button:hover{background:rgba(255,255,255,.15);transform:scale(1.1)}
  .ep img{width:100%;height:100%;object-fit:contain}
  .quit{margin-left:auto;padding:7px 12px;border-radius:8px;border:1px solid rgba(255,123,150,.4);background:none;color:#ff9fb2;cursor:pointer;font-size:12px}
  .arena-box{position:relative;min-width:0;min-height:0;overflow:hidden;touch-action:none}
  .arena-box canvas{position:absolute;inset:0;width:100%;height:100%}
  .hud{position:absolute;inset:8px 14px auto;display:flex;justify-content:center;pointer-events:none}
  .tm{display:grid;justify-items:center;padding:4px 18px;border-radius:10px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.15)}
  .tm b{font:900 24px var(--f-mono,monospace)}.tm small{font:800 10px var(--f-mono,monospace);letter-spacing:.2em;color:#fcee0a}
  .tm.low b{color:#ff7b96}.tm.ot{border-color:#ff2a55;animation:otp 1s ease-in-out infinite}
  @keyframes otp{50%{box-shadow:0 0 18px rgba(255,42,85,.6)}}
  .fo{position:absolute;right:0;top:0;display:grid;justify-items:end;padding:4px 10px;border-radius:10px;background:rgba(0,0,0,.55)}
  .fo b{font:800 14px var(--f-disp,sans-serif);color:#ffc2d0}.fo b em{font:800 9px var(--f-mono,monospace);background:#33475a;padding:2px 5px;border-radius:3px;margin-left:6px;font-style:normal;color:#cfe}
  .fo .cr i.on{color:#ff3b6b;text-shadow:0 0 10px #ff3b6b}
  .count{position:absolute;inset:0;display:grid;place-items:center;font:900 160px var(--f-disp,sans-serif);color:#fff;text-shadow:0 0 40px var(--acc);pointer-events:none;animation:cnt 1s ease-out infinite}
  @keyframes cnt{from{transform:scale(1.6);opacity:0}30%{opacity:1;transform:scale(1)}to{opacity:.2}}
  /* yükseltme */
  .upfx{position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;gap:40px;background:radial-gradient(circle,rgba(30,80,40,.6),rgba(0,0,0,.9));animation:fd .25s both}
  .upfx.evo{background:radial-gradient(circle,rgba(90,30,140,.75),rgba(0,0,0,.93))}
  .ucard{position:relative;width:min(30vmin,260px);aspect-ratio:3/4;border-radius:14px;overflow:hidden;border:3px solid #7dff7a;box-shadow:0 0 50px rgba(125,255,122,.6);animation:uc .7s cubic-bezier(.2,1.6,.4,1) both}
  .evo .ucard{border-color:#c48bff;box-shadow:0 0 70px rgba(180,110,255,.8);animation:uc .7s cubic-bezier(.2,1.6,.4,1) both,ev 1.4s .7s ease-in-out infinite}
  @keyframes uc{from{transform:scale(.4) rotate(-12deg);opacity:0}}
  @keyframes ev{50%{filter:brightness(1.4) saturate(1.4)}}
  .ucard img{width:100%;height:100%;object-fit:cover}
  .sweep{position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.7) 50%,transparent 65%);background-size:300% 100%;animation:swp 1.1s .3s ease-out both}
  @keyframes swp{from{background-position:150% 0}to{background-position:-60% 0}}
  .ut{display:grid;gap:10px}.ut b{font:900 40px var(--f-disp,sans-serif)}
  .ut .lv{font:900 64px var(--f-disp,sans-serif);color:#fff}.ut .lv s{color:#7d97a8;text-decoration:none;font-size:40px}.ut .lv em{font-style:normal;color:#7dff7a;display:inline-block;animation:lvp .6s .4s cubic-bezier(.2,1.8,.4,1) both;text-shadow:0 0 24px rgba(125,255,122,.7)}
  @keyframes lvp{from{transform:scale(3);opacity:0}}
  .et{font:900 30px var(--f-disp,sans-serif);letter-spacing:.12em;background:linear-gradient(90deg,#c48bff,#ffd257);-webkit-background-clip:text;background-clip:text;color:transparent;animation:lvp .7s 1s cubic-bezier(.2,1.8,.4,1) both}
  .ut p{margin:0;color:#e8d8ff;max-width:340px}
  /* düello bekleme / davet / not */
  .wait{position:absolute;inset:0;z-index:65;display:grid;place-content:center;justify-items:center;gap:10px;background:rgba(0,0,0,.78);animation:fd .25s both}
  .wait b{font:900 24px var(--f-disp,sans-serif)}
  .invs{position:absolute;top:74px;right:22px;z-index:66;display:grid;gap:8px}
  .inv{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;background:rgba(10,16,28,.96);border:1px solid #fcee0a;box-shadow:0 10px 30px rgba(0,0,0,.6);animation:tin .4s cubic-bezier(.2,1.3,.4,1) both}
  @keyframes tin{from{transform:translateX(120%)}}
  .inv b{color:#fcee0a}
  .note{position:absolute;bottom:84px;left:50%;transform:translateX(-50%);z-index:80;padding:10px 18px;border-radius:10px;background:rgba(6,10,18,.96);border:1px solid var(--acc);font-size:13.5px;animation:nup .3s both;max-width:70%}
  @keyframes nup{from{opacity:0;transform:translate(-50%,16px)}}
</style>
