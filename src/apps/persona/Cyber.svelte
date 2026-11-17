<script lang="ts">
  /* SİBERNETİK: yarı saydam beden (kemik, organ, damar), akan kan, nöral darbeler; bölgelere göre krom yuvaları. DM boş yuvaya tıklayıp parça ekler. */
  import { onMount, tick } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import type { Character } from '../../lib/backend';
  import { ask } from '../../lib/confirm.svelte';
  import { chromeSlots, hasChip, isDwarfRace, saveChrome, dropChrome, nid, now, type ChromePiece, type ChromeSlot, type Sheet } from '../../lib/persona';
  import { HUMAN, DWARF, vessels, type Body, type Pt } from './anatomy';
  import { P } from './psfx';
  let { uid, c, sheet, chrome, canEdit }: { uid: string; c: Character; sheet: Sheet; chrome: ChromePiece[]; canEdit: boolean } = $props();
  const B: Body = isDwarfRace(c.race) ? DWARF : HUMAN;
  const V = vessels(B);
  type Reg = { id: ChromeSlot; label: string; n: number; a: keyof Body; side: 'L' | 'R'; ic: string };
  const REG: Reg[] = [
    { id: 'brain', label: 'FRONTAL KORTEKS', n: 3, a: 'brain', side: 'L', ic: 'M12 3c-4 0-7 2.6-7 6 0 1.6.6 2.6 1.4 3.6-.6 1.5.2 3.4 2 3.9.4 1.8 2 2.5 3.6 2.5s3.2-.7 3.6-2.5c1.8-.5 2.6-2.4 2-3.9.8-1 1.4-2 1.4-3.6 0-3.4-3-6-7-6zM12 3v15M8 8c1 1 3 1 4 0m0 4c1 1 3 1 4 0' },
    { id: 'arms', label: 'KOLLAR', n: 1, a: 'elL', side: 'L', ic: 'M5 20l4-6 3-7 4-3 3 2-3 4-2 6-5 5z' },
    { id: 'skeleton', label: 'İSKELET', n: 2, a: 'ribs', side: 'L', ic: 'M12 3v18M6 7c3 1 9 1 12 0M5 11c3 1.3 11 1.3 14 0M6 15c3 1 9 1 12 0' },
    { id: 'nervous', label: 'SİNİR SİSTEMİ', n: 2, a: 'spine', side: 'L', ic: 'M12 2v20M12 7l-5 3m5-3 5 3M12 13l-6 4m6-4 6 4M7 10v3m10-3v3' },
    { id: 'skin', label: 'DIŞ DOKU', n: 2, a: 'thighL', side: 'L', ic: 'M12 2l8 4.6v9.2L12 21l-8-5.2V6.6zM12 7l4 2.3v4.6L12 16l-4-2.1V9.3z' },
    { id: 'os', label: 'İŞLETİM SİSTEMİ', n: 1, a: 'os', side: 'R', ic: 'M5 5h14v14H5zM9 9h6v6H9zM2 9h3m-3 6h3m14-6h3m-3 6h3M9 2v3m6-3v3M9 19v3m6-3v3' },
    { id: 'face', label: 'YÜZ', n: 1, a: 'face', side: 'R', ic: 'M12 3c-4 0-6 3-6 7 0 5 3 10 6 10s6-5 6-10c0-4-2-7-6-7zM8.5 10h2.5m2 0h2.5M10 16h4' },
    { id: 'hands', label: 'ELLER', n: 2, a: 'haR', side: 'R', ic: 'M7 21v-8l-2-4 1.5-1 2.5 3V4h1.6v7-8h1.8v8-7h1.8v8-6H17v10l-2 5z' },
    { id: 'circulatory', label: 'DOLAŞIM SİSTEMİ', n: 3, a: 'heart', side: 'R', ic: 'M12 20s-7-4.4-8.8-8.7A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 5.3C19 15.6 12 20 12 20zM6 12h3l1.5-3 3 6 1.5-3h3' },
    { id: 'legs', label: 'BACAKLAR', n: 1, a: 'knR', side: 'R', ic: 'M9 2h5l-1 9 2 9h-4l-1-8-1-10z' },
  ];
  const cap = $derived(hasChip(c.chrome) ? chromeSlots(String(c.chrome ?? '0')) : 0);
  const used = $derived(chrome.length);
  const full = $derived(used >= cap);
  const inReg = (r: ChromeSlot) => chrome.filter((x) => x.slot === r).sort((a, b) => a.at - b.at);
  let hov = $state<ChromeSlot | null>(null), tip = $state<{ p: ChromePiece; x: number; y: number; side: 'L' | 'R' } | null>(null);
  let pinned = $state<string | null>(null);
  let wrap: HTMLDivElement, bodyEl: HTMLDivElement;
  const regEl: Record<string, HTMLElement> = {};
  let lines = $state<{ id: ChromeSlot; d: string; ax: number; ay: number }[]>([]);
  async function layout() {
    await tick(); if (!wrap || !bodyEl) return;
    const W = wrap.getBoundingClientRect(), Bd = bodyEl.getBoundingClientRect();
    const sx = Bd.width / 576, sy = Bd.height / 1024;
    lines = REG.map((r) => {
      const el = regEl[r.id]; const a = B[r.a] as Pt; const ax = Bd.left - W.left + a[0] * sx, ay = Bd.top - W.top + a[1] * sy;
      if (!el) return { id: r.id, d: '', ax, ay };
      const R = el.getBoundingClientRect(); const ey = R.top - W.top + 9;
      const ex = r.side === 'L' ? R.right - W.left + 6 : R.left - W.left - 6;
      const mx = r.side === 'L' ? Math.max(ex + 16, ax - 40) : Math.min(ex - 16, ax + 40);
      return { id: r.id, d: `M${ex} ${ey} L${mx} ${ey} L${ax} ${ay}`, ax, ay };
    });
  }
  onMount(() => { layout(); const ro = new ResizeObserver(layout); ro.observe(wrap); const t = setTimeout(layout, 450); return () => { ro.disconnect(); clearTimeout(t); }; });
  function showTip(p: ChromePiece, e: Event, side: 'L' | 'R') {
    const R = (e.currentTarget as HTMLElement).getBoundingClientRect(), W = wrap.getBoundingClientRect();
    tip = { p, side, x: side === 'L' ? R.right - W.left + 12 : R.left - W.left - 12, y: R.top - W.top };
    P.hover();
  }
  // DM düzenleyici
  let ed = $state<ChromePiece | null>(null), err = $state('');
  function cell(r: Reg, p: ChromePiece | undefined) {
    if (p) { if (canEdit) { ed = { ...p }; P.select(); } else { pinned = pinned === p.id ? null : p.id; P.select(); } return; }
    if (!canEdit) { P.deny(); return; }
    if (full) { P.deny(); err = 'Kapasite dolu: önce kademe yükselt ya da parça çıkar.'; setTimeout(() => (err = ''), 2500); return; }
    ed = { id: nid(), slot: r.id, name: '', desc: '', stats: '', at: now() }; P.select();
  }
  function pickImg(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0]; if (!f || !ed) return;
    const im = new Image();
    im.onload = () => { const cv = document.createElement('canvas'), s = Math.min(1, 200 / Math.max(im.width, im.height)); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); cv.getContext('2d')!.drawImage(im, 0, 0, cv.width, cv.height); if (ed) ed = { ...ed, img: cv.toDataURL('image/webp', 0.74) }; };
    im.src = URL.createObjectURL(f);
  }
  async function save() { if (!ed || !ed.name.trim()) { err = 'İsim gerekli.'; return; } await saveChrome(uid, { ...ed, name: ed.name.trim(), at: ed.at || now() }); ed = null; P.confirm(); }
  async function del() { if (!ed) return; if (!(await ask('Parça sökülsün mü?', `"${ed.name}" bedenden çıkarılacak.`, 'Sök'))) return; await dropChrome(uid, ed.id); ed = null; P.back(); }
  const regLabel = (id: string) => REG.find((r) => r.id === id)?.label ?? id;
  const kop = $derived(Math.max(0, Math.min(10, sheet.kopus ?? 0)));
