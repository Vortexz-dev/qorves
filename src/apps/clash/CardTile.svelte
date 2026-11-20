<script lang="ts">
  import { CARD, upCost, evoTier, MAX_LV } from './cards';
  let { id, lv = 1, n = -1, locked = false, small = false, sel = false, up = false, onclick, onenter, delay = 0 }:
    { id: string; lv?: number; n?: number; locked?: boolean; small?: boolean; sel?: boolean; up?: boolean; onclick?: () => void; onenter?: () => void; delay?: number } = $props();
  const IMG = import.meta.env.BASE_URL + 'img/clash/';
  const c = $derived(CARD[id]!);
  const need = $derived(upCost(id, lv)?.copies ?? 0);
  const ev = $derived(evoTier(lv));
</script>

<button class={'ct r-' + c.rarity} class:small class:sel class:locked class:ev1={ev === 1} class:ev2={ev === 2} style={`--d:${delay}ms`} {onclick} onmouseenter={onenter} type="button">
  <img src={`${IMG}card_${id}.webp`} alt={c.name} draggable="false" />
  <b class="cost">{c.cost}</b>
  {#if !locked}<span class="lv">Sv {lv}</span>{/if}
  {#if ev}<span class="evo">{ev === 2 ? 'EVO II' : 'EVO I'}</span>{/if}
  <span class="nm">{c.name}</span>
  {#if n >= 0 && !locked}
    <span class="bar" class:full={lv >= MAX_LV || n >= need}><i style={`width:${lv >= MAX_LV ? 100 : Math.min(100, (n / Math.max(1, need)) * 100)}%`}></i><em>{lv >= MAX_LV ? 'MAKS' : `${n}/${need}`}</em></span>
  {/if}
  {#if up}<span class="up">▲</span>{/if}
  {#if locked}<span class="lk">?</span>{/if}
</button>

<style>
  .ct{position:relative;aspect-ratio:3/4;width:100%;border-radius:10px;overflow:hidden;background:#0b0f16;border:2px solid var(--rc);padding:0;color:#fff;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.06);transition:transform .15s,box-shadow .15s;animation:tin .45s cubic-bezier(.2,1.3,.4,1) var(--d) both}
  @keyframes tin{from{opacity:0;transform:translateY(16px) scale(.92)}}
  .ct:hover{transform:translateY(-4px) scale(1.03);box-shadow:0 10px 26px rgba(0,0,0,.6),0 0 18px color-mix(in srgb,var(--rc) 60%,transparent)}
  .ct.sel{outline:3px solid #fcee0a;outline-offset:2px}
  .r-common{--rc:#6f8aa3}.r-rare{--rc:#ff9b2f}.r-epic{--rc:#c060ff}.r-legendary{--rc:#5ff2d6}
  .r-legendary{background:linear-gradient(135deg,#0b0f16,#122a2a)}
  img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .ct::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(0,0,0,.88));pointer-events:none}
  .r-legendary::before{content:'';position:absolute;inset:0;z-index:2;background:linear-gradient(115deg,transparent 30%,rgba(140,255,240,.28) 45%,transparent 60%);background-size:250% 100%;animation:shine 3.2s linear infinite;pointer-events:none}
  @keyframes shine{from{background-position:150% 0}to{background-position:-100% 0}}
  .cost{position:absolute;top:4px;left:4px;z-index:3;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#ff9df3,#b0129a 60%,#4a003f);border:2px solid #ffd0f6;font-size:13px;font-weight:900;text-shadow:0 1px 2px #000}
  .lv{position:absolute;top:5px;right:5px;z-index:3;font:700 10px var(--f-mono,monospace);padding:2px 5px;border-radius:4px;background:rgba(0,0,0,.7);border:1px solid var(--rc)}
  .evo{position:absolute;top:26px;right:5px;z-index:3;font:800 8.5px var(--f-mono,monospace);letter-spacing:.08em;padding:1px 4px;border-radius:3px;background:#5a1d8f;color:#fff}
  .ev2 .evo{background:linear-gradient(90deg,#b07900,#ffd257);color:#1a0d00}
  .ev1{box-shadow:0 0 0 2px #a65cff,0 0 16px rgba(166,92,255,.55)}
  .ev2{box-shadow:0 0 0 2px #ffd257,0 0 20px rgba(255,210,87,.6)}
  .nm{position:absolute;left:0;right:0;bottom:16px;z-index:3;text-align:center;font:800 11px var(--f-disp,sans-serif);letter-spacing:.04em;text-shadow:0 1px 3px #000;padding:0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .small .nm{font-size:9.5px;bottom:4px}
  .bar{position:absolute;left:6px;right:6px;bottom:3px;z-index:3;height:11px;border-radius:6px;background:rgba(0,0,0,.75);border:1px solid rgba(255,255,255,.18);overflow:hidden}
  .bar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#1a7fd1,#3ff0ff)}
  .bar.full i{background:linear-gradient(90deg,#1aa851,#7dff7a)}
  .bar em{position:relative;display:block;text-align:center;font:700 8.5px/11px var(--f-mono,monospace);font-style:normal;text-shadow:0 1px 1px #000}
  .up{position:absolute;bottom:20px;right:4px;z-index:4;color:#7dff7a;font-size:16px;text-shadow:0 0 6px #000;animation:bob 1s ease-in-out infinite}
  @keyframes bob{50%{transform:translateY(-4px)}}
  .locked img{filter:grayscale(1) brightness(.3)}
  .lk{position:absolute;inset:0;z-index:3;display:grid;place-items:center;font:900 34px var(--f-disp,sans-serif);color:rgba(255,255,255,.35)}
</style>
