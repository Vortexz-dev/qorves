<script lang="ts">
  import { dm, pname } from './store.svelte';
  import { isOnline } from '../../lib/live';
</script>
<label class="pp"><span class="mono">OYUNCU</span>
  <select class="inp" bind:value={dm.pid}>{#each dm.users as u (u.uid)}<option value={u.uid}>{isOnline(dm.pres.find((p) => p.uid === u.uid)) ? '● ' : '○ '}{pname(u.uid)}</option>{/each}</select>
</label>
<style>.pp{display:flex;align-items:center;gap:10px}.pp span{font-size:10.5px;letter-spacing:.2em;color:var(--cy)}.pp select{min-width:260px}</style>
