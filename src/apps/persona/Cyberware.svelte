<script lang="ts">
  import type { Character } from '../../lib/backend';
  import { CHROME_TIERS } from '../../lib/data/character';
  import { CHROME_SLOTS, chromeSlots, hasChip, isDwarfRace, type ChromePiece, type ChromeSlot, type Sheet } from '../../lib/persona';
  import BodyView from './BodyView.svelte';
  let { c, sheet, chrome }: { c: Character; sheet: Sheet; chrome: ChromePiece[] } = $props();
  const ok = $derived(hasChip(c.chrome));
  const cap = $derived(chromeSlots(String(c.chrome ?? '0')));
  const dwarf = $derived(isDwarfRace(c.race));
  let sel = $state<ChromePiece | null>(null);
  const at = (s: ChromeSlot) => chrome.find((x) => x.slot === s);
  const POS: Record<ChromeSlot, string> = {
    brain: 'left:4%;top:8%', os: 'right:4%;top:8%', face: 'left:4%;top:20%',
    nervous: 'left:4%;top:36%', skeleton: 'right:4%;top:28%', circulatory: 'right:4%;top:42%',
    skin: 'left:4%;top:52%', arms: 'left:4%;top:66%', hands: 'right:4%;top:66%', legs: 'right:4%;top:80%',
  };
</script>

<div class="cw">
  {#if !ok}
    <div class="lock">
      <div class="mono k">KROM YUVASI KİLİTLİ</div>
      <h2>İşlemci çipi yok</h2>
      <p>Bu karaktere krom takılabilmesi için önce bir işlemci çipi (Common ve üzeri) takılması gerekir. Çip takılınca yuvalar burada açılır; kromu yalnız DM yerleştirir, sen takılı parçaların adını, görselini, açıklamasını ve etkisini görürsün.</p>
      <div class="mono sub">Şu an: {CHROME_TIERS.find((t) => t.id === String(c.chrome ?? '0'))?.label ?? 'İşlemci yok'}</div>
    </div>
  {:else}
    <div class="stage">
      <div class="kop">
        <div class="mono">KOPUŞ</div>
        <b>{sheet.kopus}<small>/10</small></b>
        <div class="dots">{#each Array(10) as _, i}<i class:on={i < sheet.kopus} class:hot={i >= 6}></i>{/each}</div>
        <span>0 sakin · 10 kopuş. Bu değeri DM ayarlar.</span>
      </div>
      <div class="body">
        <BodyView {dwarf} hot={sel?.slot ?? ''} />
      </div>
      {#each CHROME_SLOTS as s (s.id)}
        {@const p = at(s.id)}
        <button class="slot" class:on={sel?.id === p?.id} class:filled={!!p} style={POS[s.id]} onclick={() => (sel = p ?? sel)}>
          <em class="mono">{s.label}</em>
          <b>{p ? p.name : '— boş —'}</b>
        </button>
      {/each}
      <div class="cap mono">YUVA {chrome.length}/{cap} · {CHROME_TIERS.find((t) => t.id === String(c.chrome))?.label}</div>
    </div>
    {#if sel}
      <aside>
        {#if sel.img}<img src={sel.img} alt="" />{/if}
        <div class="mono k">{CHROME_SLOTS.find((x) => x.id === sel!.slot)?.label}</div>
        <h3>{sel.name}</h3>
        {#if sel.stats}<div class="st">{sel.stats}</div>{/if}
        <p>{sel.desc || 'Açıklama girilmemiş.'}</p>
        <button class="btn ghost small" onclick={() => (sel = null)}>Kapat</button>
      </aside>
    {/if}
  {/if}
</div>

<style>
  .cw{flex:1;min-height:0;display:flex;position:relative;z-index:1}
  .lock{margin:auto;max-width:560px;text-align:center;padding:40px;border:1px solid rgba(0,240,255,.25);background:rgba(4,6,12,.7)}
  .k{letter-spacing:.3em;color:var(--ye);font-size:11px}h2{font-family:var(--f-disp);font-size:32px;margin:10px 0;color:#fff}
  .lock p{color:#c9d6e2;line-height:1.55}.sub{margin-top:16px;color:var(--mut)}
  .stage{flex:1;position:relative;min-width:0}
  .body{position:absolute;inset:8% 22% 8% 22%}
  .slot{position:absolute;width:200px;text-align:left;background:rgba(4,8,14,.82);border:1px solid rgba(0,240,255,.3);color:inherit;padding:8px 10px;font:inherit}
  .slot em{display:block;font-style:normal;font-size:10px;letter-spacing:.16em;color:var(--cy)}
  .slot b{font-weight:600;font-size:13px;color:#fff}.slot.filled{border-color:rgba(252,238,10,.45)}.slot.on{border-color:var(--ye);box-shadow:0 0 12px rgba(252,238,10,.2)}
  .kop{position:absolute;left:50%;top:10px;transform:translateX(-50%);text-align:center;z-index:2}
  .kop .mono{font-size:10px;letter-spacing:.3em;color:var(--rd)}.kop b{font-family:var(--f-disp);font-size:28px;color:#fff}.kop small{font-size:14px;color:var(--mut)}
  .dots{display:flex;gap:4px;margin:6px auto;width:220px}.dots i{flex:1;height:7px;background:rgba(255,255,255,.1)}.dots i.on{background:var(--ye)}.dots i.on.hot{background:var(--rd)}
  .kop span{display:block;font-size:11px;color:var(--mut)}
  .cap{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);letter-spacing:.2em;color:var(--mut);font-size:10.5px}
  aside{width:300px;flex:none;border-left:1px solid var(--line);padding:18px;overflow:auto;background:rgba(0,0,0,.35)}
  aside img{width:100%;aspect-ratio:16/10;object-fit:cover;border:1px solid var(--line);margin-bottom:10px}
  h3{font-family:var(--f-disp);font-size:22px;margin:6px 0;color:#fff}
  .st{color:var(--ye);font-size:13px;margin-bottom:8px}aside p{color:#c9d6e2;line-height:1.5}
</style>
