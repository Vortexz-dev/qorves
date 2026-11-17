<script lang="ts">
  import { onMount } from 'svelte';
  import Frame from '../Frame.svelte';
  import { META } from '../meta';
  import { H } from '../hsfx';
  import { onGuardKey } from '../../../lib/keyguard';
  import { generate } from '../logic/tunnel';
  import { createTunnel, type TunnelView } from './tunnel3d';
  let { diff, signal, onend }: { diff: number; signal: number; onend: (ok: boolean) => void } = $props();
  const tn = generate(diff);
  let cv: HTMLCanvasElement | undefined = $state(), wrap: HTMLDivElement | undefined = $state();
  let help = $state(false), started = $state(false), over = $state<0 | 1 | -1>(0), lives = $state(tn.lives), prog = $state(0), flash = $state(0), err = $state('');
  let view: TunnelView | null = null;
  let mx = 0, my = 0;
  function onMove(e: PointerEvent) {
    if (!wrap) return; const r = wrap.getBoundingClientRect(); const s = Math.min(r.width, r.height) * 0.42;
    mx = (e.clientX - (r.left + r.width / 2)) / s; my = -(e.clientY - (r.top + r.height / 2)) / s;
  }
  function begin() { if (started || over || help) return; started = true; view?.start(); H.start(); }
  function finish(ok: boolean) { if (over) return; over = ok ? 1 : -1; (ok ? H.win : H.lose)(); setTimeout(() => onend(ok), 1600); }
  onMount(() => {
    try { view = createTunnel(cv!, tn, META.tunnel.acc, META.tunnel.acc2); } catch (e) { err = String((e as Error)?.message ?? e); return; }
    view.resize();
    const ro = new ResizeObserver(() => view?.resize()); ro.observe(cv!);
    let raf = 0, last = 0;
    const loop = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
      if (view && !help) {
        const r = view.frame(over ? 0 : dt, mx, my);
        prog = Math.min(1, r.z / tn.len);
        if (r.hitNow) { H.tuHit(); flash++; lives = r.lives; }
        if (r.passed) H.tuPass();
        if (r.over && !over) finish(r.over === 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const kd = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); begin(); } };
    const off = onGuardKey(kd);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); off(); view?.dispose(); };
  });
</script>

<Frame meta={META.tunnel} {diff} {signal} bind:help>
  {#snippet bar()}
    <div class="pg"><i style="transform:scaleX({prog})"></i></div>
    <span class="mono hint">{started ? 'TÜNEL %' + Math.round(prog * 100) : 'HAZIR OLUNCA TIKLA'}</span>
  {/snippet}
  {#snippet status()}<span class="mono sh">KALKAN {#each Array(tn.lives) as _, i}<b class:on={i < lives}></b>{/each}</span>{/snippet}
  <div class="tu" bind:this={wrap} onpointermove={onMove} onpointerdown={begin} role="application" aria-label="Veri tüneli">
    <canvas bind:this={cv}></canvas>
    {#key flash}{#if flash}<div class="hitfx"></div>{/if}{/key}
    {#if !started && !over && !err}
      <div class="ready mono">
        <b>PAKET HAZIR</b>
        <span>Fareyi oynat: paket imleci izler. Engellerin açık yerinden geç.</span>
        <em>BAŞLAMAK İÇİN TIKLA</em>
      </div>
    {/if}
    {#if err}<div class="ready mono"><b>3B BAŞLATILAMADI</b><span>Tarayıcın WebGL’i kapatmış olabilir. ({err.slice(0, 80)})</span></div>{/if}
  </div>
  {#if over}<div class="res mono" class:ok={over === 1}>{over === 1 ? 'PAKET ULAŞTI // KANAL AÇIK' : 'PAKET YANDI // KANAL KAPANDI'}</div>{/if}
</Frame>

<style>
  .hint{font-size:11px;letter-spacing:.24em;color:var(--acc)}
  .pg{width:100%;height:6px;border:1px solid color-mix(in srgb,var(--acc) 40%,transparent)}.pg i{display:block;height:100%;background:linear-gradient(90deg,var(--acc),var(--acc2));transform-origin:left}
  .sh{display:flex;align-items:center;gap:4px;color:var(--acc);letter-spacing:.2em}.sh b{width:14px;height:10px;border:1px solid var(--acc);margin-left:3px}.sh b.on{background:var(--acc);box-shadow:0 0 8px var(--acc)}
  .tu{position:absolute;inset:0;cursor:crosshair}
  canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  .hitfx{position:absolute;inset:0;pointer-events:none;animation:hf .5s ease-out forwards;background:radial-gradient(circle,transparent 30%,rgba(255,43,214,.55));mix-blend-mode:screen}
  @keyframes hf{from{opacity:1}to{opacity:0}}
  .ready{position:absolute;left:50%;bottom:12%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 28px;background:rgba(1,3,10,.72);border:1px solid var(--acc);text-align:center;backdrop-filter:blur(4px)}
  .ready b{font-size:18px;letter-spacing:.3em;color:var(--acc)}.ready span{font-family:var(--f-ui,system-ui);font-size:14px;color:#cfe}.ready em{font-style:normal;font-size:12px;letter-spacing:.3em;color:var(--acc2);animation:bl 1s steps(2) infinite}
  @keyframes bl{50%{opacity:.35}}
  .res{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px 36px;background:#000;border:2px solid var(--acc2);color:var(--acc2);font-size:20px;letter-spacing:.2em;font-weight:700;z-index:5;white-space:nowrap;animation:rs .35s cubic-bezier(.2,1.4,.4,1) both}
  .res.ok{border-color:var(--acc);color:var(--acc);box-shadow:0 0 40px rgba(0,240,255,.4)}
  @keyframes rs{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}
</style>
