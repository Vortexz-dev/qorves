<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { sfx, ambient } from '../lib/sfx';
  import { closeCore } from '../desktop/wm.svelte';
  import { watchNets, writeLog, DECOY_POOL, randGame, effectiveDiff, gameLabel, type Net, type GameId } from '../lib/ghoskey';
  import HackStage from './hack/HackStage.svelte';

  const u = session.user!;
  let nets = $state<Net[]>([]), known = $state<Record<string, { scanned: boolean; preview?: GameId }>>({});
  let lines = $state<string[]>(['ghOS-Key 0.9 · kayıt dışı düğüm', 'yaz help']), cmd = $state('');
  let phase = $state<'term' | 'load' | 'scare' | 'play'>('term');
  let loadN = $state(0), loadTxt = $state<string[]>([]);
  let target = $state<Net | null>(null), game = $state<GameId>('breach'), diff = $state(2);
  let box: HTMLDivElement | undefined = $state();
  type Deco = { id: string; name: string; shown: string; signal: number; glitch: boolean; fade: boolean };
  const scramble = (s: string) => s.split('').map((c, i) => (i % 3 === 1 ? '█▓▒░/?#'[Math.floor(Math.random()*7)] : c)).join('');
  const mkDeco = (name?: string): Deco => {
    const n = name || DECOY_POOL[Math.floor(Math.random() * DECOY_POOL.length)]!;
    return { id: Math.random().toString(36).slice(2, 8), name: n, shown: n, signal: 1 + Math.floor(Math.random() * 3), glitch: false, fade: false };
  };
  let deco = $state<Deco[]>(DECOY_POOL.slice(0, 5).map((n) => mkDeco(n)));
  const sig = (n: number) => '▁▂▃▄▅'.slice(0, n) + '▁▂▃▄▅'.slice(n).replace(/./g, '·');

  const HELP = [
    'help                   bu liste',
    'scan <ad|id>           ağ kimliği ve sinyal',
    'info <id>              ayrıntı (önce scan)',
    'preview <id>           minioyun türü',
    'attack <id>            sızmayı başlat',
    'nets                   görünen ağlar',
    'clear                  ekranı temizle',
    'whoami                 düğüm kimliği',
    'pwd                    çalışma yolu',
    'date                   düğüm saati',
    'uname                  çekirdek bilgisi',
    'ping <ad>              gecikme ölç',
    'echo <metin>           geri yaz',
    'history                son komutlar',
    'uptime                 oturum süresi',
    'motd                   günlük sızıntı',
    'sudo <komut>           (yok)',
    'trace                  iz seviyesi',
    'cat <dosya>            dosya oku',
    'matrix                 ...',
    'exit                   ghOS-Key kapat',
    '[Tab] tamamla · [↑/↓] geçmiş · [Ctrl+L] temizle',
  ];
  let hist = $state<string[]>([]), busy = $state(false), flicker = $state(false);
  const t0 = Date.now();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function out(...xs: string[]) {
    for (const x of xs) {
      let s = '';
      lines = [...lines, ''];
      const i = lines.length - 1;
      const step = x.length > 80 ? 4 : 2;
      for (let k = 0; k < x.length; k += step) {
        s = x.slice(0, k + step);
        lines[i] = s; lines = lines;
        if (k % 8 === 0) stick();
        await sleep(7);
      }
      lines[i] = x; lines = lines;
      stick();
    }
  }
  // en yeni çıktı her zaman görünür: kullanıcı yukarı kaydırmadıysa alta yapış
  let follow = true;
  function stick() { tick().then(() => { if (box && follow) box.scrollTop = box.scrollHeight; }); }
  function onScroll() { if (box) follow = box.scrollHeight - box.scrollTop - box.clientHeight < 40; }
  // Tab ile komut tamamlama (birden çok eşleşmede her Tab sıradakine geçer), ↑/↓ geçmiş
  const CMDS = ['help', 'scan', 'info', 'preview', 'attack', 'nets', 'clear', 'whoami', 'pwd', 'date', 'uname', 'ping', 'echo', 'history', 'uptime', 'motd', 'sudo', 'trace', 'ls', 'ifconfig', 'cat', 'matrix', 'exit'];
  let tabSeed: string | null = null, tabI = 0, hi = -1;
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const parts = cmd.split(' ');
      if (parts.length > 1) { // argüman: ağ adı/id tamamla
        const pre = (tabSeed ?? parts.slice(1).join(' ')).toLowerCase(); if (tabSeed === null) { tabSeed = pre; tabI = 0; }
        const m = nets.map((n) => n.id).filter((x) => x.toLowerCase().startsWith(pre));
        if (m.length) { cmd = parts[0] + ' ' + m[tabI++ % m.length]; sfx.key(); } else sfx.error();
        return;
      }
      if (tabSeed === null) { tabSeed = cmd.trim().toLowerCase(); tabI = 0; }
      const m = CMDS.filter((c) => c.startsWith(tabSeed!));
      if (!m.length) { sfx.error(); return; }
      cmd = m[tabI++ % m.length] + (m.length === 1 && ['scan', 'info', 'preview', 'attack', 'ping', 'echo', 'cat', 'trace', 'sudo'].includes(m[0]) ? ' ' : '');
      if (m.length > 1 && tabI === 1) { out(m.join('   ')); }
      sfx.key(); return;
    }
    tabSeed = null;
    if (e.key === 'ArrowUp') { e.preventDefault(); if (!hist.length) return; hi = hi < 0 ? hist.length - 1 : Math.max(0, hi - 1); cmd = hist[hi]; return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (hi < 0) return; hi++; if (hi >= hist.length) { hi = -1; cmd = ''; } else cmd = hist[hi]; return; }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); lines = []; return; }
    if (e.key.length === 1 || e.key === 'Backspace') sfx.key();
  }
  function find(q: string) { const s = q.trim().toLowerCase(); return nets.find((n) => n.id.toLowerCase() === s || n.name.toLowerCase() === s); }

  async function run() {
    const raw = cmd.trim(); cmd = ''; if (!raw || busy) return;
    hist = [...hist.slice(-30), raw]; hi = -1; follow = true;
    busy = true; await out('> ' + raw);
    const [a0, ...rest] = raw.split(/\s+/); const a = a0.replace(/^\//, ''); const arg = rest.join(' ');
    if (a === 'help') { await out(...HELP); busy = false; return; }
    if (a === 'clear') { lines = []; busy = false; return; }
    if (a === 'whoami') { await out(u.username + ' · uid kırıntısı ' + u.uid.slice(0, 8) + '…'); busy = false; return; }
    if (a === 'pwd') { await out('/root/.ghos/key'); busy = false; return; }
    if (a === 'date') { await out(new Date().toISOString().replace('T', ' ').slice(0, 19) + '  ·  SS düğüm saati kaymış olabilir'); busy = false; return; }
    if (a === 'uname') { await out('ghOS-Key 0.9-illegal  tty0  x86_64  no-selinux'); busy = false; return; }
    if (a === 'echo') { await out(arg || ''); busy = false; return; }
    if (a === 'history') { await out(...(hist.length ? hist.map((h, i) => `${String(i + 1).padStart(3, ' ')}  ${h}`) : ['(boş)'])); busy = false; return; }
    if (a === 'uptime') { await out('up ' + Math.max(1, Math.round((Date.now() - t0) / 1000)) + 's  ·  1 user  ·  load 0.9 ' + (Math.random()*2).toFixed(2)); busy = false; return; }
    if (a === 'motd') { await out('bugün: iz sürme düşük.', 'hatırlatma: saldırı loglanır. DM görür.', 'kedi: sudo yok.'); busy = false; return; }
    if (a === 'sudo') { await out('sudo: bu düğümde yetki yok. zaten root@ghos-key değilsin, öyle görünüyorsun.'); busy = false; return; }
    if (a === 'trace') { const t = Math.min(99, 7 + hist.length * 3 + Math.floor(Math.random() * 9)); await out(`iz seviyesi: ${t}%  ${'█'.repeat(Math.round(t / 10))}${'░'.repeat(10 - Math.round(t / 10))}`, t > 60 ? '!! birileri seni arıyor olabilir. sessiz kal.' : 'görünürlük düşük.'); busy = false; return; }
    if (a === 'cat') {
      const F: Record<string, string[]> = {
        'readme': ['ghOS-Key // yalnız kullanıcı için.', 'ağı tara, kimliği al, saldır. yakalanırsan bu aracı hiç duymadık.'],
        'notes.txt': ['- düşük sinyal = kısa süre + parazit', '- önce preview, sonra attack', '- kuru kafa gülerse panik yapma. ? tuşu yardımdır.'],
        '/etc/shadow': ['erişim reddedildi. güzel deneme.'],
      };
      const f = F[arg.trim().toLowerCase()];
      await out(...(f ?? [arg ? `cat: ${arg}: böyle bir dosya yok` : 'kullanım: cat <dosya>   (dosyalar: readme, notes.txt)'])); busy = false; return;
    }
    if (a === 'ls') { await out('readme   notes.txt   .ghos/   payload.ice'); busy = false; return; }
    if (a === 'matrix') {
      const G = 'ｱｲｳｴｵｶｷｸｹｺ01ﾊﾋﾌﾍﾎ<>/\\#$%';
      for (let r = 0; r < 10; r++) { lines = [...lines, Array.from({ length: 64 }, () => (Math.random() < 0.7 ? G[Math.floor(Math.random() * G.length)] : ' ')).join('')]; stick(); await sleep(45); }
      busy = false; return;
    }
    if (a === 'exit') { busy = false; closeCore(); return; }
    if (a === 'ping') {
      const n = find(arg); await out('PING ' + (arg || '0.0.0.0'));
      if (!n) { await out('zaman aşımı.'); busy = false; return; }
      const ms = 40 + Math.round((5 - n.signal) * 35 + Math.random() * 20);
      await out(`64 byte  zaman=${ms}ms  ttl=${40 + n.signal * 8}  (sinyal ${n.signal}/5)`); busy = false; return;
    }
    if (a === 'nets' || a === 'ifconfig') {
      if (!nets.length) await out('aktif hedef yok. (DM ağ ekler)');
      else await out(...nets.map((n) => `${n.id.slice(0, 8)}  sig:${n.signal}  ${n.name}`));
      await out(...deco.map((d) => `????      sig:${d.signal}  ${d.name}  [erişilemez]`));
      busy = false; return;
    }
    if (a === 'scan') {
      const n = find(arg); if (!n) { await out('ağ bulunamadı.'); busy = false; return; }
      known[n.id] = { ...(known[n.id] ?? { scanned: true }), scanned: true };
      known = { ...known };
      await out(`SCAN OK  id=${n.id}`, `ad="${n.name}"  sinyal=${n.signal}/5  zorluk≈${effectiveDiff(n.diff, n.signal)}`, n.note ? 'not: ' + n.note : 'not yok');
      busy = false; return;
    }
    if (a === 'info') {
      const n = find(arg); if (!n || !known[n.id]?.scanned) { await out('önce scan <ad> ile kimliği al.'); busy = false; return; }
      await out(`id=${n.id}`, `sinyal ${n.signal}/5 · taban zorluk ${n.diff}`, 'saldırı için: attack ' + n.id);
      busy = false; return;
    }
    if (a === 'preview') {
      const n = find(arg); if (!n || !known[n.id]?.scanned) { await out('önce scan ile kimliği al.'); busy = false; return; }
      const g = (n.game || randGame()) as GameId;
      known[n.id] = { ...known[n.id], scanned: true, preview: g }; known = { ...known };
      await out('önizleme · minioyun: ' + gameLabel(g) + (n.game ? ' (sabit)' : ' (bu seans, rastgele)'));
      busy = false; return;
    }
    if (a === 'attack') {
      const n = find(arg); if (!n || !known[n.id]?.scanned) { await out('saldırı için önce scan ile id al.'); busy = false; return; }
      busy = false; begin(n); return;
    }
    await out('bilinmeyen komut. help');
    busy = false;
  }

  function begin(n: Net) {
    target = n;
    game = (known[n.id]?.preview || n.game || randGame()) as GameId;
    diff = effectiveDiff(n.diff, n.signal);
    phase = 'load'; loadN = 0; loadTxt = []; sfx.glitch();
    const dump = [
      'tcp handshake ' + n.id.slice(0, 6) + '…',
      'spoofing MAC / bpf filter',
      'payload[ice] packing…',
      'nonce ' + Math.random().toString(16).slice(2, 10),
      'inject 0x7f · wait tty',
      n.signal < 3 ? '!! düşük sinyal · paket kaybı' : 'link stable',
      'ascii loader…',
    ];
    let i = 0;
    const iv = setInterval(() => {
      loadTxt = [...loadTxt, dump[i] ?? '']; loadN = Math.min(100, (i + 1) * (100 / dump.length));
      i++; if (i >= dump.length) { clearInterval(iv); setTimeout(() => (phase = 'scare'), 400); }
    }, 220);
  }
  async function done(ok: boolean) {
    phase = 'term';
    out(ok ? '****************  İHLAL BAŞARILI  ****************' : 'xxxxxxxx  BAĞLANTI KESİLDİ · BAŞARISIZ  xxxxxxxx',
      target ? (ok ? target.name + ' açıldı. DM sonucu görür; bilgi ondan gelir.' : 'iz bırakmış olabilirsin.') : '');
    if (target) await writeLog({ uid: u.uid, net: target.id, name: target.name, game, ok, diff, kind: 'out' }).catch(() => {});
    (ok ? sfx.granted : sfx.lose)();
    target = null;
  }

  onMount(() => {
    const stopAmb = ambient('ghoskey');
    const stop = watchNets(u.role === 'dm' ? null : u.uid, (xs) => (nets = xs.filter((n) => !n.decoy)));
    const iv = setInterval(() => { flicker = true; setTimeout(() => (flicker = false), 140); }, 4800 + Math.random() * 2600);
    const tick = setInterval(() => {
      if (!deco.length) { deco = [mkDeco()]; return; }
      const r = Math.random();
      if (r < 0.45) {
        const i = Math.floor(Math.random() * deco.length);
        const d = deco[i]!;
        d.glitch = true; d.shown = scramble(d.name); d.signal = Math.max(1, Math.min(3, d.signal + (Math.random() < 0.5 ? -1 : 1)));
        deco = deco.slice();
        setTimeout(() => { d.glitch = false; d.shown = d.name; deco = deco.slice(); }, 280 + Math.random() * 400);
      } else if (r < 0.75 && deco.length > 3) {
        const i = Math.floor(Math.random() * deco.length);
        deco[i]!.fade = true; deco = deco.slice();
        const gone = deco[i]!;
        setTimeout(() => { deco = deco.filter((x) => x.id !== gone.id); if (deco.length < 5) deco = [...deco, mkDeco()]; }, 400);
      } else if (deco.length < 7) {
        deco = [...deco, mkDeco()];
      }
    }, 1600);
    return () => { stopAmb(); stop(); clearInterval(iv); clearInterval(tick); };
  });
</script>

<div class="gk" class:glitch={(target && target.signal < 3 && phase !== 'term') || flicker}>
  <div class="scan"></div>
  <div class="nets">
    <div class="mono h">GÖRÜNÜR AĞLAR</div>
    {#each nets as n (n.id)}
      <button class="n" onclick={() => { cmd = 'scan ' + n.id; sfx.click(); }}>
        <b class:fx={flicker}>{n.name}</b>
        <small class="mono">{sig(n.signal)} {n.signal}/5</small>
      </button>
    {:else}<div class="none mono">hedef yok</div>{/each}
    {#each deco as d (d.id)}
      <div class="n dec" class:gx={d.glitch} class:fade={d.fade}><b>{d.shown}</b><small class="mono">{sig(d.signal)} kopuk</small></div>
    {/each}
  </div>
  <div class="term">
    <div class="out" bind:this={box} onscroll={onScroll}>{#each lines as l}<div>{l}</div>{/each}</div>
    <form onsubmit={(e) => { e.preventDefault(); run(); }}>
      <span class="mono">root@ghos-key:~#</span>
      <input class="inp" bind:value={cmd} autocomplete="off" spellcheck="false" onkeydown={onKey} />
    </form>
  </div>
</div>

{#if phase === 'load'}
  <div class="ld"><pre>{loadTxt.join('\n')}</pre><div class="bar"><i style:width="{loadN}%"></i></div><div class="mono">{Math.round(loadN)}%</div></div>
{/if}
{#if (phase === 'scare' || phase === 'play') && target}<HackStage {game} {diff} signal={target.signal} mode="out" target={target.name} ondone={done} />{/if}

<style>
  .gk{position:absolute;inset:0;display:grid;grid-template-columns:280px 1fr;grid-template-rows:minmax(0,1fr);background:#020805;color:#9f6;font-family:var(--f-mono);padding-top:46px}
  .scan{position:absolute;inset:0;pointer-events:none;z-index:1;background:repeating-linear-gradient(0deg,rgba(0,255,80,.035) 0 1px,transparent 1px 3px);mix-blend-mode:screen;opacity:.5}
  .nets{border-right:1px solid #1a3;padding:16px 12px;overflow:auto;background:rgba(0,20,10,.4);position:relative;z-index:2}
  .h{letter-spacing:.22em;color:#39ff8a;font-size:10.5px;margin-bottom:10px;text-shadow:0 0 8px #39ff8a}
  .n{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;background:none;border:1px solid #163;color:inherit;padding:8px;margin-bottom:6px;font:inherit}
  .n:hover{border-color:#39ff8a;box-shadow:0 0 10px rgba(57,255,138,.2)}.n b{color:#cfe}.n b.fx{animation:tx .12s steps(2)}
  @keyframes tx{50%{opacity:.4;transform:translateX(2px);color:#f22}}
  .dec{opacity:.45;pointer-events:none;filter:grayscale(.4);transition:opacity .4s,transform .4s}.dec.gx b{animation:tx .12s steps(2);color:#f66;letter-spacing:.08em}.dec.fade{opacity:0;transform:translateX(-8px)}
  .none{color:#365;padding:8px}.term{display:flex;flex-direction:column;min-width:0;min-height:0;position:relative;z-index:2}
  .out{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px;font-size:13px;line-height:1.55;white-space:pre-wrap;text-shadow:0 0 4px rgba(57,255,138,.25)}
  form{display:flex;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid #1a3;background:rgba(0,20,8,.5)}
  form .inp{flex:1;background:none;border:0;color:#9f6;font:inherit;outline:none;caret-color:#39ff8a}
  .ld{position:absolute;inset:0;z-index:7;background:#020805;color:#39ff8a;display:grid;place-content:center;justify-items:stretch;padding:40px;font-family:var(--f-mono)}
  .ld pre{min-height:10em;font-size:13px}.bar{height:8px;background:#123;margin:12px 0}.bar i{display:block;height:100%;background:#39ff8a;box-shadow:0 0 8px #39ff8a}
  .glitch{animation:g .12s steps(2) infinite}@keyframes g{50%{filter:hue-rotate(50deg) saturate(1.5) contrast(1.2);transform:translateX(1px)}}
</style>
