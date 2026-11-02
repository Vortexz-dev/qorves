<script lang="ts">
  // Bilgi paneli: stat sözlüğü (katalog) + temel kurallar.
  import { cat } from '../../ship/sys';
  let { onclose }: { onclose: () => void } = $props();
</script>
<div class="inf" role="dialog" aria-label="Bilgi">
  <header><span class="mono">BİLGİ · STATLAR VE KURALLAR</span><button onclick={onclose} aria-label="Kapat">×</button></header>
  <div class="bd">
    <section>
      <h4 class="mono">TEMEL KURALLAR</h4>
      <ul>
        <li><b>Mass ≤ Max Mass.</b> Max Mass toplam Thrust'tır (1 Thrust = 1 t). Taşıyabileceğinden ağır bir şey takılamaz.</li>
        <li><b>Power Draw ≤ Power Output.</b> Takılı her şey güç çeker; çekirdeğin ürettiğini aşamaz.</li>
        <li><b>Yuvalar:</b> küçük parça büyük yuvaya girer (S1 → S2), tersi olmaz. Silah, itici, zırh ve sensör yalnız Dış yuvaya; kalkan ve EW iki yere de takılır.</li>
        <li><b>Mobility</b> yük arttıkça düşer: taban × (1 − Load²) + iticiler − dorse başına {cat.constants.trailer_mobility_penalty}. Pilot düzeltmesi: (Mobility − 50) / 10, aşağı yuvarlanır.</li>
        <li><b>Delta-V</b> = motor verimi × Skarnit / Mass. <b>Endurance</b> = Skarnit / çekirdeğin günlük tüketimi.</li>
        <li><b>Outrider (T1)</b>: 1 motor, 1 çekirdek, en fazla 1 adet T1 dorse.</li>
        <li>Parçalar ortak tersane deposundan takılır; söktüğün parça depoya döner. Her değişiklik herkese anında yansır.</li>
      </ul>
      <p class="nt">Tüm sayılar beta; masada denenip ayarlanacak.</p>
    </section>
    <section>
      <h4 class="mono">SÖZLÜK</h4>
      <dl>{#each cat.glossary as g (g.stat)}<dt>{g.stat}<small class="mono">{g.unit}</small></dt><dd>{g.definition_tr}</dd>{/each}</dl>
    </section>
  </div>
</div>
<style>
  .inf{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(900px,90vw);max-height:78vh;display:flex;flex-direction:column;background:rgba(3,7,13,.97);border:1px solid rgba(0,240,255,.4);z-index:30;box-shadow:0 20px 60px rgba(0,0,0,.6);animation:in .3s cubic-bezier(.2,.9,.3,1)}
  header{display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(0,240,255,.2);font-size:10.5px;letter-spacing:.3em;color:var(--cy)}
  header button{margin-left:auto;background:none;border:none;color:var(--mut);font-size:20px;cursor:pointer}header button:hover{color:#fff}
  .bd{display:grid;grid-template-columns:1fr 1.2fr;gap:20px;padding:14px 18px;overflow:auto}
  h4{font-size:10px;letter-spacing:.3em;color:var(--ye);margin:0 0 8px}
  ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px;font-size:14px;line-height:1.45;color:#d6e2ee}ul b{color:#fff}
  .nt{font-size:12px;color:var(--mut)}
  dl{margin:0;display:grid;grid-template-columns:130px 1fr;gap:6px 12px;font-size:13.5px}dt{color:#fff;font-weight:600}dt small{display:block;font-size:10px;color:var(--mut);font-weight:400}dd{margin:0;color:#c9d6e2;line-height:1.4}
  @keyframes in{from{opacity:0;transform:translate(-50%,-46%);clip-path:inset(0 0 100% 0)}to{clip-path:inset(0)}}
</style>
