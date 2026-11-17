<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { sfx } from '../lib/sfx';
  import { watchAtk, resolveAtk, writeLog, randGame, effectiveDiff, gameLabel, type Atk, type GameId } from '../lib/ghoskey';
  import Jumpscare from '../apps/ghoskey/Jumpscare.svelte';
  import Play from '../apps/ghoskey/Play.svelte';
  const u = session.user!;
  let atk = $state<Atk | null>(null), phase = $state<'idle' | 'scare' | 'play' | 'boot' | 'ok'>('idle');
  let game = $state<GameId>('breach'), diff = $state(2);
  let last = 0, lines = $state<string[]>([]);
  function begin(a: Atk) {
    if (a.done || a.uid !== u.uid || a.at <= last || !a.uid) return;
    last = a.at;
    game = (a.game || randGame()) as GameId;
    diff = effectiveDiff(a.diff || 2, 3);
    phase = 'scare'; sfx.alarm();
  }
  async function done(ok: boolean) {
    await writeLog({ uid: u.uid, name: 'Gelen saldırı', game, ok, diff, kind: 'def' }).catch(() => {});
    await resolveAtk(ok).catch(() => {});
    if (ok) { phase = 'ok'; sfx.granted(); setTimeout(() => (phase = 'idle'), 1600); }
    else {
      phase = 'boot';
      lines = [];
      const L = ['QOS · çekirdek kapanıyor', 'oturum duraklatıldı', 'POST …………', 'qorves-os 4.2 yükleniyor', 'masaüstü geri yükleniyor'];
      let i = 0; const iv = setInterval(() => { lines = [...lines, L[i++]]; if (i >= L.length) { clearInterval(iv); setTimeout(() => (phase = 'idle'), 600); } }, 420);
    }
  }
  onMount(() => watchAtk((a) => { atk = a; if (a) begin(a); }));
</script>

{#if phase === 'scare'}<Jumpscare ondone={() => (phase = 'play')} />{/if}
{#if phase === 'play'}<Play {game} {diff} signal={3} ondone={done} />{/if}
{#if phase === 'boot'}
  <div class="boot"><div class="mono">QORVES-OS</div>{#each lines as l}<div class="mono">{l}</div>{/each}</div>
{/if}
{#if phase === 'ok'}
  <div class="ok"><b>SALDIRI SAVUNULDU</b><span class="mono">Kontrol geri alındı · {gameLabel(game)}</span></div>
{/if}

<style>
  .boot,.ok{position:fixed;inset:0;z-index:19000;background:#020308;color:#00f0ff;display:grid;place-content:center;justify-items:center;gap:8px}
  .boot{align-content:center;text-align:left;padding:40px;letter-spacing:.12em}
  .ok b{font-family:var(--f-disp);font-size:32px;color:#39ff8a}.ok span{color:var(--mut)}
</style>
