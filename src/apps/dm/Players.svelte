<script lang="ts">
  import { dm, when } from './store.svelte';
  import { isOnline, fileOf } from '../../lib/live';
  import { ago } from '../../lib/decrypt';
  let { go }: { go: (tab: string) => void } = $props();
  const u = $derived(dm.users.find((x) => x.uid === dm.pid));
  const pr = $derived(dm.pres.find((p) => p.uid === dm.pid));
  let file = $state<{ name: string; type: string; url: string } | null>(null), fbusy = $state(false), ferr = $state('');
  $effect(() => { dm.pid; file = null; ferr = ''; });
  async function openFile() { if (!u?.file) return; fbusy = true; ferr = ''; try { file = await fileOf(u.uid, u.file.id); if (!file) ferr = 'Dosya bulunamadı.'; } catch (e) { ferr = 'Dosya açılamadı: ' + String(e); } fbusy = false; }
  const C = [['name', 'Ad'], ['age', 'Yaş'], ['race', 'Irk'], ['origin', 'Köken'], ['faction', 'Taraf'], ['clan', 'Klan'], ['job', 'Meslek'], ['cls', 'Sınıf'], ['sub', 'Alt sınıf'], ['cls2', '2. sınıf'], ['level', 'Seviye'], ['background', 'Geçmiş'], ['chrome', 'Krom']] as const;
</script>
<div class="pl">
  <div class="ls">
    {#each dm.users as x (x.uid)}{@const p = dm.pres.find((y) => y.uid === x.uid)}
      <button class:on={dm.pid === x.uid} onclick={() => (dm.pid = x.uid)}>
        <span class="av">{#if x.avatar}<img src={x.avatar} alt="" data-nolb />{/if}<b class:on={isOnline(p)}></b></span>
        <span class="nm">{x.character?.name || x.username}<small>@{x.username} · {isOnline(p) ? 'çevrimiçi' : p ? ago(p.last) : x.lastLogin ? ago(x.lastLogin) : 'hiç girmedi'}</small></span>
      </button>
    {:else}<div class="none mono">Kayıtlı oyuncu yok.</div>{/each}
  </div>
  {#if u}
  <div class="dt">
    <div class="hd">
      <div class="big">{#if u.avatar}<img src={u.avatar} alt="" />{/if}</div>
      <div><h2>{u.character?.name || u.username}</h2><div class="mono s">@{u.username} · {isOnline(pr) ? '● ÇEVRİMİÇİ' : 'ÇEVRİMDIŞI'}</div>
        <div class="mono s">Son giriş: {when(u.lastLogin)} · Son görülme: {when(pr?.last)} · Kayıt: {when(u.createdAt)}</div>
        <div class="mono s">Kurulu uygulamalar: {(u.apps ?? []).join(', ') || '—'}</div>
        <div class="qa"><button class="btn ghost small" onclick={() => go('know')}>Bilgi izinleri</button><button class="btn ghost small" onclick={() => go('notify')}>Bildirim gönder</button><button class="btn ghost small" onclick={() => go('wallet')}>Cüzdan</button><button class="btn ghost small" onclick={() => go('markers')}>Harita işareti</button></div>
      </div>
    </div>
    {#if u.character}
      <div class="grid">{#each C as [k, l] (k)}{#if u.character[k]}<div><span class="mono">{l}</span>{u.character[k]}</div>{/if}{/each}</div>
      {#if u.character.stats}<div class="stats">{#each Object.entries(u.character.stats) as [k, v] (k)}<div><span class="mono">{k.toUpperCase()}</span><b>{v}</b></div>{/each}</div>{/if}
      {#if u.character.bio}<h4 class="mono">ÖZGEÇMİŞ</h4><p class="bio">{u.character.bio}</p>{/if}
    {:else}<p class="none">Karakter bilgisi yok.</p>{/if}
    <h4 class="mono">GEÇMİŞ DOSYASI</h4>
    {#if u.file}
      <div class="fl"><span>{u.file.name} · {(u.file.size / 1024).toFixed(0)} KB · {when(u.file.uploadedAt)}</span>
        {#if !file}<button class="btn small" disabled={fbusy} onclick={openFile}>{fbusy ? 'Açılıyor…' : 'Dosyayı aç'}</button>{:else}<a class="btn small" href={file.url} download={file.name}>İndir</a><a class="btn ghost small" href={file.url} target="_blank" rel="noopener">Yeni sekmede aç</a>{/if}</div>
      {#if ferr}<p class="err">{ferr}</p>{/if}
      {#if file}{#if file.type.startsWith('image/')}<img class="prev" src={file.url} alt={file.name} />{:else if file.type === 'application/pdf' || file.type.startsWith('text/')}<iframe class="prev" src={file.url} title={file.name}></iframe>{:else}<p class="none">Bu dosya türü önizlenemiyor; indirip aç.</p>{/if}{/if}
    {:else}<p class="none">Dosya yüklenmemiş.</p>{/if}
  </div>
  {/if}
</div>
<style>
  .pl{display:grid;grid-template-columns:250px 1fr;height:100%;min-height:0}
  .ls{border-right:1px solid var(--line);overflow:auto}
  .ls button{display:flex;gap:10px;align-items:center;width:100%;padding:8px 12px;background:none;border:0;border-left:2px solid transparent;color:var(--tx);text-align:left;font:inherit}
  .ls button:hover{background:rgba(0,240,255,.06)}.ls button.on{background:rgba(0,240,255,.1);border-left-color:var(--ye)}
  .av{position:relative;width:34px;height:34px;flex:none;border:1px solid var(--line);background:#0b0e17}.av img{width:100%;height:100%;object-fit:cover}
  .av b{position:absolute;right:-3px;bottom:-3px;width:9px;height:9px;background:#3a4452;border:2px solid #05060b;border-radius:50%}.av b.on{background:#39ff8a;box-shadow:0 0 6px #39ff8a}
  .nm{display:flex;flex-direction:column;font-size:15px}.nm small{font-size:11px;color:var(--mut)}
  .dt{overflow:auto;padding:16px 20px}
  .hd{display:flex;gap:16px}.big{width:96px;height:96px;flex:none;border:1px solid var(--line);background:#0b0e17}.big img{width:100%;height:100%;object-fit:cover}
  h2{font-family:var(--f-disp);font-size:22px;color:#fff;margin:0 0 4px}.s{font-size:11.5px;color:var(--mut);margin-top:3px}
  .qa{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 16px;margin-top:16px}.grid div{display:flex;flex-direction:column;font-size:15px}.grid span,.stats span{font-size:10px;letter-spacing:.2em;color:var(--cy)}
  .stats{display:flex;gap:10px;margin-top:12px}.stats div{display:flex;flex-direction:column;align-items:center;border:1px solid var(--line);padding:4px 10px}.stats b{font-family:var(--f-disp);font-size:18px;color:var(--ye)}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:16px 0 6px}.bio{white-space:pre-wrap;line-height:1.5;font-size:14.5px}
  .fl{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.fl span{font-size:14px;margin-right:6px}
  .prev{display:block;width:100%;max-height:520px;height:520px;object-fit:contain;margin-top:10px;border:1px solid var(--line);background:#fff}img.prev{background:#0b0e17;height:auto}
  .none{color:var(--mut);font-size:13px;padding:10px}.err{color:var(--rd);font-size:13px}
</style>
