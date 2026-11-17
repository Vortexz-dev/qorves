<script lang="ts">
  /* Ortak hack çerçevesi: başlık, süre çubuğu, zorluk/sinyal, ? yardım, düşük sinyal parazitleri. Her oyun kendi temasını CSS değişkenleriyle verir. */
  import { onMount, type Snippet } from 'svelte';
  import type { GMeta } from './meta';
  import { noise, H } from './hsfx';
  import { onGuardKey } from '../../lib/keyguard';
  let { meta, diff, signal, time = 0, left = 0, started = false, help = $bindable(false), status, children, bar }: {
    meta: GMeta; diff: number; signal: number; time?: number; left?: number; started?: boolean; help?: boolean; status?: Snippet; children: Snippet; bar?: Snippet;
  } = $props();
  const pct = $derived(time ? Math.max(0, Math.min(1, left / time)) : 1);
  const low = $derived(time && started && left / time < 0.25);
  let tear = $state(0), tearY = $state(30), tearH = $state(12);
  onMount(() => {
    const inInput = (e: KeyboardEvent) => (e.target as HTMLElement)?.tagName === 'INPUT';
    const offK = onGuardKey((e) => { if (e.key === 'F1' || (!inInput(e) && e.key === '?')) { e.preventDefault(); help = !help; H.tick(); } else if (help && e.key === 'Escape') { help = false; } });
    // zayıf sinyal: ara sıra ekran yırtılması + parazit
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      const s = Math.max(1, Math.min(5, signal));
      const every = s >= 4 ? 0 : s === 3 ? 9000 : s === 2 ? 4500 : 2600;
      if (!every) return;
      t = setTimeout(() => { tear = 1; tearY = 10 + Math.random() * 75; tearH = 4 + Math.random() * 18; noise(0.12, 0.06, 2500, 0.6); setTimeout(() => (tear = 0), 90 + Math.random() * 160); loop(); }, every * (0.6 + Math.random() * 0.8));
    };
    loop();
    return () => { offK(); clearTimeout(t); };
  });
  let lastS = -1;
  $effect(() => { const s = Math.ceil(left); if (started && low && s !== lastS && s > 0) { lastS = s; H.tick(); } });
</script>

