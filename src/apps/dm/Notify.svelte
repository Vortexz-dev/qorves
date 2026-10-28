<script lang="ts">
  // Oyuncu masaüstüne bozuk sinyalli sistem bildirimi + belge/görsel bırakma.
  import { dm, pname } from './store.svelte';
  import { sendNotice, dropToDesk, putMedia, isOnline, type Notice } from '../../lib/live';
  import { sfx } from '../../lib/sfx';
  let to = $state<string[]>(dm.pid ? [dm.pid] : []), level = $state<Notice['level']>('warn'), title = $state(''), body = $state(''), msg = $state(''), busy = $state(false);
  let dname = $state(''), dbody = $state(''), durl = $state(''), dimg = $state(''), dsize = $state(0);
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 4000); };
  const all = () => (to = to.length === dm.users.length ? [] : dm.users.map((u) => u.uid));
  async function notify() {
    if (!to.length || !title.trim()) return; busy = true;
    try { await Promise.all(to.map((u) => sendNotice(u, { title: title.trim().slice(0, 120), body: body.trim().slice(0, 2000), level, from: 'dm' }))); sfx.glitch(); flash(`Bildirim gönderildi → ${to.length} oyuncu`); title = ''; body = ''; } catch (e) { sfx.error(); flash('Hata: ' + String(e)); }
    busy = false;
  }
  async function pick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    const im = new Image(); im.src = URL.createObjectURL(f); await im.decode().catch(() => {});
    let w = im.naturalWidth, h = im.naturalHeight, mx = 1800, q = 0.88, out = '';
    for (let i = 0; i < 8; i++) { const k = Math.min(1, mx / Math.max(w, h)); const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); out = c.toDataURL('image/jpeg', q); if (out.length < 900000) break; mx *= 0.8; q -= 0.06; }
    URL.revokeObjectURL(im.src); dimg = out; dsize = out.length; if (!dname) dname = f.name.replace(/\.[^.]+$/, '');
  }
  async function drop() {
    if (!to.length || !dname.trim()) return; busy = true;
    try {
      for (const u of to) { const src = dimg ? await putMedia(u, dimg) : durl.trim() || undefined; await dropToDesk(u, { kind: 'doc', name: dname.trim(), body: dbody, src }); }
      sfx.granted(); flash(`“${dname}” masaüstüne bırakıldı → ${to.length} oyuncu`); dname = ''; dbody = ''; durl = ''; dimg = '';
    } catch (e) { sfx.error(); flash('Hata: ' + String(e)); }
    busy = false;
  }
</script>
<div class="nf">
  <div class="tg">
    <h4 class="mono">ALICILAR <button class="lk" onclick={all}>{to.length === dm.users.length ? 'hiçbiri' : 'hepsi'}</button></h4>
    {#each dm.users as u (u.uid)}<label class="ck"><input type="checkbox" checked={to.includes(u.uid)} onchange={(e) => (to = (e.target as HTMLInputElement).checked ? [...to, u.uid] : to.filter((x) => x !== u.uid))} /><i class:on={isOnline(dm.pres.find((p) => p.uid === u.uid))}></i>{pname(u.uid)}</label>{/each}
    {#if msg}<p class="msg mono">{msg}</p>{/if}
  </div>
  <div class="fm">
    <h4 class="mono">SİSTEM BİLDİRİMİ</h4>
    <div class="lv">{#each [['info', 'BİLGİ'], ['warn', 'UYARI'], ['crit', 'KRİTİK']] as [k, l] (k)}<button class="lb {k}" class:on={level === k} onclick={() => (level = k as Notice['level'])}>{l}</button>{/each}</div>
    <label class="field"><span>Başlık</span><input class="inp" bind:value={title} maxlength="120" placeholder="ör. SİNYAL KESİNTİSİ" /></label>
    <label class="field"><span>Metin</span><textarea class="inp" rows="4" bind:value={body} maxlength="2000"></textarea></label>
    <button class="btn" disabled={busy || !to.length || !title.trim()} onclick={notify}>Masaüstüne gönder</button>
    <h4 class="mono">BELGE / GÖRSEL BIRAK</h4>
    <label class="field"><span>Belge adı</span><input class="inp" bind:value={dname} maxlength="80" placeholder="ör. Ele geçirilen kayıt" /></label>
    <label class="field"><span>İçerik (isteğe bağlı)</span><textarea class="inp" rows="5" bind:value={dbody} maxlength="19000"></textarea></label>
    <div class="row"><label class="field"><span>Görsel adresi (https://…)</span><input class="inp" bind:value={durl} maxlength="590" disabled={!!dimg} /></label><span class="or mono">ya da</span><label class="btn ghost small up">Görsel yükle<input type="file" accept="image/*" onchange={pick} hidden /></label></div>
    {#if dimg}<div class="pv"><img src={dimg} alt="" data-nolb /><span class="mono">{(dsize / 1024).toFixed(0)} KB</span><button class="lk" onclick={() => (dimg = '')}>kaldır</button></div>{/if}
    <button class="btn" disabled={busy || !to.length || !dname.trim()} onclick={drop}>Masaüstüne bırak</button>
  </div>
</div>
<style>
  .nf{display:grid;grid-template-columns:280px 1fr;gap:18px;height:100%;min-height:0;padding:12px 16px}
  .tg{overflow:auto}.fm{display:flex;flex-direction:column;gap:8px;overflow:auto;padding-right:6px;max-width:640px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:6px 0 4px;display:flex;gap:10px;align-items:center}
  .lk{background:none;border:0;color:var(--cy);font-size:11px;text-decoration:underline;padding:0}
  .ck{display:flex;gap:8px;align-items:center;padding:4px 0;font-size:14px}.ck i{width:7px;height:7px;border-radius:50%;background:#3a4452}.ck i.on{background:#39ff8a;box-shadow:0 0 6px #39ff8a}
  .msg{font-size:11.5px;color:#39ff8a}
  .lv{display:flex;gap:6px}.lb{flex:1;background:none;border:1px solid var(--line);color:var(--mut);font-family:var(--f-mono);font-size:11px;letter-spacing:.2em;padding:6px}
  .lb.on.info{border-color:var(--cy);color:var(--cy);background:rgba(0,240,255,.1)}.lb.on.warn{border-color:var(--ye);color:var(--ye);background:rgba(252,238,10,.1)}.lb.on.crit{border-color:var(--rd);color:var(--rd);background:rgba(255,42,85,.12)}
  textarea.inp{resize:vertical;font-family:var(--f-ui)}
  .row{display:flex;gap:8px;align-items:flex-end}.row .field{flex:1}.or{font-size:10px;color:var(--mut);padding-bottom:10px}.up{white-space:nowrap}
  .pv{display:flex;gap:10px;align-items:center}.pv img{height:70px;border:1px solid var(--line)}.pv span{font-size:11px;color:var(--mut)}
</style>
