<script lang="ts">
  /* ENVANTER: türe göre sekmeler, kare ızgara, sağda ayrıntı paneli; ekle/düzenle/kuşan/adet. */
  import { fade, scale } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import type { Character } from '../../lib/backend';
  import { ask } from '../../lib/confirm.svelte';
  import { ITEM_TYPES, maxCarry, hardCarry, carryOf, saveItem, dropItem, newItem, type InvItem, type ItemType } from '../../lib/persona';
  import { P } from './psfx';
  let { uid, c, inv, editable }: { uid: string; c: Character; inv: InvItem[]; editable: boolean } = $props();
  const IC: Record<string, string> = {
    weapon: 'M3 14h11l2-2h5v3h-3l-1 2h-2l-1 3H9l1-3H3z',
    armor: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
    throwable: 'M12 6a7 7 0 1 0 .01 0zM12 2v4m-2-3h4',
    consumable: 'M9 2h6v4l2 3v12H7V9l2-3zM7 13h10',
    gear: 'M12 8a4 4 0 1 0 .01 0zM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
    misc: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10',
    other: 'M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z',
  };
  let typ = $state<'' | ItemType>(''), q = $state(''), sel = $state<string | null>(null), ed = $state<InvItem | null>(null), err = $state('');
  const kg = $derived(carryOf(inv)), cap = $derived(maxCarry(c.stats?.STR ?? 10)), hard = $derived(hardCarry(c.stats?.STR ?? 10));
  const list = $derived(inv.filter((i) => (!typ || i.type === typ) && (!q.trim() || (i.name + ' ' + (i.note ?? '')).toLocaleLowerCase('tr').includes(q.trim().toLocaleLowerCase('tr')))));
  const cur = $derived(inv.find((i) => i.id === sel) ?? list[0] ?? null);
  const lab = (t: string) => ITEM_TYPES.find((x) => x.id === t)?.label ?? t;
  const cnt = (t: string) => (t ? inv.filter((i) => i.type === t).length : inv.length);
  const cells = $derived(Math.max(30, Math.ceil((list.length + 1) / 6) * 6));
  function pick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f || !ed) return;
    if (f.size > 2_000_000) { err = 'Görsel çok büyük.'; return; }
    const img = new Image();
    img.onload = () => { const cv = document.createElement('canvas'), s = Math.min(1, 160 / Math.max(img.width, img.height)); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s); cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height); const url = cv.toDataURL('image/webp', 0.74); if (url.length > 110_000) { err = 'Görsel sıkışmadı, daha küçük bir resim dene.'; return; } if (ed) ed = { ...ed, img: url }; };
    img.src = URL.createObjectURL(f);
  }
  async function save() {
    if (!ed || !ed.name.trim()) { err = 'İsim gerekli.'; P.deny(); return; }
    const it = { ...ed, name: ed.name.trim(), kg: Math.max(0, +ed.kg || 0), qty: Math.max(1, Math.floor(+ed.qty || 1)), note: ed.note?.slice(0, 400), at: Date.now() };
    if (carryOf([...inv.filter((i) => i.id !== it.id), it]) > hard) { err = `Sert taşıma limiti (${hard} kg) aşılır.`; P.deny(); return; }
    try { await saveItem(uid, it); sel = it.id; ed = null; err = ''; P.confirm(); } catch (e) { err = String(e); P.deny(); }
  }
  async function del(it: InvItem) { if (!(await ask('Eşya silinsin mi?', `"${it.name}" envanterden kalkacak.`, 'Sil'))) return; await dropItem(uid, it.id); P.back(); if (sel === it.id) sel = null; ed = null; }
  async function qty(it: InvItem, d: number) {
    const n = it.qty + d; if (n < 1) return del(it);
    if (carryOf(inv.map((x) => (x.id === it.id ? { ...x, qty: n } : x))) > hard) { P.deny(); return; }
    await saveItem(uid, { ...it, qty: n }); P.select();
  }
  async function toggleEq(it: InvItem) { await saveItem(uid, { ...it, eq: !it.eq }); P.spend(); }
</script>

