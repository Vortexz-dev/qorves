<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { wm, coreBack } from '../desktop/wm.svelte';
  import { ask } from '../lib/confirm.svelte';
  import { CARDS, CARD, avgCost, validDeck, type Card } from './clash/cards';
  import { init, step, hand, nextCard, timeLeft, elixRate, canDeploy, clone, hash, HZ, type State, type Cmd, type Side, type Fx } from './clash/engine';
  import { makeBot } from './clash/bot';
  import { loadProfile, saveProfile, seek, channel, type Profile, type Match } from './clash/net';
  import { Renderer, preload } from './clash/render';
  import { S, music } from './clash/audio';

  const u = session.user!;
  const NAME = u.character?.name || u.username;
  const IMG = import.meta.env.BASE_URL + 'img/clash/';
  type Scr = 'intro' | 'menu' | 'deck' | 'seek' | 'vs' | 'match' | 'result';
  let scr = $state<Scr>('intro');
  let prof = $state<Profile>({ deck: [], w: 0, l: 0, d: 0, cr: 0, name: NAME });
  let ready = $state(false);
  let introStep = $state(0);

  // ---- deste ----
  let draft = $state<string[]>([]), sel = $state<Card | null>(null), saving = $state(false), deckMsg = $state('');
  function openDeck() { draft = prof.deck.slice(); sel = CARD[draft[0]!] ?? null; scr = 'deck'; S.whoosh(); }
  function toggle(id: string) {
    sel = CARD[id]!;
    if (draft.includes(id)) { draft = draft.filter((x) => x !== id); S.click(); }
    else if (draft.length < 8) { draft = [...draft, id]; S.pick(); } else { S.deny(); deckMsg = 'Deste 8 kart. Önce birini çıkar.'; setTimeout(() => (deckMsg = ''), 1800); }
  }
  async function saveDeck() {
    if (!validDeck(draft)) { S.deny(); deckMsg = 'Deste tam 8 farklı kart olmalı.'; return; }
    saving = true; prof.deck = draft.slice();
    try { await saveProfile(u.uid, prof); deckMsg = 'Kaydedildi.'; S.stamp(); setTimeout(() => (scr = 'menu'), 500); } catch { deckMsg = 'Kaydedilemedi (bağlantı).'; S.deny(); }
    saving = false;
  }

  // ---- arama ----
  let seekT = $state(0), seekStop: (() => void) | null = null, seekTimer: ReturnType<typeof setInterval> | null = null, seekErr = $state('');
  function startSeek() {
    scr = 'seek'; seekT = 0; seekErr = ''; S.whoosh();
    seekTimer = setInterval(() => seekT++, 1000);
    seekStop = seek({ uid: u.uid, name: NAME, deck: prof.deck, cr: prof.cr }, (m, side, off) => { stopSeek(false); startPvp(m, side, off); }, (e) => { seekErr = 'Arama başarısız: ' + String((e as Error)?.message ?? e).slice(0, 80); });
  }
  function stopSeek(cancel = true) { if (seekTimer) clearInterval(seekTimer); seekTimer = null; if (seekStop && cancel) seekStop(); seekStop = null; if (cancel) scr = 'menu'; }

  // ---- maç ----
  let canvas: HTMLCanvasElement | undefined = $state(), arenaBox: HTMLDivElement | undefined = $state();
  let R: Renderer | null = null, st = $state.raw<State | null>(null), me: Side = 0, mode: 'bot' | 'pvp' = 'bot';
  let foeName = $state('BOT'), foeCr = $state(0), raf = 0, t0 = 0, off = 0, bot: ((s: State) => Cmd | null) | null = null;
  let cmds = new Map<number, Cmd[]>(), snaps: State[] = [], net: ReturnType<typeof channel> | null = null, match: Match | null = null, seq = 0;
  let pending = $state<Cmd[]>([]), pick = $state<number>(-1), drag = $state<{ card: string; x: number; y: number; ok: boolean } | null>(null), dragging = false;
  let ui = $state({ elix: 5, hand: [] as string[], next: '', time: 180, crowns: [0, 0] as number[], rate: 1, ot: false, count: 0 });
  let result = $state<{ w: number; why: string; crowns: number[]; dcr: number; desync: boolean; forfeit: boolean } | null>(null);
  const DELAY_PVP = 22, DELAY_BOT = 3;
  let lastSec = -1, lastCrowns = [0, 0], lastRate = 1, fullBeep = false;

  function addCmd(c: Cmd) { const a = cmds.get(c.t) ?? []; if (a.some((x) => x.side === c.side && x.n === c.n)) return false; a.push(c); a.sort((x, y) => x.side - y.side || x.n - y.n); cmds.set(c.t, a); return true; }
  function startBot() {
    mode = 'bot'; me = 0; foeName = 'ARENA BOTU'; foeCr = Math.max(0, prof.cr + Math.round(Math.random() * 60 - 30));
    const pool = CARDS.map((c) => c.id); const d1 = pool.sort(() => Math.random() - 0.5).slice(0, 8);
    const seed = (Math.random() * 2 ** 31) | 0;
    bot = makeBot(1, seed ^ 0x5bd1e995, 2);
    begin(seed, [prof.deck.slice(), d1], performance.now() + 4200);
  }
  function startPvp(m: Match, side: Side, o: number) {
    mode = 'pvp'; me = side; match = m; off = o; foeName = m.names[1 - side] ?? 'Rakip'; foeCr = m.cr[1 - side] ?? 0; bot = null;
    net = channel(m, side, (c) => { if (c.side === me) return; onRemote(c); }, () => { if (st && !st.over) finish(true); });
    begin(m.seed, m.decks, 0);
  }
  function begin(seed: number, decks: [string[], string[]], startAt: number) {
    cmds = new Map(); snaps = []; pending = []; seq = 0; result = null; lastCrowns = [0, 0]; lastRate = 1; lastSec = -1;
    st = init(seed, decks); snaps.push(clone(st));
    t0 = startAt; scr = 'vs'; S.whoosh(); setTimeout(() => S.stamp(), 650);
    setTimeout(() => { scr = 'match'; music.level(1); requestAnimationFrame(() => { setupCanvas(); loop(); }); }, 2600);
  }
  function now() { return mode === 'pvp' ? Date.now() + off - match!.t0 : performance.now() - t0; }
  function setupCanvas() {
    if (!canvas || !arenaBox) return;
    R = new Renderer(canvas, me); const r = arenaBox.getBoundingClientRect(); R.resize(r.width, r.height);
  }
  function onRemote(c: Cmd) {
    if (!st) return;
    if (!addCmd(c)) return;
    if (c.t < st.tick) {
      // geç geldi: komuttan önceki son anlık görüntüye sar, sessizce yeniden koş
      const target = st.tick; let base = snaps.filter((s) => s.tick <= c.t).pop() ?? snaps[0]!;
      let s = clone(base); while (s.tick < target && !s.over) step(s, cmds.get(s.tick) ?? []);
      snaps = snaps.filter((x) => x.tick <= base.tick); st = s;
    }
  }
  function sounds(fx: Fx[]) {
    for (const f of fx) {
      if (f.k === 'deploy') S.deploy(); else if (f.k === 'melee') S.melee(); else if (f.k === 'die') S.die(); else if (f.k === 'tdie') S.tower(); else if (f.k === 'crown') setTimeout(S.crown, 400);
      else if (f.k === 'boom') S.boom(0.6); else if (f.k === 'strike') S.strike(); else if (f.k === 'emp') S.emp(); else if (f.k === 'arc') S.arc();
      else if (f.k === 'cast' && f.card === 'plasma') S.strikeWarn();
      else if (f.k === 'shot') { if (f.card === 'archer') S.rail(); else if (f.card === 'drone') S.tracer(); else if (f.card === 'mech') S.plasma(); else if (f.card === 'king' || f.card === 'crown') S.bolt(f.card === 'king'); }
    }
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
    let s = st;
    while (s.tick < target && !s.over && n++ < 400) {
      if (bot) { const c = bot(s); if (c) { c.t = s.tick + DELAY_BOT; addCmd(c); } }
      const list = cmds.get(s.tick) ?? [];
      step(s, list, fx);
      if (s.tick % HZ === 0) { snaps.push(clone(s)); if (snaps.length > 40) snaps.splice(1, 1); }
    }
    pending = pending.filter((c) => c.t >= s.tick);
    R.feed(fx); sounds(fx);
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
    if (!st || st.over || now() < 0) return;
    const c = CARD[card]!;
    if (c.cost > ui.elix + 1e-9) { S.deny(); return; }
    if (pending.some((p) => p.card === card)) { S.deny(); return; }
    if (!canDeploy(st, me, card, x, y)) { S.deny(); return; }
    const cmd: Cmd = { t: st.tick + (mode === 'pvp' ? DELAY_PVP : DELAY_BOT), side: me, card, x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2, n: seq++ };
    addCmd(cmd); pending = [...pending, cmd]; pick = -1; S.pick();
    if (net) net.send(cmd).catch(() => {});
  }
  // işaretçi
  function arenaPt(e: PointerEvent) { const r = arenaBox!.getBoundingClientRect(); return R!.world(e.clientX - r.left, e.clientY - r.top); }
  function cardDown(i: number, e: PointerEvent) {
    const id = ui.hand[i]!; if (!id) return;
    pick = i; dragging = true; S.click();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (pick < 0 || !R || !st) return;
    const p = arenaPt(e); const id = ui.hand[pick]!;
    const r = arenaBox!.getBoundingClientRect(); const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    drag = inside ? { card: id, x: p.x, y: p.y, ok: canDeploy(st, me, id, p.x, p.y) && CARD[id]!.cost <= ui.elix } : (dragging ? null : drag);
  }
  function up(e: PointerEvent) {
    if (pick < 0 || !R) return;
    const r = arenaBox!.getBoundingClientRect(); const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (dragging && inside) { const p = arenaPt(e); play(ui.hand[pick]!, p.x, p.y); drag = null; }
    dragging = false;
  }
  function arenaClick(e: PointerEvent) { if (pick >= 0 && !dragging) { const p = arenaPt(e); play(ui.hand[pick]!, p.x, p.y); drag = null; } }
  function key(e: KeyboardEvent) { if (scr !== 'match') return; const k = Number(e.key); if (k >= 1 && k <= 4) { pick = pick === k - 1 ? -1 : k - 1; S.click(); } }

  async function finish(forfeit: boolean) {
    if (result || !st) return;
    cancelAnimationFrame(raf);
    const w = forfeit ? me : st.winner; const mine = w === me ? 1 : w === 2 ? 0 : -1;
    const dcr = mine > 0 ? 30 : mine < 0 ? -20 : 0;
    let desync = false;
    if (mode === 'pvp' && net && match) { await net.result(w, hash(st), st.crowns); }
    result = { w: mine, why: forfeit ? 'rakip ayrıldı' : st.reason, crowns: ui.crowns.slice(), dcr, desync, forfeit };
    prof.cr = Math.max(0, prof.cr + dcr); if (mine > 0) prof.w++; else if (mine < 0) prof.l++; else prof.d++;
    saveProfile(u.uid, prof).catch(() => {});
    music.level(0); setTimeout(() => (mine > 0 ? S.win() : mine < 0 ? S.lose() : S.crown()), 600);
    setTimeout(() => { scr = 'result'; net?.close(); net = null; }, 1800);
  }
  async function quitMatch() {
    if (scr !== 'match' || !st || st.over) { toMenu(); return; }
    if (await ask('Maçtan çık?', mode === 'pvp' ? 'Çıkarsan maçı kaybedersin.' : 'Bot maçı sonlanacak.', 'Çık', false)) {
      if (net) { net.leave(); net.close(); net = null; }
      cancelAnimationFrame(raf); prof.l++; prof.cr = Math.max(0, prof.cr - 20); saveProfile(u.uid, prof).catch(() => {}); toMenu();
    }
  }
  function toMenu() { cancelAnimationFrame(raf); st = null; R = null; scr = 'menu'; music.level(0); }

  $effect(() => { const s = scr; coreBack.go = s === 'deck' ? () => (scr = 'menu') : s === 'seek' ? () => stopSeek() : s === 'match' ? () => quitMatch() : s === 'result' ? () => toMenu() : null; });
  $effect(() => { music.pause(wm.coreMin); });
  let ro: ResizeObserver | null = null;
  $effect(() => { if (arenaBox && scr === 'match') { ro?.disconnect(); ro = new ResizeObserver(() => { if (R && arenaBox) { const r = arenaBox.getBoundingClientRect(); R.resize(r.width, r.height); } }); ro.observe(arenaBox); } });
  let mvol = $state(music.volume);

  onMount(() => {
    Promise.all([preload(), loadProfile(u.uid, NAME)]).then(([, p]) => { prof = p; ready = true; });
    S.whoosh(); music.start(0);
    const ts = [setTimeout(() => (introStep = 1), 250), setTimeout(() => { introStep = 2; S.stamp(); }, 900), setTimeout(() => (introStep = 3), 1600)];
    addEventListener('keydown', key);
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') (window as any).__clash = { get st() { return st; }, play, get ui() { return ui; }, get scr() { return scr; }, startBot, me: () => me };
    return () => { ts.forEach(clearTimeout); removeEventListener('keydown', key); };
  });
  onDestroy(() => { cancelAnimationFrame(raf); stopSeek(false); if (net && st && !st.over) net.leave(); net?.close(); music.stop(); coreBack.go = null; ro?.disconnect(); });
  const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const skip = () => { if (scr === 'intro' && ready) { S.click(); scr = 'menu'; } };
