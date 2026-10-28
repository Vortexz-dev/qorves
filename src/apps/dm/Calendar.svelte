<script lang="ts">
  // Evren takvimi (oyun içi tarih) + yeni Timeline olayları: taslak → yayımla.
  import { onMount } from 'svelte';
  import { session } from '../../lib/session.svelte';
  import { setWorld, watchTl, saveTl, deleteTl, nid, now, type TlEvent } from '../../lib/live';
  import { ask } from '../../lib/confirm.svelte';
  import { sfx } from '../../lib/sfx';
  let year = $state(session.world?.year ?? 214), day = $state(session.world?.day ?? 1), msg = $state('');
  let tl = $state<TlEvent[]>([]), ed = $state<TlEvent | null>(null);
  onMount(() => watchTl(true, (t) => (tl = t.sort((a, b) => b.ys - a.ys || b.at - a.at))));
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 3500); };
  async function saveDate(y = year, d = day) {
    if (!Number.isFinite(y) || d < 1 || d > 365) return flash('Gün 1–365 arası olmalı.');
    try { await setWorld({ era: 'SS', year: Math.round(y), day: Math.round(d) }); year = Math.round(y); day = Math.round(d); sfx.granted(); flash(`Takvim: SS ${year} · Gün ${day}`); } catch (e) { sfx.error(); flash('Hata: ' + String(e)); }
  }
  const step = (n: number) => { let y = year, d = day + n; while (d > 365) { d -= 365; y++; } while (d < 1) { d += 365; y--; } saveDate(y, d); };
  const blank = (): TlEvent => ({ id: nid(), name: '', date: `SS ${year}`, ys: year, summary: '', text: '', race: 'insan', published: false, at: now() });
  async function save(pub?: boolean) {
    if (!ed || !ed.name.trim()) return; const t = { ...ed, name: ed.name.trim(), published: pub ?? ed.published, at: now() };
    try { await saveTl(t); sfx.granted(); flash(t.published ? 'Yayımlandı: ' + t.name : 'Taslak kaydedildi: ' + t.name); ed = null; } catch (e) { sfx.error(); flash('Hata: ' + String(e)); }
  }
  async function pub(t: TlEvent, p: boolean) { await saveTl({ ...t, published: p, at: now() }); sfx.click(); flash(p ? 'Yayımlandı: ' + t.name : 'Taslağa alındı: ' + t.name); }
  async function del(t: TlEvent) { if (await ask('Olay silinsin mi?', `“${t.name}” Timeline'dan kaldırılacak.`, 'Sil')) { await deleteTl(t.id); flash('Silindi.'); } }
