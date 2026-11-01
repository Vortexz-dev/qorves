<script lang="ts">
  // God's Eye: DM hesabıyla açılınca düzenleyici, oyuncuyla açılınca canlı sahne.
  import { session } from '../../lib/session.svelte';
  import DM from './DM.svelte';
  import Player from './Player.svelte';
</script>
{#if session.user?.role === 'dm'}<DM />{:else if session.user}<Player />{/if}
