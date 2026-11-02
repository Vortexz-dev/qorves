<script lang="ts">
  // Sağ üst canlı göstergeler: her zaman değer / sınır. "takarsan" önizlemesi gölge olarak.
  import type { Stats } from '../../ship/sys';
  let { s, p = null }: { s: Stats; p?: Stats | null } = $props();
  const tone = (r: number, a: number, b: number) => (r > b ? 'rd' : r >= a ? 'ye' : 'gr');
  const d = (a: number, b: number | undefined) => (b === undefined || b === a ? '' : (b > a ? '+' : '') + (b - a));
</script>
<div class="st">
  <div class="row big">
    <span class="k mono">MASS</span>
    <b class={tone(s.load, 0.7, 0.85)}>{s.mass}<i>/ {s.maxMass} t</i></b>
    {#if p}<em class:bad={p.mass > p.maxMass}>{p.mass} / {p.maxMass}</em>{/if}
    <div class="bar"><span class={tone(s.load, 0.7, 0.85)} style:width="{Math.min(100, s.load * 100)}%"></span>{#if p}<span class="gh" style:width="{Math.min(100, p.load * 100)}%"></span>{/if}</div>
    <small class="mono">LOAD %{Math.round(s.load * 100)}{#if p} → %{Math.round(p.load * 100)}{/if}</small>
  </div>
  <div class="row big">
    <span class="k mono">POWER</span>
    <b class={tone(s.powerOutput ? s.powerDraw / s.powerOutput : 2, 0.75, 0.9)}>{s.powerDraw}<i>/ {s.powerOutput}</i></b>
    {#if p}<em class:bad={p.powerDraw > p.powerOutput}>{p.powerDraw} / {p.powerOutput}</em>{/if}
    <div class="bar"><span class={tone(s.powerOutput ? s.powerDraw / s.powerOutput : 2, 0.75, 0.9)} style:width="{Math.min(100, (s.powerDraw / (s.powerOutput || 1)) * 100)}%"></span>{#if p}<span class="gh" style:width="{Math.min(100, (p.powerDraw / (p.powerOutput || 1)) * 100)}%"></span>{/if}</div>
    <small class="mono">DRAW / OUTPUT</small>
  </div>
  <div class="grid">
    <div><span class="k mono">MOBILITY</span><b>{s.mobility}<i>/ 100</i>{#if p && d(s.mobility, p.mobility)}<em class:bad={p.mobility < s.mobility}>{d(s.mobility, p.mobility)}</em>{/if}</b><small>{s.band} · pilot {s.pilot >= 0 ? '+' : ''}{s.pilot}</small></div>
    <div><span class="k mono">THRUST</span><b>{s.thrust}<i>t</i>{#if p && d(s.thrust, p.thrust)}<em>{d(s.thrust, p.thrust)}</em>{/if}</b><small>Max Mass = Thrust</small></div>
    <div><span class="k mono">DELTA-V</span><b>{s.deltaV}{#if p && d(s.deltaV, p.deltaV)}<em class:bad={p.deltaV < s.deltaV}>{d(s.deltaV, p.deltaV)}</em>{/if}</b><small>endeks</small></div>
    <div><span class="k mono">ENDURANCE</span><b>{s.endurance ?? '∞'}<i>{s.endurance === null ? '' : 'gün'}</i>{#if p && p.endurance !== null && s.endurance !== null && d(s.endurance, p.endurance)}<em class:bad={p.endurance < s.endurance}>{d(s.endurance, p.endurance)}</em>{/if}</b><small>{s.endurance === null ? 'füzyon reaktörü' : 'Skarnit ile'}</small></div>
    <div><span class="k mono">ARMOR</span><b>{s.armor}{#if p && d(s.armor, p.armor)}<em>{d(s.armor, p.armor)}</em>{/if}</b><small>gövde</small></div>
    <div><span class="k mono">SHIELD</span><b>{s.shield}{#if p && d(s.shield, p.shield)}<em>{d(s.shield, p.shield)}</em>{/if}</b><small>Regen {s.regen} / tur</small></div>
    <div><span class="k mono">CARGO</span><b>{s.cargoUsed}<i>/ {s.cargoCap} t</i>{#if p && d(s.cargoCap, p.cargoCap)}<em>{d(s.cargoCap, p.cargoCap)}</em>{/if}</b><small>{s.holds.length} ambar{#if s.holds.some((h) => h.hidden)} · gizli {s.holds.reduce((a, h) => a + h.hidden, 0)} t{/if}</small></div>
    <div><span class="k mono">SKARNİT</span><b>{s.skarnit}<i>/ {s.skarnitMax} t</i></b><small>yakıt · kütleye sayılır</small></div>
  </div>
  <div class="sl mono"><span>YUVALAR</span><b>TIR {s.slotsTruck[0]}/{s.slotsTruck[1]}</b><b>DORSE {s.slotsTrailer[0]}/{s.slotsTrailer[1]}</b></div>
  {#if Object.keys(s.traits).length}<div class="tr">{#each Object.entries(s.traits) as [k, v] (k)}<span class="mono">{k} +{v}</span>{/each}</div>{/if}
  {#if s.warnings.length}<div class="wr">{#each s.warnings as w (w)}<div>⚠ {w}</div>{/each}</div>{/if}
  {#if p}<div class="pv mono">TAKARSAN · ÖNİZLEME</div>{/if}
</div>
<style>
  .st{width:318px;padding:12px 14px;background:linear-gradient(160deg,rgba(4,12,20,.9),rgba(3,6,12,.86));border:1px solid rgba(0,240,255,.28);clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);display:flex;flex-direction:column;gap:9px;backdrop-filter:blur(5px)}
  .k{font-size:9.5px;letter-spacing:.28em;color:var(--mut)}
  .row{display:grid;grid-template-columns:auto 1fr auto;align-items:baseline;column-gap:10px;row-gap:4px}
  .row b{font-family:var(--f-disp);font-size:22px;color:#fff;text-align:right}.row b i,.grid b i{font-style:normal;font-family:var(--f-ui);font-size:13px;color:var(--mut);margin-left:4px}
  .row em{font-style:normal;font-size:12px;color:#9ff6ff;opacity:.75;font-family:var(--f-mono)}.row em.bad,.grid em.bad{color:var(--rd)}
  .bar{grid-column:1/-1;position:relative;height:5px;background:rgba(255,255,255,.07);overflow:hidden}
  .bar span{position:absolute;left:0;top:0;bottom:0;transition:width .45s cubic-bezier(.2,.9,.3,1)}.bar .gh{background:repeating-linear-gradient(90deg,rgba(255,255,255,.55) 0 3px,transparent 3px 6px);opacity:.6}
  .gr{color:#39ff8a}.ye{color:var(--ye)}.rd{color:var(--rd)}span.gr{background:#39ff8a}span.ye{background:var(--ye)}span.rd{background:var(--rd)}
  .row b.gr,.row b.ye,.row b.rd{text-shadow:0 0 12px currentColor}
  .row small{grid-column:1/-1;font-size:9.5px;letter-spacing:.2em;color:var(--mut)}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;border-top:1px solid rgba(0,240,255,.12);padding-top:9px}
  .grid div{display:flex;flex-direction:column;gap:1px}.grid b{font-family:var(--f-disp);font-size:17px;color:#e8fbff}.grid em{font-style:normal;font-size:11px;color:#9ff6ff;margin-left:6px;font-family:var(--f-mono)}
  .grid small{font-size:11.5px;color:var(--mut)}
  .sl{display:flex;gap:10px;align-items:center;font-size:9.5px;letter-spacing:.22em;color:var(--mut);border-top:1px solid rgba(0,240,255,.12);padding-top:8px}.sl b{color:#cfe;font-weight:400}
  .tr{display:flex;flex-wrap:wrap;gap:4px}.tr span{font-size:10.5px;padding:2px 6px;border:1px solid rgba(57,255,138,.35);color:#9dffc4}
  .wr{font-size:12px;color:var(--ye);display:flex;flex-direction:column;gap:2px}
  .pv{font-size:9.5px;letter-spacing:.3em;color:#9ff6ff;text-align:center;opacity:.8;animation:bk 1.2s steps(2) infinite}@keyframes bk{50%{opacity:.35}}
</style>
