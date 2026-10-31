<script lang="ts">
  // Rota hesaplayıcı paneli (küme görünümü).
  import type { MapData, SysData } from './scene';
  import type { ActiveEvent } from '../lib/events';
  import { laneRoute, direct, distLy, fmtDays, fmtYears, LY_PER_UNIT } from './route';
  import { sfx } from '../lib/sfx';
  let { map, known, ev, from = $bindable(''), onroute, onclose }: { map: MapData; known: (id: string) => boolean; ev: ActiveEvent[]; from?: string; onroute: (ids: string[] | null) => void; onclose: () => void } = $props();
  let to = $state(''), avoid = $state(false), beta = $state(0.95), accel = $state(true);
  const systems = $derived(map.systems.filter((s) => s.owner !== 'dm' && known(s.id)).sort((a, b) => a.name.localeCompare(b.name, 'tr')));
  const S = $derived(new Map(map.systems.map((s) => [s.id, s] as [string, SysData])));
  const ok = (id: string, a: string, b: string) => known(id) && known(a) && known(b) && S.get(a)?.owner !== 'dm' && S.get(b)?.owner !== 'dm';
  const lr = $derived(from && to && from !== to ? laneRoute(map, ok, from, to, ev, avoid) : null);
  const dd = $derived(from && to && from !== to ? distLy(S.get(from)!, S.get(to)!) : null);
  const dr = $derived(dd ? direct(dd.ly, beta, accel) : null);
  $effect(() => { onroute(lr ? lr.hops.map((h) => h.lane.id) : null); });
  const nm = (id: string) => S.get(id)?.name ?? '?';
  const ly = (x: number) => x.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  function swap() { const t = from; from = to; to = t; sfx.click(); }
</script>

