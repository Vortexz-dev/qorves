<script lang="ts">
  import { session, logout, lock } from '../lib/session.svelte';
  import { settings, saveSettings } from '../lib/settings.svelte';
  import { RACES } from '../lib/data/character';
  import { sfx } from '../lib/sfx';
  import { visibleApps } from './apps';
  import { ICONS } from './icons';
  import { wm, openApp, resetWM } from './wm.svelte';
  const u = session.user!;
  const race = RACES.find((r) => r.id === u.character?.race)?.label;
  function out(fn: () => void) { sfx.close(); resetWM(); fn(); }
</script>

<div class="sp" role="dialog" tabindex="-1" onpointerdown={(e) => e.stopPropagation()}>
  <div class="me">
    <img src={u.avatar} alt="" />
    <div><b>{u.username}</b><span class="mono">{u.role === 'dm' ? 'DUNGEON MASTER · TAM ERİŞİM' : `${u.character?.name ?? ''}${race ? ' · ' + race : ''}`}</span></div>
  </div>
  <div class="sec mono">UYGULAMALAR</div>
  <div class="apps">
    {#each visibleApps(u) as a}
      <button class="app" class:core={a.core} onclick={() => openApp(a.id)} onmouseenter={() => sfx.hover()}>
        <span class="ic">{@html ICONS[a.icon]}</span>{a.title}{#if a.core}<i class="mono">ÇEKİRDEK</i>{/if}
      </button>
    {/each}
  </div>
  <div class="sec mono">AYARLAR</div>
  <label class="tg clickable"><input type="checkbox" bind:checked={settings.scanlines} onchange={saveSettings} /> Tarama çizgileri</label>
  <label class="tg clickable"><input type="checkbox" bind:checked={settings.reduceMotion} onchange={saveSettings} /> Animasyonları azalt</label>
  <div class="foot">
    <button class="btn ghost" onclick={() => out(lock)}>Kilitle</button>
    <button class="btn red" onclick={() => out(logout)}>Oturumu kapat</button>
  </div>
</div>

<style>
  .sp{position:absolute;left:8px;bottom:56px;width:340px;z-index:9001;padding:18px;display:flex;flex-direction:column;gap:10px;
    background:rgba(8,11,19,.94);backdrop-filter:blur(14px);border:1px solid rgba(0,240,255,.35);
    clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%);animation:sp .22s cubic-bezier(.2,.9,.2,1) both;box-shadow:0 0 40px rgba(0,0,0,.6)}
  .sp::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(var(--ye),var(--rd))}
  @keyframes sp{from{opacity:0;transform:translateY(16px) scaleY(.9);transform-origin:bottom}}
  .me{display:flex;gap:14px;align-items:center;padding-bottom:12px;border-bottom:1px solid var(--line)}
  .me img{width:56px;height:56px;object-fit:cover;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
  .me b{display:block;font-size:18px;color:var(--ye);letter-spacing:.06em}.me span{font-size:11px;color:var(--mut);letter-spacing:.1em}
  .sec{font-size:10.5px;letter-spacing:.3em;color:var(--cy);margin-top:4px}
  .apps{display:flex;flex-direction:column;gap:2px}
  .app{display:flex;align-items:center;gap:12px;padding:7px 10px;background:none;border:1px solid transparent;color:var(--tx);font-family:var(--f-ui);font-size:15px;font-weight:600;text-align:left}
  .app:hover{background:rgba(0,240,255,.08);border-color:rgba(0,240,255,.3)}
  .app .ic{width:26px;height:26px}.app .ic :global(svg){width:100%;height:100%}
  .app i{margin-left:auto;font-style:normal;font-size:9.5px;color:var(--ye);letter-spacing:.2em;border:1px solid rgba(252,238,10,.4);padding:1px 5px}
  .tg{display:flex;gap:10px;align-items:center;font-size:14px;padding:2px 10px}.tg input{accent-color:var(--ye)}
  .foot{display:flex;gap:10px;margin-top:8px;padding-top:12px;border-top:1px solid var(--line)}.foot .btn{flex:1;padding:9px 10px;font-size:12px}
</style>
