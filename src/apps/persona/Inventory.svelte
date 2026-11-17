<script lang="ts">
  import type { Character } from '../../lib/backend';
  import { sfx } from '../../lib/sfx';
  import { ask } from '../../lib/confirm.svelte';
  import { ITEM_TYPES, maxCarry, hardCarry, carryOf, saveItem, dropItem, newItem, type InvItem, type ItemType, type Sheet } from '../../lib/persona';
  let { uid, c, sheet, inv }: { uid: string; c: Character; inv: InvItem[]; sheet: Sheet } = $props();
  let q = $state(''), typ = $state<'' | ItemType>(''), ed = $state<InvItem | null>(null), err = $state('');
  const kg = $derived(carryOf(inv));
  const cap = $derived(maxCarry(c.stats?.STR ?? 10));
  const hard = $derived(hardCarry(c.stats?.STR ?? 10));
  const enc = $derived(kg > cap);
  const list = $derived(inv.filter((i) => (!typ || i.type === typ) && (!q.trim() || (i.name + ' ' + (i.note ?? '')).toLocaleLowerCase('tr').includes(q.trim().toLocaleLowerCase('tr')))));
  const lab = (t: string) => ITEM_TYPES.find((x) => x.id === t)?.label ?? t;
  function openNew() { ed = newItem(); err = ''; sfx.click(); }
  function pick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f || !ed) return;
    if (f.size > 400_000) { err = 'Görsel çok büyük (en fazla ~300 KB).'; return; }
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'), s = Math.min(1, 160 / Math.max(img.width, img.height));
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      const url = cv.toDataURL('image/webp', 0.74);
      if (url.length > 110_000) { err = 'Görsel sıkışmadı, daha küçük bir resim dene.'; return; }
      ed = { ...ed!, img: url };
    };
    img.src = URL.createObjectURL(f);
  }
  async function save() {
    if (!ed || !ed.name.trim()) { err = 'İsim gerekli.'; return; }
    const others = inv.filter((i) => i.id !== ed!.id);
    const next = carryOf([...others, { ...ed, name: ed.name.trim(), kg: Math.max(0, +ed.kg || 0), qty: Math.max(1, +ed.qty || 1) }]);
    if (next > hard) { err = `Sert taşıma limiti (${hard} kg) aşılır.`; sfx.error(); return; }
    try {
      await saveItem(uid, { ...ed, name: ed.name.trim(), kg: Math.max(0, +ed.kg || 0), qty: Math.max(1, Math.floor(+ed.qty || 1)), note: ed.note?.slice(0, 400), at: Date.now() });
      sfx.granted(); ed = null; err = '';
    } catch (e) { err = String(e); sfx.error(); }
  }
  async function del(it: InvItem) {
    if (!(await ask('Eşya silinsin mi?', `"${it.name}" envanterden kalkacak.`, 'Sil'))) return;
    await dropItem(uid, it.id); sfx.close(); if (ed?.id === it.id) ed = null;
  }
  async function qty(it: InvItem, d: number) {
    const n = it.qty + d; if (n < 1) return del(it);
    const next = carryOf(inv.map((x) => x.id === it.id ? { ...x, qty: n } : x));
    if (next > hard) { sfx.error(); return; }
    await saveItem(uid, { ...it, qty: n }); sfx.click();
  }
  async function toggleEq(it: InvItem) { await saveItem(uid, { ...it, eq: !it.eq }); sfx.click(); }
</script>

