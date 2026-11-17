<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from '../../lib/settings.svelte';
  let { dwarf = false, hot = '' }: { dwarf?: boolean; hot?: string } = $props();
  let cv: HTMLCanvasElement | undefined = $state();
  onMount(() => {
    const c = cv!; const g = c.getContext('2d')!;
    let raf = 0, alive = true, t0 = performance.now();
    const fit = () => { const r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); c.width = r.width * d; c.height = r.height * d; g.setTransform(d, 0, 0, d, 0, 0); };
    const ro = new ResizeObserver(fit); ro.observe(c); fit();
    const vein = (w: number, h: number, dwr: boolean) => {
      const cx = w / 2, top = h * 0.08, scale = dwr ? 0.92 : 1;
      const headR = (dwr ? 28 : 24) * (h / 640) * 1.1;
      const hy = top + headR, neck = hy + headR * 0.7;
      const sh = neck + 8, sw = (dwr ? 86 : 70) * scale * (h / 640);
      const hipY = sh + (dwr ? 150 : 200) * (h / 640), hipW = (dwr ? 80 : 58) * (h / 640);
      const foot = h * (dwr ? 0.92 : 0.96);
      const paths: { pts: number[][]; c: string }[] = [];
      const line = (pts: number[][], col: string) => paths.push({ pts, c: col });
      line([[cx, hy + 4], [cx, hipY]], '#ff2a55');
      line([[cx - 8, neck], [cx - sw, sh + 30], [cx - sw - 10, sh + 90], [cx - sw - 4, sh + 140]], '#c0392b');
      line([[cx + 8, neck], [cx + sw, sh + 30], [cx + sw + 10, sh + 90], [cx + sw + 4, sh + 140]], '#c0392b');
      line([[cx - 6, hipY], [cx - hipW * 0.4, hipY + 40], [cx - hipW * 0.35, foot - 20]], '#e74c6f');
      line([[cx + 6, hipY], [cx + hipW * 0.4, hipY + 40], [cx + hipW * 0.35, foot - 20]], '#e74c6f');
      line([[cx, hy], [cx - 10, hy - 4], [cx - 16, hy + 8]], '#7df9ff');
      line([[cx, hy], [cx + 10, hy - 4], [cx + 16, hy + 8]], '#7df9ff');
      line([[cx, neck + 20], [cx - 22, sh + 50], [cx + 4, sh + 80]], '#7df9ff');
      return { cx, top, headR, hy, neck, sh, sw, hipY, hipW, foot, paths, dwr };
    };
    const bodyPath = (P: ReturnType<typeof vein>) => {
      const { cx, hy, headR, neck, sh, sw, hipY, hipW, foot, dwr } = P;
      g.beginPath();
      g.arc(cx, hy, headR, Math.PI, 0);
      g.quadraticCurveTo(cx + headR + 2, neck, cx + sw * 0.55, sh);
      g.quadraticCurveTo(cx + sw + 8, sh + 10, cx + sw, sh + 36);
      g.quadraticCurveTo(cx + sw + 14, sh + 90, cx + sw * 0.85, sh + 150);
      g.lineTo(cx + hipW, hipY);
      g.quadraticCurveTo(cx + hipW + 6, (hipY + foot) / 2, cx + hipW * 0.45, foot);
      g.lineTo(cx + 8, foot);
      g.lineTo(cx, hipY + 10);
      g.lineTo(cx - 8, foot);
      g.lineTo(cx - hipW * 0.45, foot);
      g.quadraticCurveTo(cx - hipW - 6, (hipY + foot) / 2, cx - hipW, hipY);
      g.lineTo(cx - sw * 0.85, sh + 150);
      g.quadraticCurveTo(cx - sw - 14, sh + 90, cx - sw, sh + 36);
      g.quadraticCurveTo(cx - sw - 8, sh + 10, cx - sw * 0.55, sh);
      g.quadraticCurveTo(cx - headR - 2, neck, cx - headR, hy);
      g.closePath();
    };
    const strokeLine = (pts: number[][]) => {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    };
    const at = (pts: number[][], u: number) => {
      let L = 0; const seg: number[] = [];
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]); seg.push(d); L += d; }
      let p = u * L;
      for (let i = 0; i < seg.length; i++) { if (p <= seg[i]) { const k = p / seg[i]; return [pts[i][0] + (pts[i+1][0]-pts[i][0])*k, pts[i][1] + (pts[i+1][1]-pts[i][1])*k]; } p -= seg[i]; }
      return pts[pts.length - 1];
    };
    const tick = (now: number) => {
      if (!alive) return;
      const w = c.clientWidth, h = c.clientHeight, t = (now - t0) / 1000;
      g.clearRect(0, 0, w, h);
      const P = vein(w, h, dwarf);
      // glow plate
      const grd = g.createRadialGradient(P.cx, P.hy + 40, 20, P.cx, h * 0.45, h * 0.55);
      grd.addColorStop(0, 'rgba(0,240,255,0.07)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      // organs (faint)
      g.save(); bodyPath(P); g.clip();
      g.globalAlpha = 0.55;
      g.fillStyle = 'rgba(20, 30, 44, 0.85)'; bodyPath(P); g.fill();
      g.globalAlpha = 0.22;
      g.fillStyle = '#8b2a3a';
      g.beginPath(); g.ellipse(P.cx - 10, P.sh + 55, 16, 22, -0.3, 0, Math.PI * 2); g.ellipse(P.cx + 14, P.sh + 58, 14, 20, 0.3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a2030';
      g.beginPath(); g.ellipse(P.cx, P.sh + 28, 18 + Math.sin(t * 2) * 1.2, 14, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(200,220,240,0.18)'; g.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(P.cx - P.sw * 0.4, P.sh + 20 + i * (P.hipY - P.sh) / 8); g.lineTo(P.cx + P.sw * 0.4, P.sh + 20 + i * (P.hipY - P.sh) / 8); g.stroke(); }
      // veins + blood
      for (const v of P.paths) {
        g.strokeStyle = v.c; g.globalAlpha = 0.45; g.lineWidth = 1.6; g.shadowColor = v.c; g.shadowBlur = 6;
        strokeLine(v.pts); g.stroke();
        if (!settings.reduceMotion) {
          for (let k = 0; k < 3; k++) {
            const u = (t * 0.25 + k / 3 + (v.c === '#7df9ff' ? 0.2 : 0)) % 1;
            const [x, y] = at(v.pts, u);
            g.globalAlpha = 0.85; g.shadowBlur = 10; g.fillStyle = v.c === '#7df9ff' ? '#b8ffff' : '#ff6b8a';
            g.beginPath(); g.arc(x, y, v.c === '#7df9ff' ? 1.8 : 2.2, 0, Math.PI * 2); g.fill();
          }
        }
      }
      // nerve pulse
      if (!settings.reduceMotion && (t % 3.2) < 0.45) {
        const u = ((t % 3.2) / 0.45);
        g.globalAlpha = 1 - u; g.strokeStyle = '#7df9ff'; g.lineWidth = 2; g.shadowColor = '#7df9ff'; g.shadowBlur = 14;
        const n = P.paths.filter((x) => x.c === '#7df9ff');
        for (const v of n) { strokeLine(v.pts); g.stroke(); }
      }
      g.restore();
      // outline
      g.globalAlpha = 0.95; g.shadowBlur = 0;
      g.strokeStyle = hot ? 'rgba(252,238,10,0.85)' : 'rgba(0,240,255,0.75)';
      g.lineWidth = 1.5; bodyPath(P); g.stroke();
      g.globalAlpha = 0.12; g.fillStyle = '#7df9ff'; bodyPath(P); g.fill();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
  });
</script>
<canvas bind:this={cv} class="bd" class:dwarf></canvas>
<style>
  .bd{width:100%;height:100%;display:block;pointer-events:none}
</style>
