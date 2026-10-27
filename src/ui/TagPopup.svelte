<script lang="ts">
  import { onMount } from 'svelte';
  import { tagui, tagBack, closeTags } from '../lib/tags.svelte';
  import TagView from './TagView.svelte';
  const top = $derived(tagui.stack.at(-1));
  onMount(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && tagui.stack.length) { e.stopImmediatePropagation(); e.preventDefault(); closeTags(); } };
    addEventListener('keydown', k, true); return () => removeEventListener('keydown', k, true);
  });
</script>
{#if top}
  <div class="ov" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && closeTags()}>
    <div class="pop">
      <div class="bar">
        {#if tagui.stack.length > 1}<button class="b" onclick={tagBack}>‹ GERİ</button>{/if}
        <span class="mono crumb">{tagui.stack.length} / KAYIT</span>
        <button class="b x" onclick={closeTags} aria-label="Kapat">✕</button>
      </div>
      {#key top}<div class="body"><TagView id={top} /></div>{/key}
    </div>
  </div>
{/if}
<style>
  .ov{position:fixed;inset:0;z-index:9800;background:rgba(2,3,8,.55);backdrop-filter:blur(3px);display:grid;place-items:center;animation:f .2s both}
  @keyframes f{from{opacity:0}}
  .pop{width:min(760px,92vw);max-height:84vh;display:flex;flex-direction:column;background:rgba(6,9,16,.96);border:1px solid rgba(0,240,255,.45);
    box-shadow:0 0 40px rgba(0,240,255,.15),0 30px 80px #000;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px));
    animation:pin .34s cubic-bezier(.2,.9,.2,1) both}
  @keyframes pin{0%{clip-path:inset(48% 0 48% 0);filter:brightness(2) hue-rotate(40deg)}55%{clip-path:inset(0);filter:none}100%{clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,22px 100%,0 calc(100% - 22px))}}
  .bar{display:flex;align-items:center;gap:10px;padding:8px 10px 8px 16px;border-bottom:1px solid var(--line);background:linear-gradient(90deg,rgba(0,240,255,.12),transparent)}
  .crumb{font-size:10px;letter-spacing:.25em;color:var(--mut)}
  .b{background:none;border:1px solid var(--line);color:var(--cy);padding:4px 10px;font-family:var(--f-mono);font-size:11px;letter-spacing:.15em}
  .b:hover{border-color:var(--cy);background:rgba(0,240,255,.1)}
  .x{margin-left:auto;color:var(--rd);border-color:rgba(255,42,85,.4)}.x:hover{background:var(--rd);color:#fff}
  .body{overflow:auto;padding:22px 26px 26px;animation:bi .3s .08s both;user-select:text}
  @keyframes bi{from{opacity:0;transform:translateY(8px)}}
</style>
