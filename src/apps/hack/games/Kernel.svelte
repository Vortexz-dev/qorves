<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Frame from '../Frame.svelte';
  import { META } from '../meta';
  import { H } from '../hsfx';
  import { onGuardKey } from '../../../lib/keyguard';
  import { clock } from '../clock.svelte';
  import { generate } from '../logic/kernel';
  let { diff, signal, onend }: { diff: number; signal: number; onend: (ok: boolean) => void } = $props();
  const k = generate(diff, signal);
  let bi = $state(0), li = $state(0), val = $state(''), help = $state(false), over = $state<0 | 1 | -1>(0), shake = $state(false), wipe = $state(false);
  let inp: HTMLInputElement | undefined = $state();
  const ck = clock(k.time, () => finish(false));
  $effect(() => { ck.s.paused = help; if (!help) tick().then(() => inp?.focus()); });
  const addr = '0x' + Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, '0');
  const cur = $derived(k.blocks[bi]?.[li] ?? '');
  const errAt = $derived((() => { for (let i = 0; i < val.length; i++) if (val[i] !== cur[i]) return i; return -1; })());
  const totalLines = k.blocks.flat().length;
  const doneLines = $derived(k.blocks.slice(0, bi).flat().length + li);
  function onInput(e: Event) {
    ck.start();
    const v = (e.target as HTMLInputElement).value;
    if (v.length > val.length) { H.kKey(); const i = v.length - 1; if (v[i] !== cur[i]) { H.kErr(); shake = true; setTimeout(() => (shake = false), 160); } }
    val = v;
  }
  async function onKey(e: KeyboardEvent) {
    if (e.key !== 'Enter' || over) return;
    e.preventDefault(); ck.start();
    if (val !== cur) { H.kErr(); shake = true; setTimeout(() => (shake = false), 200); return; }
    H.kLine(); val = '';
    if (li + 1 < k.blocks[bi]!.length) { li++; return; }
    H.kBlock(); wipe = true; await new Promise((r) => setTimeout(r, 420)); wipe = false;
    if (bi + 1 < k.blocks.length) { bi++; li = 0; } else finish(true);
  }
  function finish(ok: boolean) { if (over) return; over = ok ? 1 : -1; ck.stop(); (ok ? H.win : H.lose)(); setTimeout(() => onend(ok), 1400); }
  onMount(() => { inp?.focus(); const off = onGuardKey((e) => { if (e.key === 'Enter') onKey(e); else if (e.key.length === 1 || e.key === 'Backspace') { if (document.activeElement !== inp) inp?.focus(); } }); return () => { off(); ck.stop(); }; });
</script>

