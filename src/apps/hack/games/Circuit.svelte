<script lang="ts">
  import { onMount } from 'svelte';
  import Frame from '../Frame.svelte';
  import { META } from '../meta';
  import { H } from '../hsfx';
  import { clock } from '../clock.svelte';
  import { generate, powered, N, E, S, W } from '../logic/circuit';
  let { diff, signal, onend }: { diff: number; signal: number; onend: (ok: boolean) => void } = $props();
  const c = $state(generate(diff, signal));
  let help = $state(false), over = $state<0 | 1 | -1>(0), moves = $state(0);
  const ck = clock(c.time, () => finish(false));
  $effect(() => { ck.s.paused = help; });
  const on = $derived(powered(c));
  const lit = $derived(c.sinks.filter((s) => on.has(s)).length);
  function turn(i: number, dir: 1 | -1, e?: MouseEvent) {
    e?.preventDefault();
    const t = c.tiles[i]!; if (over || t.kind === 'src' || t.kind === 'block') return;
    ck.start(); t.r += dir; moves++;
    const before = lit; H.ciRot();
    queueMicrotask(() => { const after = c.sinks.filter((s) => powered(c).has(s)).length; if (after > before) H.ciZap(); if (after === c.sinks.length) finish(true); });
  }
  function finish(ok: boolean) { if (over) return; over = ok ? 1 : -1; ck.stop(); (ok ? H.win : H.lose)(); setTimeout(() => onend(ok), 1400); }
  onMount(() => () => ck.stop());
  const arms = (m: number) => [m & N ? 'M50 50V0' : '', m & E ? 'M50 50H100' : '', m & S ? 'M50 50V100' : '', m & W ? 'M50 50H0' : ''].filter(Boolean).join(' ');
</script>

