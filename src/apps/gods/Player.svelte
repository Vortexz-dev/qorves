<script lang="ts">
  // God's Eye — oyuncu görünümü: yalnız atanmış sahnenin sınırları, sığdırılmış ve canlı.
  import { onMount } from 'svelte';
  import { session } from '../../lib/session.svelte';
  import { watchAsg, watchScene, watchInks, watchTokens, watchPings, saveToken, moveToken, deleteToken, sendPing, addLog, colorOf, tokenImg, now, type Scene, type Ink, type Token, type Ping } from '../../lib/gods';
  import { drawScene, drawTokens, drawPings, hitToken, capture, setImgListener, PING_MS } from './render';
  import { putMedia } from '../../lib/live';
  import { saveImage, freeCell, toast } from '../../lib/desk.svelte';
  import { notes } from '../../lib/notes.svelte';
  import { backend } from '../../lib/backend';
  import { sfx } from '../../lib/sfx';
  import NoSignal from './NoSignal.svelte';
  import { wm } from '../../desktop/wm.svelte';
  const me = session.user!, col = colorOf(me.uid), nm = me.character?.name || me.username;
  let sid = $state(''), scene = $state<Scene | null>(null), denied = $state(false), got = $state(false), inks: Record<string, Ink> = {}, toks = $state<Token[]>([]), pings: Ping[] = [];
  let tool = $state<'' | 'ping'>(''), pin = $state(false), hov = $state(false), noteOpen = $state(false), noteBody = $state(''), noteAsk = $state(false), noteName = $state('');
  let myImg = '', flash = $state<{ src: string } | null>(null), busy = $state(false);
  let wrap: HTMLDivElement, cv: HTMLCanvasElement, dirty = true, fit = { k: 1, ox: 0, oy: 0 };
  const mine = $derived(toks.find((t) => t.uid === me.uid));
  let drag: { x: number; y: number; ghost: boolean } | null = $state(null), lastSend = 0, sendT: ReturnType<typeof setTimeout> | undefined;
  const mark = () => (dirty = true);
  setImgListener(mark);
  $effect(() => {
    if (!sid) { scene = null; return; }
    denied = false; got = false; inks = {}; toks = []; pings = [];
    const a = watchScene(sid, (s) => { scene = s; got = true; mark(); }, () => (denied = true));
    const b = watchInks(sid, (m) => { inks = m; mark(); });
    const c = watchTokens(sid, (l) => { if (!drag) toks = l; else toks = l.map((t) => (t.uid === me.uid ? toks.find((x) => x.uid === me.uid) ?? t : t)); mark(); });
    const d = watchPings(sid, (l) => { const fresh = l.filter((p) => now() - p.at < PING_MS); if (fresh.some((p) => !pings.some((q) => q.uid === p.uid && q.at === p.at))) sfx.ping(); pings = l; mark(); });
    return () => { a(); b(); c(); d(); };
  });
  onMount(() => {
    const stop = watchAsg((m) => (sid = m[me.uid] || ''));
    tokenImg(me.avatar).then((s) => (myImg = s));
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop); if (wm.coreMin || !cv || !scene) return;
      const t = now(), lp = pings.some((p) => t - p.at < PING_MS);
      if (!dirty && !lp) return; dirty = false;
      const W = wrap.clientWidth, H = wrap.clientHeight, dpr = devicePixelRatio || 1;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const k = Math.min(W / scene.w, H / scene.h); fit = { k, ox: (W - scene.w * k) / 2, oy: (H - scene.h * k) / 2 };
      const g = cv.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      g.setTransform(dpr * k, 0, 0, dpr * k, dpr * fit.ox, dpr * fit.oy);
      g.save(); g.beginPath(); g.rect(0, 0, scene.w, scene.h); g.clip(); g.fillStyle = '#000'; g.fillRect(0, 0, scene.w, scene.h);
      drawScene(g, scene, inks); drawTokens(g, toks); drawPings(g, pings, t, k); g.restore();
    };
    raf = requestAnimationFrame(loop);
    const ro = new ResizeObserver(mark); ro.observe(wrap);
    return () => { stop(); cancelAnimationFrame(raf); ro.disconnect(); };
  });
  const toScene = (e: { clientX: number; clientY: number }) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - fit.ox) / fit.k, y: (e.clientY - r.top - fit.oy) / fit.k }; };
  const inside = (p: { x: number; y: number }) => !!scene && p.x >= 0 && p.y >= 0 && p.x <= scene.w && p.y <= scene.h;
  const clamp = (p: { x: number; y: number }) => ({ x: Math.round(Math.max(0, Math.min(scene!.w, p.x))), y: Math.round(Math.max(0, Math.min(scene!.h, p.y))) });
  function down(e: PointerEvent) {
    if (!scene || e.button !== 0) return; const p = toScene(e); if (!inside(p)) return;
    if (tool === 'ping') { const pg: Ping = { sid, uid: me.uid, name: nm.split(' ')[0], col, ...clamp(p), at: now() }; pings = [...pings.filter((x) => x.uid !== me.uid), pg]; mark(); sfx.ping(); sendPing(pg).catch(() => toast('İşaret gönderilemedi')); return; }
    const t = hitToken(toks, p.x, p.y); if (t && t.uid === me.uid) { drag = { x: p.x, y: p.y, ghost: false }; cv.setPointerCapture(e.pointerId); }
  }
  function moveMine(p: { x: number; y: number }, final = false) {
    const t = toks.find((x) => x.uid === me.uid); if (!t) return; const c = clamp(p); t.x = c.x; t.y = c.y; mark();
    clearTimeout(sendT); const go = () => { lastSend = now(); moveToken(t, t.x, t.y).catch(() => {}); };
    if (final || now() - lastSend > 125) go(); else sendT = setTimeout(go, 125);
  }
  function mv(e: PointerEvent) { if (drag && !drag.ghost) moveMine(toScene(e)); }
  function up(e: PointerEvent) { if (drag && !drag.ghost) { moveMine(toScene(e), true); drag = null; } }
  // jeton: araç çubuğundan sahneye sürükle
  function chipDown(e: PointerEvent) {
    if (!scene) return; e.preventDefault(); drag = { x: e.clientX, y: e.clientY, ghost: true };
    const m = (ev: PointerEvent) => drag && (drag = { x: ev.clientX, y: ev.clientY, ghost: true });
    const u = async (ev: PointerEvent) => { removeEventListener('pointermove', m); removeEventListener('pointerup', u); drag = null; const p = toScene(ev); if (!inside(p) || !scene) return;
      const c = clamp(p); const t: Token = { sid, uid: me.uid, name: nm, img: myImg, col, ...c, at: now() };
      toks = [...toks.filter((x) => x.uid !== me.uid), t]; mark(); sfx.granted(); try { await saveToken(t); } catch { toast('Jeton yerleştirilemedi'); } };
    addEventListener('pointermove', m); addEventListener('pointerup', u);
  }
  async function removeMine() { if (!mine) return; toks = toks.filter((t) => t.uid !== me.uid); mark(); sfx.click(); await deleteToken(sid, me.uid).catch(() => {}); }
  async function shot() {
    if (!scene || busy) return; busy = true; sfx.key();
    try {
      const c = capture(scene, inks, toks); let q = 0.88, url = c.toDataURL('image/webp', q);
      while (url.length > 930_000 && q > 0.4) { q -= 0.12; url = c.toDataURL('image/webp', q); }
      if (url.length > 930_000) { const s = document.createElement('canvas'); s.width = c.width / 2; s.height = c.height / 2; s.getContext('2d')!.drawImage(c, 0, 0, s.width, s.height); url = s.toDataURL('image/webp', 0.8); }
      flash = { src: url }; setTimeout(() => (flash = null), 1500);
      const d = new Date(), name = `${scene.name} · ${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
      const src = await putMedia(me.uid, url); await saveImage(src, 'Ekran görüntüsü — ' + name);
      const th = document.createElement('canvas'); th.width = 320; th.height = Math.round(320 * c.height / c.width); th.getContext('2d')!.drawImage(c, 0, 0, th.width, th.height);
      void addLog({ uid: me.uid, name: nm, kind: 'shot', title: name, sid, scene: scene.name, src, thumb: th.toDataURL('image/webp', 0.7), at: now() });
      sfx.granted();
    } catch (e) { console.warn(e); sfx.error(); toast('Ekran görüntüsü kaydedilemedi'); }
    busy = false;
  }
  async function saveNote() {
    const title = noteName.trim().slice(0, 80); if (!title || !noteBody.trim()) return;
    const p = freeCell(); const n = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title, body: noteBody, x: p.x, y: p.y, updatedAt: Date.now() };
    notes.list.push(n); try { await backend.saveNote(me.uid, n); } catch { sfx.error(); toast('Not kaydedilemedi'); return; }
    void addLog({ uid: me.uid, name: nm, kind: 'note', title, body: noteBody.slice(0, 18000), sid, scene: scene?.name ?? '', at: now() });
    sfx.granted(); toast('Masaüstüne kaydedildi: ' + title); noteAsk = false; noteName = ''; noteBody = '';
  }
  const open = $derived(pin || hov);
</script>
<div class="pv" bind:this={wrap}>
  {#if !sid || denied || (got && !scene)}
    <NoSignal />
  {:else}
    <canvas bind:this={cv} class:ping={tool === 'ping'} onpointerdown={down} onpointermove={mv} onpointerup={up} oncontextmenu={(e) => e.preventDefault()}></canvas>
    {#if !scene}<div class="ld mono">SAHNE YÜKLENİYOR…</div>{/if}
    <div class="tb" class:open role="toolbar" aria-label="Araçlar" tabindex="-1" onmouseenter={() => (hov = true)} onmouseleave={() => (hov = false)}>
      <button class="t" class:on={tool === 'ping'} onclick={() => { tool = tool === 'ping' ? '' : 'ping'; sfx.click(); }} title="İşaret: sahneye tıkla, herkes görsün">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/></svg><span>İşaret</span></button>
      <div class="t tok" title={mine ? 'Jetonun sahnede · tutup sürükle' : 'Jetonunu sahneye sürükle'}>
        <button class="chip" style:--c={col} onpointerdown={chipDown} aria-label="Jeton">{#if myImg}<img src={myImg} alt="" />{:else}<b>{nm[0]}</b>{/if}</button>
        <span>Jeton</span>{#if mine && open}<button class="rm" onclick={removeMine} title="Jetonu sahneden kaldır">Kaldır</button>{/if}
      </div>
      <button class="t" onclick={shot} disabled={busy || !scene} title="Ekran görüntüsü al, masaüstüne kaydet">
        <svg viewBox="0 0 24 24"><path d="M3 8h4l2-3h6l2 3h4v11H3z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span>Ekran görüntüsü</span></button>
      <button class="t" class:on={noteOpen} onclick={() => { noteOpen = !noteOpen; sfx.click(); }} title="Not al">
        <svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 10h8M8 14h8M8 18h5" stroke="currentColor" stroke-width="1.4"/></svg><span>Notlar</span></button>
      <button class="pin" class:on={pin} onclick={() => (pin = !pin)} title={pin ? 'Sabitlemeyi kaldır' : 'Araç çubuğunu sabitle'}><svg viewBox="0 0 24 24"><path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
    </div>
    {#if noteOpen}
      <div class="note" role="dialog" aria-label="Not">
        <header><span class="mono">NOT</span><button class="sv" onclick={() => { noteAsk = true; }} disabled={!noteBody.trim()}>Masaüstüne kaydet</button><button class="x" onclick={() => (noteOpen = false)} aria-label="Kapat">×</button></header>
        <textarea bind:value={noteBody} placeholder="Aklına geleni yaz…" maxlength="18000"></textarea>
        {#if noteAsk}<form class="ask" onsubmit={(e) => { e.preventDefault(); saveNote(); }}><span>Dosya adı</span><!-- svelte-ignore a11y_autofocus --><input autofocus bind:value={noteName} maxlength="80" placeholder="Örn. Liman ipuçları" /><button type="submit" disabled={!noteName.trim()}>Kaydet</button><button type="button" onclick={() => (noteAsk = false)}>Vazgeç</button></form>{/if}
      </div>
    {/if}
    {#if drag?.ghost}<div class="ghost" style:left="{drag.x}px" style:top="{drag.y}px" style:--c={col}>{#if myImg}<img src={myImg} alt="" />{:else}<b>{nm[0]}</b>{/if}</div>{/if}
    {#if flash}<div class="flash"></div><img class="fly" src={flash.src} alt="" />{/if}
  {/if}
</div>
<style>
  .pv{position:absolute;inset:46px 0 0 0;background:#000}
  canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}canvas.ping{cursor:crosshair}
  .ld{position:absolute;inset:0;display:grid;place-items:center;color:var(--mut);letter-spacing:.3em;font-size:12px}
  .tb{position:absolute;left:12px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:4px;padding:6px;background:rgba(5,8,14,.82);border:1px solid rgba(0,240,255,.25);width:48px;overflow:hidden;transition:width .22s cubic-bezier(.2,.9,.3,1),border-color .2s;z-index:3}
  .tb.open{width:196px;border-color:rgba(0,240,255,.55)}
  .t{display:flex;align-items:center;gap:10px;height:36px;padding:0 6px;background:none;border:1px solid transparent;color:#cfe;white-space:nowrap;font:inherit;font-size:14px;cursor:pointer;text-align:left}
  .t svg{width:22px;height:22px;flex:none}.t:hover{border-color:rgba(0,240,255,.3);background:rgba(0,240,255,.06)}.t.on{color:#04050a;background:var(--cy)}
  .t:disabled{opacity:.4;cursor:default}
  .tok{cursor:default}.chip{width:26px;height:26px;margin:0 -2px;border-radius:50%;border:2px solid var(--c);padding:0;overflow:hidden;background:#0a0f18;cursor:grab;flex:none;display:grid;place-items:center;color:var(--c);font-weight:700}
  .chip img,.ghost img{width:100%;height:100%;object-fit:cover}.rm{margin-left:auto;font:inherit;font-size:11px;padding:2px 6px;background:none;border:1px solid rgba(255,42,85,.5);color:var(--rd);cursor:pointer}
  .pin{align-self:flex-end;width:26px;height:22px;padding:2px;background:none;border:none;color:var(--mut);cursor:pointer;opacity:0;transition:opacity .2s}.tb.open .pin{opacity:1}.pin.on{color:var(--ye);opacity:1}.pin svg{width:16px;height:16px}
  .ghost{position:fixed;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;border:3px solid var(--c);overflow:hidden;pointer-events:none;z-index:20;display:grid;place-items:center;background:#0a0f18;color:var(--c);font-size:22px;box-shadow:0 0 16px var(--c)}
  .note{position:absolute;right:18px;top:18px;width:340px;display:flex;flex-direction:column;background:rgba(18,16,6,.96);border:1px solid rgba(252,238,10,.5);box-shadow:0 10px 30px rgba(0,0,0,.6);z-index:4;animation:ni .22s ease-out}
  .note header{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border-bottom:1px solid rgba(252,238,10,.2)}.note header span{font-size:10px;letter-spacing:.35em;color:var(--ye)}
  .sv{margin-left:auto;font:inherit;font-size:12.5px;padding:3px 10px;background:rgba(252,238,10,.12);border:1px solid rgba(252,238,10,.55);color:var(--ye);cursor:pointer}.sv:disabled{opacity:.4;cursor:default}
  .x{width:24px;height:24px;background:none;border:none;color:var(--mut);font-size:18px;cursor:pointer}
  textarea{height:220px;resize:vertical;background:transparent;border:none;color:#f4efc8;font:15px/1.5 var(--f-ui);padding:10px 12px;outline:none}
  .ask{display:flex;align-items:center;gap:6px;padding:8px;border-top:1px solid rgba(252,238,10,.2);font-size:12px;color:var(--mut)}
  .ask input{flex:1;min-width:0;background:rgba(0,0,0,.4);border:1px solid rgba(252,238,10,.4);color:#fff;font:inherit;font-size:13px;padding:4px 6px}
  .ask button{font:inherit;font-size:12px;padding:4px 8px;background:none;border:1px solid rgba(255,255,255,.2);color:#ddd;cursor:pointer}.ask button[type=submit]{border-color:var(--ye);color:var(--ye)}
  .flash{position:absolute;inset:0;background:#fff;pointer-events:none;animation:fl .45s ease-out forwards;z-index:6}
  .fly{position:absolute;left:10%;top:10%;width:80%;height:80%;object-fit:contain;pointer-events:none;z-index:7;border:2px solid var(--cy);animation:fy 1.3s cubic-bezier(.6,0,.3,1) forwards}
  @keyframes fl{from{opacity:.85}to{opacity:0}}
  @keyframes fy{0%{transform:none;opacity:1}35%{transform:scale(.92);opacity:1}100%{transform:translate(-48%,52%) scale(.08);opacity:.2}}
  @keyframes ni{from{opacity:0;transform:translateY(-8px)}}
</style>
