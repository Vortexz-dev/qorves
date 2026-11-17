<script lang="ts">
  /* DM'in gönderdiği saldırı: tam ekran uygulama açık olsa bile en üst katmanda açılır. */
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { watchAtk, resolveAtk, writeLog, randGame, effectiveDiff, type Atk, type GameId } from '../lib/ghoskey';
  import { preloadLaugh } from '../apps/hack/hsfx';
  import HackStage from '../apps/hack/HackStage.svelte';
  const u = session.user!;
  let on = $state(false), scare = $state(true), game = $state<GameId>('breach'), diff = $state(2), sig = $state(3);
  let last = Number(sessionStorage.getItem('qv.atk.last') || 0);
  function begin(a: Atk) {
    if (on || a.done || !a.uid || a.uid !== u.uid || a.at <= last) return;
    if (Date.now() - a.at > 5 * 60_000) return; // eski kayıt: oturum açılışında tekrar oynatma
    last = a.at; sessionStorage.setItem('qv.atk.last', String(a.at));
    game = (a.game || randGame()) as GameId;
    sig = Math.max(1, Math.min(5, (a as Atk & { signal?: number }).signal ?? 3));
    diff = effectiveDiff(a.diff || 2, sig);
    on = true;
  }
  async function done(ok: boolean) {
    on = false;
    await writeLog({ uid: u.uid, name: 'Gelen saldırı', game, ok, diff, kind: 'def' }).catch(() => {});
    await resolveAtk(ok).catch(() => {});
  }
  onMount(() => {
    setTimeout(() => preloadLaugh(), 4000);
    // yerel test kancası (yalnız localhost): window.__qvHack('breach', 3, 3, false)
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) (window as unknown as Record<string, unknown>).__qvHack = (g: GameId, d = 3, s = 3, sc = false) => { if (!g) { on = false; return; } game = g; diff = d; sig = s; scare = sc; on = true; };
    return watchAtk((a) => { if (a) { scare = true; begin(a); } });
  });
</script>

{#if on}<HackStage {game} {diff} signal={sig} mode="in" {scare} ondone={done} />{/if}
