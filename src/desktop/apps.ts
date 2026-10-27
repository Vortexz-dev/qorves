import type { Component } from 'svelte';
export interface AppDef {
  id: string; title: string; icon: string; core?: boolean; w?: number; h?: number;
  load: () => Promise<{ default: Component<any> }>;
}
// Uygulamalar ayrı parçalar halinde, açıldıklarında yüklenir.
export const APPS: AppDef[] = [
  { id: 'timeline', title: 'Qorves Timeline', icon: 'timeline', core: true, load: () => import('../apps/CoreTimeline.svelte') },
  { id: 'codex', title: 'Qorves Codex', icon: 'codex', core: true, load: () => import('../apps/CoreCodex.svelte') },
  { id: 'starmap', title: 'Qorves Starmap', icon: 'starmap', core: true, load: () => import('../apps/CoreStarmap.svelte') },
  { id: 'computer', title: 'Bilgisayarım', icon: 'computer', w: 760, h: 560, load: () => import('../apps/MyComputer.svelte') },
  { id: 'profile', title: 'Profil', icon: 'profile', w: 720, h: 560, load: () => import('../apps/Profile.svelte') },
  { id: 'store', title: 'Q-Mağaza', icon: 'store', w: 760, h: 520, load: () => import('../apps/AppStore.svelte') },
];
export const appById = (id: string) => APPS.find((a) => a.id === id)!;
