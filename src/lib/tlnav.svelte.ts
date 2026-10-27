// Codex / etiket penceresinden Timeline'a derin bağlantı.
import { openApp } from '../desktop/wm.svelte';
import { closeTags } from './tags.svelte';
export const tlnav = $state({ target: null as string | null });
export function showOnTimeline(id: string) { closeTags(); tlnav.target = id; openApp('timeline'); }
