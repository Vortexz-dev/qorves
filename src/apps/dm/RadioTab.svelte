<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../lib/sfx';
  import { watchRadio, setRadio, fireShot, parseYt, uploadMp3, listMp3, dropMp3, emptyRadio, radioPos, MP3_MAX, type RadioState, type Track } from '../../lib/radio';
  let st = $state<RadioState>(emptyRadio()), url = $state(''), title = $state(''), msg = $state('');
  let files = $state<{ id: string; name: string; size: number }[]>([]), busy = $state(false);
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 3000); };
  const tr = $derived(st.list[st.i]);
  onMount(() => {
    const off = watchRadio((s) => { if (s) st = { ...emptyRadio(), ...s, list: s.list ?? [] }; });
    listMp3().then((x) => (files = x)).catch(() => {});
    return off;
  });
  function addUrl() {
    const p = parseYt(url); if (!p) { flash('Geçerli bir YouTube bağlantısı değil.'); return; }
    const t: Track = p.list && !p.video ? { id: p.list, kind: 'yt', title: title || ('Liste ' + p.list.slice(0, 8)), src: p.list } : { id: p.video!, kind: 'yt', title: title || p.video!, src: p.video! };
    st.list = [...st.list, t]; url = ''; title = ''; sfx.click();
  }
  async function addFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    busy = true;
    try { const t = await uploadMp3(f); st.list = [...st.list, t]; files = await listMp3(); flash('MP3 yüklendi.'); sfx.granted(); }
    catch (err) { flash(String(err)); sfx.error(); }
    busy = false;
  }
  function playAt(i: number) { setRadio({ ...st, i, pos: 0, t0: Date.now(), playing: true }); sfx.open(); }
  function pause() { setRadio({ playing: false, pos: radioPos(st), t0: Date.now() }); }
  function resume() { setRadio({ playing: true, pos: st.pos, t0: Date.now() }); }
  function seek(v: number) { setRadio({ pos: v, t0: Date.now(), playing: st.playing }); }
  function vol(v: number) { setRadio({ vol: v }); }
  function loop() { setRadio({ loop: !st.loop }); }
  function skip(dir: 1 | -1) {
    if (!st.list.length) return;
    const n = st.list.length; let i = st.i + dir;
    if (i < 0 || i >= n) { if (!st.loop) { if (i >= n) pause(); return; } i = (i + n) % n; }
    setRadio({ ...st, i, pos: 0, t0: Date.now(), playing: true }); sfx.open();
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= st.list.length) return;
    const list = st.list.slice(); const [it] = list.splice(i, 1); list.splice(j, 0, it!);
    const cur = st.i === i ? j : st.i === j ? i : st.i;
    st.list = list; st.i = cur; setRadio({ list, i: cur });
  }
  function saveList() { setRadio({ list: st.list, i: st.i }); flash('Liste kaydedildi.'); }
  function drop(i: number) { st.list = st.list.filter((_, k) => k !== i); if (st.i >= st.list.length) st.i = Math.max(0, st.list.length - 1); setRadio({ list: st.list, i: st.i }); }
  async function oneshotUrl() {
    const p = parseYt(url); if (!p?.video) { flash('Tek seferlik için video bağlantısı gerekli.'); return; }
    await fireShot({ kind: 'yt', src: p.video, title: title || p.video }); flash('Efekt gönderildi.'); sfx.ping();
  }
  async function oneshotMp3(id: string, name: string) { await fireShot({ kind: 'mp3', src: id, title: name }); flash('Efekt gönderildi.'); sfx.ping(); }
