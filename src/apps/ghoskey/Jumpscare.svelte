<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../lib/sfx';
  import { settings } from '../../lib/settings.svelte';
  let { ondone }: { ondone: () => void } = $props();
  let phase = $state(0);
  onMount(() => {
    sfx.laugh();
    const t = [
      setTimeout(() => (phase = 1), settings.reduceMotion ? 80 : 180),
      setTimeout(() => (phase = 2), settings.reduceMotion ? 400 : 700),
      setTimeout(() => (phase = 3), settings.reduceMotion ? 700 : 1250),
      setTimeout(ondone, settings.reduceMotion ? 900 : 1600),
    ];
    return () => t.forEach(clearTimeout);
  });
</script>
<div class="js" class:p1={phase>=1} class:p2={phase>=2} class:p3={phase>=3} role="img" aria-label="Sızma uyarısı">
  <svg viewBox="0 0 200 240" class="sk">
    <path d="M100 18c-44 0-70 32-70 74 0 28 10 46 22 62l-8 28 28-12 14 26 14-26 28 12-8-28c12-16 22-34 22-62 0-42-26-74-70-74z" fill="#0b0b0b" stroke="#39ff8a" stroke-width="3"/>
    <ellipse cx="72" cy="96" rx="16" ry="20" fill="#39ff8a"/>
    <ellipse cx="128" cy="96" rx="16" ry="20" fill="#39ff8a"/>
    <path class="mouth" d="M62 150c18 8 58 8 76 0 2 8-10 28-38 28S60 158 62 150z" fill="#39ff8a"/>
    <path d="M70 200h60M80 208h40" stroke="#39ff8a" stroke-width="2" opacity=".5"/>
  </svg>
  <div class="sw"></div>
</div>
<style>
  .js{position:fixed;inset:0;z-index:20000;background:#000;display:grid;place-items:center;overflow:hidden}
  .sk{width:min(70vmin,520px);height:auto;filter:drop-shadow(0 0 18px #39ff8a);animation:g 80ms steps(2) infinite}
  .p1 .sk{transform:scale(1.15)}
  .p2 .mouth{d:path("M50 148c20 28 80 28 100 0 4 20-16 70-50 70S46 168 50 148z")}
  .p2 .sk{transform:scale(2.2);transition:transform .45s cubic-bezier(.2,.8,.2,1)}
  .p3{background:#000}
  .p3 .sk{transform:scale(18);opacity:0;transition:transform .4s linear,opacity .35s}
  .sw{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(57,255,138,.08) 0 1px,transparent 1px 3px);mix-blend-mode:screen}
  @keyframes g{50%{filter:drop-shadow(3px 0 0 #ff2a55) drop-shadow(-3px 0 0 #39ff8a);transform:translateX(2px)}}
</style>
