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
## Kalan
- ct3 (arkadaş + masaüstü bildirimi + PvP), ct8, ct5 (sıralı PvP + bot + iki hesaptan sıralama), ct6 (premium sandık + DM kaydı + temalar), crules tekrar.
- Ekran görüntülerini gözden geçir → düzelt → rebase origin/main → build/check → main'e birleştir → Pages + kurallar deploy → canlı hash.
