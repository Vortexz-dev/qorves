<script lang="ts">
  import type { Character } from '../../lib/backend';
  import { setProfileField } from '../../lib/live';
  import { sfx } from '../../lib/sfx';
  import { STATS, saveSheet, poolPoints, type Sheet } from '../../lib/persona';
  const HINT: Record<string, string> = {
    STR: 'Güç — taşıma, yakın dövüş, ham kuvvet',
    DEX: 'Çeviklik — isabet, gizlilik, refleks',
    CON: 'Dayanıklılık — can, zehir, yorgunluk',
    INT: 'Zekâ — ağ, teknik, bilgi',
    WIS: 'Bilgelik — sezgi, irade, iz sürme',
    CHA: 'Karizma — ikna, sahne, bağlantı',
  };
  let { uid, c, sheet, dm, onsheet }: { uid: string; c: Character; sheet: Sheet; dm: boolean; onsheet: (s: Sheet) => void } = $props();
  let busy = $state(false), err = $state('');
  async function spend(k: string) {
    if (sheet.unspent < 1 || busy) return;
    busy = true;
    try {
      const stats = { ...c.stats, [k]: (c.stats?.[k] ?? 0) + 1 };
      await setProfileField(uid, { 'character.stats': stats });
      c.stats = stats;
      const nx = { ...sheet, unspent: sheet.unspent - 1 };
      await saveSheet(uid, { unspent: nx.unspent });
      onsheet(nx); sfx.granted();
    } catch (e) { err = String(e); sfx.error(); }
    busy = false;
  }
</script>

<div class="st">
  <div class="pts" class:hot={sheet.unspent > 0}>
    <div class="mono">HARCANMAMIŞ PUAN</div>
    <b>{sheet.unspent}</b>
    <span>Her seviye +3. 1. seviyede 9 puan vardı ve dağıtıldı. Toplam havuz: {poolPoints(c.level ?? 1)}.</span>
    {#if sheet.unspent > 0}<em>!</em>{/if}
  </div>
  <div class="grid">
    {#each STATS as k (k)}
      <div class="stat">
        <header class="mono">{k}</header>
        <b>{c.stats?.[k] ?? 0}</b>
        <p>{HINT[k]}</p>
        <button class="btn" disabled={sheet.unspent < 1 || busy} onclick={() => spend(k)}>+1</button>
      </div>
    {/each}
  </div>
  <div class="fx">
    <div class="mono h">DURUM ETKİLERİ</div>
    {#if sheet.status?.length}
      {#each sheet.status as s (s.id)}
        <article class={s.kind}><b>{s.name}</b><span class="mono">{s.kind === 'buff' ? 'OLUMLU' : s.kind === 'debuff' ? 'OLUMSUZ' : 'DURUM'}</span><p>{s.desc}</p></article>
      {/each}
    {:else}<p class="none">Aktif durum etkisi yok. Bunları DM ekler.</p>{/if}
    {#if dm}<p class="hint mono">Stat sıfırlama yalnız DM panelinden yapılır.</p>{/if}
    {#if err}<p class="err">{err}</p>{/if}
  </div>
</div>

<style>
  .st{flex:1;min-height:0;overflow:auto;padding:18px 28px 28px;display:flex;flex-direction:column;gap:18px;position:relative;z-index:1}
  .pts{position:relative;border:1px solid rgba(0,240,255,.25);padding:14px 18px;background:rgba(0,0,0,.3);max-width:640px}
  .pts.hot{border-color:var(--ye);box-shadow:0 0 16px rgba(252,238,10,.12)}
  .pts .mono{font-size:10.5px;letter-spacing:.28em;color:var(--cy)}
  .pts b{font-family:var(--f-disp);font-size:48px;color:var(--ye);line-height:1}
  .pts span{display:block;color:var(--mut);font-size:13px;max-width:520px}
  .pts em{position:absolute;right:16px;top:16px;width:22px;height:22px;border-radius:50%;background:var(--ye);color:#111;display:grid;place-items:center;font-style:normal;font-weight:700}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .stat{border:1px solid var(--line);padding:14px;background:rgba(4,6,12,.55)}
  .stat header{font-size:11px;letter-spacing:.3em;color:var(--cy)}.stat b{font-family:var(--f-disp);font-size:36px;color:#fff}
  .stat p{font-size:12.5px;color:var(--mut);min-height:2.4em;margin:4px 0 8px}
  .h{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin-bottom:8px}
  article{border:1px solid var(--line);border-left:3px solid var(--cy);padding:10px 12px;margin-bottom:8px;background:rgba(0,0,0,.25)}
  article.debuff{border-left-color:var(--rd)}article.buff{border-left-color:#39ff8a}
  article b{margin-right:8px}article span{font-size:10px;letter-spacing:.16em;color:var(--mut)}article p{margin:4px 0 0;color:#d6e2ee}
  .none,.hint{color:var(--mut);font-size:13px}.err{color:var(--rd)}
  @media (max-width:900px){.grid{grid-template-columns:1fr 1fr}}
</style>
