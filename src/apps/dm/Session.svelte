<script lang="ts">
  // Oturum sayacı + sıradaki oturum tarihi (İstanbul saati), not ve hatırlatıcı anahtarı.
  import { sess, saveSess, fromIst, toIst, fmtIst, rel } from '../../lib/sess.svelte';
  import { sfx } from '../../lib/sfx';
  let when = $state(sess.at ? toIst(sess.at) : ''), note = $state(sess.note), msg = $state(''), synced = false;
  $effect(() => { if (sess.ready && !synced) { synced = true; when = sess.at ? toIst(sess.at) : ''; note = sess.note; } });
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 3500); };
  async function put(p: Parameters<typeof saveSess>[0], m: string) { try { await saveSess(p); sfx.granted(); flash(m); } catch (e) { sfx.error(); flash('Hata: ' + String(e)); } }
  const step = (d: number) => put({ n: Math.max(0, sess.n + d) }, `Oturum ${Math.max(0, sess.n + d)}`);
  function saveNext() {
    const at = when ? fromIst(when) : null; if (when && at === null) return flash('Tarih okunamadı.');
    put({ at, note: note.trim().slice(0, 400) }, at ? 'Sıradaki oturum: ' + fmtIst(at) : 'Tarih temizlendi.');
  }
</script>
<div class="se">
  <section>
    <h4 class="mono">OTURUM SAYACI</h4>
    <div class="ctr"><button class="btn ghost" onclick={() => step(-1)} disabled={sess.n <= 0} aria-label="Azalt">−</button><b>{sess.n}</b><button class="btn" onclick={() => step(1)} aria-label="Arttır">+</button></div>
    <p class="nt">Herkesin görev çubuğunda saatin yanında <span class="mono">OTURUM {sess.n}</span> olarak anında görünür.</p>
  </section>
  <section>
    <h4 class="mono">SIRADAKİ OTURUM</h4>
    <label class="field"><span>Tarih ve saat (İstanbul)</span><input class="inp" type="datetime-local" bind:value={when} /></label>
    <label class="field"><span>Oturum notu (isteğe bağlı)</span><textarea class="inp" rows="3" maxlength="400" bind:value={note} placeholder="Örn. Karakter kâğıtlarını güncelleyin."></textarea></label>
    <div class="row"><button class="btn" onclick={saveNext}>Kaydet</button>{#if sess.at}<button class="btn ghost small" onclick={() => { when = ''; put({ at: null }, 'Tarih temizlendi.'); }}>Tarihi temizle</button>{/if}</div>
    {#if sess.at}<p class="cur"><b>{fmtIst(sess.at)}</b> · {rel(sess.at)}</p>{/if}
    <label class="sw"><input type="checkbox" checked={sess.remind} onchange={(e) => put({ remind: (e.target as HTMLInputElement).checked }, (e.target as HTMLInputElement).checked ? 'Hatırlatıcı açık' : 'Hatırlatıcı kapalı')} /><span></span>Oyunculara hatırlatıcı göster</label>
    <p class="nt">Hatırlatıcı oyuncunun masaüstünün sağ altında küçük bir bildirim olarak çıkar. Oturum yaklaştıkça daha sık görünür. 3 günden uzaksa günde bir, 1–3 gün kala her girişte, son 3 saatte bir kez daha.</p>
    {#if msg}<p class="msg mono">{msg}</p>{/if}
  </section>
</div>
<style>
  .se{display:grid;grid-template-columns:300px minmax(0,460px);gap:22px;padding:14px 18px;overflow:auto;height:100%}
  section{display:flex;flex-direction:column;gap:10px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:4px 0 2px}
  .ctr{display:flex;align-items:center;gap:16px}.ctr b{font-family:var(--f-disp);font-size:54px;color:#fff;min-width:80px;text-align:center;text-shadow:0 0 18px rgba(0,240,255,.5)}
  .ctr .btn{width:46px;height:46px;font-size:22px;padding:0}
  .row{display:flex;gap:8px;align-items:center}
  textarea.inp{resize:vertical;font-family:var(--f-ui)}
  .cur{margin:0;font-size:14px;color:#cfe}.cur b{color:#fff;text-transform:capitalize}
  .nt{font-size:12px;color:var(--mut);margin:0;line-height:1.5}.msg{font-size:11.5px;color:#39ff8a;margin:0}
  .sw{display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer}
  .sw input{display:none}.sw span{width:30px;height:16px;border:1px solid var(--line);position:relative;flex:none;transition:.2s}.sw span::after{content:'';position:absolute;left:2px;top:2px;width:10px;height:10px;background:var(--mut);transition:.2s}
  .sw input:checked+span{border-color:var(--cy);background:rgba(0,240,255,.15)}.sw input:checked+span::after{left:16px;background:var(--cy);box-shadow:0 0 6px var(--cy)}
</style>
