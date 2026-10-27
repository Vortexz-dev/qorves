<script lang="ts">
  // Qorves Starmap — küme görünümü. Sahne starmap/scene.ts; olay motoru lib/events.ts.
  import { onMount } from 'svelte';
  import { ClusterScene, STAR_COLOR, LANE_COLOR, type MapData, type Quality } from '../starmap/scene';
  import { kb, loadKb, getEntry, childrenOf } from '../lib/kb.svelte';
  import { session } from '../lib/session.svelte';
  import { openTag } from '../lib/tags.svelte';
  import { loadEvents, activeAt, type ActiveEvent, type EvData } from '../lib/events';
  import { sfx } from '../lib/sfx';
  import RichText from '../ui/RichText.svelte';
  import { tmeta } from '../lib/types';

  const STYPE: Record<string, string> = { A: 'A tipi · mavi-beyaz', F: 'F tipi · sarı-beyaz', G: 'G tipi · sarı', K: 'K tipi · turuncu', M: 'M tipi · kızıl cüce', redgiant: 'Kızıl dev',
    whitedwarf: 'Beyaz cüce', pulsar: 'Pulsar', magnetar: 'Magnetar', blackhole: 'Kara delik (tekillik)', triple: 'Üçlü yıldız', binary: 'Çift yıldız', unknown: 'Bilinmiyor' };
  let host: HTMLDivElement | undefined = $state(), ov: HTMLDivElement | undefined = $state();
  let map = $state<MapData | null>(null), sc: ClusterScene | null = null;
  let hov = $state<string | null>(null), sel = $state<string | null>(null);
  let q = $state<Quality>((localStorage.getItem('qv.mapq') as Quality) || 'med');
  let labels = $state(true), lanesOn = $state(true), terr = $state(true), search = $state(''), hidden = $state<string[]>([]), legend = $state(true);
  let ev = $state<ActiveEvent[]>([]), evd = $state<EvData | null>(null), now = $state(Date.now()), warp = $state(0), err = $state('');
  const isDM = $derived(session.user?.role === 'dm');
  const known = (id: string) => !!getEntry(id);
  const S = $derived(map ? new Map(map.systems.map((s) => [s.id, s])) : new Map());
  const focus = $derived(hov ?? sel);
  const fs = $derived(focus ? S.get(focus) : null);
  const ss = $derived(sel ? S.get(sel) : null);
  const se = $derived(sel ? getEntry(sel) : null);
  const evFor = (id: string) => ev.filter((e) => e.sys === id || (e.lane && map?.lanes.find((l) => l.id === e.lane && (l.a === id || l.b === id)))).sort((a, b) => b.tpl.sev - a.tpl.sev);
  const focusEv = $derived(focus ? evFor(focus) : []);
  const topEv = $derived([...ev].sort((a, b) => b.tpl.sev - a.tpl.sev).slice(0, 4));
  const list = $derived(map ? map.systems.filter((s) => !hidden.includes(s.owner) && (!search || (known(s.id) ? s.name : '').toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')))).sort((a, b) => a.name.localeCompare(b.name, 'tr')) : []);
  const lanesOf = (id: string) => (map?.lanes ?? []).filter((l) => (l.a === id || l.b === id) && known(l.id));
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
  function enter() {
    if (!ss) return; sfx.glitch(); sc?.flyTo(ss.id, 14, 900); setTimeout(() => (warp = 1), 700); setTimeout(() => (warp = 2), 2600);
  }
  $effect(() => { sc?.setFilter(new Set(hidden)); });
  $effect(() => { sc?.setLayers(labels, lanesOn, terr); });
  $effect(() => { if (sc && sc.quality !== q) { sc.setQuality(q); localStorage.setItem('qv.mapq', q); } });

  onMount(() => {
    let alive = true, timer = 0;
    const esc = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (warp) { warp = 0; e.stopImmediatePropagation(); } else if (sel) { sel = null; sc?.select(null); sc?.overview(); e.stopImmediatePropagation(); } };
    addEventListener('keydown', esc, true);
    (async () => {
      try {
        const [data] = await Promise.all([fetch(import.meta.env.BASE_URL + 'data/starmap.json').then((r) => r.json()), loadKb(session.user!)]);
        if (!alive) return; map = data;
        evd = await loadEvents(data.systems, data.lanes);
        sc = new ClusterScene(host!, ov!, data, known, { hover: (id) => (hov = id), select: (id) => (sel = id) }, q);
        sc.setLayers(labels, lanesOn, terr); refreshEvents();
        timer = setInterval(() => { if (!document.hidden) refreshEvents(); }, 15000) as unknown as number;
      } catch (e) { err = String(e); }
    })();
    return () => { alive = false; clearInterval(timer); removeEventListener('keydown', esc, true); sc?.dispose(); sc = null; };
  });
</script>

<div class="sm">
  <div class="gl" bind:this={host}></div>
  <div class="ov" bind:this={ov}></div>
  <div class="vig"></div>

  <!-- sol: arama ve süzgeç -->
  <aside class="pan left">
    <div class="ttl mono">QORVES STARMAP <small>KÜME</small></div>
    <input class="inp" bind:value={search} placeholder="Sistem ara…" />
    <div class="lst">
      {#each list as s (s.id)}
        <button class:on={sel === s.id} onclick={() => selectSys(s.id)} onmouseenter={() => { hov = s.id; if (sc) sc.hovered = s.id; }} onmouseleave={() => { hov = null; if (sc) sc.hovered = null; }}>
          <i style:background={STAR_COLOR[s.stype]}></i>{known(s.id) ? s.name : 'Bilinmeyen sinyal'}
          {#if evFor(s.id).length}<em style:color={evd?.sev[evFor(s.id)[0].tpl.sev].color}>▲</em>{/if}
        </button>
      {/each}
    </div>
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

  <!-- sağ üst: yerel uyarılar -->
  <section class="alerts">
    <header class="mono"><span class="dot" class:hot={ev.length}></span>YEREL UYARILAR{#if fs} · {known(fs.id) ? fs.name.toLocaleUpperCase('tr') : '???'}{:else} · KÜME ({ev.length}){/if}</header>
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
  </section>

  <!-- sağ: sistem bilgi paneli -->
  {#if ss}
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
            <button class="btn" onclick={enter}>Sisteme gir ›</button>
          </div>
        {/if}
      </aside>
    {/key}
  {/if}

  <!-- lejant -->
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

  {#if warp}
    <div class="warp" class:done={warp === 2}>
      <div class="streaks"></div><div class="flash"></div>
      {#if warp === 2}
        <div class="wbox"><div class="mono k">SİSTEME GİRİŞ · {ss?.name.toLocaleUpperCase('tr')}</div><h3>Sistem görünümü hazırlanıyor</h3><p>Ayrıntılı sistem haritası bir sonraki güncellemede açılacak.</p><button class="btn" onclick={() => { warp = 0; sc?.flyTo(sel!, 85); }}>Haritaya dön</button></div>
      {/if}
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
  .left{left:16px;top:58px;bottom:16px;width:240px;display:flex;flex-direction:column;gap:8px;padding:12px}
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
  .alerts{position:absolute;right:16px;top:58px;width:340px;max-height:42vh;overflow:auto;z-index:4;display:flex;flex-direction:column;gap:6px}
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
  .legend{position:absolute;left:272px;bottom:16px;z-index:4;background:rgba(5,8,14,.8);border:1px solid var(--line);padding:6px 10px;font-size:11.5px;color:#c9d6e2}
  .legend>button{background:none;border:0;color:var(--cy);font-size:10px;letter-spacing:.25em;padding:0}
  .lg{display:flex;flex-direction:column;gap:5px;margin-top:6px}.lg>div{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;max-width:620px}
  .lg span{font-size:9.5px;letter-spacing:.2em;color:var(--mut);width:70px}
  .lg em{font-style:normal;display:flex;align-items:center;gap:5px}.lg i{width:8px;height:8px;border-radius:50%;box-shadow:0 0 5px currentColor}
  .lg i.bar{width:16px;height:3px;border-radius:0}.lg i.dash{background-image:repeating-linear-gradient(90deg,transparent 0 3px,#020309 3px 5px)!important}
  .lg i.tri{width:0;height:0;border-radius:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid;box-shadow:none}
  .warp{position:absolute;inset:0;z-index:8;overflow:hidden;pointer-events:auto}
  .streaks{position:absolute;inset:-50%;background:repeating-conic-gradient(from 0deg,rgba(160,240,255,0) 0 2.2deg,rgba(160,240,255,.75) 2.3deg 2.5deg,rgba(160,240,255,0) 2.6deg 5deg);
    mask-image:radial-gradient(circle,transparent 4%,#000 30%,transparent 70%);animation:wz 1.9s cubic-bezier(.6,0,.9,.4) forwards}
  @keyframes wz{0%{transform:scale(.2) rotate(0);opacity:0}25%{opacity:1}100%{transform:scale(3.4) rotate(12deg);opacity:1}}
  .flash{position:absolute;inset:0;background:radial-gradient(circle,#fff,rgba(0,240,255,.6) 30%,transparent 70%);opacity:0;animation:wf 1.9s forwards}
  @keyframes wf{0%,80%{opacity:0}92%{opacity:1}100%{opacity:1;background:#020309}}
  .warp.done .streaks{display:none}.warp.done .flash{animation:none;opacity:1;background:#020309}
  .wbox{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center;animation:ai .4s both}
  .wbox h3{font-family:var(--f-disp);font-size:26px;letter-spacing:.1em;color:var(--cy)}.wbox p{color:var(--mut)}
  .ld{position:absolute;inset:0;display:grid;place-items:center;color:var(--cy);letter-spacing:.3em;font-size:12px}.err{color:var(--rd)}
</style>
