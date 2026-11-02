<script lang="ts">
  // Docked & Loaded v2: veri odaklı gemi sistemi (T1 Outrider). 3D hologram + yuva listesi + tersane deposu + canlı statlar. Ortak düzenleme.
  import { onMount } from 'svelte';
  import { ShipHolo } from '../ship/holo';
  import { stats, apply, slots, part, fitInfo, nameOf, BRAND, CAT_ICON, chassisOf, startDoc, type ShipDoc, type Part, type Op, type Slot, type Addon, type TrailerDef, type Engine, type Core } from '../ship/sys';
  import { watchShip, ensureShip, runOp } from '../ship/live';
  import { session } from '../lib/session.svelte';
  import { sfx, ambient } from '../lib/sfx';
  import Stats from './ship/Stats.svelte';
  import Info from './ship/Info.svelte';
  import Plan from './ship/Plan.svelte';
  const me = session.user!, who = { uid: me.uid, name: me.character?.name || me.username };
  let host: HTMLDivElement, ov: HTMLDivElement, holo: ShipHolo | null = null;
  let doc = $state<ShipDoc>(startDoc()), loaded = $state(false), sel = $state<string | null>(null), hov = $state<string | null>(null), prevId = $state<string | null>(null);
  let boot = $state(0), lines = $state<string[]>([]), info = $state(false), msg = $state<{ t: string; ok: boolean } | null>(null), busy = $state(false), filt = $state('');
  const BOOT = ['LİMAN BAĞLANTISI KURULUYOR…', 'GEMİ SİCİLİ SORGULANIYOR', 'KAYITLI GEMİ · DEMİR KERVAN · T1 OUTRIDER', 'TERSANE DEPOSU EŞLENİYOR', 'HOLOGRAM HAZIR'];
  const st = $derived(stats(doc));
  const allSl = $derived(slots(doc));
  const selSlot = $derived(sel && !sel.startsWith('trailer:') && sel !== 'hitch' ? allSl.find((s) => s.key === sel) ?? null : null);
  const selTrailer = $derived(sel?.startsWith('trailer:') ? doc.trailers.find((t) => t.k === sel!.slice(8)) ?? null : null);
  const inv = $derived(Object.entries(doc.inv).filter(([, n]) => n > 0).map(([id, n]) => ({ p: part(id)!, n })).filter((x) => x.p));
  // seçili yuvaya göre listelenecekler
  const kindFor = (k: string | null) => (k === 'engine_mount' ? 'engine' : k === 'core_mount' ? 'core' : k === 'hitch' ? 'trailer' : k ? 'addon' : '');
  const list = $derived.by(() => {
    const k = kindFor(sel && !sel.startsWith('trailer:') ? sel : null);
    const rows = inv.map((x) => ({ ...x, f: fitInfo(doc, x.p.id, k === 'addon' ? sel! : undefined) }));
    if (k) return rows.filter((r) => r.p.k === k && r.f.ok && (k !== 'addon' || !doc.fit[sel!]));
    return rows.filter((r) => !filt || (r.p.k === 'addon' ? (r.p as Addon).cat : r.p.k) === filt);
  });
  const hidden = $derived(sel && kindFor(sel) && !(kindFor(sel) === 'addon' && doc.fit[sel]) ? inv.filter((x) => x.p.k === kindFor(sel)).length - list.length : 0);
  const preview = $derived.by(() => { if (!prevId) return null; const op = opFor(prevId, sel); if (!op) return null; const r = apply({ ...doc, inv: { ...doc.inv, [prevId]: Math.max(1, doc.inv[prevId] ?? 0) } }, op); return r.next ? stats(r.next) : null; });
  function opFor(id: string, slot: string | null): Op | null {
    const p = part(id); if (!p) return null;
    if (p.k === 'trailer') return { t: 'attach', id }; if (p.k === 'engine') return { t: 'engine', id }; if (p.k === 'core') return { t: 'core', id };
    const target = slot && kindFor(slot) === 'addon' && !doc.fit[slot] ? slot : fitInfo(doc, id).slots[0]; return target ? { t: 'fit', slot: target, id } : null;
  }
  onMount(() => {
    let alive = true;
    BOOT.forEach((l, i) => setTimeout(() => { if (alive) { lines = [...lines, l]; sfx.key(); } }, 215 + i * 395));
    setTimeout(() => { if (alive) boot = 1; }, 2280); setTimeout(() => { if (alive) boot = 2; }, 3000);
    holo = new ShipHolo(host, ov, { hover: (k) => (hov = k), select: (k) => pick(k) });
    ensureShip(me.uid).catch(() => {});
    const stop = watchShip((s) => { if (s) { doc = s; loaded = true; holo?.setShip(s); } });
    holo.setShip(doc); if (location.search.includes('qc=1')) Object.assign(window, { __holo: holo, __setDoc: (d: ShipDoc) => { doc = d; holo?.setShip(d); }, __doc: () => $state.snapshot(doc) });
    const amb = ambient('ship'); const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && (sel || info)) { e.stopImmediatePropagation(); if (info) info = false; else pick(null); } };
    addEventListener('keydown', esc, true);
    return () => { alive = false; stop(); holo?.dispose(); holo = null; removeEventListener('keydown', esc, true); amb(); };
  });
  function pick(k: string | null) {
    if (k === sel) return; sel = k; prevId = null; holo?.setSelected(k && !k.startsWith('trailer:') ? k : null);
    if (!k) holo?.overview(); else if (k.startsWith('trailer:')) holo?.focus(k.slice(8)); else holo?.focusSlot(k);
    if (k) sfx.click();
  }
  const say = (t: string, ok: boolean) => { msg = { t, ok }; setTimeout(() => msg?.t === t && (msg = null), ok ? 2600 : 5200); };
  async function run(op: Op, okText: string) {
    if (busy) return; busy = true; prevId = null;
    try { const r = await runOp(op, who); if (r.ok) { sfx.granted(); say(okText, true); } else { sfx.error(); say(r.msg ?? 'Olmadı.', false); } }
    catch (e) { sfx.error(); say('Bağlantı hatası: ' + ((e as { code?: string })?.code ?? e), false); }
    busy = false;
  }
  function equip(id: string) {
    const op = opFor(id, sel); const p = part(id)!;
    if (!op) { const f = fitInfo(doc, id); sfx.error(); say(f.msg ?? 'Uygun yuva yok.', false); return; }
    const where = op.t === 'fit' ? allSl.find((s) => s.key === op.slot)?.label : op.t === 'attach' ? 'dorse bağlantısı' : op.t === 'engine' ? 'motor bölmesi' : 'çekirdek odası';
    run(op, `${p.model} → ${where}`).then(() => { if (op.t === 'fit') pick(op.slot); else if (op.t === 'attach') pick(null); });
  }
  const groups = $derived([
    { t: 'TIR · ' + chassisOf(doc).name.toLocaleUpperCase('tr'), k: '', rows: allSl.filter((s) => s.owner === 'truck') },
    ...doc.trailers.map((t) => ({ t: 'DORSE · ' + (part(t.id)?.model ?? '').toLocaleUpperCase('tr'), k: t.k, rows: allSl.filter((s) => s.owner === t.k) })),
  ]);
  const fittedId = (s: Slot) => (s.key === 'engine_mount' ? doc.engine : s.key === 'core_mount' ? doc.core : doc.fit[s.key]);
  const facts = (p: Part): string[] => {
    if (p.k === 'engine') { const e = p as Engine; return [`${e.mass} t`, `Thrust ${e.thrust}`, `Power ${e.power_draw}`, `Verim ${e.efficiency}`]; }
    if (p.k === 'core') { const c = p as Core; return [`${c.mass} t`, `Output ${c.power_output}`, c.skarnit_per_day ? `${c.skarnit_per_day} t/gün` : 'füzyon yakıtı']; }
    if (p.k === 'trailer') { const t = p as TrailerDef; return [`${t.mass} t`, t.capacity ? `Ambar ${t.capacity} t` : '', t.hidden ? `Gizli ${t.hidden} t` : '', `Power ${t.power_draw}`, t.armor ? `Armor +${t.armor}` : '', `${t.slots.length} yuva`].filter(Boolean); }
    const a = p as Addon; return [`${a.size} ${a.mount}`, `${a.mass} t`, a.power ? `Power ${a.power}` : ''].filter(Boolean);
  };
  const desc = (p: Part) => (p.k === 'addon' ? (p as Addon).effect : p.k === 'trailer' ? `${(p as TrailerDef).type} · ${(p as TrailerDef).special} · Odalar: ${(p as TrailerDef).rooms.join(', ')}` : (p as Engine).note ?? '');
  const icon = (p: Part) => CAT_ICON[p.k === 'addon' ? (p as Addon).cat : p.k] ?? '◇';
  const CATS = [['', 'Tümü'], ['Silah', 'Silah'], ['İtici', 'İtici'], ['Zırh', 'Zırh'], ['Kalkan', 'Kalkan'], ['Sensör', 'Sensör'], ['EW', 'EW'], ['Yardımcı', 'Yardımcı'], ['engine', 'Motor'], ['core', 'Çekirdek'], ['trailer', 'Dorse']];
  let mode = $state<'3d' | '2d'>('3d'), xf = $state(0);
  function setMode(m: '3d' | '2d') { if (m === mode || xf) return; xf = 1; sfx.glitch(); setTimeout(() => { mode = m; if (holo) holo.paused = m === '2d'; xf = 2; }, 230); setTimeout(() => (xf = 0), 560); }
  let tip = $state<{ m: string; x: number; y: number } | null>(null), root = $state<HTMLElement>();
  function showTip(e: MouseEvent, m: string) { const a = (e.currentTarget as HTMLElement).getBoundingClientRect(), b = root!.getBoundingClientRect(); tip = { m, x: a.right - b.left + 4, y: a.top - b.top - 8 }; }
