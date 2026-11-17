<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../../lib/sfx';
  import Help from './Help.svelte';
  let { diff, signal, ondone }: { diff: number; signal: number; ondone: (ok: boolean) => void } = $props();
  const SHAPES = ['▣','◈','▲','▼','◆','○','◇','⬠','⬢','△','▽','⬡'];
  const needTok = 2 + (diff >= 3 ? 1 : 0) + (diff >= 5 ? 1 : 0);
  function tok() {
    const n = 2 + (diff >= 4 ? 1 : 0);
    const parts = Array.from({ length: n }, () => SHAPES[Math.floor(Math.random() * SHAPES.length)]);
    const pool = [...parts];
    while (pool.length < n + 3 + diff) pool.push(SHAPES[Math.floor(Math.random() * SHAPES.length)]);
    return { parts, pool: pool.sort(() => Math.random() - 0.5) };
  }
  let queue = $state(Array.from({ length: needTok }, tok));
  let i = $state(0), pick = $state<string[]>([]), help = $state(true), start = $state(false);
  let left = $state(4.5 - diff * 0.3 - (signal < 3 ? 0.5 : 0)), clock = $state(0), iv = 0, noise = $derived(diff >= 4);
  function startT() {
    if (start) return; start = true;
    clock = left;
    iv = setInterval(() => { clock -= 0.1; if (clock <= 0) end(false); }, 100) as unknown as number;
  }
  function choose(s: string) {
    startT();
    if (pick.length >= queue[i].parts.length) return;
    pick = [...pick, s]; sfx.click();
    clock = left;
    if (pick.length === queue[i].parts.length) {
      const ok = pick.every((x, k) => x === queue[i].parts[k]);
      if (!ok) { pick = []; sfx.error(); return; }
      i += 1; pick = []; sfx.granted();
      if (i >= needTok) end(true);
      else clock = left;
    }
  }
  function end(v: boolean) { clearInterval(iv); (v ? sfx.granted : sfx.lose)(); setTimeout(() => ondone(v), 300); }
  onMount(() => () => clearInterval(iv));
</script>
{#if help}<Help title="TOKENINE" text="Üstteki yetki jetonunu, alttaki parçaları sırayla tıklayarak kopyala. Seçimi geri alamazsın. Parçalar arasında süre vardır; seçmezsen başarısız olursun. Süre ilk tıklamada başlar." onstart={() => (help = false)} />{/if}
<div class="g" class:nz={noise}>
  <div class="mono">JETON {i + 1}/{needTok} · {Math.max(0, clock).toFixed(1)}s</div>
  <div class="tgt">{#each queue[i].parts as p}<span>{p}</span>{/each}</div>
  <div class="need mono">{#each queue[i].parts as _, k}<i class:on={k < pick.length}></i>{/each}</div>
  <div class="pool">{#each queue[i].pool as s}<button onclick={() => choose(s)}>{s}</button>{/each}</div>
</div>
<style>
  .g{height:100%;padding:20px;background:#08060a;color:#eee;text-align:center;font-family:var(--f-mono)}
  .tgt{font-size:42px;letter-spacing:.2em;margin:16px 0;color:#fcee0a}
  .need{display:flex;gap:6px;justify-content:center}.need i{width:14px;height:8px;background:#333}.need i.on{background:#39ff8a}
  .pool{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px}
  .pool button{width:56px;height:56px;font-size:22px;background:#111;border:1px solid #39ff8a;color:#9f6}
  .nz{animation:n .12s steps(2) infinite}@keyframes n{50%{filter:hue-rotate(20deg) contrast(1.2)}}
</style>
