<script lang="ts">
  import { session } from '../lib/session.svelte';
  import { RACES, CLASSES, BACKGROUNDS, FACTIONS, CHROME_TIERS } from '../lib/data/character';
  const u = session.user!; const c = u.character;
  const cl = CLASSES.find((x) => x.id === c?.cls), cl2 = CLASSES.find((x) => x.id === c?.cls2);
  const rows: [string, string][] = c ? [
    ['Irk', RACES.find((r) => r.id === c.race)?.label ?? '—'], ['Yaş', c.age], ['Doğduğu yer', c.origin],
    ['Bağlılık', FACTIONS.find((f) => f.id === c.faction)?.label ?? '—'], ['Klan / hane', c.clan || '—'], ['Meslek', c.job || '—'],
    ['Sınıf', `${cl?.label ?? '—'}${c.sub ? ' · ' + cl?.subs.find((s) => s.id === c.sub)?.label : ''}`],
    ['İkinci sınıf', cl2 ? `${cl2.label}${c.sub2 ? ' · ' + cl2.subs.find((s) => s.id === c.sub2)?.label : ''}` : '—'],
    ['Seviye', String(c.level)], ['Geçmiş', BACKGROUNDS.find((b) => b.id === c.background)?.label ?? '—'],
    ['Krom', `${CHROME_TIERS.find((t) => t.id === c.chrome)?.label}${c.visibleChrome ? ' · görünür' : ''}`],
  ] : [];
</script>
<div class="pf">
  <div class="top">
    <img src={u.avatar} alt="" />
    <div>
      <div class="mono k">{u.role === 'dm' ? 'DUNGEON MASTER · TAM ERİŞİM' : 'OYUNCU KAYDI'}</div>
      <h2>{c?.name ?? u.username}</h2>
      <div class="mono s">@{u.username} · kayıt {new Date(u.createdAt).toLocaleDateString('tr-TR')}</div>
    </div>
  </div>
  {#if c}
    <div class="grid">{#each rows as [a, b]}<div class="cell"><span class="mono">{a}</span><b>{b}</b></div>{/each}</div>
    <div class="stats">{#each Object.entries(c.stats) as [k, v]}<div><span class="mono">{k}</span><b>{v}</b></div>{/each}</div>
    {#if c.bio}<p class="bio">{c.bio}</p>{/if}
    <div class="mono file">{u.file ? `📎 ${u.file.name} · ${(u.file.size / 1048576).toFixed(2)} MB · DM'e iletildi` : 'Background dosyası yüklenmedi.'}</div>
  {:else}<p class="bio">Bu hesap bir karakter değil. Bütün bilgilere erişimi var.</p>{/if}
</div>
<style>
  .pf{padding:22px 24px;display:flex;flex-direction:column;gap:16px}
  .top{display:flex;gap:20px;align-items:center}
  .top img{width:110px;height:110px;object-fit:cover;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);filter:drop-shadow(0 0 10px rgba(0,240,255,.5))}
  .k{font-size:10.5px;letter-spacing:.3em;color:var(--cy)}
  h2{font-family:var(--f-disp);font-size:26px;letter-spacing:.1em;color:var(--ye);margin:4px 0}
  .s{font-size:12px;color:var(--mut)}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line)}
  .cell{background:#080b14;padding:8px 12px;display:flex;flex-direction:column;gap:2px}
  .cell span{font-size:10.5px;color:var(--mut);letter-spacing:.12em;text-transform:uppercase}.cell b{font-size:15px;font-weight:600}
  .stats{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
  .stats div{border:1px solid var(--line);text-align:center;padding:8px 0}.stats span{display:block;font-size:11px;color:var(--cy)}.stats b{font-family:var(--f-disp);font-size:20px;color:var(--ye)}
  .bio{line-height:1.55;color:var(--tx);white-space:pre-wrap}
  .file{font-size:12px;color:var(--mut)}
</style>
