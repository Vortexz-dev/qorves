<script lang="ts">
  import { onMount } from 'svelte';
  import Frame from '../Frame.svelte';
  import { META } from '../meta';
  import { H } from '../hsfx';
  import { onGuardKey } from '../../../lib/keyguard';
  import { clock } from '../clock.svelte';
  import { generate, bits, keyFor, type Row } from '../logic/memde';
  let { diff, signal, onend }: { diff: number; signal: number; onend: (ok: boolean) => void } = $props();
  const m = generate(diff, signal);
  const VIS = 11;
  let pos = $state(0), prog = $state(0), help = $state(false), over = $state<0 | 1 | -1>(0), flash = $state<'' | 'ok' | 'bad'>(''), anim = $state(0);
  const tex = m.rows.map(() => [bits(), bits()]);
  const ck = clock(m.time, () => finish(false));
  $effect(() => { ck.s.paused = help; });
  const vis = $derived(Array.from({ length: VIS }, (_, i) => pos + VIS - 1 - i)); // en üstte gelecek satırlar
  function press(k: 'left' | 'right' | 'space') {
    if (over || help) return; ck.start();
    const need = keyFor(m.rows[pos] as Row);
    if (k === need) { prog++; pos++; H.mOk(); flash = 'ok'; anim++; if (prog >= m.need) return finish(true); }
    else { prog = Math.max(0, prog - m.penalty); H.mBad(); flash = 'bad'; }
    setTimeout(() => (flash = ''), 120);
  }
  function finish(ok: boolean) { if (over) return; over = ok ? 1 : -1; ck.stop(); (ok ? H.win : H.lose)(); setTimeout(() => onend(ok), 1400); }
  onMount(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') { e.preventDefault(); press('left'); }
      else if (k === 'd' || k === 'arrowright') { e.preventDefault(); press('right'); }
      else if (k === ' ') { e.preventDefault(); press('space'); }
    };
    const off = onGuardKey(kd);
    return () => { off(); ck.stop(); };
  });
  const need = $derived(keyFor(m.rows[pos] as Row));
</script>

<Frame meta={META.memde} {diff} {signal} time={m.time} left={ck.s.left} started={ck.s.started} bind:help>
  {#snippet status()}<span class="mono st">CEZA −{m.penalty}</span>{/snippet}
  <div class="md" class:ok={flash === 'ok'} class:bad={flash === 'bad'} class:lost={over === -1}>
    <div class="pg"><i style="width:{(prog / m.need) * 100}%"></i><span>DEALLOCATING · {Math.round((prog / m.need) * 100)}%</span></div>
    <div class="blk">
      <span class="ar l">▶</span><span class="ar r">◀</span>
      {#key anim}
        <div class="rows">
          {#each vis as ri, i (ri)}
            {@const row = m.rows[ri] as Row}
            <div class="row" class:cur={i === VIS - 1}>
              <span class:red={row === 'R'}>{tex[ri]![0]}</span><span class:red={row === 'L'}>{tex[ri]![1]}</span>
            </div>
          {/each}
        </div>
      {/key}
    </div>
    <div class="pr mono">
      {#if m.prompt}
        <kbd class:on={need === 'left'}>A ←</kbd><kbd class:on={need === 'space'}>BOŞLUK</kbd><kbd class:on={need === 'right'}>D →</kbd>
      {:else}<span class="hid">İPUCU YOK · EN ALT SATIRI OKU</span>{/if}
    </div>
  </div>
  {#if over}<div class="res mono" class:ok={over === 1}>{over === 1 ? 'BELLEK SERBEST // SIZMA TEMİZLENDİ' : 'BELLEK TAŞTI // SÜRE BİTTİ'}</div>{/if}
</Frame>

<style>
  .st{color:var(--acc2);letter-spacing:.2em}
  .md{width:min(880px,90vw);display:flex;flex-direction:column;gap:14px;transition:filter .1s}
  .pg{position:relative;height:30px;border:1px solid var(--acc);background:#021a0c}
  .pg i{position:absolute;left:0;top:0;bottom:0;background:var(--acc);transition:width .12s;box-shadow:0 0 14px var(--acc)}
  .pg span{position:absolute;inset:0;display:grid;place-items:center;font-size:13px;letter-spacing:.3em;color:#eafff2;mix-blend-mode:difference}
  .blk{position:relative;border:1px solid var(--acc);background:#010d06;padding:10px 26px;overflow:hidden}
  .ar{position:absolute;bottom:14px;color:var(--acc);font-size:22px;text-shadow:0 0 10px var(--acc)}.ar.l{left:2px}.ar.r{right:2px}
  .rows{display:flex;flex-direction:column;animation:dn .09s ease-out}
  @keyframes dn{from{transform:translateY(-34px)}}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:clamp(17px,2.4vh,23px);letter-spacing:.14em;line-height:1.5;color:var(--acc);text-shadow:0 0 6px rgba(43,255,136,.45);opacity:.75}
  .row span{text-align:center;padding:0 4px}
  .row span.red{color:var(--acc2);background:rgba(255,51,85,.13);text-shadow:0 0 6px rgba(255,51,85,.6)}
  .row.cur{opacity:1;outline:1px solid color-mix(in srgb,var(--acc) 50%,transparent);background:rgba(43,255,136,.06)}
  .row.cur span.red{background:rgba(255,51,85,.3)}
  .pr{display:flex;justify-content:center;gap:14px;min-height:44px}
  .pr kbd{padding:10px 18px;border:1px solid #1d4a31;color:#4f8a6c;font:inherit;font-size:13px;letter-spacing:.2em}
  .pr kbd.on{border-color:var(--acc);color:#001a0b;background:var(--acc);box-shadow:0 0 16px var(--acc)}
  .hid{font-size:12px;letter-spacing:.3em;color:#3f7a5c;align-self:center}
  .ok .blk{box-shadow:inset 0 0 30px rgba(43,255,136,.2)}.bad .blk{box-shadow:inset 0 0 50px rgba(255,51,85,.5);border-color:var(--acc2)}
  .lost{filter:grayscale(.8) brightness(.5)}
  .res{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px 36px;background:#000;border:2px solid var(--acc2);color:var(--acc2);font-size:20px;letter-spacing:.2em;font-weight:700;z-index:5;white-space:nowrap;animation:rs .35s cubic-bezier(.2,1.4,.4,1) both}
  .res.ok{border-color:var(--acc);color:var(--acc);box-shadow:0 0 40px rgba(43,255,136,.4)}
  @keyframes rs{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}
</style>
