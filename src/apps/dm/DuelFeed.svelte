<script lang="ts">
  // Zar Düellosu kayıtları: her oyun, sonuç ve kasanın net kârı.
  import { onMount } from 'svelte';
  import { watchGames, type Duel } from '../../lib/live';
  let games = $state<Duel[]>([]);
  onMount(() => watchGames(null, (g) => (games = g), 300));
  const house = $derived(games.reduce((s, g) => s - g.delta, 0));
  const wins = $derived(games.filter((g) => g.res === 'win').length), losses = $derived(games.filter((g) => g.res === 'lose').length);
  const fmt = (n: number) => n.toLocaleString('tr-TR');
  const RES: Record<string, string> = { win: 'Oyuncu kazandı', lose: 'Kasa kazandı', push: 'Berabere (iade)' };
</script>
<div class="df">
  <h4 class="mono">ZAR DÜELLOSU <span>son {games.length} oyun · oyuncu {wins} / kasa {losses}</span><b class:neg={house < 0}>Kasa net: {house >= 0 ? '+' : ''}{fmt(house)} BK</b></h4>
  <p class="nt">Kural: 2d6'ya karşı 2d6, yüksek toplam kazanır; eşitlikte iade, ikisi de 7 ise kasa kazanır. Beklenen kasa payı bahsin %2,78'i. Zarlar oyuncunun tarayıcısında atılır; tutarsız ya da şüpheli bir seri görürsen buradan denetle.</p>
  <div class="ls">
    {#each games as g (g.id)}
      <div class="r {g.res}"><span class="who"><b>{g.name}</b></span><span class="mono">bahis {fmt(g.bet)}</span><span class="mono">{g.p.join('+')} = {g.p[0] + g.p[1]}</span><span class="mono">kasa {g.b.join('+')} = {g.b[0] + g.b[1]}</span><span class="rs">{RES[g.res]}</span><span class="d mono">{g.delta > 0 ? '+' : ''}{fmt(g.delta)}</span><span class="mono t">bakiye {fmt(g.bal)}</span><span class="mono t">{new Date(g.at).toLocaleString('tr-TR')}</span></div>
    {:else}<div class="none mono">Henüz oyun yok.</div>{/each}
  </div>
</div>
<style>
  .df{display:flex;flex-direction:column;height:100%;min-height:0;padding:12px 16px}
  h4{font-size:10.5px;letter-spacing:.25em;color:var(--ye);margin:0 0 6px;display:flex;gap:14px;align-items:baseline}h4 span{color:var(--mut)}h4 b{margin-left:auto;color:#39ff8a;font-size:12px}h4 b.neg{color:#ff6b81}
  .nt{font-size:12.5px;color:var(--mut);margin:0 0 8px}
  .ls{flex:1;overflow:auto;border:1px solid var(--line)}
  .r{display:grid;grid-template-columns:170px 90px 90px 110px 130px 70px 110px 1fr;gap:10px;align-items:center;padding:6px 12px;border-bottom:1px solid rgba(0,240,255,.07);font-size:13px}
  .r .mono{font-size:11.5px}.t{color:var(--mut)}.win .rs,.win .d{color:#ff6b81}.lose .rs,.lose .d{color:#39ff8a}.push .rs{color:var(--ye)}
  .none{padding:16px;color:var(--mut)}
</style>
