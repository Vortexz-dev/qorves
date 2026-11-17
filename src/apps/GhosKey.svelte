<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { sfx, ambient } from '../lib/sfx';
  import { watchNets, writeLog, DECOYS, randGame, effectiveDiff, gameLabel, type Net, type GameId } from '../lib/ghoskey';
  import Jumpscare from './ghoskey/Jumpscare.svelte';
  import Play from './ghoskey/Play.svelte';

  const u = session.user!;
  let nets = $state<Net[]>([]), known = $state<Record<string, { scanned: boolean; preview?: GameId }>>({});
  let lines = $state<string[]>(['ghOS-Key 0.9 · kayıt dışı düğüm', 'yaz /help']), cmd = $state('');
  let phase = $state<'term' | 'load' | 'scare' | 'play'>('term');
  let loadN = $state(0), loadTxt = $state<string[]>([]);
  let target = $state<Net | null>(null), game = $state<GameId>('breach'), diff = $state(2);
  let box: HTMLDivElement | undefined = $state();
  const deco = DECOYS;
  const sig = (n: number) => '▁▂▃▄▅'.slice(0, n) + '▁▂▃▄▅'.slice(n).replace(/./g, '·');

  const HELP = [
    '/help                  bu liste',
    'scan <ad|id>           ağ kimliği ve sinyal',
    'info <id>              ayrıntı (önce scan)',
    'preview <id>           minioyun türü',
    'attack <id>            sızmayı başlat',
    'nets                   görünen ağlar',
    'clear                  ekranı temizle',
    'whoami                 düğüm kimliği',
  ];

  function out(...xs: string[]) { lines = [...lines, ...xs]; tick().then(() => box && (box.scrollTop = box.scrollHeight)); }
  function find(q: string) { const s = q.trim().toLowerCase(); return nets.find((n) => n.id.toLowerCase() === s || n.name.toLowerCase() === s); }

  async function run() {
    const raw = cmd.trim(); cmd = ''; if (!raw) return;
    out('> ' + raw); sfx.key();
    const [a, ...rest] = raw.split(/\s+/); const arg = rest.join(' ');
    if (a === '/help' || a === 'help') { out(...HELP); return; }
    if (a === 'clear') { lines = []; return; }
    if (a === 'whoami') { out(u.username + ' · uid kırıntısı ' + u.uid.slice(0, 8) + '…'); return; }
    if (a === 'nets' || a === 'ifconfig' || a === 'ls') {
      if (!nets.length) out('aktif hedef yok. (DM ağ ekler)');
      else out(...nets.map((n) => `${n.id.slice(0, 8)}  sig:${n.signal}  ${n.name}`));
      out(...deco.map((d) => `????      sig:${d.signal}  ${d.name}  [erişilemez]`));
      return;
    }
    if (a === 'scan') {
      const n = find(arg); if (!n) { out('ağ bulunamadı.'); return; }
      known[n.id] = { ...(known[n.id] ?? { scanned: true }), scanned: true };
      known = { ...known };
      out(`SCAN OK  id=${n.id}`, `ad="${n.name}"  sinyal=${n.signal}/5  zorluk≈${effectiveDiff(n.diff, n.signal)}`, n.note ? 'not: ' + n.note : 'not yok');
      return;
    }
    if (a === 'info') {
      const n = find(arg); if (!n || !known[n.id]?.scanned) { out('önce scan <ad> ile kimliği al.'); return; }
      out(`id=${n.id}`, `sinyal ${n.signal}/5 · taban zorluk ${n.diff}`, 'saldırı için: attack ' + n.id);
      return;
    }
    if (a === 'preview') {
      const n = find(arg); if (!n || !known[n.id]?.scanned) { out('önce scan ile kimliği al.'); return; }
      const g = (n.game || randGame()) as GameId;
      known[n.id] = { ...known[n.id], scanned: true, preview: g }; known = { ...known };
      out('önizleme · minioyun: ' + gameLabel(g) + (n.game ? ' (sabit)' : ' (bu seans, rastgele)'));
      return;
    }
    if (a === 'attack') {
      const n = find(arg); if (!n || !known[n.id]?.scanned) { out('saldırı için önce scan ile id al.'); return; }
      begin(n); return;
    }
    out('bilinmeyen komut. /help');
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
    return () => { stopAmb(); stop(); };
  });
</script>

<div class="gk" class:glitch={target && target.signal < 3 && phase !== 'term'}>
  <div class="nets">
    <div class="mono h">GÖRÜNÜR AĞLAR</div>
    {#each nets as n (n.id)}
      <button class="n" onclick={() => { cmd = 'scan ' + n.id; sfx.click(); }}>
        <b>{n.name}</b>
        <small class="mono">{sig(n.signal)} {n.signal}/5</small>
      </button>
    {:else}<div class="none mono">hedef yok</div>{/each}
    {#each deco as d}
      <div class="n dec"><b>{d.name}</b><small class="mono">{sig(d.signal)} kopuk</small></div>
    {/each}
  </div>
  <div class="term">
    <div class="out" bind:this={box}>{#each lines as l}<div>{l}</div>{/each}</div>
    <form onsubmit={(e) => { e.preventDefault(); run(); }}>
      <span class="mono">root@ghos-key:~#</span>
      <input class="inp" bind:value={cmd} autocomplete="off" spellcheck="false" />
    </form>
  </div>
</div>

{#if phase === 'load'}
  <div class="ld"><pre>{loadTxt.join('\n')}</pre><div class="bar"><i style:width="{loadN}%"></i></div><div class="mono">{Math.round(loadN)}%</div></div>
{/if}
{#if phase === 'scare'}<Jumpscare ondone={() => (phase = 'play')} />{/if}
{#if phase === 'play' && target}<Play {game} {diff} signal={target.signal} ondone={done} />{/if}

<style>
  .gk{position:absolute;inset:0;display:grid;grid-template-columns:280px 1fr;background:#020805;color:#9f6;font-family:var(--f-mono);padding-top:46px}
  .nets{border-right:1px solid #1a3;padding:16px 12px;overflow:auto;background:rgba(0,20,10,.4)}
  .h{letter-spacing:.22em;color:#39ff8a;font-size:10.5px;margin-bottom:10px}
  .n{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;background:none;border:1px solid #163;color:inherit;padding:8px;margin-bottom:6px;font:inherit}
  .n:hover{border-color:#39ff8a}.n b{color:#cfe}.dec{opacity:.45;pointer-events:none;filter:grayscale(.4)}
  .none{color:#365;padding:8px}.term{display:flex;flex-direction:column;min-width:0}
  .out{flex:1;overflow:auto;padding:14px;font-size:13px;line-height:1.55;white-space:pre-wrap}
  form{display:flex;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid #1a3}
  form .inp{flex:1;background:none;border:0;color:#9f6;font:inherit;outline:none}
  .ld{position:absolute;inset:0;z-index:7;background:#020805;color:#39ff8a;display:grid;place-content:center;justify-items:stretch;padding:40px;font-family:var(--f-mono)}
  .ld pre{min-height:10em;font-size:13px}.bar{height:8px;background:#123;margin:12px 0}.bar i{display:block;height:100%;background:#39ff8a;box-shadow:0 0 8px #39ff8a}
  .glitch{animation:g .12s steps(2) infinite}@keyframes g{50%{filter:hue-rotate(30deg) saturate(1.4);transform:translateX(1px)}}
</style>
