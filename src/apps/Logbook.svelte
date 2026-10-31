<script lang="ts">
  // Seyir Defteri: oturum başına sınırsız sayfa, zengin metin, otomatik kayıt. Yazı alanı sakin; glitch yalnız çerçevede.
  import { onMount, tick } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { listSessions, createSession, saveMeta, loadPage, savePage, deletePage, deleteSession, sessName, clean, type LogSession } from '../lib/logbook';
  import { listUsers } from '../lib/live';
  import { ask } from '../lib/confirm.svelte';
  import { sfx } from '../lib/sfx';
  import type { UserProfile } from '../lib/backend';
  const me = session.user!, isDM = me.role === 'dm';
  let owner = $state(me.uid), people = $state<UserProfile[]>([]);
  const ro = $derived(owner !== me.uid);
  let list = $state<LogSession[]>([]), loaded = $state(false), cur = $state<LogSession | null>(null), pid = $state(''), err = $state('');
  let ed: HTMLDivElement | undefined = $state(), status = $state<'' | 'dirty' | 'saving' | 'saved' | 'error'>(''), renaming = $state(false), sub = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const TXT = ['#e8ecf4', '#ff6b81', '#ffb347', '#ffe066', '#7ee787', '#6cc6ff', '#c39bff', '#9aa3b5'];
  const HL = ['transparent', 'rgba(255,224,102,.35)', 'rgba(126,231,135,.3)', 'rgba(108,198,255,.3)', 'rgba(255,107,129,.3)', 'rgba(195,155,255,.32)'];
  async function refresh() { loaded = false; try { list = await listSessions(owner); } catch (e) { err = 'Defter açılamadı.'; } loaded = true; }
  onMount(() => { refresh(); if (isDM) listUsers().then((u) => (people = u.filter((x) => x.role === 'player'))).catch(() => {});
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && cur) { e.preventDefault(); flush(); } };
    addEventListener('keydown', k); return () => { removeEventListener('keydown', k); flush(); }; });
  async function add() { sfx.click(); const s = await createSession(me.uid, list).catch(() => null); if (!s) { err = 'Yeni oturum açılamadı.'; return; } list = [s, ...list]; open(s); }
  async function open(s: LogSession) { sfx.open(); cur = s; renaming = false; await go(s.pages[0]?.id ?? ''); }
  async function go(id: string) {
    await flush(); pid = id; status = ''; await tick();
    if (!ed || !cur) return; ed.innerHTML = id ? clean(await loadPage(owner, cur.id, id).catch(() => '')) : '';
    if (!ro) ed.focus();
  }
  function changed() { if (ro) return; status = 'dirty'; clearTimeout(timer); timer = setTimeout(flush, 1500); }
  async function flush() {
    clearTimeout(timer); if (ro || !cur || !pid || !ed || status !== 'dirty') return;
    status = 'saving'; const h = clean(ed.innerHTML), title = (ed.innerText.trim().split('\n')[0] ?? '').slice(0, 40);
    try { await savePage(me.uid, cur.id, pid, h); const p = cur.pages.find((x) => x.id === pid); if (p && p.t !== title) { p.t = title; await saveMeta(me.uid, $state.snapshot(cur) as LogSession); } status = 'saved'; }
    catch { status = 'error'; }
  }
  async function back() { await flush(); sfx.close(); cur = null; pid = ''; refresh(); }
  async function saveExit() { if (status === 'dirty') await flush(); if (status === 'error') return; sfx.granted(); await back(); }
  async function addPage() { if (!cur || ro) return; await flush(); const p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), t: '' }; cur.pages.push(p); await saveMeta(me.uid, $state.snapshot(cur) as LogSession); sfx.click(); go(p.id); }
  async function delPage(id: string) { if (!cur || ro || cur.pages.length < 2) return; const i = cur.pages.findIndex((p) => p.id === id);
    if (!(await ask('Sayfa silinsin mi?', `Sayfa ${i + 1} kalıcı olarak silinir. Bu geri alınamaz.`, 'Sil'))) return;
    if (pid === id) status = ''; await deletePage(me.uid, cur, id); cur = cur; go(cur.pages[Math.max(0, i - 1)].id); }
  async function delSess(s: LogSession) { if (!(await ask(sessName(s) + ' silinsin mi?', 'Bu oturumun bütün sayfaları kalıcı olarak silinir. Bu geri alınamaz.', 'Sil'))) return; await deleteSession(me.uid, s).catch(() => {}); refresh(); }
  async function rename() { if (!cur) return; cur.sub = sub.trim().replace(/^session\s*\d+\s*-?\s*/i, '').slice(0, 80); renaming = false; await saveMeta(me.uid, $state.snapshot(cur) as LogSession); sfx.click(); }
  let rng: Range | null = null;
  function keepSel() { const sl = getSelection(); if (sl && sl.rangeCount && ed?.contains(sl.anchorNode)) rng = sl.getRangeAt(0).cloneRange(); }
  $effect(() => { document.addEventListener('selectionchange', keepSel); return () => document.removeEventListener('selectionchange', keepSel); });
  function cmd(c: string, v?: string) { if (ro) return; ed?.focus(); if (rng) { const sl = getSelection(); sl?.removeAllRanges(); sl?.addRange(rng); } document.execCommand('styleWithCSS', false, 'true'); document.execCommand(c, false, v); changed(); }
  function block(v: string) { cmd('formatBlock', v); }
  function paste(e: ClipboardEvent) { if (ro) return; e.preventDefault(); const h = e.clipboardData?.getData('text/html'), t = e.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertHTML', false, h ? clean(h) : t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!).replace(/\n/g, '<br>')); changed(); }
  const when = (t: number) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const ST: Record<string, string> = { dirty: 'Yazılıyor…', saving: 'Kaydediliyor…', saved: 'Kaydedildi', error: 'Kaydedilemedi · tekrar dene' };
</script>

<div class="lb">
  <header>
    <div class="brand"><span class="gl" data-t="SEYİR DEFTERİ">SEYİR DEFTERİ</span><small class="mono">OTURUM KAYITLARI · {ro ? 'SALT OKUNUR' : 'YALNIZ SEN VE DM OKUR'}</small></div>
    {#if isDM && !cur}<select class="who" bind:value={owner} onchange={refresh}><option value={me.uid}>Benim defterim</option>{#each people as p (p.uid)}<option value={p.uid}>{p.character?.name || p.username}</option>{/each}</select>{/if}
    {#if cur}
      <div class="tb-r">
        <span class="st mono" class:bad={status === 'error'} class:ok={status === 'saved'}>{ST[status] ?? ''}</span>
        <button class="btn ghost small" onclick={back}>‹ Oturumlar</button>
        {#if !ro}<button class="btn small" onclick={saveExit}>Kaydet ve çık</button>{/if}
      </div>
    {/if}
  </header>

  {#if !cur}
    <div class="list">
      {#if !ro}<button class="new" onclick={add}><b>+</b><span>Yeni oturum</span><small class="mono">Session {list.reduce((m, s) => Math.max(m, s.n), 0) + 1}</small></button>{/if}
      {#each list as s (s.id)}
        <div class="card" role="button" tabindex="0" onclick={() => open(s)} onkeydown={(e) => e.key === 'Enter' && open(s)}>
          <div class="n mono">#{String(s.n).padStart(2, '0')}</div>
          <div class="t">{sessName(s)}</div>
          <div class="m mono">{s.pages.length} sayfa · {when(s.at)}</div>
          {#if !ro}<button class="del" title="Oturumu sil" onclick={(e) => { e.stopPropagation(); delSess(s); }}>✕</button>{/if}
        </div>
      {:else}{#if loaded}<div class="empty">{ro ? 'Bu oyuncunun defteri boş.' : 'Henüz oturum yok. “+ Yeni oturum” ile ilk kaydını aç.'}</div>{/if}{/each}
      {#if err}<div class="empty bad">{err}</div>{/if}
    </div>
  {:else}
    <div class="ws">
      <aside>
        <div class="sn">
          {#if renaming}
            <div class="ren"><span class="mono fix">Session {cur.n} -</span><input bind:value={sub} maxlength="80" placeholder="ek ad" onkeydown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') renaming = false; }} /><button class="btn small" onclick={rename}>Tamam</button></div>
          {:else}
            <div class="nm">{sessName(cur)}</div>{#if !ro}<button class="lnk" onclick={() => { sub = cur!.sub; renaming = true; }}>Yeniden adlandır</button>{/if}
          {/if}
        </div>
        <div class="pages">
          {#each cur.pages as p, i (p.id)}
            <div class="pg" class:on={p.id === pid} role="button" tabindex="0" onclick={() => go(p.id)} onkeydown={(e) => e.key === 'Enter' && go(p.id)}>
              <span class="mono">{i + 1}</span><span class="pt">{p.t || 'Boş sayfa'}</span>
              {#if !ro && cur.pages.length > 1}<button class="x" title="Sayfayı sil" onclick={(e) => { e.stopPropagation(); delPage(p.id); }}>✕</button>{/if}
            </div>
          {/each}
        </div>
        {#if !ro}<button class="btn ghost small addp" onclick={addPage}>+ Sayfa ekle</button>{/if}
      </aside>
      <section class="paper">
        {#if !ro}
        <div class="tools" role="toolbar" tabindex="-1" onmousedown={(e) => { if ((e.target as HTMLElement).closest('button')) e.preventDefault(); }}>
          <select onchange={(e) => { block((e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }}><option value="">Paragraf</option><option value="h1">Başlık 1</option><option value="h2">Başlık 2</option><option value="h3">Başlık 3</option><option value="p">Normal metin</option><option value="blockquote">Alıntı</option></select>
          <button title="Kalın (Ctrl+B)" onclick={() => cmd('bold')}><b>K</b></button>
          <button title="İtalik (Ctrl+I)" onclick={() => cmd('italic')}><i>İ</i></button>
          <button title="Altı çizili (Ctrl+U)" onclick={() => cmd('underline')}><u>A</u></button>
          <button title="Üstü çizili" onclick={() => cmd('strikeThrough')}><s>Ç</s></button>
          <span class="sep"></span>
          <button title="Madde listesi" onclick={() => cmd('insertUnorderedList')}>• ≡</button>
          <button title="Numaralı liste" onclick={() => cmd('insertOrderedList')}>1. ≡</button>
          <span class="sep"></span>
          <span class="lab mono">YAZI</span>{#each TXT as c (c)}<button class="sw" title="Yazı rengi" style:background={c} onclick={() => cmd('foreColor', c)} aria-label="Yazı rengi"></button>{/each}
          <span class="sep"></span>
          <span class="lab mono">VURGU</span>{#each HL as c (c)}<button class="sw hl" class:none={c === 'transparent'} title={c === 'transparent' ? 'Vurguyu kaldır' : 'Vurgu rengi'} style:background={c === 'transparent' ? undefined : c} onclick={() => cmd('hiliteColor', c)} aria-label="Vurgu"></button>{/each}
          <span class="sep"></span>
          <button title="Biçimi temizle" onclick={() => cmd('removeFormat')}>⌫ Biçim</button>
        </div>
        {/if}
        <div class="sheet">
          <div class="ed" bind:this={ed} contenteditable={!ro} role="textbox" tabindex="0" aria-multiline="true" spellcheck="true" lang="tr" data-ph="Bu oturumda neler oldu? Yazmaya başla…" oninput={changed} onpaste={paste} onblur={flush}></div>
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .lb{height:100%;display:flex;flex-direction:column;min-height:0;background:#0b0d13}
  header{display:flex;align-items:center;gap:14px;padding:12px 16px;border-bottom:1px solid rgba(0,240,255,.18);background:linear-gradient(90deg,rgba(0,240,255,.07),transparent 50%,rgba(255,42,85,.06));position:relative;overflow:hidden}
  header::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,var(--cy),transparent);animation:scan 4s linear infinite;opacity:.6}
  @keyframes scan{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
  .brand{display:flex;flex-direction:column;gap:3px}
  .gl{position:relative;font-family:var(--f-disp);font-weight:700;letter-spacing:.3em;color:var(--cy);font-size:15px}
  .gl::before,.gl::after{content:attr(data-t);position:absolute;inset:0;pointer-events:none}
  .gl::before{color:#ff2a55;animation:g1 3.6s steps(1) infinite;clip-path:inset(0 0 60% 0)}
  .gl::after{color:#fcee0a;animation:g2 4.2s steps(1) infinite;clip-path:inset(55% 0 0 0)}
  @keyframes g1{0%,92%,100%{transform:none;opacity:0}93%{transform:translate(-2px,-1px);opacity:.8}96%{transform:translate(2px,1px);opacity:.6}}
  @keyframes g2{0%,88%,100%{transform:none;opacity:0}89%{transform:translate(2px,0);opacity:.7}91%{transform:translate(-1px,1px);opacity:.5}}
  .brand small{font-size:10px;letter-spacing:.2em;color:var(--mut)}
  .who{margin-left:auto;background:#141824;color:var(--tx);border:1px solid var(--line);padding:6px 8px;font:inherit;font-size:13px}
  .tb-r{margin-left:auto;display:flex;align-items:center;gap:10px}
  .st{font-size:11px;letter-spacing:.12em;color:var(--mut);min-width:120px;text-align:right}.st.ok{color:#7ee787}.st.bad{color:#ff6b81}
  .list{flex:1;overflow:auto;padding:18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;align-content:start}
  .new,.card{position:relative;text-align:left;border:1px solid rgba(0,240,255,.22);background:linear-gradient(160deg,rgba(0,240,255,.06),rgba(8,10,16,.8));padding:14px 16px;min-height:96px;color:var(--tx);cursor:pointer;
    clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,12px 100%,0 calc(100% - 12px));transition:border-color .15s,transform .15s}
  .new:hover,.card:hover{border-color:var(--cy);transform:translateY(-1px)}
  .new{display:flex;flex-direction:column;justify-content:center;gap:4px;border-style:dashed;font:inherit}
  .new b{font-size:28px;color:var(--ye);line-height:1}.new span{font-size:15px}.new small{color:var(--mut);font-size:11px;letter-spacing:.12em}
  .card .n{font-size:11px;color:var(--ye);letter-spacing:.2em}.card .t{font-size:16px;margin:6px 0 8px;line-height:1.3;word-break:break-word}.card .m{font-size:10.5px;color:var(--mut);letter-spacing:.1em}
  .del{position:absolute;top:8px;right:14px;background:none;border:0;color:var(--mut);font-size:12px;opacity:0;cursor:pointer}.card:hover .del{opacity:1}.del:hover{color:#ff6b81}
  .empty{grid-column:1/-1;color:var(--mut);padding:30px 6px;font-size:15px}.empty.bad{color:#ff6b81}
  .ws{flex:1;display:grid;grid-template-columns:230px 1fr;min-height:0}
  aside{border-right:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;min-height:0;background:#0d1017}
  .sn{padding:14px;border-bottom:1px solid rgba(255,255,255,.06)}.nm{font-size:15px;color:#fff;line-height:1.35;word-break:break-word}
  .lnk{background:none;border:0;color:var(--cy);font:inherit;font-size:12px;padding:4px 0 0;cursor:pointer}
  .ren{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.fix{font-size:12px;color:var(--ye)}
  .ren input{flex:1;min-width:0;background:#151a26;border:1px solid var(--line);color:#fff;padding:5px 7px;font:inherit;font-size:13px}
  .pages{flex:1;overflow:auto;padding:6px}
  .pg{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;color:#c9cfdb;border-left:2px solid transparent;font-size:13.5px}
  .pg:hover{background:rgba(255,255,255,.04)}.pg.on{border-left-color:var(--cy);background:rgba(0,240,255,.08);color:#fff}
  .pg .mono{font-size:10.5px;color:var(--mut);width:18px}.pt{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pg .x{background:none;border:0;color:var(--mut);opacity:0;cursor:pointer}.pg:hover .x{opacity:1}.pg .x:hover{color:#ff6b81}
  .addp{margin:10px}
  .paper{display:flex;flex-direction:column;min-height:0;background:#141720}
  .tools{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.07);background:#11141c}
  .tools button{background:#1b2030;border:1px solid rgba(255,255,255,.08);color:#dfe4ee;min-width:30px;height:28px;padding:0 8px;font-size:13px;cursor:pointer;border-radius:3px}
  .tools button:hover{border-color:rgba(0,240,255,.5)}
  .tools select{background:#1b2030;border:1px solid rgba(255,255,255,.08);color:#dfe4ee;height:28px;font:inherit;font-size:13px;border-radius:3px}
  .tools .sw{min-width:18px;width:18px;height:18px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.25)}
  .tools .sw.hl{border-radius:3px}.tools .sw.none{background:linear-gradient(135deg,transparent 45%,#ff6b81 45% 55%,transparent 55%),#1b2030}
  .lab{font-size:9.5px;letter-spacing:.15em;color:var(--mut);margin:0 2px 0 4px}.sep{width:1px;height:20px;background:rgba(255,255,255,.1);margin:0 4px}
  .sheet{flex:1;overflow:auto;padding:28px 0 60px}
  .ed{max-width:760px;margin:0 auto;padding:26px 40px;min-height:calc(100% - 20px);background:#181b24;border:1px solid rgba(255,255,255,.05);border-radius:4px;
    color:#d9dde6;font-family:'Segoe UI',system-ui,-apple-system,'Noto Sans',sans-serif;font-size:17px;line-height:1.75;outline:none;caret-color:var(--cy);box-shadow:0 10px 40px rgba(0,0,0,.35)}
  .ed:empty::before{content:attr(data-ph);color:#5f6678}
  .ed :global(h1){font-size:1.7em;line-height:1.3;margin:.6em 0 .3em;color:#f1f4fa;font-weight:600}
  .ed :global(h2){font-size:1.35em;line-height:1.35;margin:.6em 0 .3em;color:#eef1f7;font-weight:600}
  .ed :global(h3){font-size:1.12em;margin:.6em 0 .25em;color:#e8ecf4;font-weight:600}
  .ed :global(p),.ed :global(div){margin:0 0 .35em}.ed :global(ul),.ed :global(ol){padding-left:1.5em;margin:.3em 0 .6em}
  .ed :global(blockquote){border-left:3px solid rgba(0,240,255,.4);margin:.5em 0;padding:.1em 0 .1em 1em;color:#b9c0cf}
  .ed :global(::selection){background:rgba(0,240,255,.25)}
</style>
