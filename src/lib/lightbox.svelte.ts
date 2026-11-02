// Site geneli görsel görüntüleyici durumu.
import { mediaUrl } from './live';
import { session } from './session.svelte';
export const lightbox = $state({ open: false, src: '', name: '' });
export function openImage(src: string, name = '') {
  if (src.startsWith('media:')) { const uid = session.user?.uid; if (!uid) return; void mediaUrl(uid, src).then((u) => { if (u) openImage(u, name); }); return; }
  lightbox.src = src; lightbox.name = name; lightbox.open = true;
}
export function closeImage() { lightbox.open = false; }
/** Görsel adresini kaydedilebilir biçime indirger (aynı sitedeyse yol). data: adresleri kaydedilmez. */
export function refOf(src: string) {
  if (src.startsWith('data:') || src.startsWith('blob:')) return null;
  try { const u = new URL(src, location.href); return u.origin === location.origin ? u.pathname : u.href; } catch { return null; }
}
