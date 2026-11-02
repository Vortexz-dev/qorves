// El yapımı üstten görünüm mobilya/ekipman çizimleri (SVG, metre biriminde). Her oda kendi kutusuna (0,0)-(w,h) çizilir.
import type { RoomKind } from './plan';
const f = (n: number) => +n.toFixed(2);
const r = (x: number, y: number, w: number, h: number, c = 'fu', rx = 0.08) => `<rect class="${c}" x="${f(x)}" y="${f(y)}" width="${f(Math.max(0.05, w))}" height="${f(Math.max(0.05, h))}" rx="${rx}"/>`;
const c = (x: number, y: number, rr: number, cl = 'fu') => `<circle class="${cl}" cx="${f(x)}" cy="${f(y)}" r="${f(rr)}"/>`;
const l = (x1: number, y1: number, x2: number, y2: number, cl = 'ln') => `<line class="${cl}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
const p = (d: string, cl = 'fu') => `<path class="${cl}" d="${d}"/>`;
/** Koltuk: sırtı `dir` yönünde (0 sağ,1 aşağı,2 sol,3 yukarı). */
function seat(x: number, y: number, s = 0.62, dir = 2, cl = 'st') {
  const b = s * 0.26; const back = [r(x + s - b, y, b, s, 'sb', 0.1), r(x, y + s - b, s, b, 'sb', 0.1), r(x, y, b, s, 'sb', 0.1), r(x, y, s, b, 'sb', 0.1)][dir];
  return r(x, y, s, s, cl, 0.14) + back;
}
function bed(x: number, y: number, w = 2, h = 0.9, vert = false) {
  const W = vert ? h : w, H = vert ? w : h;
  const pil = vert ? r(x + 0.12, y + 0.1, W - 0.24, 0.36, 'pl', 0.1) : r(x + 0.1, y + 0.12, 0.36, H - 0.24, 'pl', 0.1);
  const blanket = vert ? r(x + 0.04, y + H * 0.42, W - 0.08, H * 0.56, 'bk', 0.06) : r(x + W * 0.42, y + 0.04, W * 0.56, H - 0.08, 'bk', 0.06);
  return r(x, y, W, H, 'bd', 0.08) + pil + blanket + (vert ? l(x + 0.04, y + H * 0.42, x + W - 0.04, y + H * 0.42, 'ln2') : l(x + W * 0.42, y + 0.04, x + W * 0.42, y + H - 0.04, 'ln2'));
}
function crate(x: number, y: number, s: number, hazard = false) {
  return r(x, y, s, s, hazard ? 'cr hz' : 'cr', 0.04) + l(x + 0.06, y + 0.06, x + s - 0.06, y + s - 0.06, 'ln2') + l(x + s - 0.06, y + 0.06, x + 0.06, y + s - 0.06, 'ln2') + r(x + s * 0.38, y - 0.02, s * 0.24, s + 0.04, 'strap', 0.01);
}
function crates(w: number, h: number, aisle = 0.9, s = 0.85) {
  let o = ''; const cols = Math.max(1, Math.floor((w - 0.3) / (s + 0.12))), rows = Math.max(1, Math.floor((h - aisle - 0.2) / (s + 0.12)));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { if ((i * 7 + j * 3) % 5 === 4) continue; o += crate(0.18 + i * (s + 0.12), h - 0.15 - s - j * (s + 0.12), s, (i + j) % 6 === 2); }
  for (let i = 0; i < w - 0.6; i += 0.9) o += l(0.3 + i, 0.25, 0.3 + i + 0.45, 0.25, 'tape');
  return o;
}
function screen(x: number, y: number, w: number, vert = false) { return vert ? r(x, y, 0.12, w, 'scr', 0.03) : r(x, y, w, 0.12, 'scr', 0.03); }
function console_(x: number, y: number, w: number, h: number) { let o = r(x, y, w, h, 'cs', 0.1); for (let i = 0.25; i < w - 0.2; i += 0.45) o += r(x + i, y + h * 0.25, 0.28, h * 0.4, 'scr', 0.03); return o; }
function rack(x: number, y: number, w: number, h: number) { let o = r(x, y, w, h, 'rk', 0.03); for (let i = 0.12; i < h - 0.08; i += 0.22) o += l(x + 0.06, y + i, x + w - 0.06, y + i, 'led'); return o; }
const n = (name: string) => +((/(\d+)\s*yatak/.exec(name) ?? [])[1] ?? 2);

export function furn(kind: RoomKind, w: number, h: number, name = ''): string {
  switch (kind) {
    case 'cockpit': { // ön konsol yayı, pilot + yardımcı koltuğu, arkada navigasyon masası
      let o = p(`M${f(w - 1.1)} 0.15 Q${f(w - 0.15)} ${f(h / 2)} ${f(w - 1.1)} ${f(h - 0.15)} L${f(w - 0.55)} ${f(h - 0.15)} Q${f(w + 0.25)} ${f(h / 2)} ${f(w - 0.55)} 0.15 Z`, 'cs');
      for (let i = 0; i < 5; i++) { const t = 0.18 + i * 0.16, yy = 0.5 + t * (h - 1); o += r(w - 0.95 + Math.abs(t - 0.5) * 0.5, yy, 0.22, 0.4, 'scr', 0.03); }
      o += seat(w - 2.15, h * 0.28 - 0.4, 0.8, 2, 'st pil') + seat(w - 2.15, h * 0.72 - 0.4, 0.8, 2) + c(w - 1.6, h / 2, 0.18, 'fc');
      o += r(0.3, h / 2 - 0.55, 0.9, 1.1, 'tb', 0.12) + c(0.75, h / 2, 0.3, 'holo') + seat(0.35, 0.25, 0.55, 3) + seat(0.35, h - 0.8, 0.55, 1);
      return o;
    }
    case 'bridge2': { const cx = w - 0.6; let o = p(`M${f(cx - 0.55)} 0.35 Q${f(cx + 0.4)} ${f(h / 2)} ${f(cx - 0.55)} ${f(h - 0.35)} L${f(cx)} ${f(h - 0.35)} Q${f(cx + 0.75)} ${f(h / 2)} ${f(cx)} 0.35 Z`, 'cs');
      for (let i = 0; i < 4; i++) o += r(cx - 0.32 + Math.abs(i - 1.5) * -0.12, 0.75 + i * ((h - 1.9) / 3), 0.2, 0.36, 'scr', 0.03);
      o += seat(w - 2, h / 2 - 1.05, 0.75, 2, 'st pil') + seat(w - 2, h / 2 + 0.3, 0.75, 2) + r(w / 2 - 1.2, h / 2 - 0.6, 1.6, 1.2, 'tb', 0.1) + c(w / 2 - 0.4, h / 2, 0.38, 'holo') + rack(0.25, 0.25, 0.5, h - 0.5) + r(0.95, 0.25, 1.4, 0.45, 'lk', 0.04) + r(0.95, h - 0.7, 1.4, 0.45, 'lk', 0.04);
      return o + (name.includes('Mekanik') ? [0, 1, 2].map((i) => c(w - 2.6, 0.8 + i * 0.35, 0.12, 'gauge')).join('') + p(`M${f(w - 3.2)} ${f(h - 0.6)} h0.9`, 'pipe') : ''); }
    case 'lounge': { // L koltuk, sehpa, duvar ekranı, mini mutfak tezgâhı
      let o = r(1.95, h - 0.95, w - 2.35, 0.75, 'sf', 0.18) + r(w - 1.15, 1.4, 0.75, h - 2.35, 'sf', 0.18);
      for (let x = 2.15; x < w - 1.4; x += 0.95) o += r(x, h - 0.85, 0.85, 0.5, 'cu', 0.14);
      o += r(w - 2.9, h - 2.55, 1.35, 0.9, 'tb', 0.14) + c(w - 2.22, h - 2.1, 0.12, 'fa') + screen(2.3, 0.2, 2.2) + r(w - 2.6, 0.2, 2.2, 0.6, 'ct', 0.05) + c(w - 2.1, 0.5, 0.17, 'sk') + c(w - 1.2, 0.5, 0.17, 'stv');
      o += r(0.25, 2.1, 0.55, 1.3, 'tb', 0.08) + seat(0.95, 2.4, 0.6, 2);
      return o;
    }
    case 'bunk': return bed(0.2, h - 1.05, Math.min(2.05, w - 1.3), 0.85) + bed(w - 1.1, 0.25, Math.min(1.9, h - 0.4), 0.85, true) + r(0.2, 0.15, 1.2, 0.45, 'lk', 0.04) + l(0.8, 0.15, 0.8, 0.6, 'ln2') + c(w - 1.55, h - 0.5, 0.14, 'fa');
    case 'wc': return p(`M0.35 ${f(h - 0.25)} h0.62 v-0.35 a0.31 0.42 0 1 0 -0.62 0 Z`, 'wc') + r(0.35, h - 0.35, 0.62, 0.18, 'cs', 0.04) + r(w - 0.95, 0.2, 0.75, 0.45, 'ct', 0.08) + c(w - 0.57, 0.42, 0.14, 'sk') + r(w - 1.05, h - 1.05, 0.85, 0.85, 'shw', 0.05) + c(w - 0.62, h - 0.62, 0.08, 'fc');
    case 'hold': case 'ore': case 'scrap': {
      if (kind === 'hold') return crates(w, h);
      let o = ''; const m = kind === 'ore' ? 'ore' : 'scrp'; let seed = Math.round(w * 97 + h * 13);
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let x = 0.3; x < w - 1.4; x += 1.8) {
        o += r(x, h - 1.75, 1.5, 1.5, 'bin', 0.06) + r(x + 0.06, h - 1.69, 1.38, 1.38, 'binf', 0.04);
        for (let k = 0; k < 9; k++) { const cx = x + 0.25 + rnd() * 1.0, cy = h - 1.5 + rnd() * 1.0, s2 = 0.1 + rnd() * 0.16;
          o += m === 'ore' ? c(cx, cy, s2, rnd() > 0.8 ? 'oreg' : 'ore') : p(`M${f(cx)} ${f(cy - s2)} l${f(s2 * 1.3)} ${f(s2 * 0.6)} l${f(-s2 * 0.4)} ${f(s2 * 1.1)} l${f(-s2 * 1.2)} ${f(-s2 * 0.3)} Z`, rnd() > 0.7 ? 'scrr' : 'scrp'); }
      }
      return o + l(0.3, 0.25, w - 0.3, 0.25, 'tape');
    }
    case 'engine': { // iki motor gövdesi, kanatçıklar, borular
      let o = '';
      for (const yy of [0.35, h / 2 + 0.1]) { const hh = h / 2 - 0.45; o += r(0.3, yy, w - 1.3, hh, 'eng', hh / 2); for (let x = 0.9; x < w - 1.4; x += 0.42) o += l(x, yy + 0.1, x, yy + hh - 0.1, 'rib'); o += c(w - 1.15, yy + hh / 2, hh * 0.32, 'glw'); }
      o += p(`M${f(w - 0.95)} ${f(h * 0.3)} C${f(w - 0.3)} ${f(h * 0.3)} ${f(w - 0.3)} ${f(h * 0.7)} ${f(w - 0.95)} ${f(h * 0.7)}`, 'pipe') + console_(w - 0.75, h - 1.25, 0.5, 0.9);
      return o;
    }
    case 'core': { // Skarn çekirdeği: halkalı merkez, kontrol konsolu, soğutma hatları
      const cx = w / 2, cy = h / 2 + 0.1, R0 = Math.min(w, h) * 0.3;
      let o = c(cx, cy, R0 + 0.35, 'ring') + c(cx, cy, R0, 'corec') + c(cx, cy, R0 * 0.55, 'coreg') + c(cx, cy, R0 * 0.22, 'corew');
      for (let a = 0; a < 6; a++) { const t = (a / 6) * Math.PI * 2; o += l(cx + Math.cos(t) * (R0 + 0.38), cy + Math.sin(t) * (R0 + 0.38), cx + Math.cos(t) * (R0 + 0.9), cy + Math.sin(t) * (R0 + 0.9), 'pipe'); }
      return o + console_(0.25, 0.25, 1.3, 0.45) + r(w - 0.8, h - 0.9, 0.55, 0.65, 'lk', 0.04);
    }
    case 'corridor': case 'tank': { let o = ''; for (let x = 0.25; x < w; x += 0.5) o += l(x, 0.12, x, h - 0.12, 'grt'); return o; }
    case 'cabin': { const k = n(name), cols = Math.ceil(k / 2), bw = Math.min(2, (w - 0.4) / cols - 0.15); let o = ''; for (let i = 0; i < cols; i++) { o += bed(0.2 + i * (bw + 0.15), 0.2, bw, 0.85) + (i * 2 + 1 < k ? bed(0.2 + i * (bw + 0.15), h - 1.05, bw, 0.85) : ''); } return o + r(w - 0.75, h / 2 - 0.4, 0.5, 0.8, 'lk', 0.04); }
    case 'commons': return r(w / 2 - 1, h / 2 - 0.55, 2, 1.1, 'tb', 0.25) + [0, 1].map((i) => seat(w / 2 - 0.85 + i * 1.1, h / 2 - 1.3, 0.55, 3) + seat(w / 2 - 0.85 + i * 1.1, h / 2 + 0.75, 0.55, 1)).join('') + r(0.25, 0.2, w * 0.4, 0.7, 'sf', 0.2) + screen(w - 0.3, 0.5, h - 1, true);
    case 'galley': { let o = r(0.2, 0.2, w - 0.4, 0.6, 'ct', 0.05) + r(w - 0.8, 0.2, 0.6, h - 0.4, 'ct', 0.05); o += c(0.7, 0.5, 0.18, 'stv') + c(1.2, 0.5, 0.18, 'stv') + c(w - 0.5, h - 0.7, 0.18, 'sk'); return o + r(0.5, h / 2 - 0.3, Math.max(0.8, w - 2.2), 0.8, 'tb', 0.1); }
    case 'pantry': case 'samples': { let o = ''; for (let x = 0.2; x < w - 0.5; x += 0.75) o += r(x, 0.2, 0.6, h - 0.4, kind === 'pantry' ? 'shf' : 'cab', 0.03); for (let x = 0.2; x < w - 0.5; x += 0.75) for (let y = 0.5; y < h - 0.4; y += 0.5) o += l(x + 0.05, y, x + 0.55, y, 'ln2'); return o; }
    case 'turret': { const cx = w / 2, cy = h / 2, R0 = Math.min(w, h) * 0.32; return c(cx, cy, R0 + 0.25, 'ring') + c(cx, cy, R0, 'tur') + r(cx, cy - 0.16, R0 + 1.3, 0.32, 'brl', 0.08) + r(cx, cy - 0.5, R0 + 0.9, 0.16, 'brl', 0.05) + seat(cx - 0.35, cy - 0.35, 0.7, 2) + p(`M0.3 0.3 h0.6 v1.3 h-0.6 Z`, 'lad') + l(0.3, 0.6, 0.9, 0.6, 'ln2') + l(0.3, 0.95, 0.9, 0.95, 'ln2') + l(0.3, 1.3, 0.9, 1.3, 'ln2'); }
    case 'armory': { let o = ''; for (let x = 0.25; x < w - 0.4; x += 0.42) o += r(x, 0.2, 0.3, 0.9, 'gun', 0.03); return o + r(0.25, h - 0.95, w - 0.5, 0.7, 'lk', 0.04) + r(w / 2 - 0.5, h / 2 - 0.3, 1, 0.6, 'tb', 0.05); }
    case 'server': { let o = ''; for (let x = 0.3; x < w - 0.6; x += 1.15) o += rack(x, 0.25, 0.6, h - 0.5); return o; }
    case 'netrun': return p(`M${f(w / 2 - 1)} ${f(h - 0.3)} Q${f(w / 2)} ${f(h - 2.1)} ${f(w / 2 + 1)} ${f(h - 0.3)}`, 'arc') + seat(w / 2 - 0.4, h - 1.3, 0.8, 1, 'st pil') + screen(w / 2 - 0.8, h - 2.05, 1.6) + c(w / 2, h - 0.9, 0.08, 'fc');
    case 'studio': return c(w / 2, h / 2 + 0.2, Math.min(w, h) * 0.28, 'holo') + c(w / 2, h / 2 + 0.2, 0.15, 'fc') + seat(w / 2 - 0.3, h / 2 + 0.85, 0.6, 1) + r(0.3, 0.3, 0.5, 0.5, 'cam', 0.05) + r(w - 0.8, 0.3, 0.5, 0.5, 'cam', 0.05) + p(`M0.55 0.8 L${f(w / 2 - 0.6)} ${f(h / 2)}`, 'beam') + p(`M${f(w - 0.55)} 0.8 L${f(w / 2 + 0.6)} ${f(h / 2)}`, 'beam');
    case 'desk': return console_(0.3, 0.25, w - 0.6, 0.6) + seat(w / 2 - 0.8, 1.05, 0.6, 1) + seat(w / 2 + 0.2, 1.05, 0.6, 1) + rack(w - 0.75, h - 1.2, 0.5, 0.95);
    case 'meeting': return `<ellipse class="tb" cx="${f(w / 2)}" cy="${f(h / 2)}" rx="${f(Math.min(1.3, w / 2 - 0.9))}" ry="0.6"/>` + seat(w / 2 - 1.05, h / 2 - 1.35, 0.55, 3) + seat(w / 2 + 0.45, h / 2 - 1.35, 0.55, 3) + seat(w / 2 - 1.05, h / 2 + 0.8, 0.55, 1) + seat(w / 2 + 0.45, h / 2 + 0.8, 0.55, 1);
    case 'medbay': { const k = n(name); let o = '';
      for (let i = 0; i < k; i++) { const x = 0.35 + i * 1.55; o += p(`M${f(x - 0.15)} ${f(h - 2.5)} h1.25`, 'curt') + r(x, h - 2.25, 0.95, 2, 'mbd', 0.15) + r(x + 0.1, h - 2.15, 0.75, 0.35, 'pl', 0.1) + r(x + 0.12, h - 1.6, 0.71, 1.25, 'sht', 0.1) + r(x + 1.0, h - 2.2, 0.32, 0.45, 'cs', 0.04) + r(x + 1.04, h - 2.14, 0.24, 0.18, 'scr', 0.02); }
      const ox = 0.35 + k * 1.55 + 0.6;
      if (w - ox > 2.2) o += c(ox + (w - ox - 1) / 2, h / 2 + 0.2, 0.75, 'olamp') + r(ox + (w - ox - 1) / 2 - 0.35, h / 2 - 0.8, 0.7, 2, 'mbd', 0.12);
      o += r(w - 0.85, 0.2, 0.6, 1.4, 'cab', 0.04) + p(`M${f(w - 0.55)} 0.55 v0.7 M${f(w - 0.9)} 0.9 h0.7`, 'crs') + r(w - 0.85, h - 1.3, 0.6, 1.05, 'cab', 0.04) + r(0.35, 0.2, Math.min(2.4, w - 1.6), 0.5, 'ct', 0.04) + c(0.7, 0.45, 0.13, 'sk');
      return o; }
    case 'cryo': return r(w / 2 - 0.55, 0.3, 1.1, h - 0.6, 'pod', 0.5) + r(w / 2 - 0.35, 0.6, 0.7, h - 1.2, 'podg', 0.32) + console_(0.2, h - 0.8, 0.8, 0.5);
    case 'dig': { const cx = w / 2, cy = h / 2 + 0.1; return c(cx, cy, 1, 'ring') + c(cx, cy, 0.7, 'drl') + p(`M${f(cx)} ${f(cy - 0.7)} L${f(cx + 0.15)} ${f(cy)} L${f(cx)} ${f(cy + 0.7)} M${f(cx - 0.7)} ${f(cy)} L${f(cx)} ${f(cy + 0.15)} L${f(cx + 0.7)} ${f(cy)}`, 'pipe') + console_(0.2, 0.2, 1.2, 0.5); }
    case 'salvage': return seat(w / 2 - 0.4, h / 2 - 0.4, 0.8, 2, 'st pil') + p(`M${f(w / 2 + 0.6)} ${f(h / 2 - 1)} q0.8 1 0 2`, 'arc') + console_(w / 2 + 0.3, h / 2 - 0.7, 0.4, 1.4) + r(0.2, 0.2, 0.6, 0.6, 'lk', 0.04) + c(w / 2 - 0.65, h / 2 + 0.75, 0.16, 'gauge') + c(w / 2 - 0.65, h / 2 - 0.75, 0.16, 'gauge') + r(0.2, h - 1.1, 0.9, 0.85, 'tool', 0.04) + p(`M0.3 ${f(h - 0.7)} h0.7 M0.3 ${f(h - 0.45)} h0.7`, 'ln2');
    case 'hidden': return crate(0.2, h - 1, 0.75) + (w > 1.6 ? crate(1.05, h - 1, 0.75) : '') + p(`M0.15 0.2 L${f(w - 0.15)} ${f(h - 0.2)}`, 'hid');
    case 'fakewall': { let o = ''; for (let y = 0.1; y < h; y += 0.3) o += l(0.05, y, w - 0.05, y + 0.2, 'hatch'); return o; }
    case 'hangar': { const vw = Math.min(4.2, w - 1.4), vh = Math.min(2.2, h - 1); const x = (w - vw) / 2 + 0.3, y = (h - vh) / 2;
      return r(x - 0.4, y - 0.4, vw + 0.8, vh + 0.8, 'pad', 0.1) + p(`M${f(x)} ${f(y + 0.25)} h${f(vw * 0.72)} l${f(vw * 0.28)} ${f(vh * 0.2)} v${f(vh * 0.6 - 0.5)} l${f(-vw * 0.28)} ${f(vh * 0.2)} h${f(-vw * 0.72)} Z`, 'veh') + r(x + vw * 0.45, y + 0.5, vw * 0.25, vh - 1, 'scr', 0.1) + [y - 0.12, y + vh - 0.02].map((yy) => [x + 0.3, x + vw - 1.2].map((xx) => r(xx, yy, 0.8, 0.14, 'whl', 0.05)).join('')).join(''); }
    case 'maint': return r(0.2, 0.2, w - 0.4, 0.6, 'ct', 0.04) + [0.5, 1.1, 1.6].map((x) => r(x, 0.3, 0.3, 0.35, 'tool', 0.03)).join('') + r(w - 1, h - 1.3, 0.8, 1.1, 'lk', 0.04) + c(w / 2, h / 2 + 0.3, 0.45, 'pad');
    case 'lab': { let o = r(0.2, 0.2, w - 0.4, 0.65, 'ct', 0.04) + r(0.9, h - 0.95, w - 1.8, 0.7, 'ct', 0.04); for (let x = 0.5; x < w - 0.6; x += 1.1) o += c(x, 0.52, 0.17, 'gls') + r(x + 0.3, 0.32, 0.4, 0.38, 'scr', 0.04); return o + c(w / 2, h - 0.6, 0.2, 'gls'); }
    case 'ramp': { let o = r(0.15, 0.15, w - 0.3, h - 0.3, 'rmp', 0.05); for (let y = 0.6; y < h - 0.4; y += 0.8) o += p(`M0.4 ${f(y)} l0.5 0.3 l-0.5 0.3`, 'chev'); return o; }
    case 'armorlock': return r(0.2, 0.2, 0.55, h - 0.4, 'lk', 0.04) + r(w - 0.75, 0.2, 0.55, h - 0.4, 'lk', 0.04) + p(`M${f(w / 2 - 0.5)} ${f(h / 2)} h1`, 'hz2');
  }
  return '';
}
