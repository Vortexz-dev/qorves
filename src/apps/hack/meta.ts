/* Minioyun kimlikleri: ad, tema, yardım metni, kontroller. */
import type { GameId } from '../../lib/ghoskey';
export interface GMeta { id: GameId; name: string; tag: string; acc: string; acc2: string; bg: string; how: string[]; keys: [string, string][] }
export const META: Record<GameId, GMeta> = {
  breach: { id: 'breach', name: 'İHLAL PROTOKOLÜ', tag: 'BREACH_PROTOCOL // KOD MATRİSİ', acc: '#d0ed57', acc2: '#5ef6ff', bg: '#0b0c12',
    how: ['Kod matrisinden hücre seçerek ara belleği doldur.', 'İlk seçim ÜST SATIRDAN. Sonra seçtiğin hücrenin SÜTUNUNDAN, sonra SATIRINDAN… dönüşümlü.', 'Sağdaki daemon dizilerini ara bellekte sırayla oluştur. Hepsi yüklenince erişim açılır.', 'Süre ilk seçimde başlar. Önce planla.'],
    keys: [['Fare', 'hücre seç'], ['?', 'yardım']] },
  circuit: { id: 'circuit', name: 'DEVRE AKIŞI', tag: 'POWER_ROUTING // FAZ KÖPRÜSÜ', acc: '#ffb000', acc2: '#4cc9ff', bg: '#070a14',
    how: ['Soldaki ÇEKİRDEK enerji verir. Karolara tıklayarak 90° döndür.', 'Enerji hattını tüm ALICI düğümlere kesintisiz ulaştır.', 'Sağ tık ters yöne döndürür. Kırmızı bloklar yalıtkandır.', 'Süre ilk dokunuşta başlar.'],
    keys: [['Sol tık', 'saat yönü'], ['Sağ tık', 'ters yön'], ['?', 'yardım']] },
  kernel: { id: 'kernel', name: 'K3RN3LC0MP1L3R', tag: 'KERNEL_COMPILER // BOZUK BELLEK', acc: '#39ff14', acc2: '#b6ffa0', bg: '#020602',
    how: ['Vurgulanan satırı BİREBİR yaz ve Enter’a bas.', 'Yanlış karakter kırmızı yanar: Backspace ile sil, devam et.', 'Tüm bozuk bellek bloklarını temizlediğinde saldırı durur.', 'Süre ilk tuşta başlar.'],
    keys: [['Klavye', 'yaz'], ['Enter', 'gönder'], ['Backspace', 'sil'], ['?', 'yardım']] },
  memde: { id: 'memde', name: 'memDEALLOCATER', tag: 'MEMORY_DEALLOC // SATIR SİLİCİ', acc: '#2bff88', acc2: '#ff3355', bg: '#020805',
    how: ['EN ALTTAKİ satıra bak. Kırmızı bölgelerden kaçın.', 'Sadece SOL yeşil → A / ←.  Sadece SAĞ yeşil → D / →.  İkisi de yeşil → BOŞLUK.', 'Doğru tuş ilerletir, yanlış tuş geri götürür. Çubuk dolunca bellek temizlenir.', 'Süre ilk tuşta başlar. Yukarıdaki satırları önceden oku.'],
    keys: [['A / ←', 'sol'], ['Boşluk', 'ikisi'], ['D / →', 'sağ'], ['?', 'yardım']] },
  shift: { id: 'shift', name: 'shiftSEQ', tag: 'NODE_SHIFT // AĞ SAVUNMASI', acc: '#38ff6a', acc2: '#ff3a4f', bg: '#010603',
    how: ['Ortadaki EV düğümündesin. WASD ile hatlar boyunca ilerle.', 'Kırmızı enfekte düğümlerin içine gir ve BOŞLUK ile vur. İçindeyken o düğüm saldıramaz.', 'Saldırı paketleri eve ulaştığında sen evde değilsen bağlantı sağlığı düşer.', 'Pil biterse eve dön: genişleyen halka çerçeveye oturunca BOŞLUK = tam şarj. Yanlış zamanlama şarjı kısa süre kilitler.'],
    keys: [['W A S D', 'hareket'], ['Boşluk', 'vur / şarj'], ['?', 'yardım']] },
  token: { id: 'token', name: 'TOKENINE', tag: 'AUTH_TOKEN // YETKİ SENTEZİ', acc: '#b6ff3b', acc2: '#e8ffd0', bg: '#030803',
    how: ['Sağdaki yetki jetonunu soldaki parçalardan yeniden oluştur.', 'Kutucuklar kaç parça gerektiğini gösterir. Seçilen parça geri alınamaz.', 'Yanlış jeton sıfırlanır, yeniden dene. Doğru jeton sıradakine geçirir.', 'Her seçim için süre sınırlı: süre biterse bağlantı kopar.'],
    keys: [['Fare', 'parça seç'], ['?', 'yardım']] },
  tunnel: { id: 'tunnel', name: 'VERİ TÜNELİ', tag: 'DATA_CONDUIT // PAKET KAÇIŞI', acc: '#00f0ff', acc2: '#ff2bd6', bg: '#01030a',
    how: ['Veri borusunun içinde ilerleyen paketi FAREYLE yönlendir.', 'Paket borunun kesitinde her yöne gider. Engellerin açık kısmından geç.', 'Çarpınca kalkan düşer; kalkan biterse paket yanar. Tünelin sonuna ulaş.', 'İlk saniyeler boş: kontrolü hisset. Zorluk arttıkça boru döner, kıvrılır, hızlanır.'],
    keys: [['Fare', 'yönlendir'], ['?', 'yardım']] },
};
