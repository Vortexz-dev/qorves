<script lang="ts">
  // Gemi (Demir Kervan): değerler ve dorseler. world/ship → oyuncular yalnız okur.
  import { onMount } from 'svelte';
  import { watchDoc, nid } from '../../lib/live';
  import { doc, setDoc } from 'firebase/firestore';
  import { db } from '../../lib/backend/firebase';
  import { DEFAULT_SHIP, KINDS, MAX_TRAILERS, type ShipState, type TrailerKind } from '../../ship/data';
  import { ask } from '../../lib/confirm.svelte';
  import { sfx } from '../../lib/sfx';
  let s = $state<ShipState>(structuredClone(DEFAULT_SHIP)), dirty = $state(false), msg = $state(''), first = true;
  onMount(() => watchDoc<Partial<ShipState>>(['world', 'ship'], (v) => { if (dirty && !first) return; first = false; s = { ...structuredClone(DEFAULT_SHIP), ...(v ?? {}), trailers: structuredClone(v?.trailers ?? []) }; }));
  const flash = (t: string) => { msg = t; setTimeout(() => msg === t && (msg = ''), 3500); };
  const num = (v: unknown) => Math.max(0, Math.round((Number(v) || 0) * 10) / 10);
  async function save() {
    const d = $state.snapshot(s) as ShipState;
    for (const k of ['hp', 'hpMax', 'sh', 'shMax', 'cargo', 'cargoMax', 'fuel', 'fuelMax'] as const) d[k] = num(d[k]);
    d.trailers = d.trailers.slice(0, MAX_TRAILERS).map((t) => ({ ...t, name: t.name.slice(0, 60), note: t.note.slice(0, 400), hp: num(t.hp), hpMax: num(t.hpMax), cargo: num(t.cargo), cargoMax: num(t.cargoMax) }));
    d.name = d.name.slice(0, 60); d.note = d.note.slice(0, 600); d.fuelType = d.fuelType.slice(0, 120); d.speed = d.speed.slice(0, 60);
    try { await setDoc(doc(db, 'world', 'ship'), d); dirty = false; sfx.granted(); flash('Gemi kaydedildi. Oyuncular hemen görür.'); } catch (e) { sfx.error(); flash('Kaydedilemedi: ' + String(e)); }
  }
  function addTrailer(kind: TrailerKind) { if (s.trailers.length >= MAX_TRAILERS) return; s.trailers.push({ id: 't' + nid(), kind, name: '', hp: 600, hpMax: 600, cargo: 0, cargoMax: KINDS[kind].cap, note: '' }); dirty = true; sfx.click(); }
  async function rmTrailer(i: number) { if (!(await ask('Dorse sökülsün mü?', `${i + 1}. dorse gemiden ayrılır. Kaydedince oyuncular görür.`, 'Sök'))) return; s.trailers.splice(i, 1); dirty = true; }
  function move(i: number, d: number) { const j = i + d; if (j < 0 || j >= s.trailers.length) return; const a = s.trailers; [a[i], a[j]] = [a[j], a[i]]; dirty = true; }
  const F: [string, string][] = [['hp', 'Gövde'], ['hpMax', 'Gövde (en çok)'], ['sh', 'Kalkan'], ['shMax', 'Kalkan (en çok)'], ['fuel', 'Yakıt'], ['fuelMax', 'Yakıt (en çok)'], ['cargo', 'Kabin yükü (t)'], ['cargoMax', 'Kabin kapasitesi (t)']];