<Frame meta={META.kernel} {diff} {signal} time={k.time} left={ck.s.left} started={ck.s.started} bind:help>
  {#snippet status()}<span class="mono st">SATIR {doneLines}/{totalLines}</span>{/snippet}
  <div class="kc" class:shake class:lost={over === -1} onpointerdown={() => setTimeout(() => inp?.focus())} role="presentation">
    <div class="crt">
      <div class="hd"><span>{addr}</span><span>BLOK {bi + 1}/{k.blocks.length} · {k.blocks.length - bi - (over === 1 ? 1 : 0)} BOZUK</span></div>
      <div class="ls" class:wipe>
        {#each k.blocks[bi] ?? [] as l, i}
          <div class="ln" class:act={i === li && !over} class:dn={i < li}>
            <em>{i}</em>
            <span>{#if i === li && !over}{#each l.split('') as ch, j}<b class:ok={j < val.length && (errAt < 0 || j < errAt)} class:bad={errAt >= 0 && j >= errAt && j < val.length} class:cur={j === val.length}>{ch}</b>{/each}{#if val.length >= l.length}<b class="cur">&nbsp;</b>{/if}{:else}{l}{/if}</span>
          </div>
        {/each}
      </div>
      <label class="in" class:err={errAt >= 0}>
        <span>›</span>
        <input bind:this={inp} value={val} oninput={onInput} spellcheck="false" autocomplete="off" autocapitalize="off" disabled={!!over} aria-label="Satırı yaz" />
      </label>
      <div class="ft"><span>BOZUK BELLEK BLOĞU: <b>{k.blocks.length - bi}</b></span><span>{errAt >= 0 ? 'HATA · BACKSPACE İLE SİL' : 'DERLEYİCİ HAZIR'}</span></div>
    </div>
  </div>
  {#if over}<div class="res mono" class:ok={over === 1}>{over === 1 ? 'ÇEKİRDEK DERLENDİ // BELLEK TEMİZ' : 'DERLEME ZAMAN AŞIMI // ÇEKİRDEK DÜŞTÜ'}</div>{/if}
</Frame>

<style>
  .st{color:var(--acc);letter-spacing:.2em}
  .kc{width:min(1080px,92vw)}
  .crt{position:relative;border:1px solid color-mix(in srgb,var(--acc) 60%,transparent);background:radial-gradient(ellipse at center,#062206 0%,#020702 75%);box-shadow:0 0 60px rgba(57,255,20,.12),inset 0 0 80px rgba(0,0,0,.8);
    border-radius:14px/18px;padding:0 0 4px;overflow:hidden;font-size:clamp(15px,1.9vh,19px)}
  .crt::after{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,.25) 0 2px,transparent 2px 4px);border-radius:inherit}
  .hd,.ft{display:flex;justify-content:space-between;padding:8px 16px;font-size:12px;letter-spacing:.2em;color:var(--acc);border-bottom:1px solid color-mix(in srgb,var(--acc) 30%,transparent)}
  .ft{border-bottom:0;border-top:1px solid color-mix(in srgb,var(--acc) 30%,transparent);color:color-mix(in srgb,var(--acc) 70%,#555)}.ft b{color:var(--acc)}
  .ls{padding:6px 0;transition:all .4s}.ls.wipe{filter:brightness(2.5) blur(2px);opacity:0;transform:scaleY(.2)}
  .ln{display:grid;grid-template-columns:40px 1fr;gap:12px;padding:9px 16px;color:color-mix(in srgb,var(--acc) 55%,#2a3);text-shadow:0 0 6px rgba(57,255,20,.4);white-space:pre}
  .ln em{font-style:normal;color:color-mix(in srgb,var(--acc) 40%,#222)}
  .ln.act{background:color-mix(in srgb,var(--acc) 22%,transparent);color:#e9ffe0}.ln.dn{opacity:.35;text-decoration:line-through}
  .ln b{font-weight:400}.ln b.ok{color:var(--acc)}.ln b.bad{background:#ff2a3a;color:#000}.ln b.cur{box-shadow:inset 0 -3px 0 var(--acc);animation:cb .8s steps(2) infinite}
  @keyframes cb{50%{box-shadow:none}}
  .in{display:flex;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid color-mix(in srgb,var(--acc) 30%,transparent);background:rgba(0,30,0,.5)}
  .in span{color:var(--acc);font-size:1.3em}
  .in input{flex:1;background:none;border:0;outline:none;color:#e9ffe0;font:inherit;caret-color:var(--acc)}
  .in.err input{color:#ff5a6a}
  .shake{animation:sh .16s}@keyframes sh{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  .lost{filter:grayscale(.8) brightness(.5)}
  .res{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px 36px;background:#000;border:2px solid #ff2a3a;color:#ff2a3a;font-size:20px;letter-spacing:.2em;font-weight:700;z-index:5;white-space:nowrap;animation:rs .35s cubic-bezier(.2,1.4,.4,1) both}
  .res.ok{border-color:var(--acc);color:var(--acc);box-shadow:0 0 40px rgba(57,255,20,.4)}
  @keyframes rs{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}
</style>
