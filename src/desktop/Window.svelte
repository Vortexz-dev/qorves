<script lang="ts">
  import { appById } from './apps';
  import { ICONS } from './icons';
  import { wm, focus, closeWin, minimize, type Win } from './wm.svelte';
  import { sfx } from '../lib/sfx';
  let { win }: { win: Win } = $props();
  const app = appById(win.app);
  const mod = app.load();
  let d: { px: number; py: number; x: number; y: number } | null = null;
  function down(e: PointerEvent) {
    if (win.max || (e.target as HTMLElement).closest('button')) return;
    d = { px: e.clientX, py: e.clientY, x: win.x, y: win.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!d) return;
    win.x = Math.max(-win.w + 120, Math.min(innerWidth - 120, d.x + e.clientX - d.px));
    win.y = Math.max(0, Math.min(innerHeight - 90, d.y + e.clientY - d.py));
  }
</script>

<section class="win" class:focus={wm.focus === win.id} class:min={win.min} class:max={win.max} class:closing={win.closing}
  style:left="{win.x}px" style:top="{win.y}px" style:width="{win.w}px" style:height="{win.h}px" style:z-index={win.z}
  onpointerdown={() => focus(win.id)}>
  <header role="toolbar" tabindex="-1" onpointerdown={down} onpointermove={move} onpointerup={() => (d = null)} ondblclick={() => { win.max = !win.max; sfx.click(); }}>
    <span class="ic">{@html ICONS[app.icon]}</span>
    <span class="t">{win.title ? win.title + ' · ' + app.title : app.title}</span>
    <span class="id mono">PID {String(win.id * 317).padStart(4, '0')}</span>
    <div class="ctl">
      <button aria-label="Küçült" onclick={() => minimize(win.id)}><svg viewBox="0 0 12 12"><path d="M2 9h8" stroke="currentColor" stroke-width="1.6"/></svg></button>
      <button aria-label="Büyüt" onclick={() => { win.max = !win.max; sfx.click(); }}><svg viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>
      <button class="x" aria-label="Kapat" onclick={() => closeWin(win.id)}><svg viewBox="0 0 12 12"><path d="m2.5 2.5 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.6"/></svg></button>
    </div>
  </header>
  <div class="content">
    {#await mod}<div class="ld mono">MODÜL YÜKLENİYOR…</div>{:then m}<m.default arg={win.arg} {win} />{/await}
  </div>
</section>

<style>
  .win{position:absolute;display:flex;flex-direction:column;background:rgba(7,10,18,.93);border:1px solid rgba(0,240,255,.22);
    clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px));
    box-shadow:0 20px 60px rgba(0,0,0,.6);animation:wo .26s cubic-bezier(.2,.9,.2,1) both;contain:layout paint}
  .win.focus{border-color:rgba(0,240,255,.55)}
  .win.focus::before{content:"";position:absolute;left:0;top:0;width:34%;height:2px;background:var(--ye);box-shadow:0 0 10px var(--ye);z-index:2}
  .win.min{display:none}
  .win.max{left:0!important;top:0!important;width:100%!important;height:calc(100% - 48px)!important;clip-path:none}
  .win.closing{animation:wc .18s steps(4) forwards}
  @keyframes wo{0%{opacity:0;transform:scale(.94) translateY(10px);filter:blur(4px) hue-rotate(60deg)}60%{opacity:1;filter:none}100%{transform:none}}
  @keyframes wc{to{opacity:0;transform:scaleY(.05) scaleX(1.05)}}
  header{height:38px;display:flex;align-items:center;gap:10px;padding:0 6px 0 12px;background:linear-gradient(90deg,rgba(0,240,255,.12),rgba(0,240,255,.02) 60%);
    border-bottom:1px solid rgba(0,240,255,.2);flex:none;touch-action:none}
  .ic{width:20px;height:20px}.ic :global(svg){width:100%;height:100%}
  .t{font-weight:700;font-size:14px;letter-spacing:.12em;text-transform:uppercase}
  .id{font-size:10px;color:var(--mut);letter-spacing:.15em}
  .ctl{margin-left:auto;display:flex;gap:2px}
  .ctl button{width:32px;height:26px;display:grid;place-items:center;background:none;border:1px solid transparent;color:var(--cy)}
  .ctl button svg{width:12px;height:12px}
  .ctl button:hover{background:rgba(0,240,255,.12);border-color:rgba(0,240,255,.35)}
  .ctl .x:hover{background:var(--rd);border-color:var(--rd);color:#fff}
  .content{flex:1;overflow:auto;position:relative;user-select:text}
  .ld{padding:30px;color:var(--cy);font-size:12px;letter-spacing:.3em}
</style>
