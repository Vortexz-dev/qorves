<script lang="ts">
  import { onMount } from 'svelte';
  import { dm, pname } from './store.svelte';
  import { sfx } from '../../lib/sfx';
  import { watchNets, watchLogs, saveNet, dropNet, blankNet, sendAtk, randGame, effectiveDiff, GAMES, type Net, type HackLog, type GameId } from '../../lib/ghoskey';
  import { session } from '../../lib/session.svelte';
  import HackStage from '../hack/HackStage.svelte';
  let nets = $state<Net[]>([]), logs = $state<HackLog[]>([]), ed = $state<Net | null>(null);
  let atkUid = $state(''), atkDiff = $state(3), atkGame = $state<GameId | ''>(''), atkSig = $state(3), msg = $state('');
  let pv = $state<{ game: GameId; diff: number; sig: number } | null>(null), pvScare = $state(true);
  const me = session.user!.uid;
  function preview() { pv = { game: (atkGame || randGame()) as GameId, diff: effectiveDiff(atkDiff, atkSig), sig: atkSig }; }
  onMount(() => { const a = watchNets(null, (xs) => (nets = xs)); const b = watchLogs(null, (xs) => (logs = xs)); return () => { a(); b(); }; });
  async function save() { if (!ed || !ed.name.trim()) return; await saveNet({ ...ed, name: ed.name.trim(), at: Date.now() }); ed = null; sfx.granted(); msg = 'Ağ kaydedildi.'; }
  async function atk() { if (!atkUid) return; await sendAtk({ uid: atkUid, diff: atkDiff, game: atkGame, signal: atkSig } as Parameters<typeof sendAtk>[0]); sfx.alarm(); msg = atkUid === me ? 'Saldırı kendine gönderildi: birazdan ekranında açılır.' : 'Saldırı gönderildi.'; }
</script>
<div class="hk">
  <div class="fm">
    <h4 class="mono">SALDIRI GÖNDER</h4>
    <select class="inp" bind:value={atkUid}><option value="">Hedef seç</option><option value={me}>Kendim (test · DM)</option>{#each dm.users.filter((u) => u.uid !== me) as u}<option value={u.uid}>{pname(u.uid)}</option>{/each}</select>
    <div class="g3">
      <label class="field"><span>Zorluk</span><select class="inp" bind:value={atkDiff}>{#each [1, 2, 3, 4, 5] as d}<option value={d}>{d} · {['Kolay', 'Normal', 'Zor', 'Çok zor', 'Acımasız'][d - 1]}</option>{/each}</select></label>
      <label class="field"><span>Sinyal</span><select class="inp" bind:value={atkSig}>{#each [5, 4, 3, 2, 1] as d}<option value={d}>{d}/5{d <= 2 ? ' · parazit' : ''}</option>{/each}</select></label>
      <label class="field"><span>Minioyun</span><select class="inp" bind:value={atkGame}><option value="">Rastgele</option>{#each GAMES as g}<option value={g.id}>{g.label}</option>{/each}</select></label>
    </div>
    <div class="row"><button class="btn red" onclick={atk} disabled={!atkUid}>Saldırıyı yolla</button><button class="btn ghost" onclick={preview} title="Firestore'a yazmadan yalnız bu ekranda dener">Önizle (yalnız bende)</button>
      <label class="ck"><input type="checkbox" bind:checked={pvScare} />kuru kafa</label></div>
    <p class="nt">Kaybeden oyuncunun QOS'u yeniden başlar; kazanan kontrolü geri alır. Düşük sinyal zorluğu bir kademe artırır ve ekranda parazit çıkarır. Sonuç aşağıdaki kayıtta görünür.</p>
    <h4 class="mono">AĞLAR</h4>
    {#if ed}
      <input class="inp" placeholder="Ad (ör. ARASAKA çevre ağı)" bind:value={ed.name} />
      <label class="field"><span>Sinyal 1–5 (düşük = zor + glitch)</span><input class="inp" type="number" min="1" max="5" bind:value={ed.signal} /></label>
      <label class="field"><span>Zorluk 1–5</span><input class="inp" type="number" min="1" max="5" bind:value={ed.diff} /></label>
      <select class="inp" bind:value={ed.game}><option value="">Rastgele minioyun</option>{#each GAMES as g}<option value={g.id}>{g.label}</option>{/each}</select>
      <textarea class="inp" rows="2" placeholder="Not (scan’de görünür)" bind:value={ed.note}></textarea>
      <h4 class="mono">GÖRECEK OYUNCULAR</h4>
      {#each dm.users as u (u.uid)}<label class="ck"><input type="checkbox" checked={ed.players.includes(u.uid)} onchange={(e) => ed && (ed.players = (e.currentTarget as HTMLInputElement).checked ? [...ed.players, u.uid] : ed.players.filter((x) => x !== u.uid))} />{pname(u.uid)}</label>{/each}
      <div class="row"><button class="btn" onclick={save}>Kaydet</button><button class="btn ghost" onclick={() => (ed = null)}>Vazgeç</button></div>
    {:else}<button class="btn" onclick={() => (ed = { ...blankNet(), players: dm.pid ? [dm.pid] : [] })}>+ Ağ ekle</button>{/if}
    {#if msg}<p class="msg mono">{msg}</p>{/if}
  </div>
  <div class="ls">
    {#each nets as n (n.id)}
      <div class="it"><b>{n.name}</b> <em>sig {n.signal} · z{n.diff}</em>
        <button class="btn ghost small" onclick={() => (ed = { ...n, players: [...n.players] })}>Düzenle</button>
        <button class="btn red small" onclick={() => dropNet(n.id)}>Kaldır</button></div>
    {:else}<p class="none">Ağ yok.</p>{/each}
    <h4 class="mono">KAYIT</h4>
    {#each logs.slice(0, 40) as l (l.id)}
      <div class="it {l.ok ? 'ok' : 'no'}"><b>{pname(l.uid)}</b> {l.kind === 'def' ? 'savunma' : 'sızma'} · {l.name} · {l.game} · {l.ok ? 'başarılı' : 'başarısız'}
        <small class="mono">{new Date(l.at).toLocaleString('tr-TR')}</small></div>
    {:else}<p class="none">Kayıt yok.</p>{/each}
  </div>
</div>
{#if pv}<HackStage game={pv.game} diff={pv.diff} signal={pv.sig} mode="in" scare={pvScare} ondone={() => (pv = null)} />{/if}
<style>
  .hk{display:grid;grid-template-columns:400px 1fr;gap:16px;height:100%;min-height:0;padding:12px 16px}
  .fm,.ls{overflow:auto;display:flex;flex-direction:column;gap:8px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:8px 0 4px}
  .it{border:1px solid var(--line);padding:6px 8px;margin-bottom:6px}.it.ok{border-left:3px solid #39ff8a}.it.no{border-left:3px solid var(--rd)}
  .it em,.it small{color:var(--mut);font-style:normal}.ck{display:flex;gap:6px;align-items:center}.g3{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:8px}.row{display:flex;gap:8px}
  .nt{font-size:12.5px;color:var(--mut)}.msg{color:#39ff8a}.none{color:var(--mut)}
</style>
