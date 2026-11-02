<script lang="ts">
  // 2D iç plan: üstten çizim, güverte geçişi, ızgara, oda fotoğrafları, canlı jetonlar.
  import { onMount } from 'svelte';
  import { layout, roomAt, FLOORS, type Room } from '../../ship/plan';
  import { furn } from '../../ship/furn';
  import { part, nameOf, CAT_ICON, stats, type ShipDoc, type Addon } from '../../ship/sys';
  import { watchToks, saveTok, moveTok, type ShipTok } from '../../ship/live';
  import { tokenImg, colorOf } from '../../lib/gods';
  import { roomImg } from '../../ship/data';
  import { session } from '../../lib/session.svelte';
  import { sfx } from '../../lib/sfx';
  let { doc, sel, onpick, active }: { doc: ShipDoc; sel: string | null; onpick: (k: string | null) => void; active: boolean } = $props();
  const me = session.user!, dm = me.role === 'dm';
  const P = $derived(layout(doc));
  const st = $derived(stats(doc));
  let floor = $state(1), grid = $state(false), view = $state({ s: 40, x: 0, y: 0 }), box = $state<HTMLDivElement>(), room = $state<Room | null>(null), hovR = $state<string | null>(null);
  let toks = $state<ShipTok[]>([]), drag = $state<{ uid: string; x: number; y: number; ox: number; oy: number } | null>(null);
    function fit() {
    if (!box) return; const BW = box.clientWidth, BH = box.clientHeight, b = P.bounds, bw = b.x1 - b.x0 + 3, bh = b.y1 - b.y0 + 3.4;
    // iki yerleşim dene: paneller arası (tam boy) ya da istatistik panelinin altı (tam en); büyük olanı seç
    const A = { l: 320, r: 370, t: 120, b: 70 }, B = { l: 320, r: 40, t: Math.min(BH * 0.52, 470), b: 70 };
    const sc = (q: typeof A) => Math.min((BW - q.l - q.r) / bw, (BH - q.t - q.b) / bh), q = sc(B) > sc(A) ? B : A, s = Math.max(4, Math.min(64, sc(q)));
    const W = BW - q.l - q.r, H = BH - q.t - q.b;
    view = { s, x: q.l + W / 2 - ((b.x0 + b.x1) / 2) * s, y: q.t + H / 2 - ((b.y0 + b.y1) / 2) * s };
  }
  let lastBounds = '';
  $effect(() => { const k = `${P.bounds.x0}|${P.bounds.x1}|${P.bounds.y1}`; if (k !== lastBounds && box) { lastBounds = k; fit(); } });
  $effect(() => { if (active) requestAnimationFrame(fit); });
  // ---- pan / zoom
  let pan: { x: number; y: number; vx: number; vy: number; moved: boolean } | null = null;
  const toWorld = (cx: number, cy: number) => { const r = box!.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.s, y: (cy - r.top - view.y) / view.s }; };
  /** İniş takımı ayaklarının x konumları: tırda ön/arka, dorsede boya göre 2–3 çift. */
  function gearXs(h: { x: number; w: number; nose?: boolean }) { const n = Math.max(2, Math.round(h.w / 10)); const fr = h.nose ? [0.17, 0.86] : Array.from({ length: n }, (_, k) => (k + 0.5) / n); return fr.map((f) => h.x + h.w * f); }
  function wheel(e: WheelEvent) { e.preventDefault(); const r = box!.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; const ns = Math.max(12, Math.min(120, view.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); view = { s: ns, x: mx - ((mx - view.x) * ns) / view.s, y: my - ((my - view.y) * ns) / view.s }; }
  function down(e: PointerEvent) { if (e.button !== 0 || drag) return; pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; }
  let lastSend = 0, sendT = 0;
  function move(e: PointerEvent) {
    if (drag) { const w = toWorld(e.clientX, e.clientY); drag = { ...drag, x: w.x - drag.ox, y: w.y - drag.oy }; const now = Date.now(); if (now - lastSend > 110) { lastSend = now; const d = drag; moveTok(d.uid, +d.x.toFixed(2), +d.y.toFixed(2), floor).catch(() => {}); } else { clearTimeout(sendT); const d = drag; sendT = window.setTimeout(() => d && moveTok(d.uid, +d.x.toFixed(2), +d.y.toFixed(2), floor).catch(() => {}), 130); } return; }
    if (!pan) return; const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (Math.abs(dx) + Math.abs(dy) > 4) pan.moved = true; if (pan.moved) view = { ...view, x: pan.vx + dx, y: pan.vy + dy };
  }
  function up() {
    if (drag) { clearTimeout(sendT); const d = drag, t = toks.find((x) => x.uid === d.uid); let x = d.x, y = d.y;
      const stp = P.stairs.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (stp) { const nf = floor ? 0 : 1; x = stp.x + stp.w / 2; y = stp.y + stp.h + 0.5; moveTok(d.uid, +x.toFixed(2), +y.toFixed(2), nf).catch(() => {}); toks = toks.map((q) => (q.uid === d.uid ? { ...q, x, y, f: nf } : q)); drag = null; pan = null; floor = nf; sfx.click(); return; }
      if (!roomAt(P, floor, x, y)) { sfx.error(); if (t && roomAt(P, t.f, t.x, t.y)) { x = t.x; y = t.y; } else { const r = P.rooms.find((q) => q.id === 'cab_lng')!; x = r.x + r.w / 2; y = r.y + r.h / 2; } } else sfx.click();
      moveTok(d.uid, +x.toFixed(2), +y.toFixed(2), floor).catch(() => {}); toks = toks.map((q) => (q.uid === d.uid ? { ...q, x, y, f: floor } : q)); drag = null; }
    pan = null;
  }
  const clickOk = () => !pan?.moved;
  function grab(e: PointerEvent, t: ShipTok) { if (!(dm || t.uid === me.uid)) return; e.stopPropagation(); const w = toWorld(e.clientX, e.clientY), p = tokPos(t); drag = { uid: t.uid, x: p.x, y: p.y, ox: w.x - p.x, oy: w.y - p.y }; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); }
  // jeton yeri: odası kalmadıysa (dorse ayrıldı) oturma alanına
  function tokPos(t: ShipTok) { if (drag?.uid === t.uid) return { x: drag.x, y: drag.y, f: floor }; if (roomAt(P, t.f, t.x, t.y)) return { x: t.x, y: t.y, f: t.f }; return { x: 9.4, y: 3.1, f: 1 }; }
  onMount(() => {
    let first = true;
    const stop = watchToks(async (l) => {
      toks = l;
      if (first) { first = false; const mine = l.find((t) => t.uid === me.uid); if (mine) floor = tokPos(mine).f;
        else if (!dm && me.character) { const img = await tokenImg(me.avatar); await saveTok({ uid: me.uid, name: me.character.name.split(' ')[0], img, col: colorOf(me.uid), x: 9.4, y: 3.1, f: 1, at: Date.now() }).catch(() => {}); } }
    });
    const ro = new ResizeObserver(() => fit()); if (box) ro.observe(box);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && room && active) { e.stopImmediatePropagation(); room = null; } };
    addEventListener('keydown', esc, true);
    return () => { stop(); ro.disconnect(); removeEventListener('keydown', esc, true); };
  });
  const ownerName = (o: string) => (o === 'truck' ? 'Tır · Outrider' : 'Dorse · ' + nameOf(doc.trailers.find((t) => t.k === o)?.id ?? ''));
  const LIVING = new Set(['lounge', 'bunk', 'cabin', 'commons', 'galley', 'meeting', 'studio']);
  const floorCls = (r: Room) => (r.kind === 'corridor' || r.kind === 'tank' ? 'fl-cor' : LIVING.has(r.kind) ? 'fl-liv' : r.kind === 'cockpit' || r.kind === 'bridge2' ? 'fl-ckp' : r.kind === 'wc' || r.kind === 'medbay' || r.kind === 'lab' || r.kind === 'cryo' ? 'fl-wet' : 'fl-svc');
  const pinId = (key: string) => (key === 'engine_mount' ? doc.engine : key === 'core_mount' ? doc.core : doc.fit[key]);
  const pinIcon = (id: string | undefined) => { const p = id ? part(id) : null; return p ? (CAT_ICON[p.k === 'addon' ? (p as Addon).cat : p.k] ?? '◆') : '+'; };
  const holdOf = (r: Room) => (r.hold ? st.holds.find((h) => h.loc === r.hold) : null);
  const cargoIn = (r: Room) => doc.cargo.filter((c) => c.loc === r.hold && (r.kind === 'hidden' ? c.hidden : !c.hidden));
  const vert = (r: Room) => r.h > r.w && r.name.length * 0.2 > r.w - 0.3;
  function setFloor(f: number) { if (f === floor) return; floor = f; room = null; sfx.click(); }
  const onFloor = (f: number) => toks.filter((t) => tokPos(t).f === f).length;
