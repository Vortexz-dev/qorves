<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../../lib/sfx';
  import Help from './Help.svelte';
  let { diff, signal, ondone }: { diff: number; signal: number; ondone: (ok: boolean) => void } = $props();
  const n = 5 + (diff >= 4 ? 1 : 0);
  const home = { x: (n - 1) >> 1, y: (n - 1) >> 1 };
  const infN = 2 + (diff >= 3 ? 1 : 0) + (diff >= 5 ? 1 : 0);
  function spawn() {
    const s: { x: number; y: number; hp: number }[] = [];
    while (s.length < infN) {
      const x = Math.floor(Math.random() * n), y = Math.floor(Math.random() * n);
      if ((x === home.x && y === home.y) || s.some((z) => z.x === x && z.y === y)) continue;
      s.push({ x, y, hp: 3 + Math.floor(diff / 2) });
    }
    return s;
  }
  let pos = $state({ ...home }), inf = $state(spawn()), bat = $state(8), hp = $state(3);
  let help = $state(true), start = $state(false), pulse = $state(0);
  let left = $state(Math.max(20, 40 - diff * 3)), iv = 0, atkT = 0;
  const maxHp = $derived(inf.reduce((a, b) => a + b.hp, 0)); // leftover unused
  function startT() {
    if (start) return; start = true;
    iv = setInterval(() => {
      left -= 0.1; pulse = (pulse + 0.08) % 1;
      atkT += 0.1;
      if (atkT > Math.max(1.2, 2.4 - diff * 0.2)) {
        atkT = 0;
        const standing = inf.some((z) => z.hp > 0 && z.x === pos.x && z.y === pos.y);
        if (!standing && (pos.x !== home.x || pos.y !== home.y)) {
          hp -= 1; sfx.error(); if (hp <= 0) end(false);
        }
      }
      if (left <= 0) { left = 0; end(false); }
    }, 100) as unknown as number;
  }
  function move(dx: number, dy: number) {
    startT();
    pos = { x: Math.max(0, Math.min(n - 1, pos.x + dx)), y: Math.max(0, Math.min(n - 1, pos.y + dy)) };
    sfx.click();
  }
  function act() {
    startT();
    const z = inf.find((k) => k.x === pos.x && k.y === pos.y && k.hp > 0);
    if (z) {
      if (bat <= 0) { sfx.error(); return; }
      bat -= 1; z.hp -= 1; sfx.glitch();
      inf = [...inf];
      if (inf.every((k) => k.hp <= 0)) end(true);
      return;
    }
    if (pos.x === home.x && pos.y === home.y) {
      const ok = Math.abs(pulse - 0.55) < 0.16;
      if (ok) { bat = 8; sfx.granted(); } else sfx.error();
    }
  }
  function key(e: KeyboardEvent) {
    if (help) return;
    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') move(0, -1);
    else if (k === 's' || e.key === 'ArrowDown') move(0, 1);
    else if (k === 'a' || e.key === 'ArrowLeft') move(-1, 0);
    else if (k === 'd' || e.key === 'ArrowRight') move(1, 0);
    else if (e.key === ' ') { act(); e.preventDefault(); }
  }
  function end(v: boolean) { clearInterval(iv); (v ? sfx.granted : sfx.lose)(); setTimeout(() => ondone(v), 300); }
  onMount(() => { addEventListener('keydown', key); return () => { removeEventListener('keydown', key); clearInterval(iv); }; });
</script>
{#if help}<Help title="shiftSEQ" text="WASD ile dolaş. Enfekte (kırmızı) düğümlerin üstünde Boşluk ile vur. Enerji bitince ev düğümüne dön, nabız halkası çerçeveyle örtüşünce Boşluk ile şarj et. Evden uzaktayken gelen saldırı hasar verir. Süre ilk harekette başlar." onstart={() => (help = false)} />{/if}
<div class="g">
  <div class="mono">BAĞ {hp} · BAT {bat} · {Math.ceil(left)}s</div>
  <div class="mx" style:--n={n}>
    {#each Array(n * n) as _, i}
      {@const x = i % n}
      {@const y = (i / n) | 0}
      {@const z = inf.find((k) => k.x === x && k.y === y)}
      <div class="c" class:home={x===home.x&&y===home.y} class:inf={z && z.hp>0} class:me={pos.x===x&&pos.y===y}>
        {#if x===home.x && y===home.y}<i class="pu" style:transform="scale({0.3 + pulse * 1.1})"></i>{/if}
        {#if z && z.hp>0}<b>{z.hp}</b>{/if}
      </div>
    {/each}
  </div>
</div>
<style>
  .g{height:100%;padding:16px;background:#06040c;color:#eee;font-family:var(--f-mono)}
  .mx{display:grid;grid-template-columns:repeat(var(--n),54px);gap:6px;margin-top:12px}
  .c{width:54px;height:54px;border:1px solid #345;display:grid;place-items:center;position:relative;background:#0c0c14}
  .c.home{border-color:#00f0ff}.c.inf{border-color:#ff2a55;background:#2a0a12}.c.me{box-shadow:inset 0 0 0 2px #fcee0a}
  .pu{position:absolute;inset:8px;border:2px solid #00f0ff;border-radius:50%;opacity:.8}
</style>
