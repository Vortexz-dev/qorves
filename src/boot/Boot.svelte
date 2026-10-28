<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { sfx } from '../lib/sfx';
  import Backdrop from '../ui/Backdrop.svelte';
  import Logo from '../ui/Logo.svelte';

  const LINES = [
    ['QORVES·OS ÇEKİRDEK 9.4.17  —  KAYIT ÇEKİRDEĞİ', 'h'],
    ['(c) Ortak Hat Kayıt Ağı · bağlı zekâ modülü · Öz-Yazım kilidi: AKTİF', 'm'],
    ['ön yükleyici imzası ..................... doğrulandı  [OK]', ''],
    ['bellek denetimi ........................ 65536 MB  [OK]', 'bar'],
    ['krom kontrol veriyolu .................. bulundu  [OK]', ''],
    ['nöral arayüz sürücüsü .................. v3.2  [OK]', ''],
    ['rün mührü arayüzü ...................... beklemede', 'm'],
    ['hat ağı alıcısı ........................ 31 düğüm / 30 hat', 'bar'],
    ['süt kanalı senkronu .................... kilitlendi  [OK]', ''],
    ['sinyal gürültüsü ....................... %3.1 · süzülüyor', 'g'],
    ['kodeks önbelleği ....................... şifreli bölüm [MÜHÜRLÜ]', 'r'],
    ['saat kaynağı ........................... SS takvimi', ''],
    ['yıldız haritası tamponu ................ 28 sistem  [OK]', 'bar'],
    ['güvenlik duvarı ICE-3 .................. etkin  [OK]', ''],
    ['kimlik modülü .......................... hazır', ''],
    ['arayüz katmanı yükleniyor ...', 'y'],
  ] as const;
  const STEP = 260, T0 = 260;
  const at = (i: number) => T0 + i * STEP + LINES.slice(0, i).filter((l) => l[1] === 'bar').length * 520;
  let shown = $state(0);
  let ready = $state(session.stage === 'press');
  let leaving = $state(false), glitch = $state(false), flash = $state(false);
  let timers: number[] = [];

  function go() {
    if (leaving) return;
    if (!ready) return; // açılış animasyonu atlanamaz
    leaving = true; sfx.glitch(); sfx.open();
    setTimeout(() => (session.stage = 'login'), 650);
  }
  onMount(() => {
    if (!ready) {
      LINES.forEach((l, i) => timers.push(window.setTimeout(() => { shown = i + 1; if (l[1] === 'g') { glitch = true; setTimeout(() => (glitch = false), 260); } }, at(i))));
      const end = at(LINES.length) + 1300;
      timers.push(window.setTimeout(() => { flash = true; }, end - 380));
      timers.push(window.setTimeout(() => { ready = true; session.stage = 'press'; }, end));
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
    <pre class="term mono" class:gl={glitch} class:fl={flash}>{#each LINES.slice(0, shown) as [t, c]}<span class={c}>{t}</span>{#if c === 'bar'}<span class="pb"><i></i></span>{/if}
{/each}<span class="cur">█</span></pre>
    <div class="hex mono" aria-hidden="true">{#each Array(shown * 2) as _, i}<div>{(0x7f3a00 + i * 0x1c4).toString(16).toUpperCase()}  {Array.from({ length: 8 }, (_, k) => ((i * 37 + k * 91) % 256).toString(16).padStart(2, '0')).join(' ')}</div>{/each}</div>
    <div class="prog mono"><span>ÇEKİRDEK YÜKLENİYOR</span><b style:width="{Math.round((shown / LINES.length) * 100)}%"></b><em>{Math.round((shown / LINES.length) * 100)}%</em></div>
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
  .term .g{color:#ff5a7a;text-shadow:2px 0 #00f0ff,-2px 0 #ff2a55}
  .pb{display:inline-block;width:120px;height:6px;margin-left:14px;border:1px solid rgba(0,240,255,.4);vertical-align:middle}
  .pb i{display:block;height:100%;background:var(--cy);box-shadow:0 0 8px var(--cy);animation:pbf .5s steps(10) both}
  @keyframes pbf{from{width:0}to{width:100%}}
  .term.gl{animation:tgl .26s steps(3)}
  @keyframes tgl{0%{transform:translate(0)}33%{transform:translate(-6px,2px) skewX(6deg);filter:hue-rotate(90deg)}66%{transform:translate(5px,-1px);clip-path:inset(20% 0 35% 0)}100%{transform:none}}
  .term.fl{animation:tfl .38s steps(4) forwards}
  @keyframes tfl{0%{opacity:1}30%{opacity:.3;transform:scaleY(1.02)}60%{opacity:1;filter:brightness(2)}100%{opacity:0;transform:scaleY(.04)}}
  .hex{position:absolute;right:5vw;top:9vh;font-size:11px;line-height:1.55;color:rgba(0,240,255,.28);white-space:pre;max-height:70vh;overflow:hidden;text-align:right}
  .hex div{animation:fade .3s both}
  .prog{position:absolute;left:6vw;bottom:9vh;width:420px;font-size:10.5px;letter-spacing:.3em;color:var(--mut);display:grid;grid-template-columns:1fr auto;gap:6px}
  .prog b{grid-column:1/3;display:block;height:3px;background:linear-gradient(90deg,var(--cy),var(--ye));box-shadow:0 0 10px var(--cy);transition:width .3s}
  .prog em{grid-row:1;grid-column:2;font-style:normal;color:var(--cy)}
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
