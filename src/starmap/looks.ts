/*
 * Her gök cismine kendi yüzeyi: sınıf + Kodeks verisi (tür, atmosfer, sıcaklık, yaşam, açıklama) + cisme özgü tohum.
 * Gaz devleri sıcaklığa göre Sudarsky sınıflarına, buz devleri metan oranına göre ayrılır. Şehir ışıkları yalnız lore'da yerleşim olan cisimlerde.
 */
import * as THREE from 'three';
import type { Body } from '../lib/kb.svelte';
export interface Look { sh: number; c1: THREE.Color; c2: THREE.Color; c3: THREE.Color; c4: THREE.Color; P: THREE.Vector4; Q: THREE.Vector4; atm: THREE.Color; atmS: number; city: number; cityMode: number; ring?: string }
const SH: Record<string, number> = { rocky: 0, hot: 0, iron: 0, cold: 0, terran: 1, garden: 15, ocean: 2, gas: 3, icegiant: 4, stripped: 4, ice: 5, lava: 6, desert: 7, savanna: 7, karst: 16, jungle: 8, snow: 9, volcanic: 10, glass: 11, venus: 12, smog: 13, locked: 14 };
/** Yanlış sınıflanmış cisimler (Kodeks tanımına göre). */
const CLS_FIX: Record<string, string> = { Hrima: 'ice', Sarnel: 'iron', Paludra: 'jungle', Ostrav: 'terran', Myrkdal: 'locked', Brennr: 'locked', Thognstein: 'cold' };
/** Yerleşim ışıkları: [yoğunluk 0..1, kip] — 0 seyrek, 1 kıyı, 2 vadi, 3 alacakaranlık, 4 ekümenopolis, 5 tek üs. Lore'daki nüfusa göre. */
export const CITY_SPEC: Record<string, [number, number]> = {
  Prosperion: [1, 4], Concordia: [0.62, 1], Astarion: [0.55, 1], Imperion: [0.42, 1], Velmor: [0.4, 1], Ilvarë: [0.32, 0], Aurelia: [0.3, 0], Isil: [0.16, 0],
  Vaeloran: [0.16, 0], Tharyn: [0.1, 0], Pyra: [0.12, 0], Corvallis: [0.42, 2], Castellan: [0.4, 3], Nattmar: [0.35, 3], Ostrav: [0.24, 1], Salinas: [0.14, 0],
  'Taht Kayası (Thronehold)': [0.12, 0], Jarnhald: [0.1, 0],
  Vigil: [0.05, 5], Rubigo: [0.09, 5], Lumen: [0.1, 5], Signum: [0.08, 5], Custos: [0.09, 5], Ketilmark: [0.1, 5], Thognstein: [0.07, 5], Tel: [0.05, 5], Eredh: [0.03, 5],
  Sarnel: [0.07, 5], Scintilla: [0.08, 5], Sicca: [0.05, 5], Curva: [0.05, 5], Tacita: [0.05, 5], Frigida: [0.07, 5], Albus: [0.05, 5], Skeld: [0.07, 5], Skjold: [0.1, 5],
  Cisterna: [0.05, 5], Storkjarn: [0.04, 5], Belg: [0.11, 5], Gnaga: [0.07, 5],
};
const C = (x: string) => new THREE.Color(x);
const hs = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
function rng(seed: number) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const tempOf = (s?: string) => { const m = (s ?? '').replace(/−/g, '-').match(/([+-]?\d[\d.]*)(,\d+)?\s*(\/[^°]*)?°?\s*C/); if (!m) return NaN; return parseFloat(m[1].replace(/\./g, '') + (m[2] ? '.' + m[2].slice(1) : '')); };
const barOf = (s?: string) => { const m = (s ?? '').match(/(\d+(?:,\d+)?)\s*bar/); return m ? parseFloat(m[1].replace(',', '.')) : NaN; };
const jit = (c: THREE.Color, r: () => number, hue = 0.03, li = 0.08) => c.offsetHSL((r() - 0.5) * hue, (r() - 0.5) * 0.1, (r() - 0.5) * li);
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length) % a.length];