<div class="iv">
  <aside class="cats">
    {#each [{ id: '', label: 'TÜMÜ' }, ...ITEM_TYPES] as t (t.id)}
      <button class:on={typ === t.id} onclick={() => { typ = t.id as typeof typ; P.select(); }} onmouseenter={P.hover}>
        {#if t.id}<svg viewBox="0 0 24 24"><path d={IC[t.id]} /></svg>{:else}<svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>{/if}
        <span>{t.label.toLocaleUpperCase('tr')}</span><em class="mono">{cnt(t.id)}</em>
      </button>
    {/each}
  </aside>

  <section class="gridw">
    <div class="top">
      <div class="load" class:bad={kg > cap}>
        <span class="mono">TAŞIMA</span>
        <div class="bar">{#each Array(30) as _, i}<i class:on={i < Math.round((kg / hard) * 30)} class:over={i >= Math.round((cap / hard) * 30)}></i>{/each}</div>
        <b>{kg.toFixed(1)}<small>/{cap} kg</small></b>
      </div>
      <input bind:value={q} placeholder="ARA…" class="mono" />
      {#if editable}<button class="add" onclick={() => { ed = newItem(); if (typ) ed.type = typ; err = ''; P.select(); }}>+ EŞYA</button>{/if}
    </div>
    <div class="grid">
      {#each list as it (it.id)}
        <button class="it t-{it.type}" class:on={cur?.id === it.id} class:eq={it.eq} animate:flip={{ duration: 220 }} in:scale={{ start: 0.85, duration: 200 }}
          onclick={() => { sel = it.id; P.select(); }} ondblclick={() => editable && (ed = { ...it })} onmouseenter={P.hover}>
          {#if it.img}<img src={it.img} alt="" />{:else}<svg viewBox="0 0 24 24"><path d={IC[it.type] ?? IC.other} /></svg>{/if}
          {#if it.qty > 1}<em class="mono">×{it.qty}</em>{/if}
          {#if it.eq}<s class="mono">K</s>{/if}
          <span class="nm">{it.name}</span>
        </button>
      {/each}
      {#each Array(Math.max(0, cells - list.length)) as _}<div class="empty"></div>{/each}
    </div>
  </section>

  <aside class="det">
    {#if cur}
      {#key cur.id}
        <div class="dc" in:fade={{ duration: 160 }}>
          <div class="dh mono"><span>{lab(cur.type).toLocaleUpperCase('tr')}</span>{#if cur.eq}<b>KUŞANILDI</b>{/if}</div>
          <div class="pic t-{cur.type}">{#if cur.img}<img src={cur.img} alt="" />{:else}<svg viewBox="0 0 24 24"><path d={IC[cur.type] ?? IC.other} /></svg>{/if}</div>
          <h3>{cur.name}</h3>
          <div class="kv mono"><span>AĞIRLIK</span><b>{cur.kg} kg</b></div>
          <div class="kv mono"><span>ADET</span><b>{cur.qty}</b></div>
          <div class="kv mono"><span>TOPLAM</span><b>{(cur.kg * cur.qty).toFixed(1)} kg</b></div>
          {#if cur.note}<p>{cur.note}</p>{/if}
          {#if editable}
            <div class="acts">
              <div class="qty"><button onclick={() => qty(cur!, -1)}>−</button><b>{cur.qty}</b><button onclick={() => qty(cur!, 1)}>+</button></div>
              {#if cur.type === 'armor' || cur.type === 'weapon'}<button class="pri" onclick={() => toggleEq(cur!)}>{cur.eq ? 'ÇIKAR' : 'KUŞAN'}</button>{/if}
              <button onclick={() => (ed = { ...cur! })}>DÜZENLE</button>
              <button class="red" onclick={() => del(cur!)}>SİL</button>
            </div>
          {/if}
        </div>
      {/key}
    {:else}<p class="none mono">{inv.length ? 'FİLTREYE UYAN EŞYA YOK' : 'ENVANTER BOŞ'}</p>{/if}
  </aside>

  {#if ed}
    <div class="mod" transition:fade={{ duration: 150 }} role="presentation" onpointerdown={(e) => e.target === e.currentTarget && (ed = null)}>
      <div class="box" in:scale={{ start: 0.95, duration: 180 }}>
        <h4 class="mono">{inv.some((x) => x.id === ed!.id) ? 'EŞYAYI DÜZENLE' : 'YENİ EŞYA'}</h4>
        <label><span>İsim</span><input bind:value={ed.name} maxlength="80" /></label>
        <div class="row">
          <label><span>Ağırlık (kg)</span><input type="number" min="0" step="0.1" bind:value={ed.kg} /></label>
          <label><span>Adet</span><input type="number" min="1" step="1" bind:value={ed.qty} /></label>
          <label><span>Tür</span><select bind:value={ed.type}>{#each ITEM_TYPES as t}<option value={t.id}>{t.label}</option>{/each}</select></label>
        </div>
        <label><span>Not</span><textarea rows="3" bind:value={ed.note} maxlength="400"></textarea></label>
        <div class="row"><label class="up">Küçük görsel<input type="file" accept="image/*" hidden onchange={pick} /></label>{#if ed.img}<img class="pv" src={ed.img} alt="" /><button class="gh" onclick={() => ed && (ed = { ...ed, img: undefined })}>kaldır</button>{/if}</div>
        {#if ed.type === 'armor' || ed.type === 'weapon'}<label class="ck"><input type="checkbox" checked={!!ed.eq} onchange={() => ed && (ed = { ...ed, eq: !ed.eq })} />Kuşanıldı</label>{/if}
        {#if err}<p class="e">{err}</p>{/if}
        <div class="row end"><button class="gh" onclick={() => (ed = null)}>Vazgeç</button><button class="ok" onclick={save}>Kaydet</button></div>
      </div>
    </div>
  {/if}
</div>

<style>
  .iv{position:absolute;inset:0;display:grid;grid-template-columns:200px 1fr 300px;gap:22px;padding:20px 28px}
  .cats{display:flex;flex-direction:column;gap:4px}
  .cats button{display:flex;align-items:center;gap:10px;padding:9px 12px;background:none;border:1px solid transparent;border-left:2px solid rgba(255,93,93,.2);color:rgba(255,140,140,.8);font:600 13px var(--f-ui);letter-spacing:.12em;cursor:var(--cur-p);transition:all .15s;text-align:left}
  .cats button:hover{color:#fff;background:rgba(255,93,93,.06)}
  .cats button.on{color:var(--pc);border-color:rgba(94,246,255,.3);border-left-color:var(--pc);background:linear-gradient(90deg,rgba(94,246,255,.12),transparent)}
  .cats svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round}
  .cats span{flex:1}.cats em{font-style:normal;font-size:11px;color:var(--mut)}
  .gridw{display:flex;flex-direction:column;gap:12px;min-height:0}
  .top{display:flex;align-items:center;gap:12px}
  .load{flex:1;display:flex;align-items:center;gap:10px}.load span{font-size:10.5px;letter-spacing:.26em;color:var(--pr)}
  .bar{flex:1;display:flex;gap:2px}.bar i{flex:1;height:9px;background:rgba(94,246,255,.1)}.bar i.over{background:rgba(255,93,93,.08)}.bar i.on{background:var(--pc);box-shadow:0 0 5px var(--pc)}.bar i.on.over,.bad .bar i.on{background:var(--pr);box-shadow:0 0 5px var(--pr)}
  .load b{font-family:var(--f-disp);color:#fff;font-size:15px}.load small{color:var(--mut);font-size:11px}
  .top input{width:170px;background:rgba(0,0,0,.4);border:1px solid var(--pl);color:#fff;padding:7px 10px;letter-spacing:.14em;font-size:12px}
  .top input:focus{border-color:var(--pc);outline:none}
  .add{background:var(--pr);border:0;color:#140005;font:700 12.5px var(--f-ui);letter-spacing:.16em;padding:8px 14px;cursor:var(--cur-p);clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)}
  .add:hover{filter:brightness(1.15)}
  .grid{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));grid-auto-rows:92px;gap:6px;align-content:start;padding:2px}
  .it,.empty{position:relative;border:1px solid rgba(255,93,93,.16);background:rgba(20,6,10,.55)}
  .empty{background:repeating-linear-gradient(45deg,rgba(255,93,93,.025) 0 6px,transparent 6px 12px)}
  .it{padding:0;cursor:var(--cur-p);display:grid;place-items:center;color:var(--c,#ff9b9b);transition:transform .12s,border-color .12s,box-shadow .12s;overflow:hidden}
  .it::before{content:"";position:absolute;inset:auto 0 0 0;height:3px;background:var(--c,#ff9b9b);opacity:.8}
  .it:hover{transform:translateY(-2px);border-color:var(--c);box-shadow:0 6px 18px rgba(0,0,0,.4),inset 0 0 22px color-mix(in srgb,var(--c) 18%,transparent)}
  .it.on{border-color:var(--pc);box-shadow:0 0 0 1px var(--pc),inset 0 0 26px rgba(94,246,255,.18)}
  .it svg{width:40px;height:40px;fill:none;stroke:currentColor;stroke-width:1.3;stroke-linejoin:round;filter:drop-shadow(0 0 6px currentColor)}
  .it img{width:100%;height:100%;object-fit:cover}
  .it em{position:absolute;right:5px;top:3px;font-style:normal;font-size:11px;color:#fff}
  .it s{position:absolute;left:5px;top:3px;text-decoration:none;font-size:10px;background:var(--pc);color:#000;padding:0 4px}
  .it .nm{position:absolute;left:0;right:0;bottom:3px;padding:0 5px;font-size:10.5px;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;opacity:0;transition:opacity .15s;background:rgba(0,0,0,.6)}
  .it:hover .nm,.it.on .nm{opacity:1}
  .t-weapon{--c:#ff5d5d}.t-armor{--c:#5ef6ff}.t-throwable{--c:#ff9b2f}.t-consumable{--c:#39ff8a}.t-gear{--c:#c08bff}.t-misc{--c:#d6d6d6}.t-other{--c:#fcee0a}
  .det{min-height:0;overflow:auto}
  .dc{padding:14px;border:1px solid rgba(255,93,93,.3);background:linear-gradient(170deg,rgba(255,93,93,.08),rgba(8,3,6,.85));display:flex;flex-direction:column;gap:8px;clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)}
  .dh{display:flex;justify-content:space-between;font-size:10.5px;letter-spacing:.24em;color:var(--pr)}.dh b{color:var(--pc)}
  .pic{height:170px;display:grid;place-items:center;border:1px solid rgba(255,93,93,.15);background:radial-gradient(circle,color-mix(in srgb,var(--c) 14%,transparent),transparent 70%);color:var(--c)}
  .pic svg{width:90px;height:90px;fill:none;stroke:currentColor;stroke-width:1;filter:drop-shadow(0 0 10px currentColor)}
  .pic img{max-width:100%;max-height:100%;object-fit:contain}
  h3{margin:4px 0;color:#fff;font-size:20px;letter-spacing:.03em}
  .kv{display:flex;justify-content:space-between;font-size:12px;border-bottom:1px dashed rgba(255,93,93,.15);padding:3px 0}.kv span{color:var(--mut);letter-spacing:.2em}.kv b{color:#fff}
  .dc p{font-size:13.5px;line-height:1.5;color:#dcc;margin:4px 0}
  .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  .acts button{background:none;border:1px solid var(--pl);color:#fff;padding:6px 10px;font:600 12px var(--f-ui);letter-spacing:.14em;cursor:var(--cur-p)}
  .acts button:hover{border-color:var(--pc);color:var(--pc)}.acts .pri{background:var(--pc);color:#001014;border-color:var(--pc)}.acts .red{color:var(--pr);border-color:rgba(255,93,93,.5)}
  .qty{display:flex;align-items:center;border:1px solid var(--pl)}.qty button{border:0;padding:6px 10px}.qty b{min-width:26px;text-align:center;color:#fff}
  .none{letter-spacing:.24em;color:var(--mut);font-size:11px;text-align:center;margin-top:40%}
  .mod{position:absolute;inset:0;z-index:40;display:grid;place-items:center;background:rgba(4,0,2,.7);backdrop-filter:blur(3px)}
  .box{width:min(520px,92%);padding:18px 20px;background:#0e0508;border:1px solid var(--pr);display:flex;flex-direction:column;gap:10px;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%)}
  .box h4{margin:0 0 4px;font-size:12px;letter-spacing:.24em;color:var(--pr)}
  .box label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--mut);flex:1}
  .box input,.box textarea,.box select{background:#07030a;border:1px solid var(--pl);color:#fff;padding:7px 9px;font:inherit;font-size:14px}
  .row{display:flex;align-items:flex-end;gap:8px}.row.end{justify-content:flex-end;margin-top:6px}
  .box button,.up{background:none;border:1px solid var(--pl);color:#fff;padding:7px 14px;font:inherit;letter-spacing:.1em;cursor:var(--cur-p)}
  .box .ok{background:var(--pr);border-color:var(--pr);color:#120004;font-weight:700}
  .up{flex:none !important;flex-direction:row !important;color:var(--pc) !important;border-color:rgba(94,246,255,.4) !important}
  .ck{flex-direction:row !important;align-items:center}.pv{width:44px;height:44px;object-fit:cover}.e{color:var(--pr);margin:0;font-size:13px}
</style>
