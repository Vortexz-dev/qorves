<script lang="ts">
  /* Persona.ID v3 — kimlik, sibernetik beden, envanter, özellikler, günlük. DM: herhangi bir oyuncunun kağıdını açar/düzenler, "oyuncu gözüyle" önizler. */
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { session } from '../lib/session.svelte';
  import { ambient } from '../lib/sfx';
  import { watchWallet, watchProfile, type Wallet } from '../lib/live';
  import type { UserProfile } from '../lib/backend';
  import { CLASSES, RACES, CHROME_TIERS } from '../lib/data/character';
  import { watchSheet, watchInv, watchChrome, watchQuests, watchBounties, watchRels, ensureSheet, syncLevel, listPlayers,
    maxHp, statOf, maxCarry, carryOf, strOf, kgFmt, moneyLine, xpToReach,
    type Sheet, type InvItem, type ChromePiece, type Quest, type Bounty, type NpcRel } from '../lib/persona';
  import { P } from './persona/psfx';
  import HudBg from './persona/HudBg.svelte';
  import Intro from './persona/Intro.svelte';
  import Identity from './persona/Identity.svelte';
  import Cyber from './persona/Cyber.svelte';
  import Inventory from './persona/Inventory.svelte';
  import Stats from './persona/Stats.svelte';
  import Journal from './persona/Journal.svelte';

  const me = session.user!;
  const isDM = me.role === 'dm';
  const TABS = [['id', 'KİMLİK'], ['cyber', 'SİBERNETİK'], ['inv', 'ENVANTER'], ['stats', 'ÖZELLİKLER'], ['jo', 'GÜNLÜK']] as const;
  type Tab = (typeof TABS)[number][0];
  let tab = $state<Tab>('id'), dir = $state(1);
  let viewUid = $state(isDM ? '' : me.uid), preview = $state(false), players = $state<UserProfile[]>([]);
  let prof = $state<UserProfile | null>(isDM ? null : me);
  let sheet = $state<Sheet | null>(null), inv = $state<InvItem[]>([]), chrome = $state<ChromePiece[]>([]);
  let quests = $state<Quest[]>([]), bounties = $state<Bounty[]>([]), rels = $state<NpcRel[]>([]);
  let wallet = $state<Wallet | null>(null), err = $state(''), intro = $state(true);
  const c = $derived(prof?.character ?? null);
  const canEdit = $derived(isDM && !preview);
  const own = $derived(viewUid === me.uid);
  const unspent = $derived(sheet?.unspent ?? 0);
  const lab = (xs: readonly { id: string; label: string }[], id: string) => xs.find((x) => x.id === id)?.label ?? id;
  const lvl = $derived(Math.max(1, c?.level ?? 1));
  const xp = $derived(c?.xp ?? xpToReach(lvl));
  const xpPct = $derived(Math.max(0, Math.min(1, (xp - xpToReach(lvl)) / Math.max(1, xpToReach(lvl + 1) - xpToReach(lvl)))));
  const hpMax = $derived(c ? maxHp(c.race, statOf(c, 'CON'), c.level ?? 1) : 100);
  const hp = $derived(!sheet || sheet.hp < 0 ? hpMax : Math.min(sheet.hp, hpMax));
  const kg = $derived(carryOf(inv)), cap = $derived(maxCarry(strOf(c)));

  function go(t: Tab) { if (t === tab) return; const a = TABS.findIndex((x) => x[0] === tab), b = TABS.findIndex((x) => x[0] === t); dir = b > a ? 1 : -1; tab = t; P.tab(); }
  function step(d: number) { const i = TABS.findIndex((x) => x[0] === tab); go(TABS[(i + d + TABS.length) % TABS.length]![0]); }

  onMount(() => {
    const stopAmb = ambient('persona');
    if (isDM) listPlayers().then((xs) => { players = xs; if (!viewUid && xs[0]) viewUid = xs[0].uid; }).catch((e) => (err = String(e)));
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'q' || e.key === 'Q') step(-1); else if (e.key === 'e' || e.key === 'E') step(1);
      else if (/^[1-5]$/.test(e.key)) go(TABS[+e.key - 1]![0]);
    };
    addEventListener('keydown', key);
    return () => { stopAmb(); removeEventListener('keydown', key); };
  });
  // görüntülenen oyuncunun verileri
  $effect(() => {
    const id = viewUid; if (!id) return;
    sheet = null; inv = []; chrome = []; wallet = null;
    const offs: (() => void)[] = [];
    offs.push(watchProfile(id, (p) => {
      prof = p;
      const L = p.character?.level ?? 1;
      if (!sheet && p.character) ensureSheet(id, L).then((s) => (sheet = s)).catch((e) => (err = String(e)));
    }));
    offs.push(watchSheet(id, (s) => { if (s) sheet = syncLevel(s, prof?.character?.level ?? 1); }));
    offs.push(watchInv(id, (xs) => (inv = xs.sort((x, y) => x.name.localeCompare(y.name, 'tr')))));
    offs.push(watchChrome(id, (xs) => (chrome = xs)));
    const who = isDM ? null : id;
    offs.push(watchQuests(who, (xs) => (quests = isDM ? xs.filter((q) => q.players?.includes(id)) : xs)));
    offs.push(watchBounties(who, (xs) => (bounties = isDM ? xs.filter((q) => q.players?.includes(id)) : xs)));
    offs.push(watchRels(who, (xs) => (rels = isDM ? xs.filter((q) => q.players?.includes(id)) : xs)));
    offs.push(watchWallet(id, (w) => (wallet = w)));
    return () => offs.forEach((f) => f());
  });
  const clsLine = $derived(c ? [lab(CLASSES, c.cls), c.cls2 && lab(CLASSES, c.cls2)].filter(Boolean).join(' / ') : '');
