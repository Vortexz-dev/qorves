/* Hack katmanı açıkken klavye yalnız hack'e gider: en erken kayıtlı yakalama dinleyicisi, diğer tüm pencere dinleyicilerini keser. */
type KH = (e: KeyboardEvent) => void;
const hs = new Set<KH>();
export const keyGuard = { active: 0 };
addEventListener('keydown', (e) => {
  if (!keyGuard.active) return;
  e.stopImmediatePropagation();
  hs.forEach((h) => h(e));
}, true);
export function onGuardKey(h: KH) { hs.add(h); return () => { hs.delete(h); }; }
