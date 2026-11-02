<script lang="ts">
  // DM Paneli → Gemi: depoya parça ver/al, yük, Skarnit, ad; düzenleme kaydı.
  import { onMount } from 'svelte';
  import { session } from '../../lib/session.svelte';
  import { watchShip, ensureShip, dmGrant, dmPatch, dmReset, runOp, watchShipLog, clearShipLog, type ShipLog } from '../../ship/live';
  import { allParts, part, stats, startDoc, BRAND, CHASSIS, type ShipDoc, type Addon, type TrailerDef } from '../../ship/sys';
  import { ask } from '../../lib/confirm.svelte';
  import { sfx } from '../../lib/sfx';
  const who = { uid: session.user!.uid, name: 'DM' };
  let doc = $state<ShipDoc>(startDoc()), log = $state<ShipLog[]>([]), q = $state(''), kind = $state(''), msg = $state('');
  let cName = $state(''), cMass = $state(5), cLoc = $state('cab'), cHid = $state(false), sk = $state(10), nm = $state('');
  onMount(() => { ensureShip(who.uid).catch(() => {}); const a = watchShip((s) => { if (s) { doc = s; sk = s.skarnit; nm ||= s.name; } }); const b = watchShipLog((l) => (log = l)); return () => { a(); b(); }; });
  const st = $derived(stats(doc));
  const parts = $derived(allParts().filter((p) => (!kind || p.k === kind) && (!q || (p.model + ' ' + (p.k === 'addon' ? (p as Addon).cat : p.k === 'trailer' ? (p as TrailerDef).type : '')).toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')))));
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 3500); };
  const grant = async (id: string, n: number) => { try { await dmGrant(id, n, who); sfx.click(); } catch (e) { flash('Hata: ' + String(e)); } };
  async function addCargo() { if (!cName.trim() || !(cMass > 0)) return; const r = await runOp({ t: 'cargo', c: { id: Date.now().toString(36), name: cName.trim().slice(0, 60), mass: Math.round(cMass), loc: cLoc, ...(cHid ? { hidden: true } : {}) } }, who); if (r.ok) { cName = ''; sfx.granted(); } else { sfx.error(); flash(r.msg ?? ''); } }
  const sub = (p: ReturnType<typeof allParts>[number]) => p.k === 'addon' ? `${(p as Addon).cat} · ${(p as Addon).size} ${(p as Addon).mount}` : p.k === 'trailer' ? `Dorse ${(p as TrailerDef).size} · ${(p as TrailerDef).type}` : p.k === 'engine' ? `Motor ${p.size}` : `Çekirdek ${p.size}`;
  const when = (t: number) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
</script>
<div class="stb">
  <div class="cl">
    <h4 class="mono">TERSANE DEPOSU · PARÇA VER</h4>
    <div class="row"><input class="inp" placeholder="Ara…" bind:value={q} /><select class="inp" bind:value={kind}><option value="">Hepsi</option><option value="addon">Eklenti</option><option value="trailer">Dorse</option><option value="engine">Motor</option><option value="core">Çekirdek</option></select></div>
    <div class="ls">
      {#each parts as p (p.id)}
        <div class="pr"><span><b>{p.model}{p.k === 'trailer' && p.size !== 'T1' ? ' · ' + p.size : ''}</b><small>{sub(p)} · {BRAND[p.brand] ?? ''}{p.legality !== 'Yasal' ? ' · ' + p.legality : ''}</small></span>
          <em class="mono">{doc.inv[p.id] ?? 0}</em><button class="btn ghost small" onclick={() => grant(p.id, -1)} disabled={!doc.inv[p.id]}>−</button><button class="btn small" onclick={() => grant(p.id, 1)}>+</button></div>
      {/each}
    </div>
  </div>
  <div class="cl">
    <h4 class="mono">GEMİ</h4>
    <div class="row"><label class="field"><span>Ad</span><input class="inp" bind:value={nm} maxlength="40" /></label><button class="btn small" onclick={() => dmPatch({ name: nm.trim() || 'Demir Kervan' }, who, 'Gemi adı: ' + nm).then(() => sfx.granted())}>Kaydet</button></div>
    <div class="row"><label class="field"><span>Skarnit · en fazla {st.skarnitMax} t</span><input class="inp" type="number" min="0" max={st.skarnitMax} bind:value={sk} /></label><button class="btn small" onclick={() => dmPatch({ skarnit: Math.max(0, Math.min(st.skarnitMax, Math.round(sk))) }, who, `Skarnit: ${sk} t`).then(() => sfx.granted())}>Kaydet</button></div>
    <div class="row"><label class="field"><span>Şasi</span><select class="inp" value={doc.chassis} onchange={async (e) => { const id = (e.target as HTMLSelectElement).value; const r = await runOp({ t: 'chassis', id }, who); if (r.ok) sfx.granted(); else { sfx.error(); flash(r.msg ?? 'Olmadı'); (e.target as HTMLSelectElement).value = doc.chassis; } }}>{#each CHASSIS as c (c.id)}<option value={c.id}>{c.id} · {c.name} — {c.max_trailers} dorse, {c.trailer_sizes.join('/')}</option>{/each}</select></label></div>
    <h4 class="mono">YÜK · {st.cargoUsed} / {st.cargoCap} t</h4>
    {#each doc.cargo as c (c.id)}<div class="pr"><span><b>{c.name}</b><small>{c.mass} t · {st.holds.find((h) => h.loc === c.loc)?.name ?? c.loc}{c.hidden ? ' · gizli' : ''}</small></span><button class="btn ghost small" onclick={() => runOp({ t: 'uncargo', id: c.id }, who)}>Çıkar</button></div>{/each}
    <div class="row"><input class="inp" placeholder="Yük adı" bind:value={cName} /><input class="inp n" type="number" min="1" bind:value={cMass} /><select class="inp" bind:value={cLoc}>{#each st.holds as h (h.loc)}<option value={h.loc}>{h.name} ({h.used}/{h.cap})</option>{/each}</select></div>
    <div class="row">{#if st.holds.find((h) => h.loc === cLoc)?.hidden}<label class="ck"><input type="checkbox" bind:checked={cHid} /> Gizli bölmeye</label>{/if}<button class="btn small" onclick={addCargo} disabled={!cName.trim()}>+ Yük ekle</button></div>
    <button class="btn ghost small rd" onclick={async () => { if (await ask('Gemi sıfırlansın mı?', 'Demir Kervan başlangıç durumuna döner: takılı parçalar, dorseler, yük ve depo başlangıç envanterine sıfırlanır.', 'Sıfırla')) { await dmReset(who); sfx.click(); } }}>Başlangıç durumuna sıfırla</button>
    {#if msg}<p class="msg">{msg}</p>{/if}
  </div>
  <div class="cl">
    <h4 class="mono">DÜZENLEME KAYDI ({log.length})</h4>
    <div class="lg">{#each log as l (l.id)}<div><span class="mono">{when(l.at)}</span><b>{l.name}</b><span>{l.text}</span></div>{:else}<p class="mut">Henüz değişiklik yok.</p>{/each}</div>
    {#if log.length}<button class="btn ghost small" onclick={async () => { if (await ask('Kayıt temizlensin mi?', 'Gemi düzenleme kaydı silinecek.', 'Temizle')) clearShipLog(); }}>Kaydı temizle</button>{/if}
  </div>
</div>
<style>
  .stb{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:16px;height:100%;min-height:0;padding:12px 16px}
  .cl{display:flex;flex-direction:column;gap:8px;min-height:0}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:6px 0 0}
  .row{display:flex;gap:6px;align-items:flex-end}.row .inp{flex:1;min-width:0}.row .n{flex:0 0 70px}
  .ls{flex:1;overflow:auto;display:flex;flex-direction:column;gap:3px}
  .pr{display:flex;align-items:center;gap:6px;padding:5px 7px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)}
  .pr span{flex:1;display:flex;flex-direction:column;min-width:0}.pr b{font-size:14px}.pr small{font-size:11.5px;color:var(--mut)}.pr em{font-style:normal;color:var(--ye);width:22px;text-align:center}
  .ck{display:flex;gap:6px;align-items:center;font-size:13px}
  .lg{flex:1;overflow:auto;display:flex;flex-direction:column;gap:4px}.lg div{display:grid;grid-template-columns:86px 90px 1fr;gap:6px;font-size:13px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05)}
  .lg span.mono{font-size:10.5px;color:var(--mut)}.lg b{color:var(--cy);font-weight:600}
  .msg{color:var(--rd);font-size:12.5px;margin:0}.mut{color:var(--mut);font-size:12.5px}.rd{color:var(--rd);border-color:rgba(255,42,85,.5);margin-top:8px;align-self:flex-start}
</style>
