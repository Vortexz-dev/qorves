<script lang="ts">
  // Metindeki etiket adlarını otomatik bağlar (yalnız görebildiğin etiketler).
  import { linkify, kb } from '../lib/kb.svelte';
  import Chip from './Chip.svelte';
  let { text, self, nav }: { text: string; self?: string; nav?: (id: string) => void } = $props();
  const parts = $derived(kb.ready ? linkify(text, self) : [text]);
</script>
{#each parts as p}{#if typeof p === 'string'}{p}{:else}<Chip id={p.id} text={p.text} {nav} />{/if}{/each}
