/* Bu cihazdaki radyo oynatıcısının anlık durumu (konum, süre, başlık). Görev çubuğu ve DM oynatıcısı okur. */
export const radioLive = $state<{ title: string; kind: string; playing: boolean; pos: number; dur: number; has: boolean; blocked: boolean }>(
  { title: '', kind: '', playing: false, pos: 0, dur: 0, has: false, blocked: false });
export function fmtTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), x = Math.floor(s % 60);
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