</script>

<div class="plan" class:on={active} bind:this={box} onwheel={wheel} onpointerdown={down} onpointermove={move} onpointerup={up} onpointerleave={up} role="application" aria-label="Gemi iç planı">
  <svg class="sv" width="100%" height="100%">
    <defs>
      <pattern id="pg" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="rgba(95,240,255,.16)" stroke-width="0.025" /></pattern>
      <pattern id="p-svc" width="1.2" height="1.2" patternUnits="userSpaceOnUse"><rect width="1.2" height="1.2" fill="#0f1720" /><path d="M0 0H1.2V1.2" fill="none" stroke="#1c2834" stroke-width="0.04" /><circle cx="0.1" cy="0.1" r="0.03" fill="#2a3a49" /><circle cx="1.1" cy="1.1" r="0.03" fill="#2a3a49" /></pattern>
      <pattern id="p-liv" width="0.6" height="2.4" patternUnits="userSpaceOnUse"><rect width="0.6" height="2.4" fill="#1d1813" /><path d="M0 0V2.4M0 1.2H0.6" stroke="#2a221a" stroke-width="0.03" /></pattern>
      <pattern id="p-ckp" width="0.5" height="0.5" patternUnits="userSpaceOnUse"><rect width="0.5" height="0.5" fill="#121a24" /><path d="M0 0.5H0.5V0" fill="none" stroke="#1a2531" stroke-width="0.02" /></pattern>
      <pattern id="p-wet" width="0.4" height="0.4" patternUnits="userSpaceOnUse"><rect width="0.4" height="0.4" fill="#151d24" /><path d="M0 0.4H0.4V0" fill="none" stroke="#212d37" stroke-width="0.02" /></pattern>
      <pattern id="p-cor" width="0.25" height="0.25" patternUnits="userSpaceOnUse"><rect width="0.25" height="0.25" fill="#0b1118" /><rect x="0.04" y="0.04" width="0.17" height="0.17" fill="#121b25" /></pattern>
      <pattern id="p-hull" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="2" fill="#0a1119" /><path d="M0 0V2" stroke="#101a24" stroke-width="0.5" /></pattern>
      <pattern id="p-haz" width="0.5" height="0.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="0.5" height="0.5" fill="#1a1406" /><rect width="0.25" height="0.5" fill="#d2a020" /></pattern>
      <radialGradient id="g-core"><stop offset="0" stop-color="#fff3d6" /><stop offset=".35" stop-color="#ffb547" /><stop offset="1" stop-color="#ff6a1a" stop-opacity="0" /></radialGradient>
      <radialGradient id="g-glw"><stop offset="0" stop-color="#ffe6b8" /><stop offset=".5" stop-color="#ff9a3c" stop-opacity=".7" /><stop offset="1" stop-color="#ff9a3c" stop-opacity="0" /></radialGradient>
      <radialGradient id="g-lit"><stop offset="0" stop-color="#fff1d0" stop-opacity=".07" /><stop offset="1" stop-color="#fff1d0" stop-opacity="0" /></radialGradient>
      <radialGradient id="g-holo"><stop offset="0" stop-color="#5ff0ff" stop-opacity=".55" /><stop offset="1" stop-color="#5ff0ff" stop-opacity="0" /></radialGradient>
      <linearGradient id="g-tank" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4c5c" /><stop offset=".45" stop-color="#7f97ab" /><stop offset="1" stop-color="#26323e" /></linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.12" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    <g transform="translate({view.x} {view.y}) scale({view.s})">
      <!-- diğer güverte silik -->
      {#each P.hulls.filter((h) => h.f !== floor) as h (h.owner + h.f)}<rect class="ghost" x={h.x} y={h.y} width={h.w} height={h.h} rx="0.6" />{/each}
      {#each P.couplings as c, i (i)}{#if floor === 0}<g class="cpl"><rect x={c.x} y={c.y} width={c.w} height={c.h} />{#each Array(9) as _, j (j)}<line x1={c.x + 0.12 + j * (c.w - 0.24) / 8} y1={c.y} x2={c.x + 0.12 + j * (c.w - 0.24) / 8} y2={c.y + c.h} />{/each}</g><rect class="drawbar" x={c.x - 0.2} y="2.6" width={c.w + 0.4} height="0.8" rx="0.2" />{/if}{/each}
      {#if floor === 0}
        {#each P.hulls.filter((h) => h.f === 0) as h (h.owner)}
          {#each gearXs(h) as ax (ax)}
            {#each [-1, 1] as dir (dir)}{@const ey = dir < 0 ? h.y : h.y + h.h}{@const py = ey + dir * 0.34}
              <g class="gear {h.gear ?? 'craft'}">
                <rect class="gbay" x={ax - 0.6} y={dir < 0 ? ey + 0.04 : ey - 0.36} width="1.2" height="0.32" rx="0.06" />
                <line x1={ax - 0.42} y1={ey} x2={ax} y2={py} /><line x1={ax + 0.42} y1={ey} x2={ax} y2={py} /><line class="pis" x1={ax} y1={ey} x2={ax} y2={py} />
                {#if h.gear === 'heavy'}<rect class="pad" x={ax - 0.5} y={py - 0.12} width="1" height="0.24" rx="0.04" />
                {:else if h.gear === 'sleek'}<circle class="pad" cx={ax} cy={py} r="0.2" /><circle class="pgl" cx={ax} cy={py} r="0.07" />
                {:else if h.gear === 'scrap'}<rect class="pad" x={ax - 0.34} y={py - 0.13} width="0.7" height="0.26" rx="0.03" transform="rotate({dir * 7} {ax} {py})" /><circle class="pgl" cx={ax + 0.22} cy={py} r="0.05" />
                {:else}<path class="pad" d="M{ax - 0.3} {py} L{ax - 0.15} {py - 0.17} L{ax + 0.15} {py - 0.17} L{ax + 0.3} {py} L{ax + 0.15} {py + 0.17} L{ax - 0.15} {py + 0.17} Z" />{/if}
              </g>
            {/each}
          {/each}
          {#if h.nose}{#each [3.3, 4.7] as ny (ny)}<g class="noz"><circle cx={h.x - 1.3} cy={h.y + ny} r="0.75" fill="url(#g-glw)" /><path d="M{h.x + 0.05} {h.y + ny - 0.35} L{h.x - 0.75} {h.y + ny - 0.55} L{h.x - 0.75} {h.y + ny + 0.55} L{h.x + 0.05} {h.y + ny + 0.35} Z" /></g>{/each}{/if}
        {/each}
      {/if}
      {#each P.hulls.filter((h) => h.f === floor) as h (h.owner + h.f)}
        <g class="hull">
          {#if h.nose}<path class="hl" d="M{h.x} {h.y + 0.3} Q{h.x} {h.y} {h.x + 0.3} {h.y} H{h.x + h.w - 1.6} Q{h.x + h.w + 0.2} {h.y} {h.x + h.w + 0.2} {h.y + 1.6} V{h.y + h.h - 1.6} Q{h.x + h.w + 0.2} {h.y + h.h} {h.x + h.w - 1.6} {h.y + h.h} H{h.x + 0.3} Q{h.x} {h.y + h.h} {h.x} {h.y + h.h - 0.3} Z" />
          {:else}<rect class="hl" x={h.x} y={h.y} width={h.w} height={h.h} rx="0.3" />{/if}
          {#if h.nose && floor === 1}<path class="wind" d="M{h.x + h.w - 1.2} {h.y + 0.35} Q{h.x + h.w + 0.05} {h.y + h.h / 2} {h.x + h.w - 1.2} {h.y + h.h - 0.35}" />{/if}
          <rect class="hin" x={h.x + 0.16} y={h.y + 0.16} width={h.w - (h.nose ? 0.6 : 0.32)} height={h.h - 0.32} rx="0.2" />
          {#each Array(Math.floor(h.w / 1.5)) as _, k (k)}<circle class="rv" cx={h.x + 0.75 + k * 1.5} cy={h.y + 0.08} r="0.035" /><circle class="rv" cx={h.x + 0.75 + k * 1.5} cy={h.y + h.h - 0.08} r="0.035" />{/each}
          <circle class="rl-a" cx={h.x + 0.14} cy={h.y + 0.5} r="0.07" /><circle class="rl-a" cx={h.x + 0.14} cy={h.y + h.h - 0.5} r="0.07" />
          {#if h.nose}<circle class="rl-c" cx={h.x + h.w - 0.2} cy={h.y + 1.3} r="0.09" /><circle class="rl-c" cx={h.x + h.w - 0.2} cy={h.y + h.h - 1.3} r="0.09" />{/if}
          <text class="hlab" x={h.x + 0.2} y={h.y - 0.66}>{h.label}</text>
        </g>
      {/each}
      {#each P.mechs.filter((m) => m.f === floor) as m, i (i)}
        {#if m.kind === 'tank'}<g class="tank"><rect x={m.x} y={m.y} width={m.w} height={m.h} rx={m.h / 2} fill="url(#g-tank)" />{#each Array(Math.floor(m.w / 2.2)) as _, j (j)}<line x1={m.x + 1.4 + j * 2.2} y1={m.y + 0.05} x2={m.x + 1.4 + j * 2.2} y2={m.y + m.h - 0.05} />{/each}<rect class="tband" x={m.x + m.w * 0.4} y={m.y} width="0.9" height={m.h} /><text x={m.x + m.w / 2} y={m.y + m.h / 2 + 0.12}>{m.label}</text></g>
        {:else}<g class="mech {m.kind}"><rect x={m.x} y={m.y} width={m.w} height={m.h} rx="0.08" />{#if m.kind === 'gear'}{#each [m.y + 0.5, m.y + m.h - 0.5] as gy (gy)}<rect class="strut" x={m.x + m.w / 2 - 0.55} y={gy - 0.22} width="1.1" height="0.44" rx="0.08" /><circle class="ram" cx={m.x + m.w / 2} cy={gy} r="0.14" />{/each}<line x1={m.x + m.w / 2} y1={m.y + 0.72} x2={m.x + m.w / 2} y2={m.y + m.h - 0.72} />{/if}<text x={m.x + m.w / 2} y={m.y + m.h / 2 + 0.1}>{m.label}</text></g>{/if}
      {/each}
      {#each P.rooms.filter((r) => r.f === floor) as r (r.id)}
        <g class="room {floorCls(r)}" class:dash={r.dashed} class:hv={hovR === r.id} class:clk={!!r.img} class:on={room?.id === r.id} transform="translate({r.x} {r.y})" onpointerenter={() => (hovR = r.id)} onpointerleave={() => (hovR = null)} onclick={() => { if (clickOk() && r.img) { room = r; sfx.click(); } }} role="button" tabindex="-1" onkeydown={() => {}}>
          <rect class="fl" width={r.w} height={r.h} />
          {#if r.kind !== 'corridor' && r.kind !== 'tank' && r.kind !== 'fakewall'}<ellipse class="lit" cx={r.w / 2} cy={r.h / 2} rx={r.w * 0.45} ry={r.h * 0.45} />{/if}
          <g class="fx">{@html furn(r.kind, r.w, r.h, r.name)}</g>
          <rect class="wall" width={r.w} height={r.h} />
          {#if vert(r)}<text class="rl" transform="translate(0.42 {r.h - 0.2}) rotate(-90)">{r.name.toLocaleUpperCase('tr')}</text>{:else if r.kind !== 'corridor' || r.w > 6}<text class="rl" x={r.lx ?? 0.18} y="0.42">{r.name.toLocaleUpperCase('tr')}</text>{/if}
          {#if holdOf(r)}{@const h = holdOf(r)!}<text class="rc" x={vert(r) ? 0.75 : r.lx ?? 0.18} y={vert(r) ? r.h - 0.2 : 0.78} transform={vert(r) ? `rotate(-90 0.75 ${r.h - 0.2})` : undefined}>{r.kind === 'hidden' ? `${h.hiddenUsed} / ${h.hidden} t gizli` : `${h.used} / ${h.cap} t`}</text>{/if}
        </g>
      {/each}
      {#each P.doors.filter((d) => d.f === floor) as d, i (i)}
        {#if d.v}<g class="door {d.kind}"><rect class="cut" x={d.x - 0.14} y={d.y - d.w / 2} width="0.28" height={d.w} /><line x1={d.x} y1={d.y - d.w / 2} x2={d.x} y2={d.y + d.w / 2} /></g>
        {:else}<g class="door {d.kind}"><rect class="cut" x={d.x - d.w / 2} y={d.y - 0.14} width={d.w} height="0.28" /><line x1={d.x - d.w / 2} y1={d.y} x2={d.x + d.w / 2} y2={d.y} /></g>{/if}
      {/each}
      {#each P.stairs as s, i (i)}
        <g class="stairs" onclick={() => clickOk() && setFloor(floor ? 0 : 1)} role="button" tabindex="-1" onkeydown={() => {}}><rect x={s.x} y={s.y} width={s.w} height={s.h} />{#each Array(7) as _, j (j)}<line x1={s.x + 0.1 + j * (s.w - 0.2) / 6} y1={s.y + 0.08} x2={s.x + 0.1 + j * (s.w - 0.2) / 6} y2={s.y + s.h - 0.08} />{/each}<path d="M{s.x + 0.3} {s.y + s.h / 2} h{s.w - 0.6} m-0.25 -0.2 l0.25 0.2 l-0.25 0.2" /><text x={s.x + s.w / 2} y={s.y + s.h + 0.32}>{floor ? '↓ ALT GÜVERTE' : '↑ ÜST GÜVERTE'}</text></g>
      {/each}
      {#if grid}<rect class="grid" x={P.bounds.x0 - 2} y="-2" width={P.bounds.x1 - P.bounds.x0 + 4} height={P.bounds.y1 + 4} fill="url(#pg)" />{/if}
      {#each P.pins.filter((p) => p.f === floor) as p (p.key)}
        {@const id = pinId(p.key)}
        {#key id}<g class="pin" class:full={!!id} class:sel={sel === p.key} transform="translate({p.x} {p.y})" onclick={(e) => { e.stopPropagation(); if (clickOk()) onpick(p.key); }} role="button" tabindex="-1" onkeydown={() => {}}>
          <title>{p.slot.label} · {p.slot.size} {p.slot.mount}: {id ? nameOf(id) : 'boş'}</title>
          <circle class="pr" r="0.46" /><circle class="pc" r="0.32" /><text y="0.11">{pinIcon(id)}</text>
        </g>{/key}
      {/each}
      {#each toks as t (t.uid)}
        {@const q = tokPos(t)}
        {#if q.f === floor}
          <g class="tok" class:mine={t.uid === me.uid} class:drag={drag?.uid === t.uid} class:can={dm || t.uid === me.uid} transform="translate({q.x} {q.y})" onpointerdown={(e) => grab(e, t)} role="button" tabindex="-1">
            <circle class="sh" r="0.56" cy="0.06" /><circle class="rg" r="0.5" style:stroke={t.col} />
            <clipPath id="tc-{t.uid}"><circle r="0.44" /></clipPath>
            {#if t.img}<image href={t.img} x="-0.44" y="-0.44" width="0.88" height="0.88" clip-path="url(#tc-{t.uid})" />{:else}<circle r="0.44" fill="#1b2633" /><text class="ini" y="0.14">{t.name[0]}</text>{/if}
            <text class="tn" y="0.86">{t.name}</text>
          </g>
        {/if}
      {/each}
    </g>
  </svg>

  <div class="bar">
    <div class="fls">{#each FLOORS as name, i (i)}{@const f = FLOORS.length - 1 - i}<button class:on={floor === f} onclick={() => setFloor(f)}><span>{FLOORS[f]}</span>{#if onFloor(f)}<i>{onFloor(f)}</i>{/if}</button>{/each}</div>
    <button class="tg" class:on={grid} onclick={() => { grid = !grid; sfx.click(); }}>Izgara</button>
    <button class="tg" onclick={() => { fit(); sfx.click(); }}>Sığdır</button>
    <span class="hint">Oda: fotoğraf · Jeton: sürükle, merdivene bırak = kat · Fare tekerleği: yakınlaş</span>
  </div>

  {#if room}
    {@const h = holdOf(room)}
    <div class="rp" onpointerdown={(e) => e.stopPropagation()} role="dialog" tabindex="-1" aria-label={room.name}>
      <div class="ri"><img src={roomImg(room.img!)} alt={room.name} /><div class="rgr"></div></div>
      <div class="rt"><span class="mono">{ownerName(room.owner).toLocaleUpperCase('tr')} · {FLOORS[room.f].toLocaleUpperCase('tr')}</span><h3>{room.name}</h3>
        {#if h}<p class="mono">{room.kind === 'hidden' ? `GİZLİ BÖLME · ${h.hiddenUsed} / ${h.hidden} t` : `AMBAR · ${h.used} / ${h.cap} t`}</p>
          {#each cargoIn(room) as c (c.id)}<div class="cg"><b>{c.name}</b><span>{c.mass} t</span></div>{:else}<div class="cg mut">Boş.</div>{/each}{/if}
      </div>
      <button class="x" onclick={() => (room = null)} aria-label="Kapat">×</button>
    </div>
  {/if}
</div>

<style>
  .plan{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,#0a1420 0%,#04080f 70%);cursor:grab;touch-action:none;user-select:none}
  .plan:active{cursor:grabbing}
  .sv{display:block}
  :global(.plan text){font-family:var(--f-mono);paint-order:stroke;letter-spacing:0}
  .ghost{fill:none;stroke:rgba(95,240,255,.12);stroke-width:.05;stroke-dasharray:.3 .2}
  .hl{fill:url(#p-hull);stroke:#5d7b91;stroke-width:.16}
  .wind{fill:none;stroke:#5ff0ff;stroke-width:.12;opacity:.75;filter:url(#glow)}
  .hlab{font-size:.34px;letter-spacing:.12px;fill:#7fb6c9;opacity:.85}
  .cpl rect{fill:#0d141c;stroke:#5d7b91;stroke-width:.06}.cpl line{stroke:#3b5161;stroke-width:.05}.drawbar{fill:#1a2430;stroke:#4f677a;stroke-width:.05}
  .tank rect:first-child{stroke:#9fb3c4;stroke-width:.06}.tank line{stroke:rgba(10,16,22,.6);stroke-width:.08}.tband{fill:#d2a020;opacity:.75}.tank text{font-size:.34px;fill:#e8f1f7;text-anchor:middle;stroke:#0a1118;stroke-width:.06}
  .mech rect{fill:#0c131a;stroke:#33485a;stroke-width:.05}.mech.gear>rect:first-child{fill:url(#p-haz);opacity:.35}.mech .strut{fill:#141a20;stroke:#6a8496}.mech .ram{fill:#0c131a;stroke:#ffb547;stroke-width:.05}.mech line{stroke:#4d6070;stroke-width:.12}.mech text{font-size:.26px;fill:#6c8596;text-anchor:middle}
  .room .fl{stroke:none}.fl-svc .fl{fill:url(#p-svc)}.fl-liv .fl{fill:url(#p-liv)}.fl-ckp .fl{fill:url(#p-ckp)}.fl-wet .fl{fill:url(#p-wet)}.fl-cor .fl{fill:url(#p-cor)}
  .room .wall{fill:none;stroke:#9cb6c8;stroke-width:.14}.room.dash .wall{stroke-dasharray:.25 .15;stroke:#d2a020}
  .plan :global(svg *:focus),.plan :global(svg *:focus-visible){outline:none}
  .room.on .wall{stroke:#5ff0ff;stroke-width:.1;stroke-dasharray:none}.room.on .fl{filter:brightness(1.2)}
  .room.clk{cursor:pointer}.room.hv.clk .wall{stroke:#5ff0ff;filter:url(#glow)}.room.hv.clk .fl{filter:brightness(1.35)}
  .rl{font-size:.27px;letter-spacing:.06px;fill:#cfe3ee;stroke:#070c12;stroke-width:.07;pointer-events:none}.rc{font-size:.24px;fill:#ffb547;stroke:#070c12;stroke-width:.06;pointer-events:none}
  .door .cut{fill:#0b1118}.door line{stroke:#5ff0ff;stroke-width:.07;stroke-dasharray:.18 .08}
  .door.hatch line{stroke:#ffb547;stroke-dasharray:none;stroke-width:.1}.door.ramp line{stroke:#ffb547;stroke-width:.16;stroke-dasharray:.25 .12}.door.armored line{stroke:#ff5a6e;stroke-width:.12;stroke-dasharray:none}.door.secret .cut{fill:none}.door.secret line{stroke:#d2a020;stroke-dasharray:.06 .08;opacity:.8}
  .stairs{cursor:pointer}.stairs rect{fill:#121c26;stroke:#ffb547;stroke-width:.06}.stairs line{stroke:#3d5263;stroke-width:.05}.stairs path{fill:none;stroke:#ffb547;stroke-width:.07}.stairs text{font-size:.2px;fill:#ffb547;text-anchor:middle}
  .stairs:hover rect{fill:#1d2b38}
  .grid{pointer-events:none}
  .pin{cursor:pointer}.pin .pr{fill:rgba(255,181,71,.12);stroke:#ffb547;stroke-width:.06;stroke-dasharray:.16 .1}.pin .pc{fill:#140f06;stroke:#ffb547;stroke-width:.05}.pin text{font-size:.34px;text-anchor:middle;fill:#ffb547;font-family:sans-serif}
  .pin.full .pr{fill:rgba(57,255,138,.12);stroke:#39ff8a;stroke-dasharray:none}.pin.full .pc{fill:#06140c;stroke:#39ff8a}.pin.full text{fill:#9dffc4}
  .pin.sel .pr{stroke:#fcee0a;stroke-width:.1;filter:url(#glow)}.pin:hover .pr{stroke:#fff}
  .tok .sh{fill:rgba(0,0,0,.5)}.tok .rg{fill:#0b1118;stroke-width:.08}.tok.can{cursor:grab}.tok.drag{cursor:grabbing}.tok.drag .rg{filter:url(#glow)}.tok.mine .rg{stroke-width:.11}
  .tok .tn{font-size:.26px;fill:#eaf6fb;text-anchor:middle;stroke:#05090e;stroke-width:.08}.tok .ini{font-size:.4px;fill:#cfe3ee;text-anchor:middle}
  /* mobilya */
  .plan :global(.fx .fu){fill:#1d2a37;stroke:#8aa4b8;stroke-width:.035}
  .plan :global(.fx .ln){stroke:#8aa4b8;stroke-width:.03}.plan :global(.fx .ln2){stroke:rgba(10,16,22,.55);stroke-width:.03}
  .plan :global(.fx .st){fill:#3b2c20;stroke:#a7845f;stroke-width:.035}.plan :global(.fx .st.pil){stroke:#ffb547}.plan :global(.fx .sb){fill:#2a1f17;stroke:#7d634a;stroke-width:.025}
  .plan :global(.fx .sf){fill:#4a3626;stroke:#9a7656;stroke-width:.04}.plan :global(.fx .cu){fill:#5a4230;stroke:#8a6a4c;stroke-width:.025}
  .plan :global(.fx .tb){fill:#2b2620;stroke:#857563;stroke-width:.035}.plan :global(.fx .ct){fill:#27313b;stroke:#93a9ba;stroke-width:.035}
  .plan :global(.fx .sk){fill:#0f161d;stroke:#93a9ba;stroke-width:.03}.plan :global(.fx .stv){fill:#140c08;stroke:#ff7a3c;stroke-width:.035}
  .plan :global(.fx .bd){fill:#28323d;stroke:#8aa0b2;stroke-width:.035}.plan :global(.fx .pl){fill:#cdc5b6;stroke:none}.plan :global(.fx .bk){fill:#3e5468;stroke:none}
  .plan :global(.fx .lk){fill:#1f2934;stroke:#7891a5;stroke-width:.03}.plan :global(.fx .cab){fill:#1d2731;stroke:#7891a5;stroke-width:.03}.plan :global(.fx .shf){fill:#182029;stroke:#6f879b;stroke-width:.03}
  .plan :global(.fx .cr){fill:#4b3b25;stroke:#b48b52;stroke-width:.035}.plan :global(.fx .cr.hz){fill:#3f3a22;stroke:#d2a020}.plan :global(.fx .strap){fill:#15120d;stroke:none;opacity:.7}
  .plan :global(.fx .tape){stroke:#d2a020;stroke-width:.08;opacity:.7}
  .plan :global(.fx .scr){fill:rgba(95,240,255,.28);stroke:#5ff0ff;stroke-width:.025}.plan :global(.fx .cs){fill:#1a2632;stroke:#7d98ad;stroke-width:.035}
  .plan :global(.fx .holo){fill:url(#g-holo);stroke:#5ff0ff;stroke-width:.03;stroke-dasharray:.1 .08}.plan :global(.fx .fc){fill:#5ff0ff}.plan :global(.fx .fa){fill:#ffb547}
  .plan :global(.fx .rk){fill:#121a22;stroke:#60798d;stroke-width:.03}.plan :global(.fx .led){stroke:#39ff8a;stroke-width:.04;stroke-dasharray:.05 .12;opacity:.85}
  .plan :global(.fx .eng){fill:#26323f;stroke:#a3b7c7;stroke-width:.05}.plan :global(.fx .rib){stroke:#3e4f60;stroke-width:.06}.plan :global(.fx .glw){fill:url(#g-glw)}
  .plan :global(.fx .pipe){fill:none;stroke:#7d8f9e;stroke-width:.12;stroke-linecap:round}
  .plan :global(.fx .ring){fill:none;stroke:#ffb547;stroke-width:.06;stroke-dasharray:.3 .12}.plan :global(.fx .corec){fill:#2a1a0e;stroke:#ffb547;stroke-width:.06}.plan :global(.fx .coreg){fill:url(#g-core)}.plan :global(.fx .corew){fill:#fff3d6}
  .plan :global(.fx .grt){stroke:#16212c;stroke-width:.06}
  .plan :global(.fx .wc){fill:#d8dde0;stroke:#8a979f;stroke-width:.03}.plan :global(.fx .shw){fill:#1b2630;stroke:#7d98ad;stroke-width:.035;stroke-dasharray:.1 .06}
  .plan :global(.fx .tur){fill:#253240;stroke:#a3b7c7;stroke-width:.06}.plan :global(.fx .brl){fill:#3a4a58;stroke:#a3b7c7;stroke-width:.03}.plan :global(.fx .lad){fill:#151d25;stroke:#ffb547;stroke-width:.04}
  .plan :global(.fx .gun){fill:#2b3640;stroke:#8aa0b2;stroke-width:.025}.plan :global(.fx .arc){fill:none;stroke:#5ff0ff;stroke-width:.1;opacity:.7}
  .plan :global(.fx .cam){fill:#1b232c;stroke:#ff5a6e;stroke-width:.03}.plan :global(.fx .beam){stroke:rgba(255,241,168,.25);stroke-width:.25;fill:none}
  .plan :global(.fx .mbd){fill:#dfe6ea;stroke:#93a5b2;stroke-width:.03}.plan :global(.fx .crs){stroke:#ff5a6e;stroke-width:.14;fill:none}
  .plan :global(.fx .pod){fill:#1d2a35;stroke:#9fd8e6;stroke-width:.05}.plan :global(.fx .podg){fill:rgba(160,230,255,.35);stroke:#bff8ff;stroke-width:.03}
  .plan :global(.fx .drl){fill:#2a2a26;stroke:#d2a020;stroke-width:.05}.plan :global(.fx .bin){fill:#1a2028;stroke:#6f879b;stroke-width:.04}
  .plan :global(.fx .binf){fill:#0e1319;stroke:none}.plan :global(.fx .oreg){fill:#ffb547;stroke:#fff1d0;stroke-width:.02}.plan :global(.fx .scrr){fill:#6a3d2a;stroke:#a5634a;stroke-width:.02}.plan :global(.fx .curt){stroke:#7fb6c9;stroke-width:.05;stroke-dasharray:.08 .05}.plan :global(.fx .sht){fill:#9fb9c9;stroke:none;opacity:.85}.plan :global(.fx .olamp){fill:rgba(255,241,200,.08);stroke:#fff1c8;stroke-width:.03;stroke-dasharray:.06 .06}.plan :global(.fx .gauge){fill:#141a20;stroke:#ffb547;stroke-width:.03}
  .plan :global(.fx .ore){fill:#6b5a46;stroke:#a88b62;stroke-width:.02}.plan :global(.fx .scrp){fill:#4d555c;stroke:#8a959e;stroke-width:.02}
  .plan :global(.fx .hid){stroke:rgba(210,160,32,.35);stroke-width:.03;stroke-dasharray:.1 .1}.plan :global(.fx .hatch){stroke:#d2a020;stroke-width:.04;opacity:.6}
  .plan :global(.fx .pad){fill:none;stroke:#ffb547;stroke-width:.06;stroke-dasharray:.4 .2}.plan :global(.fx .veh){fill:#2a3542;stroke:#a3b7c7;stroke-width:.05}.plan :global(.fx .skid){fill:#0d1116;stroke:#7fa6bb;stroke-width:.03}.plan :global(.fx .skidp){fill:#0d1116;stroke:#ffb547;stroke-width:.03}
  .plan :global(.fx .tool){fill:#33404c;stroke:#93a9ba;stroke-width:.02}.plan :global(.fx .gls){fill:rgba(95,240,255,.15);stroke:#9fe8f5;stroke-width:.03}
  .plan :global(.fx .rmp){fill:#15191d;stroke:#d2a020;stroke-width:.04}.plan :global(.fx .chev){fill:none;stroke:#d2a020;stroke-width:.08}.plan :global(.fx .hz2){stroke:#ff5a6e;stroke-width:.12}
  .gear line{stroke:#5b7487;stroke-width:.07;stroke-linecap:round}.gear .pis{stroke:#9fd8ea;stroke-width:.12}.gear .gbay{fill:url(#p-haz);opacity:.45;stroke:#33485a;stroke-width:.03}.gear .pad{fill:#0e161d;stroke:#7fa6bb;stroke-width:.05}.gear.heavy .pad{stroke:#c98a5a;stroke-width:.07}.gear.heavy line{stroke-width:.11}.gear.sleek .pad{stroke:#9ff6ff}.gear .pgl{fill:#5ff0ff}.gear.scrap .pad{stroke:#8f7d62}.gear.scrap .pgl{fill:#ffb547}.gear.craft .pad{stroke:#ffb547}
  .noz path{fill:#1e2833;stroke:#8aa4b8;stroke-width:.05}.noz circle{opacity:.8}
  .hin{fill:none;stroke:rgba(140,170,190,.18);stroke-width:.03;stroke-dasharray:.6 .15}
  .rv{fill:#3d5466}.rl-a{fill:#ffb547;filter:url(#glow);animation:blink 2.6s ease-in-out infinite}.rl-c{fill:#bff8ff;filter:url(#glow)}
  @keyframes blink{0%,100%{opacity:.35}50%{opacity:1}}
  .lit{fill:url(#g-lit);pointer-events:none}
  .pin.full .pr{animation:pop .6s ease-out}
  @keyframes pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.35);opacity:1}100%{transform:scale(1)}}
  .fls button,.tg{position:relative;overflow:hidden;clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)}
  .fls button::after,.tg::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.22) 50%,transparent 70%);transform:translateX(-110%)}
  .fls button:hover::after,.tg:hover::after{transform:translateX(110%);transition:transform .55s ease-out}
  /* üst çubuk */
  .bar{position:absolute;left:50%;transform:translateX(-50%);bottom:18px;display:flex;gap:8px;align-items:center;padding:6px 8px;background:rgba(3,8,14,.85);border:1px solid rgba(0,240,255,.22);backdrop-filter:blur(4px)}
  .fls{display:flex;gap:2px}.fls button,.tg{font:inherit;font-family:var(--f-mono);font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;white-space:nowrap;padding:6px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:#9fc6d4;cursor:pointer;transition:all .18s}
  .fls button.on,.tg.on{color:#04080f;background:#5ff0ff;border-color:#5ff0ff}.fls button:hover:not(.on),.tg:hover:not(.on){border-color:#5ff0ff;color:#e9fbff}
  .fls i{font-style:normal;margin-left:6px;padding:0 5px;background:#ffb547;color:#120c02;border-radius:6px}
  .hint{font-size:11.5px;color:#6f8a99;margin-left:6px;white-space:nowrap}
  /* oda fotoğrafı */
  .rp{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,56vw);background:#050a11;border:1px solid rgba(95,240,255,.45);box-shadow:0 0 0 1px rgba(0,0,0,.6),0 20px 60px rgba(0,0,0,.7);cursor:default;animation:rpin .28s cubic-bezier(.2,.8,.2,1)}
  @keyframes rpin{from{opacity:0;transform:translate(-50%,-48%);clip-path:inset(0 0 100% 0)}to{opacity:1;transform:translate(-50%,-50%);clip-path:inset(0 0 0 0)}}
  .ri{position:relative;aspect-ratio:16/9;overflow:hidden}.ri img{width:100%;height:100%;object-fit:cover;display:block}.rgr{position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,#050a11)}
  .rt{padding:4px 18px 16px;margin-top:-54px;position:relative}.rt span{font-size:10.5px;letter-spacing:.24em;color:#5ff0ff}.rt h3{margin:4px 0 6px;font-size:26px;font-weight:600;color:#f2f7fa}
  .rt p{font-size:11px;letter-spacing:.2em;color:#ffb547;margin:6px 0}.cg{display:flex;justify-content:space-between;font-size:14px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06)}.cg span{color:#9fc6d4;font-family:var(--f-mono)}.mut{color:#6f8a99}
  .x{position:absolute;top:8px;right:8px;width:32px;height:32px;background:rgba(3,8,14,.8);border:1px solid rgba(95,240,255,.4);color:#e9fbff;font-size:20px;cursor:pointer}.x:hover{background:#ff2a55;border-color:#ff2a55}
</style>
