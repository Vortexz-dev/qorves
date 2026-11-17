<script lang="ts">
  let { title, text, onstart }: { title: string; text: string; onstart: () => void } = $props();
</script>
<div class="hp">
  <div class="mono k">? YARDIM</div>
  <h3>{title}</h3>
  <p>{text}</p>
  <button class="btn" onclick={onstart}>Anladım — başlamak için etkileşime geç</button>
</div>
<style>
  .hp{position:absolute;inset:0;z-index:3;background:rgba(0,0,0,.86);display:grid;place-content:center;justify-items:center;gap:10px;padding:24px;text-align:center}
  .k{letter-spacing:.3em;color:#39ff8a}h3{font-family:var(--f-disp);color:#fff;font-size:28px}
  p{max-width:52ch;color:#cfe;line-height:1.5}
</style>
