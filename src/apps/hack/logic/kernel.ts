/* K3RN3LC0MP1L3R — vurgulanan satırı birebir yaz, Enter. Bozuk bellek bloklarını sırayla temizle. */
import { type Rng, rnd, shuffle, dk, lerp, sigTime } from './common';
const TEXT = [
  'Kantar hattında ışıklar söndü, kimse sebebini sormadı.',
  'Corvallis limanında üç gemi iz bırakmadan kayboldu.',
  'Kapıdaki ses yaklaştı ve panele üç kez vuruldu.',
  'Bu ağı izleyen göz uyumaz, sadece bekler.',
  'Gece yarısı röle istasyonu kendi kendine yeniden başladı.',
  'Sinyal zayıf ama hâlâ bizi duyuyorlar.',
  'Eski kayıtlarda adın yok, yine de seni tanıyorlar.',
  'Gümrük botu sahte mührü fark etmedi.',
  'Hat kırığından sızan veri soğuk ve ağırdı.',
  'Kimse Fener Ağı yalan söylemez demedi.',
];
const CODE = [
  'mov eax, [ice+0x1C]',
  'if (trace > 0x7F) drop();',
  'for (i = 0; i < n; i++) wipe(i);',
  'jmp 0xFF03N4 ; geri dönüş yok',
  'kill -9 $(pidof watchdog)',
  'echo $KEY | xor 0xBD > /dev/null',
  'grant(user, "root");',
  'mem[0x55] = 0x00; flush();',
  'chmod 000 /etc/kantar/log',
  'return ghost.spoof(mac);',
  'ssh -p 2077 root@relay.qv',
  'while (sig < 3) retry++;',
];
export interface Kernel { blocks: string[][]; time: number; chars: number }
export function params(diff: number, signal = 3) {
  const t = dk(diff);
  return {
    blocks: diff <= 2 ? 1 : diff <= 4 ? 2 : 3,
    lines: diff <= 1 ? 3 : diff === 2 ? 4 : diff === 4 ? 4 : 3,
    codeRatio: [0, 0.25, 0.5, 0.75, 1][diff - 1] ?? 0.5,
    cps: lerp(1.35, 1.7, t) / sigTime(signal), // ~16–22 WPM eşiği: ortalama bir yazıcı (25+ WPM) rahat yetişir; düşük sinyal süreyi kısar
  };
}
export function generate(diff: number, signal = 3, r: Rng = rnd): Kernel {
  const P = params(diff, signal);
  const text = shuffle(r, TEXT.slice()), code = shuffle(r, CODE.slice());
  const blocks: string[][] = [];
  for (let b = 0; b < P.blocks; b++) {
    const ls: string[] = [];
    for (let l = 0; l < P.lines; l++) ls.push((r() < P.codeRatio ? code.pop() : text.pop()) ?? code.pop() ?? 'nop');
    blocks.push(ls);
  }
  const chars = blocks.flat().reduce((a, s) => a + s.length + 1, 0);
  return { blocks, chars, time: Math.ceil(chars / P.cps + 8 + P.blocks * 3) };
}
