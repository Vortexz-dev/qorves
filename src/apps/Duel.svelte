<script lang="ts">
  // Zar Düellosu: bota karşı iki zar. Yüksek toplam kazanır; eşitlikte bahis iade; ikiniz de 7 atarsanız kasa kazanır. Kazanç 2x.
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { watchWallet, watchGames, playDuel, DUEL, type Wallet, type Duel } from '../lib/live';
  import { sfx } from '../lib/sfx';
  const u = session.user!, isDM = u.role === 'dm';
  let w = $state<Wallet | null>(null), games = $state<Duel[]>([]), bet = $state(50), rolling = $state(false), phase = $state<'idle' | 'roll' | 'p' | 'done'>('idle');
  let pd = $state([1, 1]), bd = $state([1, 1]), last = $state<Duel | null>(null), msg = $state(''), streak = $state(0);
  const bal = $derived(w?.bal?.BK ?? 0);
  const ok = $derived(!isDM && !rolling && bet >= DUEL.min && bet <= DUEL.max && bet <= bal);
  const fmt = (n: number) => n.toLocaleString('tr-TR');
  onMount(() => { if (isDM) return; const a = watchWallet(u.uid, (x) => (w = x)); const b = watchGames(u.uid, (g) => (games = g), 12); return () => { a(); b(); }; });
  const rnd = () => 1 + Math.floor(Math.random() * 6);
  async function roll() {
    if (!ok) return; rolling = true; msg = ''; last = null; phase = 'roll'; sfx.rattle();
    const tumble = setInterval(() => { if (phase === 'roll') { pd = [rnd(), rnd()]; } if (phase !== 'done') bd = [rnd(), rnd()]; }, 70);
    let g: Duel | null = null;
    try { [g] = await Promise.all([playDuel({ uid: u.uid, name: u.character?.name || u.username }, bet), new Promise((r) => setTimeout(r, 850))]); }
    catch (e) { clearInterval(tumble); phase = 'idle'; rolling = false; sfx.error(); msg = /yetersiz/i.test(String(e)) ? 'Bakiye yetersiz.' : 'Atış reddedildi. Bakiyeni kontrol edip tekrar dene.'; return; }
    phase = 'p'; pd = g!.p; sfx.thud();
    await new Promise((r) => setTimeout(r, 700));
    clearInterval(tumble); bd = g!.b; phase = 'done'; sfx.thud(); last = g;
    setTimeout(() => { if (g!.res === 'win') { sfx.coin(); sfx.granted(); streak = streak > 0 ? streak + 1 : 1; } else if (g!.res === 'lose') { sfx.lose(); streak = streak < 0 ? streak - 1 : -1; } else { sfx.ping(); } }, 120);
    rolling = false;
  }
  const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const sum = (a: number[]) => a[0] + a[1];
  const RES: Record<string, string> = { win: 'KAZANDIN', lose: 'KAYBETTİN', push: 'BERABERE' };
</script>

