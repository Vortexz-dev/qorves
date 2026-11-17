<script lang="ts">
  /* Persona arka planı: yavaş akan perspektif ızgara, toz parçacıkları, ara sıra tarama çizgisi. */
  import { onMount } from 'svelte';
  let cv: HTMLCanvasElement;
  onMount(() => {
    const g = cv.getContext('2d')!; let raf = 0, w = 0, h = 0; const dpr = Math.min(devicePixelRatio, 1.5);
    const P = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, s: Math.random() * 6.28 }));
    const fit = () => { w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
    fit(); const ro = new ResizeObserver(fit); ro.observe(cv);
    let sweep = -1, nextSweep = 2;
    const loop = (ms: number) => {
      const t = ms / 1000; g.clearRect(0, 0, w, h);
      // zemin ızgarası (alt yarı, ufka doğru)
      const hz = h * 0.58; g.lineWidth = 1;
      for (let i = 0; i < 18; i++) { const k = ((i + (t * 0.25) % 1) / 18); const y = hz + (h - hz) * k * k; g.strokeStyle = `rgba(255,70,85,${0.025 + k * 0.07})`; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      for (let i = -14; i <= 14; i++) { g.strokeStyle = 'rgba(255,70,85,.05)'; g.beginPath(); g.moveTo(w / 2 + i * 18, hz); g.lineTo(w / 2 + i * w * 0.12, h); g.stroke(); }
      // toz
      for (const p of P) { p.y -= 0.00012 * p.z * 16; if (p.y < 0) { p.y = 1; p.x = Math.random(); } const a = 0.1 + 0.25 * p.z * (0.5 + 0.5 * Math.sin(t * 1.3 + p.s)); g.fillStyle = p.z > 0.75 ? `rgba(94,246,255,${a})` : `rgba(255,93,93,${a * 0.8})`; g.fillRect(p.x * w, p.y * h, p.z * 1.8, p.z * 1.8); }
      // tarama
      if (sweep < 0 && t > nextSweep) { sweep = 0; nextSweep = t + 7 + Math.random() * 6; }
      if (sweep >= 0) { const y = sweep * h; const gr = g.createLinearGradient(0, y - 60, 0, y); gr.addColorStop(0, 'rgba(94,246,255,0)'); gr.addColorStop(1, 'rgba(94,246,255,.06)'); g.fillStyle = gr; g.fillRect(0, y - 60, w, 60); g.fillStyle = 'rgba(94,246,255,.18)'; g.fillRect(0, y, w, 1); sweep += 0.006; if (sweep > 1) sweep = -1; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  });
</script>
<canvas bind:this={cv} class="bg"></canvas>
<div class="vig"></div>
<style>
  .bg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
  .vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,transparent 40%,rgba(0,0,0,.65) 100%),repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0 1px,transparent 1px 3px)}
</style>