export function lookOf(b: Body): Look {
  const r = rng(hs(b.id + b.name)); const cls = CLS_FIX[b.name] ?? b.cls; const T = tempOf(b.temp), bar = barOf(b.atm);
  const txt = `${b.type} ${b.atm ?? ''} ${b.life ?? ''} ${b.desc ?? ''}`.toLocaleLowerCase('tr');
  const L: Look = { sh: SH[cls] ?? 0, c1: C('#6e6a64'), c2: C('#a49c90'), c3: C('#4a4744'), c4: C('#cfd8e0'), P: new THREE.Vector4(0.8 + r() * 0.7, 0.2 + r() * 0.6, 0.6, 0), Q: new THREE.Vector4(0.02, 0, 0.8 + r() * 0.5, 0),
    atm: C('#9aa4b0'), atmS: 0, city: 0, cityMode: 0 };
  const set = (a: string, b2: string, c: string, d: string) => { L.c1.set(a); L.c2.set(b2); L.c3.set(c); L.c4.set(d); };
  const airless = !b.atm || /^yok/i.test(b.atm) || b.atm === '—';
  switch (cls) {
    case 'rocky': case 'hot': case 'cold': case 'iron': {
      const v = cls === 'iron' ? 'metal' : cls === 'hot' ? pick(r, ['merkür', 'kül', 'kavruk', 'bazalt', 'kükürt']) : cls === 'cold' ? 'donmuş' : T < -100 ? pick(r, ['kalisto', 'donmuş', 'ay']) : pick(r, ['ay', 'okr', 'bazalt', 'anortozit', 'kalisto']);
      const pal: Record<string, [string, string, string, string]> = { ay: ['#6e6a64', '#a49c90', '#4a4744', '#c8c4bc'], okr: ['#6e5440', '#a8865e', '#4e3a2c', '#c8a070'], bazalt: ['#3a3634', '#625c56', '#26221f', '#8a8078'],
        anortozit: ['#8a8680', '#c8c2b8', '#6a6660', '#e8e4dc'], kalisto: ['#3e3a34', '#6a645a', '#2a2622', '#d8e0e6'], donmuş: ['#5a6470', '#9aa6b0', '#3e4650', '#e6eef4'],
        merkür: ['#6a6660', '#8e8a84', '#4e4a46', '#b0aaa0'], kül: ['#262424', '#46403c', '#181616', '#6a5a4a'], kavruk: ['#5a3a2a', '#9a6a4a', '#3a2418', '#c8885a'], kükürt: ['#5a5040', '#8a7a58', '#3e3628', '#d8c060'], metal: ['#3e3e44', '#7d6a58', '#2a2a30', '#c8b070'] };
      set(...pal[v]); jit(L.c1, r); jit(L.c2, r); L.P.z = airless ? 0.55 + r() * 0.45 : 0.2 + r() * 0.2; L.Q.w = v === 'kalisto' || v === 'donmuş' ? 0.35 + r() * 0.3 : v === 'kükürt' ? 0.5 : r() * 0.2;
      if (T < -120 || cls === 'cold') L.P.w = 0.3 + r() * 0.4; if (!airless) { L.atmS = 0.25; L.Q.y = 0.15; }
      if (/demir kül/.test(txt)) set('#1e1c1c', '#3a3430', '#121010', '#5a4a3a');
      if (/so₂/.test(txt)) { L.c4.set('#d8c060'); L.Q.w = 0.6; L.atm.set('#e8d070'); L.atmS = 0.3; }
      if (/ayna tarla/.test(txt)) { L.c4.set('#d8e8ff'); L.Q.w = 0.7; }
      if (/yarı terraform/.test(txt)) { set('#8a3a22', '#b8643c', '#5a2410', '#5a6a4a'); L.Q.w = 0.35; L.P.z = 0.25; L.atm.set('#e0a080'); L.atmS = 0.3; L.Q.y = 0.12; } // Rubigo: pas ve yer yer liken
      if (/metal zengini/.test(txt)) { set('#4a4440', '#8a7a60', '#2e2a28', '#d8b860'); L.Q.w = 0.5; L.P.z = 0.3; }
      break; }
    case 'terran': case 'garden': {
      set('#3f6b34', '#8a7a52', '#1d4f8f', '#c8a060'); L.Q.x = 0.02; L.Q.y = 0.45 + r() * 0.2; L.P.w = 0.45 + r() * 0.2; L.P.z = 0.15; L.atm.set('#6fb0ff'); L.atmS = 0.9;
      if (T < 8) { L.P.w = 0.75; L.c1.set('#3a5a3a'); L.c2.set('#7a7a62'); } if (T > 20) { L.P.w = 0.3; L.P.z = 0.45; L.c2.set('#a88a58'); }
      jit(L.c1, r, 0.06, 0.1); jit(L.c2, r, 0.05, 0.1); jit(L.c3, r, 0.04, 0.08);
      const F: Record<string, () => void> = {
        Ilvarë: () => { set('#2f6a2e', '#5a7a3a', '#1a4a86', '#8a8a5a'); L.Q.x = 0.0; L.Q.y = 0.55; },
        Tharyn: () => { set('#6a7a44', '#b49a68', '#2a5a7a', '#e6dcc8'); L.Q.x = -0.14; L.P.z = 0.7; L.Q.y = 0.3; },
        Aelum: () => { set('#7a7050', '#b89a6a', '#2a4a6a', '#d0b080'); L.Q.x = -0.18; L.P.z = 0.8; L.P.w = 0.15; L.Q.y = 0.2; },
        Vaeloran: () => { set('#3a6a3a', '#7a8a52', '#1f4f7f', '#a89060'); L.Q.x = 0.04; L.Q.y = 0.6; },
        Isil: () => { set('#3e5a44', '#8a8a78', '#22486a', '#b0a888'); L.P.w = 0.85; L.Q.w = 0.5; L.Q.y = 0.55; },
        Abundia: () => { set('#40583a', '#7a7a6a', '#1e3e66', '#a09a80'); L.P.w = 1.0; L.Q.w = 0.6; L.Q.y = 0.6; },
        Concordia: () => { set('#4a6e38', '#9a8a5a', '#1d4a88', '#c0a060'); L.Q.x = -0.01; L.Q.y = 0.45; },
        Astarion: () => { set('#356e30', '#6a7a42', '#1a4f90', '#8a7a50'); L.Q.x = 0.03; L.Q.y = 0.5; },
        Aurelia: () => { set('#4a8a3a', '#7aa04a', '#2a6aa0', '#c8b070'); L.Q.x = 0.02; L.Q.y = 0.4; },
        Imperion: () => { set('#4f7a3a', '#9a8a50', '#2a5a8a', '#d0a868'); L.Q.x = -0.04; L.P.z = 1.0; L.Q.y = 0.35; },
        'Taht Kayası (Thronehold)': () => { set('#5a6050', '#8a8a80', '#2a4a6a', '#9a9080'); L.Q.x = -0.12; L.Q.w = 0.9; L.P.w = 0.6; L.P.x = 1.6; },
        Dorh: () => { set('#5a6a2a', '#a08a3a', '#2a4a3a', '#b8903a'); L.Q.x = -0.06; L.P.z = 0.5; L.P.w = 0.05; L.atm.set('#e0d080'); L.Q.y = 0.55; },
        Fecunda: () => { set('#3a7a40', '#7a9a52', '#1a5a9a', '#b0a070'); L.Q.x = 0.05; L.Q.y = 0.4; },
        Ostrav: () => { set('#5a6248', '#8a8270', '#2a4050', '#a09070'); L.Q.x = 0.1; L.P.w = 0.6; L.Q.y = 0.5; L.atmS = 0.6; },
        'Nys-c': () => { set('#4a6a40', '#8a8a60', '#20507a', '#b09a68'); },
        Devereux: () => { set('#4c8a3a', '#7a9a4a', '#2a6a9a', '#a0a060'); L.Q.x = 0.12; L.P.w = 0.2; L.Q.y = 0.3; },
      }; F[b.name]?.(); break; }
    case 'ocean': set('#5b6b3a', '#5b6b3a', '#12407e', '#2aa0a8'); L.Q.x = 0.3; L.Q.y = 0.5; L.P.w = 0.4; L.atm.set('#6fb0ff'); L.atmS = 1;
      if (b.name === 'Nimrael') { L.Q.x = 0.42; L.c3.set('#0e3466'); L.P.w = 0.7; } if (b.name === 'Velmor') { L.Q.x = 0.06; L.c1.set('#4f7a3a'); L.c3.set('#1a5a9a'); } if (b.name === 'Vadum') { L.Q.x = 0.28; L.c4.set('#30c0b8'); L.P.w = 0.1; }
      jit(L.c3, r, 0.04, 0.06); break;
    case 'gas': { // Sudarsky: I amonyak (soğuk, bej-kahve), II su bulutu (ılık, beyaz), soğuk uçta pus
      const t = isNaN(T) ? -140 : T, mass = parseFloat((b.grav ?? '').replace(',', '.')) || 2;
      const big = /~300|~40/.test(b.grav ?? '') ? (/300/.test(b.grav ?? '') ? 3 : 1) : mass;
      const pals: [string, string, string, string][] = t > -95 ? [['#c8c4bc', '#f4f0e8', '#8a9aa8', '#e8e0d0'], ['#b8b4aa', '#ecebe4', '#9aa0a8', '#c8a888']]
        : t > -170 ? [['#a8744a', '#ecdcc0', '#7a4a2a', '#c86a40'], ['#b89a70', '#efe2c8', '#8a6a48', '#d08a5a'], ['#9a7a5a', '#e2d2b4', '#6a4a34', '#b8603a'], ['#c0a070', '#f0e4c4', '#a07848', '#e0b080']]
        : [['#a8a088', '#e0dcc8', '#8a8470', '#c8c0a0'], ['#9aa4a8', '#d8e0e2', '#7a8a90', '#b0c0c8']];
      set(...pick(r, pals)); jit(L.c1, r, 0.04, 0.08); jit(L.c2, r, 0.03, 0.06);
      L.Q.x = 14 + Math.min(big, 3.2) * 4 + r() * 10; L.P.y = 0.5 + r() * 1.3; L.P.z = r() < 0.75 ? 0.35 + r() * 0.65 : 0; L.Q.z = t < -170 ? 0.45 + r() * 0.2 : 0.8 + r() * 0.5;
      L.atm.copy(L.c2); L.atmS = 0.45;
      if (b.name === 'Papaver') set('#d8c878', '#f4ecc0', '#c8b060', '#e8d890');
      if (b.name === 'Mernoth') { set('#2e2924', '#4e4339', '#201a16', '#6a5a48'); L.Q.z = 0.6; L.atm.set('#5a4a3a'); }
      if (b.name === 'Hathra') { set('#c8a868', '#eedcb0', '#a8844a', '#e8c88a'); L.Q.z = 0.55; L.Q.x = 26; L.ring = '#d8c8a8'; }
      if (b.name === 'Coronet') { set('#8aa8a8', '#cfe0dc', '#6a8a8a', '#e0f0ec'); L.Q.z = 0.4; L.P.z = 0; }
      if (b.name === 'Titan') { set('#b07a4c', '#eadbbd', '#7a4a2a', '#c8603a'); L.P.z = 1; L.Q.x = 30; }
      if (b.name === 'Odlevo') { set('#b8a080', '#e8e0d0', '#8a5a3a', '#d8c0a0'); L.P.z = 0.7; }
      if (b.name === 'Eldfar') { set('#c09070', '#f0e0c8', '#906040', '#e09060'); L.P.z = 1; L.Q.x = 32; }
      break; }
    case 'icegiant': case 'stripped': {
      if (cls === 'stripped') { set('#5a5e64', '#7e8288', '#3a3e44', '#9a9ea4'); L.Q.x = 8; L.Q.z = 0.6; L.P.z = 0; L.Q.y = 0; L.atmS = 0.12; break; }
      const nep = r() < 0.5; set(nep ? '#3a6ad0' : '#7cc4d4', nep ? '#6a9ae8' : '#a8e0ea', nep ? '#1a2a6a' : '#5aa0b4', '#ffffff'); jit(L.c1, r, 0.04, 0.06);
      L.Q.x = 8 + r() * 10; L.P.y = 0.3 + r(); L.P.z = nep ? 0.8 : 0; L.Q.y = nep ? 0.6 : 0.15; L.Q.z = nep ? 1 : 0.5; L.atm.set(nep ? '#6a9aff' : '#9fe8ff'); L.atmS = 0.6; break; }
    case 'ice': set('#bcd2e2', '#ffffff', '#8a6a4a', '#9ab0c4'); L.P.z = 0.25 + r() * 0.3; L.Q.w = r() * 0.4; jit(L.c1, r, 0.03, 0.06);
      if (b.name === 'Hrima') { set('#d8e6f0', '#ffffff', '#7a5a3a', '#a8c4d8'); L.Q.z = 1.3; L.P.z = 0.1; }  // Europa benzeri: çizgisel çatlaklar
      if (b.name === 'Cisterna') { set('#4a4844', '#7a7670', '#2a2826', '#c8d0d8'); L.P.z = 0.6; L.Q.w = 0.5; }  // kirli kuyruklu yıldız çekirdeği
      if (b.name === 'Insigl') { set('#e0e4f0', '#f8f8ff', '#b8a0a0', '#c8a8b0'); L.Q.w = 0.35; }               // azot buzu, pembemsi tolin
      if (b.name === 'Grauwen') { set('#8a96a0', '#c8d4dc', '#5a5048', '#6a7480'); L.P.z = 0.7; }
      if (/ince n₂/.test(txt)) L.atmS = 0.12; break;
    case 'lava': set('#2a1a14', '#ff4a10', '#ffd060', '#000'); L.atm.set('#ff7030'); L.atmS = 0.5; L.P.z = r();
      if (T > 1800) { L.c2.set('#ff7a20'); L.c3.set('#fff0a0'); } if (b.name === 'Follis') { set('#3a3020', '#ff6a20', '#ffc860', '#000'); L.atm.set('#e8d070'); L.atmS = 0.3; } break;
    case 'desert': case 'savanna': {
      set(cls === 'savanna' ? '#b8994e' : '#b5653a', cls === 'savanna' ? '#d6b870' : '#d8a066', cls === 'savanna' ? '#6b5a2a' : '#6a2e1a', cls === 'savanna' ? '#5a7a3a' : '#e8e4dc'); L.atm.set('#e0a070'); L.atmS = 0.5; L.Q.y = 0.15;
      if (b.name === 'Salinas') { set('#a89a88', '#cfc6b8', '#6a5e52', '#f2f0ea'); L.Q.w = 0.8; L.P.w = 0.3; L.atmS = 0.25; }    // tuz düzlükleri
      if (b.name === 'Corvallis') { set('#a8482a', '#d08a52', '#4a1808', '#5a7a4a'); L.Q.w = 0.15; L.atm.set('#ffb090'); }     // kızıl çöl, yeşil vadiler
      if (b.name === 'Ladros') { set('#9a8a68', '#c0b08a', '#4a5a6a', '#7a8a5a'); L.Q.w = 0.25; L.P.w = 0.35; L.atm.set('#a8c0e0'); }
      if (b.name === 'Zafrane') { L.Q.w = 0.45; L.Q.y = 0.3; L.atm.set('#ffd9a0'); }
      jit(L.c1, r); break; }
    case 'karst': set('#9a9a88', '#d8d4c8', '#2b3a2a', '#4a6a3a'); L.Q.w = 0.4; L.atm.set('#9fc4e8'); L.atmS = 0.7; L.Q.y = 0.35; break;
    case 'jungle': set('#1f5a25', '#3f7a2a', '#1d4f7a', '#7a3a1a'); L.Q.x = -0.2; L.Q.y = 0.55; L.atm.set('#8fd0ff'); L.atmS = 1;
      if (b.name === 'Paludra') { set('#5a6a2a', '#8a8a3a', '#3a4a2a', '#a0a050'); L.Q.x = 0.05; L.Q.y = 0.7; L.atm.set('#d8d070'); } break; // sıcak bataklık, metanlı pus
    case 'snow': set('#dde8f0', '#ffffff', '#6c7f6a', '#9ab4c8'); L.P.z = 1; L.Q.y = 0.5; L.atm.set('#cfe8ff'); L.atmS = 0.8; break;
    case 'volcanic': set('#4a3048', '#6b4a30', '#ff6020', '#3a5a3a'); L.atm.set('#c08060'); L.atmS = 0.5; L.Q.y = 0.3;
      if (b.name === 'Jarnhald') { set('#3a3a34', '#5a5040', '#ff7020', '#4a6a38'); L.Q.w = 0.6; L.atm.set('#9ab0d0'); }
      if (b.name === 'Skalv') { set('#c8a830', '#8a3a1a', '#ff7020', '#e8d070'); L.Q.w = 0.6; L.atm.set('#e8d070'); } break;
    case 'glass': set('#0b0d12', '#000000', '#000000', '#5a3a8a'); L.atm.set('#7a5cff'); L.atmS = 0.25; break;
    case 'venus': set('#d8c088', '#f0e0b0', '#b89858', '#000'); L.Q.x = 9; L.P.y = 1.2; L.Q.z = 0.5; L.atm.set('#f0d090'); L.atmS = 1; break;
    case 'smog': set('#5a5448', '#7a6e5a', '#000', '#000'); L.Q.y = 0.55; L.atm.set('#b09070'); L.atmS = 1; break;
    case 'locked': set('#c8a070', '#9ab0c8', '#4a6a3a', '#000'); L.atm.set('#a0c0e0'); L.atmS = 0.5; L.P.z = 0.15;
      if (b.name === 'Ghar') set('#c8a070', '#8a98a8', '#5a7a3a', '#000'); if (b.name === 'Nattmar') set('#b07a48', '#8090a8', '#4a5a3a', '#000');
      if (b.name === 'Runveld') set('#9a8a78', '#c8d0dc', '#5a6a4a', '#000'); if (b.name === 'Myrkdal') { set('#6a4a38', '#4a4a50', '#5a5040', '#000'); L.atm.set('#a08870'); }
      if (b.name === 'Brennr') { set('#7a4a32', '#4a4848', '#5a4a40', '#000'); L.atmS = 0; L.P.z = 0.7; } break;
  }
  // atmosfer rengi ve kalınlığı Kodeks'teki bileşimden
  const a = (b.atm ?? '').toLocaleLowerCase('tr');
  if (/ch₄/.test(a) && cls !== 'icegiant') L.atm.set('#a8d8a0'); if (!isNaN(bar) && L.atmS > 0) L.atmS = Math.min(1.1, L.atmS * (0.7 + 0.35 * Math.log(1 + bar * 2)));
  const cs = CITY_SPEC[b.name]; if (cs) { L.city = cs[0]; L.cityMode = cs[1]; }
  // Birbirine fazla benzeyen cisimleri Kodeks tanımına göre ayır
  const TW: Record<string, () => void> = {
    Mensura: () => { L.c3.set('#2a2622'); L.c2.set('#b0a89a'); L.P.z = 1; },
    Eredh: () => { set('#4a4038', '#7a6a58', '#2e2620', '#a89478'); },
    Glödr: () => { L.c4.set('#f0dcb0'); L.Q.w = 0.55; },
    Carbo: () => { set('#1c1c1e', '#3a3a3e', '#101012', '#5a5a60'); },
    Ashe: () => { set('#2a2828', '#4a4440', '#1a1818', '#6a5a4a'); },
    Meandra: () => { set('#6a4030', '#a8704a', '#40281a', '#d09060'); },
    Ione: () => { L.c4.set('#d8c868'); L.c2.set('#9a8a60'); L.Q.w = 0.45; },
    Grosh: () => { L.c4.set('#dfe6ec'); L.c1.set('#5e6268'); L.Q.w = 0.4; },
    'Nys-c': () => { L.c1.set('#5e6a3c'); L.c2.set('#8a7a5a'); L.Q.y = 0.68; L.atm.set('#8ab8ff'); },
    Follis: () => { L.c4.set('#d8c060'); L.c3.set('#3a2a1a'); },
  };
  TW[b.name]?.();
  return L;
}
