<script lang="ts">
  // Qorves Timeline: en yeni olay en üstte; aşağı kaydırdıkça geçmişe gidilir.
  // Sanallaştırılmış satırlar + tek rAF döngüsü (yalnız hareket varken ve sekme görünürken).
  import { onMount, tick } from 'svelte';
  import { kb, loadKb, allEntries, getEntry, type Entry } from '../lib/kb.svelte';
  import { session } from '../lib/session.svelte';
  import { settings } from '../lib/settings.svelte';
  import { tlnav } from '../lib/tlnav.svelte';
  import { openTag } from '../lib/tags.svelte';
  import { sfx, ambient } from '../lib/sfx';
  import { FB } from '../lib/tlimg';
  import RichText from '../ui/RichText.svelte';
  import { watchTl, type TlEvent } from '../lib/live';

  const RACE: Record<string, { c: string; n: string }> = { elf: { c: '#7cffb2', n: 'ELF' }, cuce: { c: '#ffb347', n: 'CÜCE' }, insan: { c: '#00f0ff', n: 'İNSAN' } };
  const BANDS = [
    { min: 100, label: 'SS 100 – 214' }, { min: 0, label: 'SS 0 – 100' }, { min: -500, label: 'SÖ 500 – 1' },
    { min: -2000, label: 'SÖ 2.000 – 500' }, { min: -5000, label: 'SÖ 5.000 – 2.000' }, { min: -15000, label: 'SÖ 15.000 – 5.000' },
    { min: -900000, label: 'SÖ 15.000 öncesi' }, { min: -Infinity, label: 'Tarihsiz' },
  ];
  const H_EV = 230, H_BAND = 150, TOP = 140, ORB = 0.42;
  type Ev = Entry & { vers?: Entry[]; draft?: boolean };
  type Row = { kind: 'band'; label: string; i: number } | { kind: 'ev'; e: Ev; side: number; i: number };
  const multi = (e: Ev) => (e.vers?.length ?? 1) > 1;
  const sameSum = (e: Ev) => new Set(e.vers!.map((v) => v.summary ?? '')).size === 1;
  const hasMore = (e: Ev) => multi(e) || e.vers!.some((v) => v.sections.some((s) => s.x && s.x !== v.summary));
  // DM'nin yayımladığı yeni olaylar (taslaklar yalnız DM'ye görünür)
  let tl = $state<TlEvent[]>([]);
  const tlEntry = (t: TlEvent): Entry & { draft?: boolean } => ({ id: 'tl:' + t.id, type: 'event', name: t.name, date: t.date, ys: t.ys, race: t.race, summary: t.summary, key: 'k.tl', draft: !t.published,
    sections: t.text ? [{ t: 'Ayrıntı', x: t.text, o: 0 }] : [] });
  const rows = $derived.by(() => {
    if (!kb.ready) return [] as Row[];
    const raw = [...allEntries().filter((e) => e.type === 'event'), ...tl.map(tlEntry)].sort((a, b) => (b.ys ?? -1e6) - (a.ys ?? -1e6) || a.id.localeCompare(b.id));
    // canon'da tek satır olan olayın ırk sürümleri tek kartta birleşir (yalnız görebildiğin sürümler)
    const ev: Ev[] = [], byG = new Map<string, Ev>();
    for (const e of raw) {
      const g = (e as Entry & { grp?: string }).grp;
      const m = g ? byG.get(g) : undefined;
      if (m) { m.vers!.push(e); if (!m.img && e.img) m.img = e.img; if (e.name.length < m.name.length) m.name = e.name; continue; }
      const c: Ev = { ...e, vers: [e] }; ev.push(c); if (g) byG.set(g, c);
    }
    const out: Row[] = []; let band = -1, n = 0;
    for (const e of ev) {
      const bi = BANDS.findIndex((b) => (e.ys ?? -1e6) >= b.min);
      if (bi !== band) { band = bi; out.push({ kind: 'band', label: BANDS[bi].label, i: out.length }); }
      out.push({ kind: 'ev', e, side: n++ % 2, i: out.length });
    }
    return out;
  });
  let heights = $state<Record<number, number>>({});
  let open = $state<Record<string, boolean>>({});
  const offs = $derived.by(() => {
    const o: number[] = []; let y = TOP;
    for (const r of rows) { o.push(y); y += heights[r.i] ?? (r.kind === 'band' ? H_BAND : H_EV); }
    o.push(y + 300); return o;
  });
  let sc: HTMLDivElement | undefined = $state(); let cv: HTMLCanvasElement | undefined = $state();
  let st = $state(0), vh = $state(900), orbC = $state(0), hl = $state('');
  const vis = $derived.by(() => {
    const a = st - 900, b = st + vh + 900, out: Row[] = [];
    // ikili arama ile başlangıç
    let lo = 0, hi = rows.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (offs[m + 1] < a) lo = m + 1; else hi = m; }
    for (let i = lo; i < rows.length && offs[i] < b; i++) out.push(rows[i]);
    return out;
  });
  const cur = $derived.by(() => { // küre hangi satırda
    let lo = 0, hi = rows.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (offs[m] <= orbC) lo = m; else hi = m - 1; }
    return rows[lo];
  });
  const curDate = $derived(cur?.kind === 'ev' ? cur.e.date : cur?.kind === 'band' ? cur.label : '');
  const bandRows = $derived(rows.filter((r) => r.kind === 'band'));
  const total = $derived(offs[offs.length - 1] ?? 1);
  const img = (e: Entry) => import.meta.env.BASE_URL + 'img/tl/' + (e.img ?? FB[e.key === 'k.dm' ? 'secret' : (e.ys ?? -1e6) <= -900000 ? 'gate' : (e.ys ?? 0) >= -210 && (e.ys ?? 0) <= 0 ? 'war'
    : (e.race === 'elf' ? 'elf-' : e.race === 'cuce' ? 'dwarf-' : 'human-') + ((e.ys ?? 0) < (e.race === 'insan' ? -1400 : -2100) ? 'a' : 'm')]);
  const eraName = (e: Entry) => (e.parent ? getEntry(e.parent)?.name : '') ?? '';

  // tek rAF döngüsü
  let raf = 0, last = 0, alive = true;
  type P = { x: number; y: number; vx: number; vy: number; l: number };
  const parts: P[] = [];
  function kick() { if (alive && !raf && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(t: number) {
    raf = 0; const dt = Math.min(50, t - last) / 16.7; last = t;
    if (!sc || !cv) return;
    const target = st + vh * ORB, d = target - orbC;
    orbC += d * Math.min(1, 0.14 * dt);
    const rm = settings.reduceMotion;
    const ctx = cv.getContext('2d')!, W = cv.width, Hh = cv.height, cx = W / 2, oy = orbC - st;
    ctx.clearRect(0, 0, W, Hh);
    // yanmış omurga: üstten küreye
    const g = ctx.createLinearGradient(0, 0, 0, oy); g.addColorStop(0, 'rgba(0,240,255,0)'); g.addColorStop(1, 'rgba(0,240,255,.9)');
    ctx.fillStyle = g; ctx.fillRect(cx - 1.5, 0, 3, oy);
    if (!rm && Math.abs(d) > 0.3) for (let k = 0; k < Math.min(6, 1 + Math.abs(d) / 12); k++)
      parts.push({ x: cx + (Math.random() - 0.5) * 10, y: oy, vx: (Math.random() - 0.5) * 1.6, vy: -Math.sign(d) * (0.6 + Math.random() * 1.8), l: 1 });
    if (!rm && Math.random() < 0.25) parts.push({ x: cx, y: oy, vx: (Math.random() - 0.5) * 0.8, vy: (Math.random() - 0.5) * 0.8, l: 0.8 });
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= 0.022 * dt;
      if (p.l <= 0) { parts.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(${Math.random() < 0.1 ? '252,238,10' : '0,240,255'},${p.l * 0.8})`; ctx.fillRect(p.x, p.y, 2, 2);
    }
    const pulse = 1 + Math.sin(t / 260) * 0.08;
    const rg = ctx.createRadialGradient(cx, oy, 0, cx, oy, 46 * pulse);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.18, 'rgba(120,250,255,.95)'); rg.addColorStop(0.45, 'rgba(0,240,255,.35)'); rg.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, oy, 46 * pulse, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // hareket ya da parçacık varken devam; durunca döngü uyur (nabız için yavaş tik)
    if (Math.abs(d) > 0.3 || parts.length) raf = requestAnimationFrame(frame);
    else if (!rm) setTimeout(kick, 120);
  }
  function onScroll() { st = sc!.scrollTop; kick(); }
  function resize() { vh = sc?.clientHeight ?? innerHeight; if (cv) { cv.width = innerWidth; cv.height = vh; } kick(); }

  // açılmış kartın gerçek yüksekliğini ölç
  function measure(node: HTMLElement, i: number) {
    const ro = new ResizeObserver(() => { const h = Math.max(node.offsetHeight + 40, H_EV); if (Math.abs((heights[i] ?? H_EV) - h) > 2) heights[i] = h; });
    ro.observe(node); return { destroy: () => ro.disconnect() };
  }
  async function goTo(id: string) {
    const r = rows.find((x) => x.kind === 'ev' && (x.e.id === id || !!x.e.vers?.some((v) => v.id === id))); if (!r || r.kind !== 'ev' || !sc) return;
    id = r.e.id;
    await tick();
    sc.scrollTo({ top: Math.max(0, offs[r.i] - vh * ORB + 60), behavior: settings.reduceMotion ? 'auto' : 'smooth' });
    hl = id; sfx.granted(); setTimeout(() => { if (hl === id) hl = ''; }, 6000);
  }
  $effect(() => { if (kb.ready && tlnav.target && rows.length && sc) { const id = tlnav.target; tlnav.target = null; setTimeout(() => goTo(id), 450); } });
  function jump(i: number) { sfx.click(); sc?.scrollTo({ top: Math.max(0, offs[i] - 40), behavior: settings.reduceMotion ? 'auto' : 'smooth' }); }
  onMount(() => {
    loadKb(session.user!);
    const stopTl = watchTl(session.user!.role === 'dm', (t) => (tl = t));
    resize(); orbC = vh * ORB; kick();
    const stopAmb = ambient('timeline');
    addEventListener('resize', resize);
    const vis = () => { cancelAnimationFrame(raf); raf = 0; if (!document.hidden) kick(); };
    document.addEventListener('visibilitychange', vis);
    return () => { stopTl(); stopAmb(); alive = false; cancelAnimationFrame(raf); raf = 0; removeEventListener('resize', resize); document.removeEventListener('visibilitychange', vis); };
  });
</script>

<div class="tl">
  <div class="bg"></div>
  <div class="sc" bind:this={sc} onscroll={onScroll}>
    <div class="inner" style:height="{total}px">
      <div class="spine"></div>
      <div class="head" style:top="40px"><span class="glitch" data-text="QORVES TIMELINE">QORVES TIMELINE</span><small class="mono">EN YENİ ÜSTTE · AŞAĞI KAYDIR, GEÇMİŞE İN</small></div>
      {#each vis as r (r.i)}
        {#if r.kind === 'band'}
          <div class="band" style:top="{offs[r.i]}px"><span class="mono glitch" data-text={r.label}>{r.label}</span></div>
        {:else}
          {@const e = r.e}
          {@const rc = RACE[e.race ?? 'insan'] ?? RACE.insan}
          {@const on = offs[r.i] + 40 < orbC || !!open[e.id]}
          <div class="row" class:L={r.side === 0} class:R={r.side === 1} class:on class:hl={hl === e.id} style:top="{offs[r.i]}px" style:--rc={rc.c}>
            <div class="node"></div>
            <div class="date mono">{e.date ?? ''}</div>
            <article class="card" use:measure={r.i}>
              <div class="im"><img src={img(e)} alt={e.name} loading="lazy" decoding="async" /></div>
              <div class="tx">
                <div class="meta mono">{#each e.vers ?? [e] as v (v.id)}<b style:color={(RACE[v.race ?? 'insan'] ?? RACE.insan).c}>{(RACE[v.race ?? 'insan'] ?? RACE.insan).n}</b>{/each}{#if eraName(e)}<span>{eraName(e)}</span>{/if}{#if e.key === 'k.tl'}<span class="new">{e.draft ? 'TASLAK · YALNIZ DM' : 'YENİ KAYIT'}</span>{/if}</div>
                <h3>{e.name}</h3>
                {#if !multi(e) || sameSum(e)}
                  <p class="sum">{#if e.summary}<RichText text={e.summary} self={e.id} />{:else}<i>Ayrıntılar bilinmiyor.</i>{/if}</p>
                {:else}
                  <div class="sums">{#each e.vers! as v (v.id)}{#if v.summary}<p class="sum s2"><b class="mono" style:color={(RACE[v.race ?? 'insan'] ?? RACE.insan).c}>{(RACE[v.race ?? 'insan'] ?? RACE.insan).n}</b> <RichText text={v.summary} self={v.id} /></p>{/if}{/each}</div>
                {/if}
                {#if hasMore(e)}
                  <button class="more mono" onclick={() => { open[e.id] = !open[e.id]; sfx.click(); }}>{open[e.id] ? '▲ KAPAT' : '▼ DAHA FAZLA OKU'}</button>
                {/if}
              </div>
              {#if open[e.id]}
                <div class="full">
                  {#each e.vers ?? [e] as v (v.id)}
                    {#if multi(e)}<h5 class="mono vh" style:color={(RACE[v.race ?? 'insan'] ?? RACE.insan).c}>{(RACE[v.race ?? 'insan'] ?? RACE.insan).n} KAYITLARI · {v.name}</h5>{/if}
                    {#each v.sections as s}{#if s.x && s.x !== v.summary}<h4 class="mono">{s.t}</h4><p><RichText text={s.x} self={v.id} /></p>{/if}{/each}
                    {#if v.key !== 'k.tl'}<button class="tag mono" onclick={() => openTag(v.id)}>KODEKS KAYDI ›</button>{/if}
                  {/each}
                </div>
              {/if}
            </article>
          </div>
        {/if}
      {/each}
    </div>
  </div>
  <canvas bind:this={cv} class="orb"></canvas>
  <div class="hud mono"><small>KONUM</small><b>{curDate}</b></div>
  <nav class="mini">
    {#each bandRows as b (b.i)}
      <button style:top="{(offs[b.i] / total) * 100}%" class:cur={cur && offs[b.i] <= orbC && (bandRows.find((x) => x.i > b.i) ? offs[bandRows.find((x) => x.i > b.i)!.i] > orbC : true)} onclick={() => jump(b.i)}>
        <i></i><span class="mono">{b.kind === 'band' ? b.label : ''}</span>
      </button>
    {/each}
    <div class="pos" style:top="{Math.min(100, (orbC / total) * 100)}%"></div>
  </nav>
  {#if !kb.ready}<div class="ld mono">ZAMAN ÇİZELGESİ YÜKLENİYOR…</div>{/if}
</div>

<style>
  .tl{position:absolute;inset:0;overflow:hidden;background:#04050a}
  .bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(0,240,255,.08),transparent 60%),
    repeating-linear-gradient(0deg,rgba(0,240,255,.035) 0 1px,transparent 1px 60px),repeating-linear-gradient(90deg,rgba(0,240,255,.025) 0 1px,transparent 1px 60px)}
  .sc{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:rgba(0,240,255,.35) transparent}
  .inner{position:relative}
  .spine{position:absolute;left:50%;top:0;bottom:0;width:2px;transform:translateX(-1px);background:linear-gradient(rgba(0,240,255,.0),rgba(0,240,255,.22) 200px,rgba(0,240,255,.22))}
  .head{position:absolute;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none}
  .head span{font-family:var(--f-disp);font-weight:900;font-size:40px;letter-spacing:.2em;color:var(--cy);text-shadow:0 0 22px rgba(0,240,255,.5);background:#04050a;padding:0 18px}
  .head small{font-size:10.5px;letter-spacing:.35em;color:var(--ye);background:#04050a;padding:0 10px}
  .band{position:absolute;left:0;right:0;height:150px;display:grid;place-items:center}
  .band span{font-size:15px;letter-spacing:.4em;color:var(--ye);padding:8px 22px;border:1px solid rgba(252,238,10,.5);background:rgba(4,5,10,.92);
    box-shadow:0 0 24px rgba(252,238,10,.15);clip-path:polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)}
  .row{position:absolute;left:0;right:0;height:0}
  .node{position:absolute;left:50%;top:34px;width:14px;height:14px;transform:translate(-50%,0) rotate(45deg);border:2px solid var(--rc);background:#04050a;transition:background .3s,box-shadow .3s}
  .on .node{background:var(--rc);box-shadow:0 0 14px var(--rc)}
  .date{position:absolute;top:30px;font-size:13px;letter-spacing:.15em;color:var(--rc);white-space:nowrap;opacity:.55;transition:opacity .3s}
  .on .date{opacity:1}
  .L .date{left:calc(50% + 26px)}.R .date{right:calc(50% + 26px)}
  .card{position:absolute;top:0;width:min(560px,40vw);display:grid;grid-template-columns:150px 1fr;background:rgba(7,10,18,.94);border:1px solid color-mix(in srgb,var(--rc) 40%,transparent);
    clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px));
    opacity:0;transform:scaleX(.04);filter:blur(4px);transition:opacity .35s,transform .45s cubic-bezier(.2,.9,.2,1),filter .4s;pointer-events:none}
  .L .card{right:calc(50% + 34px);transform-origin:right center}.R .card{left:calc(50% + 34px);transform-origin:left center}
  .on .card{opacity:1;transform:none;filter:none;pointer-events:auto;animation:gl .5s steps(2) 1}
  @keyframes gl{0%{clip-path:inset(0 0 60% 0)}30%{clip-path:inset(40% 0 0 0);filter:hue-rotate(60deg)}60%{clip-path:inset(0)}}
  .hl .card{border-color:var(--ye);box-shadow:0 0 0 2px var(--ye),0 0 40px rgba(252,238,10,.35);animation:hlp 1s 3}
  @keyframes hlp{50%{box-shadow:0 0 0 2px var(--ye),0 0 70px rgba(252,238,10,.6)}}
  .meta .new{color:#000;background:var(--ye);padding:0 6px;letter-spacing:.15em}
  .im{height:100%;min-height:180px;max-height:220px;overflow:hidden;background:#0a0f18}
  .im img{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(1.05) contrast(1.05)}
  .tx{padding:12px 16px 14px;display:flex;flex-direction:column;gap:6px;min-width:0}
  .meta{display:flex;gap:10px;font-size:10px;letter-spacing:.2em;color:var(--mut)}.meta b{color:var(--rc)}
  .meta span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  h3{font-family:var(--f-disp);font-size:18px;letter-spacing:.04em;color:#fff;line-height:1.2}
  .sum{font-size:14.5px;line-height:1.45;color:#c9d6e2;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
  .sum i{color:var(--mut)}
  .sums{display:flex;flex-direction:column;gap:4px}.s2{-webkit-line-clamp:3;font-size:13.5px}.s2 b{font-size:10px;letter-spacing:.2em}
  .vh{font-size:11px;letter-spacing:.25em;margin:14px 0 0;padding-top:8px;border-top:1px dashed var(--line)}.vh:first-child{border:0;margin-top:6px;padding-top:0}
  .more{align-self:flex-start;margin-top:auto;background:none;border:1px solid color-mix(in srgb,var(--rc) 55%,transparent);color:var(--rc);padding:4px 10px;font-size:10.5px;letter-spacing:.2em}
  .more:hover{background:color-mix(in srgb,var(--rc) 15%,transparent)}
  .full{grid-column:1/-1;padding:4px 18px 16px;border-top:1px solid var(--line);animation:fo .35s both;font-size:14.5px;line-height:1.55;color:#c9d6e2;user-select:text}
  @keyframes fo{from{opacity:0;transform:translateY(-6px)}}
  .full h4{font-size:10px;letter-spacing:.3em;color:var(--rc);margin:10px 0 2px}
  .tag{margin-top:12px;background:none;border:1px solid var(--line);color:var(--cy);padding:5px 12px;font-size:10.5px;letter-spacing:.2em}
  .orb{position:absolute;inset:0;pointer-events:none;z-index:2}
  .hud{position:absolute;left:24px;top:60px;z-index:3;display:flex;flex-direction:column;gap:2px;pointer-events:none}
  .hud small{font-size:10px;letter-spacing:.3em;color:var(--mut)}.hud b{font-size:22px;color:var(--cy);text-shadow:0 0 12px rgba(0,240,255,.6);letter-spacing:.08em}
  .mini{position:absolute;right:18px;top:70px;bottom:30px;width:150px;z-index:3;border-right:1px solid rgba(0,240,255,.25)}
  .mini button{position:absolute;right:-5px;display:flex;align-items:center;gap:8px;flex-direction:row-reverse;background:none;border:0;padding:0;color:var(--mut);transform:translateY(-50%)}
  .mini i{width:9px;height:9px;transform:rotate(45deg);border:1px solid currentColor;background:#04050a}
  .mini span{font-size:9.5px;letter-spacing:.12em;white-space:nowrap}
  .mini button:hover,.mini button.cur{color:var(--ye)}.mini button.cur i{background:var(--ye)}
  .pos{position:absolute;right:-3px;width:5px;height:18px;background:var(--cy);box-shadow:0 0 10px var(--cy);transform:translateY(-50%);transition:top .1s}
  .ld{position:absolute;inset:0;display:grid;place-items:center;color:var(--cy);letter-spacing:.3em;font-size:12px}
</style>
