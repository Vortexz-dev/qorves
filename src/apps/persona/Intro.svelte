<script lang="ts">
  /* Persona.ID açılış: biyometrik tarama → isim çözme → panel açılır. Tıkla/tuşla geç. */
  import { onMount } from 'svelte';
  import { P } from './psfx';
  let { name, avatar, sub, ondone }: { name: string; avatar: string; sub: string; ondone: () => void } = $props();
  let step = $state(0), shown = $state(''), lines = $state<string[]>([]), out = $state(false), pct = $state(0);
  const G = '#$%&@01<>/\\=+*ΞΨΔ░▒';
  const L = ['> biyometrik imza okunuyor', '> retina deseni · 214 nokta eşleşti', '> nöral kimlik çipi el sıkıştı', '> sivil kayıt ağı · erişim verildi'];
  let done = false;
  function finish() { if (done) return; done = true; out = true; P.unlock(); setTimeout(ondone, 620); }
  onMount(() => {
    P.boot(); const T: ReturnType<typeof setTimeout>[] = [];
    T.push(setTimeout(() => { step = 1; P.scan(); }, 250));
    L.forEach((l, i) => T.push(setTimeout(() => { lines = [...lines, l]; P.type(); }, 420 + i * 330)));
    const iv = setInterval(() => { pct = Math.min(100, pct + 3.2); }, 40);
    T.push(setTimeout(() => {
      step = 2; let k = 0;
      const dec = setInterval(() => { k++; shown = name.split('').map((ch, i) => (i < k / 2 ? ch : ch === ' ' ? ' ' : G[Math.floor(Math.random() * G.length)])).join(''); if (k % 2) P.type(); if (k / 2 >= name.length) { clearInterval(dec); shown = name; } }, 28);
    }, 1500));
    T.push(setTimeout(finish, 2700));
    const key = () => finish(); addEventListener('keydown', key);
    return () => { T.forEach(clearTimeout); clearInterval(iv); removeEventListener('keydown', key); };
  });
</script>
<div class="in" class:out role="presentation" onpointerdown={finish}>
  <div class="half t"></div><div class="half b"></div>
  <div class="core">
    <div class="eye" class:on={step >= 1}>
      <svg viewBox="0 0 200 200" class="rings">
        <circle cx="100" cy="100" r="96" class="r1" /><circle cx="100" cy="100" r="86" class="r2" /><circle cx="100" cy="100" r="74" class="r3" />
        {#each Array(36) as _, i}<line x1="100" y1="2" x2="100" y2={i % 3 ? 8 : 14} transform="rotate({i * 10} 100 100)" />{/each}
      </svg>
      <div class="ph"><img src={avatar} alt="" /><i class="sc"></i></div>
    </div>
    <div class="txt">
      <div class="k mono">PERSONA.ID · KİMLİK ÇEKİRDEĞİ</div>
      <h1 class:on={step >= 2}>{shown || ' '}</h1>
      <div class="sub mono">{step >= 2 ? sub : ''}</div>
      <div class="ls mono">{#each lines as l}<div>{l}</div>{/each}</div>
      <div class="bar"><i style:width="{pct}%"></i><span class="mono">{Math.round(pct)}%</span></div>
    </div>
  </div>
</div>
<style>
  .in{position:absolute;inset:0;z-index:50;display:grid;place-items:center;overflow:hidden}
  .half{position:absolute;left:0;right:0;height:50%;background:#050307;transition:transform .6s cubic-bezier(.7,0,.2,1)}
  .half.t{top:0;border-bottom:1px solid rgba(255,93,93,.5)}.half.b{bottom:0;border-top:1px solid rgba(255,93,93,.5)}
  .out .half.t{transform:translateY(-101%)}.out .half.b{transform:translateY(101%)}
  .out .core{opacity:0;transform:scale(1.08);filter:blur(4px)}
  .core{position:relative;display:flex;align-items:center;gap:44px;transition:all .45s}
  .eye{position:relative;width:230px;height:230px;opacity:0;transform:scale(.7);transition:all .5s cubic-bezier(.2,1.4,.4,1)}
  .eye.on{opacity:1;transform:none}
  .rings{position:absolute;inset:0;width:100%;height:100%;fill:none}
  .rings circle{stroke:#ff5d5d}.r1{stroke-width:1;stroke-dasharray:4 6;animation:sp 9s linear infinite;transform-origin:center}
  .r2{stroke-width:2;stroke-dasharray:120 40 20 40;animation:sp 4s linear infinite reverse;transform-origin:center;stroke:#5ef6ff !important}
  .r3{stroke-width:1;opacity:.5}
  .rings line{stroke:#ff5d5d;stroke-width:1.2;opacity:.6}
  @keyframes sp{to{transform:rotate(360deg)}}
  .ph{position:absolute;inset:38px;border-radius:50%;overflow:hidden;border:1px solid rgba(94,246,255,.5)}
  .ph img{width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.2) sepia(1) hue-rotate(-40deg) saturate(2.2) brightness(.8)}
  .sc{position:absolute;left:0;right:0;height:30%;background:linear-gradient(transparent,rgba(94,246,255,.55),transparent);animation:scan 1.1s ease-in-out infinite alternate}
  @keyframes scan{from{top:-30%}to{top:100%}}
  .txt{min-width:420px}
  .k{font-size:11px;letter-spacing:.42em;color:#ff5d5d}
  h1{font-family:var(--f-disp);font-size:44px;letter-spacing:.08em;margin:10px 0 2px;color:#fff;text-shadow:0 0 18px rgba(255,93,93,.6);min-height:56px;opacity:0;transition:opacity .2s}
  h1.on{opacity:1}
  .sub{font-size:12px;letter-spacing:.3em;color:#5ef6ff;min-height:16px}
  .ls{margin-top:18px;font-size:12px;color:rgba(255,200,200,.75);line-height:1.8;min-height:86px}
  .ls div{animation:ty .3s steps(18)}
  @keyframes ty{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
  .bar{position:relative;height:4px;background:rgba(255,93,93,.15);margin-top:12px}
  .bar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#ff5d5d,#5ef6ff);box-shadow:0 0 12px #ff5d5d}
  .bar span{position:absolute;right:0;top:8px;font-size:10px;color:#ff5d5d;letter-spacing:.2em}
</style>
