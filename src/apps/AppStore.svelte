<script lang="ts">
  import { session } from '../lib/session.svelte';
  import { backend } from '../lib/backend';
  import { ask } from '../lib/confirm.svelte';
  import { removeAllNotes, loadNotes } from '../lib/notes.svelte';
  import { closeAppWins } from '../desktop/wm.svelte';
  import { sfx } from '../lib/sfx';
  import { ICONS } from '../desktop/icons';
  const user = session.user!;
  import { APPS } from '../desktop/apps';
  const store = APPS.filter((a) => a.optional);
  let busy = $state<Record<string, number>>({}), phase = $state<Record<string, string>>({});
  const has = (id: string) => (user.apps ?? []).includes(id);
  async function setApps(a: string[]) { user.apps = a; await backend.patchProfile(user.uid, { apps: a }).catch(() => {}); }
  async function install(id: string) {
    phase[id] = 'KURULUYOR'; sfx.click();
    for (let i = 0; i <= 20; i++) { busy[id] = i * 5; await new Promise((r) => setTimeout(r, 55)); }
    await setApps([...(user.apps ?? []).filter((x) => x !== id), id]); if (id === 'notepad') await loadNotes(); busy[id] = 0; phase[id] = ''; sfx.granted();
  }
  async function uninstall(id: string) {
    const t = APPS.find((a) => a.id === id)!.title;
    const ok = id === 'notepad' ? await ask('Not Defteri kaldırılsın mı?', 'Uygulamayı kaldırırsan bütün notların kalıcı olarak silinir. Bu geri alınamaz.', 'Kaldır ve sil')
      : await ask(t + ' kaldırılsın mı?', 'Uygulama masaüstünden kalkar. Verilerin hesabında kalır; yeniden kurunca geri gelir.', 'Kaldır');
    if (!ok) return;
    phase[id] = 'KALDIRILIYOR'; busy[id] = 50; closeAppWins(id);
    if (id === 'notepad') await removeAllNotes();
    await setApps((user.apps ?? []).filter((x) => x !== id)); busy[id] = 0; phase[id] = ''; sfx.close();
  }
</script>
<div class="st">
  <div class="hd"><div class="mono k">Q-MAĞAZA · HER ŞEY ÜCRETSİZ</div><h2>Uygulamalar</h2></div>
  {#each store as a (a.id)}
  <div class="card" class:on={has(a.id)} class:ghos={a.id === 'ghos'}>
    <div class="ic">{@html ICONS[a.icon]}</div>
    <div class="tx"><b>{a.title}{#if a.id === 'ghos'}<em class="mono">KAYIT DIŞI</em>{/if}</b><span>{a.desc}</span>
      {#if busy[a.id]}<div class="pb"><i style:width="{busy[a.id]}%"></i></div><small class="mono">{phase[a.id]}… {busy[a.id]}%</small>{/if}</div>
    {#if has(a.id)}<button class="btn red" disabled={!!busy[a.id]} onclick={() => uninstall(a.id)}>Kaldır</button>{:else}<button class="btn" disabled={!!busy[a.id]} onclick={() => install(a.id)}>Kur</button>{/if}
  </div>
  {/each}
  <div class="mono soon">Yeni uygulamalar ileride eklenecek.</div>
</div>
<style>
  .st{padding:22px 24px;display:flex;flex-direction:column;gap:12px;overflow:auto;height:100%}
  .k{font-size:10.5px;letter-spacing:.3em;color:var(--cy)}h2{font-family:var(--f-disp);font-size:24px;letter-spacing:.12em;color:var(--ye);margin-top:4px}
  .card{display:flex;gap:16px;align-items:center;padding:16px;border:1px solid var(--line);background:linear-gradient(90deg,rgba(0,240,255,.06),transparent)}
  .card.on{border-color:rgba(252,238,10,.4)}
  .ic{width:56px;height:56px;flex:none}.ic :global(svg){width:100%;height:100%}.tx{flex:1;display:flex;flex-direction:column;gap:4px}.tx b{font-size:18px}.tx span{color:var(--mut)}
  .pb{height:4px;background:rgba(255,255,255,.08);margin-top:6px}.pb i{display:block;height:100%;background:var(--cy);box-shadow:0 0 8px var(--cy);transition:width .05s}
  small{font-size:10.5px;color:var(--cy);letter-spacing:.2em}
  .card.ghos{border-color:rgba(57,255,138,.35);background:linear-gradient(90deg,rgba(57,255,138,.07),transparent);font-family:var(--f-mono)}
  .tx em{font-style:normal;font-size:9.5px;letter-spacing:.25em;color:#000;background:#39ff8a;padding:2px 6px;margin-left:8px;vertical-align:middle}
  .soon{font-size:12px;color:var(--mut)}
</style>
