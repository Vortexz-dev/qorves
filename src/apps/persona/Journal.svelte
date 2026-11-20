<script lang="ts">
  /* GÜNLÜK: görevler, itibar (hizip + halk), ödüller (av kontratları + başındaki ödül), kişiler. */
  import { fade, fly } from 'svelte/transition';
  import { FACTIONS } from '../../lib/data/character';
  import { QUEST_KINDS, REP_FACTIONS, REP_GROUPS, repTier, type Quest, type Bounty, type NpcRel, type Sheet } from '../../lib/persona';
  import { P } from './psfx';
  let { quests, bounties, rels, sheet }: { quests: Quest[]; bounties: Bounty[]; rels: NpcRel[]; sheet: Sheet } = $props();
  const lab = (id: string) => FACTIONS.find((f) => f.id === id)?.label ?? id;
  const ST: Record<string, string> = { open: 'AKTİF', done: 'TAMAMLANDI', failed: 'BAŞARISIZ' };
  let sub = $state<'q' | 'rep' | 'b' | 'r'>('q'), sel = $state<string | null>(null), showDone = $state(false);
  const groups = $derived(QUEST_KINDS.map((k) => ({ k, items: quests.filter((q) => q.kind === k.id && (showDone || q.status === 'open')).sort((a, b) => b.at - a.at) })).filter((g) => g.items.length));
  const cur = $derived(quests.find((q) => q.id === sel) ?? groups[0]?.items[0] ?? null);
  // itibar: her hizip ve halk her zaman listelenir (kayıt yoksa 0 · NÖTR); yüksekten düşüğe
  const rv = (id: string) => Number(sheet.reps?.[id] ?? 0) || 0;
  const sortRows = <T extends { id: string }>(xs: readonly T[]) => [...xs].map((x, i) => ({ ...x, v: rv(x.id), i })).sort((a, b) => b.v - a.v || a.i - b.i);
  const facRows = $derived(sortRows(REP_FACTIONS));
  const grpRows = $derived(sortRows(REP_GROUPS));
  const wanted = $derived(Object.entries(sheet.wanted ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]));
  const best = $derived([...facRows, ...grpRows].sort((a, b) => b.v - a.v)[0]);
  const worst = $derived([...facRows, ...grpRows].sort((a, b) => a.v - b.v)[0]);
  const hunts = $derived(bounties.filter((b) => (b.kind ?? 'hunt') === 'hunt').sort((a, b) => Number((a.status ?? 'open') !== 'open') - Number((b.status ?? 'open') !== 'open') || b.at - a.at));
  const onme = $derived(bounties.filter((b) => b.kind === 'onme'));
  const heat = $derived(wanted.reduce((a, [, v]) => a + v, 0) + onme.length);
  const BS: Record<string, string> = { open: 'AÇIK', done: 'TESLİM EDİLDİ', failed: 'KAÇIRILDI' };
  const sg = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v);
</script>