<div class="du">
  {#if isDM}
    <div class="dmn"><b>DM oynayamaz.</b> Oyuncuların bütün düelloları DM Paneli → Zar Düellosu sekmesinde görünür.</div>
  {:else}
  <div class="top">
    <div class="bal"><span class="mono">BAKİYE</span><b>{fmt(bal)} <i>BK</i></b></div>
    <div class="rules"><div class="mono h">KURALLAR</div>
      <p>İkiniz de <b>2 zar</b> atarsınız. <b>Yüksek toplam kazanır.</b></p>
      <p>Kazanırsan bahsin <b>2 katı</b> döner. Kaybedersen bahis gider.</p>
      <p>Eşitlik: bahis iade. <b>İkiniz de 7</b> atarsanız kasa kazanır.</p>
    </div>
  </div>
  <div class="table" class:win={last?.res === 'win'} class:lose={last?.res === 'lose'}>
    <div class="side"><div class="who mono">SEN</div>
      <div class="dice">{#each pd as v, i (i)}<div class="die" class:spin={phase === 'roll'} style:--r="{i ? 9 : -7}deg">{#each Array(9) as _, k (k)}<span class:on={PIPS[v].includes(k)}></span>{/each}</div>{/each}</div>
      <div class="sum mono">{phase === 'roll' ? '…' : sum(pd)}</div></div>
    <div class="vs"><span class="mono">VS</span>
      {#if last}<div class="res {last.res}"><b>{RES[last.res]}</b><small class="mono">{last.res === 'win' ? '+' + fmt(last.bet) + ' BK' : last.res === 'lose' ? '−' + fmt(last.bet) + ' BK' : 'bahis iade'}{#if last.res === 'lose' && sum(last.p) === 7 && sum(last.b) === 7} · çift 7 kasanın{/if}</small></div>{/if}
    </div>
    <div class="side bot"><div class="who mono">KASA BOTU</div>
      <div class="dice">{#each bd as v, i (i)}<div class="die" class:spin={phase === 'roll' || phase === 'p'} style:--r="{i ? -11 : 6}deg">{#each Array(9) as _, k (k)}<span class:on={PIPS[v].includes(k)}></span>{/each}</div>{/each}</div>
      <div class="sum mono">{phase === 'done' ? sum(bd) : '…'}</div></div>
  </div>
  <div class="bet">
    <div class="mono h">BAHİS <small>en az {DUEL.min} · en çok {DUEL.max} BK</small></div>
    <div class="row">
      <input type="range" min={DUEL.min} max={DUEL.max} step="5" bind:value={bet} disabled={rolling} />
      <input class="num" type="number" min={DUEL.min} max={DUEL.max} bind:value={bet} disabled={rolling} />
      {#each [10, 50, 100, 250, 500] as c (c)}<button class="chip" class:on={bet === c} disabled={rolling} onclick={() => { bet = c; sfx.click(); }}>{c}</button>{/each}
    </div>
    <button class="go" disabled={!ok} onclick={roll}>{rolling ? 'ZARLAR YUVARLANIYOR…' : `ZAR AT · ${fmt(bet || 0)} BK`}</button>
    {#if bet > bal && !rolling}<div class="warn">Bakiye bu bahis için yetmiyor.</div>{/if}
    {#if msg}<div class="warn">{msg}</div>{/if}
  </div>
  <div class="hist">
    <div class="mono h">SON OYUNLAR {#if streak > 1}<em class="g">{streak} galibiyet serisi</em>{:else if streak < -1}<em class="r">{-streak} kayıp üst üste</em>{/if}</div>
    {#each games.slice(0, 8) as g (g.id)}<div class="hr {g.res}"><span class="mono">{g.p.join('+')}={sum(g.p)} · {g.b.join('+')}={sum(g.b)}</span><b>{g.res === 'win' ? '+' : g.res === 'lose' ? '−' : '±'}{fmt(Math.abs(g.delta) || g.bet)}</b></div>{:else}<div class="none">Henüz oyun yok.</div>{/each}
  </div>
  {/if}
</div>

<style>
  .du{height:100%;overflow:auto;padding:14px 16px;display:grid;grid-template-columns:1fr 230px;grid-template-rows:auto auto auto;gap:12px;background:radial-gradient(ellipse at 50% 30%,rgba(0,240,255,.06),transparent 60%)}
  .dmn{grid-column:1/-1;padding:20px;color:var(--tx);font-size:15px;line-height:1.5}.dmn b{color:var(--rd)}
  .top{grid-column:1/-1;display:flex;gap:14px;align-items:stretch}
  .bal{border:1px solid rgba(252,238,10,.35);background:rgba(252,238,10,.05);padding:10px 16px;display:flex;flex-direction:column;justify-content:center;min-width:170px}
  .bal span{font-size:10px;letter-spacing:.22em;color:var(--mut)}.bal b{font-size:26px;color:#fff;font-weight:600}.bal i{font-style:normal;font-size:13px;color:var(--ye)}
  .rules{flex:1;border:1px solid rgba(0,240,255,.2);padding:8px 14px;font-size:13.5px;line-height:1.45}.rules p{margin:2px 0}.rules b{color:var(--cy);font-weight:500}
  .h{font-size:10.5px;letter-spacing:.2em;color:var(--mut);margin-bottom:6px}.h small{letter-spacing:.06em;margin-left:8px;color:#6b7488}
  .table{grid-column:1;display:grid;grid-template-columns:1fr 140px 1fr;align-items:center;border:1px solid rgba(0,240,255,.2);padding:18px 10px;min-height:190px;position:relative;
    background:linear-gradient(180deg,rgba(0,40,30,.25),rgba(0,0,0,.2));clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px));transition:box-shadow .3s}
  .table.win{box-shadow:inset 0 0 40px rgba(57,255,138,.18)}.table.lose{box-shadow:inset 0 0 40px rgba(255,42,85,.18)}
  .side{display:flex;flex-direction:column;align-items:center;gap:10px}.who{font-size:11px;letter-spacing:.25em;color:var(--cy)}.bot .who{color:var(--rd)}
  .dice{display:flex;gap:14px}
  .die{width:62px;height:62px;border-radius:10px;background:linear-gradient(145deg,#f4f6fb,#c9cfdc);box-shadow:0 6px 0 #8a92a6,0 10px 18px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.6);
    display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:9px;gap:2px;transform:rotate(var(--r));transition:transform .25s}
  .bot .die{background:linear-gradient(145deg,#2a0d14,#14060a);box-shadow:0 6px 0 #4a0f1c,0 10px 18px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,42,85,.5)}
  .die span{border-radius:50%;margin:2px}.die span.on{background:#141824;box-shadow:inset 0 1px 2px rgba(0,0,0,.6)}.bot .die span.on{background:#ff2a55;box-shadow:0 0 6px #ff2a55}
  .die.spin{animation:sp .14s linear infinite}@keyframes sp{0%{transform:rotate(-14deg) translateY(-3px)}50%{transform:rotate(12deg) translateY(2px)}100%{transform:rotate(-14deg) translateY(-3px)}}
  .sum{font-size:22px;color:#fff;letter-spacing:.1em}
  .vs{display:flex;flex-direction:column;align-items:center;gap:10px}.vs>span{font-size:13px;color:var(--mut);letter-spacing:.3em}
  .res{text-align:center;animation:pop .35s cubic-bezier(.2,1.6,.4,1) both}@keyframes pop{from{transform:scale(.4);opacity:0}}
  .res b{display:block;font-family:var(--f-disp);font-size:19px;letter-spacing:.18em}.res small{font-size:12px;color:#fff}
  .res.win b{color:#39ff8a;text-shadow:0 0 14px rgba(57,255,138,.6)}.res.lose b{color:#ff2a55;text-shadow:0 0 14px rgba(255,42,85,.6)}.res.push b{color:var(--ye)}
  .bet{grid-column:1;border:1px solid rgba(255,255,255,.08);padding:10px 14px}
  .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.row input[type=range]{flex:1;min-width:140px;accent-color:#00f0ff}
  .num{width:80px;background:#11151f;border:1px solid var(--line);color:#fff;padding:5px 6px;font:inherit}
  .chip{background:#141a26;border:1px solid rgba(252,238,10,.3);color:var(--ye);padding:5px 10px;cursor:pointer;font:inherit;font-size:13px;border-radius:14px}.chip.on{background:var(--ye);color:#000}
  .go{margin-top:10px;width:100%;padding:12px;background:linear-gradient(90deg,rgba(0,240,255,.2),rgba(255,42,85,.2));border:1px solid var(--cy);color:#fff;font-family:var(--f-disp);letter-spacing:.25em;font-size:14px;cursor:pointer}
  .go:hover:not(:disabled){box-shadow:0 0 18px rgba(0,240,255,.35)}.go:disabled{opacity:.45;cursor:default}
  .warn{color:#ff6b81;font-size:13px;margin-top:6px}
  .hist{grid-column:2;grid-row:2/4;border-left:1px solid rgba(255,255,255,.07);padding-left:12px;min-height:0;overflow:auto}
  .hist em{font-style:normal;margin-left:6px;letter-spacing:.06em}.g{color:#39ff8a}.r{color:#ff6b81}
  .hr{display:flex;justify-content:space-between;font-size:12.5px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)}.hr .mono{color:var(--mut);font-size:11px}
  .hr.win b{color:#39ff8a}.hr.lose b{color:#ff6b81}.hr.push b{color:var(--ye)}.none{color:var(--mut);font-size:13px}
</style>
