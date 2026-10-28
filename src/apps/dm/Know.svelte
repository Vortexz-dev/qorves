<script lang="ts">
  // Oyuncu başına bilgi izinleri: anahtar paketleri (vault okurları) + tek tek kayıt/sistem açma (düz metin kopyası).
  import { dm, pname } from './store.svelte';
  import PlayerPick from './PlayerPick.svelte';
  import { kb, searchKb, allEntries, bodiesOf, getEntry, type Entry } from '../../lib/kb.svelte';
  import { KEY_LABEL } from '../../lib/knowledge';
  import { tmeta, TYPE_ORDER } from '../../lib/types';
  import { grantsOf, setPack, revealsOf, setReveal, dropReveal, now } from '../../lib/live';
  import { writeBatch, doc } from 'firebase/firestore';
  import { db } from '../../lib/backend/firebase';
  import { sfx } from '../../lib/sfx';
  const BULK: { n: string; d: string; k: string[] }[] = [
    { n: 'Cüce tarihi', d: 'Cüce bilgisi + kadim tarih', k: ['k.dwarf', 'k.dwarf.ancient'] },
    { n: 'Elf tarihi', d: 'Elf bilgisi + kadim tarih', k: ['k.elf', 'k.elf.ancient'] },
    { n: 'İnsan tarihi', d: 'İnsan bilgisi + kadim tarih', k: ['k.human', 'k.human.ancient'] },
    { n: 'Hrothmar mirası', d: 'Üç ırkın kadim tarihi + akademik', k: ['k.dwarf', 'k.dwarf.ancient', 'k.elf.ancient', 'k.human.ancient', 'k.lore'] },
    { n: 'Siyaset içi', d: 'Birleşik, Cumhuriyet, Velmor, Ostrav', k: ['k.united', 'k.republic', 'k.velmor', 'k.ostrav'] },
    { n: 'Sınır bölgeleri', d: 'Kuzey + Doğu Dış Halka', k: ['k.north', 'k.east'] },
  ];
  const packs = $derived(kb.keys.filter((k) => k !== 'k.public' && k !== 'k.dm').sort((a, b) => (KEY_LABEL[a] ?? a).localeCompare(KEY_LABEL[b] ?? b, 'tr')));
  let keys = $state<string[]>([]), rev = $state<Set<string>>(new Set()), busy = $state(''), msg = $state(''), q = $state(''), ty = $state(''), only = $state(false);
  $effect(() => { const id = dm.pid; if (!id) return; keys = []; rev = new Set(); grantsOf(id).then((k) => id === dm.pid && (keys = k)); revealsOf(id).then((r) => id === dm.pid && (rev = new Set(r.map((x) => x.id)))); });
  const openBy = (e: Entry) => e.key === 'k.public' ? 'herkes' : keys.includes(e.key) ? 'paket' : rev.has(e.id) ? 'tek' : '';
  const list = $derived.by(() => {
    if (!kb.ready) return [] as Entry[];
    let l = q.trim() ? searchKb(q, 120).map((r) => r.e) : allEntries().sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name, 'tr'));
    if (ty) l = l.filter((e) => e.type === ty); if (only) l = l.filter((e) => openBy(e) === 'tek' || openBy(e) === 'paket');
    return l.slice(0, 200);
  });
  const flash = (t: string) => { msg = t; setTimeout(() => msg === t && (msg = ''), 3500); };
  async function togglePack(k: string, on: boolean) {
    busy = k; try { await setPack(dm.pid, k, on); keys = on ? [...new Set([...keys, k])] : keys.filter((x) => x !== k); sfx.granted(); flash(`${KEY_LABEL[k] ?? k} ${on ? 'açıldı' : 'kapatıldı'} · ${pname(dm.pid)}`); } catch (e) { sfx.error(); flash('Hata: ' + String(e)); } busy = '';
  }
  async function bulk(b: (typeof BULK)[number], on: boolean) { for (const k of b.k) if (packs.includes(k) && keys.includes(k) !== on) await togglePack(k, on); flash(`${b.n} ${on ? 'verildi' : 'geri alındı'}`); }
  const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));
  /** Kaydın oyuncuya açılacak kopyası: DM'e özel bölümler ve cisim notları çıkarılır. */
  function payload(e: Entry) {
    const { sections, ...meta } = e; const dmOnly = e.key === 'k.dm';
    const s = sections.filter((x) => dmOnly || x.k !== 'k.dm').map((x) => ({ t: x.t, x: x.x, o: x.o }));
    const b = e.type === 'system' ? bodiesOf(e.id).filter((x) => dmOnly || x.key !== 'k.dm').map(({ dm: _d, ...x }) => x) : [];
    return clean({ id: e.id, e: meta, s, b, at: now() });
  }
  async function toggle(e: Entry) {
    const on = !rev.has(e.id); busy = e.id;
    try {
      if (on) { await setReveal(dm.pid, payload(e)); rev = new Set([...rev, e.id]); } else { await dropReveal(dm.pid, e.id); const n = new Set(rev); n.delete(e.id); rev = n; }
      sfx.granted(); flash(`“${e.name}” ${on ? 'açıldı' : 'kapatıldı'} · ${pname(dm.pid)}`);
    } catch (x) { sfx.error(); flash('Hata: ' + String(x)); }
    busy = '';
  }
  async function revealAll() {
    const todo = list.filter((e) => !openBy(e)); if (!todo.length) return; busy = 'all';
    try { for (let i = 0; i < todo.length; i += 40) { const b = writeBatch(db); for (const e of todo.slice(i, i + 40)) b.set(doc(db, 'users', dm.pid, 'reveals', e.id), payload(e)); await b.commit(); }
      rev = new Set([...rev, ...todo.map((e) => e.id)]); sfx.granted(); flash(`${todo.length} kayıt açıldı`); } catch (x) { sfx.error(); flash('Hata: ' + String(x)); }
    busy = '';
  }
  const parentName = (e: Entry) => (e.parent ? getEntry(e.parent)?.name : '') ?? '';
