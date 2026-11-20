<script lang="ts">
  /* Sandık açılışı: düşer → sallanır → yüklenir → patlar (kapalı → açık görsel) → kartlar tek tek → özet. Her aşamada ses. */
  import { onMount } from 'svelte';
  import { CARD, RARITY_TR } from './cards';
  import { CHESTS, type ChestId, type Drop } from './economy';
  import { S } from './audio';
  let { chest, bit, drops, onclose }: { chest: ChestId; bit: number; drops: Drop[]; onclose: () => void } = $props();
  const IMG = import.meta.env.BASE_URL + 'img/clash/';
  const def = $derived(CHESTS[chest]);
  let ph = $state<'drop' | 'shake' | 'charge' | 'open' | 'cards' | 'sum'>('drop'), idx = $state(-1), bitShown = $state(0);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
  onMount(() => {
    S.whoosh();
    at(550, () => { ph = 'shake'; S.chestShake(); });
    at(900, () => S.chestShake()); at(1250, () => S.chestShake());
    at(1550, () => { ph = 'charge'; S.chestCharge(); });
    at(2600, () => { ph = 'open'; S.chestOpen(chest === 'leg' || chest === 'neon'); });
    at(3300, () => next());
    return () => timers.forEach(clearTimeout);
  });
  function next() {
    if (ph === 'sum') { S.click(); onclose(); return; }
    if (idx + 1 < drops.length) { ph = 'cards'; idx++; const d = drops[idx]!; S.cardFlip(); at(180, () => S.rarity(CARD[d.id]!.rarity)); return; }
    ph = 'sum'; S.whoosh(); let k = 0; const N = 24; const tick = () => { k++; bitShown = Math.round((bit * k) / N); if (k % 3 === 0) S.coin(); if (k < N) at(28, tick); }; at(200, tick);
  }
  const cur = $derived(idx >= 0 ? drops[idx] : null);
</script>

