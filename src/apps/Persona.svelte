<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { sfx, ambient } from '../lib/sfx';
  import { watchWallet, type Wallet } from '../lib/live';
  import { watchSheet, watchInv, watchChrome, watchQuests, watchBounties, watchRels, ensureSheet, syncLevel,
    type Sheet, type InvItem, type ChromePiece, type Quest, type Bounty, type NpcRel } from '../lib/persona';
  import Overview from './persona/Overview.svelte';
  import Inventory from './persona/Inventory.svelte';
  import Cyberware from './persona/Cyberware.svelte';
  import StatsTab from './persona/StatsTab.svelte';
  import Journal from './persona/Journal.svelte';

  const u = session.user!;
  const c = $derived(u.character);
  let tab = $state<'ov' | 'inv' | 'chr' | 'st' | 'jo'>('ov');
  let sheet = $state<Sheet | null>(null), inv = $state<InvItem[]>([]), chrome = $state<ChromePiece[]>([]);
  let quests = $state<Quest[]>([]), bounties = $state<Bounty[]>([]), rels = $state<NpcRel[]>([]);
  let wallet = $state<Wallet | null>(null), err = $state('');
  const unspent = $derived(sheet?.unspent ?? 0);
  const go = (t: typeof tab) => { tab = t; sfx.click(); };

  onMount(() => {
    const stopAmb = ambient('persona');
    let a = () => {}, b = () => {}, c0 = () => {}, d = () => {}, e = () => {}, f = () => {}, g = () => {};
    (async () => {
      try {
        if (!c) return;
        sheet = await ensureSheet(u.uid, c.level ?? 1);
        a = watchSheet(u.uid, (s) => { if (s) sheet = syncLevel(s, c.level ?? 1); });
        b = watchInv(u.uid, (xs) => (inv = xs.sort((x, y) => x.name.localeCompare(y.name, 'tr'))));
        c0 = watchChrome(u.uid, (xs) => (chrome = xs));
        const who = u.role === 'dm' ? null : u.uid;
        d = watchQuests(who, (xs) => (quests = xs));
        e = watchBounties(who, (xs) => (bounties = xs));
        f = watchRels(who, (xs) => (rels = xs));
        g = watchWallet(u.uid, (w) => (wallet = w));
      } catch (x) { err = String(x); }
    })();
    return () => { stopAmb(); a(); b(); c0(); d(); e(); f(); g(); };
  });
</script>

<div class="pid">
  <header>
    <div class="brand">
      <b class="mono">PERSONA.ID</b>
      <span class="mono k">{c?.name ?? u.username} · {u.username}</span>
    </div>
    <nav>
      <button class:on={tab === 'ov'} onclick={() => go('ov')}>Genel bakış</button>
      <button class:on={tab === 'inv'} onclick={() => go('inv')}>Envanter</button>
      <button class:on={tab === 'chr'} onclick={() => go('chr')}>Krom</button>
      <button class:on={tab === 'st'} onclick={() => go('st')}>Statlar{#if unspent > 0}<em>!</em>{/if}</button>
      <button class:on={tab === 'jo'} onclick={() => go('jo')}>Günlük</button>
    </nav>
  </header>
  {#if err}<div class="err mono">{err}</div>
  {:else if !c}<div class="err mono">Bu hesapta karakter kağıdı yok.</div>
  {:else if !sheet}<div class="err mono">KAĞIT YÜKLENİYOR…</div>
  {:else if tab === 'ov'}<Overview {c} {u} {sheet} {inv} {wallet} {chrome} />
  {:else if tab === 'inv'}<Inventory uid={u.uid} {c} {sheet} {inv} />
  {:else if tab === 'chr'}<Cyberware {c} {sheet} {chrome} />
  {:else if tab === 'st'}<StatsTab uid={u.uid} {c} {sheet} dm={u.role === 'dm'} onsheet={(s) => (sheet = s)} />
  {:else}<Journal {quests} {bounties} {rels} {sheet} />{/if}
</div>

<style>
  .pid{position:absolute;inset:0;display:flex;flex-direction:column;background:
    radial-gradient(ellipse at 50% 0%,rgba(252,238,10,.07),transparent 42%),
    linear-gradient(180deg,#07080e,#05060b 40%,#08060c);color:var(--tx);overflow:hidden}
  .pid::before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.015) 0 1px,transparent 1px 3px);mix-blend-mode:screen;opacity:.5;z-index:2}
  header{flex:none;display:flex;align-items:center;gap:18px;padding:52px 28px 0 28px;z-index:3}
  .brand{display:flex;flex-direction:column;gap:2px;min-width:220px}
  .brand b{letter-spacing:.42em;color:var(--ye);font-size:13px}
  .k{font-size:10.5px;color:var(--mut);letter-spacing:.16em}
  nav{display:flex;gap:4px;margin-left:auto;padding:3px;border:1px solid rgba(0,240,255,.25);background:rgba(0,0,0,.35)}
  nav button{position:relative;background:none;border:0;color:var(--mut);padding:8px 16px;font:inherit;font-size:13.5px;letter-spacing:.08em}
  nav button:hover{color:#fff}nav button.on{color:var(--cy);background:rgba(0,240,255,.1)}
  nav em{position:absolute;top:2px;right:4px;width:14px;height:14px;border-radius:50%;background:var(--ye);color:#111;font-style:normal;font-size:10px;font-weight:700;display:grid;place-items:center;font-family:var(--f-mono)}
  .err{padding:40px;letter-spacing:.2em;color:var(--mut)}
</style>
