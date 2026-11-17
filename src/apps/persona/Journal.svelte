<script lang="ts">
  /* GÜNLÜK: görev listesi + ayrıntı, ödüller, ilişkiler, itibar/aranma. */
  import { fade } from 'svelte/transition';
  import { FACTIONS } from '../../lib/data/character';
  import { QUEST_KINDS, type Quest, type Bounty, type NpcRel, type Sheet } from '../../lib/persona';
  import { P } from './psfx';
  let { quests, bounties, rels, sheet }: { quests: Quest[]; bounties: Bounty[]; rels: NpcRel[]; sheet: Sheet } = $props();
  const lab = (id: string) => FACTIONS.find((f) => f.id === id)?.label ?? id;
  const ST: Record<string, string> = { open: 'AKTİF', done: 'TAMAMLANDI', failed: 'BAŞARISIZ' };
  let sub = $state<'q' | 'b' | 'r'>('q'), sel = $state<string | null>(null), showDone = $state(false);
  const groups = $derived(QUEST_KINDS.map((k) => ({ k, items: quests.filter((q) => q.kind === k.id && (showDone || q.status === 'open')).sort((a, b) => b.at - a.at) })).filter((g) => g.items.length));
  const cur = $derived(quests.find((q) => q.id === sel) ?? groups[0]?.items[0] ?? null);
  const reps = $derived(Object.entries(sheet.reps ?? {}));
  const wanted = $derived(Object.entries(sheet.wanted ?? {}).filter(([, v]) => v > 0));
</script>

<div class="jv">
  <div class="sub">
    {#each [['q', 'GÖREVLER', quests.filter((q) => q.status === 'open').length], ['b', 'ÖDÜL AVLARI', bounties.length], ['r', 'İLİŞKİLER', rels.length]] as [k, l, n] (k)}
      <button class:on={sub === k} onclick={() => { sub = k as typeof sub; P.select(); }} onmouseenter={P.hover}>{l}<em class="mono">{n}</em></button>
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
        {:else}<p class="none mono">AKTİF GÖREV YOK</p>{/each}
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
        {:else}<p class="none mono">GÖREV SEÇ</p>{/if}
      </div>
    </div>
  {:else if sub === 'b'}
    <div class="cards">
      {#each bounties as b (b.id)}
        <div class="bc" in:fade><div class="bh mono">ARANIYOR</div><h3>{b.name}</h3><div class="amt">{b.amount}</div><small class="mono">VEREN · {b.by}</small>{#if b.note}<p>{b.note}</p>{/if}</div>
      {:else}<p class="none mono">ÖDÜL AVI YOK</p>{/each}
    </div>
  {:else}
    <div class="rl">
      <div class="col">
        <h5 class="mono">KİŞİLER</h5>
        {#each rels as r (r.id)}
          <div class="ri"><b>{r.name}</b><div class="meter"><i style:left="50%" style:width="{Math.abs(r.score) / 2}%" style:transform={r.score < 0 ? 'translateX(-100%)' : ''} class:neg={r.score < 0}></i><s></s></div><span class="mono" class:neg={r.score < 0}>{r.score > 0 ? '+' : ''}{r.score}</span>{#if r.note}<p>{r.note}</p>{/if}</div>
        {:else}<p class="none mono">KAYITLI İLİŞKİ YOK</p>{/each}
      </div>
      <div class="col">
        <h5 class="mono">HİZİP İTİBARI</h5>
        {#each reps as [f, v] (f)}<div class="ri"><b>{lab(f)}</b><div class="meter"><i style:left="50%" style:width="{Math.min(50, Math.abs(v) / 2)}%" style:transform={v < 0 ? 'translateX(-100%)' : ''} class:neg={v < 0}></i><s></s></div><span class="mono" class:neg={v < 0}>{v}</span></div>
        {:else}<p class="none mono">İTİBAR KAYDI YOK</p>{/each}
        {#if wanted.length}<h5 class="mono red">ARANMA SEVİYESİ</h5>
          {#each wanted as [f, v] (f)}<div class="wn"><b>{lab(f)}</b><span>{#each Array(5) as _, i}<i class:on={i < v}>★</i>{/each}</span></div>{/each}{/if}
      </div>
    </div>
  {/if}
</div>

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
</style>
