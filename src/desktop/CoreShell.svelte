<script lang="ts">
  import { onMount } from 'svelte';
  import { appById } from './apps';
  import { wm, closeCore } from './wm.svelte';
  let { id }: { id: string } = $props();
  const app = $derived(appById(id));
  const mod = $derived(app.load());
  onMount(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCore(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  });
</script>

<div class={'core ' + id} class:closing={wm.coreClosing}>
  <div class="fx"></div>
  <div class="stage">
    {#await mod then m}<m.default />{/await}
  </div>
  <div class="top">
    <span class="t">{app.title}</span><span class="mono k">ESC · ÇIKIŞ</span>
    <button class="x" onclick={closeCore} aria-label="Kapat"><svg viewBox="0 0 12 12"><path d="m2.5 2.5 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.6"/></svg></button>
  </div>
</div>

<style>
  .core{position:fixed;inset:0;z-index:9500;background:#04050a;overflow:hidden}
  .stage{position:absolute;inset:0;animation:st .7s .35s both}
  @keyframes st{from{opacity:0;transform:scale(1.04);filter:blur(8px)}}
  .top{position:absolute;top:0;left:0;right:0;height:46px;display:flex;align-items:center;gap:14px;padding:0 10px 0 22px;z-index:5;
    background:linear-gradient(rgba(4,5,10,.85),transparent);animation:fd .4s .6s both}
  .t{font-family:var(--f-disp);font-weight:700;letter-spacing:.3em;font-size:13px;color:var(--cy)}
  .k{font-size:10.5px;color:var(--mut);letter-spacing:.2em;margin-left:auto}
  .x{width:40px;height:32px;display:grid;place-items:center;background:rgba(255,42,85,.1);border:1px solid rgba(255,42,85,.5);color:var(--rd)}
  .x svg{width:13px;height:13px}.x:hover{background:var(--rd);color:#fff}
  @keyframes fd{from{opacity:0;transform:translateY(-10px)}}
  .fx{position:absolute;inset:0;pointer-events:none;z-index:6}
  /* uygulamaya özel açılış efektleri */
  .timeline .fx{background:linear-gradient(90deg,transparent calc(50% - 1px),var(--cy) calc(50% - 1px),var(--cy) calc(50% + 1px),transparent calc(50% + 1px));animation:tl .8s cubic-bezier(.7,0,.2,1) forwards}
  @keyframes tl{0%{clip-path:inset(50% 0 50% 0);filter:drop-shadow(0 0 12px var(--cy))}45%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0);opacity:0}}
  .codex .fx{background:repeating-linear-gradient(90deg,rgba(0,240,255,.0) 0 22px,rgba(0,240,255,.5) 22px 24px);animation:cx .75s steps(8) forwards}
  @keyframes cx{0%{clip-path:inset(0 0 100% 0)}60%{clip-path:inset(0 0 0 0);opacity:1}100%{opacity:0;transform:translateY(30%)}}
  .starmap .fx{background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(0,240,255,.0) 0 4deg,rgba(0,240,255,.55) 4deg 4.6deg);
    mask-image:radial-gradient(circle at center,transparent 6%,#000 40%);animation:wp .9s cubic-bezier(.6,0,.2,1) forwards}
  @keyframes wp{0%{transform:scale(.2);opacity:0}30%{opacity:1}100%{transform:scale(3.2);opacity:0}}
  .core{animation:cin .35s both}
  @keyframes cin{0%{clip-path:inset(49.5% 0 49.5% 0)}100%{clip-path:inset(0)}}
  .core.closing{animation:cout .42s cubic-bezier(.7,0,.3,1) forwards}
  @keyframes cout{0%{clip-path:inset(0);filter:none}40%{filter:hue-rotate(80deg) brightness(1.6)}100%{clip-path:inset(50% 0 50% 0)}}
</style>
