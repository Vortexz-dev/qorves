<script lang="ts">
  // CROWN CLASH QORE alımları: her satın alma gerçek BK ile; cüzdan + tx + kayıt aynı toplu yazımda (kurallar bağlar).
  import { onMount } from 'svelte';
  import { watchBuys, type Buy } from '../clash/net';
  let buys = $state<Buy[]>([]);
  onMount(() => watchBuys((b) => (buys = b)));
  const total = $derived(buys.reduce((s, b) => s + b.bk, 0));
  const fmt = (n: number) => n.toLocaleString('tr-TR');
</script>
<div class="df">
  <h4 class="mono">CROWN CLASH · QORE ALIMLARI <span>son {buys.length} alım</span><b>Toplam: {fmt(total)} BK</b></h4>
  <p class="nt">Oyuncular premium QORE'yi yalnız karakterin BK bakiyesiyle alır (100 = 500 BK · 550 = 2.500 BK · 1.200 = 5.000 BK). Her alım cüzdan işlem geçmişine de düşer.</p>
  <div class="ls">
    {#each buys as b (b.id)}
      <div class="r"><span class="who"><b>{b.name}</b></span><span class="mono q">+{fmt(b.qore)} QORE</span><span class="mono d">−{fmt(b.bk)} BK</span><span class="mono t">kalan {fmt(b.bal)} BK</span><span class="mono t">{new Date(b.at).toLocaleString('tr-TR')}</span></div>
    {:else}<div class="none mono">Henüz alım yok.</div>{/each}
  </div>
</div>
<style>
  .df{display:flex;flex-direction:column;height:100%;min-height:0;padding:12px 16px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:0 0 6px;display:flex;gap:14px;align-items:baseline}h4 span{color:var(--mut)}h4 b{margin-left:auto;color:#39ff8a;font-size:12px}
  .nt{font-size:12.5px;color:var(--mut);margin:0 0 8px}
  .ls{flex:1;overflow:auto;border:1px solid var(--line)}
  .r{display:grid;grid-template-columns:200px 130px 120px 150px 1fr;gap:10px;align-items:center;padding:6px 12px;border-bottom:1px solid rgba(0,240,255,.07);font-size:13px}
  .r .mono{font-size:11.5px}.t{color:var(--mut)}.q{color:#c48bff}.d{color:#ff6b81}
  .none{padding:16px;color:var(--mut)}
</style>
