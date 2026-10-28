<script lang="ts">
  // Olay kontrolü: sistem/hatta olay başlat-bitir, süre, özel resmî yayın. world/events üzerinden herkese canlı yansır.
  import { onMount } from 'svelte';
  import { dm, sysName, when } from './store.svelte';
  import { watchDoc, setEvents } from '../../lib/live';
  import { loadEvents, activeAt, setWorldLive, type EvData, type ActiveEvent } from '../../lib/events';
  import type { WorldEvents, EventOverride } from '../../lib/backend';
  import { sfx } from '../../lib/sfx';
  let w = $state<WorldEvents | null>(null), evd = $state<EvData | null>(null), act = $state<ActiveEvent[]>([]), t = $state(Date.now());
  let sys = $state(''), lane = $state(''), tpl = $state('custom'), dur = $state(60), name = $state(''), msgT = $state(''), eff = $state(''), by = $state(''), sev = $state(2), cat = $state('GUV'), msg = $state('');
  const lanes = $derived(dm.lanes.filter((l) => l.a === sys || l.b === sys));
  const T = $derived(evd?.templates.find((x) => x.id === tpl));
  $effect(() => { const x = T; if (x) { name = x.name; msgT = x.msg; eff = x.effect; by = x.by; sev = x.sev; cat = x.cat; } });
  const refresh = () => { t = Date.now(); if (evd) act = activeAt(t, dm.systems); };
  onMount(() => {
    let off = () => {};
    (async () => { evd = await loadEvents(dm.systems, dm.lanes); off = watchDoc<WorldEvents>(['world', 'events'], (v) => { w = v; setWorldLive(v); refresh(); }); })();
    const iv = setInterval(refresh, 10000);
    return () => { off(); clearInterval(iv); };
  });
  $effect(() => { if (!sys && dm.systems[0]) sys = dm.systems[0].id; });
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 4000); };
  async function start() {
    if (!sys || dur < 1) return; const s = Date.now();
    const o: EventOverride = { tpl, sys, start: s, end: s + dur * 60000, name: name.trim(), msg: msgT.trim(), effect: eff.trim(), by: by.trim(), sev: +sev, cat };
    if (lane) o.lane = lane;
    const keep = (w?.overrides ?? []).filter((x) => x.end > Date.now());
    try { await setEvents({ overrides: [...keep, o] }); sfx.alarm(); flash(`Yayında: ${o.name || T?.name} · ${sysName(sys)} · ${dur} dk`); } catch (e) { sfx.error(); flash('Hata: ' + String(e)); }
  }
  async function end(e: ActiveEvent) {
    try {
      if (e.forced) await setEvents({ overrides: (w?.overrides ?? []).filter((x) => `ovr:${x.tpl}:${x.sys}:${x.start}` !== e.key && x.end > Date.now()) });
      else await setEvents({ cleared: [...new Set([...(w?.cleared ?? []), e.key])].slice(-300) });
      sfx.click(); flash('Olay bitirildi: ' + e.tpl.name);
    } catch (x) { sfx.error(); flash('Hata: ' + String(x)); }
  }
  async function extend(e: ActiveEvent, m: number) { await setEvents({ overrides: (w?.overrides ?? []).map((x) => (`ovr:${x.tpl}:${x.sys}:${x.start}` === e.key ? { ...x, end: x.end + m * 60000 } : x)) }); sfx.click(); }
  const left = (e: ActiveEvent) => Math.max(1, Math.ceil((e.end - t) / 60000));
