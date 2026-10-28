<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { parse, roll, DICE, fmtMod, discordPayload } from '../lib/dice';
  import { saveRoll, watchRolls, diceHook, type Roll } from '../lib/live';
  import { sfx } from '../lib/sfx';
  const u = session.user!;
  let pool = $state<Record<number, number>>({}), mod = $state(0), adv = $state<'' | 'adv' | 'dis'>(''), custom = $state(''), label = $state('');
  let hist = $state<Roll[]>([]), cur = $state<Roll | null>(null), phase = $state<'idle' | 'roll' | 'land'>('idle'), flick = $state<number[]>([]), err = $state(''), sent = $state('');
  const poolExpr = $derived(DICE.filter((d) => pool[d]).map((d) => `${pool[d]}d${d}`).join('+') + fmtMod(mod));
  const expr = $derived(custom.trim() || poolExpr);
  const p = $derived(parse(expr));
  const advOk = $derived(!!p && p.groups.length === 1 && p.groups[0].n === 1 && p.groups[0].d === 20);
  onMount(() => watchRolls(u.uid, (r) => (hist = r), 40));
  const add = (d: number) => { custom = ''; pool[d] = Math.min(20, (pool[d] ?? 0) + 1); sfx.click(); };
  const sub = (d: number, e: MouseEvent) => { e.preventDefault(); custom = ''; pool[d] = Math.max(0, (pool[d] ?? 0) - 1); };
  const clear = () => { pool = {}; mod = 0; custom = ''; adv = ''; };
  const shape = (d: number) => d === 4 ? 'M50 8 94 88H6z' : d === 6 ? 'M12 12h76v76H12z' : d === 8 ? 'M50 4 94 50 50 96 6 50z' : d === 10 ? 'M50 4 92 40 50 96 8 40z' : d === 12 ? 'M50 4 95 37 78 92H22L5 37z' : d === 100 ? 'M50 4 92 40 50 96 8 40z' : 'M50 3 93 27v46L50 97 7 73V27z';
  async function go() {
    err = ''; if (!p) { err = 'Geçersiz ifade. Örnek: 2d6+3, d20-2, 1d8+1d4'; sfx.error(); return; }
    if (phase === 'roll') return;
    const res = roll(p, advOk ? adv : '');
    const r: Roll = { uid: u.uid, user: u.username, char: u.character?.name ?? (u.role === 'dm' ? 'Dungeon Master' : ''), expr: expr.replace(/\s+/g, ''), ...res, at: Date.now(), ...(label.trim() ? { label: label.trim().slice(0, 60) } : {}) };
    cur = r; phase = 'roll'; sfx.rattle();
    const all = r.groups.flatMap((g) => g.vals.map(() => g.d));
    const iv = setInterval(() => (flick = all.map((d) => 1 + Math.floor(Math.random() * d))), 70);
    await new Promise((ok) => setTimeout(ok, 1250)); clearInterval(iv); phase = 'land'; sfx.thud();
    if (r.nat === 'nat20') setTimeout(sfx.crit, 120); else if (r.nat === 'nat1') setTimeout(sfx.fumble, 120);
    saveRoll(r).catch(() => (err = 'Atış kaydedilemedi (bağlantı).'));
    const hook = await diceHook();
    if (hook) { const w = session.world ? `SS ${session.world.year} · Gün ${session.world.day}` : '';
      fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(discordPayload(r, w)) }).then((x) => (sent = x.ok ? 'Discord kanalına iletildi' : 'Discord iletimi başarısız')).catch(() => (sent = 'Discord iletimi başarısız')); }
  }
  const keyd = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') go(); };
  const parts = Array.from({ length: 26 }, (_, i) => ({ a: (i / 26) * 360 + Math.random() * 10, d: 80 + Math.random() * 140, s: 3 + Math.random() * 5 }));
