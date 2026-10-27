<script lang="ts">
  import { onMount } from 'svelte';
  import { session, enterDesktop } from '../lib/session.svelte';
  import { backend, AuthError, type UserProfile } from '../lib/backend';
  import { sfx } from '../lib/sfx';
  import Backdrop from '../ui/Backdrop.svelte';
  import Logo from '../ui/Logo.svelte';

  let username = $state(''), password = $state('');
  let auto = $state(!!session.remembered);
  let typedUser = $state(''), typedPw = $state(0);
  let busy = $state(false), err = $state(''), granted = $state(false);
  let uEl: HTMLInputElement | undefined = $state();

  function success(u: UserProfile) {
    granted = true; sfx.granted();
    setTimeout(() => enterDesktop(u), 1100);
  }
  async function submit(e?: Event) {
    e?.preventDefault(); if (busy) return;
    err = ''; busy = true;
    try { success(await backend.login(username, password)); }
    catch (x) { sfx.error(); err = x instanceof AuthError ? x.message : 'Sistem hatası.'; busy = false; }
  }
  function cancelAuto() { auto = false; backend.logout(); session.remembered = null; setTimeout(() => uEl?.focus(), 50); }

  onMount(() => {
    if (!auto || !session.remembered) { uEl?.focus(); return; }
    const u = session.remembered, name = u.username; let i = 0, alive = true;
    const step = () => {
      if (!alive || !auto) return;
      if (i < name.length) { typedUser = name.slice(0, ++i); sfx.key(); setTimeout(step, 55 + Math.random() * 60); }
      else if (typedPw < 12) { typedPw++; sfx.key(); setTimeout(step, 45 + Math.random() * 55); }
      else setTimeout(() => alive && auto && success(u), 280);
    };
    setTimeout(step, 600);
    return () => { alive = false; };
  });
</script>

<div class="wrap">
  <Backdrop dim={0.45} />
  <form class="panel" class:granted onsubmit={submit} autocomplete="on">
    <div class="hdr"><Logo size={30} glitch={false} /><span class="mono tag">GÜVENLİ OTURUM · v9.4</span></div>
    <div class="ttl">KİMLİK DOĞRULAMA</div>
    {#if auto && session.remembered}
      <div class="auto">
        <img src={session.remembered.avatar} alt="" />
        <div class="field"><span>Kullanıcı</span><div class="inp fake">{typedUser}<b class="c">▌</b></div></div>
        <div class="field"><span>Şifre</span><div class="inp fake">{'•'.repeat(typedPw)}</div></div>
        <div class="mono hint">kayıtlı kimlik bulundu · otomatik giriş</div>
        <button type="button" class="btn ghost small" onclick={cancelAuto}>Başka hesap</button>
      </div>
    {:else}
      <label class="field"><span>Kullanıcı adı</span><input class="inp" bind:this={uEl} bind:value={username} autocomplete="username" spellcheck="false" oninput={() => sfx.key()} /></label>
      <label class="field"><span>Şifre</span><input class="inp" type="password" bind:value={password} autocomplete="current-password" oninput={() => sfx.key()} /></label>
      {#if err}<div class="err mono">⚠ {err}</div>{/if}
      <div class="row">
        <button class="btn" disabled={busy || !username || !password}>{busy ? 'Bağlanıyor…' : 'Giriş'}</button>
        <button type="button" class="btn ghost" onclick={() => { sfx.click(); session.stage = 'register'; }}>Hesap oluştur</button>
      </div>
      <div class="mono foot">Hesabın yoksa yeni bir karakter kaydı aç.</div>
    {/if}
    {#if granted}<div class="ok"><span class="glitch" data-text="ERİŞİM İZNİ VERİLDİ">ERİŞİM İZNİ VERİLDİ</span></div>{/if}
  </form>
</div>

<style>
  .wrap{position:absolute;inset:0;display:grid;place-items:center}
  .panel{position:relative;width:min(440px,92vw);padding:28px 30px 26px;background:var(--panel);backdrop-filter:blur(10px);
    border:1px solid var(--line);display:flex;flex-direction:column;gap:16px;
    clip-path:polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,26px 100%,0 calc(100% - 26px));
    box-shadow:0 0 60px rgba(0,240,255,.08);animation:pin .55s cubic-bezier(.2,.9,.2,1) both}
  .panel::before{content:"";position:absolute;left:0;top:0;width:4px;height:60%;background:var(--ye);box-shadow:0 0 14px var(--ye)}
  .panel::after{content:"";position:absolute;right:0;bottom:0;width:40%;height:2px;background:var(--rd)}
  @keyframes pin{0%{opacity:0;transform:scaleY(.02) scaleX(1.2)}35%{opacity:1;transform:scaleY(.02)}70%{transform:scaleY(1.04)}100%{transform:none}}
  .hdr{display:flex;align-items:center;justify-content:space-between}
  .tag{font-size:10px;color:var(--mut);letter-spacing:.2em}
  .ttl{font-family:var(--f-disp);font-size:13px;letter-spacing:.42em;color:var(--cy);border-bottom:1px solid var(--line);padding-bottom:10px}
  .row{display:flex;gap:12px;margin-top:4px}
  .err{color:var(--rd);font-size:13px;border-left:2px solid var(--rd);padding:6px 10px;background:rgba(255,42,85,.08)}
  .foot,.hint{font-size:11.5px;color:var(--mut);letter-spacing:.06em}
  .auto{display:flex;flex-direction:column;gap:14px}
  .auto img{width:84px;height:84px;object-fit:cover;align-self:center;border:2px solid var(--cy);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
  .fake{min-height:40px}.c{color:var(--cy);animation:blink .7s steps(1) infinite;font-weight:400}
  .small{padding:7px 14px;font-size:12px;align-self:flex-start}
  .ok{position:absolute;inset:0;display:grid;place-items:center;background:rgba(5,6,11,.82);font-family:var(--f-disp);font-weight:900;
    font-size:22px;letter-spacing:.2em;color:var(--ye);animation:fade .2s both}
  .granted{box-shadow:0 0 80px rgba(252,238,10,.25)}
  @keyframes fade{from{opacity:0}}
</style>
