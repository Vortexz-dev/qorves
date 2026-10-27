<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { backend } from '../lib/backend';
  import { sfx } from '../lib/sfx';
  import Backdrop from '../ui/Backdrop.svelte';
  import Logo from '../ui/Logo.svelte';
  import { APPS } from './apps';
  import { ICONS } from './icons';
  import { wm, openApp, resetWM } from './wm.svelte';
  import Taskbar from './Taskbar.svelte';
  import StartPanel from './StartPanel.svelte';
  import Window from './Window.svelte';
  import CoreShell from './CoreShell.svelte';

  const GX = 104, GY = 112, OX = 18, OY = 18;
  const user = session.user!;
  const desk = APPS.filter((a) => a.id !== 'profile');
  const pos = $state<Record<string, { x: number; y: number }>>({});
  desk.forEach((a, i) => (pos[a.id] = user.desktop?.icons?.[a.id] ?? { x: OX, y: OY + i * GY }));
  let sel = $state(''), drag = $state(''), entered = $state(false);

  let start = { px: 0, py: 0, x: 0, y: 0, moved: false };
  function down(e: PointerEvent, id: string) {
    if (e.button !== 0) return;
    sel = id; drag = id; start = { px: e.clientX, py: e.clientY, x: pos[id].x, y: pos[id].y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent, id: string) {
    if (drag !== id) return;
    const dx = e.clientX - start.px, dy = e.clientY - start.py;
    if (!start.moved && Math.hypot(dx, dy) < 5) return;
    start.moved = true; pos[id] = { x: start.x + dx, y: start.y + dy };
  }
  function up(id: string) {
    if (drag !== id) return; drag = '';
    if (!start.moved) return;
    const maxX = innerWidth - GX, maxY = innerHeight - 48 - GY;
    let x = Math.min(maxX, Math.max(OX, OX + Math.round((pos[id].x - OX) / GX) * GX));
    let y = Math.min(maxY, Math.max(OY, OY + Math.round((pos[id].y - OY) / GY) * GY));
    const taken = (x: number, y: number) => desk.some((a) => a.id !== id && pos[a.id].x === x && pos[a.id].y === y);
    while (taken(x, y)) { y += GY; if (y > maxY) { y = OY; x += GX; } }
    pos[id] = { x, y }; sfx.click();
    const icons = $state.snapshot(pos);
    backend.patchProfile(user.uid, { desktop: { icons } }).catch(() => {});
    user.desktop = { icons };
  }
  onMount(() => {
    resetWM();
    const t = setTimeout(() => (entered = true), 30);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && wm.start) wm.start = false; };
    addEventListener('keydown', esc);
    return () => { clearTimeout(t); removeEventListener('keydown', esc); };
  });
</script>

<div class="desk" class:entered class:hidden={!!wm.core && !wm.coreClosing}>
  <Backdrop dim={0.05} />
  <div class="brand"><Logo size={22} glitch={false} /><span class="mono">KİŞİSEL TERMİNAL · {user.username.toUpperCase()}</span></div>
  <div class="area" role="presentation" onpointerdown={(e) => { if (e.target === e.currentTarget) { sel = ''; wm.start = false; } }}>
    {#each desk as a, i (a.id)}
      <button class="icon" class:sel={sel === a.id} class:drag={drag === a.id} class:core={a.core}
        style:left="{pos[a.id].x}px" style:top="{pos[a.id].y}px" style:--d="{i * 60}ms"
        onpointerdown={(e) => down(e, a.id)} onpointermove={(e) => move(e, a.id)} onpointerup={() => up(a.id)}
        ondblclick={() => openApp(a.id)} onkeydown={(e) => e.key === 'Enter' && openApp(a.id)} onmouseenter={() => sfx.hover()}>
        <span class="ic">{@html ICONS[a.icon]}</span><span class="lb">{a.title}</span>
      </button>
    {/each}
  </div>
  {#each wm.wins as w (w.id)}<Window win={w} />{/each}
  {#if wm.start}<StartPanel />{/if}
  <Taskbar />
</div>
{#if wm.core}<CoreShell id={wm.core} />{/if}

<style>
  .desk{position:absolute;inset:0;overflow:hidden;opacity:0;transform:scale(1.03);filter:blur(6px);transition:opacity .6s,transform .7s cubic-bezier(.2,.8,.2,1),filter .6s}
  .desk.entered{opacity:1;transform:none;filter:none}
  .desk.hidden{visibility:hidden}
  .brand{position:absolute;right:26px;top:20px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;opacity:.75;pointer-events:none}
  .brand span{font-size:10px;letter-spacing:.3em;color:var(--mut)}
  .area{position:absolute;left:0;right:0;top:0;bottom:48px}
  .icon{position:absolute;width:92px;height:100px;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 4px;
    background:none;border:1px solid transparent;color:var(--tx);font-family:var(--f-ui);touch-action:none;
    animation:iin .45s var(--d) both cubic-bezier(.2,.8,.2,1)}
  @keyframes iin{from{opacity:0;transform:translateX(-14px)}}
  .icon:hover{background:rgba(0,240,255,.06);border-color:rgba(0,240,255,.25)}
  .icon.sel{background:rgba(252,238,10,.08);border-color:var(--ye)}
  .icon.drag{opacity:.85;z-index:5;transition:none}
  .icon:not(.drag){transition:left .18s,top .18s}
  .ic{width:50px;height:50px;display:block;filter:drop-shadow(0 0 6px rgba(0,240,255,.45))}
  .icon:hover .ic{filter:drop-shadow(0 0 10px rgba(0,240,255,.8))}
  .ic :global(svg){width:100%;height:100%}
  .lb{font-size:13px;font-weight:600;line-height:1.1;text-align:center;text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,.8)}
  .core .lb{color:var(--ye)}
</style>