</script>

<div class="sp" class:ready={boot === 2} bind:this={root}>
  {#if tip}<div class="tip" style:left="{tip.x}px" style:top="{tip.y}px">{tip.m}</div>{/if}
  <div class="gl" class:off={mode === '2d'} bind:this={host}></div>
  <div class="ov" class:off={mode === '2d'} bind:this={ov}></div>
  {#if boot >= 1}<div class="pl2" class:off={mode !== '2d'}><Plan {doc} {sel} onpick={(k) => pick(k)} active={mode === '2d'} /></div>{/if}
  {#if xf}<div class="xf" class:b={xf === 2}><i></i></div>{/if}
  <div class="vig"></div><div class="scan"></div>

  {#if boot < 2}
    <div class="boot" class:out={boot === 1}>
      <div class="bt mono"><span class="g" data-t="DOCKED &amp; LOADED">DOCKED &amp; LOADED</span></div>
      <div class="bl mono">{#each lines as l, i (i)}<div>&gt; {l}</div>{/each}</div>
      <div class="bar"><i></i></div>
    </div>
  {/if}

  <header class="hd">
    <div class="ttl"><span class="g" data-t="DOCKED &amp; LOADED">DOCKED &amp; LOADED</span><em class="mono">SHIP CUSTOMIZATION · ORTAK DÜZENLEME</em></div>
    <div class="nm">{doc.name}</div>
    <div class="own mono">{chassisOf(doc).id} {chassisOf(doc).name.toLocaleUpperCase('tr')} · {nameOf(doc.engine)} · {nameOf(doc.core)}{#if !loaded} · <span class="sync">EŞLENİYOR…</span>{/if}</div>
  </header>
  <div class="sw mono" role="tablist"><button class:on={mode === '3d'} onclick={() => setMode('3d')} role="tab" aria-selected={mode === '3d'}><b>3D</b> HOLOGRAM</button><button class:on={mode === '2d'} onclick={() => setMode('2d')} role="tab" aria-selected={mode === '2d'}><b>2D</b> İÇ PLAN</button><i class="sl" class:r={mode === '2d'}></i></div>

  <aside class="pan left">
    {#each groups as g (g.t)}
      <div class="h mono"><span>{g.t}</span>{#if g.k}<button class="lnk" onclick={() => pick('trailer:' + g.k)}>DORSE ›</button>{/if}</div>
      {#each g.rows as s (s.key)}
        {@const id = fittedId(s)}
        <button class="slot" class:on={sel === s.key} class:hv={hov === s.key} class:full={!!id} onclick={() => pick(s.key)} onmouseenter={() => (hov = s.key)} onmouseleave={() => (hov = null)}>
          <i class="dot"></i><span class="l">{s.label}<small class="mono">{s.mount === 'Motor' || s.mount === 'Çekirdek' ? s.size : s.size + ' · ' + s.mount}</small></span><span class="v">{id ? nameOf(id) : 'BOŞ'}</span>
        </button>
      {/each}
      {#if !g.k}
        <button class="slot" class:on={sel === 'hitch'} class:full={doc.trailers.length > 0} onclick={() => (doc.trailers.length ? pick('trailer:' + doc.trailers[0].k) : pick('hitch'))}>
          <i class="dot"></i><span class="l">Dorse bağlantısı<small class="mono">{doc.trailers.length} / {chassisOf(doc).max_trailers} · {chassisOf(doc).trailer_sizes.join('/')}</small></span><span class="v">{doc.trailers.length ? nameOf(doc.trailers[0].id) : 'BOŞ'}</span>
        </button>
      {/if}
    {/each}
    <button class="ovw mono" onclick={() => pick(null)}>⌖ GENEL BAKIŞ</button>
  </aside>

  <div class="stats"><Stats s={st} p={preview} /></div>

  <!-- seçim kartı + tersane deposu -->
  <section class="dock" class:hide2d={mode === '2d' && !(selSlot || selTrailer || sel === 'hitch')}>
    {#if selSlot || selTrailer || sel === 'hitch'}
      <div class="card">
        {#if selTrailer}
          {@const t = part(selTrailer.id) as TrailerDef}
          <div class="ck mono">DORSE · {t.type.toLocaleUpperCase('tr')}</div><h3>{t.model}<small>{BRAND[t.brand] ?? ''}</small></h3>
          <div class="fx">{#each facts({ ...t, k: 'trailer' }) as f (f)}<span>{f}</span>{/each}</div>
          <p>{t.special} · Odalar: {t.rooms.join(', ')}</p>
          <button class="btn ghost small cy" disabled={busy} onclick={() => run({ t: 'detach', k: selTrailer.k }, `${t.model} ayrıldı, depoya döndü`).then(() => pick(null))}>Dorseyi ayır</button>
        {:else if sel === 'hitch'}
          <div class="ck mono">DORSE BAĞLANTISI · {chassisOf(doc).trailer_sizes.join('/')}</div><h3>Boş</h3><p>Depodaki uygun dorseler aşağıda. Outrider en fazla {chassisOf(doc).max_trailers} dorse çeker.</p>
        {:else if selSlot}
          {@const id = fittedId(selSlot)}
          <div class="ck mono">{selSlot.owner === 'truck' ? 'TIR' : 'DORSE'} · {selSlot.size} · {selSlot.mount.toLocaleUpperCase('tr')}</div>
          <h3>{selSlot.label}{#if id}<small>{nameOf(id)}</small>{/if}</h3>
          {#if id}{@const p = part(id)!}
            <div class="fx">{#each facts(p) as f (f)}<span>{f}</span>{/each}{#if p.legality !== 'Yasal'}<span class="lg">{p.legality}</span>{/if}</div>
            <p>{desc(p)}</p>
            {#if p.k === 'addon'}<button class="btn ghost small cy" disabled={busy} onclick={() => run({ t: 'unfit', slot: selSlot.key }, `${p.model} söküldü, depoya döndü`)}>Sök</button>
            {:else}<p class="hint">Değiştirmek için depodan başka bir {p.k === 'engine' ? 'motor' : 'çekirdek'} seç; eskisi depoya döner.</p>{/if}
          {:else}<p class="hint">Boş yuva. Depoda buraya uyan parçalar aşağıda.</p>{/if}
        {/if}
      </div>
    {/if}
    <div class="inv">
      <div class="ih">
        <span class="mono">TERSANE DEPOSU</span>
        {#if sel && kindFor(sel) && !(kindFor(sel) === 'addon' && doc.fit[sel])}<em class="mono">BU YUVAYA UYANLAR · {list.length}{#if hidden} · {hidden} UYMAYAN GİZLİ{/if}</em>
        {:else}<div class="flt">{#each CATS as [k, t] (k)}<button class:on={filt === k} onclick={() => (filt = k)}>{t}</button>{/each}</div>{/if}
      </div>
      <div class="cards">
        {#each list as r (r.p.id)}
          <button class="it" class:bad={!r.f.ok} disabled={busy} onclick={() => equip(r.p.id)} onmouseenter={() => r.f.ok && (prevId = r.p.id)} onmouseleave={() => (prevId = null)} title={r.f.ok ? 'Tıkla: tak' : ''}>
            <span class="ic">{icon(r.p)}</span>
            <span class="tx"><b>{r.p.model}{#if r.n > 1}<i class="mono">×{r.n}</i>{/if}</b><small>{r.p.k === 'addon' ? (r.p as Addon).cat : r.p.k === 'engine' ? 'Motor' : r.p.k === 'core' ? ((r.p as Core).tech === 'human' ? 'İnsan reaktörü' : 'Skarn Çekirdeği') : 'Dorse · ' + (r.p as TrailerDef).type} · {facts(r.p).join(' · ')}</small><em>{desc(r.p)}</em></span>
            {#if !r.f.ok}<span class="no" role="img" aria-label={r.f.msg} onmouseenter={(e) => showTip(e, r.f.msg ?? '')} onmouseleave={() => (tip = null)}>⊘</span>{/if}
          </button>
        {:else}<div class="em">{sel && kindFor(sel) ? 'Depoda bu yuvaya uyan parça yok.' : 'Depo boş. DM, DM Paneli → Gemi sekmesinden parça verebilir.'}</div>{/each}
      </div>
    </div>
  </section>

  {#if msg}<div class="msg" class:bad={!msg.ok}>{msg.t}</div>{/if}
  <button class="info mono" onclick={() => (info = !info)} title="Statlar ve kurallar">i</button>
  {#if info}<Info onclose={() => (info = false)} />{/if}
</div>

<style>
  .gl,.ov{transition:opacity .25s}.gl.off,.ov.off{opacity:0;pointer-events:none;visibility:hidden}
  .pl2{position:absolute;inset:0;transition:opacity .25s}.pl2.off{opacity:0;pointer-events:none;visibility:hidden}
  .sp .dock.hide2d,.sp.ready .dock.hide2d{opacity:0;pointer-events:none;transform:translateY(30px)}.dock{transition:opacity .25s,transform .35s}
  .sw{position:absolute;left:50%;top:46px;transform:translateX(-50%);display:flex;padding:3px;background:rgba(3,8,14,.82);border:1px solid rgba(0,240,255,.3);clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);z-index:6}
  .sw button{position:relative;z-index:1;width:150px;padding:8px 0;background:none;border:0;color:#7fb6c9;font:inherit;font-size:10.5px;letter-spacing:.22em;cursor:pointer;transition:color .25s,text-shadow .25s}
  .sw button b{color:inherit;font-weight:700;margin-right:4px}.sw button.on{color:#04080f}.sw button:not(.on):hover{color:#e9fbff;text-shadow:0 0 8px rgba(95,240,255,.6)}
  .sw .sl{position:absolute;top:3px;bottom:3px;left:3px;width:150px;background:linear-gradient(90deg,#5ff0ff,#9ff7ff);box-shadow:0 0 14px rgba(95,240,255,.45);transition:transform .38s cubic-bezier(.7,0,.2,1);clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
  .sw .sl.r{transform:translateX(150px)}
  .sw .sl::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);transform:translateX(-100%);animation:swsh 2.8s ease-in-out infinite 1s}
  @keyframes swsh{0%,70%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
  .xf{position:absolute;inset:0;z-index:5;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(95,240,255,.05) 0 2px,transparent 2px 5px);animation:xfa .23s ease-in forwards}
  .xf.b{animation:xfb .33s ease-out forwards}
  .xf i{position:absolute;left:0;right:0;height:2px;background:#5ff0ff;box-shadow:0 0 18px 4px rgba(95,240,255,.55);top:0;animation:xfl .56s linear forwards}
  .xf::before{content:'';position:absolute;inset:0;background:#03060c;clip-path:inset(0 0 100% 0);animation:xfc .23s ease-in forwards}
  .xf.b::before{clip-path:inset(0 0 0 0);animation:xfd .33s ease-out forwards}
  @keyframes xfa{from{opacity:.4}to{opacity:1}}@keyframes xfb{from{opacity:1}to{opacity:0}}
  @keyframes xfc{to{clip-path:inset(0 0 0 0)}}@keyframes xfd{to{clip-path:inset(100% 0 0 0)}}
  @keyframes xfl{from{top:0}to{top:100%}}
  .sp{position:absolute;inset:0;overflow:hidden;background:#03060c;color:var(--tx)}
  .gl{position:absolute;inset:0}.ov{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.65))}
  .scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,240,255,.025) 0 1px,transparent 1px 3px);mix-blend-mode:screen}
  .ov :global(.sh-lbl){position:absolute;left:0;top:0;font-family:var(--f-mono);font-size:11px;letter-spacing:.12em;color:#ffcf7a;white-space:nowrap;padding:2px 6px;background:rgba(10,8,2,.55);border:1px solid rgba(255,181,71,.3)}
  .ov :global(.sh-lbl.tr){color:#9ff6ff;border-color:rgba(0,240,255,.35);background:rgba(2,10,14,.55);font-size:12px}
  .ov :global(.sh-lbl.on){color:#fff;border-color:#fff;box-shadow:0 0 10px rgba(0,240,255,.5)}
  .ov :global(.sh-slot){position:absolute;left:0;top:0;display:none;padding:4px 9px;background:rgba(3,8,14,.9);border:1px solid rgba(255,181,71,.6);border-left:3px solid #ffb547;white-space:nowrap;animation:si .18s ease-out}
  .ov :global(.sh-slot.full){border-color:rgba(57,255,138,.55);border-left-color:#39ff8a}.ov :global(.sh-slot.on){border-color:var(--ye);border-left-color:var(--ye);box-shadow:0 0 14px rgba(252,238,10,.3)}
  .ov :global(.sh-slot b){display:block;font-size:13px;color:#fff;font-weight:600}.ov :global(.sh-slot span){font-family:var(--f-mono);font-size:10.5px;letter-spacing:.1em;color:#cfe}
  @keyframes si{from{opacity:0;transform:translate(-6px,-50%)}}
  .g{position:relative;display:inline-block}
  .g::before,.g::after{content:attr(data-t);position:absolute;inset:0;pointer-events:none}
  .g::before{color:#ff2a55;clip-path:inset(0 0 55% 0);animation:g1 3.2s steps(1) infinite}
  .g::after{color:#fcee0a;clip-path:inset(60% 0 0 0);animation:g2 4.1s steps(1) infinite}
  @keyframes g1{0%,90%,100%{opacity:0;transform:none}91%{opacity:.85;transform:translate(-3px,-1px)}94%{opacity:.6;transform:translate(3px,1px)}}
  @keyframes g2{0%,85%,100%{opacity:0;transform:none}86%{opacity:.8;transform:translate(3px,0)}89%{opacity:.5;transform:translate(-2px,1px)}}
  .boot{position:absolute;inset:0;z-index:20;background:#02040a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;transition:opacity .7s,filter .7s}
  .boot.out{opacity:0;filter:blur(6px) hue-rotate(60deg)}
  .bt{font-family:var(--f-disp);font-size:44px;font-weight:700;letter-spacing:.4em;color:var(--cy);text-shadow:0 0 22px rgba(0,240,255,.6);animation:bz .5s steps(4) 3}
  @keyframes bz{50%{transform:skewX(-8deg) translateX(6px);filter:hue-rotate(90deg)}}
  .bl{font-size:12.5px;letter-spacing:.16em;color:#8fe9ff;min-height:110px;width:min(520px,80vw)}.bl div{animation:fi .2s both}@keyframes fi{from{opacity:0;transform:translateX(-8px)}}
  .bar{width:min(520px,80vw);height:3px;background:rgba(0,240,255,.15)}.bar i{display:block;height:100%;background:var(--cy);box-shadow:0 0 10px var(--cy);animation:ld 2.1s cubic-bezier(.6,0,.3,1) forwards;width:0}@keyframes ld{to{width:100%}}
  .hd,.pan,.stats,.dock,.info{opacity:0;transition:opacity .6s .2s,transform .6s .2s}.ready .hd,.ready .pan,.ready .stats,.ready .dock,.ready .info{opacity:1;transform:none}
  .hd{position:absolute;left:24px;top:58px;transform:translateY(-10px);pointer-events:none}
  .ttl{font-family:var(--f-disp);font-size:13px;letter-spacing:.42em;color:var(--cy);display:flex;flex-direction:column;gap:4px}.ttl em{font-style:normal;font-size:9.5px;letter-spacing:.3em;color:var(--mut)}
  .nm{font-family:var(--f-disp);font-size:34px;font-weight:700;letter-spacing:.08em;color:#fff;margin-top:6px;text-shadow:0 0 18px rgba(0,240,255,.35)}
  .own{font-size:10.5px;letter-spacing:.18em;color:#9fe6f5;margin-top:3px}.sync{color:var(--ye)}
  .pan.left{position:absolute;left:18px;top:178px;bottom:18px;width:272px;overflow:auto;display:flex;flex-direction:column;gap:3px;transform:translateX(-14px);padding-right:4px}
  .pan .h{display:flex;align-items:center;font-size:9.5px;letter-spacing:.28em;color:var(--ye);margin:10px 0 3px}.lnk{margin-left:auto;background:none;border:none;color:var(--cy);font:inherit;font-size:9.5px;letter-spacing:.2em;cursor:pointer}
  .slot{position:relative;display:grid;grid-template-columns:12px 1fr auto;align-items:center;gap:9px;padding:7px 10px;background:rgba(4,10,18,.72);border:1px solid rgba(255,255,255,.07);color:#dde;font:inherit;text-align:left;cursor:pointer;transition:border-color .18s,background .18s,transform .18s;overflow:hidden}
  .slot::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(0,240,255,.14),transparent);transform:translateX(-100%);transition:transform .45s}
  .slot:hover::after{transform:translateX(100%)}
  .slot:hover,.slot.hv{border-color:rgba(255,255,255,.3);transform:translateX(3px)}.slot.on{border-color:var(--ye);background:rgba(252,238,10,.08)}
  .dot{width:9px;height:9px;border-radius:50%;border:2px solid #ffb547;box-shadow:0 0 8px rgba(255,181,71,.5)}.full .dot{background:#39ff8a;border-color:#39ff8a;box-shadow:0 0 8px rgba(57,255,138,.6)}.on .dot{border-color:var(--ye);background:var(--ye)}
  .l{display:flex;flex-direction:column;font-size:13.5px;font-weight:600}.l small{font-size:9.5px;letter-spacing:.15em;color:var(--mut);font-weight:400}
  .v{font-size:12px;color:#9dffc4;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}.slot:not(.full) .v{color:#ffb547;font-family:var(--f-mono);letter-spacing:.2em;font-size:10px}
  .ovw{margin-top:10px;background:none;border:1px solid rgba(0,240,255,.3);color:var(--cy);padding:7px;font-size:10.5px;letter-spacing:.25em;cursor:pointer}.ovw:hover{background:rgba(0,240,255,.1)}
  .stats{position:absolute;right:18px;top:58px;transform:translateX(14px)}
  .dock{position:absolute;left:310px;right:350px;bottom:16px;display:flex;gap:10px;align-items:flex-end;transform:translateY(14px);pointer-events:none}.dock>*{pointer-events:auto}
  .card{width:280px;flex:none;padding:11px 13px;background:rgba(4,10,18,.9);border:1px solid rgba(252,238,10,.35);border-top:2px solid var(--ye);animation:ci .25s cubic-bezier(.2,.9,.3,1);display:flex;flex-direction:column;gap:6px}
  @keyframes ci{from{opacity:0;clip-path:inset(100% 0 0 0)}to{clip-path:inset(0)}}
  .ck{font-size:9.5px;letter-spacing:.25em;color:var(--ye)}.card h3{margin:0;font-size:19px;color:#fff;display:flex;flex-direction:column}.card h3 small{font-size:13px;color:#9dffc4;font-weight:500}
  .card p{margin:0;font-size:13px;line-height:1.4;color:#c9d6e2}.hint{color:var(--mut)!important;font-size:12.5px!important}
  .fx{display:flex;flex-wrap:wrap;gap:4px}.fx span{font-size:11.5px;padding:1px 6px;border:1px solid rgba(0,240,255,.25);color:#cfe}.fx .lg{border-color:var(--rd);color:var(--rd)}
  .btn.cy{align-self:flex-start}
  .inv{flex:1;min-width:0;max-height:38vh;display:flex;flex-direction:column;background:rgba(3,8,14,.86);border:1px solid rgba(0,240,255,.25);backdrop-filter:blur(5px)}
  .ih{display:flex;align-items:center;gap:10px;padding:7px 10px;border-bottom:1px solid rgba(0,240,255,.12)}.ih>span{font-size:9.5px;letter-spacing:.3em;color:var(--cy)}.ih em{font-style:normal;font-size:9.5px;letter-spacing:.2em;color:var(--ye)}
  .flt{display:flex;gap:2px;flex-wrap:wrap}.flt button{background:none;border:1px solid transparent;color:var(--mut);font:inherit;font-size:12px;padding:1px 7px;cursor:pointer}.flt button:hover{color:#fff}.flt button.on{color:#04050a;background:var(--cy)}
  .cards{overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px;padding:8px}
  .it{position:relative;display:grid;grid-template-columns:30px 1fr auto;gap:8px;align-items:start;padding:7px 8px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.08);color:#dde;font:inherit;text-align:left;cursor:pointer;transition:border-color .18s,background .18s,box-shadow .18s}
  .it:hover:not(:disabled){border-color:var(--cy);background:rgba(0,240,255,.07);box-shadow:inset 3px 0 0 var(--cy)}.it.bad{opacity:.62}.it.bad:hover{border-color:rgba(255,42,85,.5);box-shadow:none;background:rgba(255,42,85,.05)}
  .ic{width:30px;height:30px;display:grid;place-items:center;font-size:17px;color:var(--cy);border:1px solid rgba(0,240,255,.3);background:rgba(0,240,255,.05)}
  .tx{display:flex;flex-direction:column;min-width:0}.tx b{font-size:14px;color:#fff}.tx b i{font-style:normal;color:var(--ye);margin-left:6px;font-size:11px}
  .tx small{font-size:11px;color:#9fd8e6}.tx em{font-style:normal;font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .no{position:relative;color:var(--rd);font-size:15px;line-height:1;cursor:help}.tip{position:absolute;transform:translate(-100%,-100%);width:240px;padding:7px 9px;background:#12050a;border:1px solid var(--rd);color:#ffd6de;font-size:12.5px;line-height:1.4;z-index:5;white-space:normal}
  .tip{display:block;animation:fi .15s;pointer-events:none;z-index:30}
  .em{grid-column:1/-1;font-size:13px;color:var(--mut);padding:12px}
  .msg{position:absolute;left:50%;top:58px;transform:translateX(-50%);padding:8px 16px;background:rgba(2,14,8,.94);border:1px solid #39ff8a;color:#c8ffdc;font-size:14px;z-index:15;animation:mi .3s cubic-bezier(.2,.9,.3,1);max-width:560px}
  .msg.bad{background:rgba(18,4,8,.95);border-color:var(--rd);color:#ffd6de}
  @keyframes mi{from{opacity:0;transform:translate(-50%,-10px);clip-path:inset(0 50% 0 50%)}to{clip-path:inset(0)}}
  .info{position:absolute;right:18px;bottom:18px;width:26px;height:26px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:rgba(255,255,255,.45);font-size:13px;cursor:pointer;transition:color .2s,border-color .2s}
  .info:hover{color:#fff;border-color:var(--cy)}
</style>
