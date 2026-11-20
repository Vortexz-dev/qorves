# CROWN CLASH — Tasarım Belgesi

Qorves masaüstündeki tam ekran kule düellosu. Eski adları SPIRE//CLASH ve CHROME CROWN idi. Kart ve marka adları İngilizce, arayüz Türkçe.

## Çekirdek
- 18×32 karo, 20 Hz deterministik kilit-adımı (lockstep). Ağ mimarisi için bkz. `CLASH_NET.md`.
- Ekran yatay çizilir: kendi tarafın solda, rakip sağda. Motor dikeydir; yalnız çizim dönüşümü yapılır.
- Maç 3:00 sürer, son dakika 2× iksir akar. Eşitlikte 2:00 uzatma oynanır (ani ölüm, son dakika 3×). Uzatma da berabere biterse kule canı oranına bakılır.
- Taraf adaleti iki yolla sağlanır: tek tikler ters sırada işlenir ve y yuvarlaması tarafa göre aynalanır. 3×2000 ayna maçta taraf dağılımı ~%50/%50 çıktı.

## Seviye, kopya, evrim
- Kart seviyesi 1–9 arasındadır. Her seviye `+%8` can ve hasar getirir (`lvMul = 1 + 0.08·(lv−1)`).
- Yükseltmenin bedeli kopya ve BIT'tir. Destansı kartlarda BIT ×1.5, Efsanevi kartlarda ×2 ödenir.

  | Sv → | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
  |---|---|---|---|---|---|---|---|---|
  | Yaygın kopya | 2 | 4 | 10 | 20 | 40 | 80 | 150 | 300 |
  | Nadir kopya | 1 | 2 | 4 | 8 | 16 | 30 | 60 | 120 |
  | Destansı kopya | 1 | 1 | 2 | 4 | 8 | 15 | 30 | 60 |
  | Efsanevi kopya | 1 | 1 | 1 | 2 | 3 | 6 | 12 | 24 |
  | BIT | 50 | 150 | 400 | 1.000 | 2.500 | 6.000 | 12.000 | 25.000 |

- Evrim I Sv 4'te, Evrim II Sv 7'de açılır. Her kartın kendi evrim etkisi vardır (tabloda).
  - Arenada evrim I mor, evrim II altın parıltıyla görünür.

## Para birimleri
- **BIT (yumuşak para):** maç sonunda kazanılır ve sandıklardan çıkar.
  - Galibiyet: 40 + 10/taç + kupa bonusu. Beraberlik: 20. Yenilgi: 10. Antrenman: 0.
- **QORE (premium para):** yalnız karakterin gerçek BK'sı ile alınır.

  | Paket | Bedel |
  |---|---|
  | 100 QORE | 500 BK |
  | 550 QORE | 2.500 BK |
  | 1.200 QORE | 5.000 BK |

  - Alım tek toplu yazımdır: `clash_buys/{id}` + cüzdan BK düşüşü + `wallet/{uid}/tx/{id}` + envanter QORE artışı. Firestore kuralları bu dört parçayı `getAfter` ile birbirine bağlar.
  - Alımlar DM Paneli → Finans → *Crown Clash alımları* sekmesinde görünür.
  - QORE ile yapılabilenler: premium sandık, BIT paketi, sandık kilidini anında açma. Bu hafif bir pay-to-win'dir: yükseltme hızlanır.

## Sandıklar (kart başına nadirlik olasılığı)

| Sandık | Nasıl | Kart | BIT | Yaygın | Nadir | Destansı | Efsanevi | Garanti |
|---|---|---|---|---|---|---|---|---|
| Veri Kasası | Kupalı galibiyet (4 yuva, 30 dk kilit) | 8 | 60–110 | 78 | 18 | 3.6 | 0.4 | — |
| Turnuva Kasası | Etkinlik ödülü (tür hazır, turnuva modu yok) | 20 | 220–300 | 60 | 30 | 9 | 1 | Nadir+ |
| Neon Kasa | 160 QORE | 30 | 450–600 | 45 | 38 | 15 | 2 | Destansı+ |
| Taç Kasası | 520 QORE | 24 | 900–1.100 | 35 | 40 | 20 | 5 | Efsanevi |

- Kilit açmayı atlamanın bedeli kalan her 5 dakika için 1 QORE'dir.
- Açılış animasyonu sırasıyla: düşüş → sallanma → yüklenme → patlama (kapalı görsel açığa döner) → kartlar tek tek → BIT sayacı.

