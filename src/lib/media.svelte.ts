// Masaüstü görsel adresleri: 'media:' referanslarını (Firestore'daki parçalı veri) gösterilebilir adrese çevirir.
import { mediaUrl } from './live';
import { session } from './session.svelte';
const M = $state<Record<string, string>>({});
const asked = new Set<string>();
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
/** Şablonda <img src={media(src)}>: önce boş, veri gelince görsel. */
export function media(src?: string) {
  if (!src) return BLANK; if (!src.startsWith('media:')) return src;
  const uid = session.user?.uid; if (!uid) return BLANK; const k = uid + '/' + src;
  if (!asked.has(k)) { asked.add(k); void mediaUrl(uid, src).then((v) => { if (v) M[k] = v; else asked.delete(k); }); }
  return M[k] || BLANK;
}
