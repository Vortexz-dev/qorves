<script lang="ts">
  /* Hack katmanı: her şeyin üstünde (tam ekran uygulamalar dahil), gerçek tam ekran. Akış: kuru kafa → tanıtım kartı → minioyun → sonuç. */
  import { onMount } from 'svelte';
  import type { GameId } from '../../lib/ghoskey';
  import { keyGuard, onGuardKey } from '../../lib/keyguard';
  import { setAmbientPaused } from '../../lib/sfx';
  import { META } from './meta';
  import { portal } from '../../lib/portal';
  import { H, preloadLaugh, tone, noise } from './hsfx';
  import Jumpscare from './Jumpscare.svelte';
  import Breach from './games/Breach.svelte';
  import Circuit from './games/Circuit.svelte';
  import Kernel from './games/Kernel.svelte';
  import Memde from './games/Memde.svelte';
  import Shift from './games/Shift.svelte';
  import Tokenine from './games/Tokenine.svelte';
  import Tunnel from './games/Tunnel.svelte';
  let { game, diff, signal = 3, mode, target = '', scare = true, ondone }: {
    game: GameId; diff: number; signal?: number; mode: 'in' | 'out'; target?: string; scare?: boolean; ondone: (ok: boolean) => void;
  } = $props();
  let phase = $state<'scare' | 'card' | 'play' | 'win' | 'boot'>(scare ? 'scare' : 'card');
  let lines = $state<string[]>([]), result = false;
  const m = $derived(META[game]);
  function play() { if (phase !== 'card') return; H.start(); phase = 'play'; }
  function end(ok: boolean) {
    result = ok;
    if (ok) { phase = 'win'; H.win(); setTimeout(() => ondone(true), mode === 'in' ? 2600 : 1800); return; }
    if (mode === 'out') { ondone(false); return; }
    // savunma kaybedildi: sistem yeniden başlar
    phase = 'boot'; lines = [];
    noise(0.6, 0.3, 200, 0.6, 'lowpass'); tone(60, 1.2, 'sawtooth', 0.15, -30);
    const L = ['!! KERNEL PANIC · yetkisiz kök erişimi', 'qos: oturum dondu · bellek dökülüyor…', 'watchdog: zorunlu yeniden başlatma', '', 'QORVES-OS 4.2 · POST ············ OK', 'çekirdek doğrulanıyor ·········· OK', 'ağ yığını temizlendi ··········· OK', 'masaüstü geri yükleniyor…'];
    let i = 0; const iv = setInterval(() => { lines = [...lines, L[i++]!]; H.tick(); if (i >= L.length) { clearInterval(iv); setTimeout(() => ondone(false), 1100); } }, 380);
  }
  onMount(() => {
    keyGuard.active++; setAmbientPaused(true); preloadLaugh();
    (document.activeElement as HTMLElement | null)?.blur?.();
    const off = onGuardKey((e) => { if (phase === 'card' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); play(); } });
    return () => { keyGuard.active = Math.max(0, keyGuard.active - 1); off(); setAmbientPaused(false); };
  });
  void result;
</script>

