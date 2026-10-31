<script lang="ts">
  // Timeline / Codex / Starmap açılış girişi (~1,3 sn). Tıkla ya da bir tuşa bas: atlanır.
  import { onMount } from 'svelte';
  import { sfx } from '../lib/sfx';
  let { id, ondone }: { id: 'timeline' | 'codex' | 'starmap'; ondone?: () => void } = $props();
  const C = {
    timeline: { t: 'QORVES TIMELINE', k: 'KRONOLOJİ ÇEKİRDEĞİ', l: ['ZAMAN EKSENİ HİZALANIYOR', 'ÇAĞLAR İNDEKSLENDİ', 'SS 224 · ŞİMDİ'] },
    codex: { t: 'QORVES CODEX', k: 'KÜME BİLGİ BANKASI', l: ['ARŞİV ŞİFRESİ ÇÖZÜLÜYOR', 'KAYITLAR EŞLENİYOR', 'ERİŞİM İZNİ DOĞRULANDI'] },
    starmap: { t: 'QORVES STARMAP', k: 'NAVİGASYON AĞI', l: ['SENSÖR DİZİSİ AÇILIYOR', 'HİPERHATLAR TARANIYOR', 'KÜME KONUMU KİLİTLENDİ'] },
  }[id];
  let on = $state(true), out = $state(false), n = $state(0);
  const YEARS = ['−1.000.000', '−120.000', '−12.000', '−3.400', '−900', '−210', '0', 'SS 100', 'SS 224'];
  const cells = Array.from({ length: 48 }, (_, i) => ({ i, d: Math.random() * 0.55, w: Math.random() > 0.7 }));
  const stars = Array.from({ length: 36 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, d: Math.random() * 0.6, s: 1 + Math.random() * 2 }));
  const hex = () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(' ').toUpperCase();
  let hx = $state(hex());
  function skip() { if (!out) { out = true; ondone?.(); setTimeout(() => (on = false), 260); } }
  onMount(() => {
    sfx.glitch(); id === 'starmap' ? sfx.ping() : sfx.open();
    const ts = [setTimeout(() => { n = 1; sfx.key(); }, 220), setTimeout(() => { n = 2; sfx.key(); }, 470), setTimeout(() => { n = 3; sfx.key(); id === 'codex' ? sfx.granted() : sfx.ping(); }, 720), setTimeout(skip, 1080)];
    const hi = setInterval(() => (hx = hex()), 70);
    const k = (e: KeyboardEvent) => { if (e.key !== 'Escape') skip(); };
    addEventListener('keydown', k);
    return () => { ts.forEach(clearTimeout); clearInterval(hi); removeEventListener('keydown', k); };
  });
</script>

