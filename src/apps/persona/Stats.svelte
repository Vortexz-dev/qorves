<script lang="ts">
  /* ÖZELLİKLER: altı düğümlü özellik halkası, harcanmamış puan (!), türetilmiş değerler. DM sıfırlayabilir. */
  import { fade } from 'svelte/transition';
  import type { Character } from '../../lib/backend';
  import { setProfileField } from '../../lib/live';
  import { ask } from '../../lib/confirm.svelte';
  import { STATS, saveSheet, poolPoints, resetStats, maxHp, maxCarry, hardCarry, type Sheet } from '../../lib/persona';
  import { P } from './psfx';
  let { uid, c, sheet, editable, canEdit, onsheet }: { uid: string; c: Character; sheet: Sheet; editable: boolean; canEdit: boolean; onsheet: (s: Sheet) => void } = $props();
  const META: Record<string, { n: string; h: string; ic: string }> = {
    STR: { n: 'GÜÇ', h: 'Taşıma kapasitesi, yakın dövüş, ham kuvvet.', ic: 'M4 10h3v4H4zM17 10h3v4h-3zM7 11h10v2H7zM2 11h2v2H2zM20 11h2v2h-2z' },
    DEX: { n: 'ÇEVİKLİK', h: 'İsabet, gizlilik, refleks.', ic: 'M13 3l-6 9h5l-1 9 6-10h-5z' },
    CON: { n: 'DAYANIKLILIK', h: 'Can, zehir direnci, yorgunluk.', ic: 'M12 21s-7-4.6-9.3-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.3 6c-2.3 4.4-9.3 9-9.3 9z' },
    INT: { n: 'ZEKÂ', h: 'Ağ, teknik, bilgi.', ic: 'M9 3h6v3h3v3h3v6h-3v3h-3v3H9v-3H6v-3H3V9h3V6h3zM10 10h4v4h-4z' },
    WIS: { n: 'BİLGELİK', h: 'Sezgi, irade, iz sürme.', ic: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 .01 0z' },
    CHA: { n: 'KARİZMA', h: 'İkna, sahne, bağlantı.', ic: 'M4 5h16v10H9l-5 4zM8 9h8M8 12h5' },
  };
  let busy = $state(false), err = $state(''), hov = $state<string | null>(null), flash = $state<string | null>(null);
  const sv = (k: string) => c.stats?.[k] ?? 0;
  const pos = (i: number) => { const a = -Math.PI / 2 + (i * Math.PI * 2) / 6; return { x: 50 + Math.cos(a) * 34, y: 50 + Math.sin(a) * 38 }; };
  async function spend(k: string) {
    if (!editable || sheet.unspent < 1 || busy) { P.deny(); return; }
    busy = true;
    try {
      const stats = { ...c.stats, [k]: sv(k) + 1 };
      await setProfileField(uid, { 'character.stats': stats });
      c.stats = stats;
      const nx = { ...sheet, unspent: sheet.unspent - 1 };
      await saveSheet(uid, { unspent: nx.unspent });
      onsheet(nx); P.spend(); flash = k; setTimeout(() => (flash = null), 700);
    } catch (e) { err = String(e); P.deny(); }
    busy = false;
  }
  async function reset() { if (!(await ask('Statlar sıfırlansın mı?', 'Tüm statlar 0 olur; oyuncu puanlarını yeniden dağıtır.', 'Sıfırla'))) return; await resetStats(uid, c.level ?? 1); P.confirm(); }
</script>

<div class="sv">
  <div class="ring">
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="web">
      {#each STATS as _, i}{@const a = pos(i)}{@const b = pos((i + 1) % 6)}<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />{/each}
      {#each STATS as k, i}{@const a = pos(i)}<line x1="50" y1="50" x2={a.x} y2={a.y} class:hot={hov === k} />{/each}
    </svg>
    <div class="core" class:hot={sheet.unspent > 0}>
      <div class="cr"></div><div class="cr b"></div>
      <span class="mono">HARCANMAMIŞ</span>
      <b>{sheet.unspent}</b>
      {#if sheet.unspent > 0}<em class="mono">! PUAN DAĞIT</em>{:else}<small class="mono">HAVUZ {poolPoints(c.level ?? 1)}</small>{/if}
    </div>
    {#each STATS as k, i (k)}
      {@const p = pos(i)}
      <div class="node" class:hov={hov === k} class:fl={flash === k} style:left="{p.x}%" style:top="{p.y}%" role="group" aria-label={META[k].n}
        onmouseenter={() => { hov = k; P.hover(); }} onmouseleave={() => (hov = null)}>
        <div class="hex"><svg viewBox="0 0 24 24"><path d={META[k].ic} /></svg><b>{sv(k)}</b></div>
        <div class="lb"><span class="mono">{k}</span><strong>{META[k].n}</strong></div>
        {#if editable && sheet.unspent > 0}<button class="plus" onclick={() => spend(k)} disabled={busy} aria-label="{META[k].n} +1" in:fade>+</button>{/if}
        {#if hov === k}<p class="hint" transition:fade={{ duration: 120 }}>{META[k].h}</p>{/if}
      </div>
    {/each}
  </div>
  <aside>
    <div class="card"><header class="mono">TÜRETİLMİŞ</header>
      <div class="kv"><span>Azami can</span><b>{maxHp(c.race, sv('CON') || 10)}</b></div>
      <div class="kv"><span>Taşıma</span><b>{maxCarry(sv('STR') || 10)} kg</b></div>
      <div class="kv"><span>Sert limit</span><b>{hardCarry(sv('STR') || 10)} kg</b></div>
      <div class="kv"><span>Toplam dağıtılan</span><b>{STATS.reduce((a, k) => a + sv(k), 0)}</b></div>
    </div>
    <div class="card"><header class="mono">KURAL</header><p>Her seviye <b>+3</b> puan getirir. 1. seviyede 9 puan dağıtılır. Dağıtılan puan geri alınmaz; sıfırlamayı yalnız DM yapar.</p></div>
    {#if canEdit}<button class="rst" onclick={reset}>STATLARI SIFIRLA (DM)</button>{/if}
    {#if err}<p class="e">{err}</p>{/if}
  </aside>
</div>

<style>
  .sv{position:absolute;inset:0;display:grid;grid-template-columns:1fr 300px;gap:24px;padding:20px 28px}
  .ring{position:relative;min-height:0}
  .web{position:absolute;inset:0;width:100%;height:100%}
  .web line{stroke:rgba(255,93,93,.35);stroke-width:1;vector-effect:non-scaling-stroke;stroke-dasharray:3 4}
  .web line.hot{stroke:var(--pc);stroke-width:1.5;stroke-dasharray:none;filter:drop-shadow(0 0 4px var(--pc))}
  .core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:180px;height:180px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(255,93,93,.14),rgba(8,2,5,.9) 70%);border:1px solid rgba(255,93,93,.4)}
  .cr{position:absolute;inset:-10px;border-radius:50%;border:1px dashed rgba(255,93,93,.4);animation:sp 18s linear infinite}.cr.b{inset:-22px;border:2px solid transparent;border-top-color:var(--pc);border-bottom-color:var(--pc);animation-duration:6s;animation-direction:reverse}
  @keyframes sp{to{transform:rotate(360deg)}}
  .core span{font-size:10px;letter-spacing:.3em;color:var(--pr)}
  .core b{font-family:var(--f-disp);font-size:56px;color:#fff;line-height:1}
  .core small{font-size:10px;letter-spacing:.2em;color:var(--mut)}
  .core.hot{border-color:var(--py);box-shadow:0 0 40px rgba(252,238,10,.25)}.core.hot b{color:var(--py);text-shadow:0 0 20px rgba(252,238,10,.6)}
  .core em{font-style:normal;font-size:11px;letter-spacing:.16em;color:#000;background:var(--py);padding:2px 8px;margin-top:6px;animation:bl 1s steps(2) infinite}
  @keyframes bl{50%{opacity:.45}}
  .node{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2}
  .hex{position:relative;width:104px;height:116px;display:grid;place-items:center;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(160deg,rgba(255,93,93,.5),rgba(255,93,93,.12));transition:transform .2s}
  .hex::before{content:"";position:absolute;inset:2px;clip-path:inherit;background:radial-gradient(circle at 50% 30%,rgba(255,93,93,.18),#0b0306 70%)}
  .hex svg{position:absolute;top:18px;width:22px;height:22px;fill:none;stroke:var(--pr);stroke-width:1.5;stroke-linejoin:round;z-index:1}
  .hex b{position:relative;z-index:1;font-family:var(--f-disp);font-size:38px;color:#fff;margin-top:16px}
  .node.hov .hex{transform:scale(1.07);background:linear-gradient(160deg,var(--pc),rgba(94,246,255,.2))}.node.hov .hex svg{stroke:var(--pc)}
  .node.fl .hex{animation:fl .7s ease-out}@keyframes fl{0%{filter:brightness(3)}100%{filter:none}}
  .lb{display:flex;flex-direction:column;align-items:center}.lb span{font-size:10px;letter-spacing:.3em;color:var(--pr)}.lb strong{font-size:14px;letter-spacing:.18em;color:#fff}
  .plus{position:absolute;right:-6px;top:6px;width:30px;height:30px;border-radius:50%;border:0;background:var(--py);color:#000;font:700 20px var(--f-disp);cursor:var(--cur-p);box-shadow:0 0 16px rgba(252,238,10,.7);animation:pu 1.2s ease-in-out infinite}
  .plus:hover{transform:scale(1.15)}@keyframes pu{50%{box-shadow:0 0 4px rgba(252,238,10,.3)}}
  .hint{position:absolute;top:100%;width:200px;text-align:center;font-size:12.5px;color:#dcc;background:rgba(10,3,6,.95);border:1px solid var(--pl);padding:6px 8px;margin:4px 0 0}
  aside{display:flex;flex-direction:column;gap:12px;overflow:auto}
  .card{padding:12px 14px;background:linear-gradient(160deg,rgba(255,93,93,.07),rgba(8,3,6,.7));border:1px solid rgba(255,93,93,.22);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)}
  header{font-size:10.5px;letter-spacing:.3em;color:var(--pr);margin-bottom:8px}
  .kv{display:flex;justify-content:space-between;font-size:13.5px;padding:4px 0;border-bottom:1px dashed rgba(255,93,93,.15)}.kv span{color:var(--mut)}.kv b{color:#fff;font-family:var(--f-disp)}
  .card p{margin:0;font-size:13.5px;line-height:1.5;color:#dcc}.card p b{color:var(--py)}
  .rst{background:none;border:1px solid var(--pr);color:var(--pr);padding:9px;font:600 12px var(--f-ui);letter-spacing:.2em;cursor:var(--cur-p)}.rst:hover{background:rgba(255,93,93,.12)}
  .e{color:var(--pr);font-size:13px}
</style>
