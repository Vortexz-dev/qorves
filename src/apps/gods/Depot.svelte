<script lang="ts">
  // DM varlık deposu: masaüstünden ayrı. Klasör, görsel (çoklu yükleme / sürükle-bırak), not; ara, yeniden adlandır, taşı.
  import { saveDep, deleteDep, uploadImage, nid, now, type DepItem } from '../../lib/gods';
  import { dep, pathOf } from './store.svelte';
  import { ask } from '../../lib/confirm.svelte';
  import { sfx } from '../../lib/sfx';
  let q = $state(''), ac = $state(-1), ren = $state(''), renV = $state(''), note = $state<DepItem | null>(null), over = $state(false), err = $state('');
  let fileIn: HTMLInputElement;
  const here = $derived(dep.items.filter((i) => i.parent === dep.folder).sort((a, b) => (a.kind === 'folder' ? 0 : 1) - (b.kind === 'folder' ? 0 : 1) || a.name.localeCompare(b.name, 'tr')));
  const norm = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hits = $derived(q.trim() ? dep.items.filter((i) => norm(i.name).includes(norm(q.trim()))).sort((a, b) => +norm(b.name).startsWith(norm(q.trim())) - +norm(a.name).startsWith(norm(q.trim()))).slice(0, 8) : []);
  const used = $derived(dep.items.reduce((s, i) => s + (i.size ?? 0) + (i.body?.length ?? 0) + (i.thumb?.length ?? 0), 0));
  const LIM = 1024 ** 3;
  const fmt = (b: number) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.ceil(b / 1e3) + ' KB');
  function go(f: string) { dep.folder = f; sfx.click(); }
  function pick(i: DepItem) { q = ''; ac = -1; dep.folder = i.kind === 'folder' ? i.id : i.parent; dep.hi = i.id; setTimeout(() => dep.hi === i.id && (dep.hi = ''), 2200); if (i.kind === 'note') note = { ...i }; }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { ac = Math.min(hits.length - 1, ac + 1); e.preventDefault(); } else if (e.key === 'ArrowUp') { ac = Math.max(0, ac - 1); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[Math.max(0, ac)]) pick(hits[Math.max(0, ac)]); else if (e.key === 'Escape') q = '';
  }
  async function folder() {
    const names = new Set(here.filter((i) => i.kind === 'folder').map((i) => i.name)); let name = 'Yeni klasör'; for (let k = 2; names.has(name); k++) name = `Yeni klasör (${k})`;
    const it: DepItem = { id: nid(), kind: 'folder', name, parent: dep.folder, at: now() }; dep.items.push(it); ren = it.id; renV = name; await saveDep(it);
  }
  function newNote() { note = { id: nid(), kind: 'note', name: 'Yeni not', parent: dep.folder, at: now(), body: '' }; }
  async function saveNote() { if (!note) return; const it = { ...note, name: note.name.trim().slice(0, 80) || 'Not', body: (note.body ?? '').slice(0, 200000), at: now() }; const i = dep.items.findIndex((x) => x.id === it.id); if (i >= 0) dep.items[i] = it; else dep.items.push(it); await saveDep(it); sfx.granted(); note = null; }
  export async function upload(files: File[], parent = dep.folder) {
    err = ''; const out: DepItem[] = [];
    for (const f of files) {
      dep.busy++;
      try {
        if (f.type.startsWith('image/')) out.push(await uploadImage(f, parent));
        else if (/^text\/|\.(txt|md)$/i.test(f.type + ' ' + f.name) || /\.(txt|md)$/i.test(f.name)) { const it: DepItem = { id: nid(), kind: 'note', name: f.name.replace(/\.(txt|md)$/i, '').slice(0, 80), parent, at: now(), body: (await f.text()).slice(0, 200000) }; await saveDep(it); out.push(it); }
        else err = 'Desteklenmeyen dosya: ' + f.name;
      } catch (e) { err = 'Yüklenemedi: ' + f.name; console.warn(e); }
      dep.busy--;
    }
    if (out.length) sfx.granted(); return out;
  }
  async function rename(it: DepItem) { const v = renV.trim().slice(0, 80); ren = ''; if (!v || v === it.name) return; it.name = v; await saveDep($state.snapshot(it) as DepItem); }
  async function move(id: string, parent: string) {
    const it = dep.items.find((i) => i.id === id); if (!it || it.id === parent || it.parent === parent) return;
    for (let p = parent; p; p = dep.items.find((i) => i.id === p)?.parent ?? '') if (p === id) return;
    it.parent = parent; await saveDep($state.snapshot(it) as DepItem); sfx.click();
  }
  async function del(it: DepItem) {
    const kids = it.kind === 'folder' ? dep.items.filter((i) => pathOf(i.id).some((p) => p.id === it.id) && i.id !== it.id) : [];
    if (!(await ask('Silinsin mi?', `“${it.name}”${kids.length ? ` ve içindeki ${kids.length} öğe` : ''} depodan kalıcı olarak silinecek. Sahnelere yerleştirilmiş kopyalar görünmez olabilir.`, 'Sil'))) return;
    for (const x of [...kids, it]) { dep.items = dep.items.filter((i) => i.id !== x.id); await deleteDep(x).catch(() => {}); }
  }
  const dragStart = (e: DragEvent, it: DepItem) => { e.dataTransfer!.setData('text/ge-dep', it.id); e.dataTransfer!.effectAllowed = 'copyMove'; };
  const dropOn = (e: DragEvent, parent: string) => { const id = e.dataTransfer?.getData('text/ge-dep'); if (id) { e.preventDefault(); e.stopPropagation(); move(id, parent); } };
  function dropFiles(e: DragEvent) { over = false; const fs = [...(e.dataTransfer?.files ?? [])]; if (fs.length) { e.preventDefault(); upload(fs); } }
