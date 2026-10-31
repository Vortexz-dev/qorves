<script lang="ts">
  import { autoSel } from '../lib/portal';
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { backend } from '../lib/backend';
  import { sfx } from '../lib/sfx';
  import Backdrop from '../ui/Backdrop.svelte';
  import Logo from '../ui/Logo.svelte';
  import { APPS, visibleApps } from './apps';
  import { ICONS } from './icons';
  import { wm, openApp, resetWM } from './wm.svelte';
  import Taskbar from './Taskbar.svelte';
  import StartPanel from './StartPanel.svelte';
  import Window from './Window.svelte';
  import CoreShell from './CoreShell.svelte';
  import { notes, loadNotes, createNote, updateNote, removeNote } from '../lib/notes.svelte';
  import { loadKb, resetKb } from '../lib/kb.svelte';
  import { ask } from '../lib/confirm.svelte';
  import { desk as dk, loadItems, createFolder, renameItem, moveTo, removeItem, placeItem, dropTarget, setTakenProvider } from '../lib/desk.svelte';
  import { openImage } from '../lib/lightbox.svelte';
  import CtxMenu, { type MI } from '../ui/CtxMenu.svelte';
  import SysNotify, { pushToast } from '../ui/SysNotify.svelte';
  import { startPresence, watchDoc, watchKnowledge, watchDrops } from '../lib/live';
  import { ghos, startGhos, stopGhos } from '../lib/ghos.svelte';

  const GX = 104, GY = 112, OX = 18, OY = 18;
  const user = session.user!;
  const desk = $derived(visibleApps(user).filter((a) => a.id !== 'profile'));
  const pos = $state<Record<string, { x: number; y: number }>>({});
  const free = () => { for (let x = OX; ; x += GX) for (let y = OY; y <= innerHeight - 48 - GY; y += GY) if (!Object.values(pos).some((p) => p.x === x && p.y === y)) return { x, y }; };
  const taken = (q: { x: number; y: number }) => Object.values(pos).some((p) => p.x === q.x && p.y === q.y);
  $effect.pre(() => {
    desk.forEach((a) => { const sv = user.desktop?.icons?.[a.id]; if (!pos[a.id] && sv) pos[a.id] = sv; });
    desk.forEach((a, i) => { if (pos[a.id]) return; const d = { x: OX, y: OY + i * GY }; pos[a.id] = i < 6 && !taken(d) && d.y <= innerHeight - 48 - GY ? d : free()!; });
  });
  const dnotes = $derived(notes.list.filter((n) => !n.parent));
  const ditems = $derived(dk.items.filter((i) => i.parent === ''));
  let live = $state<{ x: number; y: number } | null>(null);
  /** Simge konumu: uygulamalar pos'ta, not/öğe kendi kaydında; sürüklenirken canlı konum. */
  const P = (k: string): { x: number; y: number } | undefined => drag === k && live ? live : k.startsWith('note:') ? notes.list.find((n) => 'note:' + n.id === k) : k.startsWith('it:') ? dk.items.find((i) => 'it:' + i.id === k) : pos[k];
  const ids = () => [...Object.keys(pos), ...dnotes.map((n) => 'note:' + n.id), ...ditems.map((i) => 'it:' + i.id)];
  setTakenProvider(() => ids().map((k) => P(k)!).filter(Boolean).map((p) => ({ x: p.x, y: p.y })));
  let menu = $state<{ x: number; y: number; items: MI[] } | null>(null), ren = $state('');
  const hasNotes = $derived((user.apps ?? []).includes('notepad'));
  const itemOf = (k: string) => dk.items.find((i) => 'it:' + i.id === k);
  const nameOf = (k: string) => k.startsWith('note:') ? (notes.list.find((n) => 'note:' + n.id === k)?.title || 'Adsız not') : itemOf(k)?.name ?? '';
  function openKey(k: string) {
    if (k.startsWith('note:')) return openApp('notepad', k.slice(5));
    const it = itemOf(k); if (it) { if (it.kind === 'folder') openApp('explorer', it.id); else if (it.kind === 'doc') openApp('docview', it.id); else openImage(it.src!, it.name); return; }
    openApp(k);
  }
  async function delKey(k: string) {
    const nm = nameOf(k), it = itemOf(k);
    const msg = it?.kind === 'folder' ? `"${nm}" klasörü silinecek. İçindekiler masaüstüne taşınır.` : `"${nm}" kalıcı olarak silinecek.`;
    if (!(await ask(k.startsWith('note:') ? 'Not silinsin mi?' : 'Silinsin mi?', msg, 'Sil'))) return;
    if (k.startsWith('note:')) { closeNoteWin(k.slice(5)); removeNote(k.slice(5)); } else if (it) { if (it.kind === 'folder') closeAppWins('explorer', it.id); removeItem(it.id); }
  }
  function ctx(e: MouseEvent, k?: string) {
    e.preventDefault(); e.stopPropagation(); sfx.click(); const x = e.clientX, y = e.clientY;
    if (k && (k.startsWith('note:') || k.startsWith('it:'))) menu = { x, y, items: [{ label: 'Aç', act: () => openKey(k) }, { label: 'Yeniden adlandır', act: () => (ren = k) }, { sep: true, label: '' }, { label: 'Sil', danger: true, act: () => delKey(k) }] };
    else if (k) menu = { x, y, items: [{ label: 'Aç', act: () => openKey(k) }] };
    else menu = { x, y, items: [
      { label: 'Yeni klasör', act: async () => { const id = await createFolder('', snap(x - 46, y - 40)); ren = 'it:' + id; } },
      { label: 'Yeni not', disabled: !hasNotes, hint: hasNotes ? '' : "Q-Mağaza'dan Not Defteri'ni kur", act: () => newNote(x, y) },
      { sep: true, label: '' }, { label: 'Qorves Codex', act: () => openApp('codex') }, { label: 'Q-Mağaza', act: () => openApp('store') }] };
  }
  function snap(px: number, py: number) {
    return { x: Math.max(OX, OX + Math.round((px - OX) / GX) * GX), y: Math.max(OY, OY + Math.round((py - OY) / GY) * GY) };
  }
  async function newNote(mx: number, my: number) {
    let { x, y } = snap(mx - 46, my - 40);
    while (ids().some((k) => P(k)?.x === x && P(k)?.y === y)) { y += GY; if (y > innerHeight - 48 - GY) { y = OY; x += GX; } }
    const id = await createNote(x, y); openApp('notepad', id);
  }
  import { closeAppWins } from './wm.svelte';
  const closeNoteWin = (id: string) => closeAppWins('notepad', id);
  let sel = $state(''), drag = $state(''), entered = $state(false);

  let start = { px: 0, py: 0, x: 0, y: 0, moved: false };
  function down(e: PointerEvent, id: string) {
    if (e.button !== 0 || ren === id) return;
    const p = P(id)!; sel = id; drag = id; live = null; start = { px: e.clientX, py: e.clientY, x: p.x, y: p.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent, id: string) {
    if (drag !== id) return;
    const dx = e.clientX - start.px, dy = e.clientY - start.py;
    if (!start.moved && Math.hypot(dx, dy) < 5) return;
    start.moved = true; const np = { x: start.x + dx, y: start.y + dy }; if (pos[id]) pos[id] = np; else live = np;
  }
  function up(e: PointerEvent, id: string) {
    if (drag !== id) return;
    if (!start.moved) { drag = ''; live = null; return; }
    // klasöre / gezgin penceresine bırakma
    if (id.startsWith('note:') || id.startsWith('it:')) {
      const el = e.currentTarget as HTMLElement; el.style.visibility = 'hidden'; const t = dropTarget(e.clientX, e.clientY); el.style.visibility = '';
      const self = id.startsWith('it:') ? id.slice(3) : '';
      if (t && t.parent && t.parent !== self) { drag = ''; live = null; sfx.click(); moveTo(id.startsWith('it:') ? self : id, t.parent); return; }
    }
    const maxX = innerWidth - GX, maxY = innerHeight - 48 - GY;
    const cp = P(id)!;
    let x = Math.min(maxX, Math.max(OX, OX + Math.round((cp.x - OX) / GX) * GX));
    let y = Math.min(maxY, Math.max(OY, OY + Math.round((cp.y - OY) / GY) * GY));
    const taken = (x: number, y: number) => ids().some((k) => k !== id && P(k)?.x === x && P(k)?.y === y);
    while (taken(x, y)) { y += GY; if (y > maxY) { y = OY; x += GX; } }
    sfx.click(); drag = ''; live = null;
    if (id.startsWith('note:')) { updateNote(id.slice(5), { x, y }, true); return; }
    if (id.startsWith('it:')) { placeItem(id.slice(3), x, y); return; }
    pos[id] = { x, y };
    const icons = Object.fromEntries(Object.entries($state.snapshot(pos)).filter(([k]) => !k.startsWith('note:') && !k.startsWith('it:')));
    backend.patchProfile(user.uid, { desktop: { icons } }).catch(() => {});
    user.desktop = { icons };
  }
  function commitRen(k: string, v: string) { renameItem(k.startsWith('it:') ? k.slice(3) : k, v); ren = ''; }
  let ghStarted = false;
  $effect(() => {
    const on = user.role === 'dm' || (user.apps ?? []).includes('ghos');
    if (on && !ghStarted) { ghStarted = true; startGhos(user.uid, user.role === 'dm', (c) => { sfx.ping();
      const who = c.last?.from ?? ''; const nm = c.names?.[who] ?? 'Bilinmeyen düğüm';
      pushToast('ghOS-Net', user.role === 'dm' ? `${c.names?.['npc:' + c.npc] ?? 'NPC'} ← ${nm}` : nm, '▒▒ şifreli paket alındı · çözmek için aç', () => openApp('ghos', c.id)); }); }
    else if (!on && ghStarted) { ghStarted = false; stopGhos(); }
  });
  onMount(() => {
    resetWM();
    loadNotes(); loadItems();
    const stopP = startPresence(user);
    const stopW = watchDoc<{ era: 'SS'; year: number; day: number }>(['world', 'state'], (w) => { if (w) session.world = { era: w.era ?? 'SS', year: w.year, day: w.day }; });

    const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500));
    idle(() => loadKb(user));
    // DM'den masaüstüne gelen belgeler: canlı eklenir, ilk yüklemeden sonra gelen için bildirim
    let dropFirst = true;
    const stopD = watchDrops(user.uid, (list) => {
      for (const it of list) if (!dk.items.some((x) => x.id === it.id)) { dk.items.push(it); if (!dropFirst) { sfx.glitch(); pushToast('Gelen aktarım', it.name, 'Masaüstüne yeni bir belge bırakıldı.', () => openApp('docview', it.id)); } }
      dropFirst = false;
    });
    // DM yeni bilgi açınca/kapatınca bilgi bankası yeniden kurulur
    const stopK = user.role === 'dm' ? () => {} : watchKnowledge(user.uid, () => { resetKb(); loadKb(user); sfx.granted(); pushToast('Codex', 'Bilgi erişimin güncellendi', 'Yeni kayıtlar Codex ve haritada.'); });
    const t = setTimeout(() => (entered = true), 30);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (menu) menu = null; else if (wm.start) wm.start = false; } };
    addEventListener('keydown', esc);
    return () => { clearTimeout(t); removeEventListener('keydown', esc); stopP(); stopW(); stopK(); stopD(); stopGhos(); };
  });
