<script lang="ts">
  import type { Character, UserProfile } from '../../lib/backend';
  import { RACES, CLASSES, BACKGROUNDS, CHROME_TIERS, FACTIONS } from '../../lib/data/character';
  import { maxHp, maxCarry, hardCarry, carryOf, armorOf, moneyLine, type Sheet, type InvItem, type ChromePiece } from '../../lib/persona';
  import type { Wallet } from '../../lib/live';
  let { c, u, sheet, inv, wallet, chrome }: { c: Character; u: UserProfile; sheet: Sheet; inv: InvItem[]; wallet: Wallet | null; chrome: ChromePiece[] } = $props();
  const lab = (xs: { id: string; label: string }[], id: string) => xs.find((x) => x.id === id)?.label ?? id;
  const hpMax = $derived(maxHp(c.race, c.stats?.CON ?? 10));
  const hp = $derived(sheet.hp < 0 ? hpMax : Math.min(sheet.hp, hpMax));
  const kg = $derived(carryOf(inv));
  const cap = $derived(maxCarry(c.stats?.STR ?? 10));
  const hard = $derived(hardCarry(c.stats?.STR ?? 10));
  const enc = $derived(kg > cap);
  const arm = $derived(armorOf(inv, sheet.armor));
  const cls = $derived([lab(CLASSES, c.cls), c.sub && (CLASSES.find((x) => x.id === c.cls)?.subs.find((s) => s.id === c.sub)?.label), c.cls2 && lab(CLASSES, c.cls2)].filter(Boolean).join(' · '));
</script>

<div class="ov">
  <div class="col l">
    <div class="meter">
      <header class="mono">CAN</header>
      <b class="big" class:low={hp / hpMax < 0.3}>{hp}<small>/{hpMax}</small></b>
      <div class="bar"><i style:width="{(hp / hpMax) * 100}%"></i></div>
    </div>
    <div class="meter">
      <header class="mono">ZIRH</header>
      <b class="big">{arm}</b>
      <span class="hint">Kuşanılmış zırh + düzeltme</span>
    </div>
    <div class="meter" class:enc>
      <header class="mono">AĞIRLIK</header>
      <b class="big">{kg.toFixed(1)}<small>/{cap} kg</small></b>
      <div class="bar w"><i style:width="{Math.min(100, (kg / cap) * 100)}%"></i></div>
      {#if enc}<span class="hint bad">{kg > hard ? 'SERT LİMİT' : 'AŞIRI YÜK — ENCUMBERED'}</span>{/if}
    </div>
    <div class="meter">
      <header class="mono">KREDİ</header>
      <b class="mon">{moneyLine(wallet)}</b>
    </div>
  </div>

  <div class="mid">
    <div class="frame">
      <img src={u.avatar} alt={c.name} />
      <div class="scan"></div>
    </div>
    <div class="idc">
      <div class="mono t">KİMLİK KAYDI</div>
      <h1>{c.name}</h1>
      <div class="tags">
        <span>{lab(RACES, c.race)}</span>
        {#if c.origin}<span>{c.origin}</span>{/if}
        {#if c.faction && c.faction !== 'none'}<span>{lab(FACTIONS, c.faction)}</span>{/if}
      </div>
    </div>
  </div>

  <div class="col r">
    <div class="meter">
      <header class="mono">SEVİYE</header>
      <b class="big">{c.level ?? 1}</b>
      <span class="hint">{cls || 'Sınıf belirtilmemiş'}</span>
    </div>
    <div class="meter">
      <header class="mono">KROM</header>
      <b class="midb">{lab(CHROME_TIERS, String(c.chrome ?? '0'))}</b>
      <span class="hint">{chrome.length} parça takılı{#if c.visibleChrome} · görünür{/if}</span>
    </div>
    <div class="meter">
      <header class="mono">KOPUŞ</header>
      <b class="big" class:hot={sheet.kopus >= 7}>{sheet.kopus}<small>/10</small></b>
      <div class="dots">{#each Array(10) as _, i}<i class:on={i < sheet.kopus} class:hot={i >= 6}></i>{/each}</div>
    </div>
    <div class="meta mono">
      {#if c.job}<div><s>İŞ</s>{c.job}</div>{/if}
      {#if c.clan}<div><s>KLAN / AİLE</s>{c.clan}</div>{/if}
      {#if c.background}<div><s>GEÇMİŞ</s>{lab(BACKGROUNDS, c.background)}</div>{/if}
      {#if c.age}<div><s>YAŞ</s>{c.age}</div>{/if}
    </div>
  </div>
</div>

<style>
  .ov{flex:1;min-height:0;display:grid;grid-template-columns:1fr minmax(280px,36vw) 1fr;gap:18px;padding:18px 28px 24px;position:relative;z-index:1}
  .col{display:flex;flex-direction:column;gap:12px;justify-content:center}
  .meter{border:1px solid rgba(0,240,255,.22);background:rgba(4,6,12,.55);padding:14px 16px;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px))}
  .meter header{font-size:10px;letter-spacing:.28em;color:var(--cy);margin-bottom:4px}
  .big{font-family:var(--f-disp);font-size:42px;color:#fff;letter-spacing:.04em;line-height:1}.big small{font-size:16px;color:var(--mut);margin-left:4px}
  .big.low{color:var(--rd)}.big.hot{color:var(--rd)}
  .midb{font-family:var(--f-disp);font-size:20px;color:var(--ye)}
  .mon{font-family:var(--f-mono);font-size:15px;color:#fff}
  .hint{display:block;margin-top:6px;font-size:12px;color:var(--mut)}.hint.bad{color:var(--ye)}
  .bar{height:6px;background:rgba(255,255,255,.08);margin-top:10px;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#39ff8a,var(--cy));box-shadow:0 0 8px var(--cy)}
  .bar.w i{background:linear-gradient(90deg,var(--cy),var(--ye))}.enc .bar.w i{background:var(--rd)}
  .dots{display:flex;gap:5px;margin-top:10px}.dots i{flex:1;height:8px;background:rgba(255,255,255,.1)}.dots i.on{background:var(--ye);box-shadow:0 0 6px var(--ye)}.dots i.on.hot{background:var(--rd);box-shadow:0 0 6px var(--rd)}
  .mid{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
  .frame{position:relative;width:min(32vw,380px);aspect-ratio:3/4.4;border:1px solid rgba(252,238,10,.45);overflow:hidden;background:#05060a;box-shadow:0 0 40px rgba(252,238,10,.08),inset 0 0 40px rgba(0,240,255,.05)}
  .frame img{width:100%;height:100%;object-fit:cover;object-position:top;filter:saturate(1.05) contrast(1.05)}
  .scan{position:absolute;left:0;right:0;height:18%;background:linear-gradient(180deg,transparent,rgba(0,240,255,.18),transparent);animation:sc 4.5s linear infinite;pointer-events:none;mix-blend-mode:screen}
  @keyframes sc{from{top:-20%}to{top:110%}}
  .idc{text-align:center}.t{font-size:10px;letter-spacing:.35em;color:var(--cy)}
  h1{font-family:var(--f-disp);font-size:32px;letter-spacing:.12em;margin:4px 0 8px;color:#fff}
  .tags{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
  .tags span{font-size:11px;letter-spacing:.14em;border:1px solid rgba(0,240,255,.35);color:var(--cy);padding:3px 8px}
  .meta{display:flex;flex-direction:column;gap:8px;font-size:12px}.meta s{display:block;text-decoration:none;font-size:10px;letter-spacing:.2em;color:var(--mut)}.meta div{color:#d6e2ee}
</style>
