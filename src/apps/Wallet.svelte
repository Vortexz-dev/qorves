<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '../lib/session.svelte';
  import { watchWallet, watchPresence, sendMoney, CURRENCIES, type Wallet, type Tx, type Presence } from '../lib/live';
  import { sfx } from '../lib/sfx';
  const u = session.user!;
  let w = $state<Wallet | null>(null), tx = $state<Tx[]>([]), ready = $state(false), cur = $state('BK');
  let ppl = $state<Presence[]>([]), to = $state(''), amt = $state<number>(0), note = $state(''), ask = $state(false), busy = $state(false), msg = $state(''), bad = $state(false);
  onMount(() => { const a = watchWallet(u.uid, (x, y) => { w = x; tx = y; ready = true; }); const b = watchPresence((p) => (ppl = p)); return () => { a(); b(); }; });
  const isDM = u.role === 'dm';
  const peers = $derived(ppl.filter((p) => p.role === 'player' && p.uid !== u.uid).sort((a, b) => (a.char || a.username).localeCompare(b.char || b.username, 'tr')));
  const label = (p: Presence) => (p.char ? `${p.char} (${p.username})` : p.username);
  const have = $derived(w?.bal?.[cur] ?? 0);
  const valid = $derived(!!to && Number(amt) > 0 && Number(amt) <= have);
  const sym = $derived(CURRENCIES.find((c) => c.id === cur)?.sym ?? cur);
  const flash = (s: string, e = false) => { msg = s; bad = e; setTimeout(() => msg === s && (msg = ''), 6000); };
  async function send() {
    const p = peers.find((x) => x.uid === to); if (!p || !valid) return; busy = true;
    try {
      await sendMoney({ uid: u.uid, name: u.character?.name || u.username }, { uid: p.uid, name: p.char || p.username }, cur, Number(amt), note);
      sfx.granted(); flash(`${fmt(Number(amt))} ${sym} gönderildi: ${label(p)}`); amt = 0; note = ''; ask = false;
    } catch (e) { sfx.error(); flash(/yetersiz/i.test(String(e)) ? 'Bakiye yetersiz.' : 'Aktarım reddedildi. Bakiyeni kontrol edip tekrar dene.', true); ask = false; }
    busy = false;
  }
  const fmt = (n: number) => n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const list = $derived(tx.filter((t) => t.cur === cur));
</script>
<div class="wl">
  <div class="cards">
    {#each CURRENCIES as c (c.id)}
      <button class="cd" class:on={cur === c.id} onclick={() => (cur = c.id)}>
        <span class="mono k">{c.name.toLocaleUpperCase('tr')}</span>
        <b>{fmt(w?.bal?.[c.id] ?? 0)} <i>{c.sym}</i></b>
        <small>{c.note}</small>
      </button>
    {/each}
  </div>
  {#if !isDM}
    <div class="snd">
      <div class="mono h">PARA GÖNDER · {cur}</div>
      <div class="row">
        <select class="inp" bind:value={to} onchange={() => (ask = false)}>
          <option value="">Alıcı seç…</option>
          {#each peers as p (p.uid)}<option value={p.uid}>{label(p)}</option>{/each}
        </select>
        <input class="inp n" type="number" min="0" step="any" bind:value={amt} oninput={() => (ask = false)} placeholder="Tutar" />
        <input class="inp" bind:value={note} maxlength="140" placeholder="Açıklama (isteğe bağlı)" />
        {#if !ask}<button class="btn" disabled={!valid || busy} onclick={() => (ask = true)}>Gönder</button>
        {:else}<button class="btn ok" disabled={busy} onclick={send}>Onayla: {fmt(Number(amt))} {sym}</button><button class="btn ghost" onclick={() => (ask = false)}>Vazgeç</button>{/if}
      </div>
      {#if Number(amt) > have}<p class="mono er">Bakiye yetersiz (elinde {fmt(have)} {sym}).</p>{/if}
      {#if msg}<p class="mono" class:er={bad} class:okm={!bad}>{msg}</p>{/if}
    </div>
  {/if}
  <div class="mono h">İŞLEM GEÇMİŞİ · {cur}</div>
  <div class="tx">
    {#each list as t (t.id)}
      <div class="t"><span class="a mono" class:p={t.amt > 0} class:n={t.amt < 0}>{t.amt > 0 ? '+' : ''}{fmt(t.amt)}</span><span class="r">{t.reason}</span><span class="mono d">{new Date(t.at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span><span class="mono b">{t.bal != null ? '= ' + fmt(t.bal) : ''}</span></div>
    {:else}<div class="none mono">{ready ? 'Bu hesapta henüz işlem yok.' : 'BAĞLANIYOR…'}</div>{/each}
  </div>
  <div class="mono ft">Bakiyeyi DM yönetir. Aktarımlar geri alınamaz ve DM'in kaydına düşer.</div>
</div>
<style>
  .wl{height:100%;display:flex;flex-direction:column;gap:12px;padding:18px 20px}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .cd{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:12px 14px;background:linear-gradient(135deg,rgba(0,240,255,.08),rgba(0,0,0,.2));border:1px solid var(--line);color:var(--tx);text-align:left;clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)}
  .cd.on{border-color:var(--ye);background:linear-gradient(135deg,rgba(252,238,10,.12),rgba(0,0,0,.2))}
  .k{font-size:9.5px;letter-spacing:.25em;color:var(--cy)}.cd b{font-family:var(--f-disp);font-size:24px;color:#fff}.cd b i{font-style:normal;font-size:13px;color:var(--ye)}.cd small{color:var(--mut);font-size:12px}
  .h{font-size:10px;letter-spacing:.3em;color:var(--cy);margin-top:4px}
  .tx{flex:1;overflow:auto;border:1px solid var(--line)}
  .t{display:grid;grid-template-columns:110px 1fr 120px 100px;gap:10px;padding:8px 12px;border-bottom:1px solid rgba(0,240,255,.08);align-items:center}
  .a{font-size:15px}.a.p{color:#39ff8a}.a.n{color:var(--rd)}.r{font-size:14.5px}.d,.b{font-size:11px;color:var(--mut);text-align:right}
  .none{padding:20px;color:var(--mut);font-size:12px}
  .snd{display:flex;flex-direction:column;gap:6px}.row{display:grid;grid-template-columns:1.3fr 120px 1.5fr auto auto;gap:8px;align-items:center}.inp.n{width:100%}
  .btn.ok{border-color:var(--ye);color:var(--ye)}.er{font-size:11.5px;color:var(--rd)}.okm{font-size:11.5px;color:#39ff8a}
  .ft{font-size:10px;color:var(--mut);letter-spacing:.08em}
</style>
