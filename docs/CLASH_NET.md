# CROWN CLASH — Spark-safe PvP (Firestore lockstep)

Hedef: Firebase **Spark** (ücretsiz) kotasında, sunucu kodu (Cloud Functions) olmadan gerçek zamanlı 1v1.

## Fikir
- Oyun durumu **hiç** ağdan gönderilmez. İki istemci aynı `seed` + aynı komut listesiyle aynı deterministik simülasyonu koşar (`src/apps/clash/engine.ts`, 20 Hz, yalnız + − × ÷ ve sqrt; trig yok; tohumlu mulberry32 RNG).
- Ağdan giden tek şey komut: `{t, side, card, x, y, n}` = "şu tikte şu kartı şuraya koydum".
- Komutlar **22 tik (1.1 s) ileri** tarihlenir; rakibe gecikme bu pencereye sığarsa geri sarma bile gerekmez.
- Geç gelen komut: son anlık görüntüye (her 20 tikte bir alınır) sarılır, sessizce yeniden simüle edilir (rollback).

## Belgeler
| Yol | İçerik | Yazma |
|---|---|---|
| `clash_queue/{uid}` | eşleşme kuyruğu `{name, deck, cr, at, match}` | aramada 2–4 |
| `clash_matches/{id}` | `{players, names, decks{0,1}, cr, seed, t0, left[], res{side:{w,h,c}}}` | 1 + 2 sonuç |
| `clash_matches/{id}/cmds/{side_nnnn}` | komutlar | kart başına 1 |
| `clash_decks/{uid}` | deste + kupa/G/M/B | maç sonu 1 |

Maç başına toplam ≈ 50–120 yazma, ≈ aynı sayıda okuma (dinleyici). Spark günlük 20k yazma / 50k okuma → yüzlerce maç/gün.

## Eşleşme
1. `serverTimestamp` ping'i ile sunucu saat farkı ölçülür.
2. Kuyruğa yazılır; 3.5 s'de bir son 45 s'deki kuyruk okunur.
3. Transaction: iki kuyruk belgesi de boşsa maç oluşturulur, ikisine `match` yazılır. Önce gelen = taraf 0 (host).
4. `t0 = sunucu saati + 5 s`; iki istemci de `Date.now()+offset−t0` ile aynı tiki hesaplar.

## Bütünlük
- Kurallar: komutu yalnız maçın oyuncusu, kendi `u` alanıyla yazar; güncelleme yok. Maç belgesinde yalnız `res` / `left` değişir.
- Maç sonunda her taraf sonuç + durum hash'i yazar; hash farkı = desync uyarısı.
- Çıkış/teslim: `left` alanı → rakip anında kazanır.

## Test (emülatör, 2 tarayıcı bağlamı)
`qtest/t10.mjs`: kael + brokk aynı anda SAVAŞ → eşleşme, iki taraf 40 s kart oynar; her 100 tikte durum hash'i karşılaştırılır (9/9 aynı, kule HP'leri birebir). Teslim: brokk çıkar → kael "ZAFER · rakip ayrıldı".

## v2 (CROWN CLASH) eklemeleri
- `clash_inv/{uid}` (özel envanter) ve `clash_decks/{uid}` (herkese açık profil) aynı toplu yazımda kaydedilir. Kural, herkese açık kupayı envanterdeki kupaya bağlar.
- Maç destesi `{id, lv}` listesidir; seviye çarpanı her iki istemcide aynı uygulanır.
- Emojiler aynı `cmds` koleksiyonuna `c: "~laugh"` olarak yazılır. Motor bunları görmez.
- Yazma bütçesi:
  - Maç başına komutlar + 1 toplu kayıt + (botsa) 1 bot güncellemesi.
  - Arka plan bot maçları için 10 dakikada en çok 9 yazma.