<div class="fr" style="--acc:{meta.acc};--acc2:{meta.acc2};--bg:{meta.bg}" class:tear={tear} class:low>
  <div class="bgx"></div>
  <header>
    <div class="ttl">
      <span class="gl mono" data-t={meta.name}>{meta.name}</span>
      <small class="mono">{meta.tag}</small>
    </div>
    <div class="tm">
      {#if time}
        <div class="tb"><i style="transform:scaleX({pct})"></i></div>
        <span class="mono">{started ? (left >= 10 ? Math.ceil(left) : left.toFixed(1)) + ' sn' : 'SÜRE İLK HAMLEDE BAŞLAR'}</span>
      {:else if bar}{@render bar()}{/if}
    </div>
    <div class="rt">
      {#if status}{@render status()}{/if}
      <span class="pp mono" title="Zorluk">ZRL {#each Array(5) as _, i}<b class:on={i < diff}></b>{/each}</span>
      <span class="sg mono" title="Sinyal">SİN {#each Array(5) as _, i}<b class:on={i < signal} style="height:{4 + i * 3}px"></b>{/each}</span>
      <button class="hq mono" onclick={() => { help = !help; H.tick(); }} aria-label="Yardım" title="Nasıl oynanır (?)">?</button>
    </div>
  </header>
  <main>{@render children()}</main>
  <footer class="mono">{#each meta.keys as [k, v]}<span><kbd>{k}</kbd>{v}</span>{/each}</footer>
  <i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
  <div class="scan"></div>
  {#if tear}<div class="tr2" style="top:{tearY}%;height:{tearH}%"></div>{/if}
  {#if help}
    <div class="hp" role="dialog" aria-label="Yardım">
      <div class="hpb">
        <span class="mono k">? NASIL OYNANIR · SÜRE DURAKLATILDI</span>
        <h3>{meta.name}</h3>
        <ol>{#each meta.how as h}<li>{h}</li>{/each}</ol>
        <div class="keys mono">{#each meta.keys as [k, v]}<span><kbd>{k}</kbd>{v}</span>{/each}</div>
        <button class="go mono" onclick={() => (help = false)}>DEVAM ET</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .fr{position:absolute;inset:0;background:var(--bg);color:#e6f2ea;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;font-family:var(--f-mono)}
  .bgx{position:absolute;inset:0;pointer-events:none;background:
    radial-gradient(ellipse 70% 55% at 50% 50%,color-mix(in srgb,var(--acc) 7%,transparent),transparent 70%),
    linear-gradient(color-mix(in srgb,var(--acc) 5%,transparent) 1px,transparent 1px) 0 0/48px 48px,
    linear-gradient(90deg,color-mix(in srgb,var(--acc) 5%,transparent) 1px,transparent 1px) 0 0/48px 48px;
    mask-image:radial-gradient(ellipse at center,#000 30%,transparent 85%)}
  header{position:relative;z-index:3;display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,1.1fr) minmax(0,1fr);align-items:center;gap:18px;padding:18px 28px 14px;
    border-bottom:1px solid color-mix(in srgb,var(--acc) 30%,transparent);background:linear-gradient(color-mix(in srgb,var(--bg) 60%,#000),transparent)}
  .ttl{display:flex;flex-direction:column;gap:3px;min-width:0}
  .gl{position:relative;font-size:22px;font-weight:700;letter-spacing:.16em;color:var(--acc);text-shadow:0 0 12px color-mix(in srgb,var(--acc) 60%,transparent)}
  .gl::before,.gl::after{content:attr(data-t);position:absolute;left:0;top:0;opacity:.0}
  .gl::before{color:var(--acc2);animation:gA 3.7s infinite steps(1)}.gl::after{color:#ff2a55;animation:gB 4.3s infinite steps(1)}
  @keyframes gA{0%,92%,100%{opacity:0;transform:none}93%{opacity:.8;transform:translate(-3px,1px);clip-path:inset(20% 0 50% 0)}95%{opacity:.8;transform:translate(2px,-1px);clip-path:inset(60% 0 10% 0)}}
  @keyframes gB{0%,88%,100%{opacity:0;transform:none}89%{opacity:.7;transform:translate(3px,0);clip-path:inset(0 0 70% 0)}91%{opacity:.7;transform:translate(-2px,1px);clip-path:inset(40% 0 30% 0)}}
  .ttl small{font-size:10.5px;letter-spacing:.28em;color:color-mix(in srgb,var(--acc) 55%,#8a9)}
  .tm{display:flex;flex-direction:column;align-items:center;gap:6px}
  .tb{width:100%;height:6px;background:color-mix(in srgb,var(--acc) 12%,#000);border:1px solid color-mix(in srgb,var(--acc) 35%,transparent);overflow:hidden}
  .tb i{display:block;height:100%;background:var(--acc);box-shadow:0 0 10px var(--acc);transform-origin:left;transition:transform .1s linear}
  .low .tb i{background:#ff2a55;box-shadow:0 0 12px #ff2a55;animation:blink .5s steps(2) infinite}
  @keyframes blink{50%{opacity:.45}}
  .tm span{font-size:11px;letter-spacing:.24em;color:color-mix(in srgb,var(--acc) 75%,#fff)}.low .tm span{color:#ff5a77}
  .rt{display:flex;justify-content:flex-end;align-items:center;gap:16px;font-size:10.5px;letter-spacing:.2em;color:#8fa7a0}
  .pp,.sg{display:flex;align-items:flex-end;gap:3px}.pp b{width:8px;height:8px;border:1px solid color-mix(in srgb,var(--acc) 50%,transparent);margin-left:2px}.pp b.on{background:var(--acc);box-shadow:0 0 6px var(--acc)}
  .sg b{width:4px;background:#24302c;margin-left:1px}.sg b.on{background:var(--acc2)}
  .hq{width:34px;height:34px;border:1px solid var(--acc);background:color-mix(in srgb,var(--acc) 10%,transparent);color:var(--acc);font-size:16px;font-weight:700;cursor:pointer;clip-path:polygon(0 0,75% 0,100% 25%,100% 100%,25% 100%,0 75%)}
  .hq:hover{background:var(--acc);color:#000}
  main{position:relative;z-index:2;display:grid;place-items:center;min-height:0;padding:16px 28px}
  footer{position:relative;z-index:3;display:flex;justify-content:center;gap:26px;padding:12px;font-size:11px;letter-spacing:.14em;color:#7d948d;border-top:1px solid color-mix(in srgb,var(--acc) 18%,transparent)}
  kbd{display:inline-block;min-width:22px;padding:2px 7px;margin-right:8px;border:1px solid color-mix(in srgb,var(--acc) 50%,transparent);color:var(--acc);font:inherit;font-size:10.5px;text-align:center;background:color-mix(in srgb,var(--acc) 8%,transparent)}
  .c{position:absolute;width:26px;height:26px;border:2px solid var(--acc);z-index:4;pointer-events:none;opacity:.8}
  .tl{top:8px;left:8px;border-right:0;border-bottom:0}.tr{top:8px;right:8px;border-left:0;border-bottom:0}.bl{bottom:8px;left:8px;border-right:0;border-top:0}.br{bottom:8px;right:8px;border-left:0;border-top:0}
  .scan{position:absolute;inset:0;pointer-events:none;z-index:6;background:repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px);mix-blend-mode:overlay}
  .tear main{filter:hue-rotate(40deg) saturate(1.6)}
  .tr2{position:absolute;left:0;right:0;z-index:7;pointer-events:none;backdrop-filter:hue-rotate(150deg) saturate(2.2) contrast(1.4);transform:translateX(14px);
    background:repeating-linear-gradient(90deg,rgba(255,255,255,.08) 0 2px,transparent 2px 6px)}
  .hp{position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);display:grid;place-items:center;animation:fi .2s both}
  @keyframes fi{from{opacity:0}}
  .hpb{width:min(640px,90vw);padding:28px 32px;border:1px solid var(--acc);background:color-mix(in srgb,var(--bg) 85%,#000);box-shadow:0 0 40px color-mix(in srgb,var(--acc) 25%,transparent);clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px))}
  .k{font-size:10.5px;letter-spacing:.3em;color:var(--acc)}
  h3{margin:10px 0 14px;font-size:30px;letter-spacing:.12em;color:#fff;font-family:var(--f-disp)}
  ol{margin:0 0 16px;padding-left:20px;display:flex;flex-direction:column;gap:8px;color:#cfe0d8;font-family:var(--f-ui,system-ui);font-size:15px;line-height:1.45}
  .keys{display:flex;flex-wrap:wrap;gap:14px;font-size:11px;color:#9ab;margin-bottom:18px}
  .go{padding:10px 22px;background:var(--acc);color:#000;border:0;font-weight:700;letter-spacing:.24em;cursor:pointer}
</style>
