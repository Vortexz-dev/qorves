/*
 * GİZLİ OYUN BİLGİSİ (GM-ONLY) altyapısı.
 * Her içerik atomu bir görünürlük anahtarı (`key`) taşır. Oyuncu yalnız kendisine açılmış anahtarları görür;
 * DM her şeyi görür. Açık anahtarlar Firestore `grants/{uid}` (ya da geçişte yerel yapılandırma) listesinden gelir.
 * Kapalı içerik paketleri repoda düz metin olarak durmaz (Faz 2: hafif şifreli paketler).
 */
export type KnowledgeKey = string; // örn. 'k.public', 'k.dwarf.ancient', 'k.sys.cellax'
export const PUBLIC_KEY: KnowledgeKey = 'k.public';
export interface Gated { key: KnowledgeKey }
export function canSee(item: Gated, grants: Set<KnowledgeKey>, isDM: boolean) {
  return isDM || item.key === PUBLIC_KEY || grants.has(item.key);
}

/** Anahtar adları (DM görünümü) ve ırk/klan için önerilen başlangıç anahtarları (DM paneli onaylar). */
export const KEY_LABEL: Record<string, string> = {
  'k.public': 'Herkes', 'k.elf': 'Elf bilgisi', 'k.elf.ancient': 'Elf kadim tarihi', 'k.dwarf': 'Cüce bilgisi', 'k.dwarf.ancient': 'Cüce kadim tarihi (Hrothmar)',
  'k.human': 'İnsan bilgisi', 'k.human.ancient': 'İnsan kadim tarihi', 'k.united': 'Birleşik içi', 'k.republic': 'Cumhuriyet içi', 'k.velmor': 'Velmor içi',
  'k.ostrav': 'Ostrav içi', 'k.north': 'Kuzey Bölge', 'k.east': 'Doğu Dış Halka', 'k.corp': 'Şirket dünyası', 'k.lore': 'Akademik bilgi',
  'k.cellax': 'Cellax gerçeği', 'k.zenith': 'Zenith içi', 'k.dm': 'Yalnız DM',
};
export const KEY_PRESETS: Record<string, string[]> = {
  elf: ['k.elf'], dwarf: ['k.dwarf'], human: ['k.human'], hrothmar: ['k.dwarf', 'k.dwarf.ancient', 'k.elf.ancient', 'k.human.ancient', 'k.lore'],
};
