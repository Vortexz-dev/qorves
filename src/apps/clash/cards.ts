/* SPIRE//CLASH kart tanımları. Sayılar oyun içi birimdir: mesafe = karo, süre = saniye. */
export type Kind = 'troop' | 'building' | 'spell';
export type Tgt = 'ground' | 'both' | 'build';
export interface Card {
  id: string; name: string; role: string; cost: number; kind: Kind; desc: string; color: string;
  hp?: number; dmg: number; hs?: number; range?: number; speed?: number; tgt?: Tgt; fly?: boolean; count?: number; r?: number;
  splash?: number; life?: number; chain?: number; stun?: number; radius?: number; tower?: number; deathDmg?: number; proj?: 'rail' | 'bolt' | 'plasma' | 'tracer' | 'arc' | 'none';
  rarity: 'common' | 'rare' | 'epic';
}
export const CARDS: Card[] = [
  { id: 'chrome', name: 'Chrome Brawler', role: 'Yakın dövüş', cost: 3, kind: 'troop', hp: 1150, dmg: 160, hs: 1.2, range: 0.9, speed: 1.0, tgt: 'ground', r: 0.5, proj: 'none', color: '#00f0ff', rarity: 'common', desc: 'Hidrolik yumruklu sokak dövüşçüsü. Ucuz, sağlam, ön safı tutar.' },
  { id: 'breacher', name: 'Dwarf Breacher', role: 'Yalnız yapı', cost: 5, kind: 'troop', hp: 3100, dmg: 190, hs: 1.5, range: 0.9, speed: 0.75, tgt: 'build', r: 0.65, proj: 'none', color: '#ff9b2f', rarity: 'rare', desc: 'Matkaplı cüce kuşatmacı. Askerlere bakmaz, düz kuleye yürür.' },
  { id: 'archer', name: 'Elf Marksman', role: 'Menzilli ×2', cost: 3, kind: 'troop', count: 2, hp: 320, dmg: 92, hs: 1.0, range: 5.5, speed: 1.0, tgt: 'both', r: 0.38, proj: 'rail', color: '#39ff8a', rarity: 'common', desc: 'İki elf nişancı. Havayı da vurur; arkada kalırsa uzun yaşar.' },
  { id: 'goblin', name: 'Goblin Gang', role: 'Hızlı sürü ×3', cost: 2, kind: 'troop', count: 3, hp: 210, dmg: 105, hs: 1.1, range: 0.7, speed: 1.5, tgt: 'ground', r: 0.32, proj: 'none', color: '#ff3df2', rarity: 'common', desc: 'Üç hurdacı goblin. Çabuk gelir, çabuk ölür; ağır birimi oyalar.' },
  { id: 'drone', name: 'Wasp Drones', role: 'Hava ×2', cost: 3, kind: 'troop', count: 2, fly: true, hp: 270, dmg: 72, hs: 0.8, range: 2.5, speed: 1.5, tgt: 'both', r: 0.38, proj: 'tracer', color: '#fcee0a', rarity: 'common', desc: 'İki saldırı dronu. Yer birimleri yetişemez; menzilli olanlar avlar.' },
  { id: 'ogre', name: 'Ogre Hauler', role: 'Ağır tank', cost: 6, kind: 'troop', hp: 4200, dmg: 230, hs: 1.6, range: 1.0, speed: 0.75, tgt: 'ground', r: 0.8, proj: 'none', color: '#ff5a3c', rarity: 'epic', desc: 'Kargo zırhlı dev. Yavaş ama durdurmak bütün desteni ister.' },
  { id: 'tabaxi', name: 'Tabaxi Shadow', role: 'Suikastçı', cost: 4, kind: 'troop', hp: 920, dmg: 270, hs: 1.0, range: 0.8, speed: 1.6, tgt: 'ground', r: 0.42, proj: 'none', color: '#b56bff', rarity: 'rare', desc: 'Plazma pençeli kedi suikastçı. Çok hızlı, tek hedefte yıkıcı.' },
  { id: 'runner', name: 'Netrunner', role: 'Zincir şok', cost: 4, kind: 'troop', hp: 660, dmg: 125, hs: 1.4, range: 5.0, speed: 1.0, tgt: 'both', chain: 2, stun: 0.3, r: 0.42, proj: 'arc', color: '#4da3ff', rarity: 'epic', desc: 'Şimşeği üç hedefe sektirir, her vuruşta kısa sersemletir.' },
  { id: 'turret', name: 'Arc Turret', role: 'Savunma yapısı', cost: 4, kind: 'building', hp: 1150, dmg: 115, hs: 1.0, range: 5.5, tgt: 'both', life: 30, r: 0.9, proj: 'arc', color: '#00f0ff', rarity: 'rare', desc: '30 saniye ayakta kalan tesla kulesi. Tankları kuleden uzağa çeker.' },
  { id: 'mech', name: 'Siege Mech', role: 'Alan topçusu', cost: 7, kind: 'troop', hp: 3300, dmg: 270, hs: 2.0, range: 5.0, speed: 0.6, tgt: 'ground', splash: 1.4, r: 0.8, proj: 'plasma', color: '#ff7a1a', rarity: 'epic', desc: 'Omuz toplu yürüyen kuşatma makinesi. Sürüleri tek atışta siler.' },
  { id: 'bomber', name: 'Hover Bomber', role: 'Hava · yalnız yapı', cost: 5, kind: 'troop', fly: true, hp: 1450, dmg: 720, hs: 3.0, range: 0.6, speed: 1.0, tgt: 'build', deathDmg: 220, splash: 1.0, r: 0.7, proj: 'none', color: '#ff3df2', rarity: 'epic', desc: 'Goblin pilotlu bombardıman barı. Kuleye ulaşırsa ağır vurur; düşerken de patlar.' },
  { id: 'plasma', name: 'Orbital Strike', role: 'Büyü · alan', cost: 4, kind: 'spell', dmg: 600, radius: 2.5, tower: 0.35, color: '#ff9b2f', rarity: 'rare', desc: 'Yörüngeden plazma ışını. Kısa gecikme, geniş alan, kuleye az hasar.' },
  { id: 'emp', name: 'EMP Pulse', role: 'Büyü · sersemlet', cost: 2, kind: 'spell', dmg: 170, radius: 2.5, stun: 0.6, tower: 0.4, color: '#4da3ff', rarity: 'common', desc: 'Anlık elektromanyetik dalga. Sürüleri temizler, herkesi bir an durdurur.' },
];
export const CARD: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const DEFAULT_DECK = ['chrome', 'archer', 'goblin', 'drone', 'breacher', 'tabaxi', 'plasma', 'emp'];
export const avgCost = (d: string[]) => (d.reduce((s, id) => s + (CARD[id]?.cost ?? 0), 0) / Math.max(1, d.length));
export function validDeck(d: unknown): d is string[] { return Array.isArray(d) && d.length === 8 && new Set(d).size === 8 && d.every((x) => typeof x === 'string' && !!CARD[x]); }
