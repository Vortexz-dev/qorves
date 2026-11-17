<script lang="ts">
  import { onMount } from 'svelte';
  import { dm, pname } from './store.svelte';
  import PlayerPick from './PlayerPick.svelte';
  import { sfx } from '../../lib/sfx';
  import { FACTIONS, CHROME_TIERS } from '../../lib/data/character';
  import { ask } from '../../lib/confirm.svelte';
  import {
    watchSheet, watchChrome, watchQuests, watchBounties, watchRels, ensureSheet, saveSheet, saveChrome, dropChrome,
    saveQuest, dropQuest, saveBounty, dropBounty, saveRel, dropRel, resetStats, nid, now, blankSheet,
    CHROME_SLOTS, QUEST_KINDS, chromeSlots, type Sheet, type ChromePiece, type Quest, type Bounty, type NpcRel, type StatusFx,
  } from '../../lib/persona';
  let sub = $state<'sheet' | 'chrome' | 'log'>('sheet'), msg = $state('');
  let sheet = $state<Sheet | null>(null), chrome = $state<ChromePiece[]>([]);
  let quests = $state<Quest[]>([]), bounties = $state<Bounty[]>([]), rels = $state<NpcRel[]>([]);
  let edC = $state<ChromePiece | null>(null), edQ = $state<Quest | null>(null), edB = $state<Bounty | null>(null), edR = $state<NpcRel | null>(null);
  let fxn = $state(''), fxd = $state(''), fxk = $state<StatusFx['kind']>('cond');
  const u = $derived(dm.users.find((x) => x.uid === dm.pid));
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 2800); };
  const everyone = () => dm.users.map((x) => x.uid);
  onMount(() => {
    const c = watchQuests(null, (xs) => (quests = xs));
    const d = watchBounties(null, (xs) => (bounties = xs));
    const e = watchRels(null, (xs) => (rels = xs));
    return () => { c(); d(); e(); };
  });
  $effect(() => {
    const id = dm.pid;
    if (!id || !dm.loaded) return;
    let stop1 = () => {}, stop2 = () => {};
    const lv = dm.users.find((x) => x.uid === id)?.character?.level ?? 1;
    ensureSheet(id, lv).then((s) => (sheet = s)).catch(() => {});
    stop1 = watchSheet(id, (s) => { if (s) sheet = s; });
    stop2 = watchChrome(id, (xs) => (chrome = xs));
    return () => { stop1(); stop2(); };
  });
  async function putSheet(p: Partial<Sheet>) { if (!dm.pid || !sheet) return; await saveSheet(dm.pid, p); flash('Kaydedildi.'); sfx.granted(); }
  async function addFx() { if (!sheet || !fxn.trim()) return; const s: StatusFx = { id: nid(), name: fxn.trim(), desc: fxd, kind: fxk, at: now() }; await putSheet({ status: [...(sheet.status ?? []), s] }); fxn = ''; fxd = ''; }
  async function rst() { if (!u || !(await ask('Statlar sıfırlansın mı?', 'Tüm statlar 0 olur, oyuncu puanlarını yeniden dağıtır.', 'Sıfırla'))) return; await resetStats(u.uid, u.character?.level ?? 1); sfx.granted(); flash('Statlar sıfırlandı.'); }
  function pickImg(into: { img?: string }, ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0]; if (!f) return;
    const im = new Image();
    im.onload = () => { const cv = document.createElement('canvas'), s = Math.min(1, 200 / Math.max(im.width, im.height)); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); cv.getContext('2d')!.drawImage(im, 0, 0, cv.width, cv.height); into.img = cv.toDataURL('image/webp', 0.74); edC = edC ? { ...edC } : edC; };
    im.src = URL.createObjectURL(f);
  }
