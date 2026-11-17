<script lang="ts">
  /* KİMLİK: portre, kimlik kartı, yaşam göstergeleri, özellik radarı, durum etkileri. */
  import { onMount } from 'svelte';
  import type { Character, UserProfile } from '../../lib/backend';
  import type { Wallet } from '../../lib/live';
  import { RACES, CLASSES, BACKGROUNDS, FACTIONS } from '../../lib/data/character';
  import { STATS, maxHp, maxCarry, hardCarry, carryOf, armorOf, moneyLine, chromeSlots, hasChip, type Sheet, type InvItem, type ChromePiece } from '../../lib/persona';
  import { P } from './psfx';
  let { u, c, sheet, inv, chrome, wallet }: { u: UserProfile; c: Character; sheet: Sheet; inv: InvItem[]; chrome: ChromePiece[]; wallet: Wallet | null } = $props();
  const lab = (xs: readonly { id: string; label: string }[], id: string) => xs.find((x) => x.id === id)?.label ?? id;
  const hpMax = $derived(maxHp(c.race, c.stats?.CON ?? 10));
  const hp = $derived(sheet.hp < 0 ? hpMax : Math.min(sheet.hp, hpMax));
  const kg = $derived(carryOf(inv)), cap = $derived(maxCarry(c.stats?.STR ?? 10)), hard = $derived(hardCarry(c.stats?.STR ?? 10));
  const arm = $derived(armorOf(inv, sheet.armor));
  const sub = $derived(CLASSES.find((x) => x.id === c.cls)?.subs.find((s) => s.id === c.sub)?.label);
  const NAME: Record<string, string> = { STR: 'GÜÇ', DEX: 'ÇEVİKLİK', CON: 'DAYANIKLILIK', INT: 'ZEKÂ', WIS: 'BİLGELİK', CHA: 'KARİZMA' };
  const sv = (k: string) => c.stats?.[k] ?? 0;
  const maxS = $derived(Math.max(10, ...STATS.map(sv)));
  let grow = $state(0);
  onMount(() => { let raf = 0; const t0 = performance.now(); const f = (t: number) => { grow = Math.min(1, (t - t0) / 900); grow = 1 - Math.pow(1 - grow, 3); if (grow < 1) raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); });
  const pt = (i: number, r: number) => { const a = -Math.PI / 2 + (i * Math.PI * 2) / 6; return [100 + Math.cos(a) * r, 100 + Math.sin(a) * r]; };
  const poly = $derived(STATS.map((k, i) => pt(i, 12 + (sv(k) / maxS) * 70 * grow).join(',')).join(' '));
  const eq = $derived(inv.filter((i) => i.eq));
  const FX: Record<string, string> = { buff: 'GÜÇLENDİRME', debuff: 'ZAYIFLATMA', cond: 'DURUM' };
</script>