</script>
<div class="dz" role="presentation" onkeydown={keyd}>
  <section class="cfg">
    <div class="mono h">ZAR HAVUZU <small>tık: ekle · sağ tık: çıkar</small></div>
    <div class="dice">
      {#each DICE as d}<button class="dd" class:on={pool[d]} onclick={() => add(d)} oncontextmenu={(e) => sub(d, e)} title="d{d}">
        <svg viewBox="0 0 100 100"><path d={shape(d)} /></svg><b>d{d}</b>{#if pool[d]}<i class="mono">×{pool[d]}</i>{/if}</button>{/each}
    </div>
    <div class="row"><span class="mono h">DEĞİŞTİRİCİ</span>
      <div class="mod"><button onclick={() => { custom = ''; mod--; }}>−</button><input type="number" bind:value={mod} oninput={() => (custom = '')} /><button onclick={() => { custom = ''; mod++; }}>+</button></div></div>
    <div class="row"><span class="mono h">İFADE</span><input class="inp ex" bind:value={custom} placeholder={poolExpr || 'örn. 2d6+3'} spellcheck="false" /></div>
    <div class="row"><span class="mono h">ETİKET</span><input class="inp ex" bind:value={label} placeholder="örn. Saldırı, Algı, Hasar" maxlength="60" /></div>
    <div class="adv mono" class:off={!advOk} title={advOk ? '' : 'Avantaj / dezavantaj yalnız tek d20 atışında'}>
      <button class:on={adv === ''} onclick={() => (adv = '')}>NORMAL</button><button class="a" class:on={adv === 'adv'} onclick={() => (adv = 'adv')}>AVANTAJ</button><button class="d" class:on={adv === 'dis'} onclick={() => (adv = 'dis')}>DEZAVANTAJ</button></div>
    <div class="act"><button class="btn ghost" onclick={clear}>Temizle</button><button class="btn go" disabled={!p || phase === 'roll'} onclick={go}>AT · {expr || '—'}{advOk && adv ? (adv === 'adv' ? ' (AV)' : ' (DZ)') : ''}</button></div>
    {#if err}<div class="err mono">{err}</div>{/if}
  </section>
  <section class="tray" class:n20={phase === 'land' && cur?.nat === 'nat20'} class:n1={phase === 'land' && cur?.nat === 'nat1'}>
    <div class="grid"></div>
    {#if cur}
      {@const all = cur.groups.flatMap((g, gi) => g.vals.map((v, i) => ({ d: g.d, v, k: !g.keep || g.keep.includes(i), gi })))}
      <div class="roll" class:rolling={phase === 'roll'}>
        {#each all as x, i (i + ':' + cur.at)}
          <div class="die d{x.d}" class:drop={!x.k && phase === 'land'} style:--i={i} style:--rx="{(i * 137) % 360}deg" style:--tx="{((i * 53) % 60) - 30}px">
            <div class="body"><svg viewBox="0 0 100 100"><path d={shape(x.d)} /></svg><span class="v mono">{phase === 'roll' ? (flick[i] ?? '?') : x.v}</span><small class="mono">d{x.d}</small></div>
          </div>
        {/each}
      </div>
      {#if phase === 'land'}
        <div class="res">
          <div class="tot" data-t={cur.total}>{cur.total}</div>
          <div class="mono br">{cur.groups.map((g) => (g.keep ? `2d20 [${g.vals.join(', ')}] → ${g.vals[g.keep[0]]}` : `${Math.abs(g.n)}d${g.d} [${g.vals.join(', ')}]`)).join(' + ')}{cur.mod ? ' ' + fmtMod(cur.mod) : ''}{cur.adv ? (cur.adv === 'adv' ? ' · AVANTAJ' : ' · DEZAVANTAJ') : ''}</div>
          {#if cur.nat === 'nat20'}<div class="nat g mono" data-t="KRİTİK BAŞARI">KRİTİK BAŞARI</div>{:else if cur.nat === 'nat1'}<div class="nat r mono" data-t="KRİTİK BAŞARISIZLIK">KRİTİK BAŞARISIZLIK</div>{/if}
          {#if sent}<div class="mono sent">{sent}</div>{/if}
        </div>
        {#if cur.nat}<div class="burst">{#each parts as q, i (i)}<i style:--a="{q.a}deg" style:--d="{q.d}px" style:--s="{q.s}px"></i>{/each}</div>{/if}
      {/if}
    {:else}<div class="idle mono">ZAR HAVUZUNU KUR VE AT</div>{/if}
  </section>
  <aside class="hist">
    <div class="mono h">GEÇMİŞ</div>
    {#each hist as r (r.id)}
      <div class="hr" class:g={r.nat === 'nat20'} class:r={r.nat === 'nat1'}><b>{r.total}</b><span class="mono">{r.expr}{r.adv ? (r.adv === 'adv' ? ' AV' : ' DZ') : ''}</span>{#if r.label}<em>{r.label}</em>{/if}<small class="mono">{new Date(r.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</small></div>
    {:else}<div class="none mono">Henüz atış yok.</div>{/each}
  </aside>
</div>
<style>
  .dz{height:100%;display:grid;grid-template-columns:300px 1fr 180px;background:radial-gradient(ellipse at 60% 40%,rgba(0,240,255,.06),transparent 60%)}
  .cfg{padding:16px;display:flex;flex-direction:column;gap:12px;border-right:1px solid var(--line);overflow:auto}
  .h{font-size:10px;letter-spacing:.3em;color:var(--cy)}.h small{color:var(--mut);letter-spacing:.1em;margin-left:6px}
  .dice{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
  .dd{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 2px 6px;background:rgba(0,240,255,.04);border:1px solid var(--line);color:var(--tx)}
  .dd svg{width:30px;height:30px}.dd path{fill:rgba(0,240,255,.08);stroke:var(--cy);stroke-width:4}.dd b{font-size:13px}
  .dd.on{border-color:var(--ye);background:rgba(252,238,10,.08)}.dd.on path{stroke:var(--ye)}
  .dd i{position:absolute;top:2px;right:4px;font-style:normal;font-size:11px;color:var(--ye)}
  .dd:hover{background:rgba(0,240,255,.12)}
  .row{display:flex;flex-direction:column;gap:5px}
  .mod{display:flex}.mod button{width:36px;background:rgba(0,240,255,.08);border:1px solid var(--line);color:var(--cy);font-size:18px}.mod input{flex:1;width:0;text-align:center;background:rgba(0,0,0,.4);border:1px solid var(--line);border-left:0;border-right:0;color:var(--ye);font-family:var(--f-mono);font-size:16px}
  .ex{font-family:var(--f-mono)}
  .adv{display:flex;border:1px solid var(--line)}.adv button{flex:1;background:none;border:0;color:var(--mut);padding:7px 0;font:inherit;font-size:10.5px;letter-spacing:.18em}
  .adv button.on{background:rgba(0,240,255,.14);color:var(--cy)}.adv .a.on{background:rgba(57,255,138,.15);color:#39ff8a}.adv .d.on{background:rgba(255,42,85,.15);color:var(--rd)}
  .adv.off{opacity:.35;pointer-events:none}
  .act{display:flex;gap:8px}.act .go{flex:1;font-family:var(--f-mono);letter-spacing:.04em;font-size:13px;padding-left:12px;padding-right:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .err{color:var(--rd);font-size:12px}
  .tray{position:relative;overflow:hidden;perspective:900px;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .grid{position:absolute;inset:-50%;background:linear-gradient(rgba(0,240,255,.07) 1px,transparent 1px) 0 0/40px 40px,linear-gradient(90deg,rgba(0,240,255,.07) 1px,transparent 1px) 0 0/40px 40px;transform:rotateX(62deg) translateY(10%);pointer-events:none}
  .idle{color:var(--mut);letter-spacing:.3em;font-size:12px;z-index:1}
  .roll{position:relative;z-index:1;display:flex;flex-wrap:wrap;gap:16px;justify-content:center;max-width:90%;transform-style:preserve-3d}
  .die{width:76px;height:76px;transform-style:preserve-3d;animation:land .5s cubic-bezier(.2,1.6,.4,1) both}
  .rolling .die{animation:tumble 1.25s cubic-bezier(.3,.1,.3,1) both;animation-delay:calc(var(--i) * 40ms)}
  .die .body{position:relative;width:100%;height:100%;display:grid;place-items:center;transform-style:preserve-3d}
  .die svg{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 0 10px rgba(0,240,255,.55))}
  .die path{fill:rgba(6,16,28,.9);stroke:var(--cy);stroke-width:3.5}
  .die.d20 path{stroke:var(--ye)}.die.d100 path{stroke:var(--mg)}
  .die .v{position:relative;font-size:26px;color:#fff;text-shadow:0 0 10px var(--cy)}
  .die small{position:absolute;bottom:-16px;font-size:9.5px;color:var(--mut);letter-spacing:.2em}
  .die.drop{opacity:.35;filter:grayscale(1);transform:scale(.8)}
  @keyframes tumble{0%{transform:translate3d(calc(var(--tx) - 260px),-160px,200px) rotateX(0) rotateY(0) rotateZ(0)}40%{transform:translate3d(var(--tx),20px,40px) rotateX(calc(var(--rx) + 540deg)) rotateY(400deg) rotateZ(200deg)}65%{transform:translate3d(calc(var(--tx) * .4),-30px,20px) rotateX(calc(var(--rx) + 720deg)) rotateY(620deg) rotateZ(260deg)}85%{transform:translate3d(0,6px,0) rotateX(1060deg) rotateY(700deg) rotateZ(350deg)}100%{transform:translate3d(0,0,0) rotateX(1080deg) rotateY(720deg) rotateZ(360deg)}}
  @keyframes land{0%{transform:scale(1.25)}100%{transform:none}}
  .res{position:relative;z-index:2;margin-top:34px;display:flex;flex-direction:column;align-items:center;gap:6px;animation:rin .4s both}
  .tot{position:relative;font-family:var(--f-disp);font-size:72px;line-height:1;color:var(--ye);text-shadow:0 0 24px rgba(252,238,10,.6)}
  .br{font-size:12.5px;color:#b9d6e6;letter-spacing:.06em;text-align:center;max-width:90%}
  .sent{font-size:10px;color:var(--mut);letter-spacing:.2em}
  .nat{position:relative;font-size:20px;letter-spacing:.4em;padding:4px 14px}
  .nat.g{color:#39ff8a;text-shadow:0 0 18px #39ff8a;animation:np 1s infinite}.nat.r{color:var(--rd);text-shadow:0 0 18px var(--rd)}
  .nat::before,.nat::after{content:attr(data-t);position:absolute;inset:4px 14px;opacity:.7}
  .nat.r::before{color:var(--cy);clip-path:inset(0 0 60% 0);animation:gx .4s infinite steps(2)}.nat.r::after{color:#fff;clip-path:inset(60% 0 0 0);animation:gx .3s infinite steps(2) reverse}
  .nat.g::before,.nat.g::after{display:none}
  .n20{animation:fl20 .9s both}.n20 .tot{color:#39ff8a;text-shadow:0 0 30px #39ff8a,0 0 60px #39ff8a}.n20 .die.d20 path{stroke:#39ff8a;fill:rgba(57,255,138,.18)}
  .n1{animation:sh1 .5s both}.n1 .tot{color:var(--rd);text-shadow:0 0 30px var(--rd);animation:gx .25s 4 steps(2)}.n1 .die.d20 path{stroke:var(--rd);fill:rgba(255,42,85,.15)}.n1 .grid{filter:hue-rotate(150deg)}
  @keyframes fl20{0%{background:rgba(57,255,138,.35)}100%{background:transparent}}
  @keyframes sh1{0%,100%{transform:none}20%{transform:translate(-8px,3px) skewX(4deg)}40%{transform:translate(7px,-2px)}60%{transform:translate(-4px,2px) skewX(-3deg);filter:hue-rotate(40deg)}80%{transform:translate(3px,0);filter:none}}
  @keyframes gx{0%{transform:translate(0)}50%{transform:translate(-4px,1px)}100%{transform:translate(3px,-1px)}}
  @keyframes np{50%{text-shadow:0 0 4px #39ff8a}}
  @keyframes rin{from{opacity:0;transform:translateY(12px)}}
  .burst{position:absolute;left:50%;top:44%;z-index:1;pointer-events:none}
  .burst i{position:absolute;width:var(--s);height:var(--s);background:#39ff8a;box-shadow:0 0 10px #39ff8a;animation:bu 1.1s cubic-bezier(.1,.8,.3,1) both;transform:rotate(var(--a)) translateX(0)}
  .n1 .burst i{background:var(--rd);box-shadow:0 0 10px var(--rd);border-radius:0;width:calc(var(--s) * 2);height:2px}
  @keyframes bu{to{transform:rotate(var(--a)) translateX(var(--d));opacity:0}}
  .hist{border-left:1px solid var(--line);padding:12px;overflow:auto;display:flex;flex-direction:column;gap:6px}
  .hr{display:grid;grid-template-columns:auto 1fr;gap:0 8px;padding:6px 8px;border-left:2px solid var(--line);background:rgba(255,255,255,.02)}
  .hr b{grid-row:span 2;font-family:var(--f-disp);font-size:20px;color:var(--ye);align-self:center}.hr span{font-size:11.5px}.hr em{font-style:normal;font-size:11px;color:var(--mut)}.hr small{font-size:9.5px;color:var(--mut)}
  .hr.g{border-color:#39ff8a}.hr.g b{color:#39ff8a}.hr.r{border-color:var(--rd)}.hr.r b{color:var(--rd)}
  .none{color:var(--mut);font-size:11px}
</style>