</script>

<div class="pid">
  <HudBg />
  {#if intro && c}<Intro name={c.name.toUpperCase()} avatar={prof?.avatar ?? ''} sub={lab(RACES, c.race).toUpperCase() + ' · ' + clsLine.toUpperCase()} ondone={() => (intro = false)} />{/if}
  {#if isDM}
    <div class="dmbar" in:fade>
      <span class="mono">DM · GÖRÜNTÜLENEN</span>
      <select bind:value={viewUid} onchange={() => { intro = true; P.select(); }}>
        {#each players as p (p.uid)}<option value={p.uid}>{p.character?.name} · @{p.username}</option>{/each}
      </select>
      <label class:on={preview}><input type="checkbox" bind:checked={preview} onchange={() => P.select()} />OYUNCU GÖZÜYLE</label>
      <em class="mono">{canEdit ? 'DÜZENLEME AÇIK' : 'SALT OKUNUR ÖNİZLEME'}</em>
    </div>
  {/if}
  <header>
    <div class="lv">
      <b class="n">{lvl}</b>
      <div class="lvt"><span class="mono">SEVİYE</span><div class="xp"><i style:width="{xpPct * 100}%"></i></div><small class="mono">{xp.toLocaleString('tr-TR')} / {xpToReach(lvl + 1).toLocaleString('tr-TR')} XP</small></div>
      {#if c}<b class="n cy">{c.chrome || 0}</b><div class="lvt"><span class="mono">KROM KADEMESİ</span><small class="mono">{lab(CHROME_TIERS, String(c.chrome || '0')).replace(/^\d · /, '')}</small></div>{/if}
    </div>
    <nav>
      <kbd class="mono">Q</kbd>
      {#each TABS as [k, l] (k)}
        <button class:on={tab === k} onclick={() => go(k)} onmouseenter={P.hover}>{l}{#if k === 'stats' && unspent > 0}<em class="mono">!</em>{/if}</button>
      {/each}
      <kbd class="mono">E</kbd>
    </nav>
    <div class="res">
      <div class="rv"><svg viewBox="0 0 24 24"><path d="M12 21s-7-4.6-9.3-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.3 6c-2.3 4.4-9.3 9-9.3 9z" fill="currentColor"/></svg><b>{hp}</b><small>/{hpMax}</small></div>
      <div class="rv" class:bad={kg > cap}><svg viewBox="0 0 24 24"><path d="M6 8h12l2 12H4zM9 8a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2"/></svg><b>{kg.toFixed(1)}</b><small>/{kgFmt(cap)} kg</small></div>
      <div class="rv y"><b class="mono">{moneyLine(wallet)}</b></div>
    </div>
  </header>

  <main>
    {#if err}<div class="msg mono">{err}</div>
    {:else if isDM && !viewUid}<div class="msg mono">{players.length ? 'OYUNCU SEÇ' : 'KARAKTERLİ OYUNCU YOK'}</div>
    {:else if !c}<div class="msg mono">{prof ? 'BU HESAPTA KARAKTER KAĞIDI YOK' : 'KİMLİK YÜKLENİYOR…'}</div>
    {:else if !sheet}<div class="msg mono">KAĞIT EŞLENİYOR…</div>
    {:else}
      {#key tab + viewUid}
        <div class="pane" in:fly={{ x: 60 * dir, duration: 380, opacity: 0 }}>
          {#if tab === 'id'}<Identity u={prof!} {c} {sheet} {inv} {chrome} {wallet} />
          {:else if tab === 'cyber'}<Cyber uid={viewUid} {c} {sheet} {chrome} {canEdit} />
          {:else if tab === 'inv'}<Inventory uid={viewUid} {c} {inv} editable={own || canEdit} />
          {:else if tab === 'stats'}<Stats uid={viewUid} {c} {sheet} editable={own || canEdit} {canEdit} onsheet={(s) => (sheet = s)} />
          {:else}<Journal {quests} {bounties} {rels} {sheet} />{/if}
        </div>
      {/key}
    {/if}
  </main>
  <footer class="mono">
    <span>PERSONA.ID v3 · QORVES SİVİL KAYIT AĞI</span>
    <span class="keys"><kbd>Q</kbd><kbd>E</kbd> sekme · <kbd>1-5</kbd> doğrudan · <kbd>ESC</kbd> çıkış</span>
    <span class="live"><i></i>NÖRAL BAĞ AKTİF</span>
  </footer>
</div>

<style>
  .pid{position:absolute;inset:0;display:flex;flex-direction:column;color:#f3dede;overflow:hidden;font-family:var(--f-ui);
    --pr:#ff5d5d;--pr2:#ff2a3d;--pc:#5ef6ff;--py:#fcee0a;--pl:rgba(255,93,93,.28);
    background:radial-gradient(ellipse at 50% -10%,rgba(255,60,70,.16),transparent 55%),radial-gradient(ellipse at 100% 100%,rgba(94,246,255,.06),transparent 50%),#07040a}
  .dmbar{position:relative;z-index:6;display:flex;align-items:center;gap:12px;margin:48px 28px 0;padding:6px 10px;border:1px solid rgba(252,238,10,.35);background:rgba(252,238,10,.05)}
  .dmbar span,.dmbar em{font-size:10.5px;letter-spacing:.24em;color:var(--py);font-style:normal}.dmbar em{margin-left:auto;color:var(--mut)}
  .dmbar select{background:#0b0709;color:#fff;border:1px solid var(--pl);padding:5px 8px;font:inherit;min-width:260px}
  .dmbar label{display:flex;align-items:center;gap:6px;font-size:12px;letter-spacing:.18em;color:var(--mut);cursor:var(--cur-p)}.dmbar label.on{color:var(--pc)}
  header{position:relative;z-index:5;flex:none;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;padding:14px 28px 10px;margin-top:38px;border-bottom:1px solid var(--pl)}
  .dmbar + header{margin-top:4px}
  header::after{content:"";position:absolute;left:28px;right:28px;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,var(--pr),transparent);animation:hl 6s ease-in-out infinite}
  @keyframes hl{0%,100%{opacity:.3}50%{opacity:1}}
  .lv{display:flex;align-items:center;gap:10px}
  .n{font-family:var(--f-disp);font-size:30px;color:var(--pr);text-shadow:0 0 14px rgba(255,93,93,.55);min-width:38px;text-align:right}.n.cy{color:var(--pc);text-shadow:0 0 14px rgba(94,246,255,.5);margin-left:18px}
  .lvt{display:flex;flex-direction:column;gap:3px}.lvt span{font-size:11px;letter-spacing:.3em;color:#fff}.lvt small{font-size:9.5px;color:var(--mut);letter-spacing:.1em}
  .xp{width:120px;height:3px;background:rgba(255,93,93,.15)}.xp i{display:block;height:100%;background:var(--pr);box-shadow:0 0 8px var(--pr)}
  nav{display:flex;align-items:center;gap:2px}
  nav kbd{font-size:10px;border:1px solid var(--pc);color:var(--pc);padding:1px 6px;margin:0 8px}
  nav button{position:relative;background:none;border:0;color:rgba(255,120,120,.75);font:600 14px var(--f-ui);letter-spacing:.14em;padding:8px 14px;cursor:var(--cur-p);transition:color .15s}
  nav button::after{content:"";position:absolute;left:14px;right:14px;bottom:0;height:2px;background:var(--pc);transform:scaleX(0);transition:transform .25s cubic-bezier(.2,1,.3,1)}
  nav button:hover{color:#fff}nav button.on{color:var(--pc);text-shadow:0 0 12px rgba(94,246,255,.6)}nav button.on::after{transform:none}
  nav em{position:absolute;top:0;right:0;width:15px;height:15px;display:grid;place-items:center;background:var(--py);color:#000;font-style:normal;font-size:11px;font-weight:700;clip-path:polygon(50% 0,100% 100%,0 100%);padding-top:3px;animation:bl 1s steps(2) infinite}
  @keyframes bl{50%{opacity:.35}}
  .res{display:flex;justify-content:flex-end;align-items:center;gap:18px}
  .rv{display:flex;align-items:baseline;gap:4px;color:var(--pr)}.rv svg{width:16px;height:16px;align-self:center}.rv b{font-family:var(--f-disp);font-size:17px;color:#fff}.rv small{font-size:11px;color:var(--mut)}
  .rv.bad b{color:var(--pr)}.rv.y b{color:var(--py);font-size:12.5px;letter-spacing:.08em}
  main{position:relative;z-index:3;flex:1;min-height:0}
  .pane{position:absolute;inset:0}
  .msg{display:grid;place-items:center;height:100%;letter-spacing:.3em;color:var(--pr)}
  footer{position:relative;z-index:5;flex:none;display:flex;justify-content:space-between;align-items:center;padding:7px 28px;border-top:1px solid rgba(255,93,93,.15);font-size:10px;letter-spacing:.2em;color:rgba(255,150,150,.45)}
  footer kbd{border:1px solid rgba(94,246,255,.4);color:var(--pc);padding:0 4px;margin:0 2px;font-size:9.5px}
  .live{display:flex;align-items:center;gap:6px;color:var(--pc)}.live i{width:6px;height:6px;border-radius:50%;background:var(--pc);box-shadow:0 0 8px var(--pc);animation:bl 1.4s infinite}
</style>
