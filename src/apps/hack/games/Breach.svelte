<script lang="ts">
  import { onMount } from 'svelte';
  import Frame from '../Frame.svelte';
  import { META } from '../meta';
  import { H } from '../hsfx';
  import { clock } from '../clock.svelte';
  import { generate, has } from '../logic/breach';
  let { diff, signal, onend }: { diff: number; signal: number; onend: (ok: boolean) => void } = $props();
  const b = generate(diff, signal);
  let buf = $state<string[]>([]), used = $state<string[]>([]), axis = $state<'row' | 'col'>('row'), line = $state(0);
  let hov = $state<[number, number] | null>(null), help = $state(false), over = $state<0 | 1 | -1>(0), resets = $state(1);
  const ck = clock(b.time, () => finish(false));
  $effect(() => { ck.s.paused = help; });
  /** daemon için ara belleğin sonunda eşleşen önek uzunluğu */
  function prog(seq: string[], bb: string[]) {
    if (has(bb, seq)) return seq.length;
    for (let k = Math.min(seq.length - 1, bb.length); k > 0; k--) { let ok = true; for (let j = 0; j < k; j++) if (bb[bb.length - k + j] !== seq[j]) { ok = false; break; } if (ok) return k; }
    return 0;
  }
  const done = $derived(b.daemons.map((d) => has(buf, d.seq)));
  const prev = $derived(hov && can(hov[0], hov[1]) ? [...buf, b.grid[hov[0]]![hov[1]]!] : null);
  const dead = $derived(b.daemons.map((d, i) => !done[i] && b.buf - buf.length < d.seq.length - prog(d.seq, buf)));
  function can(r: number, c: number) { if (over || used.includes(r + ',' + c) || buf.length >= b.buf) return false; return axis === 'row' ? r === line : c === line; }
  function pickCell(r: number, c: number) {
    if (!can(r, c)) { if (!over) H.bpBad(); return; }
    ck.start();
    const before = done.filter(Boolean).length;
    buf = [...buf, b.grid[r]![c]!]; used = [...used, r + ',' + c];
    if (axis === 'row') { axis = 'col'; line = c; } else { axis = 'row'; line = r; }
    const now = b.daemons.filter((d) => has(buf, d.seq)).length;
    if (now > before) H.bpSeq(); else H.bpPick();
    if (now === b.daemons.length) return finish(true);
    if (buf.length >= b.buf) return finish(false);
  }
  function reset() { if (!resets || over || !buf.length) return; resets--; buf = []; used = []; axis = 'row'; line = 0; H.warn(); }
  function finish(ok: boolean) { if (over) return; over = ok ? 1 : -1; ck.stop(); (ok ? H.win : H.lose)(); setTimeout(() => onend(ok), 1300); }
  onMount(() => () => ck.stop());
</script>

