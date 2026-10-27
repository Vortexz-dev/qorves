<!-- Statik neon şehir arka planı: canvas yok, sürekli çizim yok. -->
<script lang="ts">let { dim = 0 }: { dim?: number } = $props();</script>
<div class="bd" style:--dim={dim}>
  <div class="sky"></div>
  <svg class="city" viewBox="0 0 1600 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="bf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1424"/><stop offset="1" stop-color="#05060b"/></linearGradient>
      <linearGradient id="bn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a2e"/><stop offset="1" stop-color="#070910"/></linearGradient>
    </defs>
    <path fill="url(#bf)" opacity=".7" d="M0 420V250h40v-60h30v40h25V150h50v80h20v-50h40v90h35V120h18V90h14v30h18v140h30v-70h45v90h20V170h55v100h25v-40h30v60h40V100h12V60h8v40h12v170h35v-90h50v120h30v-60h45v80h20V140h60v130h25v-70h40v100h30V180h45v80h35V110h14V70h10v40h14v160h40v-60h50v90h30v-120h45v120h25v-70h40v100h40V160h55v110h30v-40h40v190z"/>
    <path fill="url(#bn)" d="M0 420V320h60v-50h40v70h35v-90h60v110h30v-40h55v60h25V230h70v120h20v-30h50v50h45V260h35v-30h20v30h30v110h40v-70h60v90h30v-120h50v130h25v-50h45v60h35V250h65v110h20v-40h55v60h40v-90h45v100h30V290h50v60h35v-40h45v110z"/>
    <g class="win" fill="#00f0ff">
      {#each Array(70) as _, i}<rect x={(i * 233) % 1580 + 10} y={260 + ((i * 97) % 140)} width={i % 3 ? 3 : 6} height="2" opacity={0.25 + (i % 5) / 8} />{/each}
    </g>
    <g fill="#fcee0a">{#each Array(22) as _, i}<rect x={(i * 389) % 1560 + 20} y={300 + ((i * 53) % 100)} width="4" height="2" opacity=".55" />{/each}</g>
    <g fill="#ff2a55"><rect x="463" y="226" width="3" height="3" class="beacon"/><rect x="1043" y="66" width="3" height="3" class="beacon b2"/><rect x="1253" y="66" width="3" height="3" class="beacon"/></g>
  </svg>
  <div class="grid"></div>
  <div class="vig"></div>
</div>
<style>
  .bd{position:absolute;inset:0;overflow:hidden;background:#05060b}
  .sky{position:absolute;inset:0;background:
    radial-gradient(1200px 520px at 78% 108%,rgba(255,42,85,.32),transparent 60%),
    radial-gradient(900px 480px at 12% 100%,rgba(0,240,255,.20),transparent 60%),
    radial-gradient(700px 400px at 50% -10%,rgba(120,60,255,.18),transparent 65%),
    linear-gradient(#070812,#0a0c18 60%,#140a1a)}
  .sky::before{content:"";position:absolute;inset:0;background-image:
    radial-gradient(1px 1px at 10% 20%,#fff8,transparent),radial-gradient(1px 1px at 30% 8%,#fff6,transparent),
    radial-gradient(1px 1px at 52% 26%,#fff5,transparent),radial-gradient(1.5px 1.5px at 71% 12%,#9ff,transparent),
    radial-gradient(1px 1px at 86% 30%,#fff6,transparent),radial-gradient(1px 1px at 92% 6%,#fff4,transparent),
    radial-gradient(1px 1px at 18% 38%,#fff3,transparent),radial-gradient(1px 1px at 63% 40%,#fff3,transparent)}
  .city{position:absolute;left:0;right:0;bottom:0;width:100%;height:58%}
  .beacon{animation:blink 2.4s steps(1) infinite}.b2{animation-delay:1.1s}
  .grid{position:absolute;left:-50%;right:-50%;bottom:-2px;height:34%;transform:perspective(420px) rotateX(62deg);transform-origin:bottom;
    background-image:linear-gradient(rgba(0,240,255,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(0,240,255,.16) 1px,transparent 1px);
    background-size:64px 64px;mask-image:linear-gradient(transparent,#000 60%)}
  .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.75));box-shadow:inset 0 0 0 9999px rgba(5,6,11,var(--dim))}
</style>
