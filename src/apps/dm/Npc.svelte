<script lang="ts">
  // ghOS-Net NPC kimlikleri + NPC olarak yazışma + tüm konuşmaları izleme (DM her şeyi görür).
  import { onMount, tick } from 'svelte';
  import { dm, pname } from './store.svelte';
  import { ghos } from '../../lib/ghos.svelte';
  import { saveNpc, deleteNpc, ensureConv, sendMsg, watchMsgs, markRead, unreadFor, convId, nid, isOnline, type Npc, type Msg } from '../../lib/live';
  import { ask } from '../../lib/confirm.svelte';
  import { sfx } from '../../lib/sfx';
  let sel = $state(''), ed = $state<Npc | null>(null), peer = $state(''), cid = $state(''), msgs = $state<Msg[]>([]), text = $state(''), box: HTMLDivElement | undefined = $state(), spy = $state(''), msg = $state('');
  const npc = $derived(ghos.npcs.find((n) => n.id === sel));
  const me = $derived(sel ? 'npc:' + sel : '');
  const convsOf = $derived(ghos.convs.filter((c) => c.npc === sel));
  const pp = $derived(ghos.convs.filter((c) => !c.npc));
  $effect(() => { if (!sel && ghos.npcs[0]) sel = ghos.npcs[0].id; });
  $effect(() => { const id = cid; if (!id) { msgs = []; return; } return watchMsgs(id, async (m) => { msgs = m; await tick(); box?.scrollTo({ top: box.scrollHeight }); }); });
  $effect(() => { const c = ghos.convs.find((x) => x.id === cid); if (c && me && c.npc && unreadFor(c, me)) markRead(cid, me); });
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 3500); };
  const blank = (): Npc => ({ id: nid(), name: '', avatar: '', style: '', bio: '', color: '#39ff8a' });
  async function save() { if (!ed || !ed.name.trim()) return; try { await saveNpc({ ...ed, name: ed.name.trim() }); sel = ed.id; ed = null; sfx.granted(); flash('NPC kaydedildi.'); } catch (e) { sfx.error(); flash('Hata: ' + String(e)); } }
  async function del(n: Npc) { if (await ask('NPC silinsin mi?', `“${n.name}” kimliği silinecek. Eski konuşmalar kalır.`, 'Sil')) { await deleteNpc(n.id); if (sel === n.id) sel = ''; } }
  async function avatar(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f || !ed) return;
    const im = new Image(); im.src = URL.createObjectURL(f); await im.decode().catch(() => {});
    const c = document.createElement('canvas'); c.width = c.height = 96; const k = Math.max(96 / im.naturalWidth, 96 / im.naturalHeight);
    c.getContext('2d')!.drawImage(im, (96 - im.naturalWidth * k) / 2, (96 - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
    ed.avatar = c.toDataURL('image/jpeg', 0.8); URL.revokeObjectURL(im.src);
  }
  async function openWith(uid: string) {
    if (!npc) return; peer = uid; spy = '';
    cid = await ensureConv(me, uid, { [me]: npc.name, [uid]: dm.users.find((u) => u.uid === uid)?.character?.name || pname(uid) }, sel).catch(() => convId(me, uid));
  }
  async function send() { if (!cid || !text.trim()) return; const t = text; text = ''; try { await sendMsg(cid, me, t); sfx.click(); } catch (e) { text = t; sfx.error(); flash('Gönderilemedi: ' + String(e)); } }
  const nm = (id: string) => id.startsWith('npc:') ? ghos.npcs.find((n) => 'npc:' + n.id === id)?.name ?? 'NPC' : pname(id);
</script>
<div class="np">
  <div class="ids">
    <h4 class="mono">KİMLİKLER <button class="lk" onclick={() => (ed = blank())}>+ yeni</button></h4>
    {#each ghos.npcs as n (n.id)}
      <button class="id" class:on={sel === n.id} onclick={() => { sel = n.id; cid = ''; spy = ''; }} style:--c={n.color}>
        <span class="av">{#if n.avatar}<img src={n.avatar} alt="" data-nolb />{:else}{n.name.slice(0, 1)}{/if}</span><span class="t">{n.name}<small>{n.style}</small></span>
        {#if ghos.convs.some((c) => c.npc === n.id && unreadFor(c, 'npc:' + n.id))}<i class="ur"></i>{/if}
      </button>
    {:else}<p class="none">Henüz NPC yok.</p>{/each}
    <h4 class="mono">OYUNCU ↔ OYUNCU ({pp.length})</h4>
    {#each pp as c (c.id)}<button class="cv" class:on={spy === c.id} onclick={() => { spy = c.id; cid = c.id; }}>{c.members.map(nm).join(' ↔ ')}<small>{c.last?.text?.slice(0, 40) ?? ''}</small></button>{:else}<p class="none">Yok.</p>{/each}
  </div>
  {#if ed}
    <div class="ed">
      <h4 class="mono">{ghos.npcs.some((n) => n.id === ed!.id) ? 'NPC DÜZENLE' : 'YENİ NPC'}</h4>
      <div class="row"><span class="av big" style:--c={ed.color}>{#if ed.avatar}<img src={ed.avatar} alt="" data-nolb />{/if}</span><label class="btn ghost small">Avatar yükle<input type="file" accept="image/*" hidden onchange={avatar} /></label>{#if ed.avatar}<button class="lk" onclick={() => ed && (ed.avatar = '')}>kaldır</button>{/if}</div>
      <label class="field"><span>Görünen ad</span><input class="inp" bind:value={ed.name} maxlength="40" placeholder="ör. Kuzgun" /></label>
      <label class="field"><span>Üslup / etiket (oyuncu görür)</span><input class="inp" bind:value={ed.style} maxlength="60" placeholder="ör. bilgi simsarı · kısa, alaycı" /></label>
      <label class="field"><span>Kısa tanıtım (oyuncu görür)</span><input class="inp" bind:value={ed.bio} maxlength="140" /></label>
      <label class="field"><span>Renk</span><input type="color" bind:value={ed.color} /></label>
      <div class="row"><button class="btn" disabled={!ed.name.trim()} onclick={save}>Kaydet</button><button class="btn ghost small" onclick={() => (ed = null)}>Vazgeç</button></div>
    </div>
  {:else}
  <div class="pl">
    {#if npc}
      <div class="nh" style:--c={npc.color}><b>{npc.name}</b><small>{npc.style}</small><button class="lk" onclick={() => (ed = { ...npc })}>düzenle</button><button class="lk red" onclick={() => del(npc)}>sil</button></div>
      <h4 class="mono">KİMİNLE YAZIŞ</h4>
      {#each dm.users as u (u.uid)}{@const c = convsOf.find((x) => x.members.includes(u.uid))}
        <button class="cv" class:on={peer === u.uid && !!cid && !spy} onclick={() => openWith(u.uid)}><i class:on={isOnline(dm.pres.find((p) => p.uid === u.uid))}></i>{pname(u.uid)}{#if c && unreadFor(c, me)}<em>YENİ</em>{/if}<small>{c?.last ? (c.last.from === me ? 'sen: ' : '') + c.last.text.slice(0, 36) : 'konuşma yok'}</small></button>
      {/each}
    {/if}
    {#if msg}<p class="msg mono">{msg}</p>{/if}
  </div>
  <div class="ch">
    {#if cid}
      <div class="chh mono">{spy ? 'İZLEME · ' + (ghos.convs.find((c) => c.id === spy)?.members.map(nm).join(' ↔ ') ?? '') : npc?.name + ' → ' + pname(peer)}</div>
      <div class="ms" bind:this={box}>
        {#each msgs as m (m.id)}<div class="m" class:mine={m.from === me}><small>{nm(m.from)} · {new Date(m.at).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</small><p>{m.text}</p></div>{:else}<div class="none">Mesaj yok.</div>{/each}
      </div>
      {#if !spy}<form class="in" onsubmit={(e) => { e.preventDefault(); send(); }}><textarea class="inp" rows="2" bind:value={text} maxlength="2000" placeholder="{npc?.name} olarak yaz…" onkeydown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}></textarea><button class="btn" disabled={!text.trim()}>Gönder</button></form>{:else}<p class="nt mono">Salt okunur izleme · oyuncular bu konuşmanın izlendiğini görmez.</p>{/if}
    {:else}<div class="none c">Bir oyuncu ya da konuşma seç.</div>{/if}
  </div>
  {/if}
</div>
<style>
  .np{display:grid;grid-template-columns:250px 280px 1fr;height:100%;min-height:0}
  .ids,.pl{border-right:1px solid var(--line);overflow:auto;padding:10px}
  h4{font-size:10.5px;letter-spacing:.25em;color:#39ff8a;margin:6px 0 6px;display:flex;gap:10px;align-items:center}
  .lk{background:none;border:0;color:var(--cy);font-size:11.5px;text-decoration:underline;padding:0}.lk.red{color:var(--rd)}
  .id,.cv{display:flex;align-items:center;gap:9px;width:100%;background:none;border:1px solid transparent;color:var(--tx);text-align:left;font:inherit;padding:6px;position:relative;flex-wrap:wrap}
  .id:hover,.cv:hover{background:rgba(57,255,138,.06)}.id.on,.cv.on{border-color:rgba(57,255,138,.5);background:rgba(57,255,138,.08)}
  .av{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid var(--c);color:var(--c);font-family:var(--f-mono);overflow:hidden}.av img{width:100%;height:100%;object-fit:cover}.av.big{width:64px;height:64px}
  .t{display:flex;flex-direction:column;font-size:14.5px}.t small,.cv small{font-size:11px;color:var(--mut);flex-basis:100%}
  .ur{position:absolute;right:8px;top:50%;width:8px;height:8px;background:#ff2a8a;box-shadow:0 0 8px #ff2a8a}
  .cv{font-size:14px}.cv i{width:7px;height:7px;border-radius:50%;background:#3a4452}.cv i.on{background:#39ff8a}.cv em{font-style:normal;font-family:var(--f-mono);font-size:9.5px;color:#000;background:#ff2a8a;padding:0 4px;margin-left:auto}
  .ed{grid-column:2/4;display:flex;flex-direction:column;gap:8px;padding:12px 16px;max-width:520px;overflow:auto}
  .row{display:flex;gap:10px;align-items:center}
  .nh{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;border-left:3px solid var(--c);padding-left:8px;margin-bottom:6px}.nh b{font-size:17px;color:#fff}.nh small{font-size:12px;color:var(--mut);flex-basis:100%}
  .ch{display:flex;flex-direction:column;min-height:0;background:#020604;font-family:var(--f-mono)}
  .chh{font-size:11px;letter-spacing:.15em;color:#39ff8a;padding:8px 12px;border-bottom:1px solid #1f8f4d}
  .ms{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
  .m{max-width:78%;align-self:flex-start;border:1px solid #1f8f4d;padding:6px 9px}.m.mine{align-self:flex-end;border-color:rgba(255,42,138,.5)}
  .m small{font-size:9.5px;color:#1f8f4d}.m p{margin:2px 0 0;white-space:pre-wrap;word-break:break-word;font-size:13.5px;color:#e8fff0}
  .in{display:flex;gap:8px;padding:8px 12px;border-top:1px solid #1f8f4d}.in textarea{flex:1;resize:none}
  .none{color:var(--mut);font-size:12px;padding:8px}.none.c{margin:auto}.msg{font-size:11.5px;color:#39ff8a}.nt{font-size:10.5px;color:var(--mut);padding:8px 12px}
</style>
