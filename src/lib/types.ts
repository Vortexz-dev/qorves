// Etiket türleri: renk, Türkçe ad, yer tutucu glif (görsel geçişi sonra).
export interface TypeMeta { label: string; plural: string; color: string; glyph: string }
const g = (p: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const TYPES: Record<string, TypeMeta> = {
  system: { label: 'Sistem', plural: 'Sistemler', color: '#00f0ff', glyph: g('<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4"/><circle cx="21" cy="11" r="1" fill="currentColor"/>') },
  star: { label: 'Yıldız', plural: 'Yıldızlar', color: '#ffcc33', glyph: g('<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M5 19l2.5-2.5M16.5 7.5 19 5"/>') },
  planet: { label: 'Gezegen', plural: 'Gezegenler', color: '#4fc3f7', glyph: g('<circle cx="12" cy="12" r="6"/><path d="M3 15c3 2 15-2 18-6"/>') },
  moon: { label: 'Uydu', plural: 'Uydular', color: '#9ecbff', glyph: g('<path d="M16 3a9 9 0 1 0 5 13A7 7 0 0 1 16 3z"/>') },
  belt: { label: 'Kuşak', plural: 'Kuşaklar', color: '#c8b48a', glyph: g('<circle cx="5" cy="13" r="1.5"/><circle cx="10" cy="9" r="2"/><circle cx="15" cy="14" r="1.2"/><circle cx="19" cy="9" r="1.8"/>') },
  station: { label: 'İstasyon', plural: 'İstasyonlar', color: '#7fe0c0', glyph: g('<rect x="9" y="9" width="6" height="6"/><path d="M3 12h6M15 12h6M12 3v6M12 15v6"/>') },
  place: { label: 'Yer', plural: 'Yerler', color: '#ff9f43', glyph: g('<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>') },
  state: { label: 'Devlet', plural: 'Devletler', color: '#ff2a55', glyph: g('<path d="M4 20h16M6 20V10M18 20V10M10 20v-6h4v6M3 10l9-6 9 6z"/>') },
  org: { label: 'Örgüt', plural: 'Örgütler', color: '#ff5fa2', glyph: g('<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 20c1-4 9-4 10 0M11 20c1-4 9-4 10 0"/>') },
  law: { label: 'Yasa', plural: 'Yasalar', color: '#e57373', glyph: g('<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>') },
  race: { label: 'Irk', plural: 'Irklar', color: '#b388ff', glyph: g('<circle cx="12" cy="7" r="4"/><path d="M4 21c1-5 15-5 16 0"/>') },
  subrace: { label: 'Alt ırk', plural: 'Alt ırklar', color: '#9575cd', glyph: g('<circle cx="12" cy="8" r="3"/><path d="M6 20c1-4 11-4 12 0M3 13l3-2M21 13l-3-2"/>') },
  clan: { label: 'Klan', plural: 'Klanlar', color: '#ce93d8', glyph: g('<path d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7z"/><path d="M9 12h6M12 9v6"/>') },
  company: { label: 'Şirket', plural: 'Şirketler', color: '#fcee0a', glyph: g('<rect x="4" y="7" width="16" height="13"/><path d="M9 7V4h6v3M4 12h16"/>') },
  person: { label: 'Kişi', plural: 'Kişiler', color: '#69f0ae', glyph: g('<circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>') },
  era: { label: 'Çağ', plural: 'Çağlar', color: '#8c9eff', glyph: g('<path d="M6 3h12M6 21h12M7 3c0 6 10 6 10 9s-10 3-10 9M17 3c0 6-10 6-10 9"/>') },
  event: { label: 'Olay', plural: 'Olaylar', color: '#ffd180', glyph: g('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>') },
  item: { label: 'Nesne', plural: 'Nesneler', color: '#80deea', glyph: g('<path d="M12 2 3 7l9 5 9-5zM3 7v10l9 5 9-5V7M12 12v10"/>') },
  lane: { label: 'Hat', plural: 'Hatlar', color: '#18ffff', glyph: g('<circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 12h10" stroke-dasharray="2 2"/>') },
  secret: { label: 'DM Sırrı', plural: 'DM Sırları', color: '#ff1744', glyph: g('<rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>') },
};
export const TYPE_ORDER = Object.keys(TYPES);
export const tmeta = (t: string) => TYPES[t] ?? TYPES.item;