</script>
<div class="sh" oninput={() => (dirty = true)}>
  <div class="col">
    <h4 class="mono">GEMİ</h4>
    <label class="field"><span>Gemi adı</span><input class="inp" bind:value={s.name} maxlength="60" placeholder="Boş bırakılırsa “Adı henüz konmadı”" /></label>
    <div class="grid">{#each F as [k, l] (k)}<label class="field"><span>{l}</span><input class="inp" type="number" min="0" step="1" value={(s as unknown as Record<string, number>)[k]} oninput={(e) => ((s as unknown as Record<string, number>)[k] = Number(e.currentTarget.value))} /></label>{/each}</div>
    <label class="field"><span>Yakıt türü</span><input class="inp" bind:value={s.fuelType} maxlength="120" /></label>
    <label class="field"><span>Azami hız (metin)</span><input class="inp" bind:value={s.speed} maxlength="60" /></label>
    <label class="field"><span>Not (oyuncular görür)</span><textarea class="inp" rows="3" bind:value={s.note} maxlength="600"></textarea></label>
    <div class="row"><button class="btn" disabled={!dirty} onclick={save}>Kaydet</button>{#if dirty}<span class="mono dt">KAYDEDİLMEMİŞ DEĞİŞİKLİK</span>{/if}</div>
    {#if msg}<p class="msg mono">{msg}</p>{/if}
  </div>
  <div class="col">
    <h4 class="mono">DORSELER ({s.trailers.length}/{MAX_TRAILERS})</h4>
    {#each s.trailers as t, i (t.id)}
      <div class="tr">
        <div class="th mono"><b>{i + 1}.</b> {KINDS[t.kind].name}<span class="sp"></span><button onclick={() => move(i, -1)} disabled={i === 0} title="Öne al">▲</button><button onclick={() => move(i, 1)} disabled={i === s.trailers.length - 1} title="Arkaya al">▼</button><button class="rm" onclick={() => rmTrailer(i)}>Sök</button></div>
        <div class="grid">
          <label class="field"><span>Ad</span><input class="inp" bind:value={t.name} maxlength="60" placeholder={KINDS[t.kind].name} /></label>
          <label class="field"><span>Tür</span><select class="inp" bind:value={t.kind} onchange={() => (dirty = true)}>{#each Object.entries(KINDS) as [k, v] (k)}<option value={k}>{v.name}</option>{/each}</select></label>
          <label class="field"><span>Gövde</span><input class="inp" type="number" min="0" bind:value={t.hp} /></label>
          <label class="field"><span>Gövde (en çok)</span><input class="inp" type="number" min="0" bind:value={t.hpMax} /></label>
          <label class="field"><span>Yük (t)</span><input class="inp" type="number" min="0" bind:value={t.cargo} /></label>
          <label class="field"><span>Kapasite (t)</span><input class="inp" type="number" min="0" bind:value={t.cargoMax} /></label>
        </div>
        <label class="field"><span>Not</span><input class="inp" bind:value={t.note} maxlength="400" /></label>
      </div>
    {:else}<div class="none mono">Gemi şu an dorsesiz. Partinin başlangıç durumu budur.</div>{/each}
    {#if s.trailers.length < MAX_TRAILERS}<div class="add"><span class="mono">DORSE BAĞLA</span>{#each Object.entries(KINDS) as [k, v] (k)}<button class="btn ghost small" onclick={() => addTrailer(k as TrailerKind)}>+ {v.name}</button>{/each}</div>{/if}
  </div>
</div>
<style>
  .sh{display:grid;grid-template-columns:400px 1fr;gap:18px;height:100%;min-height:0;padding:12px 16px;overflow:hidden}
  .col{overflow:auto;min-height:0;padding-right:6px}
  h4{font-size:11px;letter-spacing:.22em;color:var(--mut);margin:6px 0 10px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .field{display:flex;flex-direction:column;gap:4px;margin-bottom:8px;font-size:13px}.field span{color:var(--mut);font-size:12px}
  .row{display:flex;gap:10px;align-items:center;margin-top:6px}.dt{font-size:10.5px;color:var(--ye);letter-spacing:.15em}
  .msg{font-size:11px;color:var(--cy);letter-spacing:.1em}
  .tr{border:1px solid rgba(0,240,255,.2);padding:10px 12px;margin-bottom:10px;background:rgba(0,240,255,.03)}
  .th{display:flex;align-items:center;gap:6px;font-size:12px;letter-spacing:.12em;margin-bottom:8px}.th b{color:var(--ye)}.sp{flex:1}
  .th button{background:none;border:1px solid rgba(255,255,255,.15);color:var(--tx);padding:2px 7px;cursor:pointer;font-size:11px}.th button:disabled{opacity:.3}.th .rm{color:#ff6b81;border-color:rgba(255,107,129,.4)}
  .add{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}.add span{font-size:10.5px;letter-spacing:.2em;color:var(--mut);width:100%}
  .none{color:var(--mut);font-size:12px;padding:10px 0}
</style>