<Frame meta={META.circuit} {diff} {signal} time={c.time} left={ck.s.left} started={ck.s.started} bind:help>
  {#snippet status()}<span class="mono st">ALICI {lit}/{c.sinks.length}</span>{/snippet}
  <div class="ci" class:won={over === 1} class:lost={over === -1} style="--w:{c.w};--h:{c.h}">
    <div class="board">
      {#each c.tiles as t, i (i)}
        {@const p = on.has(i)}
        <button class="t {t.kind}" class:p oncontextmenu={(e) => turn(i, -1, e)} onclick={() => turn(i, 1)} aria-label="karo">
          <svg viewBox="0 0 100 100">
            <rect class="pl" x="3" y="3" width="94" height="94" rx="6" />
            <path class="dots" d="M14 14h.1M86 14h.1M14 86h.1M86 86h.1" />
            {#if t.kind === 'block'}
              <path class="blk" d="M20 20 80 80M80 20 20 80" /><rect class="blkr" x="18" y="18" width="64" height="64" rx="4" />
            {:else}
              <g style="transform:rotate({t.r * 90}deg)" class="rot">
                <path class="w" d={arms(t.m)} /><path class="wf" d={arms(t.m)} />
                {#if t.kind === 'src'}
                  <circle class="core" cx="50" cy="50" r="22" /><circle class="core2" cx="50" cy="50" r="12" />
                {:else if t.kind === 'sink'}
                  <circle class="snk" cx="50" cy="50" r="20" /><circle class="snk2" cx="50" cy="50" r="8" />
                {:else}<circle class="j" cx="50" cy="50" r="7" />{/if}
              </g>
            {/if}
          </svg>
        </button>
      {/each}
    </div>
    <aside class="mono">
      <div class="lg"><i class="sw a"></i>ÇEKİRDEK</div>
      <div class="lg"><i class="sw b"></i>ALICI DÜĞÜM</div>
      <div class="lg"><i class="sw c"></i>YALITKAN</div>
      <div class="mv">DÖNDÜRME <b>{moves}</b></div>
    </aside>
  </div>
  {#if over}<div class="res mono" class:ok={over === 1}>{over === 1 ? 'FAZ KÖPRÜSÜ KURULDU // ENERJİ AKIYOR' : 'DEVRE ÇÖKTÜ // AKIŞ KESİLDİ'}</div>{/if}
</Frame>

<style>
  .st{color:var(--acc);letter-spacing:.2em}
  .ci{display:flex;gap:28px;align-items:center}
  .board{--cs:min(calc((100vh - 230px) / var(--h)),calc((100vw - 340px) / var(--w)),96px);display:grid;grid-template-columns:repeat(var(--w),var(--cs));grid-auto-rows:var(--cs);gap:4px;padding:14px;
    background:linear-gradient(135deg,#0b1222,#060a14);border:1px solid color-mix(in srgb,var(--acc2) 35%,transparent);box-shadow:0 0 50px rgba(0,0,0,.6),inset 0 0 40px rgba(76,201,255,.06)}
  .t{padding:0;background:none;border:0;cursor:pointer}.t svg{width:100%;height:100%;display:block;overflow:visible}
  .pl{fill:#0d1528;stroke:#1b2a48;stroke-width:2}.t:hover .pl{stroke:var(--acc2)}
  .dots{stroke:#2a3d63;stroke-width:5;stroke-linecap:round}
  .rot{transform-origin:50px 50px;transition:transform .16s cubic-bezier(.3,1.4,.5,1)}
  .w{stroke:#24385e;stroke-width:16;fill:none;stroke-linecap:butt}
  .wf{stroke:#3d5a8c;stroke-width:5;fill:none;stroke-dasharray:6 8}
  .j{fill:#2b4270}
  .p .w{stroke:color-mix(in srgb,var(--acc) 45%,#3a2500)}.p .wf{stroke:#fff3c4;filter:drop-shadow(0 0 4px var(--acc));animation:flow .5s linear infinite}.p .j{fill:var(--acc)}
  @keyframes flow{to{stroke-dashoffset:-14}}
  .core{fill:#2a1800;stroke:var(--acc);stroke-width:4;filter:drop-shadow(0 0 8px var(--acc))}.core2{fill:var(--acc);animation:pul 1.2s ease-in-out infinite}
  @keyframes pul{50%{opacity:.5}}
  .src{cursor:default}.src .pl{stroke:var(--acc)}
  .snk{fill:#081426;stroke:var(--acc2);stroke-width:4}.snk2{fill:#1b2a48}
  .p .snk{stroke:var(--acc);filter:drop-shadow(0 0 10px var(--acc))}.p .snk2{fill:#fff3c4;animation:pul .6s ease-in-out infinite}
  .block{cursor:not-allowed}.blk{stroke:#ff3b5c;stroke-width:6;opacity:.6}.blkr{fill:none;stroke:#ff3b5c;stroke-width:3;opacity:.5}
  aside{display:flex;flex-direction:column;gap:12px;font-size:11px;letter-spacing:.18em;color:#8fa0bf}
  .lg{display:flex;align-items:center;gap:10px}.sw{width:16px;height:16px;border:2px solid}.sw.a{border-color:var(--acc);background:var(--acc)}.sw.b{border-color:var(--acc2);border-radius:50%}.sw.c{border-color:#ff3b5c}
  .mv{margin-top:14px;color:#cfe}.mv b{color:var(--acc);font-size:18px;margin-left:6px}
  .won .board{box-shadow:0 0 60px color-mix(in srgb,var(--acc) 35%,transparent)}.lost{filter:grayscale(.8) brightness(.55)}
  .res{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px 36px;background:#000;border:2px solid #ff3b5c;color:#ff3b5c;font-size:20px;letter-spacing:.2em;font-weight:700;z-index:5;white-space:nowrap;animation:rs .35s cubic-bezier(.2,1.4,.4,1) both}
  .res.ok{border-color:var(--acc);color:var(--acc);box-shadow:0 0 40px color-mix(in srgb,var(--acc) 40%,transparent)}
  @keyframes rs{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}
</style>
