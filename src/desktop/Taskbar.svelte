<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { audio, sfx } from '../lib/sfx';
  import { appById } from './apps';
  import { ICONS } from './icons';
  import { wm, toggleTask } from './wm.svelte';
  let now = $state(new Date()), volOpen = $state(false), vol = $state(audio.volume), muted = $state(audio.muted);
  onMount(() => {
    let t: number;
    const tick = () => { now = new Date(); t = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 20); };
    tick(); return () => clearTimeout(t);
  });
  const hh = $derived(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
  const dd = $derived(now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  const w = $derived(session.world);
</script>

<div class="bar">
  <button class="start" class:on={wm.start} onclick={(e) => { e.stopPropagation(); wm.start = !wm.start; sfx.click(); }} aria-label="Kontrol paneli">
    <svg viewBox="0 0 32 32"><path d="M16 2 28 9v14l-12 7-12-7V9z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 9a7 7 0 1 0 4 12.7l3 3 2-2-3-3A7 7 0 0 0 16 9zm0 3.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z" fill="var(--ye)"/></svg>
    <span>QOS</span>
  </button>
  <div class="sep"></div>
  <div class="tasks">
    {#each wm.wins as t (t.id)}
      {@const a = appById(t.app)}
      <button class="task" class:on={wm.focus === t.id && !t.min} class:min={t.min} onclick={() => toggleTask(t.id)}>
        <span class="ti">{@html ICONS[a.icon]}</span><span class="tl">{a.title}</span>
      </button>
    {/each}
  </div>
  <div class="tray">
    {#if w}<div class="gd mono" title="Oyun tarihi (DM belirler)">{w.era} {w.year} · GÜN {w.day}</div>{/if}
    <div class="volw">
      <button class="vol" onclick={() => { volOpen = !volOpen; sfx.click(); }} aria-label="Ses">
        <svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.8"/>
          {#if muted || vol === 0}<path d="m16 9 5 6m0-6-5 6" stroke="var(--rd)" stroke-width="1.8"/>{:else}<path d="M16 9a4 4 0 0 1 0 6" stroke="currentColor" stroke-width="1.8" fill="none"/>{#if vol > 0.5}<path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="1.8" fill="none"/>{/if}{/if}</svg>
      </button>
      {#if volOpen}
        <div class="volp">
          <div class="mono">SES {Math.round(vol * 100)}</div>
          <input type="range" min="0" max="1" step="0.01" bind:value={vol} oninput={() => audio.setVolume(vol)} onchange={() => sfx.click()} />
          <label class="clickable"><input type="checkbox" bind:checked={muted} onchange={() => audio.setMuted(muted)} /> Sessiz</label>
        </div>
      {/if}
    </div>
    <div class="clock"><b>{hh}</b><span class="mono">{dd}</span></div>
  </div>
</div>

<style>
  .bar{position:absolute;left:0;right:0;bottom:0;height:48px;display:flex;align-items:center;gap:6px;padding:0 8px;z-index:9000;
    background:linear-gradient(180deg,rgba(12,16,28,.92),rgba(5,6,11,.97));border-top:1px solid rgba(0,240,255,.35);
    box-shadow:0 -1px 0 rgba(0,240,255,.08),0 -12px 30px rgba(0,0,0,.4)}
  .bar::before{content:"";position:absolute;left:0;top:-1px;width:180px;height:2px;background:var(--ye);box-shadow:0 0 10px var(--ye)}
  .start{height:36px;display:flex;align-items:center;gap:8px;padding:0 14px 0 10px;background:rgba(0,240,255,.06);border:1px solid rgba(0,240,255,.3);color:var(--cy);
    font-family:var(--f-disp);font-weight:700;letter-spacing:.2em;font-size:13px;clip-path:polygon(0 0,100% 0,100% 70%,calc(100% - 10px) 100%,0 100%)}
  .start svg{width:24px;height:24px}
  .start:hover,.start.on{background:rgba(252,238,10,.12);border-color:var(--ye);color:var(--ye)}
  .sep{width:1px;height:26px;background:var(--line);margin:0 4px}
  .tasks{flex:1;display:flex;gap:4px;overflow:hidden}
  .task{height:36px;max-width:200px;display:flex;align-items:center;gap:8px;padding:0 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);
    color:var(--tx);font-family:var(--f-ui);font-weight:600;font-size:13px;position:relative}
  .task::after{content:"";position:absolute;left:8px;right:8px;bottom:2px;height:2px;background:var(--cy);opacity:.5}
  .task.on{background:rgba(0,240,255,.1);border-color:rgba(0,240,255,.4)}.task.on::after{background:var(--ye);opacity:1;box-shadow:0 0 8px var(--ye)}
  .task.min{opacity:.6}.task.min::after{left:40%;right:40%}
  .task:hover{background:rgba(0,240,255,.12)}
  .ti{width:20px;height:20px;flex:none}.ti :global(svg){width:100%;height:100%}
  .tl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tray{display:flex;align-items:center;gap:12px;padding-left:12px;border-left:1px solid var(--line);height:30px}
  .gd{font-size:11.5px;color:var(--ye);letter-spacing:.14em;padding:3px 8px;border:1px solid rgba(252,238,10,.3)}
  .volw{position:relative}
  .vol{width:32px;height:32px;background:none;border:0;color:var(--cy);display:grid;place-items:center}
  .vol svg{width:22px;height:22px}.vol:hover{color:var(--ye)}
  .volp{position:absolute;bottom:42px;right:-40px;width:200px;padding:14px;background:var(--panel);backdrop-filter:blur(10px);border:1px solid var(--line);
    display:flex;flex-direction:column;gap:10px;font-size:13px;animation:up .18s both}
  .volp .mono{font-size:11px;color:var(--cy);letter-spacing:.2em}
  .volp input[type=range]{accent-color:var(--ye);width:100%}
  .volp label{display:flex;gap:8px;align-items:center}.volp input[type=checkbox]{accent-color:var(--ye)}
  @keyframes up{from{opacity:0;transform:translateY(8px)}}
  .clock{display:flex;flex-direction:column;align-items:flex-end;line-height:1.05;padding-right:6px}
  .clock b{font-family:var(--f-disp);font-size:15px;color:var(--tx);letter-spacing:.08em}
  .clock span{font-size:10.5px;color:var(--mut)}
</style>
