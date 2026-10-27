export const settings = $state({
  reduceMotion: localStorage.getItem('qv.rm') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches,
  scanlines: localStorage.getItem('qv.scan') !== '0',
});
export function saveSettings() {
  localStorage.setItem('qv.rm', settings.reduceMotion ? '1' : '0');
  localStorage.setItem('qv.scan', settings.scanlines ? '1' : '0');
}
