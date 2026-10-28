<script lang="ts">
  // DM Paneli: yalnız DungeonMaster rolüne görünür (apps.ts dmOnly + Firestore kuralları isDM()).
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { ghos } from '../lib/ghos.svelte';
  import { dm, loadDm, stopDm } from './dm/store.svelte';
  import { isOnline } from '../lib/live';
  import { sfx } from '../lib/sfx';
  import Players from './dm/Players.svelte';
  import Know from './dm/Know.svelte';
  import Events from './dm/Events.svelte';
  import Calendar from './dm/Calendar.svelte';
  import Notify from './dm/Notify.svelte';
  import Npc from './dm/Npc.svelte';
  import Markers from './dm/Markers.svelte';
  import WalletTab from './dm/WalletTab.svelte';
  import DiceFeed from './dm/DiceFeed.svelte';
  let { arg }: { arg?: string } = $props();
  const ok = session.user?.role === 'dm';
  const TABS = [['players', 'Oyuncular'], ['know', 'Bilgi izinleri'], ['events', 'Olaylar'], ['cal', 'Takvim'], ['notify', 'Bildirim'], ['npc', 'ghOS-Net'], ['markers', 'Harita işaretleri'], ['wallet', 'Cüzdan'], ['dice', 'Zar akışı']] as const;
  let tab = $state<string>(arg && TABS.some((t) => t[0] === arg) ? arg : 'players'), err = $state('');
  const go = (t: string) => { tab = t; sfx.click(); };
  onMount(() => { if (ok) loadDm().catch((e) => (err = String(e))); return stopDm; });
  const online = $derived(dm.users.filter((u) => isOnline(dm.pres.find((p) => p.uid === u.uid))).length);
  const npcUnread = $derived(ghos.unread);
</script>
{#if !ok}<div class="no mono">YETKİSİZ ERİŞİM</div>
{:else}
<div class="dmp">
  <nav>
    <div class="br mono">DM PANELİ<small>{dm.users.length} oyuncu · {online} çevrimiçi</small></div>
    {#each TABS as [k, l] (k)}<button class:on={tab === k} onclick={() => go(k)}>{l}{#if k === 'npc' && npcUnread}<em>{npcUnread}</em>{/if}</button>{/each}
  </nav>
  <main>
    {#if err}<div class="no mono">YÜKLENEMEDİ · {err}</div>
    {:else if !dm.loaded}<div class="no mono">VERİ YÜKLENİYOR…</div>
    {:else if tab === 'players'}<Players {go} />
    {:else if tab === 'know'}<Know />
    {:else if tab === 'events'}<Events />
    {:else if tab === 'cal'}<Calendar />
    {:else if tab === 'notify'}<Notify />
    {:else if tab === 'npc'}<Npc />
    {:else if tab === 'markers'}<Markers />
    {:else if tab === 'wallet'}<WalletTab />
    {:else if tab === 'dice'}<DiceFeed />{/if}
  </main>
</div>
{/if}
<style>
  .dmp{display:grid;grid-template-columns:180px 1fr;height:100%;min-height:0}
  nav{border-right:1px solid var(--line);display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(255,42,85,.06),transparent 40%)}
  .br{padding:14px 14px 12px;font-size:13px;letter-spacing:.25em;color:var(--rd);border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:4px}.br small{font-size:10px;letter-spacing:.1em;color:var(--mut)}
  nav button{display:flex;align-items:center;background:none;border:0;border-left:2px solid transparent;color:var(--tx);text-align:left;padding:10px 14px;font:inherit;font-size:15px}
  nav button:hover{background:rgba(0,240,255,.06)}nav button.on{border-left-color:var(--rd);background:rgba(255,42,85,.1);color:#fff}
  nav em{margin-left:auto;font-style:normal;font-family:var(--f-mono);font-size:10px;background:#ff2a8a;color:#000;padding:0 5px}
  .dmp :global(.btn.small){font-size:11.5px;letter-spacing:.1em;padding:6px 12px;white-space:nowrap;--cut:8px}
  main{min-height:0;min-width:0;overflow:hidden}
  .no{padding:30px;color:var(--mut);font-size:12px;letter-spacing:.2em}
</style>
