<script lang="ts">
  import { notes, updateNote, removeNote, createNote, loadNotes } from '../lib/notes.svelte';
  import { ask } from '../lib/confirm.svelte';
  import { closeWin, openApp, type Win } from '../desktop/wm.svelte';
  import { sfx } from '../lib/sfx';
  let { arg, win }: { arg?: string; win: Win } = $props();
  const n = $derived(notes.list.find((x) => x.id === arg));
  $effect(() => { if (win) win.title = n?.title || (arg ? '' : 'Notlar'); });
  if (!notes.loaded) loadNotes();
  async function del() {
    if (!n) return;
    if (await ask('Not silinsin mi?', `"${n.title || 'Adsız not'}" kalıcı olarak silinecek.`, 'Sil')) { await removeNote(n.id); closeWin(win.id); sfx.close(); }
  }
  async function fresh() { const id = await createNote(18 + 104 * 2, 18 + 112 * 4); openApp('notepad', id); }
  const fmt = (t: number) => new Date(t).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
</script>
{#if arg && n}
  <div class="np">
    <input class="title" value={n.title} placeholder="Başlık" oninput={(e) => updateNote(n.id, { title: (e.target as HTMLInputElement).value })} />
    <textarea value={n.body} placeholder="Yazmaya başla…" spellcheck="false" oninput={(e) => updateNote(n.id, { body: (e.target as HTMLTextAreaElement).value })}></textarea>
    <div class="ft mono"><span>{n.body.length} karakter · {fmt(n.updatedAt)} · otomatik kayıt</span><button class="btn red sm" onclick={del}>Sil</button></div>
  </div>
{:else if arg}
  <div class="empty mono">NOT BULUNAMADI</div>
{:else}
  <div class="all">
    <button class="btn" onclick={fresh}>+ Yeni not</button>
    {#each [...notes.list].sort((a, b) => b.updatedAt - a.updatedAt) as x (x.id)}
      <button class="it" onclick={() => openApp('notepad', x.id)}><b>{x.title || 'Adsız not'}</b><small>{x.body.slice(0, 80)}</small></button>
    {:else}<div class="empty mono">HENÜZ NOT YOK · MASAÜSTÜNE SAĞ TIKLA</div>{/each}
  </div>
{/if}
<style>
  .np{position:absolute;inset:0;display:flex;flex-direction:column}
  .title{background:rgba(252,238,10,.04);border:0;border-bottom:1px solid var(--line);color:var(--ye);font-family:var(--f-disp);font-size:17px;letter-spacing:.06em;padding:12px 16px;outline:0}
  textarea{flex:1;resize:none;background:repeating-linear-gradient(transparent 0 27px,rgba(0,240,255,.07) 27px 28px);border:0;outline:0;color:#e6f2ff;
    font-family:var(--f-mono);font-size:14.5px;line-height:28px;padding:4px 16px}
  .ft{display:flex;align-items:center;justify-content:space-between;padding:6px 10px 6px 16px;border-top:1px solid var(--line);font-size:10.5px;color:var(--mut);letter-spacing:.1em}
  .sm{padding:5px 14px;font-size:12px}
  .all{padding:16px;display:flex;flex-direction:column;gap:8px}
  .it{display:flex;flex-direction:column;gap:2px;text-align:left;padding:10px 12px;background:rgba(0,240,255,.04);border:1px solid var(--line);color:var(--tx)}
  .it:hover{border-color:var(--cy)}.it small{color:var(--mut)}
  .empty{padding:30px;text-align:center;color:var(--mut);font-size:11px;letter-spacing:.25em}
</style>