<div class="co" class:legend={chest === 'leg'} role="button" tabindex="0" onclick={() => { if (ph === 'cards' || ph === 'sum') next(); }} onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') next(); }}>
  <div class="rays" class:on={ph === 'open' || ph === 'cards' || ph === 'sum'}></div>
  <div class="ttl">{def.name}</div>
  <div class="box" class:shake={ph === 'shake'} class:charge={ph === 'charge'} class:opened={ph !== 'drop' && ph !== 'shake' && ph !== 'charge'} class:aside={ph === 'cards' || ph === 'sum'}>
    <img class="closed" src={`${IMG}${def.img}.webp`} alt="" />
    <img class="open" src={`${IMG}${def.img}_open.webp`} alt="" />
    <div class="burst"></div>
  </div>
  {#if ph === 'cards' && cur}
    {#key idx}
      {@const c = CARD[cur.id]!}
      <div class={'drop r-' + c.rarity}>
        <div class="cimg"><img src={`${IMG}card_${cur.id}.webp`} alt="" />{#if cur.isNew}<span class="new">YENİ!</span>{/if}</div>
        <div class="info"><span class="rar">{RARITY_TR[c.rarity]}</span><b>{c.name}</b><em>×{cur.n}</em><small>{c.role}</small></div>
      </div>
    {/key}
    <div class="left">{drops.length - idx - 1} kart kaldı · devam için tıkla</div>
  {/if}
  {#if ph === 'sum'}
    <div class="sum">
      <div class="bits"><img src={`${IMG}cur_bit.webp`} alt="" /><b>+{bitShown}</b><span>BIT</span></div>
      <div class="grid">{#each drops as d, i (d.id)}{@const c = CARD[d.id]!}<div class={'mini r-' + c.rarity} style={`--d:${i * 60}ms`}><img src={`${IMG}card_${d.id}.webp`} alt="" /><em>×{d.n}</em>{#if d.isNew}<i>YENİ</i>{/if}</div>{/each}</div>
      <button class="ok" type="button">TAMAM</button>
    </div>
  {/if}
</div>

<style>
  .co{position:absolute;inset:0;z-index:60;background:radial-gradient(ellipse at center,rgba(20,30,50,.85),rgba(0,0,0,.96));display:grid;place-items:center;cursor:pointer;animation:fade .3s both;overflow:hidden;outline:none}
  @keyframes fade{from{opacity:0}}
  .ttl{position:absolute;top:6%;font:900 34px var(--f-disp,sans-serif);letter-spacing:.2em;color:#fff;text-shadow:0 0 20px #00e5ff;animation:tdrop .6s cubic-bezier(.2,1.4,.3,1) both}
  .legend .ttl{text-shadow:0 0 20px #ffd257;color:#fff3c4}
  @keyframes tdrop{from{transform:translateY(-60px);opacity:0}}
  .rays{position:absolute;width:160vmax;height:160vmax;background:repeating-conic-gradient(from 0deg,rgba(255,230,140,.06) 0 5deg,transparent 5deg 20deg);mask-image:radial-gradient(circle,#000 10%,transparent 55%);-webkit-mask-image:radial-gradient(circle,#000 10%,transparent 55%);opacity:0;transition:opacity .4s;animation:spin 14s linear infinite}
  .rays.on{opacity:1}
  @keyframes spin{to{transform:rotate(360deg)}}
  .box{position:relative;width:min(40vmin,380px);aspect-ratio:1;animation:bdrop .55s cubic-bezier(.3,1.6,.5,1) both;transition:transform .6s cubic-bezier(.2,1,.3,1),width .6s}
  @keyframes bdrop{from{transform:translateY(-70vh) scale(.6)}}
  .box img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 20px 30px rgba(0,0,0,.7))}
  .box .open{opacity:0}
  .box.opened .closed{opacity:0}.box.opened .open{opacity:1;animation:pop .4s cubic-bezier(.2,1.8,.4,1)}
  @keyframes pop{from{transform:scale(1.25)}}
  .box.shake{animation:sh .32s ease-in-out infinite}
  @keyframes sh{25%{transform:rotate(-6deg) translateY(-6px)}75%{transform:rotate(6deg) translateY(-6px)}}
  .box.charge{animation:ch 1s ease-in both}
  .box.charge img{filter:drop-shadow(0 0 30px #fff) brightness(1.5)}
  @keyframes ch{0%{transform:scale(1)}80%{transform:scale(1.15) rotate(2deg)}100%{transform:scale(.9)}}
  .burst{position:absolute;inset:-50%;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95),rgba(255,220,120,.5) 30%,transparent 65%);opacity:0;pointer-events:none}
  .box.opened .burst{animation:burst .7s ease-out both}
  @keyframes burst{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(1.6)}}
  .box.aside{transform:translate(-30vw,14vh) scale(.6)}
  .drop{position:absolute;display:flex;gap:28px;align-items:center;animation:fly .5s cubic-bezier(.2,1.3,.4,1) both}
  @keyframes fly{from{transform:translate(-26vw,16vh) scale(.2) rotate(-25deg);opacity:0}}
  .cimg{position:relative;width:min(26vmin,240px);aspect-ratio:3/4;border-radius:14px;overflow:hidden;border:3px solid var(--rc);box-shadow:0 0 40px color-mix(in srgb,var(--rc) 70%,transparent),0 20px 40px rgba(0,0,0,.7)}
  .cimg img{width:100%;height:100%;object-fit:cover}
  .new{position:absolute;top:8px;left:8px;background:#ff2a55;color:#fff;font:900 13px var(--f-disp,sans-serif);padding:3px 8px;border-radius:5px;animation:pulse .8s ease-in-out infinite}
  @keyframes pulse{50%{transform:scale(1.12)}}
  .info{display:grid;gap:6px}
  .info .rar{font:700 13px var(--f-mono,monospace);letter-spacing:.3em;color:var(--rc);text-transform:uppercase}
  .info b{font:900 40px var(--f-disp,sans-serif);color:#fff}
  .info em{font:900 52px var(--f-disp,sans-serif);color:#fcee0a;font-style:normal;text-shadow:0 0 18px rgba(252,238,10,.5);animation:cnt .5s cubic-bezier(.2,1.8,.4,1) .2s both}
  @keyframes cnt{from{transform:scale(2.4);opacity:0}}
  .info small{color:#9fb6c6;font-size:14px}
  .r-common{--rc:#8aa7c0}.r-rare{--rc:#ff9b2f}.r-epic{--rc:#c060ff}.r-legendary{--rc:#5ff2d6}
  .left{position:absolute;bottom:7%;font:600 13px var(--f-mono,monospace);letter-spacing:.2em;color:#9fb6c6;animation:bl 1.2s ease-in-out infinite}
  @keyframes bl{50%{opacity:.4}}
  .sum{position:absolute;display:grid;justify-items:center;gap:22px;animation:fly2 .5s cubic-bezier(.2,1.2,.4,1) both}
  @keyframes fly2{from{transform:translateY(40px);opacity:0}}
  .bits{display:flex;align-items:center;gap:12px}.bits img{width:56px;height:56px;object-fit:contain}.bits b{font:900 48px var(--f-disp,sans-serif);color:#7dffb0}.bits span{font:700 14px var(--f-mono,monospace);letter-spacing:.3em;color:#9fb6c6}
  .grid{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;max-width:70vw}
  .mini{position:relative;width:110px;aspect-ratio:3/4;border-radius:9px;overflow:hidden;border:2px solid var(--rc);animation:fly2 .4s var(--d) both}
  .mini img{width:100%;height:100%;object-fit:cover}
  .mini em{position:absolute;bottom:4px;right:6px;font:900 20px var(--f-disp,sans-serif);color:#fcee0a;font-style:normal;text-shadow:0 2px 3px #000}
  .mini i{position:absolute;top:4px;left:4px;background:#ff2a55;font:800 9px var(--f-mono,monospace);padding:1px 4px;border-radius:3px;font-style:normal}
  .ok{margin-top:6px;padding:12px 46px;font:900 18px var(--f-disp,sans-serif);letter-spacing:.2em;color:#04131a;background:linear-gradient(180deg,#7ff6ff,#13b7d6);border:0;border-radius:10px;cursor:pointer;box-shadow:0 6px 0 #076a80}
</style>
