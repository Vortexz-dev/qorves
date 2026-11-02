<script lang="ts" module>
  // Masaüstü bildirimleri: DM sistem uyarıları (glitch'li, onay ister) + kısa uygulama bildirimleri (ghOS-Net vb.)
  export const toasts = $state({ list: [] as { id: number; app: string; title: string; body: string; act?: () => void; mini?: boolean }[] });
  let n = 0;
  export function pushToast(app: string, title: string, body: string, act?: () => void) {
    // tam ekran uygulama açıksa küçük toast: yalnız gönderen/başlık, 3.5 sn
    const mini = !!wm.core && !wm.coreMin;
    const id = ++n; toasts.list.push({ id, app, title, body, act, mini }); setTimeout(() => (toasts.list = toasts.list.filter((t) => t.id !== id)), mini ? 3600 : 7000);
  }
  import { wm } from '../desktop/wm.svelte';
</script>
<script lang="ts">
  import { onMount } from 'svelte';
  import { watchNotices, seenNotice, type Notice } from '../lib/live';
  import { sfx } from '../lib/sfx';
  let { uid }: { uid: string } = $props();
  let list = $state<Notice[]>([]);
  let known = new Set<string>();
  onMount(() => watchNotices(uid, (n) => { if (n.some((x) => !known.has(x.id))) (n.some((x) => x.level === 'crit') ? sfx.alarm : sfx.glitch)(); n.forEach((x) => known.add(x.id)); list = n; }));
  const ack = (x: Notice) => { list = list.filter((y) => y.id !== x.id); seenNotice(uid, x.id); sfx.click(); };
  let sw = $state<{ id: number; x: number; dx: number } | null>(null);
  const drop = (id: number) => (toasts.list = toasts.list.filter((y) => y.id !== id));
  const LV = { info: 'SİSTEM BİLDİRİMİ', warn: 'UYARI', crit: 'KRİTİK İHLAL' } as const;
