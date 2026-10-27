<script lang="ts">let { size = 64, glitch = true }: { size?: number; glitch?: boolean } = $props();</script>
<div class="logo" style:font-size="{size}px">
  <svg viewBox="0 0 64 64" width={size * 1.05} height={size * 1.05} aria-hidden="true">
    <path d="M32 4 56 18v28L32 60 8 46V18z" fill="none" stroke="var(--cy)" stroke-width="2.5"/>
    <path d="M32 11 50 21.5v21L32 53 14 42.5v-21z" fill="none" stroke="var(--cy)" stroke-width="1" opacity=".45"/>
    <path d="M32 19a13 13 0 1 0 7.6 23.6L45 48l3.6-3.6-5.3-5.3A13 13 0 0 0 32 19zm0 5.6a7.4 7.4 0 1 1 0 14.8 7.4 7.4 0 0 1 0-14.8z" fill="var(--ye)"/>
  </svg>
  <span class:glitch data-text="QORVES">QORVES</span>
</div>
<style>
  .logo{display:flex;align-items:center;gap:.32em;font-family:var(--f-disp);font-weight:900;letter-spacing:.24em;line-height:1}
  span{color:var(--tx);text-shadow:0 0 18px rgba(0,240,255,.55),0 0 2px #fff}
  svg{filter:drop-shadow(0 0 10px rgba(0,240,255,.6))}
</style>
