<script lang="ts">
  // Komut paleti (Ctrl+K · /): sistem, cisim, not ve komutlara tek yerden erişim.
  import { onMount, tick } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  export type PItem = { id: string; grp: string; g: string; t: string; s?: string; c?: string; kw?: string; run: () => void };
  let { items, onclose }: { items: PItem[]; onclose: () => void } = $props();
  let q = $state(''), idx = $state(0), inp: HTMLInputElement | undefined = $state(), box: HTMLDivElement | undefined = $state();
  const norm = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  const res = $derived.by(() => {
    const n = norm(q.trim());
    const sc = (it: PItem) => { if (!n) return 1; const a = norm(it.t), b = norm((it.s ?? '') + ' ' + (it.kw ?? '')); return a.startsWith(n) ? 3 : a.includes(n) ? 2 : b.includes(n) ? 1 : 0; };
    const xs = items.map((it) => [it, sc(it)] as const).filter((x) => x[1] > 0);
    if (n) xs.sort((a, b) => b[1] - a[1]);
    const per = new Map<string, number>(), out: PItem[] = [];
    for (const [it] of xs) { const c = per.get(it.grp) ?? 0; if (c >= (n ? 8 : 5)) continue; per.set(it.grp, c + 1); out.push(it); }
    const order = [...new Set(items.map((i) => i.grp))];
    return out.sort((a, b) => order.indexOf(a.grp) - order.indexOf(b.grp));
  });
  $effect(() => { q; idx = 0; });
  function go(it: PItem | undefined) { if (!it) return; onclose(); it.run(); }
  async function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(res.length - 1, idx + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); go(res[idx]); return; }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onclose(); return; }
    else return;
    await tick(); box?.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }
  onMount(() => { inp?.focus(); });
</script>

<div class="pbk" role="presentation" onclick={onclose} transition:fade={{ duration: 120 }}></div>
<div class="pal" role="dialog" aria-label="Komut paleti" transition:fly={{ y: -14, duration: 200 }}>
  <div class="pin"><span class="mono">⌕</span><input bind:this={inp} bind:value={q} onkeydown={key} placeholder="Sistem, cisim, not ya da komut ara…" spellcheck="false" /><kbd class="mono">ESC</kbd></div>
  <div class="res" bind:this={box}>
    {#each res as it, i (it.id)}
      {#if i === 0 || res[i - 1].grp !== it.grp}<div class="grp mono">{it.grp}</div>{/if}
      <button class:on={i === idx} onmouseenter={() => (idx = i)} onclick={() => go(it)} style:--ic={it.c ?? 'var(--cy)'}><i>{it.g}</i><b>{it.t}</b>{#if it.s}<small>{it.s}</small>{/if}{#if i === idx}<kbd class="mono">↵</kbd>{/if}</button>
    {:else}<div class="none mono">EŞLEŞME YOK</div>{/each}
  </div>
  <div class="ft mono"><span>↑↓ gez</span><span>↵ aç</span><span>ESC kapat</span></div>
</div>

<style>
  .pbk{position:absolute;inset:0;z-index:30;background:rgba(2,3,9,.45);backdrop-filter:blur(2px)}
  .pal{position:absolute;left:50%;top:92px;transform:translateX(-50%);z-index:31;width:min(560px,92vw);background:rgba(6,9,16,.97);border:1px solid rgba(0,240,255,.45);
    box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.6),0 0 40px rgba(0,240,255,.08);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
  .pin{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(0,240,255,.2)}
  .pin span{color:var(--cy);font-size:16px}
  .pin input{flex:1;background:none;border:0;outline:0;color:#fff;font:500 15px var(--f-ui);letter-spacing:.03em}
  .pin input::placeholder{color:rgba(160,190,210,.45)}
  kbd{font-size:9.5px;letter-spacing:.15em;color:var(--mut);border:1px solid rgba(255,255,255,.15);padding:1px 5px}
  .res{max-height:min(52vh,460px);overflow:auto;padding:4px 0 6px}
  .grp{font-size:9px;letter-spacing:.32em;color:var(--mut);padding:10px 16px 4px}
  .res button{width:100%;display:flex;align-items:center;gap:10px;background:none;border:0;border-left:2px solid transparent;padding:7px 14px;color:#cfe0ec;text-align:left;cursor:pointer}
  .res button i{width:18px;text-align:center;font-style:normal;color:var(--ic);text-shadow:0 0 8px var(--ic)}
  .res button b{font-weight:500;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .res button small{color:var(--mut);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-left:auto;max-width:50%}
  .res button kbd{margin-left:8px;color:var(--cy);border-color:rgba(0,240,255,.4)}
  .res button.on{background:linear-gradient(90deg,rgba(0,240,255,.12),transparent);border-left-color:var(--cy);color:#fff}
  .none{padding:22px;text-align:center;font-size:10px;letter-spacing:.3em;color:var(--mut)}
  .ft{display:flex;gap:16px;justify-content:flex-end;padding:7px 14px;border-top:1px solid rgba(255,255,255,.06);font-size:9px;letter-spacing:.2em;color:var(--mut)}
</style>
