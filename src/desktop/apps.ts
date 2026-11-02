import type { Component } from 'svelte';
import { safeLoad } from '../lib/chunk';
export interface AppDef {
  id: string; title: string; icon: string; core?: boolean; w?: number; h?: number; optional?: boolean; hidden?: boolean; dmOnly?: boolean; desc?: string; storeTitle?: string;
  load: () => Promise<{ default: Component<any> }>;
}
// Uygulamalar ayrı parçalar halinde, açıldıklarında yüklenir.
export const APPS: AppDef[] = [
  { id: 'timeline', title: 'Qorves Timeline', icon: 'timeline', core: true, load: safeLoad(() => import('../apps/CoreTimeline.svelte')) },
  { id: 'codex', title: 'Qorves Codex', icon: 'codex', core: true, load: safeLoad(() => import('../apps/CoreCodex.svelte')) },
  { id: 'starmap', title: 'Qorves Starmap', icon: 'starmap', core: true, load: safeLoad(() => import('../apps/CoreStarmap.svelte')) },
  { id: 'ship', title: 'Docked & Loaded', storeTitle: 'Docked & Loaded - Ship Customization', desc: 'Gemini incele ve özelleştir: hologram, iç plan, bölme fotoğrafları, dorseler ve gemi durumu. Şimdilik kayıtlı gemi: Demir Kervan.', icon: 'ship', core: true, load: safeLoad(() => import('../apps/Ship.svelte')) },
  { id: 'gods', title: "God's Eye", storeTitle: "God's Eye - Canlı Sahne", desc: 'Oyun masası: DM\'in kurduğu sahneyi canlı izle, jetonunu taşı, işaret bırak, ekran görüntüsü al ve not tut.', icon: 'gods', core: true, load: safeLoad(() => import('../apps/gods/GodsEye.svelte')) },
  { id: 'computer', title: 'Bilgisayarım', icon: 'computer', w: 780, h: 640, load: safeLoad(() => import('../apps/MyComputer.svelte')) },
  { id: 'profile', title: 'Profil', icon: 'profile', w: 720, h: 560, load: safeLoad(() => import('../apps/Profile.svelte')) },
  { id: 'logbook', title: 'Seyir Defteri', icon: 'logbook', w: 1020, h: 700, load: safeLoad(() => import('../apps/Logbook.svelte')) },
  { id: 'notepad', title: 'Not Defteri', icon: 'notepad', w: 560, h: 500, optional: true, desc: 'Masaüstüne sağ tıkla, yeni not aç. Notların hesabına kayıtlı kalır.', load: safeLoad(() => import('../apps/Notepad.svelte')) },
  { id: 'explorer', title: 'Klasör', icon: 'explorer', w: 700, h: 470, hidden: true, load: safeLoad(() => import('../apps/Explorer.svelte')) },
  { id: 'store', title: 'Q-Mağaza', icon: 'store', w: 760, h: 560, load: safeLoad(() => import('../apps/AppStore.svelte')) },
  { id: 'ghos', title: 'ghOS-Net', icon: 'ghos', w: 940, h: 620, optional: true, desc: 'Kayıt dışı şifreli mesajlaşma. Kimin çevrimiçi olduğunu görür, iz bırakmadan yazışırsın. Bağlantı izlenebilir.', load: safeLoad(() => import('../apps/GhosNet.svelte')) },
  { id: 'wallet', title: 'Kredi Cüzdanı', icon: 'wallet', w: 620, h: 560, optional: true, desc: 'BK, Mark ve Kantar bakiyen ile işlem geçmişin. Bakiyeyi DM yönetir.', load: safeLoad(() => import('../apps/Wallet.svelte')) },
  { id: 'dice', title: 'Zar Atıcı', icon: 'dice', w: 760, h: 600, optional: true, desc: 'd4–d100, çoklu zar, artı/eksi, avantaj/dezavantaj. Atışlar DM masasına ve Discord kanalına düşer.', load: safeLoad(() => import('../apps/Dice.svelte')) },
  { id: 'duel', title: 'Zar Düellosu', icon: 'duel', w: 860, h: 600, optional: true, desc: 'Kasa botuna karşı iki zar, BK ile bahis. Kazanırsan bahsin 2 katı döner; kaybedersen bahis gider. Bahis 10–500 BK.', load: safeLoad(() => import('../apps/Duel.svelte')) },
  { id: 'dm', title: 'DM Paneli', icon: 'dm', w: 1180, h: 740, dmOnly: true, load: safeLoad(() => import('../apps/DMPanel.svelte')) },
  { id: 'docview', title: 'Belge', icon: 'doc', w: 640, h: 560, hidden: true, load: safeLoad(() => import('../apps/DocView.svelte')) },
];
export const visibleApps = (u: { role: string; apps?: string[] }) => APPS.filter((a) => !a.hidden && (!a.dmOnly || u.role === 'dm') && (!a.optional || (u.apps ?? []).includes(a.id)));
export const appById = (id: string) => APPS.find((a) => a.id === id)!;
