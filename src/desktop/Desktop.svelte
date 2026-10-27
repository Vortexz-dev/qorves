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
  import { notes, loadNotes, createNote, updateNote, removeNote } from '../lib/notes.svelte';
  import { loadKb } from '../lib/kb.svelte';
  import { ask } from '../lib/confirm.svelte';

  const GX = 104, GY = 112, OX = 18, OY = 18;
  const user = session.user!;
  const desk = $derived(APPS.filter((a) => a.id !== 'profile' && (!a.optional || (user.apps ?? []).includes(a.id))));
  const pos = $state<Record<string, { x: number; y: number }>>({});
  const free = () => { for (let x = OX; ; x += GX) for (let y = OY; y <= innerHeight - 48 - GY; y += GY) if (!Object.values(pos).some((p) => p.x === x && p.y === y)) return { x, y }; };
  $effect.pre(() => { desk.forEach((a, i) => { if (!pos[a.id]) pos[a.id] = user.desktop?.icons?.[a.id] ?? (i < 6 ? { x: OX, y: OY + i * GY } : free()); }); });
  $effect.pre(() => { notes.list.forEach((n) => { pos['note:' + n.id] = { x: n.x, y: n.y }; }); });
  const ids = () => [...desk.map((a) => a.id), ...notes.list.map((n) => 'note:' + n.id)];
  let menu = $state<{ x: number; y: number; note?: string } | null>(null);
  const hasNotes = $derived((user.apps ?? []).includes('notepad'));
  function ctx(e: MouseEvent, note?: string) { e.preventDefault(); e.stopPropagation(); menu = { x: Math.min(e.clientX, innerWidth - 220), y: Math.min(e.clientY, innerHeight - 200), note }; sfx.click(); }
  function snap(px: number, py: number) {
    return { x: Math.max(OX, OX + Math.round((px - OX) / GX) * GX), y: Math.max(OY, OY + Math.round((py - OY) / GY) * GY) };
  }
  async function newNote() {
    const m = menu; menu = null; if (!m) return;
    let { x, y } = snap(m.x - 46, m.y - 40);
    while (ids().some((k) => pos[k]?.x === x && pos[k]?.y === y)) { y += GY; if (y > innerHeight - 48 - GY) { y = OY; x += GX; } }
    const id = await createNote(x, y); openApp('notepad', id);
  }
  async function delNote(id: string) {
    menu = null; const n = notes.list.find((x) => x.id === id);
    if (n && (await ask('Not silinsin mi?', `"${n.title || 'Adsız not'}" kalıcı olarak silinecek.`, 'Sil'))) { closeNoteWin(id); removeNote(id); }
  }
  import { closeAppWins } from './wm.svelte';
  const closeNoteWin = (id: string) => closeAppWins('notepad', id);
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
    const taken = (x: number, y: number) => ids().some((k) => k !== id && pos[k]?.x === x && pos[k]?.y === y);
    while (taken(x, y)) { y += GY; if (y > maxY) { y = OY; x += GX; } }
    pos[id] = { x, y }; sfx.click();
    if (id.startsWith('note:')) { updateNote(id.slice(5), { x, y }, true); return; }
    const icons = Object.fromEntries(Object.entries($state.snapshot(pos)).filter(([k]) => !k.startsWith('note:')));
    backend.patchProfile(user.uid, { desktop: { icons } }).catch(() => {});
    user.desktop = { icons };
  }
  onMount(() => {
    resetWM();
    if ((user.apps ?? []).includes('notepad')) loadNotes();
    const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500));
    idle(() => loadKb(user));
    const t = setTimeout(() => (entered = true), 30);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (menu) menu = null; else if (wm.start) wm.start = false; } };
    addEventListener('keydown', esc);
    return () => { clearTimeout(t); removeEventListener('keydown', esc); };
  });
</script>

