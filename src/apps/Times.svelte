<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx, ambient } from '../lib/sfx';
  import { watchDoc } from '../lib/live';
  import { loadEvents, activeAt, setWorldLive, type ActiveEvent, type EvData } from '../lib/events';
  import type { WorldEvents } from '../lib/backend';
  import type { MapData } from '../starmap/scene';
  import { watchNews, fromEvent, filler, type News } from '../lib/times';

  const base = import.meta.env.BASE_URL;
  let evd = $state<EvData | null>(null), ev = $state<ActiveEvent[]>([]), extra = $state<News[]>([]);
  let map = $state<MapData | null>(null), now = $state(Date.now());
  let open = $state<News | null>(null), boot = $state(true);
  const S = $derived(map ? new Map(map.systems.map((s) => [s.id, s.name])) : new Map<string, string>());
  const sysName = (id: string) => S.get(id) ?? id;
  const live = $derived(evd ? ev.map((e) => fromEvent(e, evd, sysName)) : []);
  const ads = $derived(filler(now));
  const feed = $derived.by(() => {
    const a = [...live, ...extra, ...ads].sort((x, y) => y.at - x.at);
    return a;
  });
  const featured = $derived(feed[0]);
  const rest = $derived(feed.slice(1));
  function img(n: News) { return n.img ? (n.img.startsWith('data:') || n.img.startsWith('http') ? n.img : base + n.img) : ''; }
  const views = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' Mn' : n.toLocaleString('tr-TR');
  const when = (t: number) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  onMount(() => {
    const stopAmb = ambient('times');
    sfx.open();
    setTimeout(() => (boot = false), 1100);
    let t = 0, stopEv = () => {}, stopN = () => {};
    (async () => {
      const data = await fetch(base + 'data/starmap.json').then((r) => r.json());
      map = data;
      evd = await loadEvents(data.systems, data.lanes);
      const tick = () => { now = Date.now(); ev = evd ? activeAt(now, data.systems) : []; };
      tick(); t = setInterval(tick, 15000) as unknown as number;
      stopEv = watchDoc<WorldEvents>(['world', 'events'], (w) => { setWorldLive(w); tick(); });
      stopN = watchNews((xs) => (extra = xs));
    })();
    return () => { stopAmb(); clearInterval(t); stopEv(); stopN(); };
  });
</script>

