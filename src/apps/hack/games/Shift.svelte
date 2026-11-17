<script lang="ts">
  import { onMount } from 'svelte';
  import Frame from '../Frame.svelte';
  import { META } from '../meta';
  import { H } from '../hsfx';
  import { onGuardKey } from '../../../lib/keyguard';
  import { init, step, move, space, POS, ROUTE, pulsePhase, type NodeId, type ShiftState } from '../logic/shift';
  let { diff, signal, onend }: { diff: number; signal: number; onend: (ok: boolean) => void } = $props();
  const s0 = init(diff);
  let s = $state<ShiftState>(s0), help = $state(false), started = $state(false), over = $state<0 | 1 | -1>(0), hurt = $state(0), fx = $state<{ id: number; n: NodeId; k: string }[]>([]);
  const U = 92, CX = 320, CY = 250; // ölçek ve merkez (svg birimleri)
  const P = (n: NodeId) => [CX + POS[n][0] * U, CY + POS[n][1] * U] as const;
  const EDGES: [NodeId, NodeId][] = [['H', 'T'], ['H', 'B'], ['H', 'L'], ['H', 'R'], ['L', 'TL'], ['L', 'BL'], ['R', 'TR'], ['R', 'BR']];
  const JUNC: NodeId[] = ['L', 'R'];
  function cube(x: number, y: number, r: number) {
    const h = r * 0.5;
    return `M${x} ${y - r} L${x + r} ${y - h} L${x + r} ${y + h} L${x} ${y + r} L${x - r} ${y + h} L${x - r} ${y - h} Z M${x} ${y - r + r} L${x} ${y + r} M${x} ${y} L${x + r} ${y - h} M${x} ${y} L${x - r} ${y - h}`;
  }
  function hexp(x: number, y: number, r: number) { return Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + (i * Math.PI) / 3; return `${x + Math.cos(a) * r},${y + Math.sin(a) * r}`; }).join(' '); }
  function pktPos(from: NodeId, t: number) {
    const route = ROUTE[from]!.map(P); const segs = route.length - 1; const f = Math.min(0.999, t) * segs; const i = Math.floor(f); const u = f - i;
    const a = route[i]!, b = route[i + 1]!; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[1] - a[1], b[0] - a[0])] as const;
  }
  let fxId = 0;
  const pop = (n: NodeId, k: string) => { const id = fxId++; fx = [...fx, { id, n, k }]; setTimeout(() => (fx = fx.filter((x) => x.id !== id)), 600); };
  function finish(ok: boolean) { if (over) return; over = ok ? 1 : -1; (ok ? H.win : H.lose)(); setTimeout(() => onend(ok), 1500); }
  onMount(() => {
    let raf = 0, last = 0, prevPk = 0, prevHp = 100;
    const loop = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
      if (started && !help && !over) {
        step(s0, dt);
        if (s0.packets.length > prevPk) H.sFire(); prevPk = s0.packets.length;
        if (s0.hp < prevHp) { H.sDmg(); hurt++; } prevHp = s0.hp;
        if (s0.over) finish(s0.over === 1);
      }
      s = { ...s0, packets: s0.packets.map((p) => ({ ...p })), inf: { ...s0.inf } };
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const kd = (e: KeyboardEvent) => {
      if (over || help) return;
      const k = e.key.toLowerCase();
      if ('wasd'.includes(k) && k.length === 1) { e.preventDefault(); started = true; if (move(s0, k as 'w')) H.sMove(); }
      else if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') { e.preventDefault(); started = true; const m = { arrowup: 'w', arrowdown: 's', arrowleft: 'a', arrowright: 'd' }[k] as 'w'; if (move(s0, m)) H.sMove(); }
      else if (k === ' ') {
        e.preventDefault(); if (e.repeat) return; started = true;
        const r = space(s0);
        if (r === 'hit') { H.sHit(); pop(s0.at, 'hit'); } else if (r === 'kill') { H.sKill(); pop(s0.at, 'kill'); } else if (r === 'charge') { H.sCharge(); pop('H', 'charge'); }
        else if (r === 'miss') { H.sMiss(); pop('H', 'miss'); } else if (r === 'empty') { H.warn(); pop(s0.at, 'empty'); }
        if (s0.over) finish(s0.over === 1);
      }
    };
    const off = onGuardKey(kd);
    return () => { cancelAnimationFrame(raf); off(); };
  });
  const ph = $derived(pulsePhase(s));
  const infCount = $derived(Object.keys(s.inf).length);
