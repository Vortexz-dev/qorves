import type { DepItem } from '../../lib/gods';
export const dep = $state({ items: [] as DepItem[], folder: '', busy: 0, hi: '' });
export const pathOf = (id: string) => { const out: DepItem[] = []; for (let q = id; q; ) { const f = dep.items.find((i) => i.id === q); if (!f) break; out.unshift(f); q = f.parent; } return out; };
