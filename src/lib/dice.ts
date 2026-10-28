// Zar ifadeleri: "2d6+3", "d20-2", "3d8+1d4+2". Avantaj/dezavantaj tek d20 için: 2d20, en iyi/en kötü tutulur.
import type { Roll } from './live';
export const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
export interface Parsed { groups: { n: number; d: number; sign: 1 | -1 }[]; mod: number }
export function parse(expr: string): Parsed | null {
  const s = expr.replace(/\s+/g, '').toLowerCase().replace(/^\+/, ''); if (!s) return null;
  const re = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/gy; const out: Parsed = { groups: [], mod: 0 }; let m: RegExpExecArray | null, pos = 0;
  while (pos < s.length && (m = re.exec(s))) {
    if (m.index !== pos) return null; pos = re.lastIndex;
    if (m[3]) { const n = m[2] ? +m[2] : 1, d = +m[3]; if (n < 1 || n > 30 || ![2, 3, 4, 6, 8, 10, 12, 20, 100].includes(d)) return null; out.groups.push({ n, d, sign: m[1] === '-' ? -1 : 1 }); }
    else { const v = +m[5]; if (v > 999) return null; out.mod += m[4] === '-' ? -v : v; }
  }
  if (pos !== s.length || !out.groups.length || out.groups.reduce((a, g) => a + g.n, 0) > 40) return null;
  return out;
}
const rnd = (d: number) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % d); };
export function roll(p: Parsed, adv: '' | 'adv' | 'dis'): Pick<Roll, 'groups' | 'mod' | 'adv' | 'total' | 'nat'> {
  const single20 = p.groups.length === 1 && p.groups[0].n === 1 && p.groups[0].d === 20;
  const useAdv = adv && single20 ? adv : '';
  let total = p.mod, nat: Roll['nat'] = '';
  const groups = p.groups.map((g) => {
    if (useAdv) { const a = rnd(20), b = rnd(20), k = useAdv === 'adv' ? Math.max(a, b) : Math.min(a, b); total += k * g.sign; if (k === 20) nat = 'nat20'; if (k === 1) nat = 'nat1'; return { n: 2, d: 20, vals: [a, b], keep: [useAdv === 'adv' ? (a >= b ? 0 : 1) : (a <= b ? 0 : 1)] }; }
    const vals = Array.from({ length: g.n }, () => rnd(g.d)); total += vals.reduce((x, y) => x + y, 0) * g.sign;
    if (g.d === 20 && g.n === 1) { if (vals[0] === 20) nat = 'nat20'; if (vals[0] === 1) nat = 'nat1'; }
    return { n: g.n * g.sign, d: g.d, vals };
  });
  return { groups, mod: p.mod, adv: useAdv, total, nat };
}
export const fmtMod = (m: number) => (m > 0 ? '+' + m : m < 0 ? String(m) : '');
/** Discord kanalına gömülü mesaj (webhook). */
export function discordPayload(r: Roll, world?: string) {
  const dice = r.groups.map((g) => `d${g.d}: ${g.vals.map((v, i) => (g.keep ? (g.keep.includes(i) ? `**${v}**` : `~~${v}~~`) : `${v}`)).join(', ')}`).join('\n');
  const color = r.nat === 'nat20' ? 0x39ff8a : r.nat === 'nat1' ? 0xff2a55 : 0x00f0ff;
  const title = (r.nat === 'nat20' ? '✦ DOĞAL 20 · ' : r.nat === 'nat1' ? '✖ DOĞAL 1 · ' : '🎲 ') + `${r.char || r.user}`;
  const fields = [
    { name: 'Atış', value: '`' + r.expr + '`' + (r.label ? ` · ${r.label}` : ''), inline: true },
    { name: 'Toplam', value: `**${r.total}**`, inline: true },
    { name: 'Zarlar', value: dice || '—', inline: false },
    { name: 'Değiştirici', value: r.mod ? fmtMod(r.mod) : '0', inline: true },
    { name: 'Avantaj', value: r.adv === 'adv' ? 'Avantajlı (2d20, iyisi)' : r.adv === 'dis' ? 'Dezavantajlı (2d20, kötüsü)' : 'Yok', inline: true },
  ];
  return { username: 'Qorves Zar Atıcı', embeds: [{ title, description: `Oyuncu: **${r.user}**${r.char ? ` · Karakter: **${r.char}**` : ''}`, color, fields, footer: { text: 'Qorves Zar Atıcı' + (world ? ' · ' + world : '') }, timestamp: new Date(r.at).toISOString() }] };
}
