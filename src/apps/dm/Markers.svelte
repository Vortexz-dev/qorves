<script lang="ts">
  // Yıldız haritası işaretleri: oyuncu gemisinin konumu, görev noktaları; yalnız seçilen oyuncular görür.
  import { onMount } from 'svelte';
  import { dm, pname, sysName, when } from './store.svelte';
  import { watchMarkers, saveMarker, deleteMarker, nid, now, type Marker } from '../../lib/live';
  import { sfx } from '../../lib/sfx';
  let list = $state<Marker[]>([]), ed = $state<Marker | null>(null), msg = $state('');
  onMount(() => watchMarkers(null, (m) => (list = m.sort((a, b) => b.at - a.at))));
  const blank = (): Marker => ({ id: nid(), sys: dm.systems[0]?.id ?? '', kind: 'mission', label: '', note: '', players: dm.pid ? [dm.pid] : [], at: now() });
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 3500); };
  async function save() { if (!ed || !ed.label.trim() || !ed.sys) return; try { await saveMarker({ ...ed, label: ed.label.trim(), at: now() }); sfx.granted(); flash('İşaret kaydedildi.'); ed = null; } catch (e) { sfx.error(); flash('Hata: ' + String(e)); } }
  async function del(m: Marker) { await deleteMarker(m.id); sfx.click(); flash('İşaret kaldırıldı.'); }
</script>
<div class="mk">
  <div class="fm">
    {#if ed}
      <h4 class="mono">{list.some((x) => x.id === ed!.id) ? 'İŞARETİ DÜZENLE' : 'YENİ İŞARET'}</h4>
      <div class="kd">{#each [['ship', '▲ Gemi konumu'], ['mission', '◆ Görev noktası']] as [k, l] (k)}<button class:on={ed.kind === k} onclick={() => ed && (ed.kind = k as Marker['kind'])}>{l}</button>{/each}</div>
      <label class="field"><span>Sistem</span><select class="inp" bind:value={ed.sys}>{#each dm.systems as s (s.id)}<option value={s.id}>{s.name}{s.owner === 'dm' ? ' (gizli)' : ''}</option>{/each}</select></label>
      <label class="field"><span>Etiket</span><input class="inp" bind:value={ed.label} maxlength="60" placeholder={ed.kind === 'ship' ? 'ör. Kara Martı' : 'ör. Kayıp kargo'} /></label>
      <label class="field"><span>Not (oyuncu görür)</span><textarea class="inp" rows="3" bind:value={ed.note} maxlength="400"></textarea></label>
      <h4 class="mono">GÖRECEK OYUNCULAR</h4>
      {#each dm.users as u (u.uid)}<label class="ck"><input type="checkbox" checked={ed.players.includes(u.uid)} onchange={(e) => ed && (ed.players = (e.target as HTMLInputElement).checked ? [...ed.players, u.uid] : ed.players.filter((x) => x !== u.uid))} />{pname(u.uid)}</label>{/each}
      <div class="row"><button class="btn" disabled={!ed.label.trim()} onclick={save}>Kaydet</button><button class="btn ghost small" onclick={() => (ed = null)}>Vazgeç</button></div>
      <p class="nt">Gizli sistemdeki işaret, oyuncu o sistemi bilmiyorsa haritada “Bilinmeyen sinyal” olarak görünür.</p>
    {:else}<button class="btn" onclick={() => (ed = blank())}>+ Yeni işaret</button>{/if}
    {#if msg}<p class="msg mono">{msg}</p>{/if}
  </div>
  <div class="ls">
    <h4 class="mono">İŞARETLER ({list.length})</h4>
    {#each list as m (m.id)}
      <div class="it {m.kind}"><div class="h mono"><b>{m.kind === 'ship' ? '▲ GEMİ' : '◆ GÖREV'}</b><span>{sysName(m.sys)}</span><span class="t">{when(m.at)}</span></div>
        <div class="n">{m.label}</div>{#if m.note}<p>{m.note}</p>{/if}
        <div class="pl mono">Görenler: {m.players.length ? m.players.map(pname).join(', ') : 'kimse'}</div>
        <div class="b"><button class="btn ghost small" onclick={() => (ed = { ...m, players: [...m.players] })}>Düzenle</button><button class="btn red small" onclick={() => del(m)}>Kaldır</button></div></div>
    {:else}<div class="none mono">İşaret yok.</div>{/each}
  </div>
</div>
<style>
  .mk{display:grid;grid-template-columns:400px 1fr;gap:16px;height:100%;min-height:0;padding:12px 16px}
  .fm{display:flex;flex-direction:column;gap:8px;overflow:auto;padding-right:6px}.ls{overflow:auto;display:flex;flex-direction:column;gap:8px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:6px 0 2px}
  .kd{display:flex;gap:6px}.kd button{flex:1;background:none;border:1px solid var(--line);color:var(--mut);padding:7px;font:inherit;font-size:14px}.kd button.on{border-color:#39ff8a;color:#39ff8a;background:rgba(57,255,138,.08)}
  textarea.inp{resize:vertical;font-family:var(--f-ui)}
  .ck{display:flex;gap:8px;align-items:center;font-size:14px}.row{display:flex;gap:8px;align-items:center}
  .nt{font-size:12px;color:var(--mut)}.msg{font-size:11.5px;color:#39ff8a}
  .it{border:1px solid var(--line);border-left:3px solid #ff9b2f;padding:8px 10px;background:rgba(0,0,0,.25)}.it.ship{border-left-color:#39ff8a}
  .h{display:flex;gap:10px;font-size:10.5px;color:var(--mut)}.h b{color:#ff9b2f}.ship .h b{color:#39ff8a}.h .t{margin-left:auto}
  .n{font-size:16px;color:#fff;margin:3px 0}.it p{font-size:13px;color:#c9d6e2;margin:0 0 4px}.pl{font-size:10.5px;color:var(--mut);margin-bottom:6px}
  .b{display:flex;gap:6px}.none{color:var(--mut);font-size:12px;padding:10px}
</style>
