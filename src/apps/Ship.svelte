<script lang="ts">
  // Docked & Loaded: gemi özelleştirme uygulaması. Şimdilik tek kayıtlı gemi (Demir Kervan). Hologram + iç plan + bölme fotoğrafları + dorse modülleri. Değerleri DM yazar (world/ship).
  import { onMount } from 'svelte';
  import { ShipScene } from '../ship/scene';
  import { DEFAULT_SHIP, KINDS, ROOMS, MAX_TRAILERS, roomImg, type ShipState, type Room } from '../ship/data';
  import { openImage } from '../lib/lightbox.svelte';
  import { watchDoc } from '../lib/live';
  import { session } from '../lib/session.svelte';
  import { sfx, ambient } from '../lib/sfx';
  const isDM = session.user?.role === 'dm';
  let host: HTMLDivElement | undefined = $state(), ov: HTMLDivElement | undefined = $state(), sc: ShipScene | null = null;
  let ship = $state<ShipState>({ ...DEFAULT_SHIP }), sel = $state<string | null>(null), hov = $state<string | null>(null), inside = $state(false), room = $state<Room | null>(null);
  let boot = $state(0), lines = $state<string[]>([]), err = $state('');
  const tr = $derived(sel && sel !== 'cab' ? ship.trailers.find((t) => t.id === sel) ?? null : null);
  const totCargo = $derived(ship.cargo + ship.trailers.reduce((a, t) => a + (t.cargo || 0), 0));
  const totCap = $derived(ship.cargoMax + ship.trailers.reduce((a, t) => a + (t.cargoMax || 0), 0));
  const pct = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);
  const fmt = (n: number) => (Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  const BOOT = ['LİMAN BAĞLANTISI KURULUYOR…', 'GEMİ SİCİLİ SORGULANIYOR', '1 KAYITLI GEMİ BULUNDU', 'SEÇİLİ GEMİ YÜKLENİYOR · DEMİR KERVAN', 'HOLOGRAM HAZIR'];
  const photo = (k: string | undefined, n: string) => { if (!k) return; sfx.click(); openImage(roomImg(k), (ship.name || 'Demir Kervan') + ' · ' + n); };
  function ovClick(e: MouseEvent) { const el = (e.target as HTMLElement).closest('.sh-lbl.room') as HTMLElement | null; if (el?.dataset.img) photo(el.dataset.img, el.textContent || ''); }
  onMount(() => {
    let alive = true; const stopAmb = ambient('ship'); sfx.ignite();
    BOOT.forEach((l, i) => setTimeout(() => { if (alive) { lines = [...lines, l]; sfx.key(); } }, 180 + i * 330));
    setTimeout(() => { if (alive) boot = 1; }, 1900); setTimeout(() => { if (alive) boot = 2; }, 2500);
    try { sc = new ShipScene(host!, ov!, { hover: (id) => { if (id !== hov && id) sfx.hover(); hov = id; }, select: (id) => pick(id) }); }
    catch (e) { err = 'Hologram başlatılamadı (WebGL).'; }
    let prevN = -1;
    const stop = watchDoc<Partial<ShipState>>(['world', 'ship'], (v) => { ship = { ...DEFAULT_SHIP, ...(v ?? {}), trailers: (v?.trailers ?? []).slice(0, MAX_TRAILERS) };
      if (prevN >= 0 && ship.trailers.length > prevN) sfx.clamp(); prevN = ship.trailers.length;
      sc?.setTrailers(ship.trailers); if (sel && sel !== 'cab' && !ship.trailers.some((t) => t.id === sel)) pick(null); });
    sc?.setTrailers(ship.trailers);
    const esc = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (room) { room = null; e.stopImmediatePropagation(); } else if (sel) { pick(null); e.stopImmediatePropagation(); } };
    addEventListener('keydown', esc, true);
    return () => { alive = false; stop(); stopAmb(); removeEventListener('keydown', esc, true); sc?.dispose(); sc = null; };
  });
  function pick(id: string | null) { if (id === sel && id) return; sel = id; room = null; if (id) sfx.click(); sc?.focus(id); }
  function toggleInside() { inside = !inside; sc?.setInterior(inside); sfx.glitch(); room = null; }
  // yan kesit planı (kabin): x −12…14, y 2.5…13.5
  const PX = (x: number) => ((x + 12.2) / 26.6) * 520, PY = (y: number) => 150 - ((y - 2.4) / 11.2) * 140;
