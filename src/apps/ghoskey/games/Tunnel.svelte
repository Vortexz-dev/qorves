<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../../lib/sfx';
  import { settings } from '../../../lib/settings.svelte';
  import Help from './Help.svelte';
  let { diff, signal, ondone }: { diff: number; signal: number; ondone: (ok: boolean) => void } = $props();
  let cv: HTMLCanvasElement | undefined = $state();
  let help = $state(true), started = false, dead = false;
  // difficulty: length, density, rotation, curves, speed variation
  const len = 48 + diff * 18;
  const dens = 0.22 + diff * 0.07;
  const spin = (diff >= 3 ? 0.35 : 0.08) + (diff >= 5 ? 0.25 : 0);
  const curve = 0.15 + diff * 0.08;
  const baseSpd = 11 + diff * 2.2 + (signal < 3 ? 1.5 : 0);
  onMount(() => {
    const c = cv!; const g = c.getContext('2d')!;
    let raf = 0, alive = true, z = 0, spd = baseSpd, t = 0;
    let px = 0, py = 0, tx = 0, ty = 0, rot = 0;
    const obs: { z: number; kind: number; a: number; w: number }[] = [];
    for (let i = 8; i < len - 4; i++) {
      if (Math.random() < dens) obs.push({ z: i, kind: Math.floor(Math.random() * 3), a: Math.random() * Math.PI * 2, w: 0.5 + Math.random() * 0.5 });
    }
    const fit = () => { const r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); c.width = r.width * d; c.height = r.height * d; g.setTransform(d, 0, 0, d, 0, 0); };
    const ro = new ResizeObserver(fit); ro.observe(c); fit();
    const move = (e: PointerEvent) => {
      if (help || dead) return;
      if (!started) { started = true; sfx.glitch(); }
      const r = c.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 1.7;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 1.7;
    };
    c.addEventListener('pointermove', move);
    const tick = () => {
      if (!alive) return;
      const w = c.clientWidth, h = c.clientHeight, cx = w / 2, cy = h / 2;
      const dt = 0.016; t += dt;
      if (started && !dead && !help) {
        const pulse = diff >= 4 ? 1 + Math.sin(t * (0.7 + diff * 0.15)) * (0.18 + (diff >= 5 ? 0.12 : 0)) : 1;
        spd = baseSpd * pulse;
        z += spd * dt;
        rot += spin * dt * (settings.reduceMotion ? 0.3 : 1);
        const wand = Math.sin(z * 0.08) * curve, wandY = Math.cos(z * 0.06) * curve * 0.7;
        px += (tx - px) * 0.18; py += (ty - py) * 0.18;
        // collide
        for (const o of obs) {
          const dz = o.z - z;
          if (dz > 0.15 && dz < 0.85) {
            const ox = Math.cos(o.a + rot) * 0.55, oy = Math.sin(o.a + rot) * 0.55;
            const dx = (px - wand) - ox, dy = (py - wandY) - oy;
            const hit = o.kind === 0 ? Math.hypot(dx, dy) < 0.38 * o.w : o.kind === 1 ? Math.abs(dx) < 0.15 && Math.abs(dy) < 0.7 : Math.abs(dy) < 0.15 && Math.abs(dx) < 0.7;
            if (hit) { dead = true; sfx.lose(); setTimeout(() => ondone(false), 400); }
          }
        }
        if (z >= len) { sfx.granted(); setTimeout(() => ondone(true), 300); alive = false; }
      }
      g.fillStyle = '#02030a'; g.fillRect(0, 0, w, h);
      const wand = Math.sin(z * 0.08) * curve, wandY = Math.cos(z * 0.06) * curve * 0.7;
      // tunnel rings
      for (let i = 24; i >= 0; i--) {
        const zz = ((z + i * 1.2) % 24); const p = 1 / (0.35 + (i * 0.7));
        const R = Math.min(w, h) * 0.42 * p * 3.2;
        g.strokeStyle = `rgba(0,240,255,${0.05 + 0.2 * (1 - i / 24)})`;
        g.lineWidth = 1.2; g.beginPath();
        g.ellipse(cx - wand * 40 * (1 - i / 24), cy - wandY * 40 * (1 - i / 24), R, R * 0.98, rot * 0.2, 0, Math.PI * 2); g.stroke();
        // data ticks
        g.strokeStyle = `rgba(57,255,138,${0.04 + 0.12 * (1 - i / 24)})`;
        for (let k = 0; k < 12; k++) {
          const a = rot + k * Math.PI / 6;
          g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
        }
      }
      // obstacles
      for (const o of obs) {
        const dz = o.z - z; if (dz < 0.05 || dz > 18) continue;
        const p = 1 / (0.3 + dz * 0.22); const R = Math.min(w, h) * 0.4 * p * 2.4;
        const ox = cx + Math.cos(o.a + rot) * R * 0.55 - wand * 30 * p;
        const oy = cy + Math.sin(o.a + rot) * R * 0.55 - wandY * 30 * p;
        g.fillStyle = `rgba(255,42,85,${Math.max(0.25, 1 - dz / 18)})`;
        g.beginPath();
        if (o.kind === 0) g.arc(ox, oy, R * 0.18 * o.w, 0, Math.PI * 2);
        else if (o.kind === 1) g.rect(ox - R * 0.08, oy - R * 0.5, R * 0.16, R);
        else g.rect(ox - R * 0.5, oy - R * 0.08, R, R * 0.16);
        g.fill();
      }
      // packet
      const qx = cx + px * Math.min(w, h) * 0.28, qy = cy + py * Math.min(w, h) * 0.28;
      g.fillStyle = '#fcee0a'; g.shadowColor = '#fcee0a'; g.shadowBlur = 12;
      g.beginPath(); g.arc(qx, qy, 7, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      // progress
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(16, h - 14, w - 32, 4);
      g.fillStyle = '#00f0ff'; g.fillRect(16, h - 14, (Math.min(z, len) / len) * (w - 32), 4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); c.removeEventListener('pointermove', move); };
  });
</script>
{#if help}<Help title="Veri Tüneli" text="Mouse ile sarı paketini yönlendir. İleri sürekli akarsın; geri gidemezsin. Kırmızı engellere değme. Süre yoktur: parkurun sonuna ulaş veya çarp. Zorluk uzunluk, sıklık, dönüş, kıvrım ve hız değişimini belirler." onstart={() => (help = false)} />{/if}
<canvas bind:this={cv}></canvas>
<style>
  canvas{width:100%;height:100%;display:block;background:#02030a;touch-action:none}
</style>
