/* Hack süre sayacı: ilk hamlede başlar, yardım açıkken durur. */
export function clock(total: number, onEnd: () => void) {
  const s = $state({ left: total, started: false, paused: false, done: false });
  let last = 0, raf = 0;
  const loop = (t: number) => {
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    if (s.started && !s.paused && !s.done && total > 0) { s.left = Math.max(0, s.left - dt); if (s.left <= 0) { s.done = true; onEnd(); return; } }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return { s, start() { if (!s.started) s.started = true; }, stop() { s.done = true; cancelAnimationFrame(raf); }, add(sec: number) { s.left = Math.max(0, Math.min(total, s.left + sec)); } };
}
