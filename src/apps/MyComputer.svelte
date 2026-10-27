<script lang="ts">
  // Sürükleyici amaçlı sahte sistem bilgisi. Marka/model adları ÖNERİ (canon değil).
  import { session } from '../lib/session.svelte';
  import { RACES } from '../lib/data/character';
  const u = session.user!;
  const race = RACES.find((r) => r.id === u.character?.race)?.label ?? (u.role === 'dm' ? 'Bilinmiyor' : '—');
  const drives = [
    { n: 'Q:', l: 'Yerel Sistem', used: 61, tot: '2,0 TB' },
    { n: 'K:', l: 'Codex Önbelleği', used: 34, tot: '512 GB' },
    { n: 'N:', l: 'Kişisel Notlar', used: 4, tot: '128 GB' },
    { n: 'M:', l: 'Mühürlü Bölüm', used: 100, tot: '??', sealed: u.role !== 'dm' },
  ];
  const rows: [string, string][] = [
    ['İşletim sistemi', 'QORVES·OS 9.4.17 "Süt" — Kayıt Çekirdeği'],
    ['İşlemci', 'Ferraria Dökümü KX-12 · 24 çekirdek · 5,8 GHz'],
    ['Yardımcı işlemci', 'Bağlı zekâ modülü BZ-4 · Öz-Yazım kilidi: AKTİF (yasal)'],
    ['Bellek', '64 GB kurum-soğutmalı'],
    ['Grafik', 'Opulens Işık Çipi · holo çıkış'],
    ['Ağ', 'Hat ağı alıcısı · 31 düğüm · süt kanalı'],
    ['Güvenlik', 'ICE-3 duvar · krom veriyolu izolasyonu'],
    ['Saat', 'SS takvimi · Taç Sesi senkronu'],
  ];
</script>

<div class="mc">
  <div class="hero">
    <div class="rig">
      <svg viewBox="0 0 120 90"><rect x="8" y="6" width="104" height="62" fill="none" stroke="#00f0ff" stroke-width="2"/><rect x="14" y="12" width="92" height="50" fill="rgba(0,240,255,.07)"/>
        <path d="M22 22h40M22 30h56M22 38h28" stroke="#fcee0a" stroke-width="2"/><path d="M48 68v10M30 84h60" stroke="#00f0ff" stroke-width="2"/><circle cx="96" cy="54" r="3" fill="#ff2a55"/></svg>
    </div>
    <div>
      <div class="mono k">TERMİNAL KİMLİĞİ</div>
      <h2>QTR-{u.uid.slice(-6).toUpperCase()}</h2>
      <div class="mono s">Kullanıcı: <b>{u.username}</b> · {u.role === 'dm' ? 'Yönetici (DM)' : 'Standart'} · {race}</div>
    </div>
  </div>
  <table>
    <tbody>{#each rows as [a, b]}<tr><td class="mono">{a}</td><td>{b}</td></tr>{/each}</tbody>
  </table>
  <div class="mono k">SÜRÜCÜLER</div>
  <div class="drives">
    {#each drives as d}
      <div class="dr" class:sealed={d.sealed}>
        <div class="dn"><b>{d.n}</b> {d.l}<span class="mono">{d.sealed ? 'ERİŞİM YOK' : d.used + '% · ' + d.tot}</span></div>
        <div class="bar"><i style:width="{d.used}%"></i></div>
      </div>
    {/each}
  </div>
</div>

<style>
  .mc{padding:22px 24px;display:flex;flex-direction:column;gap:16px}
  .hero{display:flex;gap:20px;align-items:center;padding-bottom:16px;border-bottom:1px solid var(--line)}
  .rig svg{width:120px;filter:drop-shadow(0 0 8px rgba(0,240,255,.5))}
  .k{font-size:10.5px;letter-spacing:.3em;color:var(--cy)}
  h2{font-family:var(--f-disp);font-size:24px;letter-spacing:.12em;color:var(--ye);margin:4px 0}
  .s{font-size:12.5px;color:var(--mut)}.s b{color:var(--tx)}
  table{border-collapse:collapse;width:100%}
  td{padding:7px 10px;border-bottom:1px solid rgba(0,240,255,.08);font-size:14.5px}
  td.mono{width:34%;color:var(--mut);font-size:12px;letter-spacing:.08em;text-transform:uppercase}
  tr:hover td{background:rgba(0,240,255,.04)}
  .drives{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .dr{padding:10px 12px;border:1px solid var(--line);background:rgba(0,0,0,.2)}
  .dn{display:flex;gap:6px;align-items:baseline;font-size:14px}.dn b{color:var(--ye)}.dn span{margin-left:auto;font-size:11px;color:var(--mut)}
  .bar{height:5px;margin-top:8px;background:rgba(0,240,255,.1)}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--cy),var(--ye))}
  .sealed .bar i{background:repeating-linear-gradient(45deg,var(--rd) 0 6px,transparent 6px 10px)}.sealed .dn span{color:var(--rd)}
</style>
