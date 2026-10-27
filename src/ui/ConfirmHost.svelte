<script lang="ts">
  import { dlg, answer } from '../lib/confirm.svelte';
</script>
{#if dlg.open}
  <div class="ov" role="presentation" onkeydown={(e) => e.key === 'Escape' && answer(false)}>
    <div class="box" class:danger={dlg.danger} role="alertdialog">
      <div class="mono k">{dlg.danger ? '⚠ UYARI' : 'ONAY'}</div>
      <h3>{dlg.title}</h3><p>{dlg.text}</p>
      <div class="act"><button class="btn ghost" onclick={() => answer(false)}>Vazgeç</button><button class="btn" class:red={dlg.danger} onclick={() => answer(true)}>{dlg.ok}</button></div>
    </div>
  </div>
{/if}
<style>
  .ov{position:fixed;inset:0;z-index:9900;background:rgba(0,0,0,.6);display:grid;place-items:center;animation:f .15s both}@keyframes f{from{opacity:0}}
  .box{width:440px;padding:22px 24px;background:#080b14;border:1px solid var(--cy);display:flex;flex-direction:column;gap:10px;animation:b .25s cubic-bezier(.2,.9,.2,1) both}
  .box.danger{border-color:var(--rd);box-shadow:0 0 30px rgba(255,42,85,.25)}
  @keyframes b{from{transform:scale(.92);opacity:0}}
  .k{font-size:10.5px;letter-spacing:.3em;color:var(--rd)}h3{font-family:var(--f-disp);font-size:19px;letter-spacing:.06em}p{color:#c9d6e2;line-height:1.5}
  .act{display:flex;justify-content:flex-end;gap:10px;margin-top:8px}
</style>