</script>
<div class="ca">
  <div class="dt">
    <h4 class="mono">EVREN TAKVİMİ</h4>
    <div class="now"><span class="mono">ŞU AN</span><b>SS {session.world?.year ?? '—'} · Gün {session.world?.day ?? '—'}</b></div>
    <div class="row"><label class="field"><span>Yıl (SS)</span><input class="inp" type="number" bind:value={year} /></label><label class="field"><span>Gün</span><input class="inp" type="number" min="1" max="365" bind:value={day} /></label><button class="btn" onclick={() => saveDate()}>Uygula</button></div>
    <div class="row"><button class="btn ghost small" onclick={() => step(-1)}>− 1 gün</button><button class="btn ghost small" onclick={() => step(1)}>+ 1 gün</button><button class="btn ghost small" onclick={() => step(7)}>+ 1 hafta</button><button class="btn ghost small" onclick={() => step(30)}>+ 30 gün</button></div>
    <p class="nt">Değişiklik tüm oyuncuların görev çubuğundaki tarihe anında yansır.</p>
    {#if msg}<p class="msg mono">{msg}</p>{/if}
    {#if ed}
      <h4 class="mono">{tl.some((x) => x.id === ed!.id) ? 'OLAYI DÜZENLE' : 'YENİ TIMELINE OLAYI'}</h4>
      <label class="field"><span>Ad</span><input class="inp" bind:value={ed.name} maxlength="90" /></label>
      <div class="row"><label class="field"><span>Tarih yazısı</span><input class="inp" bind:value={ed.date} placeholder="SS 214" /></label><label class="field"><span>Sıra yılı (SÖ eksi)</span><input class="inp" type="number" bind:value={ed.ys} /></label>
        <label class="field"><span>Irk rengi</span><select class="inp" bind:value={ed.race}><option value="insan">İnsan</option><option value="elf">Elf</option><option value="cuce">Cüce</option></select></label></div>
      <label class="field"><span>Özet</span><textarea class="inp" rows="3" bind:value={ed.summary} maxlength="600"></textarea></label>
      <label class="field"><span>Ayrıntı (isteğe bağlı)</span><textarea class="inp" rows="4" bind:value={ed.text} maxlength="4000"></textarea></label>
      <div class="row"><button class="btn ghost" onclick={() => save(false)} disabled={!ed.name.trim()}>Taslak kaydet</button><button class="btn" onclick={() => save(true)} disabled={!ed.name.trim()}>Yayımla</button><button class="btn ghost small" onclick={() => (ed = null)}>Vazgeç</button></div>
    {:else}<button class="btn" onclick={() => (ed = blank())}>+ Yeni Timeline olayı</button>{/if}
  </div>
  <div class="ls">
    <h4 class="mono">DM OLAYLARI ({tl.length})</h4>
    {#each tl as t (t.id)}
      <div class="it" class:draft={!t.published}>
        <div class="h mono"><b>{t.published ? 'YAYINDA' : 'TASLAK'}</b><span>{t.date}</span></div>
        <div class="n">{t.name}</div>{#if t.summary}<p>{t.summary}</p>{/if}
        <div class="b"><button class="btn small" class:ghost={t.published} onclick={() => pub(t, !t.published)}>{t.published ? 'Yayından kaldır' : 'Yayımla'}</button><button class="btn ghost small" onclick={() => (ed = { ...t })}>Düzenle</button><button class="btn red small" onclick={() => del(t)}>Sil</button></div>
      </div>
    {:else}<div class="none mono">Henüz DM olayı yok. Taslaklar yalnız sana görünür; yayımlayınca oyuncuların Timeline'ına düşer.</div>{/each}
  </div>
</div>
<style>
  .ca{display:grid;grid-template-columns:460px 1fr;gap:16px;height:100%;min-height:0;padding:12px 16px}
  .dt{display:flex;flex-direction:column;gap:8px;overflow:auto;padding-right:6px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:8px 0 2px}
  .now{display:flex;align-items:baseline;gap:10px}.now span{font-size:10px;letter-spacing:.2em;color:var(--cy)}.now b{font-family:var(--f-disp);font-size:22px;color:#fff}
  .row{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}.row .field{flex:1;min-width:90px}
  textarea.inp{resize:vertical;font-family:var(--f-ui)}
  .nt{font-size:12px;color:var(--mut);margin:0}.msg{font-size:11.5px;color:#39ff8a;margin:0}
  .ls{overflow:auto;display:flex;flex-direction:column;gap:8px}
  .it{border:1px solid var(--line);border-left:3px solid #39ff8a;padding:8px 10px;background:rgba(0,0,0,.25)}.it.draft{border-left-color:var(--ye);border-style:dashed solid dashed solid}
  .h{display:flex;gap:10px;font-size:10.5px;color:var(--mut)}.h b{color:#39ff8a}.draft .h b{color:var(--ye)}
  .n{font-size:16px;color:#fff;margin:3px 0}.it p{font-size:13px;color:#c9d6e2;margin:0 0 6px;line-height:1.4}
  .b{display:flex;gap:6px}.none{color:var(--mut);font-size:12px;padding:10px;line-height:1.5}
</style>
