// Neon çizgi simgeler (SVG). Windows logosu yok.
const s = (p: string) => `<svg viewBox="0 0 48 48" fill="none" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const ICONS: Record<string, string> = {
  computer: s(`<rect x="6" y="8" width="36" height="24" rx="1" stroke="#00f0ff" stroke-width="2"/><path d="M18 40h12M24 32v8" stroke="#00f0ff" stroke-width="2"/><path d="M11 14h10M11 19h16M11 24h7" stroke="#fcee0a" stroke-width="2"/><circle cx="36" cy="26" r="1.6" fill="#ff2a55" stroke="none"/>`),
  timeline: s(`<path d="M24 4v40" stroke="#00f0ff" stroke-width="2"/><circle cx="24" cy="15" r="4" fill="#fcee0a" stroke="none"/><path d="M28 15h12v8H28M20 31H8v8h12" stroke="#00f0ff" stroke-width="2"/><circle cx="24" cy="35" r="2.5" stroke="#ff2a55" stroke-width="2"/>`),
  codex: s(`<path d="M8 8h14a4 4 0 0 1 4 4v28a3 3 0 0 0-3-3H8zM40 8H30a4 4 0 0 0-4 4v28a3 3 0 0 1 3-3h11z" stroke="#00f0ff" stroke-width="2"/><circle cx="33" cy="20" r="4" stroke="#fcee0a" stroke-width="2"/><path d="m36 23 3 3" stroke="#fcee0a" stroke-width="2"/><path d="M12 15h8M12 20h6M12 25h8" stroke="#ff2a55" stroke-width="1.6"/>`),
  starmap: s(`<circle cx="24" cy="24" r="17" stroke="#00f0ff" stroke-width="1.4" opacity=".5"/><ellipse cx="24" cy="24" rx="19" ry="7" stroke="#00f0ff" stroke-width="2" transform="rotate(-18 24 24)"/><circle cx="24" cy="24" r="5" fill="#fcee0a" stroke="none"/><circle cx="40" cy="17" r="2.4" fill="#ff2a55" stroke="none"/><circle cx="9" cy="30" r="1.6" fill="#00f0ff" stroke="none"/>`),
  store: s(`<path d="M8 16h32l-3 24H11z" stroke="#00f0ff" stroke-width="2"/><path d="M17 16v-3a7 7 0 0 1 14 0v3" stroke="#fcee0a" stroke-width="2"/><path d="m19 28 4 4 7-8" stroke="#ff2a55" stroke-width="2"/>`),
  profile: s(`<path d="M24 5 41 14.5v19L24 43 7 33.5v-19z" stroke="#00f0ff" stroke-width="2"/><circle cx="24" cy="20" r="5" stroke="#fcee0a" stroke-width="2"/><path d="M15 34c2-5 5.5-7 9-7s7 2 9 7" stroke="#fcee0a" stroke-width="2"/>`),
};
