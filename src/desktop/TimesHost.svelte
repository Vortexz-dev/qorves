<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { pushToast } from '../ui/SysNotify.svelte';
  import { watchDoc } from '../lib/live';
  import { loadEvents, activeAt, setWorldLive, type EvData } from '../lib/events';
  import type { WorldEvents } from '../lib/backend';
  import { watchNews, fromEvent, type News } from '../lib/times';
  import { openApp } from './wm.svelte';
  const u = session.user!;
  const on = () => { const x = session.user; if (!x) return false; if (x.role === 'dm') return true; return (x.apps ?? []).includes('times') && !(x.lockedApps ?? []).includes('times'); };
  onMount(() => {
    if (!on()) return () => {};
    let known = new Set<string>(), ready = false, evd: EvData | null = null, systems: { id: string; name: string }[] = [];
    let stopE = () => {}, stopN = () => {}, t = 0;
    const toast = (n: News) => { if (!on()) return; pushToast('Qorves Times', n.title, n.body.slice(0, 140), () => openApp('times')); };
    (async () => {
      const data = await fetch(import.meta.env.BASE_URL + 'data/starmap.json').then((r) => r.json()).catch(() => null);
      if (!data) return;
      systems = data.systems; evd = await loadEvents(data.systems, data.lanes);
      const tick = () => {
        if (!evd) return;
        const ev = activeAt(Date.now(), systems);
        for (const e of ev) {
          if (known.has('ev:' + e.key)) continue;
          known.add('ev:' + e.key);
          if (ready) toast(fromEvent(e, evd, (id) => systems.find((s) => s.id === id)?.name ?? id));
        }
      };
      tick(); ready = true;
      t = setInterval(tick, 15000) as unknown as number;
      stopE = watchDoc<WorldEvents>(['world', 'events'], (w) => { setWorldLive(w); tick(); });
      stopN = watchNews((xs) => {
        for (const n of xs) { if (known.has(n.id)) continue; known.add(n.id); if (ready) toast(n); }
      });
    })();
    return () => { clearInterval(t); stopE(); stopN(); };
  });
</script>