</script>

<Frame meta={META.shift} {diff} {signal} bind:help>
  {#snippet bar()}<span class="mono hint">{started ? 'ENFEKTE DÜĞÜM: ' + infCount : 'İLK HAREKETTE SALDIRI BAŞLAR'}</span>{/snippet}
  {#snippet status()}<span class="mono st">SAĞLIK %{Math.round(s.hp)}</span>{/snippet}
  <div class="sh" class:lost={over === -1}>
    <div class="floor"></div>
    {#key hurt}<div class="hurt" class:on={hurt > 0}></div>{/key}
    <svg viewBox="0 0 640 500" class="map">
      <defs>
        <filter id="glw"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {#each EDGES as [a, b]}{@const pa = P(a)}{@const pb = P(b)}<line class="ed" x1={pa[0]} y1={pa[1]} x2={pb[0]} y2={pb[1]} />{/each}
      {#each Object.keys(POS) as n}
        {@const id = n as NodeId}{@const [x, y] = P(id)}
        {#if id === 'H'}
          <g class="home" class:here={s.at === 'H'}>
            <path d={cube(x, y, 56)} />
            <circle cx={x} cy={y} r="17" class="core" />
            {#if s.at === 'H'}
              <circle cx={x} cy={y} r="44" class="tgt" class:hot={ph > 0.7 && ph < 0.9} />
              <circle cx={x} cy={y} r={8 + ph * 46} class="pulse" class:lockd={s.lock > 0} />
            {/if}
          </g>
        {:else if !JUNC.includes(id)}
          {#if s.inf[id] !== undefined}
            <g class="inf" class:here={s.at === id} filter="url(#glw)">
              <path d={cube(x, y, 30)} />
              {#each Array(s.infMax) as _, i}<rect x={x - s.infMax * 5 + i * 10} y={y + 40} width="7" height="5" class:on={i < (s.inf[id] ?? 0)} />{/each}
            </g>
          {:else}
            <polygon points={hexp(x, y, 30)} class="hex" class:here={s.at === id} />
          {/if}
        {:else}
          <circle cx={x} cy={y} r="6" class="jn" class:here={s.at === id} />
        {/if}
        {#if s.at === id}<polygon class="me" points={`${x},${y - (id === 'H' ? 78 : 50)} ${x - 9},${y - (id === 'H' ? 92 : 64)} ${x + 9},${y - (id === 'H' ? 92 : 64)}`} />{/if}
      {/each}
      {#each s.packets as p (p.id)}
        {@const [x, y, a] = pktPos(p.from, p.t / p.dur)}
        <polygon class="pk" points="10,0 -7,-7 -7,7" transform="translate({x} {y}) rotate({(a * 180) / Math.PI})" />
      {/each}
      {#each fx as f (f.id)}{@const [x, y] = P(f.n)}<circle cx={x} cy={y} r="20" class="fx {f.k}" />{/each}
    </svg>
    <div class="hud mono">
      <div class="hp"><span>BAĞLANTI</span><div class="hb"><i style="width:{s.hp}%"></i></div></div>
      <div class="bt" class:empty={s.bat === 0}><span>PİL</span><div class="cells">{#each Array(s.batMax) as _, i}<i class:on={i < s.bat}></i>{/each}</div></div>
    </div>
    {#if s.at === 'H' && s.bat < s.batMax}<div class="chg mono" class:lk={s.lock > 0}>{s.lock > 0 ? 'ŞARJ KİLİTLİ ' + s.lock.toFixed(1) : 'HALKA ÇERÇEVEYE OTURUNCA BOŞLUK'}</div>{/if}
  </div>
  {#if over}<div class="res mono" class:ok={over === 1}>{over === 1 ? 'AĞ TEMİZ // TÜM DÜĞÜMLER İMHA' : 'BAĞLANTI KOPTU // EV DÜĞÜMÜ DÜŞTÜ'}</div>{/if}
</Frame>

<style>
  .hint{font-size:11px;letter-spacing:.24em;color:var(--acc)}.st{color:var(--acc);letter-spacing:.2em}
  .sh{position:relative;width:min(1000px,92vw);height:min(calc(100vh - 210px),780px);display:grid;place-items:center}
  .floor{position:absolute;left:-10%;right:-10%;bottom:-6%;height:62%;transform:perspective(500px) rotateX(62deg);transform-origin:bottom;
    background:linear-gradient(rgba(56,255,106,.22) 1px,transparent 1px) 0 0/40px 40px,linear-gradient(90deg,rgba(56,255,106,.22) 1px,transparent 1px) 0 0/40px 40px;
    mask-image:linear-gradient(transparent,#000 40%,transparent);animation:fl 3s linear infinite;opacity:.6}
  @keyframes fl{to{background-position:0 40px,0 0}}
  .map{position:relative;width:100%;height:100%}
  .ed{stroke:#1f8a3c;stroke-width:3;opacity:.9}
  .home path{fill:rgba(10,40,18,.6);stroke:var(--acc);stroke-width:3;stroke-linejoin:round}.home .core{fill:rgba(56,255,106,.35);stroke:var(--acc);stroke-width:3}
  .home.here path{filter:drop-shadow(0 0 10px var(--acc))}
  .tgt{fill:none;stroke:#bfffd0;stroke-width:3;stroke-dasharray:4 5;opacity:.7}.tgt.hot{stroke:#fff;opacity:1;filter:drop-shadow(0 0 8px #fff)}
  .pulse{fill:none;stroke:var(--acc);stroke-width:4;opacity:.9}.pulse.lockd{stroke:#ff3a4f;opacity:.4}
  .hex{fill:rgba(0,20,8,.5);stroke:#1f8a3c;stroke-width:3}.hex.here{stroke:var(--acc);filter:drop-shadow(0 0 8px var(--acc))}
  .jn{fill:#1f8a3c}.jn.here{fill:var(--acc)}
  .inf path{fill:rgba(60,0,8,.55);stroke:var(--acc2);stroke-width:3;stroke-linejoin:round;animation:ip 1.1s ease-in-out infinite}
  @keyframes ip{50%{stroke-width:4.5}}
  .inf.here path{fill:rgba(255,58,79,.25)}
  .inf rect{fill:#3a0a12}.inf rect.on{fill:var(--acc2)}
  .me{fill:#e8fff0;filter:drop-shadow(0 0 6px var(--acc));animation:bob 1s ease-in-out infinite}
  @keyframes bob{50%{transform:translateY(-4px)}}
  .pk{fill:none;stroke:var(--acc2);stroke-width:3;filter:drop-shadow(0 0 6px var(--acc2))}
  .fx{fill:none;stroke-width:4;animation:fx .6s ease-out forwards}.fx.hit{stroke:#ffb0b8}.fx.kill{stroke:var(--acc2);stroke-width:8}.fx.charge{stroke:var(--acc);stroke-width:8}.fx.miss,.fx.empty{stroke:#ff3a4f}
  @keyframes fx{to{r:70;opacity:0}}
  .hud{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end;font-size:11px;letter-spacing:.2em;color:#7fbf90}
  .hp{display:flex;flex-direction:column;gap:6px;width:min(420px,45%)}.hb{height:12px;border:1px solid var(--acc);background:#021407}.hb i{display:block;height:100%;background:var(--acc);box-shadow:0 0 10px var(--acc);transition:width .2s}
  .bt{display:flex;flex-direction:column;gap:6px;align-items:flex-end}.cells{display:flex;gap:3px;padding:3px;border:1px solid var(--acc)}.cells i{width:9px;height:16px;background:#0b2a14}.cells i.on{background:var(--acc)}
  .bt.empty .cells{border-color:var(--acc2);animation:bl .5s steps(2) infinite}@keyframes bl{50%{opacity:.4}}
  .chg{position:absolute;top:6px;left:50%;transform:translateX(-50%);font-size:12px;letter-spacing:.24em;color:var(--acc);padding:6px 12px;border:1px solid color-mix(in srgb,var(--acc) 40%,transparent);background:rgba(0,0,0,.5)}.chg.lk{color:var(--acc2);border-color:var(--acc2)}
  .hurt{position:absolute;inset:-40px;pointer-events:none;opacity:0}.hurt.on{animation:hu .45s ease-out}
  @keyframes hu{0%{opacity:1;box-shadow:inset 0 0 120px rgba(255,40,60,.7)}100%{opacity:0}}
  .lost{filter:grayscale(.8) brightness(.5)}
  .res{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px 36px;background:#000;border:2px solid var(--acc2);color:var(--acc2);font-size:20px;letter-spacing:.2em;font-weight:700;z-index:5;white-space:nowrap;animation:rs .35s cubic-bezier(.2,1.4,.4,1) both}
  .res.ok{border-color:var(--acc);color:var(--acc);box-shadow:0 0 40px rgba(56,255,106,.4)}
  @keyframes rs{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}
</style>
