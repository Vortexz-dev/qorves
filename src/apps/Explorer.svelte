<script lang="ts">
  import { autoSel } from '../lib/portal';
  // Klasör gezgini: klasör içeriği, gezinti, sağ tık, yeniden adlandırma, sürükle-bırak.
  import { desk, createFolder, renameItem, moveTo, removeItem, pathOf, dropTarget } from '../lib/desk.svelte';
  import { notes } from '../lib/notes.svelte';
  import { openImage } from '../lib/lightbox.svelte';
  import { openApp, type Win } from '../desktop/wm.svelte';
  import { ask } from '../lib/confirm.svelte';
  import { ICONS } from '../desktop/icons';
  import { sfx } from '../lib/sfx';
  import CtxMenu, { type MI } from '../ui/CtxMenu.svelte';
  import { portal } from '../lib/portal';
  let { arg, win }: { arg?: string; win: Win } = $props();
  let cur = $state(arg ?? ''), sel = $state(''), ren = $state(''), menu = $state<{ x: number; y: number; items: MI[] } | null>(null);
  const folder = $derived(desk.items.find((i) => i.id === cur));
  const path = $derived(pathOf(cur));
  $effect(() => { if (win) win.title = folder?.name ?? 'Masaüstü'; });
  $effect(() => { if (cur && desk.loaded && !folder) cur = ''; });
  type Row = { key: string; name: string; kind: 'folder' | 'image' | 'note'; src?: string };
  const rows = $derived<Row[]>([
    ...desk.items.filter((i) => i.parent === cur && i.kind === 'folder').sort((a, b) => a.name.localeCompare(b.name, 'tr')).map((i) => ({ key: i.id, name: i.name, kind: 'folder' as const })),
    ...desk.items.filter((i) => i.parent === cur && i.kind === 'image').sort((a, b) => a.name.localeCompare(b.name, 'tr')).map((i) => ({ key: i.id, name: i.name, kind: 'image' as const, src: i.src })),
    ...notes.list.filter((n) => (n.parent ?? '') === cur && cur).sort((a, b) => a.title.localeCompare(b.title, 'tr')).map((n) => ({ key: 'note:' + n.id, name: n.title || 'Adsız not', kind: 'note' as const })),
  ]);
  function open(r: Row) { sfx.click(); if (r.kind === 'folder') { cur = r.key; sel = ''; } else if (r.kind === 'image') openImage(r.src!, r.name); else openApp('notepad', r.key.slice(5)); }
  async function del(r: Row) {
    const msg = r.kind === 'folder' ? `"${r.name}" silinecek. İçindekiler bir üst klasöre taşınır.` : `"${r.name}" kalıcı olarak silinecek.`;
    if (!(await ask('Silinsin mi?', msg, 'Sil'))) return;
    if (r.kind === 'note') { const { removeNote } = await import('../lib/notes.svelte'); removeNote(r.key.slice(5)); } else removeItem(r.key);
  }
  function ctx(e: MouseEvent, r?: Row) {
    e.preventDefault(); e.stopPropagation(); sfx.click();
    menu = { x: e.clientX, y: e.clientY, items: r ? [{ label: 'Aç', act: () => open(r) }, { label: 'Yeniden adlandır', act: () => (ren = r.key) }, { label: 'Masaüstüne taşı', act: () => moveTo(r.key, '') , disabled: !cur }, { sep: true, label: '' }, { label: 'Sil', danger: true, act: () => del(r) }]
      : [{ label: 'Yeni klasör', act: async () => { ren = await createFolder(cur); } }, { label: 'Üst klasör', disabled: !cur, act: () => (cur = folder?.parent ?? '') }] };
  }
  // sürükle-bırak (hayalet simge)
  let dg = $state<{ key: string; name: string; x: number; y: number; on: boolean } | null>(null), sx = 0, sy = 0;
  function down(e: PointerEvent, r: Row) { if (e.button || ren) return; sel = r.key; sx = e.clientX; sy = e.clientY; dg = { key: r.key, name: r.name, x: e.clientX, y: e.clientY, on: false }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  function move(e: PointerEvent) { if (!dg) return; if (!dg.on && Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return; dg.on = true; dg.x = e.clientX; dg.y = e.clientY; }
  function up(e: PointerEvent) {
    const d = dg; dg = null; if (!d?.on) return;
    const t = dropTarget(e.clientX, e.clientY); if (!t || t.parent === d.key) return;
    if (t.parent === cur) return; sfx.click(); moveTo(d.key, t.parent, { x: e.clientX - 46, y: e.clientY - 40 });
  }
  function commit(key: string, v: string) { renameItem(key, v); ren = ''; }
</script>

<div class="ex" data-explorer={cur} role="presentation" oncontextmenu={(e) => ctx(e)} onpointerdown={() => { menu = null; }}>
  <div class="bar mono">
    <button disabled={!cur} onclick={() => (cur = folder?.parent ?? '')} aria-label="Geri">‹</button>
    <span class="crumbs"><button onclick={() => (cur = '')}>MASAÜSTÜ</button>{#each path as p (p.id)}<i>/</i><button onclick={() => (cur = p.id)}>{p.name.toLocaleUpperCase('tr')}</button>{/each}</span>
    <button class="nf" onclick={async () => (ren = await createFolder(cur))}>+ YENİ KLASÖR</button>
  </div>
  <div class="grid">
    {#each rows as r (r.key)}
      <button class="it" class:sel={sel === r.key} class:ghost={dg?.on && dg.key === r.key} data-folder={r.kind === 'folder' ? r.key : undefined}
        onpointerdown={(e) => down(e, r)} onpointermove={move} onpointerup={up} ondblclick={() => open(r)} oncontextmenu={(e) => { sel = r.key; ctx(e, r); }}
        onkeydown={(e) => { if (e.key === 'Enter' && !ren) open(r); if (e.key === 'F2') ren = r.key; }}>
        {#if r.kind === 'image'}<span class="th" data-nolb><img src={r.src} alt="" draggable="false" /></span>{:else}<span class="ic">{@html ICONS[r.kind === 'folder' ? 'folder' : 'note']}</span>{/if}
        {#if ren === r.key}
          <!-- svelte-ignore a11y_autofocus -->
          <input class="rn" value={r.name} use:autoSel onpointerdown={(e) => e.stopPropagation()}
            onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commit(r.key, (e.currentTarget as HTMLInputElement).value); if (e.key === 'Escape') ren = ''; }} onblur={(e) => commit(r.key, (e.currentTarget as HTMLInputElement).value)} />
        {:else}<span class="lb">{r.name}</span>{/if}
      </button>
    {:else}
      <div class="empty mono">KLASÖR BOŞ · ÖĞELERİ BURAYA SÜRÜKLE</div>
    {/each}
  </div>
  <div class="ft mono">{rows.length} öğe{#if folder} · {folder.name}{/if}</div>
</div>
{#if dg?.on}<div class="drag mono" use:portal style:left="{dg.x + 12}px" style:top="{dg.y + 10}px">{dg.name}</div>{/if}
{#if menu}<CtxMenu {...menu} close={() => (menu = null)} />{/if}

<style>
  .ex{position:absolute;inset:0;display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(0,240,255,.03),transparent 40%),repeating-linear-gradient(0deg,transparent 0 23px,rgba(0,240,255,.035) 23px 24px)}
  .bar{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line);font-size:11px;letter-spacing:.18em}
  .bar>button{background:none;border:1px solid var(--line);color:var(--cy);padding:4px 10px;font-family:var(--f-mono);font-size:11px}.bar>button:disabled{opacity:.3}
  .bar .nf{margin-left:auto;color:var(--ye);border-color:rgba(252,238,10,.45)}
  .crumbs{display:flex;align-items:center;gap:6px;overflow:hidden;white-space:nowrap}.crumbs button{background:none;border:0;color:var(--tx);font-family:var(--f-mono);font-size:11px;letter-spacing:.15em;padding:0}
  .crumbs button:hover{color:var(--ye)}.crumbs i{color:var(--mut);font-style:normal}
  .grid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,96px);grid-auto-rows:108px;gap:8px;padding:14px;align-content:start}
  .it{display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 4px;background:none;border:1px solid transparent;color:var(--tx);touch-action:none}
  .it:hover{background:rgba(0,240,255,.06);border-color:rgba(0,240,255,.25)}.it.sel{background:rgba(252,238,10,.08);border-color:var(--ye)}.it.ghost{opacity:.35}
  .ic{width:48px;height:48px;filter:drop-shadow(0 0 6px rgba(0,240,255,.45))}.ic :global(svg){width:100%;height:100%}
  .th{width:58px;height:48px;border:1px solid rgba(0,240,255,.5);overflow:hidden;box-shadow:0 0 8px rgba(0,240,255,.25)}.th img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
  .lb{font-size:12.5px;font-weight:600;line-height:1.1;text-align:center;max-width:90px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .rn{width:92px;font-size:12px;padding:2px 4px;background:#000;border:1px solid var(--ye);color:#fff;text-align:center}
  .empty{grid-column:1/-1;padding:40px;text-align:center;font-size:10.5px;letter-spacing:.25em;color:var(--mut);border:1px dashed var(--line)}
  .ft{padding:5px 12px;border-top:1px solid var(--line);font-size:10px;letter-spacing:.2em;color:var(--mut)}
  .drag{position:fixed;z-index:9999;pointer-events:none;font-size:11px;letter-spacing:.12em;color:#000;background:var(--ye);padding:4px 9px;box-shadow:0 0 16px rgba(252,238,10,.5)}
</style>