</script>
<div class="pp">
  <div class="side"><PlayerPick /><div class="sub">{#each [['sheet','Kağıt'],['chrome','Krom'],['log','Günlük']] as [k,l]}<button class:on={sub===k} onclick={() => (sub = k as typeof sub)}>{l}</button>{/each}</div></div>
  <div class="mn">
    {#if !u}<p class="none">Oyuncu seç.</p>
    {:else if sub === 'sheet' && sheet}
      <h4 class="mono">{u.character?.name} · SEVİYE {u.character?.level}</h4>
      <div class="row">
        <label class="field"><span>Can (mevcut)</span><input class="inp" type="number" value={sheet.hp} onchange={(e) => putSheet({ hp: +(e.currentTarget as HTMLInputElement).value })} /></label>
        <label class="field"><span>Zırh düzeltmesi</span><input class="inp" type="number" value={sheet.armor} onchange={(e) => putSheet({ armor: +(e.currentTarget as HTMLInputElement).value })} /></label>
        <label class="field"><span>Kopuş 0–10</span><input class="inp" type="number" min="0" max="10" value={sheet.kopus} onchange={(e) => putSheet({ kopus: Math.max(0, Math.min(10, +(e.currentTarget as HTMLInputElement).value)) })} /></label>
        <label class="field"><span>Harcanmamış puan</span><input class="inp" type="number" min="0" value={sheet.unspent} onchange={(e) => putSheet({ unspent: Math.max(0, +(e.currentTarget as HTMLInputElement).value) })} /></label>
      </div>
      <div class="row"><button class="btn red small" onclick={rst}>Statları sıfırla (yeniden dağıtım)</button></div>
      <h4 class="mono">DURUM ETKİLERİ</h4>
      {#each sheet.status ?? [] as s (s.id)}
        <div class="it"><b>{s.name}</b> <em>{s.kind}</em> <span>{s.desc}</span> <button class="btn ghost small" onclick={() => putSheet({ status: sheet!.status.filter((x) => x.id !== s.id) })}>Kaldır</button></div>
      {/each}
      <div class="row">
        <input class="inp" placeholder="Ad" bind:value={fxn} />
        <input class="inp" placeholder="Açıklama" bind:value={fxd} />
        <select class="inp" bind:value={fxk}><option value="buff">Olumlu</option><option value="debuff">Olumsuz</option><option value="cond">Durum</option></select>
        <button class="btn small" onclick={addFx}>Ekle</button>
      </div>
      <h4 class="mono">İTİBAR (−100…100)</h4>
      <div class="reps">{#each FACTIONS.filter((f) => f.id !== 'none') as f (f.id)}
        <label class="field"><span>{f.label}</span><input class="inp" type="number" value={sheet.reps[f.id] ?? 0} onchange={(e) => putSheet({ reps: { ...sheet!.reps, [f.id]: +(e.currentTarget as HTMLInputElement).value } })} /></label>
      {/each}</div>
      <h4 class="mono">ARANMA (0–5)</h4>
      <div class="reps">{#each FACTIONS.filter((f) => f.id !== 'none') as f (f.id)}
        <label class="field"><span>{f.label}</span><input class="inp" type="number" min="0" max="5" value={sheet.wanted[f.id] ?? 0} onchange={(e) => putSheet({ wanted: { ...sheet!.wanted, [f.id]: +(e.currentTarget as HTMLInputElement).value } })} /></label>
      {/each}</div>
    {:else if sub === 'chrome'}
      <p class="nt">Çip: {CHROME_TIERS.find((t) => t.id === String(u?.character?.chrome ?? '0'))?.label} · yuva {chrome.length}/{chromeSlots(String(u?.character?.chrome ?? '0'))}. Çip yoksa oyuncu sekmesi kilitli kalır.</p>
      {#if edC}
        <label class="field"><span>Ad</span><input class="inp" bind:value={edC.name} /></label>
        <label class="field"><span>Yuva</span><select class="inp" bind:value={edC.slot}>{#each CHROME_SLOTS as s}<option value={s.id}>{s.label}</option>{/each}</select></label>
        <label class="field"><span>İstatistik / etki</span><input class="inp" bind:value={edC.stats} /></label>
        <label class="field"><span>Açıklama</span><textarea class="inp" rows="3" bind:value={edC.desc}></textarea></label>
        <label class="btn ghost small up">Görsel<input type="file" accept="image/*" hidden onchange={(e) => pickImg(edC!, e)} /></label>
        <div class="row"><button class="btn" onclick={async () => { if (!dm.pid || !edC?.name.trim()) return; await saveChrome(dm.pid, { ...edC, at: Date.now() }); edC = null; sfx.granted(); }}>Kaydet</button><button class="btn ghost" onclick={() => (edC = null)}>Vazgeç</button></div>
      {:else}
        <button class="btn" onclick={() => (edC = { id: nid(), slot: 'arms', name: '', desc: '', at: Date.now() })}>+ Krom tak</button>
        {#each chrome as c (c.id)}
          <div class="it"><b>{c.name}</b> <em>{CHROME_SLOTS.find((s) => s.id === c.slot)?.label}</em>
            <button class="btn ghost small" onclick={() => (edC = { ...c })}>Düzenle</button>
            <button class="btn red small" onclick={() => dropChrome(dm.pid, c.id)}>Kaldır</button></div>
        {/each}
      {/if}
    {:else}
      <h4 class="mono">GÖREVLER</h4>
      {#if edQ}
        <select class="inp" bind:value={edQ.kind}>{#each QUEST_KINDS as k}<option value={k.id}>{k.label}</option>{/each}</select>
        <input class="inp" placeholder="Başlık" bind:value={edQ.title} />
        <textarea class="inp" rows="3" bind:value={edQ.body}></textarea>
        <select class="inp" bind:value={edQ.status}><option value="open">Açık</option><option value="done">Tamam</option><option value="failed">Başarısız</option></select>
        <select class="inp" bind:value={edQ.faction}><option value="">Hizip yok</option>{#each FACTIONS as f}<option value={f.id}>{f.label}</option>{/each}</select>
        {#each dm.users as p (p.uid)}<label class="ck"><input type="checkbox" checked={edQ.players.includes(p.uid)} onchange={(e) => edQ && (edQ.players = (e.currentTarget as HTMLInputElement).checked ? [...edQ.players, p.uid] : edQ.players.filter((x) => x !== p.uid))} />{pname(p.uid)}</label>{/each}
        <div class="row"><button class="btn" onclick={async () => { await saveQuest({ ...edQ!, at: Date.now() }); edQ = null; sfx.granted(); }}>Kaydet</button><button class="btn ghost" onclick={() => (edQ = null)}>Vazgeç</button></div>
      {:else}
        <button class="btn" onclick={() => (edQ = { id: nid(), kind: 'main', title: '', body: '', status: 'open', players: dm.pid ? [dm.pid] : [], at: Date.now() })}>+ Görev</button>
        {#each quests as q (q.id)}<div class="it"><b>{q.title}</b> <em>{q.kind} · {q.status}</em> <button class="btn ghost small" onclick={() => (edQ = { ...q, players: [...q.players] })}>Düzenle</button> <button class="btn red small" onclick={() => dropQuest(q.id)}>Sil</button></div>{/each}
      {/if}
      <h4 class="mono">ÖDÜLLER</h4>
      {#if edB}
        <input class="inp" placeholder="Hedef" bind:value={edB.name} />
        <input class="inp" placeholder="Koyan" bind:value={edB.by} />
        <input class="inp" placeholder="Miktar (ör. 5000 BK)" bind:value={edB.amount} />
        <textarea class="inp" rows="2" bind:value={edB.note}></textarea>
        {#each dm.users as p (p.uid)}<label class="ck"><input type="checkbox" checked={edB.players.includes(p.uid)} onchange={(e) => edB && (edB.players = (e.currentTarget as HTMLInputElement).checked ? [...edB.players, p.uid] : edB.players.filter((x) => x !== p.uid))} />{pname(p.uid)}</label>{/each}
        <div class="row"><button class="btn" onclick={async () => { await saveBounty({ ...edB!, at: Date.now() }); edB = null; sfx.granted(); }}>Kaydet</button><button class="btn ghost" onclick={() => (edB = null)}>Vazgeç</button></div>
      {:else}
        <button class="btn" onclick={() => (edB = { id: nid(), name: '', by: '', amount: '', players: dm.pid ? [dm.pid] : [], at: Date.now() })}>+ Ödül</button>
        {#each bounties as b (b.id)}<div class="it"><b>{b.name}</b> {b.amount} <button class="btn ghost small" onclick={() => (edB = { ...b, players: [...b.players] })}>Düzenle</button> <button class="btn red small" onclick={() => dropBounty(b.id)}>Sil</button></div>{/each}
      {/if}
      <h4 class="mono">NPC İLİŞKİLERİ</h4>
      {#if edR}
        <input class="inp" placeholder="Ad" bind:value={edR.name} />
        <input class="inp" type="number" bind:value={edR.score} />
        <textarea class="inp" rows="2" bind:value={edR.note}></textarea>
        {#each dm.users as p (p.uid)}<label class="ck"><input type="checkbox" checked={edR.players.includes(p.uid)} onchange={(e) => edR && (edR.players = (e.currentTarget as HTMLInputElement).checked ? [...edR.players, p.uid] : edR.players.filter((x) => x !== p.uid))} />{pname(p.uid)}</label>{/each}
        <div class="row"><button class="btn" onclick={async () => { await saveRel({ ...edR!, at: Date.now() }); edR = null; sfx.granted(); }}>Kaydet</button><button class="btn ghost" onclick={() => (edR = null)}>Vazgeç</button></div>
      {:else}
        <button class="btn" onclick={() => (edR = { id: nid(), name: '', score: 0, note: '', players: dm.pid ? [dm.pid] : [], at: Date.now() })}>+ İlişki</button>
        {#each rels as r (r.id)}<div class="it"><b>{r.name}</b> {r.score} <button class="btn ghost small" onclick={() => (edR = { ...r, players: [...r.players] })}>Düzenle</button> <button class="btn red small" onclick={() => dropRel(r.id)}>Sil</button></div>{/each}
      {/if}
    {/if}
    {#if msg}<p class="msg mono">{msg}</p>{/if}
  </div>
</div>
<style>
  .pp{display:grid;grid-template-columns:220px 1fr;height:100%;min-height:0}
  .side{border-right:1px solid var(--line);overflow:auto}.mn{overflow:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px}
  .sub{display:flex;flex-direction:column;border-top:1px solid var(--line)}
  .sub button{background:none;border:0;border-left:2px solid transparent;color:var(--tx);text-align:left;padding:8px 12px;font:inherit}.sub button.on{border-left-color:var(--rd);color:#fff;background:rgba(255,42,85,.1)}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.reps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:10px 0 4px}
  .it{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);padding:6px 8px}.it em{color:var(--mut);font-style:normal;font-size:12px}
  .ck{display:flex;gap:6px;align-items:center;font-size:13px}.nt{color:var(--mut);font-size:13px}.msg{color:#39ff8a}.none{padding:16px;color:var(--mut)}
  .up{position:relative}
</style>
