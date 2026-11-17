<script lang="ts">
  import { onMount } from 'svelte';
  import Frame from '../Frame.svelte';
  import { META } from '../meta';
  import { H } from '../hsfx';
  import { generate, poolFor, matches, GRID, type Piece } from '../logic/token';
  let { diff, signal, onend }: { diff: number; signal: number; onend: (ok: boolean) => void } = $props();
  const T = generate(diff, signal);
  let k = $state(0), chosen = $state<number[]>([]), left = $state(T.pick), started = $state(false), help = $state(false), over = $state<0 | 1 | -1>(0), flash = $state<'' | 'ok' | 'bad'>(''), jit = $state(0);
  const pool = $derived(poolFor(T, k));
  const need = $derived(T.tokens[k]!.parts.length);
  const target = $derived(T.pieces.filter((p) => T.tokens[k]!.parts.includes(p.id)));
  const mine = $derived(T.pieces.filter((p) => chosen.includes(p.id)));
  const SX = 26, SY = 22, OX = 14, OY = 12;
  const pth = (p: Piece) => 'M' + p.pts.map(([x, y]) => `${OX + x * SX} ${OY + y * SY}`).join(' L');
  const VB = `0 0 ${OX * 2 + GRID.w * SX} ${OY * 2 + GRID.h * SY}`;
  function choose(p: Piece) {
    if (over || help || flash || chosen.includes(p.id)) return;
    started = true; chosen = [...chosen, p.id]; left = T.pick; H.tPick();
    if (chosen.length >= need) {
      if (matches(T, k, chosen)) { flash = 'ok'; H.tOk(); setTimeout(() => { flash = ''; chosen = []; if (k + 1 >= T.tokens.length) finish(true); else { k++; left = T.pick; } }, 650); }
      else { flash = 'bad'; H.tBad(); setTimeout(() => { flash = ''; chosen = []; left = T.pick; }, 650); }
    }
  }
  function finish(ok: boolean) { if (over) return; over = ok ? 1 : -1; (ok ? H.win : H.lose)(); setTimeout(() => onend(ok), 1400); }
  onMount(() => {
    let raf = 0, last = 0;
    const loop = (t: number) => {
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
      if (started && !help && !over && !flash) { left = Math.max(0, left - dt); if (left <= 0) finish(false); else if (left < 2.5 && Math.floor(left * 4) !== Math.floor((left + dt) * 4)) H.tick(); }
      if (T.noise && Math.random() < T.noise * 0.12) jit = (Math.random() - 0.5) * 2;
      else if (Math.random() < 0.2) jit = 0;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>

<Frame meta={META.token} {diff} {signal} bind:help>
  {#snippet bar()}
    <div class="selt"><i style="transform:scaleX({left / T.pick})" class:low={left < 2.5}></i></div>
    <span class="mono hint">{started ? 'SEÇİM SÜRESİ ' + left.toFixed(1) + ' sn' : 'SÜRE İLK SEÇİMDE BAŞLAR'}</span>
  {/snippet}
  {#snippet status()}<span class="mono st">JETON {Math.min(k + 1, T.tokens.length)}/{T.tokens.length}</span>{/snippet}
  <div class="tk" class:lost={over === -1}>
    <section class="pane">
      <div class="lab mono">CREATE VALID AUTH TOKEN <span>{chosen.length}/{need}</span></div>
      <div class="pool">
        {#each pool as p (p.id)}
          <button class="pc" class:sel={chosen.includes(p.id)} onclick={() => choose(p)} onmouseenter={() => H.tick()} aria-label="parça">
            <svg viewBox={VB}><path d={pth(p)} /></svg>
          </button>
        {/each}
      </div>
    </section>
    <section class="tgt" class:ok={flash === 'ok'} class:bad={flash === 'bad'}>
      <div class="lab mono">YETKİ JETONU · {T.noise ? 'PARAZİTLİ' : 'TEMİZ'}</div>
      <div class="view">
        <svg viewBox={VB} style="transform:translate({jit * 6 * T.noise}px,{-jit * 3 * T.noise}px) skewX({jit * 8 * T.noise}deg);filter:{T.noise && jit ? `blur(${Math.abs(jit) * T.noise * 1.6}px) hue-rotate(${jit * 60}deg)` : 'none'}">
          {#each target as p}<path class="tp" d={pth(p)} />{/each}
          {#each mine as p}<path class="mp" d={pth(p)} />{/each}
        </svg>
        {#if T.noise}<div class="nz" style="opacity:{T.noise * 0.5}"></div>{/if}
      </div>
      <div class="boxes">{#each Array(need) as _, i}<i class:f={i < chosen.length}></i>{/each}</div>
      <div class="msg mono">{flash === 'ok' ? 'JETON DOĞRULANDI' : flash === 'bad' ? 'GEÇERSİZ JETON · SIFIRLANDI' : 'Parçaları üst üste bindir'}</div>
    </section>
  </div>
  {#if over}<div class="res mono" class:ok={over === 1}>{over === 1 ? 'YETKİ VERİLDİ // ROOT TOKEN' : 'YETKİ REDDEDİLDİ // ZAMAN AŞIMI'}</div>{/if}
</Frame>

<style>
  .hint{font-size:11px;letter-spacing:.24em;color:var(--acc)}.st{color:var(--acc);letter-spacing:.2em}
  .selt{width:100%;height:6px;border:1px solid color-mix(in srgb,var(--acc) 40%,transparent)}.selt i{display:block;height:100%;background:var(--acc);transform-origin:left;box-shadow:0 0 8px var(--acc)}.selt i.low{background:#ff4d5e}
  .tk{display:grid;grid-template-columns:auto auto;gap:0;border:1px solid var(--acc);background:#020a03;box-shadow:0 0 50px rgba(182,255,59,.08)}
  .lab{display:flex;justify-content:space-between;padding:8px 14px;font-size:12px;letter-spacing:.2em;color:var(--acc);border-bottom:1px solid color-mix(in srgb,var(--acc) 40%,transparent)}
  .lab span{color:#fff}
  .pane{border-right:1px solid color-mix(in srgb,var(--acc) 40%,transparent)}
  .pool{--ps:clamp(110px,15vh,150px);display:grid;grid-template-columns:repeat(3,var(--ps));grid-auto-rows:var(--ps)}
  .pc{background:none;border:1px solid #13301a;cursor:pointer;padding:14px;transition:background .12s}
  .pc svg{width:100%;height:100%}.pc path{fill:none;stroke:color-mix(in srgb,var(--acc) 75%,#365);stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
  .pc:hover{background:rgba(182,255,59,.08)}.pc:hover path{stroke:var(--acc);filter:drop-shadow(0 0 4px var(--acc))}
  .pc.sel{background:rgba(182,255,59,.18);cursor:default}.pc.sel path{stroke:#fff}
  .tgt{display:flex;flex-direction:column;align-items:center;width:clamp(300px,30vw,420px);transition:background .2s}
  .view{position:relative;width:70%;aspect-ratio:1/1.15;margin:22px 0 10px}
  .view svg{width:100%;height:100%}
  .tp{fill:none;stroke:var(--acc);stroke-width:5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 6px rgba(182,255,59,.6));opacity:.85}
  .mp{fill:none;stroke:#fff;stroke-width:2.5;stroke-linecap:round;stroke-dasharray:3 4}
  .nz{position:absolute;inset:-10px;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(182,255,59,.2) 0 1px,transparent 1px 4px),repeating-linear-gradient(90deg,rgba(0,0,0,.6) 0 3px,transparent 3px 9px);mix-blend-mode:screen;animation:nz .2s steps(3) infinite}
  @keyframes nz{50%{transform:translate(3px,-2px)}}
  .boxes{display:flex;gap:8px}.boxes i{width:16px;height:16px;border:2px solid var(--acc)}.boxes i.f{background:var(--acc)}
  .msg{margin:14px 0 18px;font-size:11px;letter-spacing:.2em;color:#87a07a}
  .tgt.ok{background:rgba(182,255,59,.12)}.tgt.ok .msg{color:var(--acc)}.tgt.bad{background:rgba(255,77,94,.14)}.tgt.bad .msg{color:#ff4d5e}
  .lost{filter:grayscale(.8) brightness(.5)}
  .res{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px 36px;background:#000;border:2px solid #ff4d5e;color:#ff4d5e;font-size:20px;letter-spacing:.2em;font-weight:700;z-index:5;white-space:nowrap;animation:rs .35s cubic-bezier(.2,1.4,.4,1) both}
  .res.ok{border-color:var(--acc);color:var(--acc);box-shadow:0 0 40px rgba(182,255,59,.4)}
  @keyframes rs{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}
</style>
