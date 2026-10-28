<script lang="ts">
  // ghOS-Net: kayıt dışı, şifreli mesajlaşma. Temiz işletim sistemi görünümünden bilerek ayrı: fosfor yeşili, bozulma, iz uyarıları.
  import { onMount, tick, untrack } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { ghos } from '../lib/ghos.svelte';
  import { watchMsgs, sendMsg, markRead, ensureConv, isOnline, unreadFor, convId, type Msg, type Conv } from '../lib/live';
  import { decrypt, ago } from '../lib/decrypt';
  import { sfx } from '../lib/sfx';
  import type { Win } from '../desktop/wm.svelte';
  let { arg, win }: { arg?: string; win: Win } = $props();
  const u = session.user!, dm = u.role === 'dm';
  let booted = $state(false), bootLines = $state<string[]>([]);
  let ident = $state(''); // DM: hangi NPC kılığında
  const me = $derived(dm ? (ident ? 'npc:' + ident : '') : u.uid);
  let open = $state<string | null>(null), msgs = $state<Msg[]>([]), text = $state(''), readMark = 0, box: HTMLDivElement | undefined = $state();
  let tr = $state(0), clock = $state(Date.now());
  const myName = $derived(dm ? (ghos.npcs.find((n) => n.id === ident)?.name ?? '') : (u.character?.name || u.username));
  // kişiler: oyuncular (çevrimiçi durumuyla) + benimle konuşması olan NPC'ler
  const players = $derived(ghos.people.filter((p) => p.role !== 'dm' && p.uid !== u.uid).sort((a, b) => Number(isOnline(b)) - Number(isOnline(a)) || b.last - a.last));
  const myConvs = $derived(ghos.convs.filter((c) => me && c.members.includes(me)));
  const npcConvs = $derived(dm ? [] : myConvs.filter((c) => c.npc));
  const conv = $derived(ghos.convs.find((c) => c.id === open) ?? null);
  const other = $derived(conv ? conv.members.find((m) => m !== me) ?? '' : '');
  const npcOf = (id: string) => ghos.npcs.find((n) => 'npc:' + n.id === id || n.id === id);
  const pres = (uid: string) => ghos.people.find((p) => p.uid === uid);
  const nameOf = (id: string) => id.startsWith('npc:') ? (npcOf(id)?.name ?? conv?.names?.[id] ?? 'Bilinmeyen') : (pres(id)?.char || pres(id)?.username || conv?.names?.[id] || 'Bilinmeyen düğüm');
  const avOf = (id: string) => id.startsWith('npc:') ? npcOf(id)?.avatar ?? '' : pres(id)?.avatar ?? '';
  const unreadWith = (id: string) => { const c = myConvs.find((x) => x.members.includes(id)); return !!c && unreadFor(c, me); };
  onMount(() => {
    const L = ['> röle zinciri kuruluyor…', '> düğüm 1/3 · ' + hex(4) + '.onion', '> düğüm 2/3 · ' + hex(4) + '.void', '> düğüm 3/3 · ' + hex(4) + '.null', '> anahtar değişimi: X25519 · akış: XChaCha20', '> kimlik maskesi: ETKİN', '> UYARI: kayıt dışı yazılım. Ortak Hat Kayıt Ağı bu trafiği arıyor.'];
    let i = 0; const iv = setInterval(() => { bootLines = [...bootLines, L[i++]]; sfx.key(); if (i >= L.length) { clearInterval(iv); setTimeout(() => (booted = true), 450); } }, 260);
    const ck = setInterval(() => { clock = Date.now(); tr = Math.min(100, Math.max(4, tr + (Math.random() - 0.45) * 9)); }, 1000);
    if (dm && ghos.npcs.length) ident = ghos.npcs[0].id;
    return () => { clearInterval(iv); clearInterval(ck); };
  });
  $effect(() => { if (arg) open = arg; }); // bildirimden gelen konuşma
  const hex = (n: number) => Array.from({ length: n }, () => ((Math.random() * 65536) | 0).toString(16).padStart(4, '0')).join('');
  $effect(() => { if (dm && !ident && ghos.npcs.length) ident = ghos.npcs[0].id; });
  // açık konuşmanın mesajları
  $effect(() => {
    const id = open; if (!id) { msgs = []; return; }
    readMark = untrack(() => conv?.read?.[me.replace(/\./g, '_')] ?? 0);
    const off = watchMsgs(id, async (m) => { msgs = m; await tick(); box?.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }); });
    return off;
  });
  $effect(() => { if (open && conv && me && unreadFor(conv, me)) markRead(open, me); });
  $effect(() => { win.title = conv ? 'ghOS-Net · ' + nameOf(other) : 'ghOS-Net'; });
  async function openWith(uid: string) {
    if (!me) return;
    const id = await ensureConv(me, uid, { [me]: myName, [uid]: nameOf(uid) }, dm ? ident : null).catch(() => convId(me, uid));
    open = id; sfx.click();
  }
  async function send() {
    if (!open || !text.trim() || !me) return; const t = text; text = ''; sfx.click();
    await sendMsg(open, me, t).catch(() => { text = t; sfx.error(); });
  }
  // yalnız okunmamış/yeni gelen mesajlar şifre çözme efektiyle açılır
  const fresh = (m: Msg) => m.from !== me && m.at > readMark;