</script>
<div class="rd">
  <div class="now">
    <h4 class="mono">YAYIN</h4>
    <b>{tr ? tr.title : 'Kuyruk boş'}</b>
    <div class="row">
      {#if st.playing}<button class="btn" onclick={pause}>Duraklat</button>{:else}<button class="btn" onclick={resume} disabled={!st.list.length}>Çal</button>{/if}
      <button class="btn ghost" onclick={() => skip(-1)} disabled={!st.list.length}>‹ Önceki</button>
      <button class="btn ghost" onclick={() => skip(1)} disabled={!st.list.length}>Sonraki ›</button>
      <button class="btn ghost small" onclick={loop}>{st.loop ? 'Döngü açık' : 'Döngü kapalı'}</button>
      <span class="nt mono">{st.list.length ? (st.i + 1) + ' / ' + st.list.length : '—'}</span>
      <label class="field"><span>Ses (herkes)</span><input type="range" min="0" max="1" step="0.01" value={st.vol} oninput={(e) => vol(+e.currentTarget.value)} /></label>
    </div>
    <label class="field"><span>Konum (sn)</span><input class="inp" type="number" min="0" value={Math.floor(radioPos(st))} onchange={(e) => seek(+e.currentTarget.value)} /></label>
    <p class="nt">Oyuncular sağ alttaki MÜZİK kaydırıcısından kendi seslerini ayarlar. Sen durdurunca herkeste durur.</p>
  </div>
  <div class="ls">
    <h4 class="mono">KAYNAK EKLE</h4>
    <input class="inp" placeholder="YouTube video veya oynatma listesi bağlantısı" bind:value={url} />
    <input class="inp" placeholder="Başlık (isteğe bağlı)" bind:value={title} />
    <div class="row"><button class="btn small" onclick={addUrl}>Listeye ekle</button><button class="btn ghost small" onclick={oneshotUrl}>Tek seferlik efekt</button></div>
    <label class="btn ghost small up">MP3 yükle (en fazla {MP3_MAX/1024/1024} MB, 128 kbps önerilir)<input type="file" accept="audio/mpeg,audio/mp3,audio/*" hidden onchange={addFile} disabled={busy} /></label>
    <p class="nt">Spark’ta Cloud Storage yok; MP3’ler Firestore’da parça parça tutulur. Kitaplığı küçük tut (birkaç parça). Büyük dosyalar günlük yazma kotasını yer.</p>
    <h4 class="mono">KUYRUK ({st.list.length})</h4>
    {#each st.list as t, i (t.id + i)}
      <div class="it" class:on={i===st.i}><b>{t.title}</b> <em class="mono">{t.kind}</em>
        <button class="btn ghost small" onclick={() => playAt(i)}>Çal</button>
        <button class="btn ghost small" onclick={() => move(i, -1)} disabled={i===0}>↑</button>
        <button class="btn ghost small" onclick={() => move(i, 1)} disabled={i===st.list.length-1}>↓</button>
        <button class="btn red small" onclick={() => drop(i)}>Çıkar</button>
        {#if t.kind==='mp3'}<button class="btn ghost small" onclick={() => oneshotMp3(t.src, t.title)}>Efekt</button>{/if}
      </div>
    {:else}<p class="none">Liste boş. Video, liste veya MP3 ekle; karışık kuyruk olabilir.</p>{/each}
    <button class="btn" onclick={saveList} disabled={!st.list.length}>Kuyruğu kaydet</button>
    {#if files.length}<h4 class="mono">YÜKLÜ MP3</h4>{#each files as f (f.id)}<div class="it">{f.name} <small>{(f.size/1024/1024).toFixed(1)} MB</small> <button class="btn red small" onclick={() => dropMp3(f.id).then(() => listMp3().then((x) => files = x))}>Sil</button></div>{/each}{/if}
    {#if msg}<p class="msg mono">{msg}</p>{/if}
  </div>
</div>
<style>
  .rd{display:grid;grid-template-columns:1fr 1fr;gap:16px;height:100%;min-height:0;padding:12px 16px}
  .now,.ls{overflow:auto}.h4,h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:10px 0 6px}
  .now b{display:block;font-size:20px;margin-bottom:10px}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
  .it{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);padding:6px 8px;margin-bottom:6px}.it.on{border-color:var(--cy)}
  .it em{font-style:normal;color:var(--mut);font-size:11px}.nt{font-size:12.5px;color:var(--mut)}.msg{color:#39ff8a}.none{color:var(--mut)}
  .up{position:relative;display:inline-block}
</style>
