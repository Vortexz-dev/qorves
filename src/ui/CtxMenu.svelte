<script lang="ts" module>
  export interface MI { label: string; act?: () => void; danger?: boolean; disabled?: boolean; hint?: string; sep?: boolean }
</script>
<script lang="ts">
  import { onMount } from 'svelte';
  import { portal } from '../lib/portal';
  let el: HTMLDivElement | undefined = $state();
  onMount(() => {
    const f = (e: PointerEvent) => { if (el && !el.contains(e.target as Node)) close(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
    const t = setTimeout(() => { addEventListener('pointerdown', f, true); addEventListener('keydown', k, true); });
    return () => { clearTimeout(t); removeEventListener('pointerdown', f, true); removeEventListener('keydown', k, true); };
  });
  let { x, y, items, close }: { x: number; y: number; items: MI[]; close: () => void } = $props();
</script>
<div class="menu" bind:this={el} use:portal style:left="{Math.min(x, innerWidth - 230)}px" style:top="{Math.min(y, innerHeight - 40 - items.length * 38)}px" role="menu">
  {#each items as m, i (i)}
    {#if m.sep}<hr />{:else}
      <button class:dg={m.danger} disabled={m.disabled} onclick={() => { close(); m.act?.(); }}>{m.label}{#if m.hint}<small>{m.hint}</small>{/if}</button>
    {/if}
  {/each}
</div>
<style>
  .menu{position:fixed;z-index:9000;min-width:210px;padding:6px 0;background:rgba(6,9,16,.97);border:1px solid rgba(0,240,255,.5);box-shadow:0 12px 40px rgba(0,0,0,.6),0 0 18px rgba(0,240,255,.12);animation:mi .14s both}
  @keyframes mi{from{opacity:0;transform:translateY(-4px) scale(.98)}}
  .menu button{display:flex;flex-direction:column;align-items:flex-start;width:100%;padding:8px 16px;background:none;border:0;color:var(--tx);text-align:left;font-size:14.5px}
  .menu button:hover:not(:disabled){background:rgba(0,240,255,.12);color:#fff}.menu button:disabled{opacity:.45}
  .menu small{font-size:11px;color:var(--mut)}.menu .dg{color:var(--rd)}.menu hr{border:0;border-top:1px solid var(--line);margin:5px 0}
</style>
