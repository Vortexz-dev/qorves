<script lang="ts">
  // God's Eye kayıtları: oyuncuların kaydettiği notlar ve ekran görüntüleri.
  import { onMount } from 'svelte';
  import { watchLogs, deleteLog, type GLog } from '../../lib/gods';
  import { mediaUrl } from '../../lib/live';
  import { openImage } from '../../lib/lightbox.svelte';
  let list = $state<GLog[]>([]), f = $state<'' | 'note' | 'shot'>(''), who = $state(''), open = $state('');
  onMount(() => watchLogs((l) => (list = l)));
  const names = $derived([...new Map(list.map((l) => [l.uid, l.name])).entries()]);
  const shown = $derived(list.filter((l) => (!f || l.kind === f) && (!who || l.uid === who)));
  const when = (t: number) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  async function view(l: GLog) { if (l.src) { const u = await mediaUrl(l.uid, l.src); if (u) openImage(u, l.title); } }
</script>
<div class="gl">
  <div class="fb">
    {#each [['', 'Hepsi'], ['note', 'Notlar'], ['shot', 'Ekran görüntüleri']] as [k, t] (k)}<button class="btn small" class:ghost={f !== k} onclick={() => (f = k as typeof f)}>{t}</button>{/each}
    <select class="inp" bind:value={who}><option value="">Tüm oyuncular</option>{#each names as [u, n] (u)}<option value={u}>{n}</option>{/each}</select>
    <small class="mono">{shown.length} KAYIT</small>
  </div>
  <div class="ls">
    {#each shown as l (l.id)}
      <div class="it {l.kind}">
        <div class="h mono"><b>{l.kind === 'note' ? 'NOT' : l.kind === 'shot' ? 'EKRAN GÖRÜNTÜSÜ' : 'İŞARET'}</b><span>{l.name}</span><span>{l.scene ?? ''}</span><span class="t">{when(l.at)}</span><button class="x" onclick={() => deleteLog(l.id)} title="Kaydı sil">×</button></div>
        {#if l.kind === 'shot'}<button class="th" onclick={() => view(l)} title="Büyüt">{#if l.thumb}<img src={l.thumb} alt="" />{/if}</button><div class="n">{l.title}</div>
        {:else}<button class="n nb" onclick={() => (open = open === l.id ? '' : l.id)}>{l.title}</button>{#if l.body}<p class:full={open === l.id}>{l.body}</p>{/if}{/if}
      </div>
    {:else}<div class="none mono">Henüz kayıt yok. Oyuncular God's Eye'da not kaydedince ya da ekran görüntüsü alınca burada görünür.</div>{/each}
  </div>
</div>
<style>
  .gl{display:flex;flex-direction:column;gap:10px;height:100%;padding:12px 16px;min-height:0}
  .fb{display:flex;gap:6px;align-items:center}.fb select{width:180px;padding:4px}.fb small{margin-left:auto;color:var(--mut);font-size:10.5px;letter-spacing:.2em}
  .ls{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;align-content:start}
  .it{border:1px solid var(--line);border-left:3px solid var(--ye);padding:8px 10px;background:rgba(0,0,0,.25);display:flex;flex-direction:column;gap:6px}.it.shot{border-left-color:var(--cy)}
  .h{display:flex;gap:8px;font-size:10.5px;color:var(--mut);align-items:center}.h b{color:var(--ye)}.shot .h b{color:var(--cy)}.h .t{margin-left:auto}
  .x{background:none;border:none;color:var(--mut);cursor:pointer;font-size:14px}.x:hover{color:var(--rd)}
  .th{padding:0;border:1px solid rgba(0,240,255,.25);background:#000;cursor:zoom-in}.th img{display:block;width:100%}
  .n{font-size:15px;color:#fff;text-align:left}.nb{background:none;border:none;padding:0;cursor:pointer;font:inherit;font-size:15px;color:#fff}
  p{margin:0;font-size:13px;color:#c9d6e2;white-space:pre-wrap;max-height:5.6em;overflow:hidden;line-height:1.4}p.full{max-height:none}
  .none{color:var(--mut);font-size:12px;padding:10px;line-height:1.5}
</style>
