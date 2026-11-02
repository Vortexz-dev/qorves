// Parçaya özel oda/koridor görselleri (public/img/ship/p/<anahtar>.webp). Listede olmayan anahtar için oda türünün genel görseli kullanılır.
export const ART = new Set<string>([]);
export const slug = (s: string) => s.toLocaleLowerCase('tr').replace(/\(.*?\)/g, '').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Dorse odası: modele özel görsel varsa onu, yoksa genel görseli döndürür. base: T1 model kimliği (trl_x). */
export function roomArt(base: string, name: string, fallback?: string) { const k = `p/${base.replace(/^trl_/, '')}--${slug(name)}`; return ART.has(k) ? k : fallback; }
export function corArt(key: string, fallback?: string) { const k = `p/${key}`; return ART.has(k) ? k : fallback; }
