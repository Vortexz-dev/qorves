# CROWN CLASH (t149u) — durum

Dal: `clash-v2` (worktree `/workspace/qclash`), origin/main üstüne rebase edildi.

## Bitti
- Ad CROWN CLASH; yeniden adlandırma tamam: logo (SVG tipografi), mağaza girişi, pencere başlığı, simge ve belgeler.
- 30 kart (`src/apps/clash/cards.ts`): seviye 1–9, Sv 4 / Sv 7 evrimleri. Bot-bot simülasyonuyla dengelendi.
- Yatay, ekranı dolduran arena (`render.ts`). 5 temalı arena (`themes.ts`), her birinin kendi müziği var (`audio.ts`).
- Ekonomi (`economy.ts`):
  - BIT ve QORE.
  - QORE alımı BK cüzdanından tek toplu yazımla yapılır: kurallar bağlar, DM paneli kaydı tutar.
  - Sandıklar: galibiyet, turnuva türü ve 2 premium.
  - Yükseltme kopya + BIT ile.
- Ağ (`net.ts`, `invites.ts`):
  - Envanter ve herkese açık profil.
  - Ortak sıralama: oyuncular + 40 kalıcı bot. Botlar oyuncuyu yenince yükselir.
  - Arka plan bot maçları.
  - Arkadaşlar ve düello.
  - PvP ve emojiler.
- UI (`Clash.svelte` ve bileşenler):
  - Ekranlar: giriş, ana sayfa, kartlar, mağaza, sıralama, arkadaşlar, arama, VS, maç, maç sonu.
  - Sandık açılışı ve yükseltme animasyonları.
  - Masaüstü düello bildirimi (`CrownHost.svelte`).
- Firestore kuralları: yeni koleksiyonlar ve satın alma bağları. 17 negatif/pozitif kural testi geçti.
- Belgeler: `docs/CROWN_CLASH_DESIGN.md` (kart tablosu + denge) ve `docs/CLASH_NET.md`.

## Testler (emülatör 8280/9299, önizleme 4373)
- Betikler: `/workspace/qtest/ct1..ct7.mjs` ve `rt/crules.mjs`.
- Ekran görüntüleri: `/workspace/qtest/shots/cc/`.

## QA turu (devralan işçi, 20 Kas 23:30+)
- DÜZELTİLDİ: arena zemin dokusu hiç görünmüyordu (nehir kıyısı shadowBlur'u arka plan tuvalini boşaltıyordu; ctx.filter de kaldırıldı).
- DÜZELTİLDİ: tüm sprite'larda 1–3 px yarı saydam kenar çerçevesi (kule/birim etrafında kutu).
- Birimler %20 büyütüldü (sz ×1.55).
- Yeni test: `qtest/ct8.mjs` (kısayolsuz tam kupalı bot maçı).
- DÜZELTİLDİ: Orbitron'da Ş/Ğ/İ yoktu (public/fonts/orbitron-tr-*.woff, unicode-range ek).
- Sıralama: 'senin sıran' çubuğu; BOT rozetleri kaldırıldı; bot adları oyun-içi takma ad.
- Geçti (4cf1743): ct1, ct2, ct3 (toast + PvP 9/9 hash), ct5, ct7, crules 17/17.
- ct6 düzeltildi (önce 550 QORE alıyor, Neon Kasa 160 QORE).
## Kalan
- YAYINDA: main 3c32e44, Pages index-DYLpy3zC.js doğrulandı, Firestore kuralları yüklendi (Spark). Discord duyurusu Phoenix onayı bekliyor.
- yeni kart görselleri + 3 sprite + 7 yürüme sayfası üretildi (qtest/c3/*.txt eşlemeleri). Kalan: 13 mevcut birimin yürüme sayfası, kod.

## t158u (Phoenix revizyonu) — tamam
- 10 yeni kart (toplam 40): sappers, berserker, flak, minotaur, mortar, rain, lancer, hexer, goliath, skyblade. Gerçekçi kart görseli + sprite.
- Arena kilitleri: ARENA_CARDS/ARENA_CR (cards.ts). En iyi kupaya göre açılır, geri kilitlenmez. Sandık havuzu yalnız açık arenalar. UI: ana sayfada "sonraki arena açar" şeridi, koleksiyon arenaya göre gruplu, kilitli kart açıklaması, "YENİ ARENA" açılış ekranı.
- Eşleştirme: canlı kuyruk ±(250+60·sn) penceresi; yoksa findOpponent: botlar + gerçek oyuncular (hayalet: kendi destesi, YZ) ±150/300/600. Rakip kart seviyeleri oyuncunun ortalamasına ±1 sıkıştırılır; bot desteleri fitDeck ile kendi arenasına uydurulur; hayalet maçında yalnız benim kupam değişir.
- Birim boyu ×1.55 → ×1.3. 20 bacaklı birime 4 karelik yürüme sayfası (walk_<id>.webp), hareket ederken döner.
- VFX: ateş topu patlaması, şok dalgası, yanık izi, namlu alevi, vuruş kıvılcımı; Nova füzesi gökten iner, Drop Pod/Plasma Rain meteor düşüşü + çarpma; void mermisi + iz.
- SFX: kart başına çıkış/saldırı/ölüm (aile + perde kimliği), büyü başına çarpma.
- Font: Orbitron değişken font kendimizde + Ş ş Ğ ğ İ bileşik glifleri (aynı font → aynı ağırlık/boy). Google Orbitron kaldırıldı.
- Sandık: win 12+5/arena, tour 30+10, neon 45+12, leg 36+8 kart; BIT ×(1+0.5·arena). Kopya maliyetleri aynı (dik).
- Motor: n dalgalı büyü (pulses), 'air' alan hasarı, mermi sersemletmesi.
- Kurallar değişmedi (BIT sınırı yeterli). Smoke: t158.mjs (ana/kartlar/mağaza/arena açılışı/maç), hata yok.
- YAYINDA: main d122f60, canlı index-DtMm21aZ.js (doğrulandı).
