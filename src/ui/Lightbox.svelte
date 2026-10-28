<script lang="ts">
  // Site geneli görsel görüntüleyici: glitch açılış, tekerlekle yakınlaştırma, sürükleyerek kaydırma, masaüstüne kaydetme.
  import { onMount } from 'svelte';
  import { lightbox, openImage, closeImage, refOf } from '../lib/lightbox.svelte';
  import { saveImage, desk } from '../lib/desk.svelte';
  import { session } from '../lib/session.svelte';
  import { sfx } from '../lib/sfx';
  let z = $state(1), px = $state(0), py = $state(0), drag = false, sx = 0, sy = 0, closing = $state(false), nat = $state({ w: 0, h: 0 });
  const ref = $derived(lightbox.open ? refOf(lightbox.src) : null);
  const canSave = $derived(!!ref && session.stage === 'desktop' && !!session.user);
  $effect(() => { if (lightbox.open) { z = 1; px = 0; py = 0; closing = false; sfx.glitch(); } });
  function close() { if (closing) return; closing = true; sfx.close(); setTimeout(() => { closeImage(); closing = false; }, 260); }
  function zoomAt(f: number, cx = innerWidth / 2, cy = innerHeight / 2) {
    const nz = Math.min(8, Math.max(1, z * f)); const k = nz / z;
    px = (px - (cx - innerWidth / 2)) * k + (cx - innerWidth / 2); py = (py - (cy - innerHeight / 2)) * k + (cy - innerHeight / 2); z = nz; if (z === 1) { px = 0; py = 0; }
  }
  const wheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY); };
  const down = (e: PointerEvent) => { if (e.button) return; drag = true; sx = e.clientX - px; sy = e.clientY - py; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => { if (drag && z > 1) { px = e.clientX - sx; py = e.clientY - sy; } };
  async function save() { if (!ref) return; sfx.granted(); await saveImage(ref, lightbox.name || decodeURIComponent(ref.split('/').pop() ?? 'Görsel').replace(/\.\w+$/, '')); }
  onMount(() => {
    // Sitedeki her görsel tıklanınca büyür (simgeler ve küçük avatarlar hariç).
    const click = (e: MouseEvent) => {
      const img = (e.target as HTMLElement)?.closest?.('img') as HTMLImageElement | null;
      if (!img || img.closest('[data-nolb],.lbx') || session.stage !== 'desktop') return;
      const r = img.getBoundingClientRect(); if (r.width < 56 && r.height < 56) return;
      e.preventDefault(); e.stopPropagation();
      const name = img.alt || img.closest('[data-name]')?.getAttribute('data-name') || '';
      openImage(img.currentSrc || img.src, name);
    };
    const key = (e: KeyboardEvent) => { if (!lightbox.open) return;
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); }
      else if (e.key === '+' || e.key === '=') zoomAt(1.25); else if (e.key === '-') zoomAt(0.8); };
    document.addEventListener('click', click, true); addEventListener('keydown', key, true);
    return () => { document.removeEventListener('click', click, true); removeEventListener('keydown', key, true); };
  });
</script>

