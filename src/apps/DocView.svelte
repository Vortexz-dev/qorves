<script lang="ts">
  // Masaüstüne bırakılmış belge (çoğunlukla DM'den gelir): salt okunur görüntüleyici.
  import { desk } from '../lib/desk.svelte';
  import type { Win } from '../desktop/wm.svelte';
  import { mediaUrl } from '../lib/live';
  import { session } from '../lib/session.svelte';
  import { openImage } from '../lib/lightbox.svelte';
  let { arg, win }: { arg?: string; win: Win } = $props();
  const it = $derived(desk.items.find((i) => i.id === arg));
  $effect(() => { if (it) win.title = it.name; });
  let img = $state('');
  $effect(() => { const s = it?.src; img = ''; if (s) mediaUrl(session.user!.uid, s).then((u) => (img = u)); });
</script>
<div class="dv">
  {#if it}
    <header class="mono"><span>BELGE · {it.from === 'dm' ? 'GELEN AKTARIM' : 'YEREL'}</span><span>{new Date(it.updatedAt).toLocaleString('tr-TR')}</span></header>
    <h2>{it.name}</h2>
    {#if it.src && !img}<div class="mono ld">GÖRSEL ÇÖZÜLÜYOR…</div>{:else if img}<button class="ib" onclick={() => openImage(img, it.name)}><img src={img} alt={it.name} data-nolb /></button>{/if}
    <pre>{it.body ?? ''}</pre>
  {:else}<div class="mono none">BELGE BULUNAMADI</div>{/if}
</div>
<style>
  .dv{height:100%;overflow:auto;padding:20px 26px;background:linear-gradient(180deg,rgba(0,240,255,.03),transparent 30%)}
  header{display:flex;justify-content:space-between;font-size:10.5px;letter-spacing:.25em;color:var(--cy);border-bottom:1px solid var(--line);padding-bottom:8px}
  h2{font-family:var(--f-disp);font-size:22px;color:var(--ye);margin:14px 0 12px;letter-spacing:.05em}
  .ib{display:block;padding:0;border:0;background:none}.ld{color:var(--mut);font-size:11px;padding:10px 0}
  img{max-width:100%;border:1px solid var(--line);margin-bottom:12px}
  pre{white-space:pre-wrap;font-family:var(--f-ui);font-size:16px;line-height:1.6;color:#dbe8f3}
  .none{color:var(--mut);padding:30px}
</style>
