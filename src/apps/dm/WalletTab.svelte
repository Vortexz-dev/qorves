<script lang="ts">
  // Oyuncu cüzdanı: bakiye belirle ya da ekle/çıkar; her işlem gerekçesiyle kayda geçer.
  import { dm, pname, when } from './store.svelte';
  import PlayerPick from './PlayerPick.svelte';
  import { watchWallet, adjustWallet, CURRENCIES, type Wallet, type Tx } from '../../lib/live';
  import { sfx } from '../../lib/sfx';
  let w = $state<Wallet | null>(null), tx = $state<Tx[]>([]), cur = $state('BK'), amt = $state<number>(0), reason = $state(''), mode = $state<'add' | 'sub' | 'set'>('add'), msg = $state(''), busy = $state(false);
  $effect(() => { const id = dm.pid; if (!id) return; w = null; tx = []; return watchWallet(id, (a, b) => { w = a; tx = b; }); });
  const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 4000); };
  async function apply() {
    const a = Number(amt); if (!Number.isFinite(a) || (mode !== 'set' && a <= 0) || !reason.trim()) return; busy = true;
    try { const nb = await adjustWallet(dm.pid, cur, mode === 'sub' ? -a : a, reason.trim(), mode === 'set'); sfx.granted(); flash(`${pname(dm.pid)} · ${cur} yeni bakiye: ${fmt(nb)}`); amt = 0; reason = ''; } catch (e) { sfx.error(); flash('Hata: ' + String(e)); }
    busy = false;
  }
</script>
<div class="wt">
  <div class="top"><PlayerPick /></div>
  <div class="cols">
    <div class="fm">
      <div class="bals">{#each CURRENCIES as c (c.id)}<button class:on={cur === c.id} onclick={() => (cur = c.id)}><small class="mono">{c.name}</small><b>{fmt(w?.bal?.[c.id] ?? 0)} <i>{c.sym}</i></b></button>{/each}</div>
      <div class="md">{#each [['add', '+ Ekle'], ['sub', '− Düş'], ['set', '= Belirle']] as [k, l] (k)}<button class:on={mode === k} onclick={() => (mode = k as typeof mode)}>{l}</button>{/each}</div>
      <label class="field"><span>Tutar ({cur})</span><input class="inp" type="number" min="0" step="any" bind:value={amt} /></label>
      <label class="field"><span>Gerekçe (oyuncu görür)</span><input class="inp" bind:value={reason} maxlength="200" placeholder="ör. Görev ödülü: Kayıp kargo" /></label>
      <button class="btn" disabled={busy || !reason.trim() || (mode !== 'set' && !(Number(amt) > 0))} onclick={apply}>Uygula</button>
      {#if msg}<p class="msg mono">{msg}</p>{/if}
      <p class="nt">Para birimleri bilgi bankasındaki kayıtlardan: Birleşik Kredisi (BK), Cumhuriyet Markı, Kantar. Oyuncular arası aktarım kapalı (güvenli kural yazılamadı).</p>
    </div>
    <div class="ls">
      <h4 class="mono">İŞLEMLER</h4>
      {#each tx as t (t.id)}<div class="t"><span class="mono a" class:p={t.amt > 0} class:n={t.amt < 0}>{t.amt > 0 ? '+' : ''}{fmt(t.amt)} {t.cur}</span><span>{t.reason}</span><span class="mono d">{when(t.at)}</span><span class="mono d">= {fmt(t.bal)}</span></div>{:else}<div class="none mono">İşlem yok.</div>{/each}
    </div>
  </div>
</div>
<style>
  .wt{display:flex;flex-direction:column;height:100%;min-height:0;padding:12px 16px;gap:10px}
  .cols{flex:1;display:grid;grid-template-columns:420px 1fr;gap:16px;min-height:0}
  .fm{display:flex;flex-direction:column;gap:8px;overflow:auto}.ls{overflow:auto;border:1px solid var(--line)}
  .bals{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.bals button{display:flex;flex-direction:column;align-items:flex-start;background:rgba(0,0,0,.25);border:1px solid var(--line);color:var(--tx);padding:7px 9px}.bals button.on{border-color:var(--ye)}
  .bals small{font-size:9.5px;color:var(--cy);letter-spacing:.1em}.bals b{font-family:var(--f-disp);font-size:17px;color:#fff}.bals i{font-style:normal;font-size:11px;color:var(--ye)}
  .md{display:flex;gap:6px}.md button{flex:1;background:none;border:1px solid var(--line);color:var(--mut);padding:6px;font:inherit}.md button.on{border-color:var(--cy);color:var(--cy);background:rgba(0,240,255,.08)}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:8px 10px}
  .t{display:grid;grid-template-columns:130px 1fr 140px 90px;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(0,240,255,.07);font-size:14px;align-items:center}
  .a.p{color:#39ff8a}.a.n{color:var(--rd)}.d{font-size:10.5px;color:var(--mut);text-align:right}
  .msg{font-size:11.5px;color:#39ff8a}.nt{font-size:12px;color:var(--mut);line-height:1.45}.none{color:var(--mut);font-size:12px;padding:10px}
</style>
