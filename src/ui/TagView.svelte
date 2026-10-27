<script lang="ts">
  import { getEntry, childrenOf, backlinksOf, idByName } from '../lib/kb.svelte';
  import { tmeta } from '../lib/types';
  import { KEY_LABEL } from '../lib/knowledge';
  import { session } from '../lib/session.svelte';
  import RichText from './RichText.svelte';
  import Chip from './Chip.svelte';
  let { id, nav }: { id: string; nav?: (id: string) => void } = $props();
  const e = $derived(getEntry(id));
  const m = $derived(tmeta(e?.type ?? 'item'));
  const isDM = $derived(session.user?.role === 'dm');
  const kids = $derived(e ? childrenOf(e.id) : []);
  const back = $derived(e ? backlinksOf(e.id).filter((b) => b.id !== e.parent && !kids.includes(b)).slice(0, 60) : []);
  const ends = $derived((e?.ends ?? []).map((n) => idByName(n)).filter((x): x is string => !!x));
</script>
{#if e}
  <article class="tv" style:--c={m.color}>
    <header>
      <div class="gl">{@html m.glyph}</div>
      <div class="hn">
        <div class="mono ty">{m.label.toLocaleUpperCase('tr')}{#if e.date} · {e.date}{/if}{#if e.range} · {e.range}{/if}</div>
        <h2>{e.name}</h2>
        {#if e.aliases?.length}<div class="al">{e.aliases.join(' · ')}</div>{/if}
      </div>
      {#if isDM}<span class="key mono" class:pub={e.key === 'k.public'}>{KEY_LABEL[e.key] ?? e.key}</span>{/if}
    </header>
    {#if e.summary}<p class="sum"><RichText text={e.summary} self={e.id} {nav} /></p>{/if}
    {#each e.sections as s}
      {#if s.x && s.x !== e.summary}
        <section><h4 class="mono">{s.t}</h4><p><RichText text={s.x} self={e.id} {nav} /></p></section>
      {/if}
    {/each}
    {#if !e.sections.length && !e.summary}<p class="none">Bu konuda bildiğin bir şey yok.</p>{/if}
    <footer>
      {#if e.parent && getEntry(e.parent)}<div class="rel"><span class="mono">BAĞLI</span><Chip id={e.parent} {nav} /></div>{/if}
      {#if ends.length}<div class="rel"><span class="mono">UÇLAR</span>{#each ends as x}<Chip id={x} {nav} />{/each}</div>{/if}
      {#if kids.length}<div class="rel"><span class="mono">İÇERİR</span>{#each kids as k (k.id)}<Chip id={k.id} {nav} />{/each}</div>{/if}
      {#if back.length}<div class="rel"><span class="mono">ADI GEÇTİĞİ YERLER</span>{#each back as b (b.id)}<Chip id={b.id} {nav} />{/each}</div>{/if}
    </footer>
  </article>
{/if}
<style>
  .tv{display:flex;flex-direction:column;gap:14px;font-size:15.5px;line-height:1.55}
  header{display:flex;gap:16px;align-items:center}
  .gl{width:64px;height:64px;flex:none;display:grid;place-items:center;color:var(--c);border:1px solid color-mix(in srgb,var(--c) 50%,transparent);
    background:radial-gradient(circle,color-mix(in srgb,var(--c) 18%,transparent),transparent 70%);clip-path:polygon(0 0,80% 0,100% 20%,100% 100%,20% 100%,0 80%)}
  .gl :global(svg){width:36px;height:36px;filter:drop-shadow(0 0 6px var(--c))}
  .hn{flex:1;min-width:0}.ty{font-size:10.5px;letter-spacing:.25em;color:var(--c)}
  h2{font-family:var(--f-disp);font-size:26px;letter-spacing:.06em;color:#fff;text-shadow:0 0 14px color-mix(in srgb,var(--c) 50%,transparent);margin:2px 0}
  .al{color:var(--mut);font-size:13px}
  .key{font-size:10px;letter-spacing:.15em;padding:3px 7px;border:1px solid var(--rd);color:var(--rd);align-self:flex-start}
  .key.pub{border-color:var(--line);color:var(--mut)}
  .sum{font-size:17px;color:#e8f6ff;border-left:2px solid var(--c);padding-left:12px}
  h4{font-size:10.5px;letter-spacing:.3em;color:var(--c);opacity:.85;margin-bottom:3px}
  section p{color:#c9d6e2}
  .none{color:var(--mut);font-style:italic}
  footer{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--line);padding-top:12px;font-size:14px}
  .rel{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:baseline}.rel>span{font-size:10px;letter-spacing:.2em;color:var(--mut);margin-right:6px}
</style>