<div class="idv">
  <section class="vit">
    <div class="card hp" class:low={hp / hpMax < 0.3}>
      <header class="mono">YAŞAM</header>
      <div class="big"><b>{hp}</b><span>/{hpMax}</span></div>
      <div class="seg">{#each Array(20) as _, i}<i class:on={i < Math.ceil((hp / hpMax) * 20)}></i>{/each}</div>
    </div>
    <div class="card">
      <header class="mono">ZIRH</header>
      <div class="big"><b>{arm}</b></div>
      <small>kuşanılan zırh + düzeltme</small>
    </div>
    <div class="card" class:bad={kg > cap}>
      <header class="mono">YÜK</header>
      <div class="big"><b>{kg.toFixed(1)}</b><span>/{cap} kg</span></div>
      <div class="ld"><i style:width="{Math.min(100, (kg / hard) * 100)}%"></i><s style:left="{(cap / hard) * 100}%"></s></div>
      {#if kg > cap}<small class="w">{kg > hard ? 'SERT LİMİT' : 'AŞIRI YÜK'}</small>{/if}
    </div>
    <div class="card">
      <header class="mono">KREDİ</header>
      <div class="mon mono">{moneyLine(wallet)}</div>
    </div>
    <div class="card">
      <header class="mono">KROM</header>
      <div class="big"><b>{chrome.length}</b><span>/{hasChip(c.chrome) ? chromeSlots(String(c.chrome)) : 0} yuva</span></div>
    </div>
  </section>

  <section class="mid">
    <div class="por" role="presentation" onmouseenter={P.hover}>
      <img src={u.avatar} alt={c.name} />
      <i class="sc"></i><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
      <div class="tagid mono">ID · {u.uid.slice(0, 4).toUpperCase()}-{u.uid.slice(4, 8).toUpperCase()}</div>
    </div>
    <div class="nm">
      <h1>{c.name}</h1>
      <div class="tags">
        <span>{lab(RACES, c.race)}</span>
        <span class="cy">{lab(CLASSES, c.cls)}{sub ? ' · ' + sub : ''}</span>
        {#if c.cls2}<span class="cy">{lab(CLASSES, c.cls2)}</span>{/if}
        {#if c.faction && c.faction !== 'none'}<span class="y">{lab(FACTIONS, c.faction)}</span>{/if}
      </div>
      <dl>
        {#if c.age}<div><dt>YAŞ</dt><dd>{c.age}</dd></div>{/if}
        {#if c.origin}<div><dt>KÖKEN</dt><dd>{c.origin}</dd></div>{/if}
        {#if c.background}<div><dt>GEÇMİŞ</dt><dd>{lab(BACKGROUNDS, c.background)}</dd></div>{/if}
        {#if c.job}<div><dt>MESLEK</dt><dd>{c.job}</dd></div>{/if}
        {#if c.clan}<div><dt>KLAN</dt><dd>{c.clan}</dd></div>{/if}
      </dl>
      {#if c.bio}<p class="bio">{c.bio}</p>{/if}
    </div>
  </section>

  <section class="rt">
    <div class="card radar">
      <header class="mono">ÖZELLİK MATRİSİ</header>
      <svg viewBox="0 0 200 200">
        {#each [0.25, 0.5, 0.75, 1] as k}<polygon points={STATS.map((_, i) => pt(i, 12 + 70 * k).join(',')).join(' ')} class="ring" />{/each}
        {#each STATS as _, i}{@const p = pt(i, 82)}<line x1="100" y1="100" x2={p[0]} y2={p[1]} class="ax" />{/each}
        <polygon points={poly} class="val" />
        {#each STATS as k, i}{@const p = pt(i, 12 + (sv(k) / maxS) * 70 * grow)}<circle cx={p[0]} cy={p[1]} r="2.6" class="dot" />{/each}
        {#each STATS as k, i}{@const p = pt(i, 96)}<text x={p[0]} y={p[1] + 3} text-anchor="middle">{k}</text>{/each}
      </svg>
      <div class="sl">{#each STATS as k}<div><span class="mono">{NAME[k]}</span><b>{sv(k)}</b></div>{/each}</div>
    </div>
    <div class="card fx">
      <header class="mono">DURUM ETKİLERİ</header>
      {#each sheet.status ?? [] as s (s.id)}
        <div class="sx {s.kind}"><b>{s.name}</b><small class="mono">{FX[s.kind]}</small>{#if s.desc}<p>{s.desc}</p>{/if}</div>
      {:else}<p class="none mono">AKTİF ETKİ YOK</p>{/each}
    </div>
    {#if eq.length}
      <div class="card">
        <header class="mono">KUŞANILMIŞ</header>
        {#each eq as e (e.id)}<div class="eq">{e.name}<small>{e.type === 'armor' ? 'ZIRH' : 'SİLAH'}</small></div>{/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .idv{position:absolute;inset:0;display:grid;grid-template-columns:260px 1fr 320px;gap:26px;padding:22px 28px;overflow:hidden}
  section{min-height:0;display:flex;flex-direction:column;gap:12px}
  .vit,.rt{overflow:auto;padding-right:4px}
  .card{position:relative;padding:12px 14px;background:linear-gradient(160deg,rgba(255,93,93,.07),rgba(8,3,6,.7));border:1px solid rgba(255,93,93,.22);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%);transition:border-color .2s,transform .2s}
  .card:hover{border-color:rgba(255,93,93,.55)}
  .card::before{content:"";position:absolute;left:0;top:0;width:3px;height:22px;background:var(--pr)}
  header{font-size:10.5px;letter-spacing:.3em;color:var(--pr);margin-bottom:6px}
  .big{font-family:var(--f-disp);color:#fff}.big b{font-size:28px}.big span{font-size:13px;color:var(--mut);margin-left:3px}
  .card small{font-size:11px;color:var(--mut)}.card small.w{color:var(--pr);letter-spacing:.2em}
  .seg{display:flex;gap:2px;margin-top:8px}.seg i{flex:1;height:10px;background:rgba(255,93,93,.15);transform:skewX(-20deg)}.seg i.on{background:var(--pr);box-shadow:0 0 6px var(--pr)}
  .hp.low .seg i.on{animation:bl 0.7s steps(2) infinite}@keyframes bl{50%{opacity:.4}}
  .ld{position:relative;height:6px;background:rgba(255,93,93,.12);margin-top:8px}.ld i{position:absolute;inset:0 auto 0 0;background:var(--pc)}.bad .ld i{background:var(--pr)}.ld s{position:absolute;top:-3px;width:1px;height:12px;background:#fff}
  .mon{font-size:14px;color:var(--py);letter-spacing:.06em}
  .mid{align-items:center;justify-content:center;gap:18px}
  .por{position:relative;width:min(340px,80%);aspect-ratio:3/3.6;flex:none}
  .por img{width:100%;height:100%;object-fit:cover;clip-path:polygon(8% 0,100% 0,100% 92%,92% 100%,0 100%,0 8%);filter:contrast(1.08) saturate(1.05)}
  .por::after{content:"";position:absolute;inset:0;clip-path:polygon(8% 0,100% 0,100% 92%,92% 100%,0 100%,0 8%);background:linear-gradient(transparent 60%,rgba(40,0,8,.7)),repeating-linear-gradient(0deg,rgba(255,93,93,.07) 0 1px,transparent 1px 3px);pointer-events:none}
  .sc{position:absolute;left:0;right:0;height:22%;background:linear-gradient(transparent,rgba(94,246,255,.25),transparent);animation:sc 3.8s ease-in-out infinite;z-index:2;pointer-events:none}
  @keyframes sc{0%,100%{top:0}50%{top:78%}}
  .c{position:absolute;width:22px;height:22px;border:2px solid var(--pc);z-index:3}
  .tl{left:-8px;top:-8px;border-right:0;border-bottom:0}.tr{right:-8px;top:-8px;border-left:0;border-bottom:0}.bl{left:-8px;bottom:-8px;border-right:0;border-top:0}.br{right:-8px;bottom:-8px;border-left:0;border-top:0}
  .por:hover .c{animation:cp .5s ease-out}@keyframes cp{50%{transform:scale(1.25)}}
  .tagid{position:absolute;left:12px;bottom:10px;z-index:3;font-size:10.5px;letter-spacing:.22em;color:var(--pc)}
  .nm{text-align:center;max-width:560px}
  h1{margin:0;font-family:var(--f-disp);font-size:34px;letter-spacing:.06em;color:#fff;text-shadow:0 0 22px rgba(255,93,93,.45)}
  .tags{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:10px 0}
  .tags span{font-size:12px;letter-spacing:.14em;padding:3px 10px;border:1px solid rgba(255,93,93,.4);color:#ffb3b3}.tags .cy{border-color:rgba(94,246,255,.4);color:var(--pc)}.tags .y{border-color:rgba(252,238,10,.4);color:var(--py)}
  dl{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 18px;margin:6px 0}
  dl div{display:flex;gap:6px;font-size:13px}dt{color:var(--mut);letter-spacing:.16em;font-size:11px;padding-top:1px}dd{margin:0;color:#fff}
  .bio{font-size:14px;line-height:1.55;color:#d9c2c2;max-height:110px;overflow:auto;margin:8px 0 0}
  .radar svg{width:100%;max-width:240px;display:block;margin:0 auto}
  .ring{fill:none;stroke:rgba(255,93,93,.18)}.ax{stroke:rgba(255,93,93,.15)}
  .val{fill:rgba(94,246,255,.18);stroke:var(--pc);stroke-width:1.4;filter:drop-shadow(0 0 6px rgba(94,246,255,.6))}
  .dot{fill:#fff}
  text{fill:var(--pr);font:9px var(--f-mono);letter-spacing:.1em}
  .sl{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin-top:6px}
  .sl div{display:flex;justify-content:space-between;font-size:12px;border-bottom:1px dashed rgba(255,93,93,.15);padding:2px 0}.sl span{color:var(--mut);font-size:10.5px;letter-spacing:.14em}.sl b{color:#fff;font-family:var(--f-disp)}
  .sx{padding:7px 0;border-bottom:1px solid rgba(255,93,93,.12)}.sx b{color:#fff;font-size:14px}.sx small{float:right;font-size:9.5px;letter-spacing:.2em}
  .sx.buff small{color:#39ff8a}.sx.debuff small{color:var(--pr)}.sx.cond small{color:var(--py)}
  .sx p{margin:4px 0 0;font-size:12.5px;color:var(--mut)}
  .none{font-size:11px;letter-spacing:.22em;color:var(--mut);margin:4px 0}
  .eq{display:flex;justify-content:space-between;font-size:13.5px;padding:4px 0;color:#fff}.eq small{color:var(--pc);letter-spacing:.2em;font-size:10px}
</style>