</script>
{#each list.slice(-3) as x, i (x.id)}
  <div class="sn {x.level}" style:--i={i} role="alertdialog" aria-label={x.title}>
    <div class="nz"></div>
    <header class="mono"><span class="bl"></span>{LV[x.level] ?? LV.info}<em>{x.from ?? 'QORVES-OS ÇEKİRDEK'}</em></header>
    <h3 data-t={x.title}>{x.title}</h3>
    <p>{x.body}</p>
    <footer class="mono"><span>{new Date(x.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · KAYIT #{x.id.slice(-6).toUpperCase()}</span><button onclick={() => ack(x)}>ONAYLA</button></footer>
  </div>
{/each}
<div class="ts">
  {#each toasts.list as t (t.id)}
    {#if t.mini}
      <div class="tm" class:g={t.app === 'ghOS-Net'} role="status" style:transform={sw?.id === t.id ? `translateX(${Math.max(0, sw.dx)}px)` : undefined} style:opacity={sw?.id === t.id ? Math.max(0.15, 1 - sw.dx / 160) : undefined}
        onpointerdown={(e) => { sw = { id: t.id, x: e.clientX, dx: 0 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
        onpointermove={(e) => { if (sw?.id === t.id) sw = { ...sw, dx: e.clientX - sw.x }; }}
        onpointerup={() => { if (sw?.id === t.id && sw.dx > 70) drop(t.id); sw = null; }} onpointercancel={() => (sw = null)}>
        <i></i><b class="mono">{t.app}</b><span>{t.title}</span>
      </div>
    {:else}
    <button class="tt" class:g={t.app === 'ghOS-Net'} onclick={() => { t.act?.(); toasts.list = toasts.list.filter((y) => y.id !== t.id); }}>
      <b class="mono">{t.app}</b><span>{t.title}</span><small>{t.body}</small>
    </button>
    {/if}
  {/each}
</div>
<style>
  .sn{position:fixed;left:50%;top:calc(18vh + var(--i) * 26px);transform:translateX(calc(-50% + var(--i) * 18px));width:min(560px,90vw);z-index:15000;background:rgba(6,4,10,.94);border:1px solid var(--cy);box-shadow:0 0 40px rgba(0,240,255,.25),inset 0 0 30px rgba(0,240,255,.08);padding:16px 20px 12px;animation:sin .7s steps(1) both, sj 4s 1s infinite;overflow:hidden;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))}
  .sn.warn{border-color:var(--ye);box-shadow:0 0 40px rgba(252,238,10,.25)}.sn.crit{border-color:var(--rd);box-shadow:0 0 50px rgba(255,42,85,.4),inset 0 0 40px rgba(255,42,85,.12)}
  .nz{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 3px);mix-blend-mode:screen;animation:nz .25s steps(3) infinite}
  header{display:flex;align-items:center;gap:8px;font-size:10.5px;letter-spacing:.3em;color:var(--cy)}.warn header{color:var(--ye)}.crit header{color:var(--rd)}
  header em{margin-left:auto;font-style:normal;color:var(--mut);letter-spacing:.15em}
  .bl{width:8px;height:8px;background:currentColor;box-shadow:0 0 8px currentColor;animation:bk .6s steps(2) infinite}
  h3{position:relative;font-family:var(--f-disp);font-size:22px;letter-spacing:.06em;color:#fff;margin:10px 0 6px}
  h3::before,h3::after{content:attr(data-t);position:absolute;left:0;top:0;opacity:.75}
  h3::before{color:var(--rd);transform:translate(2px,0);clip-path:inset(0 0 55% 0);animation:g1 2.2s infinite steps(1)}
  h3::after{color:var(--cy);transform:translate(-2px,0);clip-path:inset(55% 0 0 0);animation:g2 1.7s infinite steps(1)}
  p{font-size:15px;line-height:1.5;color:#d6e2ee;white-space:pre-wrap}
  footer{display:flex;align-items:center;justify-content:space-between;margin-top:12px;font-size:10px;letter-spacing:.2em;color:var(--mut)}
  footer button{background:none;border:1px solid currentColor;color:var(--cy);padding:6px 14px;letter-spacing:.25em;font:inherit;font-size:11px}
  .crit footer button{color:var(--rd)}footer button:hover{background:rgba(0,240,255,.12)}
  @keyframes sin{0%{opacity:0;clip-path:inset(48% 0 48% 0)}8%{opacity:1;transform:translateX(-46%) skewX(14deg)}16%{transform:translateX(-54%) skewX(-8deg);filter:hue-rotate(90deg)}24%{transform:translateX(-50%);filter:none;clip-path:inset(0 0 70% 0)}32%{clip-path:inset(30% 0 0 0)}40%{clip-path:none}}
  @keyframes sj{0%,92%,100%{filter:none}93%{filter:drop-shadow(3px 0 0 rgba(255,42,85,.8)) drop-shadow(-3px 0 0 rgba(0,240,255,.8))}95%{transform:translateX(calc(-50% + 4px))}}
  @keyframes nz{0%{transform:translateY(0)}100%{transform:translateY(3px)}}
  @keyframes bk{50%{opacity:.2}}
  @keyframes g1{0%,88%,100%{transform:translate(2px,0)}90%{transform:translate(-6px,1px)}94%{transform:translate(5px,-1px)}}
  @keyframes g2{0%,84%,100%{transform:translate(-2px,0)}86%{transform:translate(6px,0)}91%{transform:translate(-4px,1px)}}
  .ts{position:fixed;right:16px;bottom:62px;z-index:14000;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
  .tt{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:320px;padding:10px 14px;background:rgba(5,8,14,.95);border:1px solid rgba(0,240,255,.5);color:var(--tx);text-align:left;animation:tin .35s both;box-shadow:0 0 20px rgba(0,0,0,.6)}
  .tt.g{border-color:#39ff8a;background:rgba(2,10,6,.96);font-family:var(--f-mono)}.tt.g b{color:#39ff8a}
  .tt b{font-size:10px;letter-spacing:.3em;color:var(--cy)}.tt span{font-weight:600}.tt small{color:var(--mut);font-size:12.5px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .tm{display:flex;align-items:center;gap:8px;max-width:280px;padding:7px 12px 7px 10px;background:rgba(5,8,14,.9);border:1px solid rgba(0,240,255,.35);border-left:2px solid var(--cy);color:var(--tx);font-size:13px;cursor:grab;touch-action:none;user-select:none;animation:tin .3s both,tout .5s 3.1s forwards;box-shadow:0 4px 16px rgba(0,0,0,.5)}
  .tm.g{border-color:rgba(57,255,138,.4);border-left-color:#39ff8a}.tm b{font-size:9.5px;letter-spacing:.25em;color:var(--cy)}.tm.g b{color:#39ff8a}
  .tm span{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tm i{width:6px;height:6px;border-radius:50%;background:currentColor;color:#39ff8a;box-shadow:0 0 6px currentColor;flex:none}
  @keyframes tout{to{opacity:0;transform:translateX(24px)}}
  @keyframes tin{from{opacity:0;transform:translateX(30px)}}
</style>