<div class="inv">
  <div class="top">
    <div class="load" class:enc>
      <div class="mono h">TAŞIMA {kg.toFixed(1)} / {cap} kg <small>sert {hard} kg</small></div>
      <div class="bar"><i style:width="{Math.min(100, (kg / hard) * 100)}%"></i><s style:left="{(cap / hard) * 100}%"></s></div>
      {#if enc}<b class="warn mono">{kg > hard ? 'SERT LİMİT' : 'ENCUMBERED — AŞIRI YÜK'}</b>{/if}
    </div>
    <input class="inp" bind:value={q} placeholder="Eşya ara…" />
    <div class="fil">{#each [{ id: '', label: 'Hepsi' }, ...ITEM_TYPES] as t (t.id)}<button class:on={typ === t.id} onclick={() => (typ = t.id as typeof typ)}>{t.label}</button>{/each}</div>
    <button class="btn" onclick={openNew}>+ Eşya ekle</button>
  </div>
  <div class="body">
    <div class="grid">
      {#each list as it (it.id)}
        <button class="card" class:on={ed?.id === it.id} class:eq={it.eq} onclick={() => (ed = { ...it })}>
          <div class="pic">{#if it.img}<img src={it.img} alt="" />{:else}<span class="mono">{lab(it.type)[0]}</span>{/if}</div>
          <div class="tx"><b>{it.name}</b><small class="mono">{lab(it.type)} · {it.kg} kg · ×{it.qty}</small></div>
          <div class="ops">
            <span onclick={(e) => { e.stopPropagation(); qty(it, -1); }}>−</span>
            <i>{it.qty}</i>
            <span onclick={(e) => { e.stopPropagation(); qty(it, 1); }}>+</span>
          </div>
        </button>
      {:else}<div class="none mono">{inv.length ? 'Filtreye uyan eşya yok.' : 'Envanter boş. Eşya ekle.'}</div>{/each}
    </div>
    {#if ed}
    <aside>
      <div class="mono h">{inv.some((x) => x.id === ed!.id) ? 'DÜZENLE' : 'YENİ EŞYA'}</div>
      <label class="field"><span>İsim</span><input class="inp" bind:value={ed.name} maxlength="80" /></label>
      <div class="row">
        <label class="field"><span>Ağırlık (kg)</span><input class="inp" type="number" min="0" step="0.1" bind:value={ed.kg} /></label>
        <label class="field"><span>Adet</span><input class="inp" type="number" min="1" step="1" bind:value={ed.qty} /></label>
      </div>
      <label class="field"><span>Tür</span>
        <select class="inp" bind:value={ed.type}>{#each ITEM_TYPES as t}<option value={t.id}>{t.label}</option>{/each}</select>
      </label>
      <label class="field"><span>Not (isteğe bağlı)</span><textarea class="inp" rows="3" bind:value={ed.note} maxlength="400"></textarea></label>
      <div class="row">
        <label class="btn ghost small up">Küçük görsel<input type="file" accept="image/*" hidden onchange={pick} /></label>
        {#if ed.img}<button class="btn ghost small" onclick={() => ed && (ed = { ...ed, img: undefined })}>Görseli kaldır</button>{/if}
      </div>
      {#if ed.img}<img class="prev" src={ed.img} alt="" />{/if}
      {#if ed.type === 'armor' || ed.type === 'weapon'}
        <label class="ck"><input type="checkbox" checked={!!ed.eq} onchange={() => ed && (ed = { ...ed, eq: !ed.eq })} /> Kuşanıldı (zırh / silah)</label>
      {/if}
      {#if err}<p class="err">{err}</p>{/if}
      <div class="row">
        <button class="btn" onclick={save}>Kaydet</button>
        <button class="btn ghost" onclick={() => (ed = null)}>Vazgeç</button>
        {#if inv.some((x) => x.id === ed!.id)}<button class="btn red" onclick={() => del(ed!)}>Sil</button>{/if}
      </div>
    </aside>
    {/if}
  </div>
</div>

<style>
  .inv{flex:1;min-height:0;display:flex;flex-direction:column;padding:16px 28px 22px;gap:12px;position:relative;z-index:1}
  .top{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
  .load{flex:1;min-width:240px}.load .h{font-size:10.5px;letter-spacing:.2em;color:var(--cy)}.load small{color:var(--mut);letter-spacing:.1em;margin-left:8px}
  .bar{position:relative;height:8px;background:rgba(255,255,255,.08);margin-top:6px;overflow:hidden}
  .bar i{display:block;height:100%;background:linear-gradient(90deg,var(--cy),#39ff8a)}
  .bar s{position:absolute;top:0;bottom:0;width:2px;background:var(--ye);text-decoration:none}
  .enc .bar i{background:var(--rd)}.warn{color:var(--ye);font-size:11px;letter-spacing:.16em}
  .fil{display:flex;flex-wrap:wrap;gap:4px}
  .fil button{background:none;border:1px solid var(--line);color:var(--mut);padding:5px 8px;font:inherit;font-size:12px}.fil button.on{border-color:var(--cy);color:var(--cy)}
  .body{flex:1;min-height:0;display:grid;grid-template-columns:1fr 320px;gap:16px}
  .body:not(:has(aside)){grid-template-columns:1fr}
  .grid{overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;align-content:start}
  .card{display:grid;grid-template-columns:52px 1fr auto;gap:8px;align-items:center;text-align:left;background:rgba(0,0,0,.3);border:1px solid var(--line);color:inherit;padding:8px;font:inherit}
  .card:hover,.card.on{border-color:var(--cy)}.card.eq{border-color:rgba(57,255,138,.5)}
  .pic{width:52px;height:52px;background:#0a0c12;display:grid;place-items:center;overflow:hidden}.pic img{width:100%;height:100%;object-fit:cover}.pic span{color:var(--cy);font-size:16px}
  .tx{min-width:0}.tx b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tx small{color:var(--mut);font-size:10.5px}
  .ops{display:flex;align-items:center;gap:4px;font-family:var(--f-mono)}.ops span{width:22px;height:22px;display:grid;place-items:center;border:1px solid var(--line);cursor:pointer}.ops span:hover{border-color:var(--cy)}
  aside{overflow:auto;border:1px solid rgba(0,240,255,.25);padding:12px;background:rgba(4,6,12,.7);display:flex;flex-direction:column;gap:8px}
  .h{font-size:10.5px;letter-spacing:.25em;color:var(--ye)}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.row .field{flex:1}
  .prev{width:80px;height:80px;object-fit:cover;border:1px solid var(--line)}
  .ck{display:flex;gap:8px;align-items:center;font-size:13px}
  .err{color:var(--rd);font-size:13px}.none{grid-column:1/-1;color:var(--mut);padding:20px}
  .up{position:relative;overflow:hidden}
</style>
