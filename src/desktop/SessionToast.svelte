<script lang="ts" module>
  // Ziyaret başına en fazla bir kez (son 3 saatte bir kez daha): sayfa yenilenene kadar hatırlanır.
  const visit = { shown: 0, extra: false };
</script>
<script lang="ts">
  // Sıradaki oturum hatırlatıcısı: sağ altta küçük, göze batmayan kart.
  import { onMount } from 'svelte';
  import { sess, fmtIst, rel } from '../lib/sess.svelte';
  import { sfx } from '../lib/sfx';
  let { uid }: { uid: string } = $props();
  let open = $state(false), out = $state(false), at = $state(0), note = $state(''), tick = $state(Date.now());
  const K = (k: string) => `qv.sess.${uid}.${k}`;
  const day = (t = Date.now()) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  function due(second = false) {
    if (!sess.remind || !sess.at) return false;
    const d = sess.at - Date.now(); if (d < -60e3) return false;
    if (localStorage.getItem(K('never')) === String(sess.at)) return false;
    if (second) return d < 3 * 3600e3;
    if (visit.shown) return false;
    if (d > 3 * 86400e3) return localStorage.getItem(K('day')) !== day();
    return true;
  }
  function show() { at = sess.at!; note = sess.note; tick = Date.now(); out = false; open = true; visit.shown++; localStorage.setItem(K('day'), day()); sfx.ping(); }
  function close(never = false) { if (never) localStorage.setItem(K('never'), String(at)); sfx.click(); out = true; setTimeout(() => (open = false), 260); }
  onMount(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, f: () => void) => timers.push(setTimeout(f, ms));
    const first = () => { if (due()) { show(); if (sess.at! - Date.now() < 3 * 3600e3) later(25 * 60e3, again); } else if (!sess.ready) later(8000, first); };
    const again = () => { if (!visit.extra && !open && due(true)) { visit.extra = true; show(); } };
    later(10000 + Math.random() * 10000, first);
    const iv = setInterval(() => (tick = Date.now()), 30e3);
    return () => { timers.forEach(clearTimeout); clearInterval(iv); };
  });
</script>
{#if open}
  <div class="sr" class:out role="status" aria-label="Sıradaki oturum">
    <header class="mono"><i></i>SIRADAKİ OTURUM</header>
    <b class="dt">{fmtIst(at)}</b>
    <span class="rl mono">{rel(at, tick)}</span>
    {#if note}<p>{note}</p>{/if}
    <footer><button class="ng" onclick={() => close(true)}>Bir daha gösterme</button><button class="ok" onclick={() => close()}>Tamam</button></footer>
  </div>
{/if}
<style>
  .sr{position:fixed;right:16px;bottom:62px;z-index:13900;width:300px;padding:11px 14px 10px;background:rgba(5,8,14,.94);border:1px solid rgba(0,240,255,.35);border-left:2px solid var(--cy);box-shadow:0 8px 28px rgba(0,0,0,.5);animation:in .42s cubic-bezier(.2,.9,.3,1.2) both;backdrop-filter:blur(4px)}
  .sr.out{animation:ot .26s ease-in forwards}
  header{display:flex;align-items:center;gap:7px;font-size:9.5px;letter-spacing:.3em;color:var(--cy)}header em{margin-left:auto;font-style:normal;color:var(--mut);letter-spacing:.1em}
  header i{width:6px;height:6px;background:var(--cy);box-shadow:0 0 6px var(--cy);animation:bk 1.4s steps(2) infinite}
  .dt{display:block;margin-top:6px;font-size:15px;color:#fff;font-weight:600;text-transform:capitalize}
  .rl{font-size:11px;color:var(--ye);letter-spacing:.12em}
  p{margin:7px 0 0;font-size:12.5px;line-height:1.45;color:#c9d6e2;white-space:pre-wrap;max-height:6.4em;overflow:auto;border-top:1px solid rgba(255,255,255,.07);padding-top:6px}
  footer{display:flex;justify-content:flex-end;gap:6px;margin-top:9px}
  button{font:inherit;font-size:12px;padding:4px 10px;border:1px solid rgba(255,255,255,.15);background:none;color:var(--mut);cursor:pointer}
  button:hover{color:#fff;border-color:rgba(255,255,255,.35)}
  .ok{color:var(--cy);border-color:rgba(0,240,255,.5)}.ok:hover{background:rgba(0,240,255,.1);color:#fff}
  @keyframes in{from{opacity:0;transform:translateY(14px)}}
  @keyframes ot{to{opacity:0;transform:translateX(30px)}}
  @keyframes bk{50%{opacity:.25}}
</style>
