<script lang="ts">
  // Atanmamış oyuncu: "BAĞLANTI YOK" boşta ekranı (efektler yalnız burada).
  import { onMount } from 'svelte';
  let { sub = 'DM seni bir sahneye bağladığında yayın burada açılır.' }: { sub?: string } = $props();
  let cv: HTMLCanvasElement, t = $state('00:00:00');
  onMount(() => {
    const g = cv.getContext('2d')!; let raf = 0, last = 0; const W = 320, H = 180; cv.width = W; cv.height = H; const im = g.createImageData(W, H); const t0 = Date.now();
    const loop = (ts: number) => { raf = requestAnimationFrame(loop); if (ts - last < 50) return; last = ts; const d = im.data;
      for (let i = 0; i < d.length; i += 4) { const v = (Math.random() * 60) | 0; d[i] = v * 0.6; d[i + 1] = v * 0.9; d[i + 2] = v; d[i + 3] = 255; }
      g.putImageData(im, 0, 0); const s = ((Date.now() - t0) / 1000) | 0; t = [s / 3600, (s / 60) % 60, s % 60].map((x) => String(Math.floor(x)).padStart(2, '0')).join(':'); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  });
</script>
<div class="ns">
  <canvas bind:this={cv}></canvas>
  <div class="bars"></div><div class="roll"></div>
  <div class="c">
    <div class="eye"><i></i><b></b></div>
    <h2 data-t="BAĞLANTI YOK">BAĞLANTI YOK</h2>
    <p class="mono">GOD'S EYE · SİNYAL BEKLENİYOR</p>
    <small>{sub}</small>
  </div>
  <div class="hud mono"><span>● KAYIT YOK</span><span>KANAL —</span><span>{t}</span></div>
  <div class="sc"></div>
</div>
<style>
  .ns{position:absolute;inset:0;overflow:hidden;background:#030407;display:grid;place-items:center}
  canvas{position:absolute;inset:0;width:100%;height:100%;opacity:.55;image-rendering:pixelated}
  .bars{position:absolute;inset:auto 0 0 0;height:7%;background:linear-gradient(90deg,#c0c0c0 0 14.28%,#c0c000 0 28.56%,#00c0c0 0 42.84%,#00c000 0 57.12%,#c000c0 0 71.4%,#c00000 0 85.68%,#0000c0 0);opacity:.13}
  .roll{position:absolute;left:0;right:0;height:22%;background:linear-gradient(transparent,rgba(0,240,255,.07),transparent);animation:rl 4.5s linear infinite}
  .sc{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 1px,transparent 1px 3px)}
  .c{position:relative;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px;animation:jt 6s steps(1) infinite}
  .eye{position:relative;width:120px;height:62px;border:2px solid rgba(255,42,85,.7);border-radius:50%/50%;margin-bottom:16px;box-shadow:0 0 30px rgba(255,42,85,.25)}
  .eye i{position:absolute;left:50%;top:50%;width:34px;height:34px;border-radius:50%;border:2px solid var(--rd);transform:translate(-50%,-50%);animation:ir 3s ease-in-out infinite}
  .eye b{position:absolute;left:-14px;right:-14px;top:50%;height:2px;background:var(--rd);transform:rotate(-16deg);box-shadow:0 0 10px var(--rd)}
  h2{position:relative;margin:0;font-family:var(--f-disp);font-size:58px;letter-spacing:.2em;color:#fff;text-shadow:0 0 24px rgba(255,42,85,.6)}
  h2::before,h2::after{content:attr(data-t);position:absolute;inset:0;mix-blend-mode:screen;opacity:.75}
  h2::before{color:var(--rd);clip-path:inset(0 0 55% 0);animation:g1 2.4s steps(1) infinite}
  h2::after{color:var(--cy);clip-path:inset(52% 0 0 0);animation:g2 1.9s steps(1) infinite}
  p{margin:4px 0 0;font-size:12px;letter-spacing:.45em;color:var(--rd)}
  small{color:var(--mut);font-size:14px;margin-top:10px}
  .hud{position:absolute;left:24px;right:24px;top:62px;display:flex;justify-content:space-between;font-size:11px;letter-spacing:.25em;color:rgba(255,255,255,.45)}
  .hud span:first-child{color:var(--rd);animation:bk 1.2s steps(2) infinite}
  @keyframes rl{from{top:-25%}to{top:100%}}
  @keyframes ir{0%,100%{transform:translate(-50%,-50%)}30%{transform:translate(-90%,-50%)}65%{transform:translate(-10%,-50%)}}
  @keyframes g1{0%,86%,100%{transform:translate(3px,0)}88%{transform:translate(-8px,2px)}93%{transform:translate(6px,-1px)}}
  @keyframes g2{0%,80%,100%{transform:translate(-3px,0)}83%{transform:translate(8px,0)}90%{transform:translate(-5px,1px)}}
  @keyframes jt{0%,96%,100%{transform:none}97%{transform:translate(6px,-2px) skewX(8deg)}98.5%{transform:translate(-4px,1px)}}
  @keyframes bk{50%{opacity:.2}}
</style>
