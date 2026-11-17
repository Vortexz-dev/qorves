<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../lib/sfx';
  import { watchNews, saveNews, dropNews, blankNews, KINDS, type News } from '../../lib/times';
  let list = $state<News[]>([]), ed = $state<News | null>(null), msg = $state('');
  onMount(() => watchNews((xs) => (list = xs.filter((n) => n.kind !== 'event' || true))));
  async function save() { if (!ed || !ed.title.trim()) return; await saveNews({ ...ed, title: ed.title.trim(), views: ed.views || 2_000_000 }); ed = null; sfx.granted(); msg = 'Haber yayımlandı.'; }
  function pick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f || !ed) return;
    const im = new Image();
    im.onload = () => { const cv = document.createElement('canvas'), s = Math.min(1, 720 / Math.max(im.width, im.height)); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); cv.getContext('2d')!.drawImage(im, 0, 0, cv.width, cv.height); ed = { ...ed!, img: cv.toDataURL('image/webp', 0.8) }; };
    im.src = URL.createObjectURL(f);
  }
</script>
<div class="nw">
  <div class="fm">
    {#if ed}
      <h4 class="mono">HABER</h4>
      <select class="inp" bind:value={ed.kind}>{#each KINDS as k}<option value={k.id}>{k.label}</option>{/each}</select>
      <input class="inp" placeholder="Başlık" bind:value={ed.title} />
      <input class="inp" placeholder="Üst bant (ör. SON DAKİKA)" bind:value={ed.kicker} />
      <input class="inp" placeholder="Yazar / kaynak" bind:value={ed.by} />
      <textarea class="inp" rows="6" bind:value={ed.body}></textarea>
      <input class="inp" type="number" bind:value={ed.views} />
      <div class="row"><label class="btn ghost small up">Görsel<input type="file" accept="image/*" hidden onchange={pick} /></label>{#if ed.img}<button class="btn ghost small" onclick={() => ed && (ed = { ...ed, img: undefined })}>Kaldır</button>{/if}</div>
      <div class="row"><button class="btn" onclick={save}>Yayımla</button><button class="btn ghost" onclick={() => (ed = null)}>Vazgeç</button></div>
    {:else}<button class="btn" onclick={() => (ed = blankNews())}>+ Haber yaz</button>{/if}
    {#if msg}<p class="msg mono">{msg}</p>{/if}
    <p class="nt">Harita olayları otomatik manşet olur; burası senin yazdığın haber, şirket ve reklamlar içindir. Times yüklü oyuncuya sağ alttan bildirim düşer.</p>
  </div>
  <div class="ls">
    <h4 class="mono">YAYINDAKİLER ({list.length})</h4>
    {#each list as n (n.id)}
      <div class="it"><b>{n.title}</b><em>{n.kind}</em>
        <button class="btn ghost small" onclick={() => (ed = { ...n })}>Düzenle</button>
        <button class="btn red small" onclick={() => dropNews(n.id)}>Sil</button></div>
    {:else}<p class="none">Kayıtlı haber yok (saha olayları istemcide türetilir).</p>{/each}
  </div>
</div>
<style>
  .nw{display:grid;grid-template-columns:1fr 1fr;gap:16px;height:100%;min-height:0;padding:12px 16px}
  .fm,.ls{overflow:auto;display:flex;flex-direction:column;gap:8px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye)}
  .it{display:flex;gap:8px;align-items:center;border:1px solid var(--line);padding:6px 8px}.it em{margin-left:auto;font-style:normal;color:var(--mut);font-size:11px}
  .row{display:flex;gap:8px}.nt{color:var(--mut);font-size:12.5px}.msg{color:#39ff8a}.none{color:var(--mut)}.up{position:relative}
</style>
