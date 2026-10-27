// Etiket açılır penceresi: her yerden openTag(id). Geçmiş yığını ile geri gidilebilir.
import { sfx } from './sfx';
export const tagui = $state({ stack: [] as string[] });
export function openTag(id: string) { if (tagui.stack.at(-1) === id) return; tagui.stack.push(id); sfx.open(); }
export function tagBack() { tagui.stack.pop(); sfx.click(); }
export function closeTags() { if (tagui.stack.length) { tagui.stack = []; sfx.close(); } }
