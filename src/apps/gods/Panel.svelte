<script lang="ts">
  // Kenara yapışan panel: üzerine gelince açılır, sabitlenmezse kapanır.
  import type { Snippet } from 'svelte';
  let { side, label, id, w = 300, children }: { side: 'left' | 'right' | 'top'; label: string; id: string; w?: number; children: Snippet } = $props();
  let pin = $state(localStorage.getItem('qv.ge.pin.' + id) === '1'), hov = $state(false), t: ReturnType<typeof setTimeout> | undefined;
  const open = $derived(pin || hov);
  const enter = () => { clearTimeout(t); hov = true; };
  const leave = () => { clearTimeout(t); t = setTimeout(() => (hov = false), 380); };
  const toggle = () => { pin = !pin; localStorage.setItem('qv.ge.pin.' + id, pin ? '1' : '0'); };
</script>
<div class="pn {side}" class:open style:--w="{w}px" role="region" aria-label={label} onmouseenter={enter} onmouseleave={leave} ondragenter={enter}>
  <div class="tab mono"><span>{label}</span></div>
  <div class="body">
    <header class="mono"><span>{label}</span><button class:on={pin} onclick={toggle} title={pin ? 'Sabitlemeyi kaldır' : 'Sabitle'} aria-label="Sabitle"><svg viewBox="0 0 24 24"><path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></header>
    <div class="in">{@render children()}</div>
  </div>
</div>
<style>
  .pn{position:absolute;z-index:6;display:flex;pointer-events:none}
  .pn>*{pointer-events:auto}
  .left{left:0;top:56px;bottom:12px}.right{right:0;top:56px;bottom:12px;flex-direction:row-reverse}.top{top:46px;left:50%;transform:translateX(-50%);flex-direction:column-reverse;align-items:center}
  .tab{display:flex;align-items:center;justify-content:center;background:rgba(5,8,14,.9);border:1px solid rgba(0,240,255,.35);color:var(--cy);font-size:10px;letter-spacing:.3em;transition:opacity .2s,background .2s;cursor:default}
  .left .tab,.right .tab{width:24px;align-self:center;height:130px}.left .tab span,.right .tab span{writing-mode:vertical-rl}.left .tab span{transform:rotate(180deg)}
  .left .tab{border-left:none}.right .tab{border-right:none}
  .top .tab{height:22px;padding:0 18px;border-top:none}
  .open .tab{opacity:0;pointer-events:none;width:0;padding:0;border:none}
  .body{display:none;flex-direction:column;background:rgba(5,8,14,.93);border:1px solid rgba(0,240,255,.3);box-shadow:0 10px 40px rgba(0,0,0,.55);backdrop-filter:blur(6px);min-height:0}
  .left .body,.right .body{width:var(--w)}.top .body{width:min(var(--w),92vw);max-height:46vh}
  .open .body{display:flex;animation:po .2s cubic-bezier(.2,.9,.3,1)}
  .left.open .body{border-left:none}.right.open .body{border-right:none}
  header{display:flex;align-items:center;padding:6px 6px 6px 12px;font-size:10px;letter-spacing:.3em;color:var(--cy);border-bottom:1px solid rgba(0,240,255,.15)}
  header button{margin-left:auto;width:24px;height:22px;padding:2px;background:none;border:none;color:var(--mut);cursor:pointer}header button.on{color:var(--ye)}header svg{width:15px;height:15px}
  .in{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
  @keyframes po{from{opacity:0;clip-path:inset(0 0 100% 0)}}
</style>