## Arenalar (kupa ile açılır)

| Arena | Kupa | Zemin / atmosfer | Müzik |
|---|---|---|---|
| Neon Alley | 0 | Yağmurlu neon sokak | La minör synth, 112 BPM |
| Rust Docks | 400 | Paslı liman, kül | Endüstriyel, 104 BPM |
| Hrothmar Forge | 1000 | Erimiş çelik nehri, kıvılcım | Tribal davul, 96 BPM |
| Orbital Ring | 2000 | Yörünge güvertesi, yıldızlar | Havadar, 120 BPM |
| Null Citadel | 3000 | Obsidyen, mor zerreler | Karanlık, 128 BPM |

## Sıralama ve botlar
- Ortak sıralama iki kaynaktan oluşur: `clash_decks` (oyuncuların herkese açık profili) ve `clash_bots` (40 kalıcı bot; kupa, seviye ve deste Firestore'da durur).
- *SAVAŞ* önce 9 sn gerçek oyuncu arar. Bulamazsa kupası yakın bir sıralama botuyla eşler.
  - Bot oyuncuyu yenerse kupa kazanır; kaybederse kupa düşer (kural sınırı |Δ| ≤ 60).
- Arka planda bot-bot maçları oynanır:
  - Tüm istemciler arasında en fazla 10 dakikada bir, en çok 4 maç.
  - Toplam ≤ 9 yazma; `clash_meta/sim` zaman damgası kuralla kilitlidir.
- Bot emojileri şu anlarda gelir:
  - kule aldığında (kahkaha, dil çıkarma, kendini beğenme);
  - kule kaybettiğinde (öfke, ağlama, tüh);
  - 3+ birimini tek hamlede sildiğinde;
  - yem olarak (dolu iksirde hmm/esneme);
  - oyuncunun emojisine cevap olarak (%50).

## Arkadaşlar ve düello
- `clash_fr/{uid}` alanları: `f` (arkadaşlar) ve `in` (gelen istekler).
  - Kurallar başkasının belgesinde yalnız şunlara izin verir: kendini istek olarak eklemek, isteği kabul ederken kendini arkadaş eklemek, kendini çıkarmak.
- Düello: `clash_duels/{id}`. Dostluk maçıdır; kupa değişmez.
  - Davet edilen oyunda değilse masaüstünün sağ altında "X seni düelloya davet etti" bildirimi çıkar. Bildirime tıklamak oyunu açar ve daveti kabul eder (`CrownHost`).

## Maç sonu
- Gösterilenler: sonuç, taçlar, kupa ve BIT sayacı, sandık.
- Kart başına hasar barları ve "maçın yıldızı" yer alır.
- İki tarafın karşılaştırması: harcanan iksir, düşen kule, kule hasarı, oynanan kart, öldürülen birim, boşa giden iksir.
- Bunların ardından 1–3 cümlelik bir özet gelir.

## Kartlar (30)

Taban seviye (Sv 1) değerleri. Rol ve evrimler oyundaki metinle aynıdır.

| Kart | İksir | Nadirlik | Tür | Rol | Can | Hasar | DPS | Menzil | Hedef | Hız | Evrim I / II (Sv 4 / Sv 7) | Karşı |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Scrap Bots | 1 | common | troop | Döngü sürüsü ×3 | 90 ×3 | 75 | 75 | 0.6 | Kara | 1.2 | 4 robot iner / Ölünce kısa devre patlaması (45) | EMP Pulse, Mag Roller, her alan hasarı |
| EMP Pulse | 2 | common | spell | Büyü · sersemlet | — | 190 | — | r 2.5 | — | — | Yarıçap 3.0 / Sersemletme 1 sn | Sürü kartları; Pylon/hücum sıfırlama |
| Goblin Gang | 2 | common | troop | Hızlı sürü ×3 | 260 ×3 | 112 | 102 | 0.7 | Kara | 1.5 | 4 goblin / İlk vuruş ×2 (pusu) | EMP, Mag Roller, Ember Drake, Mech |
| Mag Roller | 2 | rare | spell | Büyü · yuvarlanan | — | 250 | — | — | — | — | Daha geniş şerit / Ezilen sersemler 0.4 sn | Goblin, Scrap, Medic, Sharpshooter |
| Overclock | 2 | epic | spell | Büyü · güçlendirme | — | 0 | — | r 4 | — | — | Süre 10 sn / +%55 hız ve tempo | EMP (buffı boşa çıkarır), Cryo Bomb |
| Chrome Brawler | 3 | common | troop | Mini tank | 1300 | 165 | 138 | 0.9 | Kara | 1 | 300 kalkan / Her 3. yumruk alan + ×2 | Tabaxi, Goblin Gang, Exo |
| Elf Marksman | 3 | common | troop | Menzilli ×2 · hava savunma | 270 ×2 | 75 | 75 | 5.5 | Kara+Hava | 1 | Menzil 6.3 / Ray atışı deler (alan) | EMP, Mag Roller, Drake |
| Wasp Drones | 3 | common | troop | Hava ×3 | 155 ×3 | 72 | 72 | 2 | Kara+Hava | 1.6 | 4 dron / Düşerken patlar (60) | EMP, Arc Turret, Marksman, Drake |
| Arc Turret | 4 | rare | building | Savunma yapısı | 1150 | 135 | 135 | 5.5 | Kara+Hava | — | Şimşek 3 hedefe / Her vuruş sersemletir | Nova Missile, Orbital Strike, Exo |
| Corp Sharpshooter | 4 | rare | troop | Uzun menzil · tek hedef | 510 | 150 | 125 | 6.5 | Kara+Hava | 1 | Menzil 7.2 / Her 3. atış ×3 hasar | Orbital Strike, Tabaxi, Mag Roller |
| Netrunner | 4 | epic | troop | Zincir şok | 640 | 98 | 61 | 5 | Kara+Hava | 1 | 4 hedefe zincir / 5 hedef + 0.5 sn şok | Orbital Strike, Tabaxi, Rail Rider |
| Tabaxi Shadow | 4 | rare | troop | Suikastçı | 1080 | 350 | 233 | 0.8 | Kara | 1.5 | Atılma (ilk vuruş ×2) / Vurduğunun %30'unu emer | Goblin Gang, Scrap Bots, Wasp Drones |
| Riot Enforcer | 4 | rare | troop | Kalkan · hücum | 1000 | 185 | 142 | 0.9 | Kara | 1 | 800 kalkan / Hücum darbesi sersemletir | Tabaxi, Exo, Sharpshooter |
| Rail Rider | 4 | rare | troop | Hızlı kuşatma | 1850 | 290 | 181 | 0.9 | Yapı | 2 | +%14 can (2100) / Kuleye vuruş kuleyi sersemletir | Arc Turret, Inferno Pylon, Goblin Gang, Tabaxi |
| Synth Medic | 4 | epic | troop | İyileştirici | 1000 | 80 | 67 | 1.2 | Kara | 1 | Saniyede 120 iyileştirme / Ölünce 400 iyileştirme dalgası | Mag Roller, Orbital Strike, Tabaxi |
| Ember Drake | 4 | epic | troop | Hava · alan | 760 | 115 | 72 | 3.5 | Kara+Hava | 1.2 | Alev alanı 1.6 / Alan 1.8 + %20 hasar | Sharpshooter, Marksman, Arc Turret |
| Orbital Strike | 4 | rare | spell | Büyü · alan | — | 650 | — | r 2.5 | — | — | Yarıçap 3.0 / İkinci darbe (%40) | Destek birimleri, Medic, Marksman, Pump |
| Cryo Bomb | 4 | epic | spell | Büyü · dondur | — | 120 | — | r 3.2 | — | — | 5 sn donma / Buz kırılınca 160 hasar | Zamanlama; Overclock ile kombo |
| Dwarf Breacher | 5 | rare | troop | Tank · yalnız yapı | 3800 | 240 | 160 | 0.9 | Yapı | 0.85 | 700 kalkan / Matkap kuleyi sersemletir | Inferno Pylon, Tabaxi, Exo, Goblin Gang |
| Hover Bomber | 5 | epic | troop | Hava · yalnız yapı | 1600 | 760 | 253 | 0.6 | Yapı | 1.15 | Düşüş patlaması 2.0 / +%25 bomba | Sharpshooter, Marksman, Wasp Drones, Arc Turret |
| Cryo Runesmith | 5 | epic | troop | Yavaşlatan alan | 1000 | 95 | 63 | 5 | Kara+Hava | 1 | %50 yavaşlatma / İnişte don dalgası | Orbital Strike, Tabaxi, Rail Rider |
| Scrap Foundry | 5 | rare | building | Üretici yapı | 1250 | 0 | — | — | — | — | 3.8 sn'de bir / Yıkılınca 3 robot | Mag Roller, Rail Rider, Nova Missile |
| Inferno Pylon | 5 | epic | building | Tank avcısı yapı | 1400 | 30 | 75 | 6 | Kara+Hava | — | Isı +%15 / Erime ışını 680 | EMP, Netrunner (sıfırlar), sürüler |
| Drop Pod | 5 | legendary | spell | Büyü · kuşatma çıkarması | — | 0 | — | r 2.5 | — | — | 18 kapsül / İniş darbesi 100 | EMP, Mag Roller, Drake, Arc Turret |
| Locust Swarm | 5 | common | troop | Hava sürüsü ×6 | 150 ×6 | 75 | 75 | 0.8 | Kara+Hava | 1.6 | 7 dron / Düşerken iğne patlaması | EMP, Drake, Arc Turret, Netrunner |
| Ogre Hauler | 6 | epic | troop | Ağır tank | 3400 | 240 | 150 | 1 | Kara | 0.75 | Ölünce 3 goblin / Ölüm darbesi 300 | Inferno Pylon, Exo, Locust Swarm |
| Nova Missile | 6 | epic | spell | Büyü · ağır | — | 1250 | — | r 2 | — | — | Yarıçap 2.5 / Şok dalgası 1 sn | Pump, Sharpshooter + Medic, son vuruş |
| Elixir Pump | 6 | rare | building | Ekonomi yapısı | 1100 | 0 | — | — | — | — | 7.5 sn'de bir / Yıkılınca +1 iksir | Nova Missile, Rail Rider, Orbital Strike |
| Exo Juggernaut | 7 | epic | troop | Ağır vurucu | 3100 | 660 | 347 | 1 | Kara | 0.75 | %15 can emme / Kılıç savurması alan | Goblin Gang, Scrap Bots, Locust Swarm, Drop Pod |
| Siege Mech | 7 | legendary | troop | Alan topçusu | 2650 | 230 | 115 | 5 | Kara | 0.6 | Alan 1.8 / Reaktör patlaması 400 | Tabaxi, Exo, Locust Swarm, Inferno Pylon |

### Arketipler ve kombolar
- **Chrome Beatdown** (varsayılan): Chrome Brawler + Dwarf Breacher; Elf Marksman ve Wasp Drones arkadan destek verir. EMP ve Orbital Strike yolu açar.
- **Ogre Push:** Ogre Hauler önde, Synth Medic arkada, Hover Bomber alan hasarı. Turret ve Scrap Bots savunmayı tutar.
- **Rider Cycle:** Rail Rider, Tabaxi Shadow ve Goblin Gang ile hızlı döngü. Freeze + Rail Rider kule baskını yapar.
- **Exo Pump:** Elixir Pump ekonomisi, ardından Exo Titan + Ember Drake. Nova Missile bitirir.
- **Mech Siege:** Siege Mech arkada; Synth Medic iyileştirir, Locust Swarm hava baskısı kurar.
- **Bait / Pod:** Drop Pod, Overclock ve Goblin Gang ile rakibin büyüsünü harcatır.
- **Build Control:** Cryo Runesmith, Inferno Pylon ve Mag Roller ile kontrol.

### Denge (bot-bot simülasyonu, mulberry32 RNG, 3×2000 maç / seviye)
- Taraf dengesi Sv 1'de 2994 / 2984 / 22 beraberlik çıktı (≈%50).
- Kart galibiyet oranı (dahil olduğu destelerde) Sv 1'de %44.1–55.9, Sv 5'te %45–56.8 aralığında.
- Uçlarda kalan kartlar ve sebepleri:
  - Elf Marksman, Corp Sharpshooter ve Siege Mech üstte.
  - Foundry, Dwarf Breacher ve Rail Rider altta. Bunun sebebi kartların zayıflığı değil, botun yapı ve kule-hedefli kartları zayıf kullanması.
- Ham dosyalar: `qtest/c2/BAL_FINAL_lv1.txt`, `BAL_FINAL_lv5.txt` (repo dışında).
