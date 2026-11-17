<script lang="ts">
  import type { GameId } from '../../lib/ghoskey';
  import Breach from './games/Breach.svelte';
  import Circuit from './games/Circuit.svelte';
  import Kernel from './games/Kernel.svelte';
  import Memde from './games/Memde.svelte';
  import Shift from './games/Shift.svelte';
  import Tokenine from './games/Tokenine.svelte';
  import Tunnel from './games/Tunnel.svelte';
  let { game, diff, signal, ondone }: { game: GameId; diff: number; signal: number; ondone: (ok: boolean) => void } = $props();
</script>
<div class="pl">
  {#if game === 'breach'}<Breach {diff} {signal} {ondone} />
  {:else if game === 'circuit'}<Circuit {diff} {signal} {ondone} />
  {:else if game === 'kernel'}<Kernel {diff} {signal} {ondone} />
  {:else if game === 'memde'}<Memde {diff} {signal} {ondone} />
  {:else if game === 'shift'}<Shift {diff} {signal} {ondone} />
  {:else if game === 'token'}<Tokenine {diff} {signal} {ondone} />
  {:else}<Tunnel {diff} {signal} {ondone} />{/if}
</div>
<style>
  .pl{position:absolute;inset:0;z-index:8;background:#020308}
</style>