</script>

<div class="desk" class:entered class:hidden={!!wm.core && !wm.coreClosing}>
  <Backdrop dim={0.05} />
  <div class="brand"><Logo size={22} glitch={false} /><span class="mono">KİŞİSEL TERMİNAL · {user.username.toUpperCase()}</span></div>
  <div class="area" data-desk role="presentation" onpointerdown={(e) => { menu = null; if (e.target === e.currentTarget) { sel = ''; wm.start = false; } }} oncontextmenu={(e) => ctx(e)}>
    {#each desk as a, i (a.id)}
      {#if pos[a.id]}<button class="icon" class:sel={sel === a.id} class:drag={drag === a.id} class:core={a.core}
        style:left="{pos[a.id].x}px" style:top="{pos[a.id].y}px" style:--d="{i * 60}ms"
        onpointerdown={(e) => down(e, a.id)} onpointermove={(e) => move(e, a.id)} onpointerup={(e) => up(e, a.id)} oncontextmenu={(e) => { sel = a.id; ctx(e, a.id); }}
        ondblclick={() => openApp(a.id)} onkeydown={(e) => e.key === 'Enter' && openApp(a.id)} onmouseenter={() => sfx.hover()}>
        <span class="ic">{@html ICONS[a.icon]}</span><span class="lb">{a.title}</span>{#if a.id === 'ghos' && ghos.unread}<i class="badge mono">{ghos.unread}</i>{/if}
      </button>{/if}
    {/each}
    {#each [...dnotes.map((n) => ({ k: 'note:' + n.id, name: n.title || 'Adsız not', kind: 'note', src: '' })), ...ditems.map((it) => ({ k: 'it:' + it.id, name: it.name, kind: it.kind, src: it.src ?? '' }))] as o, i (o.k)}
      {@const op = P(o.k)}
      {#if op}
        <button class="icon {o.kind}" class:sel={sel === o.k} class:drag={drag === o.k} style:left="{op.x}px" style:top="{op.y}px" style:--d="{(desk.length + i) * 60}ms"
          data-folder={o.kind === 'folder' ? o.k.slice(3) : undefined}
          onpointerdown={(e) => down(e, o.k)} onpointermove={(e) => move(e, o.k)} onpointerup={(e) => up(e, o.k)} oncontextmenu={(e) => { sel = o.k; ctx(e, o.k); }}
          ondblclick={() => ren !== o.k && openKey(o.k)} onkeydown={(e) => { if (ren === o.k) return; if (e.key === 'Enter') openKey(o.k); if (e.key === 'F2') ren = o.k; if (e.key === 'Delete') delKey(o.k); }} onmouseenter={() => sfx.hover()}>
          {#if o.kind === 'image'}<span class="th" data-nolb><img src={o.src} alt="" draggable="false" /></span>{:else}<span class="ic">{@html ICONS[o.kind]}</span>{/if}
          {#if ren === o.k}
            <!-- svelte-ignore a11y_autofocus -->
            <input class="rn" value={o.name} use:autoSel onpointerdown={(e) => e.stopPropagation()} ondblclick={(e) => e.stopPropagation()}
              onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commitRen(o.k, (e.currentTarget as HTMLInputElement).value); if (e.key === 'Escape') ren = ''; }} onblur={(e) => commitRen(o.k, (e.currentTarget as HTMLInputElement).value)} />
          {:else}<span class="lb">{o.name}</span>{/if}
        </button>
      {/if}
    {/each}
  </div>
  {#if menu}<CtxMenu {...menu} close={() => (menu = null)} />{/if}
  {#each wm.wins as w (w.id)}<Window win={w} />{/each}
  {#if wm.start}<StartPanel />{/if}
  <Taskbar />
  <SysNotify uid={user.uid} />
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
  .th{width:58px;height:48px;border:1px solid rgba(0,240,255,.55);overflow:hidden;box-shadow:0 0 10px rgba(0,240,255,.3)}.th img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
  .folder .ic{filter:drop-shadow(0 0 6px rgba(0,240,255,.55))}
  .rn{width:92px;font-size:12px;padding:2px 4px;background:#000;border:1px solid var(--ye);color:#fff;text-align:center}
  .icon:not(.drag){transition:left .18s,top .18s}
  .ic{width:50px;height:50px;display:block;filter:drop-shadow(0 0 6px rgba(0,240,255,.45))}
  .icon:hover .ic{filter:drop-shadow(0 0 10px rgba(0,240,255,.8))}
  .ic :global(svg){width:100%;height:100%}
  .lb{font-size:13px;font-weight:600;line-height:1.1;text-align:center;text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,.8)}
  .core .lb{color:var(--ye)}
  .badge{position:absolute;top:2px;right:16px;min-width:18px;height:18px;padding:0 5px;background:#39ff8a;color:#000;font-style:normal;font-size:11px;line-height:18px;border-radius:9px;box-shadow:0 0 10px #39ff8a;animation:bp 1.4s infinite}
  @keyframes bp{50%{box-shadow:0 0 2px #39ff8a}}
  .note .ic{filter:drop-shadow(0 0 6px rgba(252,238,10,.45))}
  .lb{max-width:88px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
</style>
