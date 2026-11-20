/* CROWN CLASH arenaları: kupa ile açılır. Her birinin zemini, renk tonu, nehir/köprü stili ve müziği farklıdır. */
export interface Theme {
  id: string; name: string; cr: number; ground: string; desc: string;
  shade: string; tint: [string, string]; river: [string, string, string]; bridge: 'steel' | 'rust' | 'stone' | 'glass' | 'obsidian';
  accent: string; fog: string; particles: 'rain' | 'embers' | 'ash' | 'stars' | 'motes';
  music: { root: number; prog: number[][]; bpm: number; wave: OscillatorType; lead: OscillatorType; drum: 'synth' | 'industrial' | 'tribal' | 'airy' | 'dark' };
}
export const THEMES: Theme[] = [
  { id: 'neon', name: 'Neon Alley', cr: 0, ground: 'ground_neon', desc: 'Yağmur altında Qorves sokakları. Herkes buradan başlar.', shade: 'rgba(6,10,20,.24)', tint: ['rgba(0,229,255,.10)', 'rgba(255,42,85,.10)'],
    river: ['#062a3a', '#00e5ff', 'rgba(0,229,255,.35)'], bridge: 'steel', accent: '#00e5ff', fog: 'rgba(40,10,60,.25)', particles: 'rain',
    music: { root: 57, prog: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -1, 2]], bpm: 112, wave: 'sawtooth', lead: 'square', drum: 'synth' } },
  { id: 'rust', name: 'Rust Docks', cr: 400, ground: 'ground_rust', desc: 'Pas tutmuş liman platformları; vinçler ve sis.', shade: 'rgba(20,10,4,.30)', tint: ['rgba(0,200,255,.08)', 'rgba(255,90,40,.10)'],
    river: ['#14202a', '#4fb3c9', 'rgba(120,200,220,.25)'], bridge: 'rust', accent: '#ff9b2f', fog: 'rgba(80,60,40,.22)', particles: 'ash',
    music: { root: 52, prog: [[0, 3, 7], [0, 3, 8], [-2, 2, 5], [-4, 0, 3]], bpm: 104, wave: 'square', lead: 'sawtooth', drum: 'industrial' } },
  { id: 'forge', name: 'Hrothmar Forge', cr: 1000, ground: 'ground_forge', desc: 'Cüce dağ ocağı. Nehir değil, erimiş çelik akar.', shade: 'rgba(12,6,2,.08)', tint: ['rgba(0,200,255,.07)', 'rgba(255,60,20,.10)'],
    river: ['#3a0e02', '#ff7a1a', 'rgba(255,140,40,.45)'], bridge: 'stone', accent: '#ff7a1a', fog: 'rgba(120,40,0,.18)', particles: 'embers',
    music: { root: 50, prog: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 2, 5]], bpm: 96, wave: 'sawtooth', lead: 'triangle', drum: 'tribal' } },
  { id: 'orbit', name: 'Orbital Ring', cr: 2000, ground: 'ground_orbit', desc: 'Yörünge istasyonunun güverte halkası. Altında boşluk.', shade: 'rgba(4,10,24,.5)', tint: ['rgba(0,229,255,.10)', 'rgba(255,60,160,.10)'],
    river: ['#000208', '#7fd8ff', 'rgba(160,220,255,.30)'], bridge: 'glass', accent: '#7fd8ff', fog: 'rgba(20,40,90,.20)', particles: 'stars',
    music: { root: 62, prog: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], bpm: 120, wave: 'triangle', lead: 'sine', drum: 'airy' } },
  { id: 'null', name: 'Null Citadel', cr: 3000, ground: 'ground_null', desc: 'Kimsenin geri dönmediği kale. Yalnız efsaneler.', shade: 'rgba(4,2,10,0)', tint: ['rgba(0,229,255,.08)', 'rgba(180,60,255,.12)'],
    river: ['#0c0418', '#b06bff', 'rgba(176,107,255,.40)'], bridge: 'obsidian', accent: '#b06bff', fog: 'rgba(60,0,90,.25)', particles: 'motes',
    music: { root: 48, prog: [[0, 3, 7], [1, 4, 8], [-1, 3, 6], [0, 3, 6]], bpm: 128, wave: 'sawtooth', lead: 'sawtooth', drum: 'dark' } },
];
export const themeFor = (cr: number) => [...THEMES].reverse().find((t) => cr >= t.cr) ?? THEMES[0]!;
export const THEME: Record<string, Theme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));