</script>

<svelte:window onpointermove={move} onpointerup={up} />

<div class="cl" class:inmatch={scr === 'match'}>
  <div class="bgk" style={`background-image:url(${IMG}key.webp)`} class:dim={scr !== 'intro'}></div>
  <div class="scan"></div>

  {#if scr === 'intro'}
    <button class="intro" onclick={skip}>
      <div class="logo" class:on={introStep >= 1}><span class="l1">SPIRE</span><span class="sl">//</span><span class="l2">CLASH</span></div>
      <div class="sub mono" class:on={introStep >= 2}>QORVES ARENA LİGİ · SEZON 01</div>
      <div class="press mono" class:on={introStep >= 3 && ready}>{ready ? 'BAŞLAMAK İÇİN TIKLA' : 'YÜKLENİYOR…'}</div>
    </button>
  {:else if scr === 'menu'}
    <div class="menu">
      <div class="mleft">
        <div class="logo sm on"><span class="l1">SPIRE</span><span class="sl">//</span><span class="l2">CLASH</span></div>
        <p class="tag">İki kule hattı, bir nehir, sekiz kart. Rakibin kulelerini düşür, kendi tacını koru.</p>
        <button class="big pri" onmouseenter={S.hover} onclick={startSeek}><b>SAVAŞ</b><small>Gerçek rakip ara</small></button>
        <button class="big" onmouseenter={S.hover} onclick={() => { S.click(); startBot(); }}><b>BOTA KARŞI</b><small>Rastgele desteli arena botu</small></button>
        <button class="big" onmouseenter={S.hover} onclick={openDeck}><b>DESTE</b><small>8 kart seç · ort. {avgCost(prof.deck).toFixed(1)} iksir</small></button>
        <div class="stats mono"><span><i>KUPA</i>{prof.cr}</span><span><i>G</i>{prof.w}</span><span><i>M</i>{prof.l}</span><span><i>B</i>{prof.d}</span></div>
        <label class="vol mono">MÜZİK <input type="range" min="0" max="1" step="0.05" bind:value={mvol} oninput={() => music.vol(mvol)} /></label>
      </div>
      <div class="mright">
        <div class="h mono">SAVAŞ DESTESİ</div>
        <div class="deck8">{#each prof.deck as id, i (id)}{@const c = CARD[id]!}<div class={'card r-' + c.rarity} style={`--d:${i * 50}ms`}><img src={`${IMG}card_${id}.webp`} alt="" /><b class="cost">{c.cost}</b><span class="nm">{c.name}</span></div>{/each}</div>
        <div class="rules mono">
          <div>3:00 süre · son dakika <em>2× iksir</em></div><div>Eşitlikte 2:00 uzatma · ani ölüm · son dakika <em>3×</em></div><div>Prenses kulesi 1 taç · ana kule 3 taç</div><div>Kart sürükle ya da seç + arenaya tıkla · 1–4 tuşları</div>
        </div>
      </div>
    </div>
  {:else if scr === 'deck'}
    <div class="deckb">
      <div class="dtop"><div class="h mono">DESTE · {draft.length}/8 · ort. {avgCost(draft).toFixed(1)}</div><span class="msg mono">{deckMsg}</span><button class="btn" onclick={() => (scr = 'menu')}>Vazgeç</button><button class="btn pri" disabled={saving || draft.length !== 8} onclick={saveDeck}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button></div>
      <div class="slots">{#each Array(8) as _, i}{@const id = draft[i]}{#if id}{@const c = CARD[id]!}<button class={'card r-' + c.rarity} onclick={() => toggle(id)} onmouseenter={() => (sel = c)}><img src={`${IMG}card_${id}.webp`} alt="" /><b class="cost">{c.cost}</b><span class="nm">{c.name}</span></button>{:else}<div class="card empty">+</div>{/if}{/each}</div>
      <div class="dmain">
        <div class="coll">{#each CARDS as c (c.id)}<button class={'card r-' + c.rarity} class:in={draft.includes(c.id)} onclick={() => toggle(c.id)} onmouseenter={() => { sel = c; S.hover(); }}><img src={`${IMG}card_${c.id}.webp`} alt="" /><b class="cost">{c.cost}</b><span class="nm">{c.name}</span>{#if draft.includes(c.id)}<i class="chk">✓</i>{/if}</button>{/each}</div>
        {#if sel}<div class="det">
          <img src={`${IMG}card_${sel.id}.webp`} alt="" />
          <div class="dn"><b>{sel.name}</b><span class={'rar r-' + sel.rarity}>{sel.rarity === 'epic' ? 'EPİK' : sel.rarity === 'rare' ? 'NADİR' : 'SIRADAN'}</span></div>
          <div class="role mono">{sel.role} · {sel.cost} iksir</div>
          <p>{sel.desc}</p>
          <div class="sg mono">
            {#if sel.hp}<span><i>CAN</i>{sel.hp}{sel.count ? ` ×${sel.count}` : ''}</span>{/if}
            <span><i>HASAR</i>{sel.dmg}</span>
            {#if sel.hs}<span><i>VURUŞ</i>{sel.hs}s</span>{/if}
            {#if sel.range}<span><i>MENZİL</i>{sel.range < 1.2 ? 'yakın' : sel.range}</span>{/if}
            {#if sel.speed}<span><i>HIZ</i>{sel.speed >= 1.4 ? 'çok hızlı' : sel.speed >= 1 ? 'orta' : 'yavaş'}</span>{/if}
            {#if sel.tgt}<span><i>HEDEF</i>{sel.tgt === 'build' ? 'yapılar' : sel.tgt === 'both' ? 'hava+yer' : 'yer'}</span>{/if}
            {#if sel.radius}<span><i>ALAN</i>{sel.radius}</span>{/if}
            {#if sel.life}<span><i>ÖMÜR</i>{sel.life}s</span>{/if}
            {#if sel.fly}<span><i>UÇAR</i>evet</span>{/if}
          </div>
        </div>{/if}
      </div>
    </div>
  {:else if scr === 'seek'}
    <div class="seek">
      <div class="radar"><i></i><i></i><i></i><b></b></div>
      <div class="h mono">RAKİP ARANIYOR · {mmss(seekT)}</div>
      <p>Eşleşme için başka bir oyuncunun da aynı anda aramada olması gerekir.</p>
      {#if seekErr}<p class="err">{seekErr}</p>{/if}
      <div class="row">{#if seekT >= 20}<button class="btn pri" onclick={() => { stopSeek(); startBot(); }}>Bota karşı oyna</button>{/if}<button class="btn" onclick={() => stopSeek()}>İptal</button></div>
    </div>
  {:else if scr === 'vs'}
    <div class="vs">
      <div class="pl me"><b>{NAME}</b><span class="mono">{prof.cr} kupa</span></div>
      <div class="vsx">VS</div>
      <div class="pl foe"><b>{foeName}</b><span class="mono">{foeCr} kupa{mode === 'bot' ? ' · bot' : ''}</span></div>
    </div>
  {/if}

  {#if scr === 'match' || (scr === 'result' && false)}
    <div class="match">
      <div class="side lft">
        <div class="pp foe"><b>{foeName}</b><span class="mono">{foeCr} kupa</span><div class="cr">{#each [0, 1, 2] as i}<i class:on={ui.crowns[1]! > i}>♛</i>{/each}</div></div>
        <div class="pp me"><b>{NAME}</b><span class="mono">{prof.cr} kupa</span><div class="cr">{#each [0, 1, 2] as i}<i class:on={ui.crowns[0]! > i}>♛</i>{/each}</div></div>
      </div>
      <div class="col">
        <div class="arena" bind:this={arenaBox} onpointerdown={arenaClick} role="presentation">
          <canvas bind:this={canvas}></canvas>
          <div class="clock mono" class:ot={ui.ot} class:hot={ui.time <= 10}><span>{ui.ot ? 'UZATMA' : 'SÜRE'}</span><b>{mmss(ui.time)}</b>{#if ui.rate > 1}<em>{ui.rate}× İKSİR</em>{/if}</div>
          {#if ui.count > 0}{#key ui.count}<div class="cd">{ui.count}</div>{/key}{/if}
        </div>
        <div class="handbar">
          <div class="nx"><span class="mono">SIRADAKİ</span>{#if ui.next}<div class="card mini"><img src={`${IMG}card_${ui.next}.webp`} alt="" /><b class="cost">{CARD[ui.next]?.cost}</b></div>{/if}</div>
          <div class="hand">
            {#each ui.hand as id, i (i + id)}{@const c = CARD[id]!}{@const can = c.cost <= ui.elix + 1e-9}{@const q = pending.some((p) => p.card === id)}
              <button class={'card r-' + c.rarity} class:sel={pick === i} class:no={!can || q} onpointerdown={(e) => cardDown(i, e)} style={`--p:${Math.min(1, ui.elix / c.cost)}`}>
                <img src={`${IMG}card_${id}.webp`} alt="" draggable="false" /><b class="cost">{c.cost}</b><span class="nm">{c.name}</span><span class="k mono">{i + 1}</span>{#if !can}<i class="fill"></i>{/if}
              </button>
            {/each}
          </div>
          <div class="elix"><div class="eb">{#each Array(10) as _, i}<i style={`--f:${Math.max(0, Math.min(1, ui.elix - i))}`}></i>{/each}</div><b class="mono">{Math.floor(ui.elix)}</b></div>
        </div>
      </div>
      <div class="side rgt"><div class="tip mono">{mode === 'pvp' ? 'PvP · kilit-adım' : 'Bot maçı'}<br />Kartı arenaya sürükle<br />1–4 · seç / ESC · çık</div></div>
    </div>
  {/if}
  {#if result && (scr === 'match' || scr === 'result')}
    <div class="res" class:win={result.w > 0} class:lose={result.w < 0}>
      <div class="rt">{result.w > 0 ? 'ZAFER' : result.w < 0 ? 'YENİLGİ' : 'BERABERE'}</div>
      <div class="rc">{#each [0, 1, 2] as i}<i class:on={result.crowns[0]! > i} style={`--d:${300 + i * 250}ms`}>♛</i>{/each}<span class="mono">{result.crowns[0]} – {result.crowns[1]}</span></div>
      <div class="rw mono">{result.why} · {result.dcr > 0 ? '+' : ''}{result.dcr} kupa</div>
      {#if scr === 'result'}<div class="row"><button class="btn pri" onclick={() => { toMenu(); if (mode === 'bot') startBot(); else startSeek(); }}>Tekrar</button><button class="btn" onclick={toMenu}>Menü</button></div>{/if}
    </div>
  {/if}
</div>

<style>
  .cl{position:absolute;inset:0;overflow:hidden;color:#dfeaf2;font-family:var(--f-body,system-ui);user-select:none;background:#05060b}
  .mono{font-family:var(--f-mono,'JetBrains Mono',monospace)}
  .bgk{position:absolute;inset:-4%;background-size:cover;background-position:center;animation:kb 30s ease-in-out infinite alternate;transition:filter .8s,opacity .8s}
  .bgk.dim{filter:blur(10px) brightness(.28) saturate(1.2)}
  @keyframes kb{to{transform:scale(1.08) translate(-1%,1%)}}
  .scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px);mix-blend-mode:overlay;z-index:1}
  .intro{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:18px;background:radial-gradient(ellipse at center,rgba(0,0,0,.2),rgba(0,0,0,.75));border:0;color:inherit;cursor:pointer;z-index:2}
  .logo{font-family:var(--f-disp,'Orbitron',sans-serif);font-weight:900;font-size:clamp(48px,9vw,120px);letter-spacing:.06em;display:flex;align-items:baseline;opacity:0;transform:scale(1.3);filter:blur(12px)}
  .logo.on{opacity:1;transform:none;filter:none;transition:all .7s cubic-bezier(.2,1.4,.3,1)}
  .logo .l1{color:#e9fbff;text-shadow:0 0 18px #00e5ff,0 0 2px #fff}.logo .sl{color:#fcee0a;margin:0 .1em;text-shadow:0 0 14px #fcee0a}.logo .l2{color:#ffe3ea;text-shadow:0 0 18px #ff2a55}
  .logo.on .sl{animation:gl 2.4s steps(2) infinite}
  @keyframes gl{0%,92%{transform:none}94%{transform:translate(4px,-2px) skewX(-12deg)}96%{transform:translate(-3px,1px)}}
  .logo.sm{font-size:56px}
  .sub{letter-spacing:.5em;font-size:14px;color:#9ec3d4;opacity:0;transition:opacity .6s}.sub.on{opacity:1}
  .press{margin-top:40px;font-size:12px;letter-spacing:.4em;color:#fcee0a;opacity:0}.press.on{opacity:1;animation:bl 1.2s ease-in-out infinite}
  @keyframes bl{50%{opacity:.25}}
  .menu{position:absolute;inset:56px 4vw 30px;display:grid;grid-template-columns:minmax(320px,440px) 1fr;gap:5vw;z-index:2;align-items:center}
  .tag{color:#a8bccb;max-width:380px;line-height:1.5;margin:6px 0 22px}
  .big{display:flex;flex-direction:column;align-items:flex-start;width:100%;padding:14px 20px;margin-bottom:12px;background:rgba(8,14,22,.72);border:1px solid rgba(0,229,255,.28);color:#dff;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px));transition:all .15s;cursor:pointer}
  .big b{font-family:var(--f-disp,sans-serif);letter-spacing:.25em;font-size:20px}.big small{color:#8aa3b3;font-size:12px;margin-top:3px}
  .big:hover{background:rgba(0,229,255,.14);border-color:#00e5ff;transform:translateX(6px)}
  .big.pri{background:linear-gradient(90deg,rgba(255,42,85,.35),rgba(255,42,85,.08));border-color:#ff2a55}.big.pri:hover{background:linear-gradient(90deg,rgba(255,42,85,.6),rgba(255,42,85,.15))}
  .stats{display:flex;gap:18px;margin-top:14px;font-size:20px;color:#fff}.stats i{display:block;font-style:normal;font-size:10px;letter-spacing:.2em;color:#7d97a8}
  .vol{display:flex;align-items:center;gap:10px;margin-top:18px;font-size:10px;letter-spacing:.2em;color:#7d97a8}.vol input{accent-color:#00e5ff;width:140px}
  .mright .h,.dtop .h,.seek .h{font-size:12px;letter-spacing:.35em;color:#00e5ff;margin-bottom:12px}
  .deck8{display:grid;grid-template-columns:repeat(4,minmax(0,130px));gap:12px}
  .deck8 .card{animation:ci .45s var(--d) both}
  @keyframes ci{from{opacity:0;transform:translateY(20px) rotateX(40deg)}}
  .rules{margin-top:22px;font-size:11.5px;color:#93aab8;display:grid;gap:5px}.rules em{color:#fcee0a;font-style:normal}
  .card{position:relative;aspect-ratio:3/4;border-radius:8px;overflow:hidden;background:#0b0f16;border:2px solid #3b4a5a;padding:0;color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.5)}
  .card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}
  .card::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,rgba(0,0,0,.85));pointer-events:none}
  .card.r-rare{border-color:#ff9b2f}.card.r-epic{border-color:#b56bff;box-shadow:0 0 14px rgba(181,107,255,.35),0 6px 18px rgba(0,0,0,.5)}
  .cost{position:absolute;top:4px;left:4px;z-index:2;width:24px;height:24px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff9cf3,#c2189e 60%,#5c0549);font-size:13px;box-shadow:0 0 8px rgba(255,61,242,.7);font-family:var(--f-disp,sans-serif)}
  .nm{position:absolute;left:6px;right:6px;bottom:5px;z-index:2;font-size:11px;font-weight:700;letter-spacing:.03em;text-shadow:0 1px 2px #000;text-align:left;line-height:1.15}
  .card.empty{display:grid;place-items:center;color:#3b4a5a;font-size:30px;border-style:dashed;cursor:default}
  .deckb{position:absolute;inset:56px 3vw 20px;z-index:2;display:grid;grid-template-rows:auto auto 1fr;gap:14px}
  .dtop{display:flex;align-items:center;gap:12px}.dtop .h{margin:0}.msg{flex:1;color:#fcee0a;font-size:12px}
  .btn{padding:8px 18px;background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.45);color:#00e5ff;letter-spacing:.12em;cursor:pointer}.btn:hover:not(:disabled){background:#00e5ff;color:#04050a}.btn:disabled{opacity:.4}
  .btn.pri{background:rgba(255,42,85,.15);border-color:#ff2a55;color:#ff6b88}.btn.pri:hover:not(:disabled){background:#ff2a55;color:#fff}
  .slots{display:grid;grid-template-columns:repeat(8,1fr);gap:10px;max-width:880px}
  .dmain{display:grid;grid-template-columns:1fr 320px;gap:20px;min-height:0}
  .coll{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:10px;align-content:start;overflow:auto;padding:4px}
  .coll .card{transition:transform .15s,filter .15s}.coll .card:hover{transform:translateY(-4px) scale(1.03)}.coll .card.in{filter:saturate(.3) brightness(.55)}
  .chk{position:absolute;top:4px;right:6px;z-index:3;color:#39ff8a;font-style:normal;font-weight:900;text-shadow:0 0 6px #39ff8a}
  .det{background:rgba(6,10,16,.85);border:1px solid rgba(0,229,255,.25);padding:14px;align-self:start}
  .det img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px}
  .dn{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.dn b{font-family:var(--f-disp,sans-serif);letter-spacing:.06em;font-size:17px}
  .rar{font-size:10px;letter-spacing:.2em;padding:2px 6px;border:1px solid}.rar.r-common{color:#9fb3c2}.rar.r-rare{color:#ff9b2f}.rar.r-epic{color:#c99bff}
  .role{font-size:11px;color:#00e5ff;margin-top:4px}.det p{font-size:13px;color:#b9c9d4;line-height:1.45}
  .sg{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px}.sg span{background:rgba(255,255,255,.04);padding:5px 8px}.sg i{display:block;font-style:normal;font-size:9.5px;letter-spacing:.2em;color:#7d97a8}
  .seek{position:absolute;inset:0;z-index:2;display:grid;place-content:center;justify-items:center;gap:10px;text-align:center}.seek p{color:#9fb3c2;max-width:420px}.seek .err{color:#ff6b88}
  .radar{position:relative;width:220px;height:220px;border-radius:50%;border:1px solid rgba(0,229,255,.4);margin-bottom:20px;overflow:hidden;background:radial-gradient(circle,rgba(0,229,255,.08),transparent 70%)}
  .radar i{position:absolute;inset:25%;border-radius:50%;border:1px solid rgba(0,229,255,.25)}.radar i:nth-child(2){inset:10%}.radar i:nth-child(3){inset:40%}
  .radar b{position:absolute;inset:0;background:conic-gradient(from 0deg,rgba(0,229,255,.45),transparent 25%);animation:rot 2s linear infinite;border-radius:50%}
  @keyframes rot{to{transform:rotate(360deg)}}
  .row{display:flex;gap:10px;justify-content:center;margin-top:10px}
  .vs{position:absolute;inset:0;z-index:3;display:grid;grid-template-columns:1fr auto 1fr;align-items:center}
  .pl{display:flex;flex-direction:column;gap:6px;padding:0 5vw}.pl b{font-family:var(--f-disp,sans-serif);font-size:clamp(26px,4vw,52px);letter-spacing:.06em}
  .pl.me{align-items:flex-end;animation:inl .6s cubic-bezier(.2,1.3,.3,1) both}.pl.me b{color:#bff6ff;text-shadow:0 0 18px #00e5ff}
  .pl.foe{align-items:flex-start;animation:inr .6s cubic-bezier(.2,1.3,.3,1) both}.pl.foe b{color:#ffd0da;text-shadow:0 0 18px #ff2a55}
  @keyframes inl{from{transform:translateX(-60vw)}}@keyframes inr{from{transform:translateX(60vw)}}
  .vsx{font-family:var(--f-disp,sans-serif);font-weight:900;font-size:90px;color:#fcee0a;text-shadow:0 0 30px #fcee0a;animation:sl .5s .55s cubic-bezier(.2,1.6,.4,1) both}
  @keyframes sl{from{transform:scale(4);opacity:0}}
  .match{position:absolute;inset:48px 0 0;z-index:2;display:grid;grid-template-columns:1fr auto 1fr;gap:16px}
  .col{display:flex;flex-direction:column;height:100%;min-height:0;width:min(62vh,96vw)}
  .arena{position:relative;flex:1;min-height:0;touch-action:none}
  .arena canvas{position:absolute;inset:0}
  .clock{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.65);border:1px solid rgba(255,255,255,.12);padding:6px 10px;text-align:right;pointer-events:none}
  .clock span{display:block;font-size:9px;letter-spacing:.25em;color:#8aa3b3}.clock b{font-size:22px;color:#fff}.clock em{display:block;font-style:normal;color:#ff3df2;font-size:10px;letter-spacing:.15em;animation:bl 1s infinite}
  .clock.ot b{color:#fcee0a}.clock.hot b{color:#ff2a55}
  .cd{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--f-disp,sans-serif);font-size:140px;font-weight:900;color:#fff;text-shadow:0 0 40px #00e5ff;pointer-events:none;animation:cd 1s ease-out both}
  @keyframes cd{from{transform:scale(2.2);opacity:0}30%{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.8)}}
  .handbar{display:grid;grid-template-columns:58px 1fr;grid-template-rows:auto auto;gap:6px 10px;padding:8px 4px 10px;background:linear-gradient(transparent,rgba(0,0,0,.6))}
  .nx{grid-row:1/3;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:8px;letter-spacing:.15em;color:#7d97a8}.nx .card{width:52px;cursor:default}.nx .cost{width:18px;height:18px;font-size:10px}
  .hand{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .hand .card{transition:transform .12s;touch-action:none}.hand .card:hover{transform:translateY(-4px)}
  .hand .card.sel{transform:translateY(-10px);border-color:#fcee0a;box-shadow:0 0 18px rgba(252,238,10,.6)}
  .hand .card.no img{filter:grayscale(1) brightness(.5)}
  .fill{position:absolute;left:0;right:0;bottom:0;height:calc(var(--p) * 100%);background:linear-gradient(transparent,rgba(255,61,242,.25));z-index:1;pointer-events:none}
  .k{position:absolute;top:4px;right:6px;z-index:2;font-size:10px;color:rgba(255,255,255,.55)}
  .elix{display:flex;align-items:center;gap:8px}
  .eb{flex:1;display:grid;grid-template-columns:repeat(10,1fr);gap:3px;height:16px}
  .eb i{position:relative;background:#1a0f1c;border:1px solid #4d1f47;overflow:hidden}
  .eb i::after{content:'';position:absolute;inset:0;transform-origin:left;transform:scaleX(var(--f));background:linear-gradient(90deg,#c2189e,#ff5cf0);box-shadow:0 0 8px #ff3df2}
  .elix b{width:30px;height:30px;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff9cf3,#c2189e 60%,#5c0549);font-size:16px;box-shadow:0 0 12px #ff3df2}
  .side{display:flex;flex-direction:column;justify-content:space-between;padding:14px 0}.lft{align-items:flex-end}.rgt{align-items:flex-start;justify-content:flex-end}
  .pp{background:rgba(5,8,14,.75);padding:10px 14px;min-width:180px;border-left:3px solid}.pp.foe{border-color:#ff2a55}.pp.me{border-color:#00e5ff;margin-bottom:150px}
  .pp b{display:block;font-family:var(--f-disp,sans-serif);letter-spacing:.06em}.pp span{font-size:11px;color:#8aa3b3}
  .cr{display:flex;gap:4px;margin-top:6px}.cr i{font-style:normal;font-size:22px;color:#2a3442}.cr i.on{color:#fcee0a;text-shadow:0 0 10px #fcee0a;animation:pop .5s cubic-bezier(.2,1.8,.4,1)}
  @keyframes pop{from{transform:scale(2.5)}}
  .tip{font-size:10.5px;color:#6f8797;line-height:1.7;letter-spacing:.06em}
  .res{position:absolute;inset:0;z-index:6;display:grid;place-content:center;justify-items:center;gap:14px;background:radial-gradient(ellipse,rgba(0,0,0,.55),rgba(0,0,0,.88));animation:fi .5s both}
  @keyframes fi{from{opacity:0}}
  .rt{font-family:var(--f-disp,sans-serif);font-weight:900;font-size:clamp(60px,10vw,130px);letter-spacing:.12em;color:#fff;animation:sl .6s cubic-bezier(.2,1.5,.4,1) both}
  .res.win .rt{color:#fff5b0;text-shadow:0 0 40px #fcee0a}.res.lose .rt{color:#ffc2cf;text-shadow:0 0 40px #ff2a55}
  .rc{display:flex;align-items:center;gap:10px}.rc i{font-style:normal;font-size:56px;color:#2a3442}.rc i.on{color:#fcee0a;text-shadow:0 0 20px #fcee0a;animation:pop .6s var(--d) cubic-bezier(.2,1.8,.4,1) both}.rc span{font-size:22px;margin-left:12px}
  .rw{color:#9fb3c2;letter-spacing:.15em;font-size:13px}
  @media (max-width:900px){.side{display:none}.match{grid-template-columns:1fr}.col{margin:0 auto}.menu{grid-template-columns:1fr;overflow:auto}}
</style>
