<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../../lib/sfx';
  import Help from './Help.svelte';
  let { diff, signal, ondone }: { diff: number; signal: number; ondone: (ok: boolean) => void } = $props();
  const HEX = ['1C', '55', 'BD', 'E9', '7A', 'FF', 'A1', '3D', '09', 'C4'];
  const n = 4 + Math.min(3, diff - 1);
  const bufN = 4 + Math.min(4, diff);
  const seqN = 1 + (diff >= 3 ? 1 : 0) + (diff >= 5 ? 1 : 0);
  const time0 = Math.max(8, 32 - diff * 4 - (signal < 3 ? 4 : 0));
  const cell = () => HEX[Math.floor(Math.random() * (6 + Math.min(4, diff)))];
  const grid = Array.from({ length: n }, () => Array.from({ length: n }, cell));
  const seqs = Array.from({ length: seqN }, (_, i) => Array.from({ length: 2 + (diff > 2 && i === 0 ? 1 : 0) + (diff > 4 ? 1 : 0) }, cell));
  let buf = $state<string[]>([]), axis = $state<'r' | 'c' | ''>(''), lock = $state(-1);
  let left = $state(time0), start = $state(false), help = $state(true), tickI = 0;
  const done = $derived(seqs.map((s) => { const t = buf.join(' '); const n = s.join(' '); return t.includes(n); }));
  function pick(r: number, c: number) {
    if (!start) startT();
    if (axis === 'r' && r !== lock) return;
    if (axis === 'c' && c !== lock) return;
    if (buf.length >= bufN) return;
    buf = [...buf, grid[r][c]]; sfx.click();
    if (axis === '' || axis === 'c') { axis = 'r'; lock = r; } else { axis = 'c'; lock = c; }
    if (seqs.every((_, i) => (buf.join(' ').includes(seqs[i].join(' '))))) { win(true); return; }
    if (buf.length >= bufN) win(seqs.every((_, i) => buf.join(' ').includes(seqs[i].join(' '))));
  }
  function startT() {
    if (start) return; start = true;
    tickI = setInterval(() => { left -= 0.1; if (left <= 0) { left = 0; win(false); } }, 100) as unknown as number;
  }
  function win(ok: boolean) { clearInterval(tickI); (ok ? sfx.granted : sfx.lose)(); setTimeout(() => ondone(ok), 400); }
  onMount(() => () => clearInterval(tickI));
</script>
{#if help}<Help title="İhlal Protokolü" text="Matristen kod seç. İlk seçim bir satırı kilitler, sonraki o satırdaki bir sütunu, sonra o sütundaki bir satırı. Ara bellekte hedef dizileri (sırasıyla) tamamla. Süre ilk tıklamada başlar." onstart={() => (help = false)} />{/if}
<div class="g">
  <div class="mono top">ARA BELLEK {buf.length}/{bufN} · {Math.ceil(left)}s {#if signal < 3}<em>DÜŞÜK SİNYAL</em>{/if}</div>
  <div class="buf">{#each Array(bufN) as _, i}<i>{buf[i] ?? '··'}</i>{/each}</div>
  <div class="seq">{#each seqs as s, i}<div class:ok={done[i]} class="mono">HEDEF {i + 1}: {s.join('  ')} {done[i] ? '✓' : ''}</div>{/each}</div>
  <div class="mx" style:--n={n}>
    {#each grid as row, r}{#each row as v, c}
      <button class:on={(axis==='r'&&r===lock)||(axis==='c'&&c===lock)||axis===''} onclick={() => pick(r, c)}>{v}</button>
    {/each}{/each}
  </div>
</div>
<style>
  .g{position:relative;height:100%;padding:16px;color:#cffff0;background:radial-gradient(#04110c,#020504);font-family:var(--f-mono)}
  .top{letter-spacing:.16em;color:#39ff8a}em{color:#ff2a55;font-style:normal;margin-left:8px}
  .buf{display:flex;gap:6px;margin:8px 0}.buf i{width:40px;height:32px;display:grid;place-items:center;border:1px solid #39ff8a;font-style:normal}
  .seq{margin:8px 0 12px;display:flex;flex-direction:column;gap:4px}.ok{color:#39ff8a}
  .mx{display:grid;grid-template-columns:repeat(var(--n),40px);gap:4px}
  .mx button{width:40px;height:36px;background:none;border:1px solid #163;color:#8fa;font:inherit}.mx button.on{border-color:#39ff8a;color:#fff}.mx button:hover{background:rgba(57,255,138,.12)}
</style>
