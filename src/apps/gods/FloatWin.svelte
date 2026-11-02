<script lang="ts">
  // God's Eye içinde yüzen pencere (DM Paneli, Zar Atıcı): sürüklenir, boyutlanır, uygulamadan çıkmadan kapanır.
  import type { Snippet } from 'svelte';
  let { title, w = 760, h = 560, id, onclose, children }: { title: string; w?: number; h?: number; id: string; onclose: () => void; children: Snippet } = $props();
  const saved = JSON.parse(localStorage.getItem('qv.ge.fw.' + id) ?? 'null') as { x: number; y: number } | null;
  let x = $state(saved?.x ?? Math.max(20, (innerWidth - w) / 2)), y = $state(saved?.y ?? Math.max(60, (innerHeight - h) / 2)), d: { px: number; py: number; x: number; y: number } | null = null;
  function down(e: PointerEvent) { if ((e.target as HTMLElement).closest('button')) return; d = { px: e.clientX, py: e.clientY, x, y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  function move(e: PointerEvent) { if (!d) return; x = Math.max(-w + 140, Math.min(innerWidth - 140, d.x + e.clientX - d.px)); y = Math.max(46, Math.min(innerHeight - 60, d.y + e.clientY - d.py)); }
  function up() { if (d) localStorage.setItem('qv.ge.fw.' + id, JSON.stringify({ x, y })); d = null; }
</script>
<section class="fw" style:left="{x}px" style:top="{y}px" style:width="{w}px" style:height="{h}px" role="dialog" aria-label={title}>
  <header role="toolbar" tabindex="-1" onpointerdown={down} onpointermove={move} onpointerup={up}>
    <span class="mono">{title}</span><button class="x" onclick={onclose} aria-label="Kapat"><svg viewBox="0 0 12 12"><path d="m2.5 2.5 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.6"/></svg></button>
  </header>
  <div class="c">{@render children()}</div>
</section>
<style>
  .fw{position:fixed;z-index:9600;display:flex;flex-direction:column;background:rgba(7,10,18,.96);border:1px solid rgba(0,240,255,.35);box-shadow:0 18px 60px rgba(0,0,0,.7);resize:both;overflow:hidden;min-width:420px;min-height:300px;animation:fwi .22s cubic-bezier(.2,.9,.3,1)}
  header{display:flex;align-items:center;height:34px;padding:0 4px 0 12px;background:linear-gradient(90deg,rgba(0,240,255,.12),transparent);border-bottom:1px solid rgba(0,240,255,.2);cursor:move;user-select:none;flex:none}
  header span{flex:1;font-size:10.5px;letter-spacing:.3em;color:var(--cy)}
  .x{width:30px;height:26px;display:grid;place-items:center;background:none;border:none;color:#cfe;cursor:pointer}.x:hover{background:#ff2a55;color:#fff}.x svg{width:12px;height:12px}
  .c{flex:1;min-height:0;position:relative;overflow:auto}
  @keyframes fwi{from{opacity:0;transform:translateY(10px) scale(.98)}}
</style>