</script>

<div class="cy" bind:this={wrap}>
  <!-- sol gösterge: kapasite -->
  <div class="gauge l">
    <svg viewBox="0 0 24 24" class="gi"><path d="M12 2l3 5h-6zM7 9h10v4H7zM9 15h6v7H9z" fill="currentColor"/></svg>
    <div class="segs">{#each Array(12) as _, i}<i class:on={11 - i < used} class:cap={11 - i < cap} class:over={11 - i >= cap}></i>{/each}</div>
    <div class="gv"><b>{used}</b><span>/{cap}</span></div>
    <small class="mono">KROM KAPASİTESİ</small>
  </div>

  {#each ['L', 'R'] as side (side)}
    <div class="col {side}">
      {#each REG.filter((r) => r.side === side) as r (r.id)}
        {@const ps = inReg(r.id)}
        <div class="reg" class:hov={hov === r.id} bind:this={regEl[r.id]} role="group" aria-label={r.label}
          onmouseenter={() => { hov = r.id; if (r.id === 'circulatory') P.beat(); }} onmouseleave={() => { hov = null; tip = null; }}>
          <h5 class="mono">{r.label}{#if ps.length}<em>{ps.length}</em>{/if}</h5>
          <div class="cells">
            {#each Array(Math.max(r.n, ps.length)) as _, i}
              {@const p = ps[i]}
              <button class="cell" class:has={!!p} class:pin={p && pinned === p.id} class:lock={!p && full} class:edit={canEdit}
                onclick={() => cell(r, p)} onmouseenter={(e) => (p ? showTip(p, e, r.side) : P.hover())} onmouseleave={() => (tip = null)}
                aria-label={p ? p.name : 'Boş yuva'}>
                {#if p}
                  {#if p.img}<img src={p.img} alt="" />{:else}<svg viewBox="0 0 24 24"><path d={r.ic} /></svg>{/if}
                  <i class="rb"></i>
                {:else if full}<svg viewBox="0 0 24 24" class="lk"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" /></svg>
                {:else}<span class="pl">{canEdit ? '+' : ''}</span>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/each}

  <!-- beden -->
  <div class="stage">
    <div class="floor"></div>
    <div class="body" bind:this={bodyEl}>
      <img class="b0" src={import.meta.env.BASE_URL + B.img} alt="" draggable="false" onload={layout} />
      <img class="b1" src={import.meta.env.BASE_URL + B.img} alt="" draggable="false" />
      <svg viewBox="0 0 576 1024" class="fx" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="pglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <radialGradient id="hg"><stop offset="0" stop-color="#ff3a4a" stop-opacity=".9" /><stop offset="1" stop-color="#ff3a4a" stop-opacity="0" /></radialGradient>
          <radialGradient id="bg2"><stop offset="0" stop-color="#5ef6ff" stop-opacity=".55" /><stop offset="1" stop-color="#5ef6ff" stop-opacity="0" /></radialGradient>
        </defs>
        <g class="art">{#each V.art as d, i}<path {d} pathLength="100" style="animation-delay:{-i * 0.17}s" />{/each}</g>
        <g class="vein">{#each V.vein as d, i}<path {d} pathLength="100" style="animation-delay:{-i * 0.29}s" />{/each}</g>
        <g class="ner" filter="url(#pglow)">{#each V.ner as d, i}<path {d} pathLength="100" style="animation-delay:{-i * 0.41}s" />{/each}</g>
        <circle class="heart" cx={B.heart[0]} cy={B.heart[1]} r="34" fill="url(#hg)" />
        <circle class="brainp" cx={B.brain[0]} cy={B.brain[1]} r="40" fill="url(#bg2)" />
        {#each chrome as p (p.id)}
          {@const r = REG.find((x) => x.id === p.slot)}
          {#if r}{@const a = B[r.a] as Pt}<g class="imp" class:hot={hov === r.id}><circle cx={a[0]} cy={a[1]} r="7" /><circle cx={a[0]} cy={a[1]} r="14" class="o" /></g>{/if}
        {/each}
      </svg>
      <i class="scanl"></i>
    </div>
    {#if !hasChip(c.chrome)}<div class="nochip mono" in:fade>NÖRAL İŞLEMCİ YOK · KROM TAKILAMAZ</div>{/if}
  </div>

  <!-- sağ gösterge: kopuş -->
  <div class="gauge r" class:hot={kop >= 7}>
    <svg viewBox="0 0 24 24" class="gi"><path d="M12 2a5 5 0 0 1 5 5c0 4-5 6-5 9 0-3-5-5-5-9a5 5 0 0 1 5-5zM9 20h6v2H9z" fill="currentColor"/></svg>
    <div class="segs">{#each Array(10) as _, i}<i class:on={9 - i < kop} class:warn={9 - i >= 6}></i>{/each}</div>
    <div class="gv"><b>{kop}</b><span>/10</span></div>
    <small class="mono">KOPUŞ</small>
  </div>

  <!-- bağlantı çizgileri -->
  <svg class="links">
    {#each lines as l (l.id)}
      <g class:hot={hov === l.id}><path d={l.d} /><circle cx={l.ax} cy={l.ay} r="3" /></g>
    {/each}
  </svg>

  {#if tip}
    <div class="tip {tip.side}" style:left="{tip.x}px" style:top="{tip.y}px" transition:scale={{ start: 0.94, duration: 140 }}>
      <div class="th"><span class="mono">{regLabel(tip.p.slot)}</span></div>
      <h4>{tip.p.name}</h4>
      {#if tip.p.img}<img src={tip.p.img} alt="" />{/if}
      {#if tip.p.desc}<p>{tip.p.desc}</p>{/if}
      {#if tip.p.stats}<div class="st mono">{#each tip.p.stats.split(/\n|;/).filter(Boolean) as s}<div>▸ {s.trim()}</div>{/each}</div>{/if}
      {#if canEdit}<small class="mono">TIKLA · DÜZENLE</small>{/if}
    </div>
  {/if}
  {#if err}<div class="err mono" transition:fade>{err}</div>{/if}

  {#if ed}
    <div class="mod" transition:fade={{ duration: 150 }} role="presentation" onpointerdown={(e) => e.target === e.currentTarget && (ed = null)}>
      <div class="box" in:scale={{ start: 0.95, duration: 180 }}>
        <h3 class="mono">{chrome.some((x) => x.id === ed!.id) ? 'PARÇAYI DÜZENLE' : 'YENİ İMPLANT'} · {regLabel(ed.slot)}</h3>
        <label><span>İsim</span><input bind:value={ed.name} maxlength="60" placeholder="ör. Kiroshi Optik Mk.II" /></label>
        <label><span>Açıklama</span><textarea rows="3" bind:value={ed.desc} maxlength="400"></textarea></label>
        <label><span>Etkiler (satır başına bir)</span><textarea rows="3" bind:value={ed.stats} maxlength="300" placeholder="+2 Algı&#10;Karanlıkta görüş"></textarea></label>
        <label><span>Bölge</span><select bind:value={ed.slot}>{#each REG as r}<option value={r.id}>{r.label}</option>{/each}</select></label>
        <div class="row"><label class="up">Görsel seç<input type="file" accept="image/*" hidden onchange={pickImg} /></label>{#if ed.img}<img class="pv" src={ed.img} alt="" /><button class="gh" onclick={() => ed && (ed = { ...ed, img: undefined })}>kaldır</button>{/if}</div>
        {#if err}<p class="e">{err}</p>{/if}
        <div class="row end">
          {#if chrome.some((x) => x.id === ed!.id)}<button class="red" onclick={del}>Sök</button>{/if}
          <button class="gh" onclick={() => (ed = null)}>Vazgeç</button><button class="ok" onclick={save}>Kaydet</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .cy{position:absolute;inset:0;display:grid;grid-template-columns:92px minmax(220px,1fr) minmax(260px,420px) minmax(220px,1fr) 92px;grid-template-areas:"gl L st R gr";gap:0 18px;padding:18px 28px 14px;overflow:hidden}
  .gauge{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--pr)}
  .gauge.l{grid-area:gl}.gauge.r{grid-area:gr;color:var(--pc)}.gauge.r.hot{color:var(--pr)}
  .gi{width:20px;height:20px}
  .segs{display:flex;flex-direction:column;gap:3px}
  .segs i{display:block;width:34px;height:13px;border:1px solid currentColor;opacity:.22;clip-path:polygon(0 0,100% 0,100% 70%,88% 100%,0 100%)}
  .segs i.cap{opacity:.45}.segs i.on{opacity:1;background:currentColor;box-shadow:0 0 10px currentColor}.segs i.over{border-style:dashed;opacity:.12}
  .gauge.r .segs i.on.warn{color:var(--pr);background:var(--pr)}
  .gv{font-family:var(--f-disp);color:#fff}.gv b{font-size:22px}.gv span{font-size:12px;color:var(--mut)}
  .gauge small{font-size:9px;letter-spacing:.24em;text-align:center;writing-mode:horizontal-tb}
  .col{display:flex;flex-direction:column;justify-content:space-around;gap:8px;z-index:4;min-height:0}
  .col.L{grid-area:L;align-items:flex-end}.col.R{grid-area:R;align-items:flex-start}
  .reg{display:flex;flex-direction:column;gap:6px;transition:transform .25s}
  .col.L .reg{align-items:flex-end}.reg.hov{transform:translateX(0) scale(1.02)}
  h5{margin:0;font-size:12px;letter-spacing:.2em;color:var(--pr);display:flex;align-items:center;gap:8px;transition:color .2s}
  .reg.hov h5{color:#fff;text-shadow:0 0 10px var(--pr)}
  h5 em{font-style:normal;font-size:10px;color:#000;background:var(--pr);padding:0 5px}
  .cells{display:flex;gap:6px}
  .cell{position:relative;width:62px;height:62px;padding:0;border:1px solid rgba(255,93,93,.35);background:linear-gradient(160deg,rgba(255,93,93,.08),rgba(10,4,8,.85));cursor:var(--cur-p);clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%);transition:transform .15s,border-color .15s,background .2s;display:grid;place-items:center;color:var(--pr)}
  .cell::after{content:"";position:absolute;right:0;top:0;width:12px;height:12px;background:linear-gradient(225deg,var(--pr) 50%,transparent 50%);opacity:.6}
  .cell:hover{transform:translateY(-2px);border-color:var(--pc);background:linear-gradient(160deg,rgba(94,246,255,.12),rgba(10,4,8,.85))}
  .cell svg{width:30px;height:30px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linejoin:round;stroke-linecap:round}
  .cell.has{border-color:rgba(255,176,60,.7);color:#ffcf7a;background:linear-gradient(160deg,rgba(255,150,40,.16),rgba(20,8,4,.9));box-shadow:inset 0 0 18px rgba(255,150,40,.12)}
  .cell.has svg{filter:drop-shadow(0 0 6px rgba(255,180,80,.7))}
  .cell img{width:100%;height:100%;object-fit:cover}
  .rb{position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(#ffb03c,#ff5d5d)}
  .cell.pin{outline:2px solid var(--pc);outline-offset:2px}
  .cell.lock{opacity:.35;cursor:not-allowed}.cell .lk{width:18px;height:18px}
  .pl{font-size:22px;color:rgba(255,93,93,.5)}
  .cell:not(.has) .pl:empty::before{content:"";width:8px;height:8px;border:1px solid rgba(255,93,93,.35);display:block;transform:rotate(45deg)}
  .stage{grid-area:st;position:relative;display:grid;place-items:center;min-height:0}
  .body{position:relative;height:100%;max-height:100%;aspect-ratio:576/1024;animation:breathe 4.2s ease-in-out infinite}
  @keyframes breathe{50%{transform:scale(1.008) translateY(-2px)}}
  .body img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;user-select:none}
  .b0{opacity:.9;filter:saturate(1.05) contrast(1.05);-webkit-mask:linear-gradient(#000 92%,transparent)}
  .b1{opacity:.0;filter:hue-rotate(160deg) saturate(2) brightness(1.4);animation:holo 7s steps(1) infinite}
  @keyframes holo{0%,93%,100%{opacity:0;transform:none}94%{opacity:.35;transform:translateX(4px)}96%{opacity:.2;transform:translateX(-3px)}}
  .fx{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
  .fx path{fill:none;stroke-linecap:round}
  .art path{stroke:#ff2f45;stroke-width:2.2;stroke-dasharray:1.2 7;animation:flow 1.6s linear infinite;opacity:.95;filter:drop-shadow(0 0 3px #ff2f45)}
  .vein path{stroke:#4d7bff;stroke-width:1.8;stroke-dasharray:1 9;animation:flowv 2.6s linear infinite;opacity:.8}
  @keyframes flowv{to{stroke-dashoffset:-20}}
  .ner path{stroke:#ffe27a;stroke-width:1.6;stroke-dasharray:.6 30;animation:flow 1.1s cubic-bezier(.6,0,.4,1) infinite}
  @keyframes flow{to{stroke-dashoffset:-16.4}}
  .ner path{animation-name:neur}@keyframes neur{to{stroke-dashoffset:-30.6}}
  .heart{transform-box:fill-box;transform-origin:center;animation:hb .83s ease-out infinite}
  @keyframes hb{0%{transform:scale(.7);opacity:.5}14%{transform:scale(1.15);opacity:1}28%{transform:scale(.85);opacity:.6}42%{transform:scale(1.05);opacity:.85}100%{transform:scale(.7);opacity:.45}}
  .brainp{transform-box:fill-box;transform-origin:center;animation:bp 2.4s ease-in-out infinite}@keyframes bp{50%{opacity:.35;transform:scale(.85)}}
  .imp circle{fill:#ffb03c;filter:drop-shadow(0 0 6px #ffb03c)}.imp .o{fill:none;stroke:#ffb03c;stroke-width:1;transform-box:fill-box;transform-origin:center;animation:ring 1.8s ease-out infinite}
  .imp.hot circle{fill:#5ef6ff;filter:drop-shadow(0 0 8px #5ef6ff)}.imp.hot .o{stroke:#5ef6ff}
  @keyframes ring{from{transform:scale(.5);opacity:1}to{transform:scale(2.2);opacity:0}}
  .scanl{position:absolute;left:-6%;right:-6%;height:2px;background:linear-gradient(90deg,transparent,#5ef6ff,transparent);box-shadow:0 0 18px #5ef6ff;animation:sl 5.5s linear infinite;opacity:.55}
  @keyframes sl{0%{top:2%}100%{top:96%}}
  .floor{position:absolute;bottom:2%;left:50%;width:70%;height:40px;transform:translateX(-50%);border-radius:50%;border:1px solid rgba(255,93,93,.35);box-shadow:0 0 30px rgba(255,93,93,.2),inset 0 0 20px rgba(255,93,93,.2);animation:fl 3s ease-in-out infinite}
  @keyframes fl{50%{opacity:.5;width:64%}}
  .nochip{position:absolute;bottom:12%;left:50%;transform:translateX(-50%);padding:8px 14px;border:1px solid var(--pr);background:rgba(20,0,4,.85);color:var(--pr);font-size:11px;letter-spacing:.24em;white-space:nowrap}
  .links{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3}
  .links path{fill:none;stroke:rgba(255,93,93,.22);stroke-width:1;transition:stroke .2s}.links circle{fill:rgba(255,93,93,.35)}
  .links g.hot path{stroke:var(--pc);stroke-width:1.4;stroke-dasharray:4 3;animation:ld .6s linear infinite;filter:drop-shadow(0 0 4px var(--pc))}.links g.hot circle{fill:var(--pc);r:5}
  @keyframes ld{to{stroke-dashoffset:-14}}
  .tip{position:absolute;z-index:20;width:290px;padding:12px 14px;background:rgba(14,5,8,.96);border:1px solid var(--pr);box-shadow:0 0 30px rgba(255,40,60,.25);pointer-events:none}
  .tip.R{transform:translateX(-100%)}
  .th{display:flex;justify-content:space-between;border-bottom:1px solid var(--pl);padding-bottom:6px;margin-bottom:8px}.th span{font-size:10px;letter-spacing:.24em;color:var(--pr)}
  .tip h4{margin:0 0 8px;color:#ffcf7a;font-size:17px;letter-spacing:.04em}
  .tip img{width:100%;max-height:120px;object-fit:contain;background:rgba(255,150,40,.06);margin-bottom:8px}
  .tip p{margin:0 0 8px;font-size:13.5px;line-height:1.45;color:#e8d4d4}
  .st{font-size:12px;color:var(--pc);line-height:1.6}
  .tip small{display:block;margin-top:8px;color:var(--mut);font-size:9.5px;letter-spacing:.2em}
  .err{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:30;padding:8px 14px;background:rgba(30,0,6,.95);border:1px solid var(--pr);color:var(--pr);font-size:12px;letter-spacing:.12em}
  .mod{position:absolute;inset:0;z-index:40;display:grid;place-items:center;background:rgba(4,0,2,.7);backdrop-filter:blur(3px)}
  .box{width:min(460px,92%);padding:18px 20px;background:#0e0508;border:1px solid var(--pr);display:flex;flex-direction:column;gap:10px;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,0 100%)}
  .box h3{margin:0 0 4px;font-size:12px;letter-spacing:.24em;color:var(--pr)}
  .box label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--mut);letter-spacing:.08em}
  .box input,.box textarea,.box select{background:#07030a;border:1px solid var(--pl);color:#fff;padding:7px 9px;font:inherit;font-size:14px}
  .box input:focus,.box textarea:focus{border-color:var(--pc);outline:none}
  .row{display:flex;align-items:center;gap:8px}.row.end{justify-content:flex-end;margin-top:6px}
  .box button,.up{background:none;border:1px solid var(--pl);color:#fff;padding:7px 14px;font:inherit;letter-spacing:.1em;cursor:var(--cur-p)}
  .box .ok{background:var(--pr);border-color:var(--pr);color:#120004;font-weight:700}.box .red{border-color:var(--pr);color:var(--pr);margin-right:auto}
  .up{flex-direction:row !important;color:var(--pc) !important;border-color:rgba(94,246,255,.4) !important}
  .pv{width:44px;height:44px;object-fit:cover;border:1px solid var(--pl)}.e{color:var(--pr);margin:0;font-size:13px}
</style>