<div class="jv">
  <div class="sub">
    {#each [['q', 'GÖREVLER', quests.filter((q) => q.status === 'open').length], ['rep', 'İTİBAR', ''], ['b', 'ÖDÜLLER', hunts.filter((b) => (b.status ?? 'open') === 'open').length + onme.length], ['r', 'KİŞİLER', rels.length]] as [k, l, n] (k)}
      <button class:on={sub === k} onclick={() => { sub = k as typeof sub; P.select(); }} onmouseenter={P.hover}>{l}{#if n !== ''}<em class="mono">{n}</em>{/if}{#if k === 'b' && heat}<b class="hot mono">!</b>{/if}</button>
    {/each}
    {#if sub === 'q'}<label class="dn mono"><input type="checkbox" bind:checked={showDone} />BİTENLERİ GÖSTER</label>{/if}
  </div>
  {#if sub === 'q'}
    <div class="qv">
      <div class="list">
        {#each groups as g (g.k.id)}
          <h5 class="mono">{g.k.label.toLocaleUpperCase('tr')}</h5>
          {#each g.items as q (q.id)}
            <button class="qi {q.status} k-{q.kind}" class:on={cur?.id === q.id} onclick={() => { sel = q.id; P.select(); }} onmouseenter={P.hover}>
              <i></i><span>{q.title}</span>{#if q.status !== 'open'}<small class="mono">{ST[q.status]}</small>{/if}
            </button>
          {/each}
        {:else}<div class="empty"><svg viewBox="0 0 48 48"><path d="M10 6h22l6 6v30H10z M32 6v6h6 M16 20h16 M16 26h16 M16 32h10" /></svg><b class="mono">GÖREV KAYDI BOŞ</b><p>DM bir görev verdiğinde burada belirir: ana görevler, yan görevler, hizip ve grup görevleri.</p></div>{/each}
      </div>
      <div class="det">
        {#if cur}
          {#key cur.id}
            <article in:fade={{ duration: 180 }}>
              <div class="tag mono k-{cur.kind}">{QUEST_KINDS.find((k) => k.id === cur!.kind)?.label.toLocaleUpperCase('tr')}{#if cur.faction} · {lab(cur.faction).toLocaleUpperCase('tr')}{/if}</div>
              <h2>{cur.title}</h2>
              <div class="stt mono {cur.status}">{ST[cur.status]}</div>
              <p>{cur.body}</p>
            </article>
          {/key}
        {:else}<div class="idle mono"><span>// SEÇİLİ GÖREV YOK</span><small>Kayıt geldiğinde ayrıntısı burada açılır.</small></div>{/if}
      </div>
    </div>
  {:else if sub === 'rep'}
    <div class="rep" in:fade={{ duration: 160 }}>
      <div class="rh mono">
        <span>ÖLÇEK <b>−100</b> DÜŞMAN · <b>0</b> NÖTR · <b>+100</b> MÜTTEFİK</span>
        {#if best && best.v > 0}<span>EN İYİ <b style:color={repTier(best.v).c}>{best.label} {sg(best.v)}</b></span>{/if}
        {#if worst && worst.v < 0}<span>EN GERGİN <b style:color={repTier(worst.v).c}>{worst.label} {sg(worst.v)}</b></span>{/if}
      </div>
      <div class="rcols">
        <section>
          <h5 class="mono">HİZİPLER · KURUMLAR</h5>
          {#each facRows as r, i (r.id)}{@render row(r.label, r.v, i)}{/each}
        </section>
        <section>
          <h5 class="mono">HALKLAR</h5>
          {#each grpRows as r, i (r.id)}{@render row(r.label, r.v, i)}{/each}
          <h5 class="mono red">ARANMA SEVİYESİ</h5>
          {#each wanted as [f, v] (f)}<div class="wn"><b>{lab(f)}</b><span>{#each Array(5) as _, i}<i class:on={i < v}>★</i>{/each}</span></div>
          {:else}<div class="clean"><i class="mono">TEMİZ</i><span>Hiçbir hizip seni aramıyor.</span></div>{/each}
          <p class="fn">İtibar, hiziplerin ve halkların sana bakışıdır. Yaptıkların değiştirir; değerleri DM günceller.</p>
        </section>
      </div>
    </div>
  {:else if sub === 'b'}
    <div class="bv" in:fade={{ duration: 160 }}>
      <section class="onme">
        <h5 class="mono red">BAŞINDAKİ ÖDÜL</h5>
        {#if !wanted.length && !onme.length}
          <div class="stamp"><b class="mono">TEMİZ SİCİL</b><span>Başına konmuş bir ödül yok. Kimse seni aramıyor… şimdilik.</span></div>
        {/if}
        {#each onme as b (b.id)}
          <div class="mine" in:fly={{ y: 8 }}><div class="mono k">ARANIYORSUN</div><div class="amt">{b.amount}</div><small class="mono">KOYAN · {b.by}{#if b.terms === 'alive'} · CANLI{/if}</small>{#if b.note}<p>{b.note}</p>{/if}</div>
        {/each}
        {#each wanted as [f, v] (f)}<div class="wn"><b>{lab(f)}</b><span>{#each Array(5) as _, i}<i class:on={i < v}>★</i>{/each}</span></div>{/each}
      </section>
      <section class="hunts">
        <h5 class="mono">AV KONTRATLARI <small>DM'in verdiği hedefler: bul, yakala ya da etkisiz hâle getir, ödülü al.</small></h5>
        <div class="cards">
          {#each hunts as b (b.id)}
            <div class="bc st-{b.status ?? 'open'}" in:fade><div class="bh mono">{(b.status ?? 'open') === 'open' ? 'ARANIYOR' : BS[b.status ?? 'open']}</div><h3>{b.name}</h3><div class="amt">{b.amount}</div>
              <small class="mono">VEREN · {b.by}{#if b.terms === 'alive'} · CANLI TESLİM{:else if b.terms === 'any'} · ÖLÜ YA DA DİRİ{/if}</small>{#if b.note}<p>{b.note}</p>{/if}</div>
          {:else}<div class="empty wide"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="14" /><path d="M24 4v10M24 34v10M4 24h10M34 24h10" /><circle cx="24" cy="24" r="2" /></svg><b class="mono">AÇIK AV KONTRATI YOK</b><p>DM sana bir hedef atadığında burada <b>ARANIYOR</b> afişi olarak düşer: hedefin adı, ödül, veren taraf ve şartlar.</p></div>{/each}
        </div>
      </section>
    </div>
  {:else}
    <div class="rl">
      <div class="col">
        <h5 class="mono">KİŞİLER</h5>
        {#each rels as r (r.id)}
          <div class="ri"><b>{r.name}</b><div class="meter"><i style:left="50%" style:width="{Math.abs(r.score) / 2}%" style:transform={r.score < 0 ? 'translateX(-100%)' : ''} class:neg={r.score < 0}></i><s></s></div><span class="mono" class:neg={r.score < 0}>{r.score > 0 ? '+' : ''}{r.score}</span>{#if r.note}<p>{r.note}</p>{/if}</div>
        {:else}<div class="empty"><svg viewBox="0 0 48 48"><circle cx="18" cy="18" r="7" /><path d="M6 40c1-8 6-12 12-12s11 4 12 12" /><circle cx="34" cy="20" r="5" /><path d="M30 30c6 0 11 3 12 10" /></svg><b class="mono">KAYITLI KİŞİ YOK</b><p>Tanıştığın NPC'ler ve onlarla aran, DM ekledikçe burada görünür.</p></div>{/each}
      </div>
    </div>
  {/if}
</div>

{#snippet row(name: string, v: number, i: number)}
  {@const t = repTier(v)}
  <div class="rr" style:--tc={t.c} style:--d="{i * 35}ms">
    <b>{name}</b>
    <div class="bar"><span class="tk" style:left="25%"></span><span class="tk" style:left="75%"></span><s></s>{#if v !== 0}<i class:neg={v < 0} style:left={v < 0 ? 50 - Math.min(50, Math.abs(v) / 2) + '%' : '50%'} style:width="{Math.max(1.5, Math.min(50, Math.abs(v) / 2))}%"></i>{/if}<u style:left="{50 + Math.max(-50, Math.min(50, v / 2))}%"></u></div>
    <span class="mono tv">{sg(v)}</span><em class="mono">{t.l}</em>
  </div>
{/snippet}

<style>
  .jv{position:absolute;inset:0;display:flex;flex-direction:column;padding:16px 28px;gap:14px}
  .sub{display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--pl)}
  .sub button{background:none;border:0;border-bottom:2px solid transparent;color:rgba(255,140,140,.8);font:600 13px var(--f-ui);letter-spacing:.16em;padding:8px 14px;cursor:var(--cur-p)}
  .sub button:hover{color:#fff}.sub button.on{color:var(--pc);border-bottom-color:var(--pc)}
  .sub em{font-style:normal;font-size:10.5px;margin-left:6px;color:var(--mut)}
  .dn{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:10.5px;letter-spacing:.2em;color:var(--mut)}
  .qv{flex:1;min-height:0;display:grid;grid-template-columns:340px 1fr;gap:24px}
  .list{overflow:auto;display:flex;flex-direction:column;gap:3px}
  h5{margin:12px 0 6px;font-size:10.5px;letter-spacing:.3em;color:var(--pr)}h5.red{color:var(--pr);margin-top:22px}
  .qi{display:flex;align-items:center;gap:10px;text-align:left;background:rgba(255,93,93,.04);border:1px solid transparent;color:#eee;padding:9px 12px;font:500 14.5px var(--f-ui);cursor:var(--cur-p);transition:all .15s}
  .qi i{width:8px;height:8px;transform:rotate(45deg);border:1px solid var(--kc,var(--py));flex:none}
  .qi.on i{background:var(--kc,var(--py));box-shadow:0 0 8px var(--kc,var(--py))}
  .qi:hover{background:rgba(255,93,93,.1)}.qi.on{border-color:rgba(94,246,255,.4);background:linear-gradient(90deg,rgba(94,246,255,.12),transparent)}
  .qi span{flex:1}.qi small{font-size:9.5px;letter-spacing:.16em;color:var(--mut)}.qi.done{opacity:.6}.qi.failed span{text-decoration:line-through;opacity:.6}
  .k-main{--kc:#fcee0a}.k-side{--kc:#5ef6ff}.k-faction{--kc:#ff5d5d}.k-group{--kc:#c08bff}
  .det{overflow:auto;padding:18px 22px;border:1px solid rgba(255,93,93,.2);background:linear-gradient(170deg,rgba(255,93,93,.06),rgba(8,3,6,.7))}
  .tag{font-size:10.5px;letter-spacing:.28em;color:var(--kc)}
  h2{margin:8px 0 6px;font-family:var(--f-disp);font-size:26px;color:#fff;letter-spacing:.04em}
  .stt{display:inline-block;font-size:10px;letter-spacing:.24em;padding:2px 8px;border:1px solid var(--pc);color:var(--pc)}.stt.done{border-color:#39ff8a;color:#39ff8a}.stt.failed{border-color:var(--pr);color:var(--pr)}
  article p{font-size:15.5px;line-height:1.65;color:#e4d2d2;white-space:pre-wrap;margin-top:14px}
  .cards{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;align-content:start}
  .bc{padding:14px;border:1px solid rgba(255,93,93,.4);background:linear-gradient(180deg,rgba(255,40,60,.12),rgba(8,2,4,.85));clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)}
  .bh{font-size:10px;letter-spacing:.4em;color:#000;background:var(--pr);display:inline-block;padding:2px 8px}
  .bc h3{margin:10px 0 4px;color:#fff;font-size:19px}.amt{font-family:var(--f-disp);font-size:22px;color:var(--py)}.bc small{font-size:10px;letter-spacing:.2em;color:var(--mut)}.bc p{font-size:13.5px;color:#dcc}
  .rl{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:30px;overflow:auto}
  .ri{display:grid;grid-template-columns:1fr 160px 44px;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,93,93,.1)}
  .ri b{color:#fff;font-weight:600}.ri p{grid-column:1/-1;margin:0;font-size:12.5px;color:var(--mut)}
  .meter{position:relative;height:6px;background:rgba(255,255,255,.06)}.meter i{position:absolute;top:0;bottom:0;background:var(--pc)}.meter i.neg{background:var(--pr)}.meter s{position:absolute;left:50%;top:-3px;width:1px;height:12px;background:#fff}
  .ri span{text-align:right;color:var(--pc)}.ri span.neg{color:var(--pr)}
  .wn{display:flex;justify-content:space-between;padding:6px 0}.wn b{color:#fff}.wn i{font-style:normal;color:rgba(255,93,93,.2);margin-left:2px}.wn i.on{color:var(--pr);text-shadow:0 0 8px var(--pr)}
  .none{font-size:11px;letter-spacing:.24em;color:var(--mut)}
  .sub b.hot{margin-left:5px;color:#000;background:var(--pr);font-size:9px;padding:0 4px;animation:bk 1.2s steps(2) infinite}
  @keyframes bk{50%{opacity:.35}}
  .empty{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:22px 18px;border:1px dashed rgba(255,93,93,.22);background:rgba(255,93,93,.03);margin-top:8px}
  .empty svg{width:34px;height:34px;fill:none;stroke:rgba(94,246,255,.55);stroke-width:1.4}
  .empty b{font-size:11px;letter-spacing:.28em;color:var(--pc)}.empty p{font-size:13.5px;line-height:1.5;color:#c9b8b8;margin:0}.empty p b{font-size:inherit;letter-spacing:.1em;color:var(--pr)}
  .empty.wide{grid-column:1/-1}
  .idle{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;color:rgba(255,140,140,.4);letter-spacing:.3em;font-size:11px}.idle small{letter-spacing:.1em;font-family:var(--f-ui);font-size:12.5px;color:var(--mut)}
  .rep{flex:1;min-height:0;display:flex;flex-direction:column;gap:12px}
  .rh{display:flex;gap:26px;flex-wrap:wrap;font-size:10px;letter-spacing:.2em;color:var(--mut);padding:8px 12px;border:1px solid rgba(255,93,93,.15);background:rgba(255,93,93,.03)}
  .rh b{color:#fff;font-weight:500}
  .rcols{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:1.25fr 1fr;gap:34px;padding-right:6px}
  .rr{display:grid;grid-template-columns:minmax(120px,1fr) minmax(150px,1.3fr) 44px 86px;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid rgba(255,93,93,.08);animation:rin .4s var(--d) both}
  @keyframes rin{from{opacity:0;transform:translateX(-8px)}}
  .rr b{color:#f3eaea;font-weight:500;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .bar{position:relative;height:8px;background:rgba(255,255,255,.05);overflow:visible}
  .bar s{position:absolute;left:50%;top:-4px;width:1px;height:16px;background:rgba(255,255,255,.55)}
  .bar .tk{position:absolute;top:0;width:1px;height:8px;background:rgba(255,255,255,.12)}
  .bar i{position:absolute;top:1px;bottom:1px;background:var(--tc);box-shadow:0 0 10px var(--tc);transform-origin:left;animation:grow .7s cubic-bezier(.2,1,.3,1) var(--d) both}
  .bar i.neg{transform-origin:right}
  @keyframes grow{from{transform:scaleX(0)}}
  .bar u{position:absolute;top:-3px;width:2px;height:14px;margin-left:-1px;background:#fff;box-shadow:0 0 6px var(--tc)}
  .tv{text-align:right;font-size:13px;color:var(--tc)}
  .rr em{font-style:normal;font-size:9.5px;letter-spacing:.2em;color:var(--tc);border:1px solid color-mix(in srgb,var(--tc) 45%,transparent);padding:2px 0;text-align:center}
  .clean{display:flex;align-items:center;gap:10px;padding:8px 0}.clean i{font-style:normal;font-size:10px;letter-spacing:.3em;color:#39ff8a;border:1px solid rgba(57,255,138,.5);padding:2px 8px}.clean span{color:var(--mut);font-size:13px}
  .fn{margin-top:18px;font-size:12.5px;line-height:1.5;color:var(--mut)}
  .bv{flex:1;min-height:0;display:grid;grid-template-columns:300px 1fr;gap:26px}
  .bv section{min-height:0;overflow:auto;display:flex;flex-direction:column}
  .bv h5 small{display:block;margin-top:6px;letter-spacing:.04em;font-family:var(--f-ui);font-size:12.5px;color:var(--mut);text-transform:none}
  .stamp{position:relative;margin:6px 0 10px;padding:18px 16px;border:2px solid rgba(57,255,138,.55);color:#39ff8a;transform:rotate(-1.5deg);background:rgba(57,255,138,.04)}
  .stamp b{display:block;font-size:20px;letter-spacing:.32em;text-shadow:0 0 12px rgba(57,255,138,.5)}.stamp span{display:block;margin-top:6px;font-size:13px;color:#b8d8c4;line-height:1.45}
  .mine{padding:14px;border:1px solid var(--pr);background:linear-gradient(180deg,rgba(255,40,60,.2),rgba(8,2,4,.9));margin-bottom:10px;box-shadow:0 0 24px rgba(255,40,60,.15)}
  .mine .k{font-size:10px;letter-spacing:.4em;color:var(--pr);animation:bk 1.6s steps(2) infinite}.mine small{font-size:10px;letter-spacing:.2em;color:var(--mut)}.mine p{font-size:13.5px;color:#dcc;margin:6px 0 0}
  .bc.st-done{opacity:.6;border-color:rgba(57,255,138,.4)}.bc.st-done .bh{background:#39ff8a}.bc.st-failed{opacity:.5}.bc.st-failed .bh{background:#666}
</style>
