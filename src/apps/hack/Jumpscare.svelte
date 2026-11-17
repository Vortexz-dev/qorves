<script lang="ts">
  /* Kuru kafa jumpscare: bozuk mekanik kahkaha, çene takırdar, ağız açılıp ekranı yutar, kesme → hack. */
  import { onMount } from 'svelte';
  import { laugh, preloadLaugh, noise, tone } from './hsfx';
  import { settings } from '../../lib/settings.svelte';
  let { ondone }: { ondone: () => void } = $props();
  let cv: HTMLCanvasElement | undefined = $state();
  let txt = $state('');
  const base = import.meta.env.BASE_URL + 'img/hack/';
  const load = (s: string) => new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = base + s; });
  function tint(img: HTMLImageElement, col: string) {
    const c = document.createElement('canvas'); c.width = img.naturalWidth || 1; c.height = img.naturalHeight || 1; const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0); return c;
  }
  onMount(() => {
    let raf = 0, dead = false; const T = settings.reduceMotion ? 0.6 : 1;
    const stopLaugh = laugh(1.0);
    noise(0.25, 0.45, 3000, 0.4, 'highpass');
    (async () => {
      await preloadLaugh();
      const [top, jaw] = await Promise.all([load('skull-top.webp'), load('skull-jaw.webp')]);
      if (dead || !cv) return;
      const tr = tint(top, '#ff2040'), tc = tint(top, '#20fff0'), jr = tint(jaw, '#ff2040'), jc = tint(jaw, '#20fff0');
      const ctx = cv.getContext('2d')!;
      const t0 = performance.now();
      const D = 2.7 * T;
      const frame = (now: number) => {
        if (dead) return;
        const W = (cv!.width = innerWidth), Hh = (cv!.height = innerHeight);
        const t = (now - t0) / 1000;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, Hh);
        const S0 = Math.min(W, Hh) * 0.95; // kafa boyu
        // faz: 0-1.55 kahkaha / takırtı, 1.55-2.35 ağız açılır + zoom, sonrası karanlık
        const laughP = Math.min(1, t / (1.55 * T));
        const openP = Math.max(0, Math.min(1, (t - 1.55 * T) / (0.8 * T)));
        const chatter = t < 1.55 * T ? Math.max(0, Math.sin(t * Math.PI * 2 * 6.5)) * (0.05 + laughP * 0.11) : 0;
        const gapF = chatter + openP * openP * 0.62; // çene açıklığı (kafa boyuna oran)
        let scale = 0.62 + (1 - Math.pow(1 - laughP, 3)) * 0.5 + Math.pow(openP, 2.6) * 14;
        const shake = (t < 1.55 * T ? 6 + laughP * 14 : 22) * (Math.random() - 0.5);
        const sz = S0 * scale; const mouthY = 0.745; // ağız çizgisi (görsel yüksekliğine oran)
        const gapPx = gapF * sz;
        // odak: ağız merkezi ekran merkezine kayar
        const cx = W / 2 + shake, cy = Hh / 2 + shake * 0.6 - (mouthY - 0.5) * sz * Math.min(1, openP * 1.6) - gapPx * 0.5 * Math.min(1, openP * 2);
        const x = cx - sz / 2, y = cy - sz / 2;
        // ağız içi: kırmızı-siyah boğaz + yeşil iç ışık
        if (gapPx > 2) {
          const my = y + sz * mouthY; const g = ctx.createRadialGradient(cx, my + gapPx / 2, 2, cx, my + gapPx / 2, sz * 0.32 + gapPx);
          g.addColorStop(0, '#000'); g.addColorStop(0.55, '#040805'); g.addColorStop(0.85, 'rgba(60,255,90,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, my + gapPx / 2, sz * 0.27, gapPx / 2 + sz * 0.05, 0, 0, Math.PI * 2); ctx.fill();
          // menteşe kabloları
          ctx.strokeStyle = 'rgba(120,255,140,.55)'; ctx.lineWidth = Math.max(1, sz * 0.006);
          for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * sz * 0.22, my - sz * 0.02); ctx.bezierCurveTo(cx + s * sz * 0.26, my + gapPx * 0.3, cx + s * sz * 0.25, my + gapPx * 0.7, cx + s * sz * 0.2, my + gapPx + sz * 0.02); ctx.stroke(); }
        }
        const glitch = Math.random() < 0.35 || t < 0.12;
        const off = glitch ? (6 + Math.random() * 18) * (1 + openP * 3) : 2;
        // RGB ayrışması
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55; ctx.drawImage(tr, x - off, y, sz, sz); ctx.drawImage(jr, x - off, y + gapPx, sz, sz);
        ctx.drawImage(tc, x + off, y, sz, sz); ctx.drawImage(jc, x + off, y + gapPx, sz, sz);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.drawImage(jaw, x, y + gapPx, sz, sz); ctx.drawImage(top, x, y, sz, sz);
        // göz parlaması
        const eye = 0.5 + 0.5 * Math.sin(t * 40) * laughP;
        for (const ex of [0.38, 0.635]) { const gx = x + sz * ex, gy = y + sz * 0.42; const g2 = ctx.createRadialGradient(gx, gy, 0, gx, gy, sz * 0.09); g2.addColorStop(0, `rgba(255,40,40,${0.6 * eye})`); g2.addColorStop(0.4, `rgba(80,255,80,${0.35 * eye})`); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(gx - sz * 0.1, gy - sz * 0.1, sz * 0.2, sz * 0.2); }
        // yatay dilim kaydırma
        const slices = glitch ? 3 + Math.floor(Math.random() * 6) : 0;
        for (let i = 0; i < slices; i++) { const sy = Math.random() * Hh, sh = 4 + Math.random() * 40, dx = (Math.random() - 0.5) * 80 * (1 + openP * 2); ctx.drawImage(cv!, 0, sy, W, sh, dx, sy, W, sh); }
        // tarama çizgileri + kırmızı flaş
        ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let yy = 0; yy < Hh; yy += 3) ctx.fillRect(0, yy, W, 1);
        if (Math.random() < 0.08 + laughP * 0.1 && openP < 0.9) { ctx.fillStyle = 'rgba(255,0,40,.18)'; ctx.fillRect(0, 0, W, Hh); }
        if (openP > 0.82) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (openP - 0.82) / 0.18)})`; ctx.fillRect(0, 0, W, Hh); }
        txt = t > 0.3 * T && t < 1.55 * T && Math.random() < 0.3 ? ['SİSTEM ELE GEÇİRİLDİ', 'ERİŞİM: ROOT', 'İZİN YOK', 'GHOST.IN.SHELL', 'H̸A̸ H̸A̸ H̸A̸'][Math.floor(Math.random() * 5)]! : t > 0.3 * T && t < 1.55 * T ? txt : '';
        if (t < D) raf = requestAnimationFrame(frame);
        else { stopLaugh(); tone(40, 0.4, 'sine', 0.3, -10); ondone(); }
      };
      raf = requestAnimationFrame(frame);
    })();
    return () => { dead = true; cancelAnimationFrame(raf); stopLaugh(); };
  });
</script>
<div class="js" role="img" aria-label="Sızma: kuru kafa"><canvas bind:this={cv}></canvas>{#if txt}<b class="mono">{txt}</b>{/if}</div>
<style>
  .js{position:fixed;inset:0;z-index:2;background:#000;cursor:none}
  canvas{position:absolute;inset:0;width:100%;height:100%}
  b{position:absolute;left:50%;top:8%;transform:translateX(-50%);color:#5cff7a;font-size:clamp(18px,3vw,34px);letter-spacing:.3em;text-shadow:3px 0 #ff2040,-3px 0 #20fff0;white-space:nowrap}
</style>
