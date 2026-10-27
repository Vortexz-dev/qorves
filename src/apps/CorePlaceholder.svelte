<script lang="ts">
  let { name, phase, lines }: { name: string; phase: string; lines: string[] } = $props();
</script>
<div class="ph">
  <div class="ring"><i></i><i></i><i></i></div>
  <h1 class="glitch" data-text={name}>{name}</h1>
  <div class="mono st">MODÜL KURULUYOR · {phase}</div>
  <ul class="mono">{#each lines as l, i}<li style:--d="{0.9 + i * 0.18}s">▸ {l}</li>{/each}</ul>
</div>
<style>
  .ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
    background:radial-gradient(800px 500px at 50% 50%,rgba(0,240,255,.08),transparent 70%)}
  .ring{position:relative;width:150px;height:150px}
  .ring i{position:absolute;inset:0;border:1px solid rgba(0,240,255,.5);border-radius:50%;border-top-color:var(--ye);animation:sp 6s linear infinite}
  .ring i:nth-child(2){inset:18px;border-color:rgba(255,42,85,.4);border-right-color:var(--cy);animation-duration:4s;animation-direction:reverse}
  .ring i:nth-child(3){inset:44px;background:radial-gradient(circle,rgba(252,238,10,.5),transparent 70%);border:0;animation:pu 2.4s ease-in-out infinite}
  @keyframes sp{to{transform:rotate(360deg)}}@keyframes pu{50%{transform:scale(.7);opacity:.5}}
  h1{font-family:var(--f-disp);font-weight:900;font-size:clamp(30px,5vw,56px);letter-spacing:.22em;color:var(--tx);text-shadow:0 0 24px rgba(0,240,255,.5)}
  .st{color:var(--ye);letter-spacing:.35em;font-size:13px}
  ul{list-style:none;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--mut);margin-top:10px}
  li{opacity:0;animation:li .4s var(--d) forwards}@keyframes li{to{opacity:1}}
</style>
