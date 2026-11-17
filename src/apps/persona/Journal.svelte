<script lang="ts">
  import { FACTIONS } from '../../lib/data/character';
  import { QUEST_KINDS, type Quest, type Bounty, type NpcRel, type Sheet } from '../../lib/persona';
  let { quests, bounties, rels, sheet }: { quests: Quest[]; bounties: Bounty[]; rels: NpcRel[]; sheet: Sheet } = $props();
  const lab = (id: string) => FACTIONS.find((f) => f.id === id)?.label ?? id;
  const ST: Record<string, string> = { open: 'Açık', done: 'Tamam', failed: 'Başarısız' };
  const groups = $derived(QUEST_KINDS.map((k) => ({ k, items: quests.filter((q) => q.kind === k.id) })));
  const reps = $derived(Object.entries(sheet.reps ?? {}));
  const wanted = $derived(Object.entries(sheet.wanted ?? {}));
</script>

<div class="jo">
  <section>
    <h3 class="mono">GÖREVLER</h3>
    {#each groups as g (g.k.id)}
      <div class="blk">
        <div class="mono s">{g.k.label}</div>
        {#each g.items as q (q.id)}
          <article class={q.status}><header><b>{q.title}</b><em class="mono">{ST[q.status]}</em></header>
            {#if q.faction}<small>{lab(q.faction)}</small>{/if}
            <p>{q.body}</p>
          </article>
        {:else}<p class="none">Bu kategoride görev yok.</p>{/each}
      </div>
    {/each}
  </section>
  <aside>
    <h3 class="mono">İTİBAR</h3>
    {#if reps.length}{#each reps as [k, v] (k)}
      <div class="rep"><span>{lab(k)}</span><b class:neg={v < 0} class:pos={v > 0}>{v > 0 ? '+' : ''}{v}</b>
        <div class="bar"><i style:width="{Math.min(100, Math.abs(v))}%" class:neg={v < 0}></i></div></div>
    {/each}{:else}<p class="none">Kayıtlı itibar yok.</p>{/if}

    <h3 class="mono">ARANMA</h3>
    {#if wanted.length}{#each wanted as [k, v] (k)}
      <div class="rep"><span>{lab(k)}</span><b class:neg={v > 0}>{v}/5</b>
        <div class="dots">{#each Array(5) as _, i}<i class:on={i < v}></i>{/each}</div></div>
    {/each}{:else}<p class="none">Aranma kaydı yok.</p>{/if}

    <h3 class="mono">ÖDÜLLER</h3>
    {#each bounties as b (b.id)}
      <article><header><b>{b.name}</b><em>{b.amount}</em></header><small>{b.by}</small>{#if b.note}<p>{b.note}</p>{/if}</article>
    {:else}<p class="none">Aktif ödül yok.</p>{/each}

    <h3 class="mono">NPC İLİŞKİLERİ</h3>
    {#each rels as r (r.id)}
      <article><header><b>{r.name}</b><em class:neg={r.score < 0} class:pos={r.score > 0}>{r.score > 0 ? '+' : ''}{r.score}</em></header>{#if r.note}<p>{r.note}</p>{/if}</article>
    {:else}<p class="none">Kayıtlı ilişki yok.</p>{/each}
  </aside>
</div>

<style>
  .jo{flex:1;min-height:0;display:grid;grid-template-columns:1.3fr .9fr;gap:18px;padding:16px 28px 24px;overflow:hidden;position:relative;z-index:1}
  section,aside{overflow:auto;min-height:0}
  h3{font-size:11px;letter-spacing:.3em;color:var(--ye);margin:14px 0 8px}
  .s{font-size:10px;letter-spacing:.22em;color:var(--cy);margin:10px 0 6px}
  article{border:1px solid var(--line);padding:10px 12px;margin-bottom:8px;background:rgba(0,0,0,.28)}
  article.done{opacity:.7}article.failed{border-color:rgba(255,42,85,.4)}
  header{display:flex;gap:8px;align-items:baseline}header b{color:#fff}header em{margin-left:auto;font-style:normal;font-size:11px;letter-spacing:.12em;color:var(--mut)}
  article p{margin:6px 0 0;color:#c9d6e2;line-height:1.45}small{color:var(--mut)}
  .none{color:var(--mut);font-size:13px}
  .rep{display:grid;grid-template-columns:1fr auto;gap:2px 10px;margin-bottom:8px;align-items:center}
  .rep b{font-family:var(--f-mono)}.rep b.pos,.pos{color:#39ff8a}.rep b.neg,.neg{color:var(--rd)}
  .bar{grid-column:1/-1;height:5px;background:rgba(255,255,255,.08)}.bar i{display:block;height:100%;background:#39ff8a}.bar i.neg{background:var(--rd)}
  .dots{grid-column:1/-1;display:flex;gap:3px}.dots i{flex:1;height:6px;background:rgba(255,255,255,.1)}.dots i.on{background:var(--rd)}
</style>
