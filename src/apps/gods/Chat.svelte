<script lang="ts">
  // God's Eye ortak sohbet: bütün sahnelerde tek akış. Kendiliğinden kapanır: yeni mesajda açılır, sonra yarı saydam, sonra kapanır.
  import { onMount } from 'svelte';
  import { session } from '../../lib/session.svelte';
  import { watchChat, sendChat, delChat, colorOf, now, type Chat } from '../../lib/gods';
  import { sfx } from '../../lib/sfx';
  const me = session.user!, dm = me.role === 'dm', nm = dm ? 'DM' : (me.character?.name || me.username).split(' ')[0], col = dm ? '#ffffff' : colorOf(me.uid);
  const OPEN_MS = 7000, DIM_MS = 16000;
  let list = $state<Chat[]>([]), st = $state<'col' | 'open' | 'dim'>('col'), pin = $state(localStorage.getItem('qv.ge.chatpin') === '1'), hov = $state(false), focus = $state(false), txt = $state(''), unread = $state(0);
  let t1: ReturnType<typeof setTimeout> | undefined, t2: ReturnType<typeof setTimeout> | undefined, logEl = $state<HTMLDivElement>(), inp = $state<HTMLInputElement>();
  const shown = $derived(pin || hov || focus ? 'open' : st);
  function wake() { st = 'open'; clearTimeout(t1); clearTimeout(t2); t1 = setTimeout(() => (st = 'dim'), OPEN_MS); t2 = setTimeout(() => (st = 'col'), OPEN_MS + DIM_MS); }
  onMount(() => {
    let first = true, seen = new Set<string>();
    const stop = watchChat((l) => {
      const fresh = l.filter((c) => c.id && !seen.has(c.id)); l.forEach((c) => c.id && seen.add(c.id)); list = l;
      if (!first && fresh.length) { wake(); if (shown === 'col') unread += fresh.length; if (fresh.some((c) => c.uid !== me.uid && c.k === 'msg')) sfx.soft(); }
      first = false; requestAnimationFrame(() => logEl && (logEl.scrollTop = logEl.scrollHeight));
    }, 40);
    return () => { stop(); clearTimeout(t1); clearTimeout(t2); };
  });
  $effect(() => { if (shown === 'open') unread = 0; });
  async function send(e: Event) { e.preventDefault(); const t = txt.trim().slice(0, 400); if (!t) return; txt = ''; sfx.click(); await sendChat({ uid: me.uid, name: nm, col, k: 'msg', t, at: now() }).catch(() => sfx.error()); }
  const openType = () => { wake(); requestAnimationFrame(() => inp?.focus()); };
  const tpin = () => { pin = !pin; localStorage.setItem('qv.ge.chatpin', pin ? '1' : '0'); if (!pin) wake(); };
  const hm = (at: number) => new Date(at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  async function clearAll() { for (const c of list) if (c.id) await delChat(c.id); }
</script>
<div class="gc {shown}" role="log" aria-label="Sohbet" onmouseenter={() => (hov = true)} onmouseleave={() => (hov = false)}>
  {#if shown === 'col'}
    <button class="pill mono" onclick={openType} title="Sohbet (yazmak için tıkla)"><svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>SOHBET{#if unread}<i>{unread}</i>{/if}</button>
  {:else}
    <header class="mono"><span>SOHBET · TÜM SAHNELER</span>
      {#if dm && list.length}<button onclick={clearAll} title="Sohbeti temizle">⌫</button>{/if}
      <button class:on={pin} onclick={tpin} title={pin ? 'Sabitlemeyi kaldır' : 'Açık tut'}><svg viewBox="0 0 24 24"><path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></header>
    <div class="lg" bind:this={logEl}>
      {#each list as c (c.id)}
        <div class="m" class:roll={c.k === 'roll'} class:n20={c.nat === 'nat20'} class:n1={c.nat === 'nat1'}><b style:color={c.col}>{c.name}</b>{#if c.k === 'roll'}<span class="dz">🎲</span>{/if}<span class="t">{c.t}</span><small>{hm(c.at)}</small></div>
      {:else}<div class="em">Henüz mesaj yok.</div>{/each}
    </div>
    <form onsubmit={send}><input bind:this={inp} bind:value={txt} maxlength="400" placeholder="Mesaj yaz… (Enter)" onfocus={() => (focus = true)} onblur={() => { focus = false; wake(); }} onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Escape') inp?.blur(); }} /></form>
  {/if}
</div>
<style>
  .gc{position:absolute;right:34px;bottom:14px;z-index:5;width:330px;display:flex;flex-direction:column;transition:opacity .6s ease}
  .gc.col{width:auto;align-items:flex-end}
  .gc.dim{opacity:.42}
  .pill{display:flex;align-items:center;gap:7px;padding:6px 11px;background:rgba(5,8,14,.72);border:1px solid rgba(0,240,255,.25);color:#9fd8e6;font-size:10px;letter-spacing:.25em;cursor:pointer;opacity:.75;transition:opacity .2s,border-color .2s}
  .pill:hover{opacity:1;border-color:rgba(0,240,255,.6)}.pill svg{width:14px;height:14px}
  .pill i{font-style:normal;min-width:16px;padding:0 4px;background:var(--cy);color:#04050a;border-radius:8px;letter-spacing:0;text-align:center}
  header{display:flex;align-items:center;gap:4px;padding:5px 6px 5px 10px;background:rgba(5,8,14,.86);border:1px solid rgba(0,240,255,.3);border-bottom:none;font-size:9.5px;letter-spacing:.25em;color:var(--cy)}
  header span{flex:1}header button{width:24px;height:20px;padding:2px;background:none;border:none;color:var(--mut);cursor:pointer;font-size:13px}header button.on{color:var(--ye)}header svg{width:14px;height:14px}
  .lg{max-height:220px;min-height:60px;overflow-y:auto;padding:6px 10px;background:rgba(5,8,14,.8);border-left:1px solid rgba(0,240,255,.3);border-right:1px solid rgba(0,240,255,.3);display:flex;flex-direction:column;gap:3px;scrollbar-width:thin}
  .m{font-size:13.5px;line-height:1.35;color:#dbe7ef;word-wrap:break-word;animation:mi .25s ease-out}
  .m b{font-weight:600;margin-right:6px}.m small{margin-left:6px;font-size:10px;color:var(--mut)}.m .dz{margin-right:4px;font-size:12px}
  .m.roll .t{font-family:var(--f-mono);font-size:12.5px;color:#cfeff7}.m.n20 .t{color:#39ff8a}.m.n1 .t{color:#ff5a6e}
  .em{color:var(--mut);font-size:12.5px}
  form{display:flex;background:rgba(5,8,14,.9);border:1px solid rgba(0,240,255,.3)}
  input{flex:1;min-width:0;background:none;border:none;color:#fff;font:inherit;font-size:13.5px;padding:7px 10px;outline:none}
  @keyframes mi{from{opacity:0;transform:translateY(4px)}}
</style>
