<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../lib/sfx';
  import { radioLive, fmtTime } from '../../lib/radiolive.svelte';
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
    st.list = [...st.list, t]; url = ''; title = ''; sfx.click(); setRadio({ list: st.list }); flash('Kuyruğa eklendi.');
  }
  async function addFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    busy = true;
    try { const t = await uploadMp3(f); st.list = [...st.list, t]; setRadio({ list: st.list }); files = await listMp3(); flash('MP3 yüklendi.'); sfx.granted(); }
    catch (err) { flash(String(err)); sfx.error(); }
    busy = false;
  }
  function playAt(i: number) { setRadio({ ...st, i, pos: 0, t0: Date.now(), playing: true }); sfx.open(); }
  function pause() { setRadio({ playing: false, pos: radioPos(st), t0: Date.now() }); }
  function resume() { setRadio({ playing: true, pos: st.pos, t0: Date.now() }); }
  function seek(v: number) { setRadio({ pos: Math.max(0, v), t0: Date.now(), playing: st.playing }); }
  let drag = $state(false), dragV = $state(0), volDrag = $state<number | null>(null);
  const dur = $derived(radioLive.dur || tr?.dur || 0);
  const shownPos = $derived(drag ? dragV : Math.min(radioLive.has ? radioLive.pos : radioPos(st), dur || 1e9));
  let vt: ReturnType<typeof setTimeout> | undefined;
  function volLive(v: number) { volDrag = v; clearTimeout(vt); vt = setTimeout(() => vol(v), 120); }
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
  <section class="pl">
    <div class="art" class:on={st.playing}>
      <div class="disc"><i></i></div>
      <div class="bars">{#each Array(18) as _, k}<b style="animation-delay:{-k * 0.13}s"></b>{/each}</div>
    </div>
    <div class="meta">
      <span class="k mono">{st.playing ? 'YAYINDA · HERKESTE' : tr ? 'DURAKLATILDI' : 'YAYIN BEKLİYOR'}</span>
      <b class="tt">{tr ? tr.title : 'Kuyruk boş'}</b>
      <span class="src mono">{tr ? (tr.kind === 'yt' ? 'YOUTUBE' : 'MP3 · ARŞİV') + ' · ' + (st.i + 1) + ' / ' + st.list.length : 'Sağdan parça ekle'}</span>
    </div>
    <div class="seek">
      <span class="mono">{fmtTime(shownPos)}</span>
      <input type="range" min="0" max={Math.max(1, Math.floor(dur))} step="1" value={Math.floor(shownPos)} disabled={!tr || !dur}
        style="--p:{dur ? (shownPos / dur) * 100 : 0}%" aria-label="Konum"
        oninput={(e) => { drag = true; dragV = +e.currentTarget.value; }}
        onchange={(e) => { seek(+e.currentTarget.value); drag = false; sfx.click(); }} />
      <span class="mono">{dur ? fmtTime(dur) : '--:--'}</span>
    </div>
    <div class="ctl">
      <button class="ic sm" class:act={st.loop} onclick={loop} title="Döngü" aria-label="Döngü"><svg viewBox="0 0 24 24"><path d="M4 11V9a3 3 0 0 1 3-3h11l-3-3m3 3-3 3M20 13v2a3 3 0 0 1-3 3H6l3 3m-3-3 3-3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>
      <button class="ic" onclick={() => skip(-1)} disabled={!st.list.length} aria-label="Önceki"><svg viewBox="0 0 24 24"><path d="M6 5v14M19 5 8 12l11 7z" fill="currentColor" stroke="currentColor" stroke-width="1.5"/></svg></button>
      <button class="ic big" onclick={() => (st.playing ? pause() : resume())} disabled={!st.list.length} aria-label={st.playing ? 'Duraklat' : 'Çal'}>
        {#if st.playing}<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>{:else}<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>{/if}
      </button>
      <button class="ic" onclick={() => skip(1)} disabled={!st.list.length} aria-label="Sonraki"><svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l11 7-11 7z" fill="currentColor" stroke="currentColor" stroke-width="1.5"/></svg></button>
      <span class="sp"></span>
    </div>
    <div class="vol">
      <svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 9a4 4 0 0 1 0 6" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>
      <input type="range" min="0" max="1" step="0.01" value={volDrag ?? st.vol} style="--p:{(volDrag ?? st.vol) * 100}%" aria-label="Yayın sesi (herkes)"
        oninput={(e) => volLive(+e.currentTarget.value)} onchange={(e) => { vol(+e.currentTarget.value); volDrag = null; }} />
      <span class="mono">{Math.round((volDrag ?? st.vol) * 100)}</span>
      <em>Yayın sesi herkeste uygulanır; oyuncunun kendi MÜZİK ayarıyla çarpılır.</em>
    </div>
    <h4 class="mono">SIRADA</h4>
    <div class="q">
      {#each st.list as t, i (t.id + i)}
        <div class="it" class:on={i === st.i}>
          <button class="pi" onclick={() => playAt(i)} title="Şimdi çal">{#if i === st.i && st.playing}<i class="eqi"><b></b><b></b><b></b></i>{:else}<span class="mono">{i + 1}</span>{/if}</button>
          <div class="nm"><b>{t.title}</b><small class="mono">{t.kind === 'yt' ? 'YouTube' : 'MP3'}{t.dur ? ' · ' + fmtTime(t.dur) : ''}</small></div>
          <button class="mini" onclick={() => move(i, -1)} disabled={i === 0} aria-label="Yukarı">↑</button>
          <button class="mini" onclick={() => move(i, 1)} disabled={i === st.list.length - 1} aria-label="Aşağı">↓</button>
          {#if t.kind === 'mp3'}<button class="mini" onclick={() => oneshotMp3(t.src, t.title)} title="Tek seferlik efekt olarak çal">FX</button>{/if}
          <button class="mini red" onclick={() => drop(i)} aria-label="Çıkar">✕</button>
        </div>
      {:else}<p class="none">Kuyruk boş. YouTube videosu, oynatma listesi ya da MP3 ekle; karışık olabilir.</p>{/each}
    </div>
  </section>
  <section class="ls">
    <h4 class="mono">KAYNAK EKLE</h4>
    <input class="inp" placeholder="YouTube video veya oynatma listesi bağlantısı" bind:value={url} />
    <input class="inp" placeholder="Başlık (görünen şarkı adı)" bind:value={title} />
    <div class="row"><button class="btn small" onclick={addUrl} disabled={!url}>Kuyruğa ekle</button><button class="btn ghost small" onclick={oneshotUrl} disabled={!url}>Tek seferlik efekt</button></div>
    <label class="btn ghost small up">{busy ? 'Yükleniyor…' : 'MP3 yükle'} <small>(en fazla {MP3_MAX/1024/1024} MB, 128 kbps önerilir)</small><input type="file" accept="audio/mpeg,audio/mp3,audio/*" hidden onchange={addFile} disabled={busy} /></label>
    <p class="nt">Spark’ta Cloud Storage yok; MP3’ler Firestore’da parça parça tutulur. Kitaplığı küçük tut.</p>
    {#if files.length}<h4 class="mono">YÜKLÜ MP3</h4>{#each files as f (f.id)}<div class="fl">{f.name} <small>{(f.size/1024/1024).toFixed(1)} MB</small> <button class="mini red" onclick={() => dropMp3(f.id).then(() => listMp3().then((x) => files = x))}>Sil</button></div>{/each}{/if}
    {#if msg}<p class="msg mono">{msg}</p>{/if}
  </section>
</div>
<style>
  .rd{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:18px;height:100%;min-height:0;padding:14px 18px}
  .pl,.ls{overflow:auto;min-height:0}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:14px 0 8px}
  .pl{display:flex;flex-direction:column;gap:12px}
  .art{height:128px;position:relative;border:1px solid rgba(0,240,255,.25);background:radial-gradient(circle at 20% 50%,rgba(0,240,255,.15),transparent 60%),linear-gradient(120deg,#060912,#0b0f1d);display:flex;align-items:center;gap:20px;padding:0 22px;overflow:hidden}
  .disc{width:92px;height:92px;border-radius:50%;background:repeating-radial-gradient(circle,#111 0 2px,#1b1f2a 2px 4px);border:1px solid rgba(0,240,255,.4);display:grid;place-items:center;box-shadow:0 0 24px rgba(0,240,255,.15)}
  .disc i{width:26px;height:26px;border-radius:50%;background:radial-gradient(circle,#04050a 0 3px,var(--ye) 3px)}
  .art.on .disc{animation:spin 3.2s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .bars{flex:1;display:flex;align-items:flex-end;gap:4px;height:70px}.bars b{flex:1;height:8%;background:linear-gradient(0deg,var(--cy),var(--ye));opacity:.7}
  .art.on .bars b{animation:eq 1.1s ease-in-out infinite}
  @keyframes eq{0%,100%{height:10%}30%{height:90%}60%{height:40%}}
  .meta{display:flex;flex-direction:column;gap:3px}
  .k{font-size:10px;letter-spacing:.3em;color:#39ff8a}.tt{font-size:22px;font-family:var(--f-disp);letter-spacing:.04em;color:var(--tx,#eef7fb)}.src{font-size:10.5px;color:var(--mut);letter-spacing:.18em}
  .seek{display:flex;align-items:center;gap:10px}.seek span{font-size:11px;color:var(--mut);min-width:42px;text-align:center}
  input[type=range]{-webkit-appearance:none;appearance:none;flex:1;height:5px;background:linear-gradient(90deg,var(--cy) var(--p),rgba(255,255,255,.12) var(--p));outline:none;cursor:pointer}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 0 10px var(--cy);opacity:0;transition:opacity .15s}
  input[type=range]:hover::-webkit-slider-thumb,input[type=range]:active::-webkit-slider-thumb{opacity:1}
  input[type=range]:disabled{opacity:.35;cursor:default}
  .ctl{display:flex;align-items:center;justify-content:center;gap:16px}
  .ic{width:40px;height:40px;display:grid;place-items:center;background:none;border:0;color:var(--tx,#dfeaf0);cursor:pointer;border-radius:50%}.ic svg{width:20px;height:20px}
  .ic:hover:not(:disabled){color:var(--cy)}.ic:disabled{opacity:.3}.ic.sm svg{width:18px;height:18px}.ic.act{color:#39ff8a;filter:drop-shadow(0 0 5px #39ff8a)}
  .ic.big{width:52px;height:52px;background:var(--cy);color:#04050a;box-shadow:0 0 18px rgba(0,240,255,.4)}.ic.big:hover:not(:disabled){transform:scale(1.06);color:#04050a}.ic.big svg{width:24px;height:24px}
  .sp{width:40px}
  .vol{display:grid;grid-template-columns:20px 1fr 34px;align-items:center;gap:10px;color:var(--mut)}.vol svg{width:18px;height:18px}.vol span{font-size:11px}
  .vol em{grid-column:1/-1;font-style:normal;font-size:11.5px;color:var(--mut)}
  .q{display:flex;flex-direction:column;gap:2px}
  .it{display:grid;grid-template-columns:34px 1fr auto auto auto auto;gap:6px;align-items:center;padding:6px 8px;border:1px solid transparent}
  .it:hover{background:rgba(255,255,255,.04)}.it.on{border-color:rgba(0,240,255,.4);background:rgba(0,240,255,.06)}.it.on b{color:var(--cy)}
  .pi{width:30px;height:30px;background:none;border:0;color:var(--mut);cursor:pointer}.pi:hover{color:var(--cy)}
  .eqi{display:inline-flex;gap:2px;align-items:flex-end;height:12px}.eqi b{width:3px;background:var(--cy);animation:eqb .9s ease-in-out infinite}.eqi b:nth-child(2){animation-delay:-.3s}.eqi b:nth-child(3){animation-delay:-.6s}
  @keyframes eqb{0%,100%{height:3px}50%{height:12px}}
  .nm{display:flex;flex-direction:column;min-width:0}.nm b{font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nm small{font-size:10.5px;color:var(--mut)}
  .mini{min-width:26px;height:26px;padding:0 6px;background:rgba(255,255,255,.04);border:1px solid var(--line);color:var(--tx,#cfe3ee);cursor:pointer;font-size:11px}.mini:hover:not(:disabled){border-color:var(--cy);color:var(--cy)}.mini:disabled{opacity:.3}.mini.red:hover{border-color:var(--rd);color:var(--rd)}
  .ls{display:flex;flex-direction:column;gap:8px}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .fl{display:flex;gap:8px;align-items:center;font-size:12.5px}.fl small{color:var(--mut)}
  .nt{font-size:12px;color:var(--mut)}.msg{color:#39ff8a}.none{color:var(--mut);font-size:13px}
  .up{position:relative;display:inline-block}
</style>