<aside class="rt">
  <header><span class="mono t glitch" data-text="ROTA HESAPLAYICI">ROTA HESAPLAYICI</span><button class="x" onclick={onclose} aria-label="Kapat">✕</button></header>
  <div class="pick">
    <label><span class="mono">ÇIKIŞ</span><select bind:value={from}><option value="">Sistem seç</option>{#each systems as s (s.id)}<option value={s.id}>{s.name}</option>{/each}</select></label>
    <button class="sw" title="Yer değiştir" onclick={swap}>⇅</button>
    <label><span class="mono">VARIŞ</span><select bind:value={to}><option value="">Sistem seç</option>{#each systems as s (s.id)}<option value={s.id}>{s.name}</option>{/each}</select></label>
  </div>
  {#if from && to && from !== to}
    <section>
      <h4 class="mono">HİPERHAT <label class="ck"><input type="checkbox" bind:checked={avoid} /> tehlikeli hatlardan kaçın</label></h4>
      {#if lr}
        <div class="big">{fmtDays(lr.total)}</div>
        <div class="sub">{lr.hops.length} hat · taban {fmtDays(lr.base)}{#if lr.delays.length} · olay gecikmesi {fmtDays([lr.total[0] - lr.base[0], lr.total[1] - lr.base[1]])}{/if}</div>
        <ol class="hops">{#each lr.hops as h (h.lane.id)}<li class:dg={h.danger}><b>{nm(h.from)} → {nm(h.to)}</b><span>{h.lane.name} · {h.set ? fmtDays(h.set) + ' (olay nedeniyle, normalde ' + h.lane.days + ')' : h.lane.days}{#if h.danger} · tehlikeli{/if}</span></li>{/each}</ol>
        {#if lr.delays.length}<div class="mono h">AKTİF OLAYLAR</div>
          <ul class="dl">{#each lr.delays as d (d.ev.key)}<li><b>+{fmtDays(d.add)}</b> {d.ev.tpl.name} <small>({d.where === 'hat' ? 'hatta' : nm(d.ev.sys)})</small></li>{/each}</ul>{/if}
        <p class="nt">Yalnız hatlardaki yolculuk sayılır; geçitten gezegene sistem içi seyir dahil değil.</p>
      {:else}<p class="none">Bilinen açık hatlarla bu iki sistem arasında yol yok{avoid ? ' (tehlikeli hatlar hariç)' : ''}.</p>{/if}
    </section>
    {#if dd && dr}
    <section>
      <h4 class="mono">DOĞRUDAN · IŞIK ALTI</h4>
      <div class="sub">Düz çizgi uzaklık: <b>{ly(dd.ly)} ışık yılı</b> {#if dd.canon}<em class="ok">kanon uzaklığı</em>{:else}<em class="fl">haritadan tahmin</em>{/if}</div>
      <div class="sl"><span class="mono">HIZ</span><input type="range" min="0.9" max="0.99" step="0.01" bind:value={beta} /><b>{beta.toFixed(2).replace('.', ',')} c</b></div>
      <label class="ck"><input type="checkbox" bind:checked={accel} /> 1 g ile hızlan ve yavaşla</label>
      <div class="two">
        <div><span class="mono">EVREN ZAMANI</span><b>{fmtYears(dr.tU)}</b><small>dışarıda geçen süre</small></div>
        <div><span class="mono">GEMİ ZAMANI</span><b>{fmtYears(dr.tS)}</b><small>mürettebatın yaşadığı süre</small></div>
      </div>
      <div class="sub">Fark: <b>{fmtYears(Math.max(0, dr.tU - dr.tS))}</b> · γ = {dr.gamma.toFixed(2).replace('.', ',')}{#if accel && dr.peak < beta - 0.001} · yol kısa, en çok {dr.peak.toFixed(2).replace('.', ',')} c'ye çıkılır{/if}</div>
      <p class="nt">Işıktan hızlı yolculuk yok. Hatlar dışında en iyi gemiler 0,9–0,99 c'ye çıkar. Ölçek: 1 harita birimi ≈ {LY_PER_UNIT.toLocaleString('tr-TR')} ışık yılı (kanondaki Nys–Morwen ve Aurum–Kestrel uzaklıklarından türetildi; kesin değil).</p>
    </section>
    {/if}
  {:else}<p class="none">Çıkış ve varış sistemini seç. Hiperhat süresi ile doğrudan ışık-altı yolculuk yan yana hesaplanır.</p>{/if}
</aside>

<style>
  .rt{position:absolute;right:16px;top:64px;bottom:16px;width:390px;z-index:9;background:rgba(6,8,14,.92);border:1px solid rgba(252,238,10,.35);backdrop-filter:blur(6px);padding:12px 14px;overflow:auto;
    clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px));animation:rin .3s both}
  @keyframes rin{from{opacity:0;transform:translateX(30px)}}
  header{display:flex;align-items:center;margin-bottom:10px}.t{color:var(--ye);letter-spacing:.25em;font-size:12px}
  .x{margin-left:auto;background:none;border:1px solid rgba(255,42,85,.5);color:var(--rd);width:28px;height:24px;cursor:pointer}
  .pick{display:grid;grid-template-columns:1fr 30px 1fr;gap:6px;align-items:end}.pick label{display:flex;flex-direction:column;gap:3px}.pick span{font-size:10px;letter-spacing:.2em;color:var(--mut)}
  select{background:#10141d;border:1px solid rgba(0,240,255,.3);color:#fff;padding:5px;font:inherit;font-size:13px}
  .sw{height:30px;background:none;border:1px solid rgba(252,238,10,.4);color:var(--ye);cursor:pointer}
  section{margin-top:14px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px}
  h4{font-size:10.5px;letter-spacing:.22em;color:var(--cy);margin:0 0 6px;display:flex;align-items:center;gap:8px}
  .ck{font-size:12px;color:var(--mut);letter-spacing:0;font-family:var(--f-body,inherit);display:flex;gap:5px;align-items:center;margin-left:auto}section>.ck{margin:6px 0}
  .big{font-size:26px;color:#fff;font-weight:600}.sub{font-size:13px;color:var(--tx);margin:3px 0}
  .hops{margin:8px 0;padding-left:18px;font-size:13px}.hops li{margin:3px 0}.hops span{display:block;color:var(--mut);font-size:12px}.hops .dg b{color:#ff6b81}
  .h{font-size:10px;letter-spacing:.2em;color:var(--ye);margin-top:6px}.dl{margin:4px 0;padding-left:16px;font-size:12.5px}.dl b{color:var(--ye)}.dl small{color:var(--mut)}
  .sl{display:flex;align-items:center;gap:8px;margin:8px 0}.sl span{font-size:10px;letter-spacing:.2em;color:var(--mut)}.sl input{flex:1;accent-color:#fcee0a}.sl b{color:var(--ye);width:56px;text-align:right}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.two div{border:1px solid rgba(0,240,255,.2);padding:8px;display:flex;flex-direction:column}
  .two span{font-size:9.5px;letter-spacing:.2em;color:var(--mut)}.two b{font-size:18px;color:#fff;margin:3px 0}.two small{font-size:11px;color:var(--mut)}
  em{font-style:normal;font-size:11px;padding:1px 6px;margin-left:4px}.ok{color:#39ff8a;border:1px solid rgba(57,255,138,.4)}.fl{color:var(--ye);border:1px solid rgba(252,238,10,.4)}
  .nt{font-size:11.5px;color:var(--mut);line-height:1.45;margin:8px 0 0}.none{color:var(--mut);font-size:13px;margin-top:12px}
</style>