</script>

<div class="gh">
  <div class="crt"></div><div class="tear"></div><div class="tear t2"></div>
  {#if !booted}
    <div class="boot">{#each bootLines as l, i (i)}<div class:warn={l?.includes('UYARI')}>{l}</div>{/each}<span class="cur">█</span></div>
  {:else}
    <header>
      <span class="lg" data-t="ghOS-Net">ghOS-Net</span><span class="v">v0.9.3-kaçak</span>
      <span class="node">DÜĞÜM {u.uid.slice(0, 6).toUpperCase()}·{(clock % 9973).toString(16).toUpperCase()}</span>
      <span class="trace" class:hot={tr > 70}>İZ {Math.round(tr)}%<i style:width="{tr}%"></i></span>
      {#if dm}<select class="id" bind:value={ident} title="Hangi kimlikle yazıyorsun">{#each ghos.npcs as n (n.id)}<option value={n.id}>{n.name}</option>{/each}</select>{/if}
    </header>
    <div class="warnbar"><span>⚠ BAĞLANTI İZLENİYOR</span><span>OHKA tarama dalgası · {new Date(clock).toLocaleTimeString('tr-TR')}</span><span>⚠ İZ BIRAKMA</span></div>
    {#if dm && !ghos.npcs.length}<div class="empty">Önce DM Paneli › ghOS-Net bölümünden bir NPC kimliği oluştur.</div>{:else}
    <div class="body">
      <aside class="ls">
        {#if npcConvs.length}<div class="sec">// GİZLİ KANALLAR</div>
          {#each npcConvs as c (c.id)}{@const o = c.members.find((m) => m !== me) ?? ''}
            <button class="ct" class:on={open === c.id} onclick={() => { open = c.id; sfx.click(); }}>
              <span class="av" style:--c={npcOf(o)?.color ?? '#39ff8a'}>{#if avOf(o)}<img src={avOf(o)} alt="" data-nolb />{:else}{nameOf(o).slice(0, 1)}{/if}</span>
              <span class="nm">{nameOf(o)}<small>{npcOf(o)?.style ?? 'şifreli kanal'}</small></span>{#if unreadFor(c, me)}<i class="ur"></i>{/if}</button>{/each}{/if}
        <div class="sec">// DÜĞÜMLER ({players.filter(isOnline).length}/{players.length} çevrimiçi)</div>
        {#each players as p (p.uid)}
          <button class="ct" class:on={!!conv && conv.members.includes(p.uid)} onclick={() => openWith(p.uid)}>
            <span class="av" class:off={!isOnline(p)}>{#if p.avatar}<img src={p.avatar} alt="" data-nolb />{:else}{(p.char || p.username).slice(0, 1)}{/if}<b class="dot" class:on={isOnline(p)}></b></span>
            <span class="nm">{p.char || p.username}<small>{isOnline(p) ? '● çevrimiçi' : 'son görülme ' + ago(p.last)} · @{p.username}</small></span>{#if unreadWith(p.uid)}<i class="ur"></i>{/if}</button>
        {:else}<div class="none">Ağda başka düğüm yok.</div>{/each}
      </aside>
      <section class="ch">
        {#if conv}
          <div class="ch-h"><span class="av sm" style:--c={npcOf(other)?.color ?? '#39ff8a'}>{#if avOf(other)}<img src={avOf(other)} alt="" data-nolb />{:else}{nameOf(other).slice(0, 1)}{/if}</span>
            <b>{nameOf(other)}</b>{#if !other.startsWith('npc:')}<small>{isOnline(pres(other)) ? '● çevrimiçi' : pres(other) ? 'son görülme ' + ago(pres(other)!.last) : ''}</small>{:else}<small>{npcOf(other)?.bio ?? ''}</small>{/if}<span class="e2e">UÇTAN UCA · {hex(2).toUpperCase()}</span></div>
          <div class="ms" bind:this={box}>
            {#each msgs as m (m.id)}
              <div class="m" class:mine={m.from === me}>
                <div class="mt">{m.from === me ? 'SEN' : nameOf(m.from)} · {new Date(m.at).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</div>
                <div class="tx" use:decrypt={{ text: m.text, on: fresh(m) }}></div>
              </div>
            {:else}<div class="none c">[ kanal boş · ilk paketi gönder ]</div>{/each}
          </div>
          <form class="in" onsubmit={(e) => { e.preventDefault(); send(); }}>
            <span class="pr">&gt;</span><textarea bind:value={text} rows="2" maxlength="2000" placeholder="şifrelenecek mesaj…" onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}></textarea>
            <button disabled={!text.trim()}>ŞİFRELE ▸ GÖNDER</button>
          </form>
        {:else}<div class="pick"><pre>{`   ▄████  ██░ ██  ▒█████    ██████
  ██▒ ▀█▒▓██░ ██▒▒██▒  ██▒▒██    ▒
 ▒██░▄▄▄░▒██▀▀██░▒██░  ██▒░ ▓██▄
 ░▓█  ██▓░▓█ ░██ ▒██   ██░  ▒   ██▒
 ░▒▓███▀▒░▓█▒░██▓░ ████▓▒░▒██████▒▒`}</pre><span>bir düğüm seç · kimse seni görmüyor (umarız)</span></div>{/if}
      </section>
    </div>{/if}
  {/if}
</div>

<style>
  .gh{--g:#39ff8a;--g2:#1f8f4d;--m:#ff2a8a;position:relative;height:100%;background:#020604;color:#b8ffd2;font-family:var(--f-mono);overflow:hidden;display:flex;flex-direction:column;text-shadow:0 0 4px rgba(57,255,138,.35)}
  .crt{position:absolute;inset:0;pointer-events:none;z-index:5;background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.6) 100%);animation:fk 6s infinite}
  .tear{position:absolute;left:0;right:0;height:14px;top:-20px;z-index:6;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(57,255,138,.18) 20%,rgba(255,42,138,.22) 60%,transparent);mix-blend-mode:screen;animation:te 7s infinite linear;backdrop-filter:hue-rotate(80deg) blur(.5px)}
  .t2{animation-duration:11s;animation-delay:3s;height:4px}
  @keyframes te{0%{top:-20px}8%{top:110%}100%{top:110%}}
  @keyframes fk{0%,96%,100%{opacity:1}97%{opacity:.75}98%{opacity:1}99%{opacity:.85}}
  .boot{padding:24px;font-size:13px;line-height:1.7;color:var(--g)}.boot .warn{color:var(--m);animation:bl .3s 3 steps(2)}
  .cur{animation:bl .7s infinite steps(2)}@keyframes bl{50%{opacity:0}}
  header{display:flex;align-items:center;gap:14px;padding:8px 14px;border-bottom:1px solid var(--g2);background:linear-gradient(90deg,rgba(57,255,138,.08),transparent)}
  .lg{position:relative;font-size:18px;font-weight:700;letter-spacing:.12em;color:var(--g)}
  .lg::before,.lg::after{content:attr(data-t);position:absolute;inset:0}.lg::before{color:var(--m);clip-path:inset(0 0 50% 0);animation:gl 3s infinite steps(1)}.lg::after{color:#0ff;clip-path:inset(50% 0 0 0);animation:gl 2.3s infinite steps(1) reverse}
  @keyframes gl{0%,90%,100%{transform:none}92%{transform:translate(-3px,0)}95%{transform:translate(3px,1px)}}
  .v{font-size:10px;color:var(--g2)}.node{font-size:10.5px;color:var(--g2);margin-left:auto}
  .trace{position:relative;width:110px;font-size:10px;letter-spacing:.15em;padding-bottom:3px}.trace i{position:absolute;left:0;bottom:0;height:2px;background:var(--g);transition:width 1s}.trace.hot{color:var(--m)}.trace.hot i{background:var(--m);box-shadow:0 0 6px var(--m)}
  .id{background:#000;color:var(--g);border:1px solid var(--g2);font:inherit;font-size:12px;padding:3px 6px}
  .warnbar{display:flex;justify-content:space-between;padding:3px 14px;font-size:10px;letter-spacing:.25em;color:#000;background:repeating-linear-gradient(45deg,var(--g) 0 12px,#1a6 12px 24px);animation:wb 2.4s infinite steps(1)}
  @keyframes wb{0%,70%{opacity:1}72%{opacity:.4}74%{opacity:1}86%{background:repeating-linear-gradient(45deg,var(--m) 0 12px,#a14 12px 24px)}88%{opacity:1}}
  .empty{padding:30px;color:var(--g)}
  .body{flex:1;display:grid;grid-template-columns:270px 1fr;min-height:0}
  .ls{border-right:1px solid var(--g2);overflow:auto;padding:8px 0}
  .sec{font-size:10px;letter-spacing:.2em;color:var(--g2);padding:8px 12px 4px}
  .ct{display:flex;align-items:center;gap:10px;width:100%;padding:7px 12px;background:none;border:0;border-left:2px solid transparent;color:inherit;text-align:left;font:inherit;position:relative}
  .ct:hover{background:rgba(57,255,138,.07)}.ct.on{background:rgba(57,255,138,.12);border-left-color:var(--g)}
  .av{position:relative;width:34px;height:34px;flex:none;display:grid;place-items:center;border:1px solid var(--c,var(--g));color:var(--c,var(--g));font-size:15px;clip-path:polygon(0 0,80% 0,100% 20%,100% 100%,20% 100%,0 80%)}
  .av img{width:100%;height:100%;object-fit:cover;filter:grayscale(.6) contrast(1.2) sepia(.3) hue-rotate(70deg)}.av.off img{filter:grayscale(1) brightness(.6)}.av.sm{width:26px;height:26px;font-size:12px}
  .dot{position:absolute;right:1px;bottom:1px;width:7px;height:7px;background:#355;border:1px solid #000}.dot.on{background:var(--g);box-shadow:0 0 6px var(--g)}
  .nm{display:flex;flex-direction:column;font-size:14px;color:#dfffea;min-width:0}.nm small{font-size:10.5px;color:var(--g2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ur{position:absolute;right:12px;width:8px;height:8px;background:var(--m);box-shadow:0 0 8px var(--m);animation:bl 1s infinite steps(2)}
  .none{padding:10px 12px;font-size:11px;color:var(--g2)}.none.c{text-align:center;padding:40px}
  .ch{display:flex;flex-direction:column;min-height:0}
  .ch-h{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid var(--g2)}.ch-h b{color:#fff}.ch-h small{font-size:10.5px;color:var(--g2)}.e2e{margin-left:auto;font-size:9.5px;letter-spacing:.2em;color:var(--g2)}
  .ms{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
  .m{max-width:74%;align-self:flex-start;border:1px solid var(--g2);padding:7px 10px;background:rgba(57,255,138,.04);animation:mi .25s both}
  .m.mine{align-self:flex-end;border-color:rgba(255,42,138,.5);background:rgba(255,42,138,.05)}
  .mt{font-size:9.5px;letter-spacing:.15em;color:var(--g2);margin-bottom:3px}.mine .mt{color:#b0507a;text-align:right}
  .tx{white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.45;color:#e8fff0}
  @keyframes mi{0%{opacity:0;transform:translateX(-6px) skewX(-10deg);filter:hue-rotate(90deg)}60%{filter:none}100%{opacity:1;transform:none}}
  .in{display:flex;gap:8px;align-items:stretch;padding:10px 14px;border-top:1px solid var(--g2)}
  .pr{color:var(--g);font-size:18px;align-self:center}
  textarea{flex:1;resize:none;background:#000;border:1px solid var(--g2);color:#dfffea;font:inherit;font-size:14px;padding:6px 8px;outline:none}textarea:focus{border-color:var(--g);box-shadow:0 0 8px rgba(57,255,138,.3)}
  .in button{background:none;border:1px solid var(--g);color:var(--g);font:inherit;font-size:11px;letter-spacing:.15em;padding:0 14px}.in button:hover:not(:disabled){background:var(--g);color:#000}.in button:disabled{opacity:.35}
  .pick{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--g2)}.pick pre{font-size:10px;line-height:1.1;color:var(--g);opacity:.7;animation:fk 3s infinite}.pick span{font-size:11px;letter-spacing:.2em}
</style>