<div class="desk" class:entered class:hidden={!!wm.core && !wm.coreClosing}>
  <Backdrop dim={0.05} />
  <div class="brand"><Logo size={22} glitch={false} /><span class="mono">KİŞİSEL TERMİNAL · {user.username.toUpperCase()}</span></div>
  <div class="area" role="presentation" onpointerdown={(e) => { menu = null; if (e.target === e.currentTarget) { sel = ''; wm.start = false; } }} oncontextmenu={(e) => ctx(e)}>
    {#each desk as a, i (a.id)}
      {#if pos[a.id]}<button class="icon" class:sel={sel === a.id} class:drag={drag === a.id} class:core={a.core}
        style:left="{pos[a.id].x}px" style:top="{pos[a.id].y}px" style:--d="{i * 60}ms"
        onpointerdown={(e) => down(e, a.id)} onpointermove={(e) => move(e, a.id)} onpointerup={() => up(a.id)}
        ondblclick={() => openApp(a.id)} onkeydown={(e) => e.key === 'Enter' && openApp(a.id)} onmouseenter={() => sfx.hover()}>
        <span class="ic">{@html ICONS[a.icon]}</span><span class="lb">{a.title}</span>
      </button>{/if}
    {/each}
    {#each notes.list as n, i (n.id)}
      {@const k = 'note:' + n.id}
      {#if pos[k]}
        <button class="icon note" class:sel={sel === k} class:drag={drag === k} style:left="{pos[k].x}px" style:top="{pos[k].y}px" style:--d="{(desk.length + i) * 60}ms"
          onpointerdown={(e) => down(e, k)} onpointermove={(e) => move(e, k)} onpointerup={() => up(k)} oncontextmenu={(e) => { sel = k; ctx(e, n.id); }}
          ondblclick={() => openApp('notepad', n.id)} onkeydown={(e) => e.key === 'Enter' && openApp('notepad', n.id)} onmouseenter={() => sfx.hover()}>
          <span class="ic">{@html ICONS.note}</span><span class="lb">{n.title || 'Adsız not'}</span>
        </button>
      {/if}
    {/each}
  </div>
  {#if menu}
    <div class="menu" style:left="{menu.x}px" style:top="{menu.y}px" role="menu">
      {#if menu.note}
        <button onclick={() => { const id = menu!.note!; menu = null; openApp('notepad', id); }}>Aç</button>
        <button class="dg" onclick={() => delNote(menu!.note!)}>Notu sil</button>
      {:else}
        <button disabled={!hasNotes} onclick={newNote}>Yeni not{#if !hasNotes}<small>Q-Mağaza'dan Not Defteri'ni kur</small>{/if}</button>
        <hr />
        <button onclick={() => { menu = null; openApp('codex'); }}>Qorves Codex</button>
        <button onclick={() => { menu = null; openApp('store'); }}>Q-Mağaza</button>
      {/if}
    </div>
  {/if}
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
  .note .ic{filter:drop-shadow(0 0 6px rgba(252,238,10,.45))}
  .lb{max-width:88px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .menu{position:absolute;z-index:9000;min-width:210px;padding:6px 0;background:rgba(6,9,16,.97);border:1px solid rgba(0,240,255,.5);box-shadow:0 12px 40px rgba(0,0,0,.6),0 0 18px rgba(0,240,255,.12);animation:mi .14s both}
  @keyframes mi{from{opacity:0;transform:translateY(-4px) scale(.98)}}
  .menu button{display:flex;flex-direction:column;align-items:flex-start;width:100%;padding:8px 16px;background:none;border:0;color:var(--tx);text-align:left;font-size:14.5px}
  .menu button:hover:not(:disabled){background:rgba(0,240,255,.12);color:#fff}.menu button:disabled{opacity:.45}
  .menu small{font-size:11px;color:var(--mut)}.menu .dg{color:var(--rd)}.menu hr{border:0;border-top:1px solid var(--line);margin:5px 0}
</style>
