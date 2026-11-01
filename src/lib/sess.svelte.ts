// Oturum sayacı + sıradaki oturum (world/session; DM yazar, herkes okur).
import { watchDoc, setDocAt } from './live';
export interface SessInfo { n: number; at: number | null; note: string; remind: boolean }
export const sess = $state<SessInfo & { ready: boolean }>({ n: 0, at: null, note: '', remind: true, ready: false });
export function watchSess() {
  return watchDoc<Partial<SessInfo>>(['world', 'session'], (v) => {
    sess.n = Math.max(0, Math.round(v?.n ?? 0)); sess.at = typeof v?.at === 'number' ? v.at : null;
    sess.note = v?.note ?? ''; sess.remind = v?.remind ?? true; sess.ready = true;
  });
}
export const saveSess = (p: Partial<SessInfo>) => setDocAt(['world', 'session'], p);
// İstanbul saati (UTC+3, yaz saati yok): "YYYY-MM-DDTHH:mm" ⇄ epoch ms
const OFF = 3 * 3600e3;
export const fromIst = (s: string) => { const t = Date.parse(s + ':00Z'); return Number.isFinite(t) ? t - OFF : null; };
export const toIst = (ms: number) => new Date(ms + OFF).toISOString().slice(0, 16);
export const fmtIst = (ms: number) => {
  const o = (x: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', ...x });
  return `${o({ weekday: 'long' })}, ${o({ day: 'numeric', month: 'long' })} · ${o({ hour: '2-digit', minute: '2-digit' })}`;
};
export function rel(ms: number, now = Date.now()) {
  const d = ms - now;
  if (d <= -3 * 3600e3) return 'geçti';
  if (d <= 5 * 60e3) return d > 0 ? 'birazdan' : 'şimdi oynanıyor';
  const m = Math.round(d / 60e3), h = Math.round(d / 3600e3), g = Math.round(d / 86400e3);
  if (m < 60) return `${m} dakika sonra`;
  if (h < 36) return `${h} saat sonra`;
  return `${g} gün sonra`;
}
