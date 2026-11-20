<script lang="ts">
  // Not / işaret düzenleyici. Görünürlük anahtarı: herkese açık ya da özel (yalnız sen + DM).
  import { fly } from 'svelte/transition';
  import { NOTE_ICONS, NOTE_COLS, LABEL_MAX, TEXT_MAX, type MapNote } from './notes';
  let { note, where, isNew, onsave, ondelete, oncancel, dmSwitch }: {
    note: MapNote; where: string; isNew: boolean;
    onsave: (n: MapNote) => Promise<void>; ondelete?: () => void; oncancel: () => void; dmSwitch?: () => void;
  } = $props();
  let n = $state({ ...note }), busy = $state(false), err = $state('');
  let inp: HTMLInputElement | undefined = $state();
  $effect(() => { inp?.focus(); });
  async function save() {
    if (!n.label.trim()) { err = 'Başlık boş olamaz.'; inp?.focus(); return; }
    busy = true; err = '';
    try { await onsave({ ...n }); } catch (e) { err = 'Kaydedilemedi: ' + String((e as Error)?.message ?? e).slice(0, 120); }
    busy = false;
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); oncancel(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
  }
</script>

<div class="nf" role="dialog" aria-label="Not" tabindex="-1" onkeydown={key} style:--nc={n.col} transition:fly={{ y: -12, duration: 200 }}>
  <header>
    <span class="mono t">{isNew ? 'YENİ NOT' : 'NOTU DÜZENLE'}</span>
    {#if dmSwitch}<button class="sw mono" onclick={dmSwitch} title="DM işaretine geç">DM İŞARETİ ⇄</button>{/if}
    <button class="x" onclick={oncancel} aria-label="Kapat">✕</button>
  </header>
  <div class="loc mono">⌖ {where}</div>
  <div class="ic">{#each NOTE_ICONS as i (i.id)}<button class:on={n.icon === i.id} onclick={() => (n.icon = i.id)} title={i.l}><span>{i.g}</span><small class="mono">{i.l}</small></button>{/each}</div>
  <div class="row">
    <input bind:this={inp} class="inp" placeholder="Başlık" bind:value={n.label} maxlength={LABEL_MAX} />
    <div class="cols">{#each NOTE_COLS as c (c)}<button class:on={n.col === c} style:--c={c} onclick={() => (n.col = c)} aria-label={'Renk ' + c}></button>{/each}</div>
  </div>
  <textarea class="inp" rows="4" placeholder="Not (isteğe bağlı)…" bind:value={n.text} maxlength={TEXT_MAX}></textarea>
  <div class="cnt mono">{n.text.length}/{TEXT_MAX}</div>
  <div class="vis" role="radiogroup" aria-label="Görünürlük">
    <button role="radio" aria-checked={n.vis === 'pub'} class:on={n.vis === 'pub'} onclick={() => (n.vis = 'pub')}><b class="mono">◎ HERKESE AÇIK</b><small>Tüm oyuncular ve DM görür, adınla.</small></button>
    <button role="radio" aria-checked={n.vis === 'priv'} class:on={n.vis === 'priv'} class="pv" onclick={() => (n.vis = 'priv')}><b class="mono">⊘ ÖZEL</b><small>Yalnız sen ve DM görürsünüz.</small></button>
  </div>
  {#if err}<p class="err mono">{err}</p>{/if}
  <div class="act">
    {#if ondelete && !isNew}<button class="btn red" onclick={ondelete} disabled={busy}>Sil</button>{/if}
    <span class="sp"></span>
    <button class="btn ghost" onclick={oncancel} disabled={busy}>Vazgeç</button>
    <button class="btn" onclick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'} <small class="mono">CTRL+↵</small></button>
  </div>
</div>

<style>
  .nf{position:absolute;left:50%;top:96px;transform:translateX(-50%);z-index:25;width:min(440px,92vw);background:rgba(6,9,16,.97);border:1px solid color-mix(in srgb,var(--nc) 60%,transparent);
    padding:14px 16px;display:flex;flex-direction:column;gap:9px;box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 30px color-mix(in srgb,var(--nc) 12%,transparent);
    clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px));outline:0}
  header{display:flex;align-items:center;gap:8px}
  .t{font-size:11px;letter-spacing:.3em;color:var(--nc);text-shadow:0 0 10px color-mix(in srgb,var(--nc) 60%,transparent)}
  .sw{margin-left:auto;background:none;border:1px solid rgba(255,155,47,.5);color:#ff9b2f;font-size:9.5px;letter-spacing:.18em;padding:3px 8px;cursor:pointer}.sw:hover{background:rgba(255,155,47,.12)}
  .x{margin-left:auto;background:none;border:0;color:var(--mut);cursor:pointer;font-size:13px}.sw + .x{margin-left:6px}
  .loc{font-size:10px;letter-spacing:.14em;color:var(--mut)}
  .ic{display:grid;grid-template-columns:repeat(6,1fr);gap:4px}
  .ic button{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0 4px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);color:#9fb3c4;cursor:pointer;transition:border-color .15s,color .15s}
  .ic button span{font-size:16px;line-height:1}.ic button small{font-size:8.5px;letter-spacing:.12em}
  .ic button:focus{outline:none}.ic button:focus-visible{outline:1px solid var(--nc)}
  .ic button:hover{color:#fff}.ic button.on{border-color:var(--nc);color:var(--nc);background:color-mix(in srgb,var(--nc) 10%,transparent);text-shadow:0 0 8px var(--nc)}
  .row{display:flex;gap:8px;align-items:center}.row .inp{flex:1}
  .cols{display:flex;gap:5px}
  .cols button{width:16px;height:16px;border-radius:50%;background:var(--c);border:2px solid transparent;box-shadow:0 0 6px var(--c);cursor:pointer;padding:0;opacity:.6;transition:transform .15s,opacity .15s}
  .cols button.on{opacity:1;border-color:#fff;transform:scale(1.15)}
  textarea{resize:vertical;min-height:70px;font:inherit;font-size:13px;line-height:1.45}
  .cnt{align-self:flex-end;margin-top:-6px;font-size:9px;color:var(--mut);letter-spacing:.1em}
  .vis{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .vis button{text-align:left;display:flex;flex-direction:column;gap:2px;padding:8px 10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.1);color:var(--mut);cursor:pointer}
  .vis b{font-size:10px;letter-spacing:.2em;font-weight:500}.vis small{font-size:11px;line-height:1.3}
  .vis button.on{border-color:var(--cy);color:#dff6ff;background:rgba(0,240,255,.07)}.vis button.on b{color:var(--cy)}
  .vis button.pv.on{border-color:#b06bff;background:rgba(176,107,255,.08)}.vis button.pv.on b{color:#c99bff}
  .err{color:var(--rd);font-size:11px}
  .act{display:flex;gap:8px;align-items:center;margin-top:2px}.sp{flex:1}
  .act small{font-size:8.5px;opacity:.6;margin-left:4px;letter-spacing:.1em}
</style>