</script>
<div class="kn">
  <div class="top"><PlayerPick />{#if msg}<span class="msg mono">{msg}</span>{/if}</div>
  <div class="cols">
    <div class="pk">
      <h4 class="mono">HAZIR PAKETLER</h4>
      {#each BULK as b (b.n)}{@const all = b.k.every((k) => keys.includes(k))}
        <div class="bk"><div><b>{b.n}</b><small>{b.d}</small></div><button class="btn small" class:ghost={all} disabled={!!busy} onclick={() => bulk(b, !all)}>{all ? 'Geri al' : 'Ver'}</button></div>{/each}
      <h4 class="mono">ANAHTARLAR</h4>
      {#each packs as k (k)}<label class="sw"><input type="checkbox" checked={keys.includes(k)} disabled={!!busy} onchange={(e) => togglePack(k, (e.target as HTMLInputElement).checked)} /><span></span>{KEY_LABEL[k] ?? k}<small class="mono">{k}</small></label>{/each}
      <p class="nt">“Yalnız DM” anahtarı paket olarak verilemez; tek kayıt olarak açılabilir.</p>
    </div>
    <div class="en">
      <div class="fl"><input class="inp" bind:value={q} placeholder="Kayıt, etiket ya da sistem ara…" />
        <select class="inp" bind:value={ty}><option value="">Tüm türler</option>{#each TYPE_ORDER as t (t)}<option value={t}>{tmeta(t).plural}</option>{/each}</select>
        <label class="ck"><input type="checkbox" bind:checked={only} />Yalnız açık olanlar</label>
        <button class="btn ghost small" disabled={!!busy || !list.length} onclick={revealAll} title="Listede görünen ve henüz kapalı tüm kayıtları açar">Görünenleri aç</button></div>
      <div class="rows">
        {#each list as e (e.id)}{@const st = openBy(e)}
          <div class="r" class:on={!!st}>
            <span class="ty" style:color={tmeta(e.type).color}>{tmeta(e.type).label}</span>
            <span class="n">{e.name}{#if parentName(e)}<small> · {parentName(e)}</small>{/if}</span>
            <span class="k mono" class:dmk={e.key === 'k.dm'}>{KEY_LABEL[e.key] ?? e.key}</span>
            {#if st === 'herkes'}<span class="st mono">HERKESE AÇIK</span>
            {:else if st === 'paket'}<span class="st mono pk2">PAKETTEN</span>
            {:else}<button class="tg" class:on={st === 'tek'} disabled={busy === e.id} onclick={() => toggle(e)}>{st === 'tek' ? '● AÇIK' : '○ KAPALI'}</button>{/if}
          </div>
        {:else}<div class="none mono">{kb.ready ? 'Kayıt yok.' : 'Bilgi bankası yükleniyor…'}</div>{/each}
      </div>
    </div>
  </div>
</div>
<style>
  .kn{display:flex;flex-direction:column;height:100%;min-height:0;padding:12px 16px;gap:10px}
  .top{display:flex;align-items:center;gap:16px}.msg{font-size:11.5px;color:#39ff8a}
  .cols{flex:1;display:grid;grid-template-columns:300px 1fr;gap:16px;min-height:0}
  .pk{overflow:auto;padding-right:6px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:6px 0 8px}
  .bk{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 9px;border:1px solid var(--line);margin-bottom:6px}.bk b{display:block;font-size:14.5px}.bk small{font-size:11.5px;color:var(--mut)}
  .sw{display:flex;align-items:center;gap:9px;padding:5px 2px;font-size:14px}.sw small{margin-left:auto;font-size:10px;color:var(--mut)}
  .sw input{display:none}.sw span{width:30px;height:16px;border:1px solid var(--line);position:relative;flex:none;transition:.2s}.sw span::after{content:'';position:absolute;left:2px;top:2px;width:10px;height:10px;background:var(--mut);transition:.2s}
  .sw input:checked+span{border-color:var(--cy);background:rgba(0,240,255,.15)}.sw input:checked+span::after{left:16px;background:var(--cy);box-shadow:0 0 6px var(--cy)}
  .nt{font-size:11.5px;color:var(--mut);margin-top:8px}
  .en{display:flex;flex-direction:column;min-height:0}
  .fl{display:flex;gap:8px;align-items:center;margin-bottom:8px}.fl input{flex:1}.ck{display:flex;gap:5px;align-items:center;font-size:13px;white-space:nowrap}
  .rows{flex:1;overflow:auto;border:1px solid var(--line)}
  .r{display:grid;grid-template-columns:80px 1fr 150px 100px;gap:8px;align-items:center;padding:5px 10px;border-bottom:1px solid rgba(0,240,255,.07);font-size:14px}
  .r.on{background:rgba(57,255,138,.04)}.ty{font-size:11px;font-family:var(--f-mono)}.n small{color:var(--mut);font-size:12px}
  .k{font-size:10.5px;color:var(--mut)}.k.dmk{color:var(--rd)}.st{font-size:10px;color:var(--mut);text-align:center}.st.pk2{color:var(--cy)}
  .tg{background:none;border:1px solid var(--line);color:var(--mut);font-family:var(--f-mono);font-size:10.5px;padding:3px 6px}.tg.on{border-color:#39ff8a;color:#39ff8a;background:rgba(57,255,138,.08)}.tg:hover{border-color:var(--ye)}
  .none{padding:16px;color:var(--mut);font-size:12px}
</style>
