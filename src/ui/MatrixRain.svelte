<script lang="ts">
  // Üç katmanlı, bulanık matrix yağmuru. ~24 fps'e kısılı; sekme gizlenince/bileşen kapanınca durur.
  import { onMount } from 'svelte';
  import { settings } from '../lib/settings.svelte';
  const L = [{ fs: 11, sp: 0.35, blur: 3.2, a: 0.35 }, { fs: 15, sp: 0.6, blur: 1.4, a: 0.5 }, { fs: 21, sp: 0.95, blur: 0, a: 0.6 }];
  const CH = 'QORVES0123456789ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟΣΔΩΨ§¤#@*+<>/\\'.split('');
  let cv: HTMLCanvasElement[] = $state([]);
  onMount(() => {
    let raf = 0, last = 0, w = 0, h = 0;
    const st = L.map(() => ({ drops: [] as number[], ctx: null as CanvasRenderingContext2D | null }));
    const resize = () => {
      w = innerWidth; h = innerHeight;
      cv.forEach((c, i) => { c.width = w; c.height = h; const x = c.getContext('2d')!; st[i].ctx = x; x.font = `${L[i].fs}px "Share Tech Mono",monospace`;
        st[i].drops = Array.from({ length: Math.ceil(w / L[i].fs) }, () => Math.random() * -h / L[i].fs); });
    };
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 42) return; last = t;
      st.forEach((s, i) => {
        const x = s.ctx!, fs = L[i].fs;
        x.fillStyle = 'rgba(4,5,10,0.16)'; x.fillRect(0, 0, w, h);
        for (let c = 0; c < s.drops.length; c++) {
          const y = s.drops[c] * fs;
          if (y > 0) { x.fillStyle = Math.random() < 0.04 ? '#fcee0a' : i === 2 ? '#7ff8ff' : '#00c8d8'; x.fillText(CH[(Math.random() * CH.length) | 0], c * fs, y); }
          s.drops[c] += L[i].sp * (0.6 + ((c * 7919) % 10) / 20);
          if (y > h && Math.random() > 0.975) s.drops[c] = Math.random() * -20;
        }
      });
    };
    const run = () => { cancelAnimationFrame(raf); if (!document.hidden && !settings.reduceMotion) raf = requestAnimationFrame(frame); };
    resize(); run();
    addEventListener('resize', resize); document.addEventListener('visibilitychange', run);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', run); };
  });
</script>
<div class="mr" aria-hidden="true">
  {#each L as l, i}<canvas bind:this={cv[i]} style:filter={l.blur ? `blur(${l.blur}px)` : ''} style:opacity={l.a}></canvas>{/each}
</div>
<style>.mr{position:absolute;inset:0;overflow:hidden;background:#04050a}canvas{position:absolute;inset:0;width:100%;height:100%}</style>
