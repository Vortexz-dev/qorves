// Şifre çözme efekti: metin önce bozuk karakterlerle akar, soldan sağa çözülür.
const G = '▓▒░█<>/\\|#%&$@*+=?!01ΣΞΨλ¥¤';
export function decrypt(node: HTMLElement, p: { text: string; on: boolean }) {
  let raf = 0;
  const run = ({ text, on }: { text: string; on: boolean }) => {
    cancelAnimationFrame(raf);
    if (!on || matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = text; return; }
    const t0 = performance.now(), dur = Math.min(1600, 350 + text.length * 18);
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), n = Math.floor(text.length * k);
      let s = text.slice(0, n);
      for (let i = n; i < text.length; i++) s += text[i] === ' ' || text[i] === '\n' ? text[i] : G[(Math.random() * G.length) | 0];
      node.textContent = s; if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  run(p);
  return { update: run, destroy: () => cancelAnimationFrame(raf) };
}
export const ago = (t: number) => { const s = (Date.now() - t) / 1000; if (s < 60) return 'az önce'; if (s < 3600) return Math.floor(s / 60) + ' dk önce'; if (s < 86400) return Math.floor(s / 3600) + ' sa önce'; return Math.floor(s / 86400) + ' gün önce'; };