</script>
<div class="dp" class:over role="list" ondragover={(e) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); over = true; } }} ondragleave={() => (over = false)} ondrop={dropFiles}>
  <div class="sr">
    <input class="inp" placeholder="Depoda ara…" bind:value={q} onkeydown={key} oninput={() => (ac = 0)} />
    {#if hits.length}<div class="ac">{#each hits as h, i (h.id)}<button class:on={i === ac} onmousedown={(e) => { e.preventDefault(); pick(h); }}><i class="k {h.kind}"></i><b>{h.name}</b><small>{pathOf(h.parent).map((p) => p.name).join(' / ') || 'Depo'}</small></button>{/each}</div>{/if}
  </div>
  <div class="bc">
    <button ondragover={(e) => e.preventDefault()} ondrop={(e) => dropOn(e, '')} onclick={() => go('')}>Depo</button>
    {#each pathOf(dep.folder) as f (f.id)}<span>/</span><button ondragover={(e) => e.preventDefault()} ondrop={(e) => dropOn(e, f.id)} onclick={() => go(f.id)}>{f.name}</button>{/each}
  </div>
  <div class="act">
    <button class="btn small" onclick={() => fileIn.click()}>+ Görsel</button><button class="btn ghost small" onclick={folder}>+ Klasör</button><button class="btn ghost small" onclick={newNote}>+ Not</button>
    <input type="file" multiple accept="image/*,.txt,.md,text/plain" bind:this={fileIn} hidden onchange={() => { upload([...(fileIn.files ?? [])]); fileIn.value = ''; }} />
  </div>
  {#if dep.busy}<div class="bz mono">YÜKLENİYOR · {dep.busy}</div>{/if}{#if err}<div class="er">{err}</div>{/if}
  <div class="gr">
    {#if dep.folder}<button class="it up" ondblclick={() => go(pathOf(dep.folder).at(-2)?.id ?? '')} onclick={() => go(pathOf(dep.folder).at(-2)?.id ?? '')} ondragover={(e) => e.preventDefault()} ondrop={(e) => dropOn(e, pathOf(dep.folder).at(-2)?.id ?? '')}><span class="ic">↰</span><span class="nm">Üst klasör</span></button>{/if}
    {#each here as it (it.id)}
      <div class="it" class:hi={dep.hi === it.id} role="listitem" draggable="true" ondragstart={(e) => dragStart(e, it)}
        ondragover={(e) => it.kind === 'folder' && e.preventDefault()} ondrop={(e) => it.kind === 'folder' && dropOn(e, it.id)}
        ondblclick={() => (it.kind === 'folder' ? go(it.id) : it.kind === 'note' ? (note = { ...it }) : null)} title={it.kind === 'image' ? 'Sahneye sürükle' : it.kind === 'folder' ? 'Çift tıkla: aç' : 'Çift tıkla: düzenle · sahneye sürükle: metin'}>
        <span class="ic">{#if it.kind === 'image' && it.thumb}<img src={it.thumb} alt="" draggable="false" />{:else}<i class="k {it.kind}"></i>{/if}</span>
        {#if ren === it.id}<!-- svelte-ignore a11y_autofocus --><input class="rn" autofocus bind:value={renV} onblur={() => rename(it)} onkeydown={(e) => { if (e.key === 'Enter') rename(it); if (e.key === 'Escape') ren = ''; }} />
        {:else}<span class="nm" role="button" tabindex="-1" ondblclick={(e) => { e.stopPropagation(); ren = it.id; renV = it.name; }}>{it.name}</span>{/if}
        <span class="ops"><button onclick={() => { ren = it.id; renV = it.name; }} title="Yeniden adlandır">✎</button><button onclick={() => del(it)} title="Sil">×</button></span>
      </div>
    {:else}<div class="em">Bu klasör boş. Görselleri buraya sürükleyip bırakabilirsin.</div>{/each}
  </div>
  <div class="st" title="Spark planı: 1 GiB toplam Firestore alanı (yaklaşık)"><span class="mono">ALAN</span><i><b style:width="{Math.min(100, (used / LIM) * 100)}%"></b></i><small>{fmt(used)} / 1 GB</small></div>
  {#if note}
    <div class="ne" role="dialog" aria-label="Not">
      <input class="inp" bind:value={note.name} maxlength="80" />
      <textarea class="inp" bind:value={note.body} rows="10"></textarea>
      <div class="r"><button class="btn small" onclick={saveNote}>Kaydet</button><button class="btn ghost small" onclick={() => (note = null)}>Vazgeç</button></div>
    </div>
  {/if}
</div>
<style>
  .dp{position:relative;display:flex;flex-direction:column;gap:8px;padding:10px;flex:1;min-height:0}
  .dp.over{outline:2px dashed var(--cy);outline-offset:-6px;background:rgba(0,240,255,.05)}
  .sr{position:relative}.sr .inp{width:100%}
  .ac{position:absolute;left:0;right:0;top:100%;z-index:3;background:#060a12;border:1px solid rgba(0,240,255,.4);display:flex;flex-direction:column}
  .ac button{display:grid;grid-template-columns:18px 1fr;column-gap:8px;align-items:center;text-align:left;padding:6px 8px;background:none;border:none;color:#dde;font:inherit;cursor:pointer}
  .ac button.on,.ac button:hover{background:rgba(0,240,255,.12)}.ac b{font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ac small{grid-column:2;font-size:11px;color:var(--mut)}
  .bc{display:flex;flex-wrap:wrap;gap:3px;align-items:center;font-size:12.5px;color:var(--mut)}.bc button{background:none;border:none;color:var(--cy);font:inherit;padding:1px 3px;cursor:pointer}.bc button:hover{text-decoration:underline}
  .act{display:flex;gap:6px}
  .bz{font-size:10.5px;letter-spacing:.2em;color:var(--ye)}.er{font-size:12px;color:var(--rd)}
  .gr{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;align-content:start}
  .it{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 4px;border:1px solid transparent;background:rgba(255,255,255,.02);cursor:grab;color:#dde;font:inherit;min-width:0}
  .it:hover{border-color:rgba(0,240,255,.35)}.it.hi{border-color:var(--ye);box-shadow:0 0 12px rgba(252,238,10,.35)}
  .ic{width:100%;aspect-ratio:1;display:grid;place-items:center;background:repeating-conic-gradient(#11161f 0 25%,#0b0f16 0 50%) 0 0/14px 14px;overflow:hidden;font-size:22px;color:var(--cy)}
  .ic img{width:100%;height:100%;object-fit:contain}
  .nm{font-size:12px;width:100%;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rn{width:100%;font:inherit;font-size:12px;background:#000;border:1px solid var(--cy);color:#fff;padding:1px 3px}
  .ops{position:absolute;top:2px;right:2px;display:none;gap:2px}.it:hover .ops{display:flex}
  .ops button{width:18px;height:18px;padding:0;font-size:12px;line-height:1;background:rgba(0,0,0,.75);border:1px solid rgba(255,255,255,.2);color:#ddd;cursor:pointer}.ops button:last-child:hover{color:var(--rd);border-color:var(--rd)}
  .k{display:inline-block;width:26px;height:22px;background:currentColor;mask-size:contain;mask-repeat:no-repeat;mask-position:center}
  .k.folder{color:var(--ye);mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 20'%3E%3Cpath d='M0 2h9l2 3h13v15H0z'/%3E%3C/svg%3E")}
  .k.note{color:#cfe;width:20px;mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 24'%3E%3Cpath d='M0 0h13l7 7v17H0zM4 11h12v2H4zm0 4h12v2H4zm0 4h8v2H4z' fill-rule='evenodd'/%3E%3C/svg%3E")}
  .k.image{color:var(--cy);mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 20'%3E%3Cpath d='M0 0h24v20H0zm2 16h20l-6-8-5 6-3-3z' fill-rule='evenodd'/%3E%3C/svg%3E")}
  .ac .k{width:16px;height:14px}
  .em{grid-column:1/-1;font-size:12.5px;color:var(--mut);padding:14px 4px;text-align:center;line-height:1.5}
  .st{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;font-size:11px;color:var(--mut)}.st span{letter-spacing:.25em;font-size:9.5px}
  .st i{height:4px;background:rgba(255,255,255,.08)}.st b{display:block;height:100%;background:var(--cy)}
  .ne{position:absolute;inset:0;z-index:4;background:#05080e;padding:10px;display:flex;flex-direction:column;gap:8px}.ne textarea{flex:1;resize:none;font-family:var(--f-ui)}.r{display:flex;gap:6px}
</style>
