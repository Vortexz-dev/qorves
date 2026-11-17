<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx, ambient } from '../lib/sfx';
  import { watchDoc, getEvImg } from '../lib/live';
  import { loadEvents, activeAt, setWorldLive, type ActiveEvent, type EvData } from '../lib/events';
  import type { WorldEvents } from '../lib/backend';
  import type { MapData } from '../starmap/scene';
  import { watchNews, fromEvent, filler, type News } from '../lib/times';

  const base = import.meta.env.BASE_URL;
  let evd = $state<EvData | null>(null), ev = $state<ActiveEvent[]>([]), extra = $state<News[]>([]);
  let map = $state<MapData | null>(null), now = $state(Date.now());
  let open = $state<News | null>(null), boot = $state(true);
  let evimgs = $state<Record<string, string>>({}), broken = $state<Record<string, boolean>>({});
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
  function img(n: News | null | undefined) {
    if (!n?.img || broken[n.id]) return '';
    if (n.img.startsWith('data:') || n.img.startsWith('http') || n.img.startsWith('blob:')) return n.img;
    if (n.img.startsWith('evimg-')) return evimgs[n.img] || '';
    return base + n.img;
  }
  const miss = (n: News) => (broken = { ...broken, [n.id]: true });
  $effect(() => {
    for (const n of feed) {
      const id = n.img; if (!id?.startsWith('evimg-') || evimgs[id] !== undefined) continue;
      evimgs = { ...evimgs, [id]: '' };
      getEvImg(id).then((u) => {
        evimgs = { ...evimgs, [id]: u };
        if (!u) miss(n);
      });
    }
  });
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
    <div class="mastrow mono">
      <span>CİLT SS-214</span>
      <span>{new Date(now).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('tr')}</span>
      <span>İNSAN HABER AĞI</span>
    </div>
    <h1 data-t="QORVES TIMES">QORVES TIMES</h1>
    <div class="tag mono">SAHA GÖRÜNTÜSÜ · HİZİP BÜLTENİ · ŞİRKET · REKLAM</div>
  </header>
  {#if featured}
    <button class="hero" class:pix={!!img(featured)} onclick={() => (open = featured)}>
      {#if img(featured)}<figure><img src={img(featured)} alt="" onerror={() => miss(featured)} /><figcaption class="mono">SAHA KAYDI · TELEFON GÖRÜNTÜSÜ</figcaption></figure>{/if}
      <div class="hx">
        <em class="mono">{featured.kicker ?? (featured.kind === 'ad' ? 'REKLAM' : 'MANŞET')}</em>
        <h2>{featured.title}</h2>
        <p>{featured.body}</p>
        <small class="mono">{featured.by ?? 'Saha muhabiri'} · {views(featured.views)} görüntülenme · {when(featured.at)}</small>
      </div>
    </button>
  {/if}
  <div class="grid">
    {#each rest as n (n.id)}
      <button class="card" class:ad={n.kind === 'ad'} onclick={() => (open = n)}>
        {#if img(n)}<figure><img src={img(n)} alt="" onerror={() => miss(n)} />{#if n.kind === 'event'}<figcaption class="mono">SAHA KAYDI</figcaption>{/if}</figure>{/if}
        <em class="mono">{n.kind === 'ad' ? 'REKLAM' : (n.kicker ?? n.kind)}</em>
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
    {#if img(open)}<figure><img src={img(open)} alt="" onerror={() => open && miss(open)} />{#if open.kind === 'event'}<figcaption class="mono">SAHA KAYDI · TELEFON GÖRÜNTÜSÜ</figcaption>{/if}</figure>{/if}
    <em class="mono">{open.kind === 'ad' ? 'REKLAM' : (open.kicker ?? '')}</em>
    <h2>{open.title}</h2>
    <small class="mono">{open.by ?? 'Qorves Times'} · {views(open.views)} görüntülenme · {when(open.at)}</small>
    <p>{open.body}</p>
  </div>
{/if}


<style>
  .qt{height:100%;overflow:auto;background:
    radial-gradient(ellipse at 50% 0%,rgba(0,240,255,.07),transparent 50%),
    repeating-linear-gradient(0deg,rgba(0,240,255,.03) 0 1px,transparent 1px 28px),
    #07090e;color:#e6eef4;padding:16px 22px 32px;font-family:var(--f-ui)}
  header{text-align:center;border-top:2px solid var(--cy, #00f0ff);border-bottom:2px solid var(--ye, #fcee0a);padding:8px 0 10px;margin-bottom:16px;background:linear-gradient(180deg,rgba(0,240,255,.05),transparent)}
  .mastrow{display:flex;justify-content:space-between;font-size:10px;letter-spacing:.22em;color:#8aa0ae;padding:0 4px 6px}
  h1{font-family:var(--f-disp);font-size:46px;letter-spacing:.28em;color:#f4fbff;margin:0;text-shadow:0 0 18px rgba(0,240,255,.35),0 0 2px #00f0ff}
  .tag{font-size:10px;letter-spacing:.32em;color:var(--ye,#fcee0a);margin-top:4px}
  .hero{display:grid;grid-template-columns:1fr;gap:18px;width:100%;text-align:left;background:rgba(0,240,255,.03);border:1px solid rgba(0,240,255,.28);color:inherit;padding:12px;margin-bottom:16px;font:inherit;clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
  .hero.pix{grid-template-columns:1.15fr 1fr}
  .hero:hover{border-color:rgba(252,238,10,.55);background:rgba(252,238,10,.04)}
  figure{margin:0;position:relative}
  figure img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block;border:1px solid rgba(0,240,255,.25);filter:contrast(1.12) saturate(.85)}
  figcaption{position:absolute;left:0;bottom:0;background:rgba(0,0,0,.72);color:var(--ye,#fcee0a);font-size:9px;letter-spacing:.2em;padding:3px 8px}
  .hero em,.card em{font-style:normal;font-size:10px;letter-spacing:.22em;color:var(--ye,#fcee0a)}
  .hero h2{font-family:var(--f-disp);font-size:26px;color:#fff;margin:6px 0 8px;letter-spacing:.04em;line-height:1.15}
  .hero p,.card p{color:#c5d3de;line-height:1.55;display:-webkit-box;-webkit-line-clamp:4;line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .card{display:flex;flex-direction:column;gap:6px;text-align:left;background:rgba(5,8,14,.72);border:1px solid rgba(0,240,255,.2);color:inherit;padding:10px;font:inherit}
  .card:hover{border-color:rgba(0,240,255,.55)}
  .card.ad{background:rgba(252,238,10,.05);border-style:dashed;border-color:rgba(252,238,10,.4)}
  .card img{width:100%;aspect-ratio:16/9;object-fit:cover;filter:contrast(1.12) saturate(.85)}
  .card b{color:#fff;font-size:16px;line-height:1.25}.card p{line-clamp:3;-webkit-line-clamp:3}
  small{color:#8aa0ae}.none{grid-column:1/-1;color:#8aa0ae;padding:20px}
  .boot{position:absolute;inset:0;z-index:5;background:#07080c;display:grid;place-content:center;justify-items:center;gap:10px;animation:bo 1.1s both}
  .mast{font-family:var(--f-disp);font-size:48px;letter-spacing:.3em;color:#f4fbff;animation:in .5s both;text-shadow:0 0 20px rgba(0,240,255,.4)}
  .line{width:0;height:2px;background:var(--ye,#fcee0a);animation:ln .7s .2s both}
  .sub{letter-spacing:.28em;color:var(--ye,#fcee0a);animation:in .4s .4s both}
  @keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes ln{from{width:0}to{width:280px}}
  @keyframes bo{70%{opacity:1}100%{opacity:0;pointer-events:none}}
  .read{position:absolute;inset:0;z-index:4;background:rgba(7,8,12,.97);overflow:auto;padding:28px 36px}
  .read figure{max-width:920px;margin-bottom:12px}
  .read img{width:100%;max-height:340px;object-fit:cover;filter:contrast(1.12) saturate(.85)}
  .read h2{font-family:var(--f-disp);font-size:32px;color:#fff;margin:6px 0}
  .read p{font-size:16.5px;line-height:1.65;color:#e6eef4;max-width:70ch;white-space:pre-wrap}
  .x{position:sticky;top:0;float:right;background:rgba(0,0,0,.5);border:1px solid var(--ye,#fcee0a);color:var(--ye,#fcee0a);padding:6px 12px}
  @media (max-width:800px){.grid,.hero{grid-template-columns:1fr}}
</style>
