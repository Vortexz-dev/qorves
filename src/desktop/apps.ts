import type { Component } from 'svelte';
export interface AppDef {
  id: string; title: string; icon: string; core?: boolean; w?: number; h?: number; optional?: boolean; hidden?: boolean; dmOnly?: boolean; desc?: string;
  load: () => Promise<{ default: Component<any> }>;
}
// Uygulamalar ayrı parçalar halinde, açıldıklarında yüklenir.
export const APPS: AppDef[] = [
  { id: 'timeline', title: 'Qorves Timeline', icon: 'timeline', core: true, load: () => import('../apps/CoreTimeline.svelte') },
  { id: 'codex', title: 'Qorves Codex', icon: 'codex', core: true, load: () => import('../apps/CoreCodex.svelte') },
  { id: 'starmap', title: 'Qorves Starmap', icon: 'starmap', core: true, load: () => import('../apps/CoreStarmap.svelte') },
  { id: 'computer', title: 'Bilgisayarım', icon: 'computer', w: 780, h: 640, load: () => import('../apps/MyComputer.svelte') },
  { id: 'profile', title: 'Profil', icon: 'profile', w: 720, h: 560, load: () => import('../apps/Profile.svelte') },
  { id: 'notepad', title: 'Not Defteri', icon: 'notepad', w: 560, h: 500, optional: true, desc: 'Masaüstüne sağ tıkla, yeni not aç. Notların hesabına kayıtlı kalır.', load: () => import('../apps/Notepad.svelte') },
  { id: 'explorer', title: 'Klasör', icon: 'explorer', w: 700, h: 470, hidden: true, load: () => import('../apps/Explorer.svelte') },
  { id: 'store', title: 'Q-Mağaza', icon: 'store', w: 760, h: 560, load: () => import('../apps/AppStore.svelte') },
  { id: 'ghos', title: 'ghOS-Net', icon: 'ghos', w: 940, h: 620, optional: true, desc: 'Kayıt dışı şifreli mesajlaşma. Kimin çevrimiçi olduğunu görür, iz bırakmadan yazışırsın. Bağlantı izlenebilir.', load: () => import('../apps/GhosNet.svelte') },
  { id: 'wallet', title: 'Kredi Cüzdanı', icon: 'wallet', w: 620, h: 560, optional: true, desc: 'Birleşik Kredisi (BK) bakiyen ve işlem geçmişin. Bakiyeyi DM yönetir.', load: () => import('../apps/Wallet.svelte') },
  { id: 'dice', title: 'Zar Atıcı', icon: 'dice', w: 760, h: 600, optional: true, desc: 'd4–d100, çoklu zar, artı/eksi, avantaj/dezavantaj. Atışlar DM masasına ve Discord kanalına düşer.', load: () => import('../apps/Dice.svelte') },
  { id: 'dm', title: 'DM Paneli', icon: 'dm', w: 1180, h: 740, dmOnly: true, load: () => import('../apps/DMPanel.svelte') },
  { id: 'docview', title: 'Belge', icon: 'doc', w: 640, h: 560, hidden: true, load: () => import('../apps/DocView.svelte') },
];
export const visibleApps = (u: { role: string; apps?: string[] }) => APPS.filter((a) => !a.hidden && (!a.dmOnly || u.role === 'dm') && (!a.optional || (u.apps ?? []).includes(a.id)));
export const appById = (id: string) => APPS.find((a) => a.id === id)!;
