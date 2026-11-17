<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../../lib/sfx';
  import Help from './Help.svelte';
  let { diff, signal, ondone }: { diff: number; signal: number; ondone: (ok: boolean) => void } = $props();
  type Row = { l: boolean; r: boolean };
  const hide = diff >= 4;
  const need = 12 + diff * 3;
  function row(): Row {
    const t = Math.random();
    if (t < 0.28) return { l: true, r: true };
    if (t < 0.64) return { l: true, r: false };
    return { l: false, r: true };
  }
  let rows = $state<Row[]>(Array.from({ length: 8 }, row));
  let prog = $state(0), help = $state(true), start = $state(false);
  let left = $state(Math.max(12, 28 - diff * 2 - (signal < 3 ? 3 : 0))), iv = 0;
  const prompt = $derived(!hide && rows[0] ? (rows[0].l && rows[0].r ? 'SPACE' : rows[0].l ? 'A / ←' : 'D / →') : '');
  function startT() { if (start) return; start = true; iv = setInterval(() => { left -= 0.1; if (left <= 0) { left = 0; end(false); } }, 100) as unknown as number; }
  function hit(k: 'L' | 'R' | 'B') {
    startT();
    const r = rows[0];
    const ok = (k === 'B' && r.l && r.r) || (k === 'L' && r.l && !r.r) || (k === 'R' && r.r && !r.l);
    if (ok) { prog = Math.min(need, prog + 1); sfx.click(); if (prog >= need) end(true); }
    else { prog = Math.max(0, prog - (diff >= 4 ? 3 : 1)); sfx.error(); }
    rows = [...rows.slice(1), row()];
  }
  function key(e: KeyboardEvent) {
    if (help) return;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { hit('L'); e.preventDefault(); }
    else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') { hit('R'); e.preventDefault(); }
    else if (e.key === ' ') { hit('B'); e.preventDefault(); }
  }
  function end(v: boolean) { clearInterval(iv); (v ? sfx.granted : sfx.lose)(); setTimeout(() => ondone(v), 300); }
  onMount(() => { addEventListener('keydown', key); return () => { removeEventListener('keydown', key); clearInterval(iv); }; });
</script>
{#if help}<Help title="memDEALLOCATER" text="Bellek bloğunu aşağıdan yukarı oku. Sol yeşil: A veya Sol. Sağ yeşil: D veya Sağ. İkisi de yeşil: Boşluk. Kırmızıdan kaçın. Süre ilk tuşa basınca başlar." onstart={() => (help = false)} />{/if}
<div class="g">
  <div class="bar"><i style:width="{(prog / need) * 100}%"></i></div>
  <div class="mono">{Math.ceil(left)}s · {prog}/{need} {#if prompt}· {prompt}{/if}</div>
  <div class="stack">
    {#each [...rows].reverse() as r, i}
      <div class="rw"><b class:g={r.l}></b><b class:g={r.r}></b></div>
    {/each}
  </div>
</div>
<style>
  .g{height:100%;padding:16px;background:#0a0610;color:#eee;font-family:var(--f-mono)}
  .bar{height:8px;background:#222;margin-bottom:8px}.bar i{display:block;height:100%;background:#39ff8a}
  .stack{margin-top:10px;display:flex;flex-direction:column;gap:3px;width:240px}
  .rw{display:grid;grid-template-columns:1fr 1fr;gap:4px;height:22px}
  .rw b{background:#5a1020}.rw b.g{background:#1e8f4a}
</style>
