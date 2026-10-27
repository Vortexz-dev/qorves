// Prosedürel dokular (dosya indirmeden): parıltı, halka, nişangâh, ışın, bulutsu.
import * as THREE from 'three';
function cv(n: number, draw: (g: CanvasRenderingContext2D, n: number) => void) {
  const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d')!, n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const glowTex = () => cv(128, (g, n) => {
  const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.12, 'rgba(255,255,255,.85)'); r.addColorStop(0.35, 'rgba(255,255,255,.22)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, n, n);
});
export const softTex = () => cv(64, (g, n) => {
  const r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n);
});
export const ringTex = () => cv(256, (g, n) => { // kara delik birikim diski
  const r = g.createRadialGradient(n / 2, n / 2, n * 0.16, n / 2, n / 2, n / 2);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.08, 'rgba(255,240,210,1)'); r.addColorStop(0.25, 'rgba(255,160,60,.75)'); r.addColorStop(0.6, 'rgba(200,60,20,.2)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, n, n);
  g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(n / 2, n / 2, n * 0.16, 0, 7); g.fill();
});
export const diskTex = () => cv(128, (g, n) => { g.fillStyle = '#000'; g.beginPath(); g.arc(n / 2, n / 2, n * 0.42, 0, 7); g.fill(); });
export const beamTex = () => cv(256, (g, n) => {
  const r = g.createLinearGradient(0, 0, n, 0); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  const v = g.createLinearGradient(0, n / 2 - 6, 0, n / 2 + 6); g.fillStyle = r; g.globalAlpha = 0.9; g.fillRect(0, n / 2 - 3, n, 6);
  g.globalAlpha = 0.25; g.fillRect(0, n / 2 - 10, n, 20); void v;
});
export const reticleTex = () => cv(256, (g, n) => {
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(n / 2, n / 2, n * 0.4, 0.2, 1.37); g.stroke();
  g.beginPath(); g.arc(n / 2, n / 2, n * 0.4, 1.77, 2.94); g.stroke(); g.beginPath(); g.arc(n / 2, n / 2, n * 0.4, 3.34, 4.51); g.stroke(); g.beginPath(); g.arc(n / 2, n / 2, n * 0.4, 4.91, 6.08); g.stroke();
  g.lineWidth = 3; g.globalAlpha = 0.6; g.beginPath(); g.arc(n / 2, n / 2, n * 0.47, 0, 7); g.stroke();
});
// değer gürültüsü + fbm ile bulutsu
export const nebulaTex = (seed: number) => cv(256, (g, n) => {
  const img = g.createImageData(n, n); let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const G = 16, grid = Array.from({ length: (G + 1) * (G + 1) }, rnd);
  const noise = (x: number, y: number, f: number) => {
    x *= f; y *= f; const xi = Math.floor(x) % G, yi = Math.floor(y) % G, xf = x - Math.floor(x), yf = y - Math.floor(y);
    const v = (i: number, j: number) => grid[((yi + j) % G) * (G + 1) + ((xi + i) % G)];
    const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    return (v(0, 0) * (1 - sx) + v(1, 0) * sx) * (1 - sy) + (v(0, 1) * (1 - sx) + v(1, 1) * sx) * sy;
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = x / n, w = y / n; let f = 0, a = 0.5, fr = 4;
    for (let o = 0; o < 5; o++) { f += noise(u, w, fr) * a; a *= 0.5; fr *= 2; }
    const d = Math.hypot(u - 0.5, w - 0.5) * 2, m = Math.max(0, 1 - d * d) ** 1.6;
    const v = Math.max(0, f - 0.38) * 2.4 * m;
    const i = (y * n + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.min(255, v * 255);
  }
  g.putImageData(img, 0, 0);
});