<Frame meta={META.breach} {diff} {signal} time={b.time} left={ck.s.left} started={ck.s.started} bind:help>
  {#snippet status()}<span class="mono st">ARA BELLEK {buf.length}/{b.buf}</span>{/snippet}
  <div class="bp" class:won={over === 1} class:lost={over === -1}>
    <section class="mx">
      <div class="lab"><b>KOD MATRİSİ</b><span>{axis === 'row' ? 'SATIR' : 'SÜTUN'} SEÇİMİ</span></div>
      <div class="grid" style="--n:{b.n}" onmouseleave={() => (hov = null)} role="grid" tabindex="-1">
        <div class="band" style={axis === 'row' ? `top:calc(${line} * var(--cs) + 10px);left:6px;right:6px;height:var(--cs)` : `left:calc(${line} * var(--cs) + 10px);top:6px;bottom:6px;width:var(--cs)`}></div>
        {#if hov && can(hov[0], hov[1])}<div class="band2" style={axis === 'row' ? `left:calc(${hov[1]} * var(--cs) + 10px);top:6px;bottom:6px;width:var(--cs)` : `top:calc(${hov[0]} * var(--cs) + 10px);left:6px;right:6px;height:var(--cs)`}></div>{/if}
        {#each b.grid as row, r}{#each row as v, c}
          {@const u = used.includes(r + ',' + c)}
          <button class="cell" class:u class:ok={can(r, c)} class:h={hov && hov[0] === r && hov[1] === c}
            onmouseenter={() => { hov = [r, c]; if (can(r, c)) H.bpHover(); }} onclick={() => pickCell(r, c)}>{u ? '[ ]' : v}</button>
        {/each}{/each}
      </div>
    </section>
    <section class="side">
      <div class="lab"><b>ARA BELLEK</b><span>{b.buf - buf.length} YUVA KALDI</span></div>
      <div class="buf">{#each Array(b.buf) as _, i}<i class:f={i < buf.length} class:pv={prev && i === buf.length}>{buf[i] ?? (prev && i === buf.length ? prev[i] : '')}</i>{/each}</div>
      <div class="lab"><b>DAEMON YÜKLEME</b><span>HEPSİ GEREKLİ</span></div>
      <div class="ds">
        {#each b.daemons as d, i}
          {@const p = prog(d.seq, buf)}{@const pp = prev ? prog(d.seq, prev) : -1}
          <div class="d" class:dn={done[i]} class:dd={dead[i]}>
            <div class="seq">{#each d.seq as s, j}<span class:m={j < p} class:nx={j === p && !done[i]} class:pvm={pp > p && j < pp && j >= p}>{s}</span>{/each}</div>
            <div class="nm"><b>{d.name}</b><em>{done[i] ? 'YÜKLENDİ' : dead[i] ? 'YER YETMİYOR' : 'BEKLİYOR'}</em></div>
          </div>
        {/each}
      </div>
      <button class="rs mono" onclick={reset} disabled={!resets || !buf.length || !!over}>ARA BELLEĞİ SIFIRLA ({resets})</button>
      <p class="tip">İlk seçim üst satırdan. Seçtiğin kod, vurgulu çizgiye dik olan çizgiyi açar.</p>
    </section>
  </div>
  {#if over}<div class="res mono" class:ok={over === 1}>{over === 1 ? 'İHLAL TAMAMLANDI // DAEMONLAR YÜKLENDİ' : 'İHLAL BAŞARISIZ // ARA BELLEK TÜKENDİ'}</div>{/if}
</Frame>

<style>
  .st{color:var(--acc);letter-spacing:.2em}
  .bp{display:grid;grid-template-columns:auto minmax(300px,420px);gap:42px;align-items:start;transition:filter .4s}
  .lab{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:7px 12px;background:color-mix(in srgb,var(--acc) 92%,#000);color:#0b0c12;margin-bottom:10px}
  .lab b{font-size:13px;letter-spacing:.22em}.lab span{font-size:10px;letter-spacing:.2em;font-weight:700;opacity:.75}
  .mx{border:1px solid color-mix(in srgb,var(--acc) 45%,transparent);background:rgba(10,12,18,.85);padding:0 0 10px}
  .mx .lab{margin:0 0 4px}
  .grid{--cs:clamp(52px,7.4vh,72px);position:relative;display:grid;grid-template-columns:repeat(var(--n),var(--cs));grid-auto-rows:var(--cs);padding:10px}
  .band,.band2{position:absolute;pointer-events:none;transition:all .18s cubic-bezier(.2,.8,.2,1)}
  .band{background:color-mix(in srgb,var(--acc) 9%,transparent);border:1px solid color-mix(in srgb,var(--acc) 55%,transparent);box-shadow:inset 0 0 18px color-mix(in srgb,var(--acc) 12%,transparent)}
  .band2{background:color-mix(in srgb,var(--acc2) 7%,transparent);border:1px dashed color-mix(in srgb,var(--acc2) 45%,transparent)}
  .cell{position:relative;z-index:1;background:none;border:0;font:inherit;font-size:clamp(17px,2.3vh,22px);font-weight:600;letter-spacing:.06em;color:color-mix(in srgb,var(--acc) 40%,#555);cursor:default}
  .cell.ok{color:var(--acc);cursor:pointer}
  .cell.ok.h{color:#0b0c12;background:var(--acc2);box-shadow:0 0 18px var(--acc2)}
  .cell.u{color:#3b4250;font-size:14px}
  .side{display:flex;flex-direction:column;gap:6px}
  .buf{display:flex;flex-wrap:wrap;gap:6px;padding:8px;border:1px solid color-mix(in srgb,var(--acc) 35%,transparent);margin-bottom:14px;min-height:56px}
  .buf i{width:42px;height:38px;display:grid;place-items:center;font-style:normal;font-size:15px;font-weight:600;border:1px dashed color-mix(in srgb,var(--acc) 35%,transparent);color:var(--acc)}
  .buf i.f{border-style:solid;border-color:var(--acc);background:color-mix(in srgb,var(--acc) 10%,transparent)}
  .buf i.pv{color:var(--acc2);border-color:var(--acc2);animation:pv .7s infinite alternate}
  @keyframes pv{to{opacity:.4}}
  .ds{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
  .d{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;padding:10px 12px;border:1px solid color-mix(in srgb,var(--acc) 25%,transparent);background:rgba(10,12,18,.7);transition:all .25s}
  .seq{display:flex;gap:6px}.seq span{width:34px;text-align:center;padding:4px 0;font-size:14px;font-weight:600;color:#8a93a3;border:1px solid #2a3040}
  .seq span.m{color:#0b0c12;background:var(--acc);border-color:var(--acc)}.seq span.nx{color:var(--acc);border-color:var(--acc);box-shadow:0 0 10px color-mix(in srgb,var(--acc) 40%,transparent)}
  .seq span.pvm{color:#0b0c12;background:var(--acc2);border-color:var(--acc2)}
  .nm{display:flex;flex-direction:column;gap:2px;min-width:0}.nm b{font-size:12.5px;letter-spacing:.14em;color:#e6f2ea}.nm em{font-style:normal;font-size:10px;letter-spacing:.24em;color:#7d8798}
  .d.dn{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 12%,transparent)}.d.dn em{color:var(--acc)}
  .d.dd{border-color:#ff5f56;opacity:.7}.d.dd em{color:#ff5f56}
  .rs{align-self:flex-start;padding:8px 14px;background:none;border:1px solid color-mix(in srgb,var(--acc2) 50%,transparent);color:var(--acc2);font-size:11px;letter-spacing:.2em;cursor:pointer}.rs:disabled{opacity:.3;cursor:default}
  .tip{font-family:var(--f-ui,system-ui);font-size:13px;color:#7f8a99;margin:6px 0 0;max-width:42ch}
  .won{filter:drop-shadow(0 0 22px color-mix(in srgb,var(--acc) 40%,transparent))}.lost{filter:grayscale(.7) brightness(.6)}
  .res{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px 36px;background:#000;border:2px solid #ff5f56;color:#ff5f56;font-size:20px;letter-spacing:.2em;font-weight:700;animation:rs .35s cubic-bezier(.2,1.4,.4,1) both;z-index:5;white-space:nowrap}
  .res.ok{border-color:var(--acc);color:var(--acc);box-shadow:0 0 40px color-mix(in srgb,var(--acc) 40%,transparent)}
  @keyframes rs{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}
</style>
