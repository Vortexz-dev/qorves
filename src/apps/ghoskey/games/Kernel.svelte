<script lang="ts">
  import { onMount } from 'svelte';
  import { sfx } from '../../../lib/sfx';
  import Help from './Help.svelte';
  let { diff, signal, ondone }: { diff: number; signal: number; ondone: (ok: boolean) => void } = $props();
  const lines = [
    'mmap(NULL, 0x1000, PROT_READ|PROT_WRITE, MAP_ANON, -1, 0);',
    'if (k3rnel_verify(hdr) != 0) panic("sig");',
    'for (uint32_t i = 0; i < n; i++) blk[i] ^= 0xA5;',
    'syscall(SYS_write, 1, buf, len);',
    'while (*p) *q++ = rotl(*p++, 3);',
    'assert(crc32(seg) == expect);',
    'push rbp; mov rbp, rsp; sub rsp, 0x40;',
    'if (!auth_token(u->tok)) return EPERM;',
    'memcpy(out, in + off, n); fence();',
    'ret =ioctl(fd, KTUNE, &req);',
  ];
  const need = 3 + diff + (signal < 3 ? 1 : 0);
  const code = $state(Array.from({ length: need }, () => lines[Math.floor(Math.random() * lines.length)]));
  let i = $state(0), inp = $state(''), help = $state(true), start = $state(false);
  let left = $state(Math.max(14, 16 + need * 4 - diff * 2)), iv = 0, bad = $state(false);
  function startT() { if (start) return; start = true; iv = setInterval(() => { left -= 0.1; if (left <= 0) { left = 0; end(false); } }, 100) as unknown as number; }
  function typ(e: KeyboardEvent) {
    if (help) return;
    startT();
    if (e.key === 'Enter') {
      if (inp === code[i]) { i += 1; inp = ''; bad = false; sfx.granted(); if (i >= need) end(true); }
      else { bad = true; sfx.error(); }
      e.preventDefault(); return;
    }
    if (e.key === 'Backspace') { inp = inp.slice(0, -1); e.preventDefault(); return; }
    if (e.key.length === 1) { inp += e.key; e.preventDefault(); }
  }
  function end(v: boolean) { clearInterval(iv); (v ? sfx.granted : sfx.lose)(); setTimeout(() => ondone(v), 300); }
  onMount(() => { addEventListener('keydown', typ); return () => { removeEventListener('keydown', typ); clearInterval(iv); }; });
</script>
{#if help}<Help title="K3RN3LC0MP1L3R" text="Vurgulanan satırı birebir yaz, Enter ile gönder. Yanlış karakteri Backspace ile sil. Sayaç, kalan bozuk bellek bloklarını gösterir. Süre ilk tuşa basınca başlar." onstart={() => (help = false)} />{/if}
<div class="g">
  <div class="mono">BLOK {i}/{need} · {Math.ceil(left)}s</div>
  {#each code as l, k}
    <pre class:cur={k===i} class:ok={k<i} class:bad={k===i && bad}>{l}</pre>
  {/each}
  <div class="in mono" class:bad>{inp}<span>█</span></div>
</div>
<style>
  .g{height:100%;padding:16px;background:#050806;color:#9f6;font-family:var(--f-mono);overflow:auto}
  pre{margin:4px 0;padding:6px 8px;border-left:2px solid transparent;white-space:pre-wrap}.cur{border-color:#39ff8a;background:rgba(57,255,138,.06);color:#fff}.ok{color:#39ff8a;opacity:.7}.bad{color:#ff2a55}
  .in{margin-top:12px;border:1px solid #39ff8a;padding:8px;min-height:32px}.in.bad{border-color:#ff2a55}
  span{animation:b 1s steps(2) infinite}@keyframes b{50%{opacity:0}}
</style>