{#if on}
<div class="ci {id}" class:out onclick={skip} role="presentation">
  <div class="bg"></div>
  {#if id === 'timeline'}
    <div class="axis"><i></i>{#each YEARS as y, i (y)}<span style:left="{6 + i * 11}%" style:animation-delay="{0.12 + i * 0.05}s"><b></b>{y}</span>{/each}</div>
  {:else if id === 'codex'}
    <div class="cells">{#each cells as c (c.i)}<i class:w={c.w} style:animation-delay="{c.d}s"></i>{/each}</div>
  {:else}
    <div class="radar"><i class="r1"></i><i class="r2"></i><i class="r3"></i><i class="sw"></i>{#each stars as s, i (i)}<b style:left="{s.x}%" style:top="{s.y}%" style:width="{s.s}px" style:height="{s.s}px" style:animation-delay="{s.d}s"></b>{/each}</div>
  {/if}
  <div class="br tl"></div><div class="br tr"></div><div class="br bl"></div><div class="br brr"></div>
  <div class="mid">
    <div class="k mono">{C.k}</div>
    <h1 class="gt" data-t={C.t}>{C.t}</h1>
    <div class="ln mono">{#each C.l.slice(0, n) as l, i (i)}<div><em>&gt;</em> {l} <span>OK</span></div>{/each}</div>
    <div class="pb"><i></i></div>
    <div class="hx mono">{hx} · {id.toUpperCase()}.SYS</div>
  </div>
  <div class="sk mono">TIKLA · ATLA</div>
  <div class="scan"></div>
</div>
{/if}

<style>
  .ci{position:absolute;inset:0;z-index:7;display:grid;place-items:center;cursor:pointer;--c:#00f0ff;--c2:#fcee0a;overflow:hidden}
  .ci.codex{--c:#fcee0a;--c2:#00f0ff}.ci.starmap{--c:#7df9ff;--c2:#ff2a55}
  .ci.out{animation:co .26s cubic-bezier(.7,0,.3,1) forwards}
  @keyframes co{0%{opacity:1;filter:none}40%{filter:hue-rotate(70deg) brightness(1.8);transform:skewX(-4deg)}100%{opacity:0;clip-path:inset(48% 0 48% 0);transform:none}}
  .bg{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(4,10,18,.88),rgba(2,3,8,.97) 70%)}
  .scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px);mix-blend-mode:screen;animation:fl .12s steps(2) infinite}
  @keyframes fl{50%{opacity:.6}}
  .br{position:absolute;width:70px;height:70px;border:2px solid var(--c);opacity:0;animation:brk .45s .05s cubic-bezier(.2,1.4,.4,1) forwards;filter:drop-shadow(0 0 6px var(--c))}
  .tl{left:5%;top:9%;border-right:0;border-bottom:0}.tr{right:5%;top:9%;border-left:0;border-bottom:0}.bl{left:5%;bottom:7%;border-right:0;border-top:0}.brr{right:5%;bottom:7%;border-left:0;border-top:0}
  @keyframes brk{from{opacity:0;transform:scale(1.8)}to{opacity:.9;transform:none}}
  .mid{position:relative;text-align:center;min-width:520px}
  .k{font-size:11px;letter-spacing:.5em;color:var(--c2);opacity:0;animation:fi .2s .1s forwards}
  @keyframes fi{to{opacity:1}}
  .gt{position:relative;margin:10px 0 14px;font-family:var(--f-disp);font-weight:700;font-size:54px;letter-spacing:.18em;color:#fff;text-shadow:0 0 18px var(--c),0 0 40px var(--c);animation:gin .5s steps(6) both}
  .gt::before,.gt::after{content:attr(data-t);position:absolute;inset:0;pointer-events:none}
  .gt::before{color:#ff2a55;transform:translate(-3px,0);clip-path:inset(0 0 58% 0);mix-blend-mode:screen;animation:g1 .9s steps(5) infinite;opacity:.8}
  .gt::after{color:#00f0ff;transform:translate(3px,0);clip-path:inset(55% 0 0 0);mix-blend-mode:screen;animation:g2 .7s steps(4) infinite;opacity:.8}
  @keyframes gin{0%{clip-path:inset(0 100% 0 0);letter-spacing:.6em;opacity:.2}60%{clip-path:inset(0 0 0 0)}100%{letter-spacing:.18em;opacity:1}}
  @keyframes g1{0%,100%{transform:translate(-3px,0)}30%{transform:translate(4px,-2px);clip-path:inset(10% 0 70% 0)}60%{transform:translate(-5px,1px);clip-path:inset(40% 0 35% 0)}}
  @keyframes g2{0%,100%{transform:translate(3px,0)}40%{transform:translate(-4px,2px);clip-path:inset(70% 0 5% 0)}75%{transform:translate(5px,-1px);clip-path:inset(20% 0 60% 0)}}
  .ln{min-height:64px;font-size:12px;letter-spacing:.18em;color:#cfe;text-align:left;display:inline-block}
  .ln div{animation:ty .18s steps(8) both;white-space:nowrap;overflow:hidden}.ln em{color:var(--c);font-style:normal}.ln span{color:#39ff8a;margin-left:8px}
  @keyframes ty{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0)}}
  .pb{width:360px;height:3px;margin:10px auto 8px;background:rgba(255,255,255,.08);overflow:hidden}
  .pb i{display:block;height:100%;background:linear-gradient(90deg,var(--c),var(--c2));box-shadow:0 0 10px var(--c);animation:pg 1s cubic-bezier(.6,0,.3,1) forwards;width:0}
  @keyframes pg{60%{width:72%}100%{width:100%}}
  .hx{font-size:10px;letter-spacing:.2em;color:rgba(255,255,255,.35)}
  .sk{position:absolute;bottom:3%;right:6%;font-size:9.5px;letter-spacing:.3em;color:rgba(255,255,255,.35)}
  /* timeline */
  .axis{position:absolute;left:0;right:0;top:72%;height:60px}
  .axis i{position:absolute;left:50%;right:50%;top:0;height:2px;background:var(--c);box-shadow:0 0 12px var(--c);animation:ax .55s cubic-bezier(.7,0,.2,1) forwards}
  @keyframes ax{to{left:3%;right:3%}}
  .axis span{position:absolute;top:-4px;font-family:var(--f-mono);font-size:10px;letter-spacing:.12em;color:#9fe;transform:translateX(-50%);padding-top:18px;opacity:0;animation:yr .3s forwards}
  .axis span b{position:absolute;left:50%;top:0;width:2px;height:12px;background:var(--c2);box-shadow:0 0 8px var(--c2)}
  @keyframes yr{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translateX(-50%)}}
  /* codex */
  .cells{position:absolute;inset:16% 14%;display:grid;grid-template-columns:repeat(12,1fr);gap:10px;opacity:.5}
  .cells i{border:1px solid rgba(252,238,10,.35);background:rgba(252,238,10,.04);opacity:0;animation:cl .35s forwards}
  .cells i.w{background:rgba(0,240,255,.14);border-color:rgba(0,240,255,.5)}
  @keyframes cl{0%{opacity:0;transform:rotateX(90deg)}60%{opacity:1}100%{opacity:.7;transform:none}}
  /* starmap */
  .radar{position:absolute;inset:0}
  .radar .r1,.radar .r2,.radar .r3{position:absolute;left:50%;top:50%;border:1px solid rgba(125,249,255,.35);border-radius:50%;transform:translate(-50%,-50%) scale(.1);animation:rg .9s cubic-bezier(.2,.8,.3,1) forwards}
  .r1{width:30vmin;height:30vmin}.r2{width:60vmin;height:60vmin;animation-delay:.08s!important}.r3{width:95vmin;height:95vmin;animation-delay:.16s!important}
  @keyframes rg{to{transform:translate(-50%,-50%) scale(1)}}
  .radar .sw{position:absolute;left:50%;top:50%;width:95vmin;height:95vmin;transform:translate(-50%,-50%);border-radius:50%;background:conic-gradient(from 0deg,rgba(125,249,255,.32),transparent 60deg);animation:sw 1.1s linear forwards;mask-image:radial-gradient(circle,#000 60%,transparent 71%)}
  @keyframes sw{from{transform:translate(-50%,-50%) rotate(0)}to{transform:translate(-50%,-50%) rotate(400deg)}}
  .radar b{position:absolute;background:#fff;border-radius:50%;box-shadow:0 0 6px #7df9ff;opacity:0;animation:st .3s forwards}
  @keyframes st{to{opacity:.9}}
</style>
