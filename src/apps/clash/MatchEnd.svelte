<script lang="ts">
  /* Maç sonu: sonuç, taçlar, kupa ve ödüller; kart başına hasar, maçın yıldızı, iksir, kuleler ve kısa özet. */
  import { onMount } from 'svelte';
  import { CARD } from './cards';
  import type { MatchStats, Side } from './engine';
  import { S } from './audio';
  import type { EndInfo } from './economy';
  let { info, st, me, deck, onclose }: { info: EndInfo; st: MatchStats; me: Side; deck: string[]; onclose: () => void } = $props();
  const IMG = import.meta.env.BASE_URL + 'img/clash/';
  const foe = $derived((1 - me) as Side);
  const rows = $derived(deck.map((id) => ({ id, d: Math.round(st.dmg[me][id] ?? 0) })).sort((a, b) => b.d - a.d));
  const max = $derived(Math.max(1, ...rows.map((r) => r.d)));
  const top = $derived(rows[0]);
  const foeTop = $derived(Object.entries(st.dmg[foe]).sort((a, b) => b[1] - a[1])[0]);
  let crShown = $state(0), bitShown = $state(0), stage = $state(0);
  const summary = $derived.by(() => {
    const out: string[] = []; const sp = st.spent[me], fs = st.spent[foe];
    if (top && top.d > 0) out.push(`${CARD[top.id]!.name} ${top.d.toLocaleString('tr-TR')} hasarla maçın yükünü taşıdı.`);
    if (info.crowns[0] === 3) out.push('Ana kuleyi düşürüp üç taçla bitirdin.'); else if (info.crowns[1] === 3) out.push('Ana kulen düştü; savunma hattı yetmedi.');
    if (Math.abs(sp - fs) >= 5) out.push(sp > fs ? `Rakipten ${Math.round(sp - fs)} iksir fazla harcadın.` : `Rakipten ${Math.round(fs - sp)} iksir az harcayıp yine de baskı kurdun.`);
    if (st.leak[me] >= 4) out.push(`Dolu iksirle ${Math.round(st.leak[me])} iksir boşa gitti.`);
    if (foeTop && foeTop[1] > 0 && CARD[foeTop[0]]) out.push(`Rakibin en etkili kartı ${CARD[foeTop[0]]!.name} oldu.`);
    return out.slice(0, 3).join(' ');
  });
  onMount(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    ts.push(setTimeout(() => { stage = 1; S.stamp(); }, 300));
    for (let i = 0; i < Math.max(info.crowns[0], 0); i++) ts.push(setTimeout(() => S.crown(), 700 + i * 260));
    ts.push(setTimeout(() => { stage = 2; let k = 0; const f = () => { k++; crShown = Math.round((info.dcr * k) / 20); bitShown = Math.round((info.bit * k) / 20); if (k % 2) (info.dcr >= 0 ? S.trophyUp : S.trophyDown)(); if (k < 20) ts.push(setTimeout(f, 35)); else S.coins(5); }; f(); }, 1500));
    ts.push(setTimeout(() => (stage = 3), 2300));
    return () => ts.forEach(clearTimeout);
  });
  const title = $derived(info.res === 'win' ? 'ZAFER' : info.res === 'lose' ? 'YENİLGİ' : 'BERABERE');
</script>