{#if lightbox.open}
  <div class="lbx" class:closing role="dialog" aria-label="Görsel" onwheel={wheel}>
    <div class="bg" role="presentation" onclick={close}></div>
    <div class="scan"></div>
    <div class="stage" role="presentation" onpointerdown={down} onpointermove={move} onpointerup={() => (drag = false)} ondblclick={(e) => zoomAt(z > 1.5 ? 1 / z : 2.5, e.clientX, e.clientY)} style:cursor={z > 1 ? 'grab' : 'zoom-in'}>
      <div class="frame" style:transform="translate({px}px,{py}px) scale({z})">
        <img src={lightbox.src} alt={lightbox.name} draggable="false" style:width={nat.w ? Math.round(Math.min(innerWidth - 80, ((innerHeight - 130) * nat.w) / nat.h, nat.w * 2.4)) + 'px' : null} onload={(e) => (nat = { w: (e.currentTarget as HTMLImageElement).naturalWidth, h: (e.currentTarget as HTMLImageElement).naturalHeight })} />
        <i class="r"></i><i class="c"></i>
      </div>
    </div>
    <header class="mono"><span class="t">GÖRÜNTÜ · {(lightbox.name || 'ADSIZ').toLocaleUpperCase('tr')}</span><span class="m">{nat.w}×{nat.h} · {Math.round(z * 100)}%</span></header>
    <div class="bar mono">
      <button onclick={() => zoomAt(1 / 1.4)} aria-label="Uzaklaştır">−</button>
      <button onclick={() => { z = 1; px = 0; py = 0; }}>SIĞDIR</button>
      <button onclick={() => zoomAt(1.4)} aria-label="Yakınlaştır">+</button>
      <span class="sep"></span>
      <button class="sv" disabled={!canSave} title={canSave ? '' : 'Simülasyon görüntüleri kaydedilemez'} onclick={save}>⤓ MASAÜSTÜNE KAYDET</button>
      <button class="x" onclick={close}>KAPAT · ESC</button>
    </div>
    {#if desk.toast}<div class="toast mono">{desk.toast}</div>{/if}
  </div>
{/if}

<style>
  .lbx{position:fixed;inset:0;z-index:20000;overflow:hidden;animation:lin .5s steps(1) both}
  .bg{position:absolute;inset:0;background:rgba(2,3,8,.9);backdrop-filter:blur(4px);animation:bgi .35s both}
  @keyframes bgi{from{opacity:0}}
  .scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(transparent 0 2px,rgba(0,240,255,.035) 2px 3px);z-index:2}
  .stage{position:absolute;inset:60px 40px 70px;display:grid;place-items:center;touch-action:none}
  .frame{position:relative;transition:transform .08s;will-change:transform;animation:gopen .55s cubic-bezier(.2,.9,.2,1) both}
  .frame img{display:block;height:auto;image-rendering:auto;max-width:calc(100vw - 80px);max-height:calc(100vh - 130px);border:1px solid rgba(0,240,255,.55);box-shadow:0 0 50px rgba(0,240,255,.2),0 0 0 1px #000;user-select:none}
  .frame i{position:absolute;inset:0;pointer-events:none;background:inherit;mix-blend-mode:screen;opacity:0}
  .frame .r{box-shadow:inset 0 0 0 2px rgba(255,42,85,.7);animation:rgb .55s both}.frame .c{box-shadow:inset 0 0 0 2px rgba(0,240,255,.7);animation:rgb2 .55s both}
  @keyframes gopen{0%{clip-path:inset(49% 0 49% 0);filter:brightness(3) saturate(0)}18%{clip-path:inset(30% 0 52% 0);transform:translateX(-18px) skewX(8deg)}
    32%{clip-path:inset(8% 0 60% 0);transform:translateX(12px)}46%{clip-path:inset(0 0 0 0);filter:hue-rotate(80deg) brightness(1.5)}
    60%{clip-path:inset(40% 0 20% 0);transform:translateX(-6px)}72%{clip-path:inset(0);filter:none;transform:none}100%{clip-path:inset(0)}}
  @keyframes rgb{0%,70%{opacity:1;transform:translate(-8px,2px)}100%{opacity:0;transform:none}}
  @keyframes rgb2{0%,70%{opacity:1;transform:translate(8px,-2px)}100%{opacity:0;transform:none}}
  header{position:absolute;left:0;right:0;top:0;height:46px;display:flex;align-items:center;gap:16px;padding:0 24px;z-index:3;font-size:11px;letter-spacing:.28em;color:var(--cy);
    background:linear-gradient(rgba(4,5,10,.9),transparent);animation:hd .4s .2s both}
  header .m{margin-left:auto;color:var(--mut);letter-spacing:.15em}
  @keyframes hd{from{opacity:0;transform:translateY(-12px)}}
  .bar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:6px;align-items:center;z-index:3;padding:6px;background:rgba(5,8,14,.92);border:1px solid rgba(0,240,255,.35);animation:bi .4s .25s both}
  @keyframes bi{from{opacity:0;transform:translate(-50%,14px)}}
  .bar button{background:none;border:1px solid var(--line);color:var(--cy);font-family:var(--f-mono);font-size:11px;letter-spacing:.18em;padding:7px 12px;min-width:38px}
  .bar button:hover:not(:disabled){border-color:var(--cy);background:rgba(0,240,255,.1)}
  .bar .sv{color:var(--ye);border-color:rgba(252,238,10,.5)}.bar .sv:disabled{opacity:.35;cursor:not-allowed}
  .bar .x{color:var(--rd);border-color:rgba(255,42,85,.5)}.sep{width:1px;height:22px;background:var(--line);margin:0 4px}
  .toast{position:absolute;left:50%;bottom:76px;transform:translateX(-50%);z-index:4;font-size:11px;letter-spacing:.2em;color:#000;background:var(--ye);padding:7px 14px;animation:bi .3s both}
  .closing{animation:lout .26s steps(4) forwards}
  @keyframes lout{0%{opacity:1}40%{clip-path:inset(30% 0 40% 0);filter:hue-rotate(90deg)}100%{clip-path:inset(50% 0 50% 0);opacity:0}}
</style>
