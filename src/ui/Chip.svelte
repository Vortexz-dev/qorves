<script lang="ts">
  import { getEntry } from '../lib/kb.svelte';
  import { tmeta } from '../lib/types';
  import { openTag } from '../lib/tags.svelte';
  import { sfx } from '../lib/sfx';
  let { id, text = '', nav }: { id: string; text?: string; nav?: (id: string) => void } = $props();
  const e = $derived(getEntry(id));
  const m = $derived(tmeta(e?.type ?? 'item'));
</script>
{#if e}<button class="chip" style:--c={m.color} title={m.label} onmouseenter={() => sfx.hover()} onclick={(ev) => { ev.stopPropagation(); (nav ?? openTag)(id); }}>{text || e.name}</button>{:else}{text}{/if}
<style>
  .chip{display:inline;font:inherit;color:var(--c);background:color-mix(in srgb,var(--c) 10%,transparent);border:0;border-bottom:1px solid color-mix(in srgb,var(--c) 55%,transparent);
    padding:0 3px;margin:0 1px;line-height:inherit;transition:background .15s,box-shadow .15s}
  .chip:hover{background:color-mix(in srgb,var(--c) 24%,transparent);box-shadow:0 0 10px color-mix(in srgb,var(--c) 40%,transparent)}
</style>