<div class={'me ' + info.res}>
  <div class="hd">
    <div class="ttl">{title}</div>
    <div class="why">{info.why}{info.desync ? ' · senkron uyarısı' : ''}</div>
    <div class="vs"><span class="nm you">Sen</span>
      <div class="crowns">{#each [0, 1, 2] as i}<i class:on={stage >= 1 && i < info.crowns[0]} style={`--d:${400 + i * 260}ms`}>♛</i>{/each}</div>
      <b class="dash">—</b>
      <div class="crowns foe">{#each [0, 1, 2] as i}<i class:on={stage >= 1 && i < info.crowns[1]} style={`--d:${400 + i * 260}ms`}>♛</i>{/each}</div>
      <span class="nm">{info.foe}{#if info.foeBot}<em class="bot">BOT</em>{/if}</span></div>
  </div>
  <div class="body" class:on={stage >= 2}>
    <div class="col rewards">
      <div class="rw"><svg class="tro" viewBox="0 0 24 24"><path d="M7 3h10v3h3v2a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V6h3zM6 8a2 2 0 0 0 1 1.7V8zm11 0v1.7A2 2 0 0 0 18 8z" fill="#ffd257" /></svg><span>KUPA</span><b class:neg={info.dcr < 0}>{info.friendly ? '—' : (crShown >= 0 ? '+' : '') + crShown}</b><small>{info.friendly ? info.tag : `Yeni: ${info.cr}`}</small></div>
      <div class="rw"><img src={`${IMG}cur_bit.webp`} alt="" /><span>BIT</span><b class="bit">+{bitShown}</b><small>Maç ödülü</small></div>
      <div class="rw">{#if info.chest === 'yes'}<img src={`${IMG}chest_win.webp`} alt="" class="ch" /><span>SANDIK</span><b class="chest">Veri Kasası</b><small>Yuvaya eklendi</small>{:else if info.chest === 'full'}<img src={`${IMG}chest_win.webp`} alt="" class="ch gray" /><span>SANDIK</span><b>Yuvalar dolu</b><small>Önce bir sandık aç</small>{:else}<span>SANDIK</span><b>—</b><small>Kazanınca sandık düşer</small>{/if}</div>
    </div>
    <div class="col dmg">
      <h4>KART BAŞINA HASAR</h4>
      {#each rows as r, i (r.id)}{@const c = CARD[r.id]!}
        <div class="row" class:top={i === 0 && r.d > 0} style={`--d:${i * 70}ms`}>
          <img src={`${IMG}card_${r.id}.webp`} alt="" /><span class="cn">{c.name}{#if i === 0 && r.d > 0}<em>MAÇIN YILDIZI</em>{/if}</span>
          <span class="bar"><i style={`width:${stage >= 3 ? (r.d / max) * 100 : 0}%`}></i></span><b>{r.d.toLocaleString('tr-TR')}</b>
        </div>
      {/each}
    </div>
    <div class="col nums">
      <h4>MAÇ İSTATİSTİKLERİ</h4>
      <div class="kv"><span>Harcanan iksir</span><b>{Math.round(st.spent[me])}</b><i>{Math.round(st.spent[foe])}</i></div>
      <div class="kv"><span>Düşen kule</span><b>{info.crowns[0]}</b><i>{info.crowns[1]}</i></div>
      <div class="kv"><span>Kule hasarı</span><b>{Math.round(st.tdmg[me]).toLocaleString('tr-TR')}</b><i>{Math.round(st.tdmg[foe]).toLocaleString('tr-TR')}</i></div>
      <div class="kv"><span>Oynanan kart</span><b>{st.plays[me]}</b><i>{st.plays[foe]}</i></div>
      <div class="kv"><span>Öldürülen birim</span><b>{st.kills[me]}</b><i>{st.kills[foe]}</i></div>
      <div class="kv"><span>Boşa giden iksir</span><b>{Math.round(st.leak[me])}</b><i>{Math.round(st.leak[foe])}</i></div>
      <p class="sm">{summary}</p>
    </div>
  </div>
  <button class="go" class:on={stage >= 3} onclick={() => { S.click(); onclose(); }} type="button">DEVAM</button>
</div>

<style>
  .me{position:absolute;inset:0;z-index:40;display:grid;grid-template-rows:auto 1fr auto;padding:3vh 4vw;gap:2vh;background:radial-gradient(ellipse at top,rgba(0,40,60,.75),rgba(3,5,10,.97) 70%);animation:fade .4s both;color:#e6f2fa}
  .me.lose{background:radial-gradient(ellipse at top,rgba(70,0,20,.75),rgba(3,5,10,.97) 70%)}
  @keyframes fade{from{opacity:0}}
  .hd{display:grid;justify-items:center;gap:6px}
  .ttl{font:900 clamp(48px,8vw,96px) var(--f-disp,sans-serif);letter-spacing:.14em;color:#fff;text-shadow:0 0 30px #00e5ff;animation:slam .6s cubic-bezier(.2,1.6,.4,1) both}
  .win .ttl{background:linear-gradient(180deg,#fff7cc,#ffd257 55%,#b8770d);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 0 20px rgba(255,210,87,.5))}
  .lose .ttl{text-shadow:0 0 30px #ff2a55;color:#ffd6de}
  @keyframes slam{from{transform:scale(2.6);opacity:0;filter:blur(12px)}}
  .why{font:600 13px var(--f-mono,monospace);letter-spacing:.2em;color:#9fb6c6;text-transform:uppercase}
  .vs{display:flex;align-items:center;gap:18px;margin-top:6px}
  .nm{font:800 18px var(--f-disp,sans-serif);color:#bfe9ff}.nm.you{color:#7ff6ff}
  .bot{font:800 9px var(--f-mono,monospace);background:#33475a;color:#cfe;padding:2px 5px;border-radius:3px;margin-left:6px;font-style:normal;vertical-align:middle}
  .crowns{display:flex;gap:6px}.crowns i{font-style:normal;font-size:38px;color:#26313d;transition:none}
  .crowns i.on{color:#3ff0ff;text-shadow:0 0 14px #3ff0ff;animation:cpop .45s cubic-bezier(.2,1.8,.4,1) var(--d) both}
  .crowns.foe i.on{color:#ff3b6b;text-shadow:0 0 14px #ff3b6b}
  @keyframes cpop{from{transform:scale(2.5) rotate(-20deg);opacity:0}}
  .dash{color:#556}
  .body{display:grid;grid-template-columns:minmax(220px,.8fr) 1.6fr 1fr;gap:2.4vw;min-height:0;opacity:0;transform:translateY(20px);transition:all .5s}
  .body.on{opacity:1;transform:none}
  .col{background:rgba(8,14,22,.7);border:1px solid rgba(0,229,255,.18);border-radius:12px;padding:16px 18px;min-height:0;overflow:auto}
  h4{margin:0 0 12px;font:700 11px var(--f-mono,monospace);letter-spacing:.3em;color:#00e5ff}
  .rewards{display:grid;gap:12px;align-content:start}
  .rw{display:grid;grid-template-columns:52px 1fr;grid-template-rows:auto auto auto;column-gap:12px;align-items:center;padding:10px;border-radius:10px;background:rgba(255,255,255,.03)}
  .rw .tro{grid-row:1/4;width:46px;height:46px;filter:drop-shadow(0 0 8px rgba(255,210,87,.5))}
  .rw img{grid-row:1/4;width:52px;height:52px;object-fit:contain}.rw img.gray{filter:grayscale(1) brightness(.5)}
  .rw span{font:700 10px var(--f-mono,monospace);letter-spacing:.25em;color:#8aa3b3}
  .rw b{font:900 30px var(--f-disp,sans-serif);color:#ffd257}.rw b.neg{color:#ff6b86}.rw b.bit{color:#7dffb0}.rw b.chest{font-size:20px;color:#7ff6ff}
  .rw small{color:#8aa3b3;font-size:12px}
  .row{display:grid;grid-template-columns:34px 150px 1fr 70px;gap:10px;align-items:center;margin-bottom:7px;animation:rin .4s var(--d) both}
  @keyframes rin{from{opacity:0;transform:translateX(-20px)}}
  .row img{width:34px;height:45px;object-fit:cover;border-radius:4px}
  .row .cn{font:700 13px var(--f-disp,sans-serif);display:flex;flex-direction:column}
  .row .cn em{font:800 9px var(--f-mono,monospace);color:#fcee0a;font-style:normal;letter-spacing:.15em}
  .row .bar{height:12px;border-radius:6px;background:rgba(255,255,255,.06);overflow:hidden}
  .row .bar i{display:block;height:100%;background:linear-gradient(90deg,#0a7fb0,#3ff0ff);transition:width .9s cubic-bezier(.2,1,.3,1)}
  .row.top .bar i{background:linear-gradient(90deg,#b8770d,#ffd257)}
  .row.top{background:rgba(255,210,87,.07);border-radius:8px;padding:3px 6px;margin-left:-6px}
  .row b{text-align:right;font:700 14px var(--f-mono,monospace)}
  .kv{display:grid;grid-template-columns:1fr 60px 60px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px}
  .kv b{color:#7ff6ff;text-align:right;font-family:var(--f-mono,monospace)}.kv i{color:#ff7b96;text-align:right;font-style:normal;font-family:var(--f-mono,monospace)}
  .sm{margin:14px 0 0;color:#cfe0ea;line-height:1.55;font-size:13.5px}
  .go{justify-self:center;padding:14px 64px;font:900 20px var(--f-disp,sans-serif);letter-spacing:.25em;color:#04131a;background:linear-gradient(180deg,#7ff6ff,#13b7d6);border:0;border-radius:12px;cursor:pointer;box-shadow:0 6px 0 #076a80;opacity:0;transform:translateY(20px);transition:all .4s}
  .go.on{opacity:1;transform:none}.go:hover{filter:brightness(1.15)}
</style>
