<script lang="ts">
  import { onMount } from 'svelte';
  import { ambient } from '../lib/sfx';
  import { kb, loadKb, searchKb, allEntries } from '../lib/kb.svelte';
  import { TYPES, TYPE_ORDER, tmeta } from '../lib/types';
  import { openTag } from '../lib/tags.svelte';
  import { session } from '../lib/session.svelte';
  import { sfx } from '../lib/sfx';
  import MatrixRain from '../ui/MatrixRain.svelte';
  import TagView from '../ui/TagView.svelte';
  import { showOnTimeline } from '../lib/tlnav.svelte';
  import { getEntry } from '../lib/kb.svelte';
  let q = $state(''), classic = $state(false), cat = $state('system'), art = $state(''), filter = $state('');
  let inp: HTMLInputElement | undefined = $state();
  const res = $derived(kb.ready && q.trim() ? searchKb(q, 40) : []);
  const counts = $derived(kb.ready ? TYPE_ORDER.map((t) => [t, allEntries().filter((e) => e.type === t).length] as const).filter(([, n]) => n) : []);
  const list = $derived(kb.ready ? allEntries().filter((e) => e.type === cat && (!filter || e.name.toLocaleLowerCase('tr').includes(filter.toLocaleLowerCase('tr'))))
    .sort((a, b) => (cat === 'event' || cat === 'era' ? (a.ys ?? a.ord ?? 0) - (b.ys ?? b.ord ?? 0) : a.name.localeCompare(b.name, 'tr'))) : []);
  onMount(() => { loadKb(session.user!); setTimeout(() => inp?.focus(), 700); const stop = ambient('codex'); return stop; });
  const hl = (s: string, n = 150) => (s.length > n ? s.slice(0, n) + '…' : s);
  function pick(id: string) { sfx.click(); if (classic) art = id; else if (getEntry(id)?.type === 'event') showOnTimeline(id); else openTag(id); }
  function toggle() { classic = !classic; sfx.glitch(); if (classic && !art) art = list[0]?.id ?? ''; }
</script>

