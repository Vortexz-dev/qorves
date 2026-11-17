<script lang="ts">
  import { onMount } from 'svelte';
  import { audio, sfx } from '../lib/sfx';
  import { session } from '../lib/session.svelte';
  import { radioLive } from '../lib/radiolive.svelte';
  import { watchRadio, watchShot, loadMp3, radioPos, advanceTrack, noteDuration, type RadioState, type OneShot, type Track } from '../lib/radio';

  type YTP = { loadVideoById: Function; loadPlaylist: Function; playVideo: Function; pauseVideo: Function; seekTo: Function; setVolume: Function; unMute: Function; getPlayerState: Function; getCurrentTime: Function; getDuration: Function; getVideoData?: () => { title?: string }; destroy: Function };
  const isDM = session.user?.role === 'dm';
  let st: RadioState | null = null;
  let lastShot = 0;
  let yt: YTP | null = null;
  let el: HTMLAudioElement | undefined = $state();
  let mp3Url = '', mp3Id = '', ytSrc = '', cur: Track | undefined;
  let want: RadioState | null = null;

  /** Etkin ses = DM yayın sesi × oyuncunun MÜZİK ayarı. Ses 0 olsa bile çalma DURMAZ; yalnız sessizleşir. */
  const gain = () => Math.max(0, Math.min(1, (st?.vol ?? 0.7) * audio.mediaGain()));
  function applyVol() {
    const v = gain();
    if (yt) try { yt.setVolume(Math.round(v * 100)); if (v > 0) yt.unMute(); } catch { /* yok */ }
    if (el) el.volume = v;
  }
  async function ensureYt(): Promise<void> {
    if ((window as unknown as { YT?: { Player?: unknown } }).YT?.Player) return;
    await new Promise<void>((res) => {
      const w = window as unknown as { onYouTubeIframeAPIReady?: () => void };
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => { prev?.(); res(); };
      if (!document.getElementById('qv-yt-api')) {
        const s = document.createElement('script'); s.id = 'qv-yt-api'; s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
      }
    });
  }
  async function attachYt() {
    await ensureYt();
    const YT = (window as unknown as { YT: { Player: new (el: string, o: object) => YTP } }).YT;
    await new Promise<void>((res) => {
      yt = new YT.Player('qv-yt', {
        width: 0, height: 0, playerVars: { autoplay: 0, controls: 0, disablekb: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: { onReady: () => res(), onStateChange: (e: { data: number }) => { if (e.data === 0) ended(); } },
      });
    });
  }
  function ended() {
    if (!st?.list?.length || !isDM) return;
    advanceTrack(st.i, st.t0).catch(() => {});
  }
  const isList = (t: Track) => /^(PL|UU|OL|RD|FL)/.test(t.src) && t.src.length > 14;
  async function sync(s: RadioState) {
    want = s; st = s;
    const tr: Track | undefined = s.list?.[s.i];
    radioLive.has = !!tr; radioLive.title = tr?.title ?? ''; radioLive.kind = tr?.kind ?? ''; radioLive.playing = !!tr && s.playing;
    if (tr?.dur) radioLive.dur = tr.dur;
    if (!tr) { try { yt?.pauseVideo(); } catch { /* yok */ } el?.pause(); cur = undefined; radioLive.pos = 0; radioLive.dur = 0; return; }
    const pos = radioPos(s);
    const same = cur && cur.id === tr.id && cur.src === tr.src;
    cur = tr;
    if (tr.kind === 'yt') {
      el?.pause();
      if (!yt) await attachYt();
      if (want !== s) return;
      try {
        if (!same || ytSrc !== tr.src) {
          ytSrc = tr.src; radioLive.dur = tr.dur ?? 0;
          if (isList(tr)) yt!.loadPlaylist({ list: tr.src, index: 0, startSeconds: pos });
          else yt!.loadVideoById({ videoId: tr.src, startSeconds: pos });
        } else if (Math.abs(yt!.getCurrentTime() - pos) > 1.5) yt!.seekTo(pos, true);
        applyVol();
        if (s.playing) yt!.playVideo(); else yt!.pauseVideo();
      } catch { /* yok */ }
    } else {
      try { yt?.pauseVideo(); } catch { /* yok */ }
      ytSrc = '';
      if (mp3Id !== tr.src || !mp3Url) {
        const url = await loadMp3(tr.src);
        if (want !== s) { if (url) URL.revokeObjectURL(url); return; }
        if (mp3Url) URL.revokeObjectURL(mp3Url);
        mp3Url = url ?? ''; mp3Id = tr.src;
        if (el && mp3Url) { el.src = mp3Url; await new Promise((r) => { el!.onloadedmetadata = r; setTimeout(r, 1500); }); }
      }
      if (want !== s || !el || !mp3Url) return;
      const p = radioPos(s);
      if (Math.abs(el.currentTime - p) > 0.6) el.currentTime = p;
      applyVol();
      if (s.playing) el.play().then(() => (radioLive.blocked = false)).catch(() => (radioLive.blocked = true)); else el.pause();
    }
  }
  // konum/süre takibi + kayma düzeltme (oynatıcı yayının gerisinde kalırsa)
  function tick() {
    if (!st || !cur) return;
    let pos = radioPos(st), dur = cur.dur ?? 0;
    try {
      if (cur.kind === 'yt' && yt) { pos = yt.getCurrentTime() || pos; dur = yt.getDuration() || dur; if (st.playing && yt.getPlayerState() !== 1 && yt.getPlayerState() !== 3) yt.playVideo(); }
      else if (el && el.src) {
        pos = el.currentTime; dur = isFinite(el.duration) ? el.duration : dur;
        if (st.playing && Math.abs(el.currentTime - radioPos(st)) > 2.5 && radioPos(st) < dur) el.currentTime = radioPos(st);
        if (st.playing && el.paused && !el.ended) el.play().then(() => (radioLive.blocked = false)).catch(() => (radioLive.blocked = true));
      }
    } catch { /* yok */ }
    radioLive.pos = pos; radioLive.dur = dur;
    if (isDM && dur > 0 && (!cur.dur || Math.abs(cur.dur - dur) >= 1)) { cur = { ...cur, dur: Math.round(dur) }; noteDuration(st.i, cur.id, dur).catch(() => {}); }
  }
  // tarayıcı otomatik oynatmayı engellediyse ilk tıklamada yeniden dene
  function unblock() { if (radioLive.blocked && st?.playing) { el?.play().then(() => (radioLive.blocked = false)).catch(() => {}); try { yt?.playVideo(); } catch { /* yok */ } } }

  onMount(() => {
    const a = watchRadio((s) => { if (s) void sync({ ...s, list: s.list ?? [] }); else { st = null; radioLive.has = false; } });
    const b = watchShot((s: OneShot | null) => {
      if (!s || s.at <= lastShot) return;
      const fresh = Date.now() - s.at < 15000; lastShot = s.at; if (!fresh) return;
      const v = Math.max(0.05, audio.mediaGain()); if (audio.muted) return;
      if (s.kind === 'yt') {
        const aux = document.createElement('iframe');
        aux.allow = 'autoplay';
        aux.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
        aux.src = `https://www.youtube.com/embed/${s.src}?autoplay=1&controls=0`;
        document.body.appendChild(aux); setTimeout(() => aux.remove(), 20000);
      } else {
        loadMp3(s.src).then((url) => { if (!url) return; const x = new Audio(url); x.volume = v; x.play().catch(() => {}); x.onended = () => URL.revokeObjectURL(url); });
      }
      sfx.ping();
    });
    const onv = () => applyVol();
    const iv = setInterval(tick, 500);
    addEventListener('qv-mvol', onv); addEventListener('pointerdown', unblock);
    return () => { a(); b(); clearInterval(iv); removeEventListener('qv-mvol', onv); removeEventListener('pointerdown', unblock); try { yt?.destroy(); } catch { /* yok */ } if (mp3Url) URL.revokeObjectURL(mp3Url); };
  });
</script>

<div class="hid"><div id="qv-yt"></div><audio bind:this={el} onended={ended} data-qv-radio></audio></div>
<style>
  .hid{position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none}
</style>