<div class="hs" use:portal style="--acc:{m.acc};--acc2:{m.acc2};--bg:{m.bg}" role="dialog" aria-modal="true" aria-label="Hack">
  {#if phase === 'scare'}<Jumpscare ondone={() => (phase = 'card')} />{/if}
  {#if phase === 'card'}
    <div class="card" onclick={play} role="presentation">
      <div class="rays"></div>
      <div class="cb">
        <span class="k mono">{mode === 'in' ? '⚠ GELEN SALDIRI · SİSTEMİNİ SAVUN' : '▶ SIZMA · ' + (target || 'HEDEF')}</span>
        <h1 class="mono" data-t={m.name}>{m.name}</h1>
        <span class="tg mono">{m.tag}</span>
        <ol>{#each m.how as h, i}<li style="animation-delay:{0.25 + i * 0.12}s">{h}</li>{/each}</ol>
        <div class="kk mono">{#each m.keys as [k, v]}<span><kbd>{k}</kbd>{v}</span>{/each}</div>
        <button class="go mono" onclick={(e) => { e.stopPropagation(); play(); }}>{mode === 'in' ? 'SAVUNMAYA BAŞLA' : 'SIZMAYA BAŞLA'} <small>ENTER</small></button>
        <span class="nt mono">Süre ilk hamlende başlar · Oyun içinde ? ile yardım</span>
      </div>
    </div>
  {/if}
  {#if phase === 'play'}
    <div class="pl">
      {#if game === 'breach'}<Breach {diff} {signal} onend={end} />
      {:else if game === 'circuit'}<Circuit {diff} {signal} onend={end} />
      {:else if game === 'kernel'}<Kernel {diff} {signal} onend={end} />
      {:else if game === 'memde'}<Memde {diff} {signal} onend={end} />
      {:else if game === 'shift'}<Shift {diff} {signal} onend={end} />
      {:else if game === 'token'}<Tokenine {diff} {signal} onend={end} />
      {:else}<Tunnel {diff} {signal} onend={end} />{/if}
    </div>
  {/if}
  {#if phase === 'win'}
    <div class="win">
      <div class="ring"></div>
      <b class="mono">{mode === 'in' ? 'SALDIRI SAVUNULDU' : 'ERİŞİM SAĞLANDI'}</b>
      <span class="mono">{mode === 'in' ? 'Kontrol geri alındı · iz silindi · ' + m.name : target + ' açıldı · ' + m.name}</span>
    </div>
  {/if}
  {#if phase === 'boot'}
    <div class="boot mono"><div class="crash"></div>{#each lines as l}<div>{l}&nbsp;</div>{/each}<i class="cur">█</i></div>
  {/if}
</div>

<style>
  .hs{position:fixed;inset:0;z-index:2147483000;background:#000;overflow:hidden;cursor:default;user-select:none}
  .pl{position:absolute;inset:0;animation:pin .5s cubic-bezier(.2,.8,.2,1) both}
  @keyframes pin{0%{clip-path:inset(50% 0 50% 0);filter:brightness(3)}60%{clip-path:inset(0);filter:brightness(1.4)}100%{filter:none}}
  .card{position:absolute;inset:0;background:radial-gradient(ellipse at center,color-mix(in srgb,var(--acc) 10%,var(--bg)) 0%,var(--bg) 60%,#000 100%);display:grid;place-items:center;animation:cin .45s both}
  @keyframes cin{0%{opacity:0;transform:scale(1.08);filter:blur(10px)}}
  .rays{position:absolute;inset:-50%;background:repeating-conic-gradient(from 0deg,transparent 0 6deg,color-mix(in srgb,var(--acc) 6%,transparent) 6deg 7deg);animation:rot 40s linear infinite;mask-image:radial-gradient(circle,#000 10%,transparent 60%)}
  @keyframes rot{to{transform:rotate(360deg)}}
  .cb{position:relative;width:min(760px,90vw);padding:34px 40px;border:1px solid var(--acc);background:color-mix(in srgb,var(--bg) 88%,#000);box-shadow:0 0 80px color-mix(in srgb,var(--acc) 22%,transparent);
    clip-path:polygon(0 0,calc(100% - 28px) 0,100% 28px,100% 100%,28px 100%,0 calc(100% - 28px));display:flex;flex-direction:column;gap:10px}
  .k{font-size:11px;letter-spacing:.32em;color:var(--acc2)}
  h1{position:relative;margin:4px 0 0;font-size:clamp(34px,5vw,58px);letter-spacing:.12em;color:var(--acc);text-shadow:0 0 24px color-mix(in srgb,var(--acc) 60%,transparent);animation:ty .6s steps(14) both}
  @keyframes ty{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
  h1::after{content:attr(data-t);position:absolute;left:0;top:0;color:var(--acc2);opacity:0;animation:gl 2.6s .7s infinite steps(1)}
  @keyframes gl{0%,90%,100%{opacity:0}91%{opacity:.8;transform:translate(4px,-2px);clip-path:inset(30% 0 40% 0)}94%{opacity:.8;transform:translate(-3px,1px);clip-path:inset(70% 0 5% 0)}}
  .tg{font-size:11px;letter-spacing:.3em;color:color-mix(in srgb,var(--acc) 60%,#888);margin-bottom:8px}
  ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px;font-size:15.5px;line-height:1.45;color:#d8e6e0}
  li{animation:li .35s both}@keyframes li{from{opacity:0;transform:translateX(-12px)}}
  .kk{display:flex;flex-wrap:wrap;gap:14px;margin:8px 0 6px;font-size:11px;color:#9ab}
  kbd{display:inline-block;min-width:22px;padding:2px 7px;margin-right:8px;border:1px solid color-mix(in srgb,var(--acc) 50%,transparent);color:var(--acc);font:inherit;font-size:10.5px;text-align:center}
  .go{align-self:flex-start;margin-top:8px;padding:13px 26px;background:var(--acc);color:#000;border:0;font-size:14px;font-weight:700;letter-spacing:.24em;cursor:pointer;box-shadow:0 0 24px color-mix(in srgb,var(--acc) 50%,transparent);animation:gp 1.4s ease-in-out infinite}
  .go small{font-size:10px;opacity:.6;margin-left:10px}
  @keyframes gp{50%{box-shadow:0 0 6px color-mix(in srgb,var(--acc) 30%,transparent)}}
  .nt{font-size:10.5px;letter-spacing:.2em;color:#6d7f79}
  .win{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:14px;background:radial-gradient(circle,color-mix(in srgb,var(--acc) 18%,#000),#000 70%);animation:cin .4s both}
  .win b{font-size:clamp(30px,5vw,56px);letter-spacing:.18em;color:var(--acc);text-shadow:0 0 30px var(--acc)}
  .win span{font-size:13px;letter-spacing:.24em;color:#cfe}
  .ring{position:absolute;left:50%;top:50%;width:40px;height:40px;border:3px solid var(--acc);border-radius:50%;transform:translate(-50%,-50%);animation:rg 1.2s ease-out infinite}
  @keyframes rg{to{width:120vmax;height:120vmax;opacity:0}}
  .boot{position:absolute;inset:0;background:#000;color:#cfe;padding:8vh 10vw;font-size:15px;line-height:1.75;letter-spacing:.06em}
  .boot div:first-of-type{color:#ff3355}
  .crash{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,40,60,.12) 0 2px,transparent 2px 5px);animation:cr 1.2s steps(6) forwards}
  @keyframes cr{0%{opacity:1;transform:translateX(-20px) skewX(8deg)}50%{opacity:.6;transform:translateX(30px)}100%{opacity:0;transform:none}}
  .cur{font-style:normal;animation:bl .7s steps(2) infinite;color:#cfe}@keyframes bl{50%{opacity:0}}
</style>
