/* CROWN CLASH — kart tanımları. Birimler: mesafe = karo, süre = saniye, hız = karo/sn.
   Sayılar 1. seviye içindir; seviye çarpanı ve evrim (Evo I @4, Evo II @7) aşağıda. Tasarım tablosu: docs/CHROME_CROWN_DESIGN.md */
export type Kind = 'troop' | 'building' | 'spell';
export type Tgt = 'ground' | 'both' | 'build' | 'air';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Tag = 'tank' | 'win' | 'swarm' | 'air' | 'aa' | 'splash' | 'spell' | 'bldg' | 'support' | 'dps' | 'cycle' | 'econ';
export interface Stats {
  hp?: number; dmg: number; hs?: number; range?: number; speed?: number; tgt?: Tgt; fly?: boolean; count?: number; r?: number;
  splash?: number; life?: number; chain?: number; stun?: number; radius?: number; tower?: number; delay?: number;
  deathDmg?: number; deathR?: number; deathSpawn?: { card: string; n: number }; spawn?: { card: string; n: number; every: number };
  shield?: number; charge?: boolean; jump?: boolean; slow?: number; slowT?: number; heal?: number; healR?: number; lifesteal?: number;
  ramp?: [number, number, number]; towerStun?: number; every3?: number; deployNova?: number; pierce?: boolean;
  buff?: number; dur?: number; freeze?: number; shatter?: number; pulses?: number; roll?: { len: number; w: number; kb: number };
  pods?: number; podDmg?: number; elixir?: number; elixirEvery?: number; deathElixir?: number; firstHit?: number; knock?: boolean;
}
export interface Card extends Stats {
  id: string; name: string; role: string; cost: number; kind: Kind; rarity: Rarity; tags: Tag[]; color: string;
  proj?: 'rail' | 'bolt' | 'plasma' | 'tracer' | 'arc' | 'flame' | 'beam' | 'snipe' | 'frost' | 'heal' | 'void' | 'none';
  desc: string; counters: string; evo: [Partial<Stats>, Partial<Stats>]; evoTxt: [string, string]; sprite?: string;
}
const C = (c: Card) => c;
export const CARDS: Card[] = [
  // ——— 1–2 iksir: döngü & tepki ———
  C({ id: 'scrap', name: 'Scrap Bots', role: 'Döngü sürüsü ×3', cost: 1, kind: 'troop', rarity: 'common', tags: ['swarm', 'cycle'], color: '#c9a36b', count: 3, hp: 90, dmg: 75, hs: 1.0, range: 0.6, speed: 1.2, tgt: 'ground', r: 0.3, proj: 'none',
    desc: 'Hurdadan toplanmış üç küçük robot. Tek iksire bir tankı saniyelerce oyalar.', counters: 'EMP Pulse, Mag Roller, her alan hasarı', evo: [{ count: 4 }, { count: 4, deathDmg: 45, deathR: 1 }], evoTxt: ['4 robot iner', 'Ölünce kısa devre patlaması (45)'] }),
  C({ id: 'emp', name: 'EMP Pulse', role: 'Büyü · sersemlet', cost: 2, kind: 'spell', rarity: 'common', tags: ['spell', 'cycle'], color: '#4da3ff', dmg: 190, radius: 2.5, stun: 0.5, tower: 0.4, delay: 0,
    desc: 'Anlık elektromanyetik dalga. Sürüleri siler, Inferno ışınını ve hücumları sıfırlar.', counters: 'Sürü kartları; Pylon/hücum sıfırlama', evo: [{ radius: 3.0 }, { radius: 3.0, stun: 1.0 }], evoTxt: ['Yarıçap 3.0', 'Sersemletme 1 sn'] }),
  C({ id: 'goblin', name: 'Goblin Gang', role: 'Hızlı sürü ×3', cost: 2, kind: 'troop', rarity: 'common', tags: ['swarm', 'dps', 'cycle'], color: '#7fdc4a', count: 3, hp: 260, dmg: 112, hs: 1.1, range: 0.7, speed: 1.5, tgt: 'ground', r: 0.32, proj: 'none',
    desc: 'Üç hurdacı goblin. Çabuk gelir, ağır birimi deler, alan hasarına erir.', counters: 'EMP, Mag Roller, Ember Drake, Mech', evo: [{ count: 4 }, { count: 4, firstHit: 2 }], evoTxt: ['4 goblin', 'İlk vuruş ×2 (pusu)'] }),
  C({ id: 'roller', name: 'Mag Roller', role: 'Büyü · yuvarlanan', cost: 2, kind: 'spell', rarity: 'rare', tags: ['spell', 'cycle'], color: '#ffb347', dmg: 250, tower: 0.4, roll: { len: 11, w: 3.4, kb: 1.0 },
    desc: 'Manyetik silindir şerit boyunca yuvarlanır; yer birimlerini ezer ve geri iter.', counters: 'Goblin, Scrap, Medic, Sharpshooter', evo: [{ roll: { len: 12, w: 4.2, kb: 1.2 } }, { roll: { len: 12, w: 4.2, kb: 1.6 }, stun: 0.4 }], evoTxt: ['Daha geniş şerit', 'Ezilen sersemler 0.4 sn'] }),
  C({ id: 'overclock', name: 'Overclock', role: 'Büyü · güçlendirme', cost: 2, kind: 'spell', rarity: 'epic', tags: ['spell', 'support'], color: '#ff3df2', dmg: 0, radius: 4, buff: 0.5, dur: 8,
    desc: 'Alandaki dost birimlerin hızını ve saldırı temposunu artırır. Kombo kartı.', counters: 'EMP (buffı boşa çıkarır), Cryo Bomb', evo: [{ dur: 10 }, { dur: 10, buff: 0.55 }], evoTxt: ['Süre 10 sn', '+%55 hız ve tempo'] }),
  // ——— 3 iksir ———
  C({ id: 'chrome', name: 'Chrome Brawler', role: 'Mini tank', cost: 3, kind: 'troop', rarity: 'common', tags: ['tank', 'dps'], color: '#00f0ff', hp: 1300, dmg: 165, hs: 1.2, range: 0.9, speed: 1.0, tgt: 'ground', r: 0.5, proj: 'none',
    desc: 'Hidrolik yumruklu sokak dövüşçüsü. Ucuz, sağlam, ön safı tutar.', counters: 'Tabaxi, Goblin Gang, Exo', evo: [{ shield: 300 }, { shield: 300, every3: 2, splash: 1.0 }], evoTxt: ['300 kalkan', 'Her 3. yumruk alan + ×2'] }),
  C({ id: 'archer', name: 'Elf Marksman', role: 'Menzilli ×2 · hava savunma', cost: 3, kind: 'troop', rarity: 'common', tags: ['aa', 'support'], color: '#39ff8a', count: 2, hp: 270, dmg: 75, hs: 1.0, range: 5.5, speed: 1.0, tgt: 'both', r: 0.38, proj: 'rail',
    desc: 'İki elf nişancı. Havayı da vurur; tankın arkasında uzun yaşar.', counters: 'EMP, Mag Roller, Drake', evo: [{ range: 6.3 }, { range: 6.3, pierce: true, splash: 0.7 }], evoTxt: ['Menzil 6.3', 'Ray atışı deler (alan)'] }),
  C({ id: 'drone', name: 'Wasp Drones', role: 'Hava ×3', cost: 3, kind: 'troop', rarity: 'common', tags: ['air', 'aa', 'dps'], color: '#fcee0a', count: 3, fly: true, hp: 155, dmg: 72, hs: 1.0, range: 2.0, speed: 1.6, tgt: 'both', r: 0.36, proj: 'tracer',
    desc: 'Üç saldırı dronu. Yer birimleri yetişemez; menzilli olanlar avlar.', counters: 'EMP, Arc Turret, Marksman, Drake', evo: [{ count: 4 }, { count: 4, deathDmg: 60, deathR: 1 }], evoTxt: ['4 dron', 'Düşerken patlar (60)'] }),
  // ——— 4 iksir ———
  C({ id: 'turret', name: 'Arc Turret', role: 'Savunma yapısı', cost: 4, kind: 'building', rarity: 'rare', tags: ['bldg', 'aa'], color: '#00f0ff', hp: 1150, dmg: 135, hs: 1.0, range: 5.5, tgt: 'both', life: 30, r: 0.9, chain: 1, proj: 'arc',
    desc: '30 sn ayakta kalan tesla kulesi. Tankları kuleden uzağa çeker, şimşeği sektirir.', counters: 'Nova Missile, Orbital Strike, Exo', evo: [{ chain: 2 }, { chain: 2, stun: 0.25 }], evoTxt: ['Şimşek 3 hedefe', 'Her vuruş sersemletir'] }),
  C({ id: 'sharp', name: 'Corp Sharpshooter', role: 'Uzun menzil · tek hedef', cost: 4, kind: 'troop', rarity: 'rare', tags: ['aa', 'dps'], color: '#ff5470', hp: 510, dmg: 150, hs: 1.2, range: 6.5, speed: 1.0, tgt: 'both', r: 0.42, proj: 'snipe',
    desc: 'Şirket keskin nişancısı. Havayı ve kalkanlı hedefleri uzaktan söker.', counters: 'Orbital Strike, Tabaxi, Mag Roller', evo: [{ range: 7.2 }, { range: 7.2, every3: 3 }], evoTxt: ['Menzil 7.2', 'Her 3. atış ×3 hasar'] }),
  C({ id: 'runner', name: 'Netrunner', role: 'Zincir şok', cost: 4, kind: 'troop', rarity: 'epic', tags: ['support', 'splash', 'aa'], color: '#4da3ff', hp: 640, dmg: 98, hs: 1.6, range: 5.0, speed: 1.0, tgt: 'both', chain: 2, stun: 0.25, r: 0.42, proj: 'arc',
    desc: 'Şimşeği üç hedefe sektirir, her vuruşta kısa sersemletir. Pylonu sıfırlar.', counters: 'Orbital Strike, Tabaxi, Rail Rider', evo: [{ chain: 3 }, { chain: 4, stun: 0.5 }], evoTxt: ['4 hedefe zincir', '5 hedef + 0.5 sn şok'] }),
  C({ id: 'tabaxi', name: 'Tabaxi Shadow', role: 'Suikastçı', cost: 4, kind: 'troop', rarity: 'rare', tags: ['dps'], color: '#b56bff', hp: 1080, dmg: 350, hs: 1.5, range: 0.8, speed: 1.5, tgt: 'ground', r: 0.42, proj: 'none',
    desc: 'Plazma pençeli kedi suikastçı. Tek hedefte yıkıcı; sürüye ve havaya çaresiz.', counters: 'Goblin Gang, Scrap Bots, Wasp Drones', evo: [{ charge: true }, { charge: true, lifesteal: 0.3 }], evoTxt: ['Atılma (ilk vuruş ×2)', 'Vurduğunun %30\'unu emer'] }),
  C({ id: 'enforcer', name: 'Riot Enforcer', role: 'Kalkan · hücum', cost: 4, kind: 'troop', rarity: 'rare', tags: ['tank', 'splash'], color: '#ff9b2f', hp: 1000, shield: 420, dmg: 185, hs: 1.3, range: 0.9, speed: 1.0, tgt: 'ground', splash: 1.0, charge: true, r: 0.5, proj: 'none',
    desc: 'Enerji kalkanlı çevik kuvvet. Koşarak gelir, ilk darbesi çift ve alan hasarlı.', counters: 'Tabaxi, Exo, Sharpshooter', evo: [{ shield: 800 }, { shield: 800, stun: 0.5 }], evoTxt: ['800 kalkan', 'Hücum darbesi sersemletir'] }),
  C({ id: 'rider', name: 'Rail Rider', role: 'Hızlı kuşatma', cost: 4, kind: 'troop', rarity: 'rare', tags: ['win'], color: '#7fdc4a', hp: 1850, dmg: 290, hs: 1.6, range: 0.9, speed: 2.0, tgt: 'build', jump: true, r: 0.5, proj: 'none',
    desc: 'Hover-kızaklı goblin. Nehrin üstünden atlar, yalnız yapılara gider.', counters: 'Arc Turret, Inferno Pylon, Goblin Gang, Tabaxi', evo: [{ hp: 2100 }, { hp: 2100, towerStun: 0.6 }], evoTxt: ['+%14 can (2100)', 'Kuleye vuruş kuleyi sersemletir'] }),
  C({ id: 'medic', name: 'Synth Medic', role: 'İyileştirici', cost: 4, kind: 'troop', rarity: 'epic', tags: ['support'], color: '#3ff0c0', hp: 1000, dmg: 80, hs: 1.2, range: 1.2, speed: 1.0, tgt: 'ground', heal: 95, healR: 3, r: 0.42, proj: 'heal',
    desc: 'Sentetik sahra hekimi. Etrafındaki dostları saniyede 95 iyileştirir.', counters: 'Mag Roller, Orbital Strike, Tabaxi', evo: [{ heal: 120 }, { heal: 120, deathDmg: -400, deathR: 3 }], evoTxt: ['Saniyede 120 iyileştirme', 'Ölünce 400 iyileştirme dalgası'] }),
  C({ id: 'drake', name: 'Ember Drake', role: 'Hava · alan', cost: 4, kind: 'troop', rarity: 'epic', tags: ['air', 'splash', 'aa'], color: '#ff7a1a', fly: true, hp: 760, dmg: 115, hs: 1.6, range: 3.5, speed: 1.2, tgt: 'both', splash: 1.3, r: 0.6, proj: 'flame',
    desc: 'Sibernetik zırhlı genç ejder. Sürüleri yakar, havadan güvenle vurur.', counters: 'Sharpshooter, Marksman, Arc Turret', evo: [{ splash: 1.6 }, { splash: 1.8, dmg: 138 }], evoTxt: ['Alev alanı 1.6', 'Alan 1.8 + %20 hasar'] }),
  C({ id: 'plasma', name: 'Orbital Strike', role: 'Büyü · alan', cost: 4, kind: 'spell', rarity: 'rare', tags: ['spell'], color: '#ff9b2f', dmg: 650, radius: 2.5, tower: 0.35, delay: 0.8,
    desc: 'Yörüngeden plazma ışını. Kısa gecikme, geniş alan, kuleye az hasar.', counters: 'Destek birimleri, Medic, Marksman, Pump', evo: [{ radius: 3.0 }, { radius: 3.0, pulses: 2 }], evoTxt: ['Yarıçap 3.0', 'İkinci darbe (%40)'] }),
  C({ id: 'freeze', name: 'Cryo Bomb', role: 'Büyü · dondur', cost: 4, kind: 'spell', rarity: 'epic', tags: ['spell', 'support'], color: '#9fe8ff', dmg: 120, radius: 3.2, freeze: 4, tower: 0.5,
    desc: 'Alandaki her şeyi (kuleler dahil) dondurur. Saldırının son vuruşu için.', counters: 'Zamanlama; Overclock ile kombo', evo: [{ freeze: 5 }, { freeze: 5, shatter: 160 }], evoTxt: ['5 sn donma', 'Buz kırılınca 160 hasar'] }),
  // ——— 5 iksir ———
  C({ id: 'breacher', name: 'Dwarf Breacher', role: 'Tank · yalnız yapı', cost: 5, kind: 'troop', rarity: 'rare', tags: ['tank', 'win'], color: '#ff9b2f', hp: 3800, dmg: 240, hs: 1.5, range: 0.9, speed: 0.85, tgt: 'build', r: 0.65, proj: 'none',
    desc: 'Matkaplı Hrothmar kuşatmacısı. Askerlere bakmaz, düz kuleye yürür.', counters: 'Inferno Pylon, Tabaxi, Exo, Goblin Gang', evo: [{ shield: 700 }, { shield: 700, towerStun: 0.4 }], evoTxt: ['700 kalkan', 'Matkap kuleyi sersemletir'] }),
  C({ id: 'bomber', name: 'Hover Bomber', role: 'Hava · yalnız yapı', cost: 5, kind: 'troop', rarity: 'epic', tags: ['air', 'win'], color: '#ff3df2', fly: true, hp: 1600, dmg: 760, hs: 3.0, range: 0.6, speed: 1.15, tgt: 'build', deathDmg: 330, deathR: 1.2, r: 0.7, proj: 'none',
    desc: 'Goblin pilotlu bombardıman barı. Kuleye ulaşırsa ağır vurur; düşerken de patlar.', counters: 'Sharpshooter, Marksman, Wasp Drones, Arc Turret', evo: [{ deathR: 2.0 }, { deathR: 2.0, dmg: 950 }], evoTxt: ['Düşüş patlaması 2.0', '+%25 bomba'] }),
  C({ id: 'cryo', name: 'Cryo Runesmith', role: 'Yavaşlatan alan', cost: 5, kind: 'troop', rarity: 'epic', tags: ['support', 'splash', 'aa'], color: '#9fe8ff', hp: 1000, dmg: 95, hs: 1.5, range: 5.0, speed: 1.0, tgt: 'both', splash: 1.2, slow: 0.3, slowT: 2, r: 0.5, proj: 'frost',
    desc: 'Buz rünlü Hrothmar ustası. Vurduğu her şey %30 yavaşlar.', counters: 'Orbital Strike, Tabaxi, Rail Rider', evo: [{ slow: 0.5 }, { slow: 0.5, deployNova: 120 }], evoTxt: ['%50 yavaşlatma', 'İnişte don dalgası'] }),
  C({ id: 'foundry', name: 'Scrap Foundry', role: 'Üretici yapı', cost: 5, kind: 'building', rarity: 'rare', tags: ['bldg', 'swarm'], color: '#c9a36b', hp: 1250, dmg: 0, life: 45, r: 1.0, spawn: { card: 'scrap', n: 2, every: 4.5 }, deathSpawn: { card: 'scrap', n: 1 },
    desc: '45 sn boyunca 4.5 sn\'de bir iki Scrap Bot döker. Baskıyı böler.', counters: 'Mag Roller, Rail Rider, Nova Missile', evo: [{ spawn: { card: 'scrap', n: 2, every: 3.8 } }, { spawn: { card: 'scrap', n: 2, every: 3.8 }, deathSpawn: { card: 'scrap', n: 3 } }], evoTxt: ['3.8 sn\'de bir', 'Yıkılınca 3 robot'] }),
  C({ id: 'pylon', name: 'Inferno Pylon', role: 'Tank avcısı yapı', cost: 5, kind: 'building', rarity: 'epic', tags: ['bldg', 'aa'], color: '#ff4d2e', hp: 1400, dmg: 30, hs: 0.4, range: 6.0, tgt: 'both', life: 30, r: 0.9, ramp: [45, 155, 500], proj: 'beam',
    desc: 'Odaklı ısı ışını. Aynı hedefte kaldıkça hasarı katlanır; tankları eritir.', counters: 'EMP, Netrunner (sıfırlar), sürüler', evo: [{ ramp: [52, 178, 575] }, { ramp: [58, 200, 680] }], evoTxt: ['Isı +%15', 'Erime ışını 680'] }),
  C({ id: 'pod', name: 'Drop Pod', role: 'Büyü · kuşatma çıkarması', cost: 5, kind: 'spell', rarity: 'legendary', tags: ['spell', 'win', 'swarm'], color: '#ffd166', dmg: 0, radius: 2.5, pods: 15, dur: 8, podDmg: 85,
    desc: 'Yörüngeden 8 sn boyunca 15 Scrap Bot kapsülü yağar. Kulenin dibine at.', counters: 'EMP, Mag Roller, Drake, Arc Turret', evo: [{ pods: 18 }, { pods: 18, podDmg: 100 }], evoTxt: ['18 kapsül', 'İniş darbesi 100'] }),
  C({ id: 'swarm', name: 'Locust Swarm', role: 'Hava sürüsü ×6', cost: 5, kind: 'troop', rarity: 'common', tags: ['air', 'swarm', 'dps', 'aa'], color: '#ffcf33', count: 6, fly: true, hp: 150, dmg: 75, hs: 1.0, range: 0.8, speed: 1.6, tgt: 'both', r: 0.3, proj: 'none',
    desc: 'Altı çekirge mikro-dron. Tankı saniyeler içinde kemirir; alan hasarına zayıf.', counters: 'EMP, Drake, Arc Turret, Netrunner', evo: [{ count: 7 }, { count: 7, deathDmg: 40, deathR: 0.8 }], evoTxt: ['7 dron', 'Düşerken iğne patlaması'] }),
  // ——— 6+ iksir ———
  C({ id: 'ogre', name: 'Ogre Hauler', role: 'Ağır tank', cost: 6, kind: 'troop', rarity: 'epic', tags: ['tank'], color: '#ff5a3c', hp: 3400, dmg: 240, hs: 1.6, range: 1.0, speed: 0.75, tgt: 'ground', r: 0.8, proj: 'none', deathSpawn: { card: 'goblin', n: 2 },
    desc: 'Kargo zırhlı dev. Ölünce sandığından iki goblin fırlar.', counters: 'Inferno Pylon, Exo, Locust Swarm', evo: [{ deathSpawn: { card: 'goblin', n: 3 } }, { deathSpawn: { card: 'goblin', n: 3 }, deathDmg: 300, deathR: 2 }], evoTxt: ['Ölünce 3 goblin', 'Ölüm darbesi 300'] }),
  C({ id: 'nova', name: 'Nova Missile', role: 'Büyü · ağır', cost: 6, kind: 'spell', rarity: 'epic', tags: ['spell'], color: '#ff4d2e', dmg: 1250, radius: 2.0, tower: 0.35, delay: 1.3, knock: true,
    desc: 'Ağır balistik füze. Gecikmeli, dar alan, her şeyi siler; kuleyi bitirir.', counters: 'Pump, Sharpshooter + Medic, son vuruş', evo: [{ radius: 2.5 }, { radius: 2.5, stun: 1.0 }], evoTxt: ['Yarıçap 2.5', 'Şok dalgası 1 sn'] }),
  C({ id: 'pump', name: 'Elixir Pump', role: 'Ekonomi yapısı', cost: 6, kind: 'building', rarity: 'rare', tags: ['bldg', 'econ'], color: '#ff3df2', hp: 1100, dmg: 0, life: 70, r: 0.9, elixir: 1, elixirEvery: 8.5,
    desc: '70 sn boyunca 8.5 sn\'de bir +1 iksir. Ya geri öder ya rakibe hediye olur.', counters: 'Nova Missile, Rail Rider, Orbital Strike', evo: [{ elixirEvery: 7.5 }, { elixirEvery: 7.5, deathElixir: 1 }], evoTxt: ['7.5 sn\'de bir', 'Yıkılınca +1 iksir'] }),
  C({ id: 'exo', name: 'Exo Juggernaut', role: 'Ağır vurucu', cost: 7, kind: 'troop', rarity: 'epic', tags: ['tank', 'dps'], color: '#ff2a3c', hp: 3100, dmg: 660, hs: 1.9, range: 1.0, speed: 0.75, tgt: 'ground', r: 0.75, proj: 'none',
    desc: 'Vibro-kılıçlı dev zırh. Tek vuruşta tank söker; sürüler onu oyalar.', counters: 'Goblin Gang, Scrap Bots, Locust Swarm, Drop Pod', evo: [{ lifesteal: 0.15 }, { lifesteal: 0.15, splash: 1.0 }], evoTxt: ['%15 can emme', 'Kılıç savurması alan'] }),
  C({ id: 'mech', name: 'Siege Mech', role: 'Alan topçusu', cost: 7, kind: 'troop', rarity: 'legendary', tags: ['tank', 'splash', 'win'], color: '#ff7a1a', hp: 2650, dmg: 230, hs: 2.0, range: 5.0, speed: 0.6, tgt: 'ground', splash: 1.5, r: 0.8, proj: 'plasma',
    desc: 'Omuz toplu yürüyen kuşatma makinesi. Uzaktan sürüleri ve kuleyi döver.', counters: 'Tabaxi, Exo, Locust Swarm, Inferno Pylon', evo: [{ splash: 1.8 }, { splash: 1.8, deathDmg: 400, deathR: 2.5 }], evoTxt: ['Alan 1.8', 'Reaktör patlaması 400'] }),
  // ——— t158: yeni 10 kart (arena kilitli) ———
  C({ id: 'sappers', name: 'Kobold Sappers', role: 'Bina avcısı ×3 · ölünce patlar', cost: 2, kind: 'troop', rarity: 'common', tags: ['swarm', 'win', 'cycle'], color: '#e0a040', count: 3, hp: 220, dmg: 60, hs: 1.0, range: 0.6, speed: 1.4, tgt: 'build', r: 0.3, proj: 'none', deathDmg: 160, deathR: 1.2,
    desc: 'Sırtında şarjör taşıyan üç kobold. Yalnız binalara koşar, ölünce patlar.', counters: 'EMP Pulse, Mag Roller, Goblin Gang', evo: [{ count: 4 }, { count: 4, deathDmg: 220 }], evoTxt: ['4 kobold', 'Patlama 220'] }),
  C({ id: 'berserker', name: 'Orc Berserker', role: 'Can emen dövüşçü', cost: 3, kind: 'troop', rarity: 'common', tags: ['tank', 'dps'], color: '#d24a2a', hp: 1000, dmg: 120, hs: 0.8, range: 0.9, speed: 1.3, tgt: 'ground', r: 0.5, proj: 'none', lifesteal: 0.2,
    desc: 'Hızlı balta savuran ork. Her vuruşta can emer; uzun dövüşte güçlenir.', counters: 'Goblin Gang, Cryo Bomb, Tabaxi', evo: [{ lifesteal: 0.3 }, { lifesteal: 0.3, firstHit: 2 }], evoTxt: ['%30 can emme', 'İlk vuruş ×2'] }),
  C({ id: 'flak', name: 'Flak Cannon', role: 'Hava savunma yapısı', cost: 4, kind: 'building', rarity: 'common', tags: ['bldg', 'aa', 'splash'], color: '#9fb4c8', hp: 1050, dmg: 115, hs: 1.0, range: 6.5, tgt: 'air', splash: 1.3, life: 30, r: 0.9, proj: 'tracer',
    desc: 'Yalnız havayı vuran çift namlulu top. Dron ve sürü sürülerini gökte patlatır.', counters: 'Kobold Sappers, Rail Rider, Orbital Strike', evo: [{ range: 7.2 }, { range: 7.2, stun: 0.3 }], evoTxt: ['Menzil 7.2', 'Şarapnel sersemletir'] }),
  C({ id: 'minotaur', name: 'Minotaur Ram', role: 'Hücumlu kuşatma', cost: 5, kind: 'troop', rarity: 'rare', tags: ['tank', 'win'], color: '#a0522d', hp: 2300, dmg: 330, hs: 1.6, range: 0.9, speed: 1.1, tgt: 'build', charge: true, r: 0.7, proj: 'none',
    desc: 'Zırhlı boynuzlu koç. Binaya hücum eder, ilk darbesi ikiye katlanır.', counters: 'Exo Juggernaut, Goblin Gang, Cryo Bomb', evo: [{ shield: 500 }, { shield: 500, towerStun: 0.5 }], evoTxt: ['500 kalkan', 'Kuleyi 0.5 sn sersemletir'] }),
  C({ id: 'mortar', name: 'Dolgrim Mortar', role: 'Uzun menzil yapı', cost: 4, kind: 'building', rarity: 'rare', tags: ['bldg', 'splash', 'win'], color: '#c08040', hp: 1000, dmg: 210, hs: 4.5, range: 10, tgt: 'ground', splash: 1.5, life: 30, r: 0.9, proj: 'plasma',
    desc: 'Cüce havan topu. Nehrin ötesinden sürüleri ve kuleyi döver; yakını vuramaz gibi yavaştır.', counters: 'Rail Rider, Minotaur Ram, Wasp Drones', evo: [{ splash: 1.8 }, { splash: 1.8, stun: 0.4 }], evoTxt: ['Alan 1.8', 'Mermi sersemletir'] }),
  C({ id: 'rain', name: 'Plasma Rain', role: 'Büyü · 3 dalga', cost: 3, kind: 'spell', rarity: 'rare', tags: ['spell'], color: '#ff6ad5', dmg: 90, radius: 3.0, tower: 0.35, delay: 0.4, pulses: 3,
    desc: 'Gökten üç dalga plazma yağar. Sürüleri ve destek birimlerini eritir.', counters: 'Goblin Gang, Scrap Bots, Medic, Marksman', evo: [{ radius: 3.4 }, { radius: 3.4, pulses: 4 }], evoTxt: ['Yarıçap 3.4', '4 dalga'] }),
  C({ id: 'lancer', name: 'Centaur Lancer', role: 'Hücumlu mızrakçı', cost: 4, kind: 'troop', rarity: 'epic', tags: ['dps', 'win'], color: '#d4af37', hp: 1150, dmg: 210, hs: 1.2, range: 1.6, speed: 1.6, tgt: 'ground', charge: true, r: 0.6, proj: 'none',
    desc: 'Mızraklı sentor. Koşarak gelir, ilk darbesi ikiye katlanır; menzili kısa ama uzundur.', counters: 'Goblin Gang, Tabaxi, Arc Turret', evo: [{ hp: 1300 }, { hp: 1300, splash: 1.0 }], evoTxt: ['Can 1300', 'Mızrak alanı'] }),
  C({ id: 'hexer', name: 'Voidborn Hexer', role: 'Menzilli lanetçi', cost: 5, kind: 'troop', rarity: 'epic', tags: ['support', 'splash', 'aa'], color: '#9b5cff', hp: 820, dmg: 150, hs: 1.7, range: 5.5, speed: 1.0, tgt: 'both', splash: 1.2, stun: 0.25, r: 0.45, proj: 'void',
    desc: 'Boşluk büyücüsü. Lanet küresi alanı vurur ve kısa sersemletir.', counters: 'Tabaxi, Orbital Strike, Rail Rider', evo: [{ splash: 1.5 }, { splash: 1.5, slow: 0.4, slowT: 2 }], evoTxt: ['Alan 1.5', 'Lanet yavaşlatır'] }),
  C({ id: 'goliath', name: 'Goliath Warden', role: 'Kalkanlı dev', cost: 6, kind: 'troop', rarity: 'epic', tags: ['tank', 'splash'], color: '#7a8ca0', hp: 3600, shield: 900, dmg: 200, hs: 1.5, range: 1.0, speed: 0.8, tgt: 'ground', splash: 1.4, r: 0.8, proj: 'none',
    desc: 'Taş kalkanlı muhafız. Kalkan önce erir; çekici sürüleri dağıtır.', counters: 'Inferno Pylon, Exo Juggernaut, Sharpshooter', evo: [{ shield: 1300 }, { shield: 1300, deathDmg: 350, deathR: 2.5 }], evoTxt: ['1300 kalkan', 'Düşerken sarsıntı 350'] }),
  C({ id: 'skyblade', name: 'Starborn Skyblade', role: 'Hava · suikast', cost: 5, kind: 'troop', rarity: 'legendary', tags: ['air', 'dps', 'aa'], color: '#7fe0ff', fly: true, hp: 1250, dmg: 270, hs: 1.1, range: 1.0, speed: 1.5, tgt: 'both', firstHit: 2, r: 0.55, proj: 'none',
    desc: 'Yıldız kanatlı kılıç ustası. Havadan dalar; ilk darbesi ikiye katlanır.', counters: 'Flak Cannon, Wasp Drones, Netrunner', evo: [{ firstHit: 3 }, { firstHit: 3, lifesteal: 0.25 }], evoTxt: ['İlk vuruş ×3', '%25 can emme'] }),
];
export const CARD: Record<string, Card> = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const MAX_LV = 9, EVO_LV: [number, number] = [4, 7];
export const lvMul = (lv: number) => 1 + 0.08 * (Math.max(1, Math.min(MAX_LV, lv)) - 1);
export const evoTier = (lv: number) => (lv >= EVO_LV[1] ? 2 : lv >= EVO_LV[0] ? 1 : 0);
const SCALE: (keyof Stats)[] = ['hp', 'dmg', 'shield', 'deathDmg', 'heal', 'podDmg', 'shatter'];
const cache = new Map<string, Card>();
/** Seviye + evrimle etkin kart. Belirlenimci (aynı girdi → aynı çıktı). */
export function eff(id: string, lv = 1): Card {
  const k = id + ':' + lv; let c = cache.get(k); if (c) return c;
  const b = CARD[id]!; const t = evoTier(lv); c = { ...b };
  for (let i = 0; i < t; i++) Object.assign(c, b.evo[i]);
  const m = lvMul(lv);
  for (const f of SCALE) { const v = c[f]; if (typeof v === 'number') (c as unknown as Record<string, number>)[f] = Math.round(v * m); }
  if (c.ramp) c.ramp = c.ramp.map((v) => Math.round(v * m)) as [number, number, number];
  cache.set(k, c); return c;
}
export interface DeckCard { id: string; lv: number }
export const DEFAULT_DECK = ['chrome', 'archer', 'goblin', 'drone', 'breacher', 'tabaxi', 'plasma', 'emp'];
export const STARTER = ['chrome', 'archer', 'goblin', 'drone', 'breacher', 'tabaxi', 'plasma', 'emp', 'scrap', 'turret', 'enforcer', 'roller'];
export const avgCost = (d: string[]) => d.reduce((s, id) => s + (CARD[id]?.cost ?? 0), 0) / Math.max(1, d.length);
export function validDeck(d: unknown): d is string[] { return Array.isArray(d) && d.length === 8 && new Set(d).size === 8 && d.every((x) => typeof x === 'string' && !!CARD[x]); }
export const RARITY_TR: Record<Rarity, string> = { common: 'Yaygın', rare: 'Nadir', epic: 'Destansı', legendary: 'Efsanevi' };
/** Yükseltme: bir sonraki seviyeye kopya + BIT. Dik artış. */
export const COPIES: Record<Rarity, number[]> = { common: [2, 4, 10, 20, 40, 80, 150, 300], rare: [1, 2, 4, 8, 16, 30, 60, 120], epic: [1, 1, 2, 4, 8, 15, 30, 60], legendary: [1, 1, 1, 2, 3, 6, 12, 24] };
export const GOLD = [50, 150, 400, 1000, 2500, 6000, 12000, 25000];
export function upCost(id: string, lv: number) { const r = CARD[id]!.rarity; return lv >= MAX_LV ? null : { copies: COPIES[r][lv - 1]!, gold: GOLD[lv - 1]! * (r === 'legendary' ? 2 : r === 'epic' ? 1.5 : 1) }; }
/** Arenalar: her arena kendi kartlarını açar (en yüksek kupaya göre; kilit geri gelmez). */
export const ARENA_CR = [0, 400, 1000, 2000, 3000];
export const ARENA_CARDS: string[][] = [
  [...STARTER, 'sappers', 'berserker', 'sharp', 'swarm'],
  ['rider', 'foundry', 'flak', 'overclock', 'ogre', 'bomber'],
  ['cryo', 'pylon', 'minotaur', 'mortar', 'drake', 'freeze'],
  ['runner', 'pod', 'rain', 'pump', 'lancer', 'medic', 'nova'],
  ['exo', 'mech', 'hexer', 'goliath', 'skyblade'],
];
export const arenaIdx = (cr: number) => ARENA_CR.reduce((a, t, i) => (cr >= t ? i : a), 0);
export const arenaOf = (id: string) => Math.max(0, ARENA_CARDS.findIndex((l) => l.includes(id)));
export const unlockedIds = (best: number) => ARENA_CARDS.slice(0, arenaIdx(best) + 1).flat();
/** Arenada henüz açılmamış kartları aynı rol/maliyete yakın açık kartla değiştir (bot/hayalet desteleri). */
export function fitDeck(deck: string[], best: number): string[] {
  const ok = new Set(unlockedIds(best)); const out: string[] = [];
  for (const id of deck) {
    if (ok.has(id) && !out.includes(id)) { out.push(id); continue; }
    const c = CARD[id]; const pool = [...ok].filter((x) => !out.includes(x) && !deck.includes(x));
    pool.sort((a, b) => score(CARD[b]!, c) - score(CARD[a]!, c)); out.push(pool[0] ?? STARTER.find((x) => !out.includes(x))!);
  }
  return out;
}
function score(a: Card, c?: Card) { if (!c) return 0; return (a.kind === c.kind ? 4 : 0) - Math.abs(a.cost - c.cost) + a.tags.filter((t) => c.tags.includes(t)).length * 1.5; }
