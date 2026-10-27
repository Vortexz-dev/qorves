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
