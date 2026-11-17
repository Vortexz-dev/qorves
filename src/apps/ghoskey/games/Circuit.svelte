<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../../lib/sfx';
  import Help from './Help.svelte';
  let { diff, signal, ondone }: { diff: number; signal: number; ondone: (ok: boolean) => void } = $props();
  const n = 5 + Math.min(4, diff - 1);
  // 0 empty, 1 I-vert, 2 I-hor, 3 L, 4 T, 5 +  — each has rot 0-3
  type Tile = { k: number; r: number };
  const kinds = [1, 2, 3, 3, 4, 5];
  const grid = $state<Tile[][]>(Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => {
    if ((x === 0 && y === 1) || (x === n - 1 && y === n - 2)) return { k: 2, r: 0 };
    return { k: kinds[Math.floor(Math.random() * kinds.length)], r: Math.floor(Math.random() * 4) };
  })));
  const open = (t: Tile): [boolean, boolean, boolean, boolean] => {
    const [N, E, S, W] = [0, 1, 2, 3];
    let m = [false, false, false, false];
    if (t.k === 1) m = [true, false, true, false];
    if (t.k === 2) m = [false, true, false, true];
    if (t.k === 3) m = [true, true, false, false];
    if (t.k === 4) m = [true, true, false, true];
    if (t.k === 5) m = [true, true, true, true];
    const o = [false, false, false, false];
    for (let i = 0; i < 4; i++) o[(i + t.r) % 4] = m[i];
    return o as [boolean, boolean, boolean, boolean];
  };
  function flow() {
    const seen = new Set<string>();
    const q: [number, number][] = [[0, 1]];
    while (q.length) {
      const [x, y] = q.pop()!;
      const k = x + ',' + y; if (seen.has(k)) continue; seen.add(k);
      const o = open(grid[y][x]);
      const nb: [number, number, number, number][] = [[x, y - 1, 0, 2], [x + 1, y, 1, 3], [x, y + 1, 2, 0], [x - 1, y, 3, 1]];
      for (const [nx, ny, a, b] of nb) {
        if (!o[a] || ny < 0 || ny >= n || nx < 0 || nx >= n) continue;
        if (open(grid[ny][nx])[b]) q.push([nx, ny]);
      }
    }
    return seen.has((n - 1) + ',' + (n - 2));
  }
  let ok = $derived(flow());
  let help = $state(true), start = $state(false), left = $state(Math.max(12, 50 - diff * 6 - (signal < 3 ? 6 : 0))), iv = 0;
  function rot(x: number, y: number) {
    if (!start) { start = true; iv = setInterval(() => { left -= 0.1; if (left <= 0) { left = 0; end(false); } }, 100) as unknown as number; }
    grid[y][x] = { ...grid[y][x], r: (grid[y][x].r + 1) % 4 }; sfx.click();
    if (flow()) end(true);
  }
  function end(v: boolean) { clearInterval(iv); (v ? sfx.granted : sfx.lose)(); setTimeout(() => ondone(v), 350); }
  onMount(() => () => clearInterval(iv));
</script>
{#if help}<Help title="Devre Akışı" text="Kiremitleri tıklayarak döndür. Sol girişten sağ çıkışa kesintisiz bir enerji hattı kur. Süre ilk döndürmede başlar." onstart={() => (help = false)} />{/if}
<div class="g">
  <div class="mono">DEVRE · {Math.ceil(left)}s {#if ok}· BAĞLANDI{/if}</div>
  <div class="mx" style:--n={n}>
    {#each grid as row, y}{#each row as t, x}
      <button onclick={() => rot(x, y)} class:src={x===0&&y===1} class:dst={x===n-1&&y===n-2} class:k={t.k}>
        <i style:transform="rotate({t.r * 90}deg)" class="t{t.k}"></i>
      </button>
    {/each}{/each}
  </div>
</div>
<style>
  .g{height:100%;padding:16px;background:#07060e;color:#dfe;font-family:var(--f-mono)}
  .mx{display:grid;grid-template-columns:repeat(var(--n),36px);gap:3px;margin-top:10px}
  button{width:36px;height:36px;background:#101018;border:1px solid #334;position:relative;padding:0}
  button.src{outline:2px solid #39ff8a}button.dst{outline:2px solid #fcee0a}
  i{position:absolute;inset:4px;display:block}
  .t1{background:linear-gradient(#0000 0 40%,#00f0ff 40% 60%,#0000 60%)}
  .t2{background:linear-gradient(90deg,#0000 0 40%,#00f0ff 40% 60%,#0000 60%)}
  .t3{background:
    linear-gradient(#0000 0 40%,#00f0ff 40% 60%,#0000 60% 100%),
    linear-gradient(90deg,#0000 0 40%,#00f0ff 40% 60%,#0000 60% 50%); background-repeat:no-repeat; background-size:100% 50%, 50% 100%; background-position:0 0, 50% 0}
  .t4,.t5{background:
    linear-gradient(#0000 0 40%,#00f0ff 40% 60%,#0000 60%),
    linear-gradient(90deg,#0000 0 40%,#00f0ff 40% 60%,#0000 60%)}
</style>