</script>

<div class="sp" class:ready={boot === 2}>
  <div class="gl" bind:this={host}></div>
  <div class="ov" bind:this={ov} onclick={ovClick} role="presentation"></div>
  <div class="vig"></div><div class="scan"></div>

  {#if boot < 2}
    <div class="boot" class:out={boot === 1}>
      <div class="bt mono"><span class="g" data-t="DOCKED &amp; LOADED">DOCKED &amp; LOADED</span></div>
      <div class="bl mono">{#each lines as l, i (i)}<div>&gt; {l}</div>{/each}</div>
      <div class="bar"><i></i></div>
    </div>
  {/if}

  <header class="hd">
    <div class="ttl"><span class="g" data-t="DOCKED &amp; LOADED">DOCKED &amp; LOADED</span><em class="mono">GEMİ ÖZELLEŞTİRME · SEÇİLİ GEMİ</em></div>
    <div class="nm">{ship.name || 'Demir Kervan'}</div>
    <div class="own mono">TEK ÖRNEK · ÖZEL YAPIM UZAY ÇEKİCİSİ · SAHİBİ AVGRİDT VEDARRİM GARDABATKİN · HROTHMAR KLANI</div>
  </header>

  <aside class="pan left">
    <div class="h mono">MODÜLLER</div>
    <button class="mod" class:on={sel === 'cab'} class:hv={hov === 'cab'} onclick={() => pick('cab')}><b class="mono">00</b><span>Çekici kabin<small>kokpit · yaşam · motorlar</small></span></button>
    {#each Array(MAX_TRAILERS) as _, i (i)}
      {@const t = ship.trailers[i]}
      {#if t}<button class="mod" class:on={sel === t.id} class:hv={hov === t.id} onclick={() => pick(t.id)}><b class="mono">{String(i + 1).padStart(2, '0')}</b><span>{t.name || KINDS[t.kind]?.name}<small>{KINDS[t.kind]?.name}</small></span></button>
      {:else}<div class="mod empty"><b class="mono">{String(i + 1).padStart(2, '0')}</b><span>Boş bağlantı yuvası<small>dorse bağlı değil</small></span></div>{/if}
    {/each}
    <div class="h mono">GÖRÜNÜM</div>
    <div class="seg"><button class:on={!inside} onclick={() => inside && toggleInside()}>Dış gövde</button><button class:on={inside} onclick={() => !inside && toggleInside()}>İç plan</button></div>
    <button class="ovw mono" onclick={() => pick(null)}>⌖ GENEL BAKIŞ</button>
    {#if isDM}<p class="dmh">Değerleri ve dorseleri DM Paneli → Gemi sekmesinden düzenlersin.</p>{/if}
  </aside>

  <aside class="pan right">
    {#if tr}
      <div class="k mono">DORSE · {KINDS[tr.kind]?.name.toLocaleUpperCase('tr')}</div>
      <h2>{tr.name || KINDS[tr.kind]?.name}</h2>
      <p class="d">{KINDS[tr.kind]?.desc}</p>
      {@render bar('Gövde', tr.hp, tr.hpMax, 'hp')}
      {@render bar('Yük', tr.cargo, tr.cargoMax, 'cg', ' t')}
      <div class="rooms"><div class="h mono">BÖLMELER</div>{#each KINDS[tr.kind]?.rooms ?? [] as r (r.n)}<button class="rp" title="Fotoğrafı aç" onclick={() => photo(r.img, r.n)}>{r.n} <i>▣</i></button>{/each}</div>
      {#if tr.note}<p class="note">{tr.note}</p>{/if}
    {:else}
      <div class="k mono">GEMİ DURUMU</div>
      <h2>{ship.name || 'Demir Kervan'}</h2>
      {@render bar('Gövde', ship.hp, ship.hpMax, 'hp')}
      {@render bar('Kalkan', ship.sh, ship.shMax, 'sh')}
      {@render bar('Yakıt', ship.fuel, ship.fuelMax, 'fu')}
      {@render bar('Toplam yük', totCargo, totCap, 'cg', ' t')}
      <table><tbody>
        <tr><td>Yakıt türü</td><td>{ship.fuelType}</td></tr>
        <tr><td>Kabin yükü</td><td>{fmt(ship.cargo)} / {fmt(ship.cargoMax)} t</td></tr>
        <tr><td>Dorseler</td><td>{ship.trailers.length} / {MAX_TRAILERS} bağlı</td></tr>
        <tr><td>İtki</td><td><b class="good">Çok güçlü</b> · Skarn motorları</td></tr>
        <tr><td>Manevra</td><td><b class="bad">Zayıf</b> · ağır ve geniş dönüşlü</td></tr>
        <tr><td>Azami hız</td><td>{ship.speed}</td></tr>
      </tbody></table>
      {#if ship.note}<p class="note">{ship.note}</p>{/if}
    {/if}
  </aside>

  {#if inside}
    <section class="plan">
      <div class="h mono">KABİN İÇ PLANI · YAN KESİT <small>odaya tıkla</small></div>
      <svg viewBox="0 0 520 156">
        <path class="hull" d={`M${PX(12.5)},${PY(2.6)} L${PX(12.5)},${PY(7.2)} L${PX(4.6)},${PY(8.1)} L${PX(2.6)},${PY(12)} L${PX(-3.2)},${PY(12.4)} L${PX(-3.6)},${PY(13.2)} L${PX(-8)},${PY(13.2)} L${PX(-8)},${PY(6.4)} L${PX(-12)},${PY(6.4)} L${PX(-12)},${PY(2.6)} Z`} />
        <line class="deck" x1={PX(-8)} x2={PX(4.6)} y1={PY(7.5)} y2={PY(7.5)} />
        {#each ROOMS as r (r.id)}
          <g class="rm" class:on={room?.id === r.id} role="button" tabindex="0" onclick={() => { room = r; sfx.click(); }} onkeydown={(e) => e.key === 'Enter' && (room = r)}>
            <rect x={PX(r.x0)} y={PY(r.y1)} width={PX(r.x1) - PX(r.x0)} height={PY(r.y0) - PY(r.y1)} />
            <text x={(PX(r.x0) + PX(r.x1)) / 2} y={(PY(r.y0) + PY(r.y1)) / 2 + 3}>{r.n}</text>
          </g>
        {/each}
        <text class="lbl" x={PX(-8) + 4} y={PY(7.5) - 4}>ÜST GÜVERTE</text><text class="lbl" x={PX(-8) + 4} y={PY(2.6) - 4}>ALT GÜVERTE</text>
      </svg>
      {#if room}<div class="rd ph"><button class="th" title="Büyüt" onclick={() => photo(room!.id, room!.n)}><img src={roomImg(room.id)} alt={(ship.name || 'Demir Kervan') + ' · ' + room.n} /></button><div><b>{room.n}</b> {room.d}<small class="mono">FOTOĞRAFA TIKLA · BÜYÜT</small></div></div>{:else}<div class="rd mut">Bir bölmeye tıkla: fotoğrafı ve açıklaması açılır. Hologramdaki bölme etiketleri de tıklanır.</div>{/if}
    </section>
  {/if}
  {#if err}<div class="err mono">{err}</div>{/if}
</div>

{#snippet bar(l: string, a: number, b: number, cls: string, unit = '')}
  <div class="st {cls}" class:low={pct(a, b) < 25}>
    <div class="sl"><span>{l}</span><b class="mono">{fmt(a)} / {fmt(b)}{unit}</b></div>
    <div class="track"><i style:width="{pct(a, b)}%"></i>{#each Array(10) as _, i (i)}<s style:left="{i * 10}%"></s>{/each}</div>
  </div>
{/snippet}

<style>
  .sp{position:absolute;inset:0;overflow:hidden;background:#03060c;color:var(--tx)}
  .gl{position:absolute;inset:0}.ov{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.65))}
  .scan{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,240,255,.025) 0 1px,transparent 1px 3px);mix-blend-mode:screen}
  .ov :global(.sh-lbl){position:absolute;left:0;top:0;font-family:var(--f-mono);font-size:11px;letter-spacing:.12em;color:#ffcf7a;white-space:nowrap;padding:2px 6px;background:rgba(10,8,2,.55);border:1px solid rgba(255,181,71,.35)}
  .ov :global(.sh-lbl.tr){color:#9ff6ff;border-color:rgba(0,240,255,.35);background:rgba(2,10,14,.55);font-size:12px}
  .ov :global(.sh-lbl.on){color:#fff;border-color:#fff;box-shadow:0 0 10px rgba(0,240,255,.5)}
  .g{position:relative;display:inline-block}
  .g::before,.g::after{content:attr(data-t);position:absolute;inset:0;pointer-events:none}
  .g::before{color:#ff2a55;clip-path:inset(0 0 55% 0);animation:g1 3.2s steps(1) infinite}
  .g::after{color:#fcee0a;clip-path:inset(60% 0 0 0);animation:g2 4.1s steps(1) infinite}
  @keyframes g1{0%,90%,100%{opacity:0;transform:none}91%{opacity:.85;transform:translate(-3px,-1px)}94%{opacity:.6;transform:translate(3px,1px)}}
  @keyframes g2{0%,85%,100%{opacity:0;transform:none}86%{opacity:.8;transform:translate(3px,0)}89%{opacity:.5;transform:translate(-2px,1px)}}
  .boot{position:absolute;inset:0;z-index:20;background:#02040a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;transition:opacity .6s,filter .6s}
  .boot.out{opacity:0;filter:blur(6px) hue-rotate(60deg)}
  .bt{font-family:var(--f-disp);font-size:44px;font-weight:700;letter-spacing:.4em;color:var(--cy);text-shadow:0 0 22px rgba(0,240,255,.6);animation:bz .5s steps(4) 3}
  @keyframes bz{50%{transform:skewX(-8deg) translateX(6px);filter:hue-rotate(90deg)}}
  .bl{font-size:12.5px;letter-spacing:.16em;color:#8fe9ff;min-height:110px;width:min(520px,80vw)}.bl div{animation:fi .2s both}@keyframes fi{from{opacity:0;transform:translateX(-8px)}}
  .bar{width:min(520px,80vw);height:3px;background:rgba(0,240,255,.15)}.bar i{display:block;height:100%;background:var(--cy);box-shadow:0 0 10px var(--cy);animation:ld 1.8s cubic-bezier(.6,0,.3,1) forwards}@keyframes ld{from{width:0}to{width:100%}}
  .hd{position:absolute;top:56px;left:22px;z-index:4;pointer-events:none;opacity:0;transition:opacity .8s .2s}
  .ready .hd,.ready .pan,.ready .plan{opacity:1}
  .ttl{display:flex;align-items:baseline;gap:14px}.ttl .g{font-family:var(--f-disp);font-weight:700;font-size:30px;letter-spacing:.32em;color:var(--cy);text-shadow:0 0 16px rgba(0,240,255,.45)}
  .ttl em{font-style:normal;font-size:10.5px;letter-spacing:.2em;color:var(--ye)}
  .nm{font-size:19px;color:#fff;margin-top:4px}.own{font-size:10.5px;letter-spacing:.16em;color:var(--mut);margin-top:4px}
  .pan{position:absolute;z-index:4;background:rgba(4,8,14,.78);border:1px solid rgba(0,240,255,.2);backdrop-filter:blur(6px);padding:14px;opacity:0;transition:opacity .8s .35s;
    clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
  .left{left:22px;top:170px;width:250px;display:flex;flex-direction:column;gap:6px;max-height:calc(100% - 200px);overflow:auto}
  .right{right:22px;top:70px;width:330px;max-height:calc(100% - 100px);overflow:auto}
  .h{font-size:10.5px;letter-spacing:.22em;color:var(--mut);margin:6px 0 2px}.h small{color:#6b7488;letter-spacing:.1em;margin-left:8px}
  .mod{display:flex;align-items:center;gap:10px;text-align:left;background:rgba(0,240,255,.04);border:1px solid rgba(0,240,255,.14);color:var(--tx);padding:8px 10px;font:inherit;cursor:pointer}
  .mod b{font-size:11px;color:var(--ye)}.mod span{display:flex;flex-direction:column;font-size:14px}.mod small{font-size:11px;color:var(--mut)}
  .mod:hover,.mod.hv{border-color:rgba(0,240,255,.5)}.mod.on{border-color:var(--cy);background:rgba(0,240,255,.12);box-shadow:inset 3px 0 0 var(--cy)}
  .mod.empty{opacity:.45;border-style:dashed;cursor:default}
  .seg{display:grid;grid-template-columns:1fr 1fr;gap:4px}.seg button{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.12);color:var(--tx);padding:7px;font:inherit;font-size:13px;cursor:pointer}
  .seg button.on{border-color:var(--ye);color:var(--ye);background:rgba(252,238,10,.08)}
  .ovw{margin-top:6px;background:none;border:1px solid rgba(0,240,255,.3);color:var(--cy);padding:7px;font-size:11px;letter-spacing:.2em;cursor:pointer}
  .dmh{font-size:12px;color:#ff8aa0;margin:8px 0 0;line-height:1.4}
  .k{font-size:10.5px;letter-spacing:.22em;color:var(--ye)}h2{margin:4px 0 12px;font-size:22px;font-weight:600;color:#fff}
  .d{font-size:14px;color:#c4cbd8;line-height:1.5;margin:0 0 12px}
  .st{margin:10px 0}.sl{display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px}.sl b{font-size:12px;color:#fff}
  .track{position:relative;height:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}.track i{position:absolute;inset:0 auto 0 0;transition:width .6s}
  .track s{position:absolute;top:0;bottom:0;width:1px;background:rgba(0,0,0,.5)}
  .hp i{background:linear-gradient(90deg,#1fd17a,#7ee787)}.sh i{background:linear-gradient(90deg,#1aa3ff,#6cd6ff)}.fu i{background:linear-gradient(90deg,#ff8a1f,#ffc04d)}.cg i{background:linear-gradient(90deg,#9b6bff,#c9a6ff)}
  .st.low .track i{background:#ff3355;animation:bl 1s steps(2) infinite}@keyframes bl{50%{opacity:.5}}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}td{padding:6px 0;border-top:1px solid rgba(255,255,255,.06);vertical-align:top}td:first-child{color:var(--mut);width:42%}
  .good{color:#7ee787;font-weight:500}.bad{color:#ff8a8a;font-weight:500}
  .rooms{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px}.rooms .h{width:100%}.rooms span{font-size:12.5px;border:1px solid rgba(255,181,71,.4);color:#ffcf7a;padding:3px 8px}
  .note{font-size:13.5px;color:#d6dbe5;line-height:1.5;border-left:2px solid var(--ye);padding-left:10px;margin-top:14px;white-space:pre-wrap}
  .plan{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:4;width:min(600px,calc(100% - 660px));min-width:420px;background:rgba(4,8,14,.82);border:1px solid rgba(255,181,71,.3);padding:10px 14px;opacity:0;transition:opacity .5s}
  .plan svg{width:100%;height:auto;display:block}
  .hull{fill:rgba(0,240,255,.04);stroke:#33e6ff;stroke-width:1.2}.deck{stroke:#33e6ff;stroke-dasharray:4 3;opacity:.6}
  .rm rect{fill:rgba(255,181,71,.08);stroke:#ffb547;stroke-width:1;cursor:pointer;transition:fill .15s}.rm:hover rect,.rm.on rect{fill:rgba(255,181,71,.3)}
  .rm text{fill:#ffe2b0;font-size:9.5px;text-anchor:middle;pointer-events:none;font-family:var(--f-mono)}
  .lbl{fill:#6fc9dc;font-size:7.5px;letter-spacing:.15em;font-family:var(--f-mono)}
  .rd{font-size:13.5px;color:#e4e8f0;margin-top:6px;line-height:1.45}.rd b{color:#ffcf7a;margin-right:6px}.rd.mut{color:var(--mut)}
  .err{position:absolute;inset:auto 0 40% 0;text-align:center;color:#ff6b81;letter-spacing:.2em}
  .ov :global(.sh-lbl.room[data-img]){pointer-events:auto;cursor:pointer}.ov :global(.sh-lbl.room[data-img]:hover){color:#fff;border-color:#ffcf7a;box-shadow:0 0 10px rgba(255,181,71,.5)}
  .rp{background:rgba(255,181,71,.08);border:1px solid rgba(255,181,71,.35);color:#ffcf7a;padding:3px 8px;margin:0 6px 6px 0;font:inherit;font-size:12px;cursor:pointer}.rp:hover{background:rgba(255,181,71,.2);color:#fff}.rp i{font-style:normal;opacity:.7}
  .rd.ph{display:flex;gap:12px;align-items:flex-start}.rd .th{flex:0 0 150px;height:84px;padding:0;border:1px solid rgba(255,181,71,.45);background:#000;cursor:zoom-in;overflow:hidden}
  .rd .th img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}.rd .th:hover img{transform:scale(1.06)}.rd small{display:block;margin-top:4px;font-size:9.5px;letter-spacing:.18em;color:var(--mut)}
</style>