<div class="cx">
  <MatrixRain />
  <div class="veil"></div>
  <button class="mode" onclick={toggle} title={classic ? 'Arama görünümü' : 'Ansiklopedi görünümü'}>
    <span class="mono">{classic ? 'ARAMA' : 'ANSİKLOPEDİ'}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d={classic ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}/></svg>
  </button>
  {#if !classic}
    <div class="srch" class:has={!!q.trim()}>
      <div class="ttl"><span class="glitch" data-text="QORVES CODEX">QORVES CODEX</span><small class="mono">KÜME BİLGİ BANKASI · {kb.ready ? kb.count + ' KAYIT' : 'YÜKLENİYOR…'}</small></div>
      <div class="bar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        <input bind:this={inp} bind:value={q} placeholder="Sistem, kişi, ırk, olay… ara" spellcheck="false" onkeydown={(e) => { sfx.key(); if (e.key === 'Enter' && res[0]) pick(res[0].e.id); }} />
        {#if q}<button class="clr" onclick={() => { q = ''; inp?.focus(); }}>✕</button>{/if}
      </div>
      {#if q.trim()}
        <div class="res">
          {#each res as r, i (r.e.id)}
            {@const m = tmeta(r.e.type)}
            <button class="row" style:--c={m.color} style:--d="{Math.min(i, 12) * 22}ms" onclick={() => pick(r.e.id)} onmouseenter={() => sfx.hover()}>
              <span class="g">{@html m.glyph}</span>
              <span class="tx"><b>{r.e.name}</b>{#if r.e.date}<i class="mono">{r.e.date}</i>{/if}<small>{hl(r.e.summary ?? '')}</small></span>
              <span class="mono ty">{m.label}</span>
            </button>
          {:else}<div class="none mono">{kb.ready ? 'EŞLEŞME YOK' : 'VERİ YÜKLENİYOR…'}</div>{/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="enc">
      <nav class="cats">
        <div class="mono h">KATEGORİLER</div>
        {#each counts as [t, n] (t)}
          <button class:on={cat === t} style:--c={TYPES[t].color} onclick={() => { cat = t; filter = ''; sfx.click(); }}><span class="g">{@html TYPES[t].glyph}</span>{TYPES[t].plural}<i class="mono">{n}</i></button>
        {/each}
      </nav>
      <div class="lst">
        <input class="inp" bind:value={filter} placeholder="Listede süz…" />
        <div class="items">
          {#each list as e (e.id)}<button class:on={art === e.id} onclick={() => pick(e.id)}>{e.name}{#if e.date}<i class="mono">{e.date}</i>{/if}</button>{/each}
        </div>
      </div>
      <div class="art">{#if art}{#key art}<div class="ai"><TagView id={art} nav={(id) => (art = id)} /></div>{/key}{/if}</div>
    </div>
  {/if}
</div>

<style>
  .cx{position:absolute;inset:0;overflow:hidden}
  .veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 35%,rgba(4,5,10,.35),rgba(4,5,10,.85) 75%);backdrop-filter:blur(1.5px)}
  .mode{position:absolute;right:24px;top:58px;z-index:7;height:32px;display:flex;align-items:center;gap:8px;padding:0 10px 0 14px;background:rgba(0,240,255,.08);border:1px solid rgba(0,240,255,.5);color:var(--cy)}
  .mode span{font-size:10.5px;letter-spacing:.25em}.mode svg{width:16px;height:16px}.mode:hover{background:rgba(0,240,255,.2)}
  .srch{position:absolute;left:50%;top:30%;transform:translate(-50%,0);width:min(820px,88vw);display:flex;flex-direction:column;align-items:center;gap:22px;transition:top .45s cubic-bezier(.2,.9,.2,1)}
  .srch.has{top:9%}
  .ttl{display:flex;flex-direction:column;align-items:center;gap:6px}
  .ttl span{font-family:var(--f-disp);font-weight:900;font-size:54px;letter-spacing:.18em;color:var(--cy);text-shadow:0 0 24px rgba(0,240,255,.55)}
  .ttl small{font-size:11px;letter-spacing:.4em;color:var(--ye)}
  .bar{width:100%;display:flex;align-items:center;gap:12px;padding:0 16px;height:58px;background:rgba(5,8,14,.82);border:1px solid rgba(0,240,255,.55);
    box-shadow:0 0 30px rgba(0,240,255,.18),inset 0 0 20px rgba(0,240,255,.06);clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px))}
  .bar svg{width:22px;height:22px;color:var(--cy);flex:none}
  .bar input{flex:1;background:none;border:0;outline:0;color:#fff;font-family:var(--f-ui);font-size:21px;letter-spacing:.04em}
  .clr{background:none;border:0;color:var(--mut);font-size:16px}
  .res{width:100%;max-height:62vh;overflow:auto;display:flex;flex-direction:column;gap:4px}
  .row{display:flex;align-items:center;gap:14px;padding:10px 14px;text-align:left;background:rgba(5,8,14,.8);border:1px solid transparent;border-left:3px solid var(--c);color:var(--tx);
    animation:ri .3s var(--d) both cubic-bezier(.2,.9,.2,1)}
  @keyframes ri{from{opacity:0;transform:translateY(8px)}}
  .row:hover{border-color:color-mix(in srgb,var(--c) 60%,transparent);background:color-mix(in srgb,var(--c) 8%,rgba(5,8,14,.9))}
  .g{width:26px;height:26px;color:var(--c);flex:none;display:block}.g :global(svg){width:100%;height:100%}
  .tx{flex:1;display:flex;flex-direction:column;min-width:0}.tx b{font-size:17px;color:#fff}.tx i{font-size:11px;color:var(--c);font-style:normal}
  .tx small{color:var(--mut);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ty{font-size:10px;letter-spacing:.2em;color:var(--c)}
  .none{color:var(--mut);letter-spacing:.3em;font-size:12px;padding:16px;text-align:center}
  .enc{position:absolute;inset:100px 24px 24px;display:grid;grid-template-columns:220px 280px 1fr;gap:14px;animation:ei .4s both}
  @keyframes ei{from{opacity:0;filter:blur(6px)}}
  .cats,.lst,.art{background:rgba(5,8,14,.86);border:1px solid var(--line);overflow:auto}
  .cats{display:flex;flex-direction:column;padding:10px 0}.h{font-size:10px;letter-spacing:.3em;color:var(--mut);padding:4px 14px 10px}
  .cats button{display:flex;align-items:center;gap:10px;padding:7px 14px;background:none;border:0;border-left:2px solid transparent;color:var(--tx);text-align:left;font-size:14.5px}
  .cats button .g{width:18px;height:18px}.cats button i{margin-left:auto;font-style:normal;font-size:11px;color:var(--mut)}
  .cats button:hover{background:rgba(255,255,255,.04)}.cats button.on{border-left-color:var(--c);background:color-mix(in srgb,var(--c) 10%,transparent);color:#fff}
  .lst{display:flex;flex-direction:column;padding:10px;gap:8px}.items{display:flex;flex-direction:column;overflow:auto}
  .items button{display:flex;justify-content:space-between;gap:8px;text-align:left;padding:6px 8px;background:none;border:0;color:var(--tx);font-size:14px}
  .items button i{font-style:normal;font-size:10.5px;color:var(--mut);white-space:nowrap}
  .items button:hover{background:rgba(0,240,255,.06)}.items button.on{background:rgba(252,238,10,.1);color:var(--ye)}
  .art{padding:24px 28px}.ai{animation:ai .3s both}@keyframes ai{from{opacity:0;transform:translateX(10px)}}
</style>
