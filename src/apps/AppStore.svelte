<script lang="ts">
  import { session } from '../lib/session.svelte';
  import { backend } from '../lib/backend';
  import { ask } from '../lib/confirm.svelte';
  import { removeAllNotes, loadNotes } from '../lib/notes.svelte';
  import { closeAppWins } from '../desktop/wm.svelte';
  import { sfx } from '../lib/sfx';
  import { ICONS } from '../desktop/icons';
  const user = session.user!;
  let busy = $state(0), phase = $state('');
  const installed = $derived((user.apps ?? []).includes('notepad'));
  async function setApps(a: string[]) { user.apps = a; await backend.patchProfile(user.uid, { apps: a }).catch(() => {}); }
  async function install() {
    phase = 'KURULUYOR'; sfx.click();
    for (let i = 0; i <= 20; i++) { busy = i * 5; await new Promise((r) => setTimeout(r, 55)); }
    await setApps([...(user.apps ?? []), 'notepad']); await loadNotes(); busy = 0; phase = ''; sfx.granted();
  }
  async function uninstall() {
    const ok = await ask('Not Defteri kaldırılsın mı?', 'Uygulamayı kaldırırsan bütün notların kalıcı olarak silinir. Bu geri alınamaz.', 'Kaldır ve sil');
    if (!ok) return;
    phase = 'KALDIRILIYOR'; busy = 50; closeAppWins('notepad');
    await removeAllNotes(); await setApps((user.apps ?? []).filter((x) => x !== 'notepad')); busy = 0; phase = ''; sfx.close();
  }
</script>
<div class="st">
  <div class="hd"><div class="mono k">Q-MAĞAZA · HER ŞEY ÜCRETSİZ</div><h2>Uygulamalar</h2></div>
  <div class="card" class:on={installed}>
    <div class="ic">{@html ICONS.notepad}</div>
    <div class="tx"><b>Not Defteri</b><span>Masaüstüne sağ tıkla, yeni not aç. Notların hesabına kayıtlı kalır; istediğin kadar not tutabilirsin.</span>
      {#if busy}<div class="pb"><i style:width="{busy}%"></i></div><small class="mono">{phase}… {busy}%</small>{/if}</div>
    {#if installed}<button class="btn red" disabled={!!busy} onclick={uninstall}>Kaldır</button>{:else}<button class="btn" disabled={!!busy} onclick={install}>Kur</button>{/if}
  </div>
  <div class="mono soon">Yeni uygulamalar ileride eklenecek.</div>
</div>
<style>
  .st{padding:22px 24px;display:flex;flex-direction:column;gap:16px}
  .k{font-size:10.5px;letter-spacing:.3em;color:var(--cy)}h2{font-family:var(--f-disp);font-size:24px;letter-spacing:.12em;color:var(--ye);margin-top:4px}
  .card{display:flex;gap:16px;align-items:center;padding:16px;border:1px solid var(--line);background:linear-gradient(90deg,rgba(0,240,255,.06),transparent)}
  .card.on{border-color:rgba(252,238,10,.4)}
  .ic{width:56px;height:56px;flex:none}.ic :global(svg){width:100%;height:100%}.tx{flex:1;display:flex;flex-direction:column;gap:4px}.tx b{font-size:18px}.tx span{color:var(--mut)}
  .pb{height:4px;background:rgba(255,255,255,.08);margin-top:6px}.pb i{display:block;height:100%;background:var(--cy);box-shadow:0 0 8px var(--cy);transition:width .05s}
  small{font-size:10.5px;color:var(--cy);letter-spacing:.2em}
  .soon{font-size:12px;color:var(--mut)}
</style>