<div class="qt">
  {#if boot}
    <div class="boot">
      <div class="mast">QORVES TIMES</div>
      <div class="line"></div>
      <div class="mono sub">İNSAN HABER AĞI · ÇEVRİMİÇİ BASKI</div>
    </div>
  {/if}
  <header>
    <div class="date mono">{new Date(now).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('tr')}</div>
    <h1 data-t="QORVES TIMES">QORVES TIMES</h1>
    <div class="tag mono">SAHA · HİZİP · ŞİRKET · REKLAM</div>
  </header>
  {#if featured}
    <button class="hero" onclick={() => (open = featured)}>
      {#if img(featured)}<img src={img(featured)} alt="" />{/if}
      <div>
        <em class="mono">{featured.kicker ?? (featured.kind === 'ad' ? 'REKLAM' : 'MANŞET')}</em>
        <h2>{featured.title}</h2>
        <p>{featured.body}</p>
        <small class="mono">{featured.by ?? ''} · {views(featured.views)} görüntülenme</small>
      </div>
    </button>
  {/if}
  <div class="grid">
    {#each rest as n (n.id)}
      <button class="card" class:ad={n.kind === 'ad'} onclick={() => (open = n)}>
        {#if img(n)}<img src={img(n)} alt="" />{/if}
        <em class="mono">{n.kicker ?? n.kind}</em>
        <b>{n.title}</b>
        <p>{n.body}</p>
        <small class="mono">{views(n.views)} görüntülenme{#if n.kind !== 'ad'} · {when(n.at)}{/if}</small>
      </button>
    {:else}<div class="none mono">Bu saatte manşet yok.</div>{/each}
  </div>
</div>

{#if open}
  <div class="read" role="dialog">
    <button class="x" onclick={() => (open = null)}>Kapat</button>
    {#if img(open)}<img src={img(open)} alt="" />{/if}
    <em class="mono">{open.kicker ?? ''}</em>
    <h2>{open.title}</h2>
    <small class="mono">{open.by ?? 'Qorves Times'} · {views(open.views)} görüntülenme · {when(open.at)}</small>
    <p>{open.body}</p>
  </div>
{/if}

<style>
  .qt{height:100%;overflow:auto;background:#0b0c10;color:#e8e2d4;padding:18px 22px 28px;font-family:var(--f-ui)}
  header{text-align:center;border-bottom:2px solid #e8e2d4;padding-bottom:10px;margin-bottom:16px}
  .date{font-size:10px;letter-spacing:.2em;color:#8a8478}
  h1{font-family:var(--f-disp);font-size:42px;letter-spacing:.28em;color:#f4ecd8;margin:2px 0;text-shadow:0 0 18px rgba(252,238,10,.15)}
  .tag{font-size:10px;letter-spacing:.3em;color:#c9a227}
  .hero{display:grid;grid-template-columns:1.1fr 1fr;gap:16px;width:100%;text-align:left;background:none;border:0;color:inherit;padding:0 0 16px;border-bottom:1px solid #2a2a28;margin-bottom:16px;font:inherit}
  .hero img{width:100%;aspect-ratio:16/10;object-fit:cover;filter:contrast(1.15) saturate(.7) grayscale(.15);border:1px solid #333}
  .hero em,.card em{font-style:normal;font-size:10px;letter-spacing:.22em;color:#c9a227}
  .hero h2{font-family:var(--f-disp);font-size:28px;color:#fff;margin:4px 0 8px;letter-spacing:.04em}
  .hero p,.card p{color:#cfc6b4;line-height:1.5;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .card{display:flex;flex-direction:column;gap:6px;text-align:left;background:none;border:1px solid #2a2a28;color:inherit;padding:12px;font:inherit}
  .card.ad{background:rgba(201,162,39,.06);border-style:dashed}
  .card img{width:100%;aspect-ratio:16/9;object-fit:cover;filter:contrast(1.2) saturate(.65) grayscale(.2)}
  .card b{color:#fff;font-size:16px}.card p{-webkit-line-clamp:3}
  small{color:#8a8478}.none{grid-column:1/-1;color:#8a8478;padding:20px}
  .boot{position:absolute;inset:0;z-index:5;background:#07080c;display:grid;place-content:center;justify-items:center;gap:10px;animation:bo 1.1s both}
  .mast{font-family:var(--f-disp);font-size:48px;letter-spacing:.3em;color:#f4ecd8;animation:in .5s both}
  .line{width:0;height:2px;background:#c9a227;animation:ln .7s .2s both}
  .sub{letter-spacing:.28em;color:#c9a227;animation:in .4s .4s both}
  @keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes ln{from{width:0}to{width:280px}}
  @keyframes bo{70%{opacity:1}100%{opacity:0;pointer-events:none}}
  .read{position:absolute;inset:0;z-index:4;background:rgba(7,8,12,.96);overflow:auto;padding:28px 36px}
  .read img{width:100%;max-height:280px;object-fit:cover;filter:contrast(1.15) saturate(.7);margin-bottom:12px}
  .read h2{font-family:var(--f-disp);font-size:32px;color:#fff;margin:6px 0}
  .read p{font-size:16px;line-height:1.6;color:#e8e2d4;max-width:70ch;white-space:pre-wrap}
  .x{position:sticky;top:0;float:right;background:none;border:1px solid #c9a227;color:#c9a227;padding:6px 12px}
  @media (max-width:800px){.grid,.hero{grid-template-columns:1fr}}
</style>
