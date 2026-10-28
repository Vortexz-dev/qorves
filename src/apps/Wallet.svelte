<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { watchWallet, CURRENCIES, type Wallet, type Tx } from '../lib/live';
  const u = session.user!;
  let w = $state<Wallet | null>(null), tx = $state<Tx[]>([]), ready = $state(false), cur = $state('BK');
  onMount(() => watchWallet(u.uid, (a, b) => { w = a; tx = b; ready = true; }));
  const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const list = $derived(tx.filter((t) => t.cur === cur));
</script>
<div class="wl">
  <div class="cards">
    {#each CURRENCIES as c (c.id)}
      <button class="cd" class:on={cur === c.id} onclick={() => (cur = c.id)}>
        <span class="mono k">{c.name.toLocaleUpperCase('tr')}</span>
        <b>{fmt(w?.bal?.[c.id] ?? 0)} <i>{c.sym}</i></b>
        <small>{c.note}</small>
      </button>
    {/each}
  </div>
  <div class="mono h">İŞLEM GEÇMİŞİ · {cur}</div>
  <div class="tx">
    {#each list as t (t.id)}
      <div class="t"><span class="a mono" class:p={t.amt > 0} class:n={t.amt < 0}>{t.amt > 0 ? '+' : ''}{fmt(t.amt)}</span><span class="r">{t.reason}</span><span class="mono d">{new Date(t.at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span><span class="mono b">= {fmt(t.bal)}</span></div>
    {:else}<div class="none mono">{ready ? 'Bu hesapta henüz işlem yok.' : 'BAĞLANIYOR…'}</div>{/each}
  </div>
  <div class="mono ft">Bakiye ve işlemler yetkili merci (DM) tarafından işlenir. Oyuncular arası aktarım bu sürümde kapalı.</div>
</div>
<style>
  .wl{height:100%;display:flex;flex-direction:column;gap:12px;padding:18px 20px}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .cd{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px 14px;background:linear-gradient(135deg,rgba(0,240,255,.08),rgba(0,0,0,.2));border:1px solid var(--line);color:var(--tx);text-align:left;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)}
  .cd.on{border-color:var(--ye);background:linear-gradient(135deg,rgba(252,238,10,.12),rgba(0,0,0,.2))}
  .k{font-size:9.5px;letter-spacing:.25em;color:var(--cy)}.cd b{font-family:var(--f-disp);font-size:24px;color:#fff}.cd b i{font-style:normal;font-size:13px;color:var(--ye)}.cd small{color:var(--mut);font-size:12px}
  .h{font-size:10px;letter-spacing:.3em;color:var(--cy);margin-top:4px}
  .tx{flex:1;overflow:auto;border:1px solid var(--line)}
  .t{display:grid;grid-template-columns:110px 1fr 120px 100px;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(0,240,255,.08);align-items:center}
  .a{font-size:15px}.a.p{color:#39ff8a}.a.n{color:var(--rd)}.r{font-size:14.5px}.d,.b{font-size:11px;color:var(--mut);text-align:right}
  .none{padding:20px;color:var(--mut);font-size:12px}
  .ft{font-size:10px;color:var(--mut);letter-spacing:.08em}
</style>
