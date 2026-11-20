<script lang="ts">
  /* CROWN CLASH düello davetleri: oyun kapalıyken (ya da simge durumundayken) masaüstü bildirimi; tıklayınca oyunu açar ve daveti kabul eder. */
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { wm, openApp } from './wm.svelte';
  import { pushToast } from '../ui/SysNotify.svelte';
  import { watchInvites } from '../apps/clash/invites';
  import { crownLink } from '../apps/clash/link.svelte';
  import { sfx } from '../lib/sfx';
  const u = session.user!;
  const seen = new Set<string>();
  onMount(() => watchInvites(u.uid, (list) => {
    for (const d of list) {
      if (seen.has(d.id)) continue; seen.add(d.id);
      if (wm.core === 'clash' && !wm.coreMin) continue; // oyun açık: oyun içi davet kartı gösterilir
      sfx.ping();
      pushToast('CROWN CLASH', `${d.fromName} seni düelloya davet etti`, 'Kabul etmek için tıkla · 2 dakika geçerli', () => { crownLink.duel = d.id; openApp('clash'); });
    }
  }));
</script>
