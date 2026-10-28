<script lang="ts">
  // Qorves Starmap — küme görünümü. Sahne starmap/scene.ts; olay motoru lib/events.ts.
  import { onMount, untrack } from 'svelte';
  import { openImage, lightbox } from '../lib/lightbox.svelte';
  import { ClusterScene, STAR_COLOR, LANE_COLOR, CAPITALS, type MapData, type Quality, type LaneData } from '../starmap/scene';
  import { SystemScene, type LaneGate } from '../starmap/system';
  import { kb, loadKb, getEntry, childrenOf, bodiesOf, type Body } from '../lib/kb.svelte';
  import { session } from '../lib/session.svelte';
  import { openTag } from '../lib/tags.svelte';
  import { loadEvents, activeAt, setWorldLive, type ActiveEvent, type EvData } from '../lib/events';
  import { watchMarkers, watchDoc, type Marker } from '../lib/live';
  import type { WorldEvents } from '../lib/backend';
  import { sfx, ambient } from '../lib/sfx';
  import RichText from '../ui/RichText.svelte';
  import { tmeta } from '../lib/types';

  const STYPE: Record<string, string> = { A: 'A tipi · mavi-beyaz', F: 'F tipi · sarı-beyaz', G: 'G tipi · sarı', K: 'K tipi · turuncu', M: 'M tipi · kızıl cüce', redgiant: 'Kızıl dev',
    whitedwarf: 'Beyaz cüce', pulsar: 'Pulsar', magnetar: 'Magnetar', blackhole: 'Kara delik (tekillik)', triple: 'Üçlü yıldız', binary: 'Çift yıldız', unknown: 'Bilinmiyor' };
  const KIND: Record<string, string> = { planet: 'Gezegen', moon: 'Uydu', belt: 'Kuşak', swarm: 'Uydu grubu', station: 'İstasyon', gate: 'Geçit', singularity: 'Tekillik', disk: 'Birikim diski',
    stream: 'Plazma akıntısı', debris: 'Enkaz sahası', wormhole: 'Kurt deliği', star: 'Yıldız', star2: 'Eş yıldız' };
  let host: HTMLDivElement | undefined = $state(), ov: HTMLDivElement | undefined = $state();
  let mode = $state<'cluster' | 'system'>('cluster'), cur = $state<string | null>(null), sys2: SystemScene | null = null;
  let bsel = $state<string | null>(null), bhov = $state<string | null>(null), snaps = $state<Record<string, string[]>>({});
  let pinned = $state(localStorage.getItem('qv.mapPin') === '1'), lopen = $state(false), aopen = $state(false);
  let orbits = $state(true), moving = $state(true), busy = false;
  let map = $state<MapData | null>(null), sc: ClusterScene | null = null;
  let hov = $state<string | null>(null), sel = $state<string | null>(null);
  let q = $state<Quality>((localStorage.getItem('qv.mapq') as Quality) || 'med');
  let labels = $state(true), lanesOn = $state(true), terr = $state(true), search = $state(''), hidden = $state<string[]>([]), legend = $state(true);
  let ev = $state<ActiveEvent[]>([]), evd = $state<EvData | null>(null), now = $state(Date.now()), warp = $state(0), err = $state('');
  const isDM = $derived(session.user?.role === 'dm');
  const base = import.meta.env.BASE_URL;
  const known = (id: string) => !!getEntry(id);
  // DM işaretleri (gemi konumu / görev noktası); kurallar yalnız izinli oyunculara okutur
  let marks = $state<Marker[]>([]);
  const marksOf = (id: string) => marks.filter((m) => m.sys === id);
  function applyMarks() { if (!sc) return; const g = new Map<string, { ship: string[]; mission: string[] }>();
    for (const m of marks) { const x = g.get(m.sys) ?? { ship: [], mission: [] }; x[m.kind].push(m.label); g.set(m.sys, x); } sc.setMarkers(g); }
  $effect(() => { marks; untrack(applyMarks); });
  const S = $derived(map ? new Map(map.systems.map((s) => [s.id, s])) : new Map());
  const focus = $derived(hov ?? sel);
  const fs = $derived(focus ? S.get(focus) : null);
  const ss = $derived(sel ? S.get(sel) : null);
  const se = $derived(sel ? getEntry(sel) : null);
  const evFor = (id: string) => ev.filter((e) => e.sys === id || (e.lane && map?.lanes.find((l) => l.id === e.lane && (l.a === id || l.b === id)))).sort((a, b) => Number(!!b.forced) - Number(!!a.forced) || b.tpl.sev - a.tpl.sev);
  const focusEv = $derived(focus ? evFor(focus) : []);
  const topEv = $derived([...ev].sort((a, b) => Number(!!b.forced) - Number(!!a.forced) || b.tpl.sev - a.tpl.sev).slice(0, 4)); // DM yayınları önce
  const list = $derived(map ? map.systems.filter((s) => !hidden.includes(s.owner) && (!search || (known(s.id) ? s.name : '').toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')))).sort((a, b) => a.name.localeCompare(b.name, 'tr')) : []);
  const lanesOf = (id: string) => (map?.lanes ?? []).filter((l) => (l.a === id || l.b === id) && known(l.id));
  const cs = $derived(cur ? S.get(cur) : null);
  const blist = $derived(cur && kb.ready ? bodiesOf(cur) : []);
  const bmap = $derived(new Map(blist.map((b) => [b.id, b])));
  const bs = $derived<Body | null>(bsel ? bmap.get(bsel) ?? null : null);
  const be = $derived(bs?.ent ? getEntry(bs.ent) : null);
  const starEnt = $derived(cur ? childrenOf(cur).find((e) => e.type === 'star') : null);
  const tree = $derived.by(() => { const cg = new Set(gates.map((g) => g.canon).filter(Boolean)); const top = blist.filter((b) => (!b.parent || !bmap.has(b.parent)) && !cg.has(b.id)); return top.map((b) => ({ b, kids: blist.filter((k) => k.parent === b.id) })); });
  const generic = (t?: string) => !t || /sistemindeki bir|üzerinde\/yakınında|^\W*$/.test(t);
  const rows = (b: Body) => ([['Yörünge', b.orbit ? b.orbit + (/\d/.test(b.orbit) && !/yörünge|L4|arasında|'den/i.test(b.orbit) ? ' AB' : '') : ''], ['Yerçekimi', b.grav], ['Atmosfer', b.atm], ['Sıcaklık', b.temp], ['Yaşam', b.life]] as [string, string | undefined][]).filter(([, v]) => v && v !== '—');
  const STATUS_TR: Record<string, string> = { open: 'Açık', closed: 'Kapalı', danger: 'Tehlikeli', collapsed: 'Çökmüş', rumor: 'Söylenti' };
  const laneCol = (l: LaneData) => l.status === 'danger' ? '#ff3355' : l.status === 'rumor' ? '#b06bff' : l.status === 'collapsed' || l.status === 'closed' ? '#8892a6' : LANE_COLOR[l.kind] ?? '#9fe8ff';
  const DIRS = ['doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı', 'kuzey', 'kuzeydoğu'];
  const dirName = (ang: number) => DIRS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8]; // ekranda +z aşağı = güney
  type GateInfo = LaneGate & { lane: LaneData; to: string };
  /** Her bilinen hat için bir geçit; yön kümedeki hedef sistemin gerçek yönü. Kodeks'teki geçitler (Beş Geçit, Eski Köprü…) kendi hatlarına eşlenir. */
  function gatesFor(id: string): GateInfo[] {
    const s0 = S.get(id); if (!s0) return [];
    const out: GateInfo[] = lanesOf(id).map((l) => { const o = l.a === id ? l.b : l.a, t = S.get(o)!;
      return { id: 'lg-' + l.id, lane: l, to: o, ang: Math.atan2(t.z - s0.z, t.x - s0.x), status: l.status, color: laneCol(l), name: l.name + ' geçidi' }; });
    const free = new Set(out.map((g) => g.id));
    for (const b of bodiesOf(id).filter((b) => b.kind === 'gate' || (b.kind === 'station' && /geçit/i.test(b.name)))) {
      const n = /Beş/.test(b.name) ? 5 : /iki geçit|geçitleri/i.test(b.name + ' ' + b.type) ? 2 : 1, w0 = b.name.split(/\s+/)[0].toLocaleLowerCase('tr');
      const score = (g: GateInfo) => (/kara hat/i.test(b.type) && /kara hat/i.test(g.lane.name) ? 5 : 0) + (g.lane.name.toLocaleLowerCase('tr').includes(w0) ? 4 : 0) + ((S.get(g.to)?.name ?? '').toLocaleLowerCase('tr') === w0 ? 4 : 0);
      const c = out.filter((g) => free.has(g.id)).map((g) => [g, score(g)] as const).sort((x, y) => y[1] - x[1]);
      let pick = c.filter((x) => x[1] > 0).slice(0, n).map((x) => x[0]);
      if (pick.length < n && n > 1) pick = pick.concat(c.filter((x) => x[1] === 0 && x[0].status === 'open').slice(0, n - pick.length).map((x) => x[0]));
      pick.forEach((g, i) => { g.canon = b.id; free.delete(g.id); g.au = b.au2 && n === 2 ? (i ? b.au2 : b.au) : n === 5 ? 30 + i * 3.75 : b.au; if (b.star === 'B') g.host = 'B';
        g.name = (b.kind === 'station' ? b.name.split(' ')[0] + ' geçidi' : b.name.replace(/ geçitleri$/, '')) + ' · ' + g.lane.name; });
    }
    return out;
  }
  const gates = $derived(cur && map && kb.ready ? gatesFor(cur) : []);
  const gmap = $derived(new Map(gates.map((g) => [g.id, g])));
  const gs = $derived(bsel ? gmap.get(bsel) ?? null : null);
  const gcanon = $derived(gs?.canon ? bmap.get(gs.canon) ?? null : null);
  const leftOpen = $derived(pinned || lopen);
  const left = (e: ActiveEvent) => Math.max(1, Math.ceil((e.end - now) / 60000));

  function refreshEvents() {
    if (!map || !evd) return; now = Date.now();
    const vis = map.systems.filter((s) => s.owner !== 'dm' && known(s.id));
    ev = activeAt(now, vis);
    const ss = new Map<string, number>(), ls = new Map<string, number>();
    for (const e of ev) { ss.set(e.sys, Math.max(ss.get(e.sys) ?? 0, e.tpl.sev)); if (e.lane) ls.set(e.lane, Math.max(ls.get(e.lane) ?? 0, e.tpl.sev)); }
    sc?.setEvents(ss, ls, evd.sev);
  }
  function selectSys(id: string) { sfx.click(); sel = id; sc?.select(id); sc?.flyTo(id); }
  const sysHooks = { hover: (id: string | null) => (bhov = id), select: (id: string | null) => selectBody(id) };
  function makeCluster(near?: string) {
    sc = new ClusterScene(host!, ov!, map!, known, { hover: (id) => (hov = id), select: (id) => (sel = id) }, q);
    if (sel) sc.selected = sel;
    sc.setLayers(labels, lanesOn, terr); sc.setFilter(new Set(hidden)); refreshEvents(); applyMarks();
    if (near) { sc.placeNear(near, 9); sc.select(near); sc.flyTo(near, 85, 1800); }
  }
  /** Sisteme gir: kümede yakına dalış + çizgi geçişi, küme sahnesi kapanır, sistem sahnesi uzaktan içeri süzülür. */
  function enter() {
    if (!ss || busy || !known(ss.id) || ss.owner === 'dm' || !map) return; busy = true; sfx.glitch();
    const id = ss.id; sc?.flyTo(id, 12, 1000); setTimeout(() => (warp = 1), 450);
    setTimeout(() => {
      sc?.dispose(); sc = null; hov = null; cur = id; bsel = null; mode = 'system';
      sys2 = new SystemScene(host!, ov!, S.get(id)!, bodiesOf(id), sysHooks, q, { gates: gatesFor(id) }); sys2.setLayers(labels, orbits, moving);
      warp = 2; setTimeout(() => { warp = 0; busy = false; }, 900);
    }, 1500);
  }
  /** Kümeye dön: yıldıza dalış, ters geçiş, küme sahnesi sistemin dibinden geri çekilir. */
  async function back() {
    if (!sys2 || busy) return; busy = true; sfx.glitch(); const id = cur!;
    setTimeout(() => (warp = 1), 350); await sys2.exit(); await new Promise((r) => setTimeout(r, 450));
    sys2.dispose(); sys2 = null; bsel = null; bhov = null; mode = 'cluster'; sel = id; makeCluster(id); cur = null;
    warp = 2; setTimeout(() => { warp = 0; busy = false; }, 900);
  }
  /** Geçitten hedef sisteme: kümeye dön, hedefi seç, içine gir. */
  async function jump(to: string) { if (busy) return; await back(); setTimeout(() => { if (!known(to)) return; sel = to; sc?.select(to); setTimeout(enter, 900); }, 950); }
  function selectBody(id: string | null) {
    bsel = id; if (!id || !sys2) return; sfx.click();
    if (!snaps[id]) sys2.snapshot(id).then((u) => (snaps = { ...snaps, [id]: u }));
  }
  function focusBody(id: string) { sys2?.focus(id); }
  // Not: önce durumu oku (sahne henüz yokken de bağımlılık kurulsun), sonra uygula.
  $effect(() => { const h = new Set(hidden); sc?.setFilter(h); });
  $effect(() => { const a = labels, b = lanesOn, c = terr; sc?.setLayers(a, b, c); });
  $effect(() => { const a = labels, b = orbits, c = moving; sys2?.setLayers(a, b, c); });
  $effect(() => { const qq = q; untrack(() => applyQuality(qq)); });
  /** Kalite değişince sahne yeni ayarlarla baştan kurulur (piksel oranı, AA, bloom, oktav, nokta/kaya sayıları); kamera yerinde kalır. */
  function applyQuality(qq: Quality) {
    localStorage.setItem('qv.mapq', qq);
    if (sc && sc.quality !== qq && !busy) { const pose = sc.getPose(); sc.dispose(); makeCluster(); sc!.setPose(pose); }
    if (sys2 && sys2.quality !== qq && !busy && cur) { const pose = sys2.getPose(), keep = bsel; sys2.dispose();
      sys2 = new SystemScene(host!, ov!, S.get(cur)!, bodiesOf(cur), sysHooks, qq, { intro: false, gates: gatesFor(cur) }); sys2.setLayers(labels, orbits, moving); sys2.setPose(pose);
      if (keep) { sys2.select(keep); snaps = {}; } }
  }

  onMount(() => {
    let alive = true, timer = 0, stopEv = () => {};
    const u0 = session.user!; const stopMk = watchMarkers(u0.role === 'dm' ? null : u0.uid, (m) => (marks = m));
    const esc = (e: KeyboardEvent) => { if (e.key !== 'Escape') return;
      if (lightbox.open) return;
      if (busy) { e.stopImmediatePropagation(); return; }
      if (mode === 'system') { e.stopImmediatePropagation(); if (bsel) { bsel = null; sys2?.select(null); sys2?.overview(); } else back(); return; }
      if (sel) { sel = null; sc?.select(null); sc?.overview(); e.stopImmediatePropagation(); } };
    addEventListener('keydown', esc, true); const stopAmb = ambient('starmap');
    (async () => {
      try {
        const [data] = await Promise.all([fetch(import.meta.env.BASE_URL + 'data/starmap.json').then((r) => r.json()), loadKb(session.user!)]);
        if (!alive) return; map = data;
        evd = await loadEvents(data.systems, data.lanes);
        makeCluster();
        timer = setInterval(() => { if (!document.hidden) refreshEvents(); }, 15000) as unknown as number;
        stopEv = watchDoc<WorldEvents>(['world', 'events'], (w) => { setWorldLive(w); refreshEvents(); });
      } catch (e) { err = String(e); }
    })();
    return () => { alive = false; clearInterval(timer); stopEv(); stopMk(); stopAmb(); removeEventListener('keydown', esc, true); sc?.dispose(); sc = null; sys2?.dispose(); sys2 = null; };
  });
</script>

<div class="sm">
  <div class="gl" bind:this={host}></div>
  <div class="ov" bind:this={ov}></div>
  <div class="vig"></div>

  <!-- sol kenar: dar sekme; fare kenara gelince ya da tıklayınca açılır, sabitlenebilir -->
  <div class="edge" role="presentation" onmouseenter={() => (lopen = true)} onmouseleave={(e) => { if (!(e.relatedTarget as Element | null)?.closest?.('.pan.left')) lopen = false; }}></div>
  {#if !leftOpen}<button class="etab mono" onclick={() => (lopen = true)} onmouseenter={() => (lopen = true)}>{mode === 'cluster' ? 'KÜME' : 'SİSTEM'} <span>›</span></button>{/if}
  {#if mode === 'cluster'}
  <!-- sol: arama ve süzgeç -->
  <aside class="pan left" class:col={!leftOpen} onmouseleave={(e) => { if (!(e.relatedTarget as Element | null)?.closest?.('.edge, .etab')) lopen = false; }}>
    <button class="pin mono" class:on={pinned} title={pinned ? 'Sabitlemeyi kaldır' : 'Paneli sabitle'} onclick={() => { pinned = !pinned; localStorage.setItem('qv.mapPin', pinned ? '1' : '0'); }}>{pinned ? '◉ SABİT' : '○ SABİTLE'}</button>
    <div class="ttl mono">QORVES STARMAP <small>KÜME</small></div>
    <input class="inp" bind:value={search} placeholder="Sistem ara…" />
    <div class="lst">
      {#each list as s (s.id)}
        <button class:on={sel === s.id} onclick={() => selectSys(s.id)} onmouseenter={() => { hov = s.id; if (sc) sc.hovered = s.id; }} onmouseleave={() => { hov = null; if (sc) sc.hovered = null; }}>
          <i style:background={STAR_COLOR[s.stype]}></i>{known(s.id) ? s.name : 'Bilinmeyen sinyal'}{#if known(s.id) && CAPITALS[s.id]}<svg class="capi" class:old={s.id === 'sys-imperion'} viewBox="0 0 16 16"><title>{s.name + ' · ' + CAPITALS[s.id]}</title><path d="M2 12h12l1-7-4 3-3-5-3 5-4-3z"/></svg>{/if}
          {#if marksOf(s.id).length}<span class="mkg" title={marksOf(s.id).map((m) => m.label).join(', ')}>{marksOf(s.id).some((m) => m.kind === 'ship') ? '▲' : '◆'}</span>{/if}
          {#if evFor(s.id).length}<em style:color={evd?.sev[evFor(s.id)[0].tpl.sev].color}>▲</em>{/if}
        </button>
      {/each}
    </div>
    {#if marks.length}<div class="mono h">İŞARETLER</div>
    <div class="mks">{#each marks as m (m.id)}<button class="mk-{m.kind}" onclick={() => selectSys(m.sys)} title={m.note}><b>{m.kind === 'ship' ? '▲' : '◆'}</b>{m.label}<small>{known(m.sys) ? S.get(m.sys)?.name : 'Bilinmeyen sinyal'}</small></button>{/each}</div>{/if}
    <div class="mono h">BÖLGELER</div>
    <div class="facs">
      {#each Object.entries(map?.factions ?? {}) as [k, f] (k)}
        {#if k !== 'dm'}<label style:--fc={f.color}><input type="checkbox" checked={!hidden.includes(k)} onchange={(e) => (hidden = (e.target as HTMLInputElement).checked ? hidden.filter((x) => x !== k) : [...hidden, k])} /><span></span>{f.name}</label>{/if}
      {/each}
    </div>
    <div class="mono h">KATMANLAR</div>
    <div class="tog">
      <label><input type="checkbox" bind:checked={lanesOn} />Hatlar</label>
      <label><input type="checkbox" bind:checked={labels} />Etiketler</label>
      <label><input type="checkbox" bind:checked={terr} />Bölge tonu</label>
    </div>
    <div class="qual mono">KALİTE {#each ['low', 'med', 'high'] as x}<button class:on={q === x} onclick={() => (q = x as Quality)}>{x === 'low' ? 'DÜŞÜK' : x === 'med' ? 'ORTA' : 'YÜKSEK'}</button>{/each}</div>
    <button class="ovw mono" onclick={() => { sel = null; sc?.select(null); sc?.overview(); }}>⌂ KÜMEYE DÖN</button>
  </aside>

  {:else if cs}
  <!-- sol: sistem cisimleri -->
  <aside class="pan left" class:col={!leftOpen} onmouseleave={(e) => { if (!(e.relatedTarget as Element | null)?.closest?.('.edge, .etab')) lopen = false; }} style:--fc={map?.factions[cs.owner]?.color}>
    <button class="pin mono" class:on={pinned} title={pinned ? 'Sabitlemeyi kaldır' : 'Paneli sabitle'} onclick={() => { pinned = !pinned; localStorage.setItem('qv.mapPin', pinned ? '1' : '0'); }}>{pinned ? '◉ SABİT' : '○ SABİTLE'}</button>
    <div class="ttl mono">SİSTEM <small>{cs.name.toLocaleUpperCase('tr')}</small></div>
    <div class="mono sub">{STYPE[cs.stype]} · {map?.factions[cs.owner]?.name}</div>
    <div class="lst blst">
      <button class:on={bsel === 'star'} onclick={() => focusBody('star')} onmouseenter={() => sys2 && (sys2.hovered = 'star')} onmouseleave={() => sys2 && (sys2.hovered = null)}><i style:background={STAR_COLOR[cs.stype]}></i>{cs.stype === 'blackhole' ? 'Saren' : cs.name} <small class="kd">yıldız</small></button>
      {#each tree as n (n.b.id)}
        <button class:on={bsel === n.b.id} onclick={() => focusBody(n.b.id)} onmouseenter={() => sys2 && (sys2.hovered = n.b.id)} onmouseleave={() => sys2 && (sys2.hovered = null)}><i class="k-{n.b.kind}"></i>{n.b.name}<small class="kd">{KIND[n.b.kind]}</small></button>
        {#each n.kids as k (k.id)}
          <button class="kid" class:on={bsel === k.id} onclick={() => focusBody(k.id)} onmouseenter={() => sys2 && (sys2.hovered = k.id)} onmouseleave={() => sys2 && (sys2.hovered = null)}><i class="k-{k.kind}"></i>{k.name}<small class="kd">{KIND[k.kind]}</small></button>
        {/each}
      {/each}
      {#if gates.length}<div class="gh mono">HAT GEÇİTLERİ</div>
        {#each gates as g (g.id)}<button class:on={bsel === g.id} onclick={() => focusBody(g.id)} onmouseenter={() => sys2 && (sys2.hovered = g.id)} onmouseleave={() => sys2 && (sys2.hovered = null)}><i class="k-gate" style:border-color={g.color}></i>{g.lane.name}<small class="kd">→ {S.get(g.to)?.name}</small></button>{/each}{/if}
      {#if !blist.length}<div class="none mono">BU SİSTEMİN DÜNYALARI HAKKINDA BİLGİN YOK</div>{/if}
    </div>
    {#if marksOf(cs.id).length}<div class="mks">{#each marksOf(cs.id) as m (m.id)}<div class="mk-{m.kind} mkr"><b>{m.kind === 'ship' ? '▲ GEMİN BURADA' : '◆ GÖREV NOKTASI'}</b>{m.label}{#if m.note}<small>{m.note}</small>{/if}</div>{/each}</div>{/if}
    <div class="mono h">KATMANLAR</div>
    <div class="tog">
      <label><input type="checkbox" bind:checked={orbits} />Yörüngeler</label>
      <label><input type="checkbox" bind:checked={labels} />Etiketler</label>
      <label><input type="checkbox" bind:checked={moving} />Yörünge hareketi</label>
    </div>
    <div class="qual mono">KALİTE {#each ['low', 'med', 'high'] as x}<button class:on={q === x} onclick={() => (q = x as Quality)}>{x === 'low' ? 'DÜŞÜK' : x === 'med' ? 'ORTA' : 'YÜKSEK'}</button>{/each}</div>
    <button class="ovw mono" onclick={() => { bsel = null; sys2?.select(null); sys2?.overview(); }}>⌖ SİSTEMİN TAMAMI</button>
    <button class="ovw mono back" onclick={back}>‹ KÜMEYE DÖN <small>ESC</small></button>
  </aside>
  {/if}

  <!-- sağ üst: yerel uyarılar -->
  <section class="alerts" class:open={aopen} role="complementary" onmouseenter={() => (aopen = true)} onmouseleave={() => (aopen = false)}>
    {#if mode === 'system' && cs}
    <header class="mono"><span class="dot" class:hot={evFor(cs.id).length}></span>YEREL UYARILAR · {cs.name.toLocaleUpperCase('tr')}{#if evFor(cs.id).length > 1}<em class="more">+{evFor(cs.id).length - 1} {aopen ? '▴' : '▾'}</em>{/if}</header>
    {#each evFor(cs.id) as e (e.key)}
      {@const sv = evd?.sev[e.tpl.sev]}
      <article style:--sv={sv?.color}>
        <div class="row1 mono"><b>{sv?.label}</b><span>{evd?.cats[e.tpl.cat]}</span><span class="t">kalan {left(e)} dk</span></div>
        <h4>{e.tpl.name}{#if e.lane} <small>· {map?.lanes.find((l) => l.id === e.lane)?.name}</small>{/if}</h4>
        <p class="msg">“{e.tpl.msg}”</p><p class="eff">{e.tpl.effect}</p><div class="by mono">— {e.tpl.by}{#if e.forced} · DM{/if}</div>
      </article>
    {:else}<div class="none mono">BU SİSTEMDE AKTİF UYARI YOK</div>{/each}
    {:else}
    <header class="mono"><span class="dot" class:hot={ev.length}></span>YEREL UYARILAR{#if fs} · {known(fs.id) ? fs.name.toLocaleUpperCase('tr') : '???'}{:else} · KÜME ({ev.length}){/if}{#if (fs ? focusEv : topEv).length > 1}<em class="more">+{(fs ? focusEv : topEv).length - 1} {aopen ? '▴' : '▾'}</em>{/if}</header>
    {#each (fs ? focusEv : topEv) as e (e.key)}
      {@const sv = evd?.sev[e.tpl.sev]}
      <article style:--sv={sv?.color}>
        <div class="row1 mono"><b>{sv?.label}</b><span>{evd?.cats[e.tpl.cat]}</span><span class="t">kalan {left(e)} dk</span></div>
        <h4>{e.tpl.name}{#if !fs} <small>· {S.get(e.sys)?.name}</small>{/if}{#if e.lane} <small>· {map?.lanes.find((l) => l.id === e.lane)?.name}</small>{/if}</h4>
        <p class="msg">“{e.tpl.msg}”</p>
        <p class="eff">{e.tpl.effect}</p>
        <div class="by mono">— {e.tpl.by}{#if e.forced} · DM{/if}</div>
      </article>
    {:else}
      <div class="none mono">{fs ? 'BU SİSTEMDE AKTİF UYARI YOK' : 'KÜMEDE AKTİF UYARI YOK'}</div>
    {/each}
    {/if}
  </section>

  <!-- sağ: cisim paneli (sistem görünümü) -->
  {#if mode === 'system' && cs && bsel}
    {#key bsel}
      <aside class="pan info bpan" style:--fc={map?.factions[cs.owner]?.color}>
        <button class="x" onclick={() => { bsel = null; sys2?.select(null); }} aria-label="Kapat">✕</button>
        {#if bsel === 'star' || bsel.startsWith('star-')}
          <div class="mono k">{bsel === 'star' ? STYPE[cs.stype] : 'Eş yıldız'}</div>
          <h2>{bsel === 'star' ? (cs.stype === 'blackhole' ? 'Saren' : cs.name) : bsel.slice(5)}</h2>
          <div class="own"><span class="chip" role="button" tabindex="0" onclick={() => map?.factions[cs.owner].state && getEntry(map.factions[cs.owner].state!) && openTag(map.factions[cs.owner].state!)} onkeydown={() => {}}>{map?.factions[cs.owner]?.name}</span></div>
          {#if bsel === 'star'}<table class="ph"><tbody><tr><td>Yıldız</td><td>{cs.star || STYPE[cs.stype]}</td></tr>{#if starEnt?.summary && !generic(starEnt.summary) && !cs.star.includes(starEnt.summary.replace(/\.$/, ''))}<tr><td>Not</td><td>{starEnt.summary}</td></tr>{/if}</tbody></table>
          {:else}<p class="sum">{bsel === 'star-Gwathren' ? 'Isilwen B, kızıl cüce, patlama yıldızı; A\'dan ortalama 38 AB.' : bsel === 'star-Morwen B' ? 'M2 V kızıl cüce, A\'dan 38 AB; ara sıra patlama.' : 'Genç, sıcak beyaz cüce; A\'dan ~900 AB. Hithlin bulutsusunu parlatır.'}</p>{/if}
          {@render gallery(bsel, null, bsel === 'star' ? cs.name : bsel.slice(5))}
          <div class="act"><button class="btn ghost" onclick={() => openTag(cur!)}>Sistem kodeksi</button></div>
        {:else if gs}
          <div class="mono k">Hat geçidi + istasyon · {gs.lane.kind}</div>
          <h2>{gs.name}</h2>
          <div class="own"><span class="chip" role="button" tabindex="0" onclick={() => map?.factions[cs.owner].state && getEntry(map.factions[cs.owner].state!) && openTag(map.factions[cs.owner].state!)} onkeydown={() => {}}>{map?.factions[cs.owner]?.name}</span><span class="mono dg" style:color={gs.color}>{STATUS_TR[gs.status] ?? gs.status}</span></div>
          <table class="ph"><tbody>
            <tr><td>Hat</td><td>{gs.lane.name}</td></tr><tr><td>Hedef</td><td>{S.get(gs.to)?.name} · {S.get(gs.to) ? map?.factions[S.get(gs.to)!.owner]?.name : ''}</td></tr>
            <tr><td>Yön</td><td>Sistemin {dirName(gs.ang)} kıyısı{#if gs.au}{" · ~" + gs.au + " AB"}{/if}</td></tr><tr><td>Tür</td><td>{gs.lane.kind}</td></tr><tr><td>Süre</td><td>{gs.lane.days}</td></tr><tr><td>Tehlike</td><td>{gs.lane.danger}</td></tr>
          </tbody></table>
          {#if gcanon}<p class="sum"><b>{gcanon.name}</b> · {gcanon.type}{#if gcanon.orbit} · {gcanon.orbit} AB{/if}</p>{#if gcanon.desc}<p class="desc"><RichText text={gcanon.desc} self={gcanon.ent} /></p>{/if}{#if gcanon.dm}<div class="dmnote"><span class="mono">DM · GİZLİ</span><RichText text={gcanon.dm} self={gcanon.ent} /></div>{/if}{/if}
          {#each ev.filter((e) => e.lane === gs.lane.id) as e (e.key)}<div class="gev" style:--sv={evd?.sev[e.tpl.sev].color}><b class="mono">{evd?.sev[e.tpl.sev].label}</b> {e.tpl.name} · kalan {left(e)} dk</div>{/each}
          {@render gallery(gs.id, null, gs.name)}
          <div class="act">{#if getEntry(gs.lane.id)}<button class="btn ghost" onclick={() => openTag(gs.lane.id)}>Hat kodeksi</button>{/if}<button class="btn" disabled={!known(gs.to) || gs.status === 'collapsed' || gs.status === 'closed'} onclick={() => jump(gs.to)}>Hedefe geç ›</button></div>
        {:else if bs}
          <div class="mono k">{KIND[bs.kind]} · {bs.type}{#if bs.note} · {bs.note}{/if}</div>
          <h2>{bs.name}</h2>
          {#if bs.pop}<div class="ot">Halk arasında: <b>{bs.pop}</b></div>{/if}
          <div class="own"><span class="chip" role="button" tabindex="0" onclick={() => map?.factions[cs.owner].state && getEntry(map.factions[cs.owner].state!) && openTag(map.factions[cs.owner].state!)} onkeydown={() => {}}>{map?.factions[cs.owner]?.name}</span>{#if bs.parent && bmap.get(bs.parent)}<span class="mono dg">↳ {bmap.get(bs.parent)?.name}</span>{/if}</div>
          {#if rows(bs).length}<table class="ph"><tbody>{#each rows(bs) as [k, v] (k)}<tr><td>{k}</td><td>{v}</td></tr>{/each}{#if bs.count}<tr><td>Sayı</td><td>{bs.count}</td></tr>{/if}</tbody></table>{/if}
          {#if be?.summary && !generic(be.summary) && be.type !== 'system'}<p class="sum"><RichText text={be.summary} self={be.id} /></p>{/if}
          {#if bs.desc}<p class="desc"><RichText text={bs.desc} self={bs.ent} /></p>{/if}
          {#if bs.dm}<div class="dmnote"><span class="mono">DM · GİZLİ</span><RichText text={bs.dm} self={bs.ent} /></div>{/if}
          {@render gallery(bs.id, bs.img ?? null, bs.name)}
          {#if be && childrenOf(be.id).length}
            <div class="mono h">ETİKETLER</div>
            <div class="tags">{#each childrenOf(be.id) as c (c.id)}<button class="tg" style:--c={tmeta(c.type).color} onclick={() => openTag(c.id)}>{c.name}</button>{/each}</div>
          {/if}
          <div class="act">{#if be}<button class="btn ghost" onclick={() => openTag(be.id)}>Kodeks</button>{/if}<button class="btn ghost" onclick={() => focusBody(bs.id)}>Odakla</button></div>
        {/if}
      </aside>
    {/key}
  {/if}
  {#snippet gallery(id: string, img: string | null, name: string)}
    <div class="mono h">GÖRÜNTÜLER</div>
    <div class="gal">
      {#if img}<button onclick={() => openImage(base + 'img/bd/' + img, name)}><img src={base + 'img/bd/' + img} alt={name} loading="lazy" /></button>{/if}
      {#each snaps[id] ?? [] as u, i (i)}<button onclick={() => openImage(u, name + ' · simülasyon')}><img src={u} alt={name + ' · simülasyon'} /><em class="mono">SİMÜLASYON</em></button>{/each}
      {#if !snaps[id]}<div class="snapld mono">GÖRÜNTÜ İŞLENİYOR…</div>{/if}
    </div>
  {/snippet}

  <!-- sağ: sistem bilgi paneli -->
  {#if mode === 'cluster' && ss}
    {#key ss.id}
      <aside class="pan info" style:--fc={map?.factions[ss.owner]?.color}>
        <button class="x" onclick={() => { sel = null; sc?.select(null); }} aria-label="Kapat">✕</button>
        <div class="mono k">{STYPE[ss.stype]}{#if ss.star && known(ss.id)} · {ss.star}{/if}</div>
        <h2 class="glitch" data-text={known(ss.id) ? ss.name : 'Bilinmeyen sinyal'}>{known(ss.id) ? ss.name : 'Bilinmeyen sinyal'}</h2>
        {#if ss.owner === 'dm'}
          <p class="sum">Haritada adı geçen bir sistem. Hakkında bilinen bir şey yok.</p>
        {:else}
          <div class="own"><span class="chip" role="button" tabindex="0" onclick={() => map?.factions[ss.owner].state && getEntry(map.factions[ss.owner].state!) && openTag(map.factions[ss.owner].state!)} onkeydown={() => {}}>{map?.factions[ss.owner]?.name}</span>
            <span class="mono dg">TEHLİKE {ss.danger}</span></div>
          {#if ss.ownerText}<div class="ot">{ss.ownerText}</div>{/if}
          {#if se?.summary}<p class="sum"><RichText text={se.summary} self={se.id} /></p>{/if}
          {#if childrenOf(ss.id).length}
            <div class="mono h">GÖK CİSİMLERİ</div>
            <div class="tags">{#each childrenOf(ss.id) as c (c.id)}<button class="tg" style:--c={tmeta(c.type).color} onclick={() => openTag(c.id)}>{c.name}</button>{/each}</div>
          {/if}
          {#if lanesOf(ss.id).length}
            <div class="mono h">HATLAR</div>
            <div class="ln">{#each lanesOf(ss.id) as l (l.id)}
              {@const o = l.a === ss.id ? l.b : l.a}
              <button onclick={() => selectSys(o)}><i style:background={l.status === 'open' ? LANE_COLOR[l.kind] : l.status === 'danger' ? '#ff3355' : '#8892a6'}></i><b>{l.name}</b><span>→ {S.get(o)?.name} · {l.kind} · {l.days}</span></button>
            {/each}</div>
          {/if}
          <div class="act">
            <button class="btn ghost" onclick={() => se && openTag(se.id)}>Kodeks</button>
            <button class="btn" onclick={enter} disabled={!known(ss.id)}>Sisteme gir ›</button>
          </div>
        {/if}
      </aside>
    {/key}
  {/if}

  <!-- lejant -->
  {#if mode === 'cluster'}
  <div class="legend" class:closed={!legend}>
    <button class="mono" onclick={() => (legend = !legend)}>LEJANT {legend ? '▾' : '▸'}</button>
    {#if legend}
      <div class="lg">
        <div><span class="mono">YILDIZLAR</span>{#each ['G', 'K', 'F', 'M', 'A', 'redgiant', 'whitedwarf', 'pulsar', 'magnetar', 'blackhole'] as t}<em><i style:background={STAR_COLOR[t]}></i>{STYPE[t].split(' · ')[0]}</em>{/each}</div>
        <div><span class="mono">HATLAR</span>{#each Object.entries(LANE_COLOR) as [k, c]}<em><i class="bar" style:background={c}></i>{k}</em>{/each}<em><i class="bar" style:background="#ff3355"></i>Tehlikeli</em><em><i class="bar dash" style:background="#8892a6"></i>Kapalı / çökmüş</em><em><i class="bar dash" style:background="#b06bff"></i>Söylenti</em></div>
        <div><span class="mono">UYARI</span>{#each Object.values(evd?.sev ?? {}) as s}<em><i class="tri" style:border-bottom-color={s.color}></i>{s.label}</em>{/each}</div>
      </div>
    {/if}
  </div>
  {/if}

  {#if warp}
    <div class="warp" class:out={warp === 2}><div class="streaks"></div><div class="flash"></div>
      {#if warp === 1 && (cs || ss)}<div class="wtag mono">{mode === 'system' ? 'KÜMEYE DÖNÜŞ' : 'SİSTEME GİRİŞ · ' + (ss?.name ?? '').toLocaleUpperCase('tr')}</div>{/if}
    </div>
  {/if}
  {#if !map && !err}<div class="ld mono">KÜME VERİSİ YÜKLENİYOR…</div>{/if}
  {#if err}<div class="ld mono err">HARİTA AÇILAMADI: {err}</div>{/if}
</div>

<style>
  .sm{position:absolute;inset:0;overflow:hidden;background:#020309}
  .gl{position:absolute;inset:0}.gl :global(canvas){display:block;width:100%;height:100%}
  .ov{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55))}
  .ov :global(.sm-lbl){position:absolute;left:0;top:0;margin:-30px 0 0 12px;white-space:nowrap;font-family:var(--f-ui);font-size:13px;letter-spacing:.08em;color:#dff6ff;
    text-shadow:0 0 6px #000,0 0 3px #000;display:flex;align-items:center;gap:5px;will-change:transform;transition:opacity .2s}
  .ov :global(.sm-lbl b){font-weight:600;border-left:2px solid var(--fc);padding-left:6px}
  .ov :global(.sm-lbl.focus b){color:var(--ye);font-size:15px}
  .ov :global(.sm-lbl.unk b),.ov :global(.sm-lbl.dm b){color:#8a93a3;font-style:italic}
  .ov :global(.sm-lbl .ev){display:none;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid var(--sv);filter:drop-shadow(0 0 4px var(--sv));animation:evb 1.4s infinite}
  .ov :global(.sm-lev){position:absolute;left:0;top:0;margin:-6px 0 0 -6px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid var(--sv);filter:drop-shadow(0 0 5px var(--sv));animation:evb 1.4s infinite}
  @keyframes evb{50%{opacity:.35}}
  .pan{position:absolute;z-index:4;background:rgba(5,8,14,.82);border:1px solid rgba(0,240,255,.25);backdrop-filter:blur(6px)}
  .left{left:16px;top:58px;bottom:16px;width:240px;display:flex;flex-direction:column;gap:8px;padding:12px;transition:transform .35s cubic-bezier(.2,.9,.2,1),opacity .3s;z-index:6}
  .left.col{transform:translateX(calc(-100% - 20px));opacity:0;pointer-events:none}
  .edge{position:absolute;left:0;top:46px;bottom:0;width:14px;z-index:5}
  .etab{position:absolute;left:0;top:50%;transform:translateY(-50%);z-index:5;writing-mode:vertical-rl;padding:16px 5px;background:rgba(5,8,14,.85);border:1px solid rgba(0,240,255,.35);border-left:0;color:var(--cy);font-size:10px;letter-spacing:.35em;animation:ai .3s both}
  .etab span{color:var(--ye)}.etab:hover{background:rgba(0,240,255,.12)}
  .pin{position:absolute;right:10px;top:10px;background:none;border:0;color:var(--mut);font-size:9px;letter-spacing:.18em;padding:0}.pin.on{color:var(--ye)}
  .capi{width:13px;height:13px;fill:var(--ye);stroke:none;margin-left:4px;filter:drop-shadow(0 0 3px rgba(252,238,10,.6));flex:none}.capi.old{fill:none;stroke:#b8a060;stroke-width:1.3}
  .ov :global(.sm-lbl .cap){pointer-events:auto;cursor:help;position:relative;display:inline-grid;place-items:center;width:17px;height:17px;border:1px solid rgba(252,238,10,.7);background:rgba(20,16,0,.75);box-shadow:0 0 8px rgba(252,238,10,.35);text-decoration:none}
  .ov :global(.sm-lbl .cap svg){width:12px;height:12px;fill:var(--ye);stroke:var(--ye);stroke-width:.6}
  .ov :global(.sm-lbl .cap.old){border-color:rgba(184,160,96,.6);background:rgba(10,8,0,.6);box-shadow:none}.ov :global(.sm-lbl .cap.old svg){fill:none;stroke:#b8a060;stroke-width:1.2}
  .ov :global(.sm-lbl .mk s){pointer-events:auto;cursor:help;position:relative;text-decoration:none;margin-left:5px;font-size:12px}
  .ov :global(.sm-lbl .mk .sh){color:#39ff8a;text-shadow:0 0 8px #39ff8a;animation:evb 1.6s infinite}.ov :global(.sm-lbl .mk .mi){color:#ff9b2f;text-shadow:0 0 8px #ff9b2f}
  .ov :global(.sm-lbl .mk s:hover::after){content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);white-space:nowrap;font-family:var(--f-mono);font-size:10.5px;letter-spacing:.1em;color:#000;background:#dff6ff;padding:4px 8px}
  .mkg{margin-left:auto;color:#39ff8a;font-size:11px}
  .mks{display:flex;flex-direction:column;gap:4px;margin:4px 0 8px}
  .mks button,.mks .mkr{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;text-align:left;background:rgba(0,0,0,.35);border:1px solid rgba(57,255,138,.35);color:var(--tx);padding:5px 8px;font-size:13px}
  .mks .mk-mission{border-color:rgba(255,155,47,.45)}.mks b{color:#39ff8a;font-family:var(--f-mono);font-size:11px}.mks .mk-mission b{color:#ff9b2f}.mks small{color:var(--mut);font-size:11px;margin-left:auto}.mks .mkr small{margin-left:0;flex-basis:100%}
  .ov :global(.sm-lbl .cap:hover::after){content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);white-space:nowrap;font-family:var(--f-mono);font-size:10.5px;letter-spacing:.12em;color:#000;background:var(--ye);padding:4px 8px;box-shadow:0 0 12px rgba(252,238,10,.4)}
  .gh{font-size:9px;letter-spacing:.3em;color:#c78bff;margin:8px 0 2px 4px}
  .gev{font-size:12px;border-left:3px solid var(--sv);padding:3px 8px;background:rgba(255,255,255,.03)}.gev b{color:var(--sv);font-size:9.5px;letter-spacing:.15em}
  .ttl{font-size:12px;letter-spacing:.3em;color:var(--cy)}.ttl small{color:var(--ye);margin-left:6px}
  .lst{flex:1;min-height:80px;overflow:auto;display:flex;flex-direction:column}
  .lst button{display:flex;align-items:center;gap:8px;padding:4px 6px;background:none;border:0;color:var(--tx);text-align:left;font-size:13.5px}
  .lst button i{width:7px;height:7px;border-radius:50%;box-shadow:0 0 6px currentColor;flex:none}
  .lst button em{margin-left:auto;font-style:normal;font-size:10px}
  .lst button:hover{background:rgba(0,240,255,.08)}.lst button.on{color:var(--ye);background:rgba(252,238,10,.08)}
  .h{font-size:9.5px;letter-spacing:.3em;color:var(--mut);margin-top:4px}
  .facs,.tog{display:flex;flex-direction:column;gap:2px;font-size:12.5px}
  .facs label,.tog label{display:flex;align-items:center;gap:7px;cursor:pointer;color:#c9d6e2}
  .facs input,.tog input{accent-color:var(--cy)}
  .facs span{width:10px;height:10px;background:var(--fc);box-shadow:0 0 6px var(--fc);flex:none}
  .qual{display:flex;gap:4px;align-items:center;font-size:9.5px;letter-spacing:.15em;color:var(--mut)}
  .qual button{flex:1;background:none;border:1px solid var(--line);color:var(--mut);font-family:var(--f-mono);font-size:9.5px;padding:4px 0}
  .qual button.on{border-color:var(--cy);color:var(--cy)}
  .ovw{background:none;border:1px solid var(--line);color:var(--cy);padding:6px;font-size:10.5px;letter-spacing:.2em}.ovw:hover{border-color:var(--cy)}
  .alerts{position:absolute;right:16px;top:58px;width:340px;max-height:42vh;overflow:hidden;z-index:7;display:flex;flex-direction:column;gap:6px;transition:max-height .35s}
  .alerts.open{max-height:76vh;overflow:auto}
  .alerts:not(.open) article:not(:first-of-type){display:none}
  .alerts:not(.open) article:first-of-type .eff,.alerts:not(.open) article:first-of-type .by{display:none}
  .alerts.open article:not(:first-of-type){animation:ad .3s both}
  @keyframes ad{from{opacity:0;transform:translateY(-10px)}}
  .alerts header .more{margin-left:auto;font-style:normal;color:var(--cy)}
  .alerts header{font-size:10.5px;letter-spacing:.22em;color:var(--ye);background:rgba(5,8,14,.85);border:1px solid rgba(252,238,10,.35);padding:7px 10px;display:flex;align-items:center;gap:8px}
  .dot{width:8px;height:8px;border-radius:50%;background:#3a4252}.dot.hot{background:var(--rd);box-shadow:0 0 8px var(--rd);animation:evb 1s infinite}
  .alerts article{background:rgba(5,8,14,.88);border:1px solid color-mix(in srgb,var(--sv) 40%,transparent);border-left:3px solid var(--sv);padding:8px 10px;animation:ai .3s both}
  @keyframes ai{from{opacity:0;transform:translateX(12px)}}
  .row1{display:flex;gap:8px;font-size:9.5px;letter-spacing:.15em;color:var(--mut)}.row1 b{color:var(--sv)}.row1 .t{margin-left:auto;color:var(--cy)}
  .alerts h4{font-size:15px;color:#fff;margin:3px 0}.alerts h4 small{color:var(--mut);font-weight:400}
  .msg{font-size:12.5px;color:#d7e3ee;font-style:italic;line-height:1.4}.eff{font-size:12px;color:var(--mut);margin-top:4px;line-height:1.4}
  .by{font-size:9.5px;color:var(--mut);margin-top:4px;letter-spacing:.08em}
  .none{font-size:10px;letter-spacing:.2em;color:var(--mut);background:rgba(5,8,14,.8);padding:10px;border:1px solid var(--line)}
  .info{right:16px;bottom:16px;top:calc(42vh + 70px);width:340px;padding:16px 18px;overflow:auto;border-color:color-mix(in srgb,var(--fc) 55%,transparent);animation:ii .35s cubic-bezier(.2,.9,.2,1) both;display:flex;flex-direction:column;gap:8px}
  @keyframes ii{from{opacity:0;transform:translateX(30px)}}
  .info .x{position:absolute;right:8px;top:8px;background:none;border:0;color:var(--mut)}
  .k{font-size:10px;letter-spacing:.18em;color:var(--fc)}
  .info h2{font-family:var(--f-disp);font-size:28px;letter-spacing:.08em;color:#fff;text-shadow:0 0 16px color-mix(in srgb,var(--fc) 60%,transparent)}
  .own{display:flex;align-items:center;gap:10px}.chip{font-size:12.5px;padding:2px 8px;border:1px solid var(--fc);color:var(--fc);cursor:pointer}
  .dg{font-size:10px;letter-spacing:.15em;color:var(--ye)}.ot{font-size:12px;color:var(--mut)}
  .sum{font-size:14px;line-height:1.5;color:#d2dfea}
  .tags{display:flex;flex-wrap:wrap;gap:4px}.tg{font-size:12px;padding:2px 7px;background:color-mix(in srgb,var(--c) 10%,transparent);border:1px solid color-mix(in srgb,var(--c) 45%,transparent);color:var(--c)}
  .ln{display:flex;flex-direction:column;gap:3px}.ln button{display:flex;align-items:center;gap:7px;background:none;border:0;color:var(--tx);text-align:left;font-size:12.5px;padding:2px 0}
  .ln i{width:14px;height:3px;flex:none}.ln span{color:var(--mut);font-size:11.5px}.ln button:hover b{color:var(--ye)}
  .act{display:flex;gap:8px;margin-top:auto;padding-top:8px}.act .btn{flex:1}
  .legend{position:absolute;left:40px;bottom:16px;z-index:4;background:rgba(5,8,14,.8);border:1px solid var(--line);padding:6px 10px;font-size:11.5px;color:#c9d6e2}
  .legend>button{background:none;border:0;color:var(--cy);font-size:10px;letter-spacing:.25em;padding:0}
  .lg{display:flex;flex-direction:column;gap:5px;margin-top:6px}.lg>div{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;max-width:620px}
  .lg span{font-size:9.5px;letter-spacing:.2em;color:var(--mut);width:70px}
  .lg em{font-style:normal;display:flex;align-items:center;gap:5px}.lg i{width:8px;height:8px;border-radius:50%;box-shadow:0 0 5px currentColor}
  .lg i.bar{width:16px;height:3px;border-radius:0}.lg i.dash{background-image:repeating-linear-gradient(90deg,transparent 0 3px,#020309 3px 5px)!important}
  .lg i.tri{width:0;height:0;border-radius:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid;box-shadow:none}
  .ov :global(.sb-lbl){position:absolute;left:0;top:0;margin:-24px 0 0 10px;white-space:nowrap;font-family:var(--f-ui);font-size:12.5px;letter-spacing:.07em;color:#dff6ff;text-shadow:0 0 6px #000,0 0 3px #000;will-change:transform;transition:opacity .2s}
  .ov :global(.sb-lbl b){font-weight:500;border-left:2px solid rgba(0,240,255,.6);padding-left:5px}
  .ov :global(.sb-lbl.k-star b){border-color:var(--ye);color:#fff3c0;font-size:14px}
  .ov :global(.sb-lbl.k-moon),.ov :global(.sb-lbl.k-swarm){font-size:11px;color:#b8cad8}.ov :global(.sb-lbl.k-moon b),.ov :global(.sb-lbl.k-swarm b){border-color:rgba(160,180,200,.5)}
  .ov :global(.sb-lbl.k-belt){font-size:10.5px;color:#9fb0c0;font-style:italic}.ov :global(.sb-lbl.k-belt b){border-color:rgba(160,180,200,.35)}
  .ov :global(.sb-lbl.k-station b){border-color:#00f0ff;color:#bff8ff}.ov :global(.sb-lbl.k-gate b){border-color:#c78bff;color:#e6d4ff}
  .ov :global(.sb-lbl.focus b){color:var(--ye);font-size:14px;border-color:var(--ye)}
  .sub{font-size:9.5px;letter-spacing:.14em;color:var(--fc)}
  .blst button{font-size:13px}.blst .kid{padding-left:20px;font-size:12.5px;color:#b8c8d6}
  .blst .kd{margin-left:auto;font-size:9.5px;color:var(--mut);letter-spacing:.05em}
  .blst i{border-radius:50%;background:#9ab0c4}.blst i.k-belt{border-radius:0;height:2px!important;background:#8a96a4}.blst i.k-station{border-radius:1px;background:#00f0ff}
  .blst i.k-gate{background:none;border:1.5px solid #c78bff}.blst i.k-singularity{background:#000;box-shadow:0 0 0 2px #ff9a3c}.blst i.k-moon{width:5px!important;height:5px!important}
  .back{color:var(--ye)}.back small{color:var(--mut);margin-left:6px}
  .ph{width:100%;border-collapse:collapse;font-size:12px}.ph td{padding:3px 4px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top;color:#d2dfea}.ph td:first-child{color:var(--mut);width:84px;font-family:var(--f-mono);font-size:10px;letter-spacing:.1em}
  .desc{font-size:13px;line-height:1.55;color:#c4d2de}
  .dmnote{border:1px dashed rgba(255,42,70,.5);padding:6px 8px;font-size:12.5px;color:#f2c4cc;line-height:1.45}.dmnote span{display:block;font-size:9px;letter-spacing:.25em;color:var(--rd);margin-bottom:3px}
  .gal{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.gal button{position:relative;padding:0;border:1px solid var(--line);background:#000;aspect-ratio:1;overflow:hidden}
  .gal img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}.gal button:hover img{transform:scale(1.06)}
  .gal em{position:absolute;left:3px;bottom:2px;font-size:7.5px;letter-spacing:.15em;color:var(--cy);font-style:normal;text-shadow:0 0 3px #000}
  .snapld{grid-column:span 2;display:grid;place-items:center;font-size:9px;letter-spacing:.2em;color:var(--mut);border:1px dashed var(--line);aspect-ratio:2}
  .bpan{top:calc(42vh + 70px)}
  .wtag{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:12px;letter-spacing:.4em;color:var(--cy);text-shadow:0 0 10px var(--cy);animation:ai .4s .3s both}
  .warp.out{pointer-events:none}.warp.out .streaks{animation:wzo .9s ease-out forwards}.warp.out .flash{animation:wfo .9s forwards}
  @keyframes wzo{0%{transform:scale(3.4) rotate(12deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:0}}
  @keyframes wfo{0%{opacity:1;background:#020309}100%{opacity:0;background:#020309}}
  .warp{position:absolute;inset:0;z-index:8;overflow:hidden;pointer-events:auto}
  .streaks{position:absolute;inset:-50%;background:repeating-conic-gradient(from 0deg,rgba(160,240,255,0) 0 2.2deg,rgba(160,240,255,.75) 2.3deg 2.5deg,rgba(160,240,255,0) 2.6deg 5deg);
    mask-image:radial-gradient(circle,transparent 4%,#000 30%,transparent 70%);animation:wz 1.1s cubic-bezier(.6,0,.9,.4) forwards}
  @keyframes wz{0%{transform:scale(.2) rotate(0);opacity:0}25%{opacity:1}100%{transform:scale(3.4) rotate(12deg);opacity:1}}
  .flash{position:absolute;inset:0;background:radial-gradient(circle,#fff,rgba(0,240,255,.6) 30%,transparent 70%);opacity:0;animation:wf 1.1s forwards}
  @keyframes wf{0%,80%{opacity:0}92%{opacity:1}100%{opacity:1;background:#020309}}
  .ld{position:absolute;inset:0;display:grid;place-items:center;color:var(--cy);letter-spacing:.3em;font-size:12px}.err{color:var(--rd)}
</style>