</script>
<div class="ev">
  <form class="fm" onsubmit={(e) => { e.preventDefault(); start(); }}>
    <h4 class="mono">YENİ OLAY / RESMÎ YAYIN</h4>
    <div class="r2">
      <label class="field"><span>Sistem</span><select class="inp" bind:value={sys}>{#each dm.systems as s (s.id)}<option value={s.id}>{s.name}{s.owner === 'dm' ? ' (gizli)' : ''}</option>{/each}</select></label>
      <label class="field"><span>Hat (isteğe bağlı)</span><select class="inp" bind:value={lane}><option value="">— sistemin tamamı —</option>{#each lanes as l (l.id)}<option value={l.id}>{l.name}</option>{/each}</select></label>
    </div>
    <div class="r2">
      <label class="field"><span>Şablon</span><select class="inp" bind:value={tpl}><option value="custom">✎ Özel resmî yayın</option>{#each Object.entries(evd?.cats ?? {}) as [c, cn] (c)}<optgroup label={cn}>{#each evd?.templates.filter((x) => x.cat === c) ?? [] as x (x.id)}<option value={x.id}>{x.name}</option>{/each}</optgroup>{/each}</select></label>
      <label class="field"><span>Süre (dakika)</span><input class="inp" type="number" min="1" max="10080" bind:value={dur} /></label>
    </div>
    <label class="field"><span>Başlık</span><input class="inp" bind:value={name} maxlength="80" placeholder="ör. Kapı karantinası" /></label>
    <label class="field"><span>Yayın metni</span><textarea class="inp" rows="4" bind:value={msgT} maxlength="1200" placeholder="Oyuncuların göreceği resmî duyuru"></textarea></label>
    <label class="field"><span>Etki (isteğe bağlı)</span><input class="inp" bind:value={eff} maxlength="300" /></label>
    <div class="r3">
      <label class="field"><span>Yayınlayan</span><input class="inp" bind:value={by} maxlength="60" placeholder="Ortak Hat Yayın Ağı" /></label>
      <label class="field"><span>Seviye</span><select class="inp" bind:value={sev}>{#each Object.entries(evd?.sev ?? {}) as [k, v] (k)}<option value={+k}>{v.label}</option>{/each}</select></label>
      <label class="field"><span>Kategori</span><select class="inp" bind:value={cat}>{#each Object.entries(evd?.cats ?? {}) as [k, v] (k)}<option value={k}>{v}</option>{/each}</select></label>
    </div>
    <div class="act"><button class="btn" disabled={!sys || (!msgT.trim() && tpl === 'custom')}>Yayını başlat</button>{#if msg}<span class="msg mono">{msg}</span>{/if}</div>
    <label class="ck"><input type="checkbox" checked={!!w?.paused} onchange={(e) => setEvents({ paused: (e.target as HTMLInputElement).checked })} />Rastgele olayları duraklat (yalnız DM olayları görünür)</label>
  </form>
  <div class="ls">
    <h4 class="mono">ŞU AN ETKİN ({act.length})</h4>
    {#each [...act].sort((a, b) => Number(!!b.forced) - Number(!!a.forced) || b.tpl.sev - a.tpl.sev) as e (e.key)}{@const sv = evd?.sev[e.tpl.sev]}
      <div class="it" style:--sv={sv?.color}>
        <div class="h mono"><b>{sv?.label}</b><span>{sysName(e.sys)}{#if e.lane} · {dm.lanes.find((l) => l.id === e.lane)?.name}{/if}</span><span class="t">kalan {left(e)} dk</span>{#if e.forced}<em>DM</em>{/if}</div>
        <div class="n">{e.tpl.name}</div><p>{e.tpl.msg}</p>
        <div class="b">{#if e.forced}<button class="btn ghost small" onclick={() => extend(e, 30)}>+30 dk</button>{/if}<button class="btn red small" onclick={() => end(e)}>Bitir</button><small class="mono">{when(e.start)} → {when(e.end)}</small></div>
      </div>
    {:else}<div class="none mono">Etkin olay yok.</div>{/each}
  </div>
</div>
<style>
  .ev{display:grid;grid-template-columns:440px 1fr;gap:16px;height:100%;min-height:0;padding:12px 16px}
  .fm{display:flex;flex-direction:column;gap:8px;overflow:auto;padding-right:6px}
  .r2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.r3{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:8px}
  textarea.inp{resize:vertical;font-family:var(--f-ui)}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:0 0 4px}
  .act{display:flex;gap:10px;align-items:center}.msg{font-size:11.5px;color:#39ff8a}
  .ck{display:flex;gap:6px;align-items:center;font-size:13px;color:var(--mut)}
  .ls{overflow:auto;display:flex;flex-direction:column;gap:8px}
  .it{border:1px solid color-mix(in srgb,var(--sv) 50%,transparent);border-left:3px solid var(--sv);padding:8px 10px;background:rgba(0,0,0,.25)}
  .h{display:flex;gap:10px;font-size:10.5px;color:var(--mut)}.h b{color:var(--sv)}.h .t{margin-left:auto}.h em{font-style:normal;color:#000;background:var(--ye);padding:0 5px}
  .n{font-size:16px;color:#fff;margin:3px 0}.it p{font-size:13px;color:#c9d6e2;line-height:1.4;margin:0 0 6px}
  .b{display:flex;gap:6px;align-items:center}.b small{margin-left:auto;font-size:10px;color:var(--mut)}
  .none{color:var(--mut);font-size:12px;padding:10px}
</style>
