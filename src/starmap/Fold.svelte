<script lang="ts">
  // Katmanlı ayrıntı: başlığa tıklayınca açılır/kapanır, durum tarayıcıda hatırlanır.
  import type { Snippet } from 'svelte';
  import { slide } from 'svelte/transition';
  let { k, title, count, open = true, children }: { k: string; title: string; count?: number | string; open?: boolean; children: Snippet } = $props();
  const KEY = 'qv.mapFold';
  const read = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  let on = $state(read()[k] ?? open);
  function tog() { on = !on; const m = read(); m[k] = on; localStorage.setItem(KEY, JSON.stringify(m)); }
</script>

<section class="fold" class:on>
  <button class="fh mono" onclick={tog} aria-expanded={on}><i></i>{title}{#if count != null && count !== ''}<em>{count}</em>{/if}<b>{on ? '−' : '+'}</b></button>
  {#if on}<div class="fb" transition:slide={{ duration: 180 }}>{@render children()}</div>{/if}
</section>

<style>
  .fold{border-top:1px solid rgba(255,255,255,.06)}
  .fh{width:100%;display:flex;align-items:center;gap:8px;background:none;border:0;padding:8px 0 6px;color:var(--mut);font-size:9.5px;letter-spacing:.3em;text-align:left;cursor:pointer}
  .fh i{width:5px;height:5px;background:var(--fc,var(--cy));box-shadow:0 0 6px var(--fc,var(--cy));opacity:.5;transition:opacity .2s}
  .fold.on .fh i{opacity:1}.fh:hover{color:#dff6ff}
  .fh em{font-style:normal;color:var(--cy);letter-spacing:.1em}
  .fh b{margin-left:auto;font-weight:400;color:var(--mut);font-size:13px;letter-spacing:0}
  .fb{padding-bottom:8px}
</style>
