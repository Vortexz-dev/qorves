<script lang="ts">
  // Canlı zar akışı: tüm oyuncuların atışları anında düşer.
  import { onMount } from 'svelte';
  import { watchRolls, type Roll } from '../../lib/live';
  import { fmtMod } from '../../lib/dice';
  import { sfx } from '../../lib/sfx';
  let rolls = $state<Roll[]>([]), first = true, flashId = $state('');
  onMount(() => watchRolls(null, (r) => { if (!first && r[0] && r[0].id !== rolls[0]?.id) { flashId = r[0].id ?? ''; r[0].nat === 'nat20' ? sfx.crit() : r[0].nat === 'nat1' ? sfx.fumble() : sfx.ping(); } rolls = r; first = false; }, 80));
  const dice = (r: Roll) => r.groups.map((g) => `${g.n}d${g.d}[${g.vals.map((v, i) => (g.keep && !g.keep.includes(i) ? `~${v}~` : v)).join(', ')}]`).join(' + ');
</script>
<div class="df">
  <h4 class="mono">CANLI ZAR AKIŞI <span>● son {rolls.length} atış</span></h4>
  <div class="ls">
    {#each rolls as r (r.id)}
      <div class="r" class:n20={r.nat === 'nat20'} class:n1={r.nat === 'nat1'} class:fl={flashId === r.id}>
        <span class="who"><b>{r.char || r.user}</b><small>@{r.user}{#if r.label} · {r.label}{/if}</small></span>
        <span class="ex mono">{r.expr}{#if r.adv} · {r.adv === 'adv' ? 'AVANTAJ' : 'DEZAVANTAJ'}{/if}</span>
        <span class="dc mono">{dice(r)}{#if r.mod} {fmtMod(r.mod)}{/if}</span>
        <span class="tt">{r.total}</span>
        <span class="nt mono">{r.nat === 'nat20' ? 'NAT 20' : r.nat === 'nat1' ? 'NAT 1' : ''}</span>
        <span class="tm mono">{new Date(r.at).toLocaleTimeString('tr-TR')}</span>
      </div>
    {:else}<div class="none mono">Henüz atış yok.</div>{/each}
  </div>
</div>
<style>
  .df{display:flex;flex-direction:column;height:100%;min-height:0;padding:12px 16px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:0 0 8px;display:flex;gap:12px}h4 span{color:#39ff8a}
  .ls{flex:1;overflow:auto;border:1px solid var(--line)}
  .r{display:grid;grid-template-columns:200px 150px 1fr 60px 64px 76px;gap:10px;align-items:center;padding:7px 12px;border-bottom:1px solid rgba(0,240,255,.07)}
  .r.fl{animation:fl 1.6s}@keyframes fl{0%{background:rgba(252,238,10,.25)}100%{background:transparent}}
  .who{display:flex;flex-direction:column;font-size:14.5px}.who small{font-size:11px;color:var(--mut)}
  .ex{font-size:12px;color:var(--cy)}.dc{font-size:11.5px;color:#b9c8d6;word-break:break-all}
  .tt{font-family:var(--f-disp);font-size:22px;color:#fff;text-align:right}
  .nt{font-size:10.5px;letter-spacing:.12em}.tm{font-size:10.5px;color:var(--mut);text-align:right}
  .n20{background:rgba(57,255,138,.06)}.n20 .tt,.n20 .nt{color:#39ff8a;text-shadow:0 0 10px #39ff8a}
  .n1{background:rgba(255,42,85,.07)}.n1 .tt,.n1 .nt{color:var(--rd);text-shadow:0 0 10px var(--rd)}
  .none{color:var(--mut);font-size:12px;padding:12px}
</style>
