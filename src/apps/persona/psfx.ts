/* Persona.ID ses kiti: klinik, yumuşak, cam gibi. Sistem ses ayarına bağlı (sfxBus). */
import { tone, noise } from '../hack/hsfx';
let lastHover = 0;
export const P = {
  hover() { const n = performance.now(); if (n - lastHover < 45) return; lastHover = n; tone(2400, 0.025, 'sine', 0.035); },
  tab() { noise(0.16, 0.05, 1800, 1.2, 'bandpass', 0, 2600); tone(660, 0.07, 'triangle', 0.06); tone(990, 0.09, 'triangle', 0.05, 0, 0.05); },
  select() { tone(1320, 0.05, 'sine', 0.07); tone(1760, 0.08, 'sine', 0.05, 0, 0.04); },
  back() { tone(880, 0.06, 'sine', 0.06, -300); },
  confirm() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, 0, i * 0.05)); },
  deny() { tone(180, 0.18, 'square', 0.06, -60); tone(120, 0.2, 'square', 0.05, 0, 0.08); },
  scan() { noise(1.1, 0.035, 500, 3, 'bandpass', 0, 5000); tone(220, 1.0, 'sine', 0.04, 660); },
  beat() { tone(62, 0.12, 'sine', 0.12, -20); tone(55, 0.14, 'sine', 0.09, -15, 0.16); },
  type() { tone(3200 + Math.random() * 800, 0.012, 'square', 0.018); },
  boot() { tone(110, 1.4, 'sawtooth', 0.025, 330, 0, 0.4); noise(0.6, 0.03, 300, 0.7, 'lowpass', 0.2, 3000); },
  unlock() { [392, 523, 784].forEach((f, i) => tone(f, 0.32, 'sine', 0.07, 0, i * 0.07)); noise(0.25, 0.04, 6000, 0.5, 'highpass', 0.2); },
  spend() { tone(784, 0.1, 'square', 0.04); tone(1175, 0.22, 'triangle', 0.07, 0, 0.06); noise(0.2, 0.03, 4000, 1, 'bandpass', 0.05, 3000); },
};
