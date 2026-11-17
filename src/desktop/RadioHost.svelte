<script lang="ts">
  import { onMount } from 'svelte';
  import { audio, sfx } from '../lib/sfx';
  import { watchRadio, watchShot, loadMp3, radioPos, type RadioState, type OneShot, type Track } from '../lib/radio';

  let st = $state<RadioState | null>(null);
  let lastShot = 0;
  let yt: { loadVideoById: Function; loadPlaylist: Function; playVideo: Function; pauseVideo: Function; seekTo: Function; setVolume: Function; getPlayerState: Function; getCurrentTime: Function; destroy: Function } | null = null;
  let el: HTMLAudioElement | undefined = $state();
  let mp3Url = $state('');
  let ready = false, want: RadioState | null = null;

  function applyVol() {
    const v = audio.mediaGain();
    if (yt) try { yt.setVolume(Math.round(v * 100)); if (v === 0) yt.pauseVideo(); } catch {}
    if (el) el.volume = v;
  }
  function label(s: RadioState | null) {
    const n = document.getElementById('qv-radio-now'); if (!n) return;
    const tr = s?.list[s.i]; n.textContent = tr ? (s!.playing ? 'Çalıyor: ' : 'Duraklatıldı: ') + tr.title : '';
  }
  async function ensureYt(): Promise<void> {
    if ((window as unknown as { YT?: { Player: new (el: string, o: object) => typeof yt } }).YT?.Player) return;
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
    const YT = (window as unknown as { YT: { Player: new (el: string, o: object) => typeof yt } }).YT;
    await new Promise<void>((res) => {
      yt = new YT.Player('qv-yt', {
        width: 0, height: 0, playerVars: { autoplay: 0, controls: 0, disablekb: 1, rel: 0, modestbranding: 1 },
        events: { onReady: () => res(), onStateChange: (e: { data: number }) => { if (e.data === 0) ended(); } },
      });
    });
  }
  function ended() {
    if (!st?.list.length) return;
    const n = st.i + 1;
    if (n >= st.list.length) {
      if (st.loop) import('../lib/radio').then((m) => m.setRadio({ i: 0, pos: 0, t0: Date.now(), playing: true }));
      else import('../lib/radio').then((m) => m.setRadio({ playing: false, pos: 0, t0: Date.now() }));
    } else import('../lib/radio').then((m) => m.setRadio({ i: n, pos: 0, t0: Date.now(), playing: true }));
  }
  async function sync(s: RadioState) {
    want = s; st = s; label(s);
    const tr: Track | undefined = s.list[s.i];
    if (!tr) { try { yt?.pauseVideo(); } catch {} if (el) { el.pause(); } return; }
    const pos = radioPos(s);
    if (tr.kind === 'yt') {
      if (!yt) await attachYt();
      if (want !== s) return;
      if (el) { el.pause(); }
      try {
        if (tr.src.startsWith('PL') || tr.src.startsWith('UU') || tr.src.length > 20 && !tr.src.startsWith('http') && tr.src.startsWith('PL')) {
          yt!.loadPlaylist({ list: tr.src, index: 0, startSeconds: pos });
        } else {
          yt!.loadVideoById({ videoId: tr.src, startSeconds: pos });
        }
        applyVol();
        if (s.playing && audio.mediaGain() > 0) yt!.playVideo(); else yt!.pauseVideo();
      } catch {}
    } else {
      try { yt?.pauseVideo(); } catch {}
      if (mp3Url && !mp3Url.startsWith('blob')) { /* keep */ }
      const url = await loadMp3(tr.src);
      if (want !== s) { if (url) URL.revokeObjectURL(url); return; }
      if (mp3Url) URL.revokeObjectURL(mp3Url);
      mp3Url = url ?? '';
      await new Promise((r) => setTimeout(r, 30));
      if (el && mp3Url) {
        el.src = mp3Url; el.currentTime = pos; applyVol();
        if (s.playing) el.play().catch(() => {}); else el.pause();
      }
    }
  }

  onMount(() => {
    const a = watchRadio((s) => { if (s) void sync(s); else { st = null; label(null); } });
    const b = watchShot((s: OneShot | null) => {
      if (!s || s.at <= lastShot) return; lastShot = s.at;
      const v = audio.mediaGain(); if (v <= 0) return;
      if (s.kind === 'yt') {
        const aux = document.createElement('iframe');
        aux.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
        aux.src = `https://www.youtube.com/embed/${s.src}?autoplay=1&controls=0`;
        document.body.appendChild(aux); setTimeout(() => aux.remove(), 20000);
      } else {
        loadMp3(s.src).then((url) => { if (!url) return; const x = new Audio(url); x.volume = v; x.play().catch(() => {}); x.onended = () => URL.revokeObjectURL(url); });
      }
      sfx.ping();
    });
    const onv = () => applyVol();
    addEventListener('qv-mvol', onv);
    return () => { a(); b(); removeEventListener('qv-mvol', onv); try { yt?.destroy(); } catch {} if (mp3Url) URL.revokeObjectURL(mp3Url); };
  });
</script>

<div class="hid"><div id="qv-yt"></div><audio bind:this={el} onended={ended}></audio></div>
<style>
  .hid{position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none}
</style>
