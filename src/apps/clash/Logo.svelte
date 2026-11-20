<script lang="ts">
  /* CROWN CLASH logosu: SVG tipografi (üretilmiş görsel yok). Altın taç + "CROWN" kabartma, "CLASH" iki takım rengiyle yarılmış. */
  let { size = 1, anim = true, sub = '' }: { size?: number; anim?: boolean; sub?: string } = $props();
</script>

<div class="lg" class:anim style={`--s:${size}`}>
  <svg viewBox="0 0 640 300" aria-label="CROWN CLASH">
    <defs>
      <linearGradient id="cc-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8" /><stop offset=".45" stop-color="#ffd257" /><stop offset=".55" stop-color="#d99a1e" /><stop offset="1" stop-color="#7a4a08" /></linearGradient>
      <linearGradient id="cc-cy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaffff" /><stop offset=".5" stop-color="#3ff0ff" /><stop offset="1" stop-color="#0077a8" /></linearGradient>
      <linearGradient id="cc-mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6ee" /><stop offset=".5" stop-color="#ff3b6b" /><stop offset="1" stop-color="#8a0b2c" /></linearGradient>
      <clipPath id="cc-l"><polygon points="0,0 352,0 288,300 0,300" /></clipPath>
      <clipPath id="cc-r"><polygon points="360,0 640,0 640,300 296,300" /></clipPath>
      <filter id="cc-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <!-- taç -->
    <g class="crown" filter="url(#cc-glow)">
      <path d="M262 92 L250 30 L288 62 L320 14 L352 62 L390 30 L378 92 Z" fill="url(#cc-gold)" stroke="#2b1600" stroke-width="5" stroke-linejoin="round" />
      <rect x="258" y="92" width="124" height="14" rx="3" fill="url(#cc-gold)" stroke="#2b1600" stroke-width="4" />
      <circle cx="320" cy="16" r="7" fill="#ff3b6b" stroke="#2b1600" stroke-width="3" /><circle cx="250" cy="30" r="6" fill="#3ff0ff" stroke="#2b1600" stroke-width="3" /><circle cx="390" cy="30" r="6" fill="#3ff0ff" stroke="#2b1600" stroke-width="3" />
      <circle cx="320" cy="72" r="8" fill="#3ff0ff" stroke="#2b1600" stroke-width="3" />
    </g>
    <!-- CROWN -->
    <g class="w1">
      <text x="320" y="170" text-anchor="middle" class="t1" fill="#1a0d00" transform="translate(0 6)">CROWN</text>
      <text x="320" y="170" text-anchor="middle" class="t1" fill="url(#cc-gold)" stroke="#2b1600" stroke-width="3" paint-order="stroke">CROWN</text>
    </g>
    <!-- CLASH: sol mavi / sağ kırmızı -->
    <g class="w2">
      <text x="320" y="272" text-anchor="middle" class="t2" fill="#05070c" transform="translate(0 8)">CLASH</text>
      <g clip-path="url(#cc-l)" class="hl"><text x="320" y="272" text-anchor="middle" class="t2" fill="url(#cc-cy)" stroke="#001a24" stroke-width="4" paint-order="stroke">CLASH</text></g>
      <g clip-path="url(#cc-r)" class="hr"><text x="320" y="272" text-anchor="middle" class="t2" fill="url(#cc-mg)" stroke="#24000a" stroke-width="4" paint-order="stroke">CLASH</text></g>
      <path class="cut" d="M356 176 L292 290" stroke="#fcee0a" stroke-width="6" stroke-linecap="round" />
    </g>
  </svg>
  {#if sub}<div class="sub">{sub}</div>{/if}
</div>

<style>
  .lg{width:calc(560px * var(--s));max-width:92vw;display:grid;justify-items:center;pointer-events:none}
  svg{width:100%;height:auto;overflow:visible;filter:drop-shadow(0 12px 30px rgba(0,0,0,.6))}
  .t1{font-family:var(--f-disp,'Orbitron',sans-serif);font-weight:900;font-size:78px;letter-spacing:10px}
  .t2{font-family:var(--f-disp,'Orbitron',sans-serif);font-weight:900;font-size:118px;letter-spacing:6px;font-style:italic}
  .sub{margin-top:calc(4px * var(--s));font-family:var(--f-mono,monospace);letter-spacing:.5em;font-size:calc(14px * var(--s));color:#cfe6f2;text-shadow:0 0 10px rgba(0,0,0,.9)}
  .anim .crown{animation:cdrop .8s cubic-bezier(.2,1.5,.4,1) .55s both,cfloat 4s ease-in-out 1.4s infinite;transform-origin:320px 60px}
  .anim .w1{animation:wfade .5s ease-out .1s both}
  .anim .hl{animation:sl .55s cubic-bezier(.2,1.2,.3,1) .25s both}
  .anim .hr{animation:sr .55s cubic-bezier(.2,1.2,.3,1) .25s both}
  .anim .cut{stroke-dasharray:140;animation:cut .35s ease-out .75s both}
  .anim .sub{animation:wfade .6s ease-out 1.1s both}
  .crown{animation:cfloat 4s ease-in-out 1.4s infinite}
  @keyframes cdrop{from{transform:translateY(-120px) scale(1.6) rotate(-10deg);opacity:0}}
  @keyframes wfade{from{opacity:0;transform:translateY(14px)}}
  @keyframes sl{from{transform:translateX(-240px);opacity:0}}
  @keyframes sr{from{transform:translateX(240px);opacity:0}}
  @keyframes cut{from{stroke-dashoffset:140}to{stroke-dashoffset:0}}
  @keyframes cfloat{50%{transform:translateY(-5px)}}
</style>
