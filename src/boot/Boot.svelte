<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { sfx } from '../lib/sfx';
  import Backdrop from '../ui/Backdrop.svelte';
  import Logo from '../ui/Logo.svelte';

  const LINES = [
    ['QORVES·OS ÇEKİRDEK 9.4.17  —  KAYIT ÇEKİRDEĞİ', 'h'],
    ['(c) Ortak Hat Kayıt Ağı · bağlı zekâ modülü · Öz-Yazım kilidi: AKTİF', 'm'],
    ['bellek denetimi ........................ 65536 MB  [OK]', ''],
    ['krom kontrol veriyolu .................. bulundu  [OK]', ''],
    ['rün mührü arayüzü ...................... beklemede', 'm'],
    ['hat ağı alıcısı ........................ 31 düğüm / 30 hat', ''],
    ['süt kanalı senkronu .................... kilitlendi  [OK]', ''],
    ['kodeks önbelleği ....................... şifreli bölüm [MÜHÜRLÜ]', 'r'],
    ['saat kaynağı ........................... SS takvimi', ''],
    ['güvenlik duvarı ICE-3 .................. etkin  [OK]', ''],
    ['arayüz katmanı yükleniyor ...', 'y'],
  ] as const;
  let shown = $state(0);
  let ready = $state(session.stage === 'press');
  let leaving = $state(false);
  let timers: number[] = [];

  function finishBoot() { timers.forEach(clearTimeout); shown = LINES.length; ready = true; session.stage = 'press'; }
  function go() {
    if (leaving) return;
    if (!ready) return finishBoot();
    leaving = true; sfx.glitch(); sfx.open();
    setTimeout(() => (session.stage = 'login'), 650);
  }
  onMount(() => {
    if (!ready) {
      LINES.forEach((_, i) => timers.push(window.setTimeout(() => { shown = i + 1; }, 140 + i * 170 + (i > 8 ? 260 : 0))));
      timers.push(window.setTimeout(() => { ready = true; session.stage = 'press'; }, 140 + LINES.length * 170 + 700));
    }
    const k = (e: KeyboardEvent) => { if (!e.repeat) go(); };
    const p = () => go();
    window.addEventListener('keydown', k); window.addEventListener('pointerdown', p);
    return () => { timers.forEach(clearTimeout); window.removeEventListener('keydown', k); window.removeEventListener('pointerdown', p); };
  });
</script>

<div class="boot" class:leaving>
  <Backdrop dim={ready ? 0.15 : 0.82} />
  {#if !ready}
    <pre class="term mono">{#each LINES.slice(0, shown) as [t, c]}<span class={c}>{t}</span>
{/each}<span class="cur">█</span></pre>
  {:else}
    <div class="center">
      <div class="logo-in"><Logo size={68} /></div>
      <div class="sub mono">KÜME AĞINA HOŞ GELDİN · BAĞLANTI HAZIR</div>
      <div class="press">PRESS ANY KEY TO LOGIN</div>
      <div class="bar"><i></i></div>
    </div>
    <div class="corner tl mono">NODE 11 · ASTARION RELAY</div>
    <div class="corner tr mono">SİNYAL ▮▮▮▮▯</div>
    <div class="corner bl mono">QORVES·OS 9.4.17</div>
    <div class="corner br mono">ICE-3 · BAĞLI ZEKÂ · YASAL</div>
  {/if}
  <div class="flash"></div>
</div>

<style>
  .boot{position:absolute;inset:0;overflow:hidden}
  .term{position:absolute;left:6vw;top:9vh;font-size:15px;line-height:1.75;color:#9fdcf0;white-space:pre;text-shadow:0 0 6px rgba(0,240,255,.35)}
  .term .h{color:var(--ye);font-size:17px;letter-spacing:.08em}.term .m{color:var(--mut)}.term .r{color:var(--rd)}.term .y{color:var(--ye)}
  .cur{animation:blink .8s steps(1) infinite;color:var(--cy)}
  .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
  .logo-in{animation:lin .9s cubic-bezier(.2,.8,.2,1) both}
  @keyframes lin{0%{opacity:0;transform:scale(1.25);filter:blur(12px)}40%{opacity:1}60%{transform:scale(.98);filter:blur(0)}100%{transform:none}}
  .sub{font-size:12.5px;letter-spacing:.38em;color:var(--cy);opacity:.75;animation:fade .6s .5s both}
  .press{font-family:var(--f-disp);font-weight:700;font-size:20px;letter-spacing:.42em;color:var(--ye);margin-top:30px;
    text-shadow:0 0 14px rgba(252,238,10,.65);animation:fade .5s .9s both, pulse 1.6s 1.4s ease-in-out infinite}
  @keyframes pulse{50%{opacity:.35}}
  @keyframes fade{from{opacity:0;transform:translateY(6px)}}
  .bar{width:340px;height:2px;background:rgba(0,240,255,.15);overflow:hidden;animation:fade .5s 1s both}
  .bar i{display:block;height:100%;width:30%;background:linear-gradient(90deg,transparent,var(--cy),transparent);animation:sweep 2.2s linear infinite}
  @keyframes sweep{from{transform:translateX(-100%)}to{transform:translateX(340%)}}
  .corner{position:absolute;font-size:11px;letter-spacing:.2em;color:var(--mut);opacity:.8}
  .tl{left:28px;top:24px}.tr{right:28px;top:24px;color:var(--cy)}.bl{left:28px;bottom:24px}.br{right:28px;bottom:24px}
  .corner::before{content:"";display:inline-block;width:18px;height:1px;background:currentColor;margin-right:8px;vertical-align:middle}
  .flash{position:absolute;inset:0;pointer-events:none;opacity:0;background:linear-gradient(transparent 0 46%,rgba(0,240,255,.9) 46% 47%,transparent 47% 58%,rgba(255,42,85,.8) 58% 58.6%,transparent 58.6%)}
  .leaving .center{animation:out .65s steps(6) forwards}
  .leaving .flash{animation:fl .65s steps(5) forwards}
  @keyframes out{0%{transform:none}30%{transform:translateX(-14px) skewX(8deg);filter:hue-rotate(90deg)}60%{transform:translateX(10px);opacity:.6}100%{transform:scaleY(.02);opacity:0}}
  @keyframes fl{0%{opacity:0}20%{opacity:1}40%{opacity:.2;transform:translateY(-12vh)}70%{opacity:1;transform:translateY(18vh)}100%{opacity:0}}
</style>
