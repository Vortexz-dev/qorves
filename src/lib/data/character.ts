// Karakter oluşturma verileri — Oyuncu Rehberi (37 slayt) ile birebir.
export type Opt = { id: string; label: string; hint?: string };

export const RACE_GROUPS: { group: string; races: (Opt & { hp: number })[] }[] = [
  { group: 'İnsanlar', races: [
    { id: 'insan', label: 'İnsan', hint: 'teknoloji, krom, hack', hp: 100 },
    { id: 'tasarlanmis', label: 'Tasarlanmış', hint: 'büyüye karşı', hp: 120 } ] },
  { group: 'Elfler', races: [
    { id: 'ilk-dogan', label: 'İlk Doğan', hint: 'büyü', hp: 70 },
    { id: 'kok-dogan', label: 'Kök Doğan', hint: 'keşif, doğa', hp: 90 },
    { id: 'yildiz-dogan', label: 'Yıldız Doğan', hint: 'ışık ve zaman', hp: 75 },
    { id: 'bosluk-dogan', label: 'Boşluk Doğan', hint: 'boşluk, gizem', hp: 80 } ] },
  { group: 'Cüceler', races: [
    { id: 'ondrum', label: 'Ondrûm', hint: 'tören, hukuk', hp: 150 },
    { id: 'vargrund', label: 'Vargrund', hint: 'döküm, zırh', hp: 180 },
    { id: 'skarn', label: 'Skarn', hint: 'motor, pilotluk', hp: 130 },
    { id: 'dolgrim', label: 'Dolgrim', hint: 'derin maden', hp: 160 },
    { id: 'hrothmar', label: 'Hrothmar', hint: 'rün, atalar', hp: 140 } ] },
  { group: 'İri yapılılar', races: [
    { id: 'ork', label: 'Ork', hint: 'askerlik', hp: 150 },
    { id: 'goliath', label: 'Goliath', hint: 'tırmanış, güç', hp: 200 },
    { id: 'ogre', label: 'Ogre', hint: 'ham güç', hp: 250 },
    { id: 'minotor', label: 'Minotor', hint: 'hat kılavuzu', hp: 225 } ] },
  { group: 'Yerli halklar', races: [
    { id: 'tabaxi', label: 'Tabaxi', hint: 'gizlilik, kuryelik', hp: 60 },
    { id: 'centaur', label: 'Centaur', hint: 'dayanıklılık', hp: 125 } ] },
  { group: 'Küçük yapılılar', races: [
    { id: 'kucuk-halk', label: 'Küçük Halk', hint: 'hukuk, sözleşme', hp: 80 },
    { id: 'goblin', label: 'Goblin', hint: 'çeviklik, borç ağı', hp: 40 },
    { id: 'kobold', label: 'Kobold', hint: 'sezgi, direnç', hp: 40 } ] },
];
export const RACES = RACE_GROUPS.flatMap((g) => g.races);
export const DWARVES = ['ondrum', 'vargrund', 'skarn', 'dolgrim', 'hrothmar'];
export const ELVES = ['ilk-dogan', 'kok-dogan', 'yildiz-dogan', 'bosluk-dogan'];
export const RUNE_PROSTHESIS = [...DWARVES, 'ogre', 'goliath']; // krom yerine rün mührü

export const CLASSES: (Opt & { stat: string; subs: Opt[] })[] = [
  { id: 'soldier', label: 'Asker (Soldier)', stat: 'STR / DEX', subs: [
    { id: 'bulwark', label: 'Muhafız (Bulwark)' }, { id: 'gunslinger', label: 'Silahşor (Gunslinger)' },
    { id: 'warfare', label: 'Warfare Ustası (Warfare Adept)' }, { id: 'nullguard', label: 'Büyü Kıran (Nullguard)' } ] },
  { id: 'shade', label: 'Gölge (Shade)', stat: 'DEX / luck', subs: [
    { id: 'smuggler', label: 'Kaçakçı (Smuggler)' }, { id: 'assassin', label: 'Suikastçı (Assassin)' },
    { id: 'infiltrator', label: 'Sızmacı (Infiltrator)' } ] },
  { id: 'ranger', label: 'İzci (Ranger)', stat: 'DEX / WIS', subs: [
    { id: 'hunter', label: 'Avcı (Hunter)' }, { id: 'pathfinder', label: 'Kâşif (Pathfinder)' },
    { id: 'navigator', label: 'Kılavuz (Navigator)' }, { id: 'beastmaster', label: 'Hayvan Terbiyecisi (Beastmaster)' } ] },
  { id: 'bard', label: 'Ozan (Bard)', stat: 'CHA', subs: [
    { id: 'songweaver', label: 'Şarkıcı (Songweaver)' }, { id: 'envoy', label: 'Sözcü (Envoy)' },
    { id: 'commander', label: 'Kumandan (Commander)' }, { id: 'whisperer', label: 'Fısıltıcı (Whisperer)' } ] },
  { id: 'cleric', label: 'Rahip (Cleric)', stat: 'WIS', subs: [
    { id: 'ethra', label: 'Ethra Yolu (Path of Ethra)' }, { id: 'mercy', label: 'Şifa Yolu (Path of Mercy)' },
    { id: 'oathbound', label: 'Yemin Yolu (Oathbound)' } ] },
  { id: 'mage', label: 'Büyücü (Mage)', stat: 'INT', subs: [
    { id: 'elementalist', label: 'Elementalist' }, { id: 'lightbinder', label: 'Lightbinder' },
    { id: 'chronomancer', label: 'Chronomancer' }, { id: 'laneweaver', label: 'Laneweaver' },
    { id: 'wildcaller', label: 'Vahşi Çağırıcı (Wildcaller)' } ] },
  { id: 'warlock', label: 'Ahitli (Warlock)', stat: 'CHA', subs: [
    { id: 'singularity', label: 'Tekillik Ahdi (Singularity Pact)' }, { id: 'elder', label: 'Kadim Ahit (Elder Pact)' },
    { id: 'blood', label: 'Kan Ahdi (Blood Pact)' }, { id: 'grave', label: 'Mezar Ahdi (Grave Pact)' } ] },
  { id: 'witch', label: 'Cadı (Witch)', stat: 'WIS / INT', subs: [
    { id: 'hexer', label: 'Lanet (Hexer)' }, { id: 'alchemist', label: 'Simya (Alchemist)' },
    { id: 'shapeshifter', label: 'Dönüşüm (Shapeshifter)' } ] },
  { id: 'engineer', label: 'Mühendis (Engineer)', stat: 'INT', subs: [
    { id: 'armorsmith', label: 'Zırhçı (Armorsmith)' }, { id: 'mechanist', label: 'Mekanist (Mechanist)' },
    { id: 'surgeon', label: 'Cerrah (Surgeon)' }, { id: 'artificer', label: 'Büyü Mühendisi (Artificer)' },
    { id: 'relicseeker', label: 'Kalıntı Avcısı (Relicseeker)' } ] },
  { id: 'runesmith', label: 'Rün Ustası (Runesmith)', stat: 'WIS / INT', subs: [
    { id: 'forgemaster', label: 'Demirci (Forgemaster)' }, { id: 'sealkeeper', label: 'Mühürcü (Sealkeeper)' },
    { id: 'sparkwright', label: 'Kıvılcımcı (Sparkwright)' } ] },
  { id: 'chromed', label: 'Kromlu (Chromed)', stat: 'dala göre', subs: [
    { id: 'velocity', label: 'Çevik (Velocity)' }, { id: 'juggernaut', label: 'Ağır (Juggernaut)' },
    { id: 'sensorium', label: 'Algı (Sensorium)' }, { id: 'arsenal', label: 'Silah-İmplant (Arsenal)' } ] },
  { id: 'netrunner', label: 'Ağ Koşucusu (Netrunner)', stat: 'INT', subs: [
    { id: 'gadgeteer', label: 'Alet Ustası (Gadgeteer)' }, { id: 'hacker', label: 'Hacker' },
    { id: 'hybrid', label: 'Karma (Hybrid)' } ] },
];

export const BACKGROUNDS: Opt[] = [
  { id: 'pilot', label: 'Pilot', hint: 'Gemi ve araç kullanabilir.' },
  { id: 'medic', label: 'Hekim (Medic)', hint: 'Ölmek üzere olan dostunun hayatta kalma şansını artırır.' },
  { id: 'runner', label: 'Kaçakçı (Runner)', hint: 'Her limanda tanıdığı bir kaçakçı vardır.' },
  { id: 'veteran', label: 'Gazi (Veteran)', hint: 'Hizmet ettiği devlette itibarı yüksek başlar.' },
  { id: 'noble', label: 'Soylu (Noble)', hint: 'Soylu çevrelerine girebilir; daha zengin başlar.' },
  { id: 'indentured', label: 'Kâğıtlı İşçi (Indentured)', hint: 'Borç sözleşmeli eski işçi; iş bürolarında tanıdığı var.' },
  { id: 'scribe', label: 'Kâtip (Scribe)', hint: 'Sözleşmeleri ve resmî belgeleri iyi okur.' },
  { id: 'delver', label: 'Kazıcı (Delver)', hint: 'Madenleri ve taşları tanır.' },
  { id: 'lanefarer', label: 'Hat Gezgini (Lanefarer)', hint: 'Yıllarca uzak yollarda dolaşmış; eski çağları iyi bilir.' },
  { id: 'awakened', label: 'Uyanmış (Awakened)', hint: 'Ruhsatsız büyü yapan insan. Aranır, gizli destekçileri var.' },
  { id: 'ringbearer', label: 'Velmor Halkası (Ringbearer)', hint: 'Ruhsatlı insan büyücü: şifa, bitki, ışık, küçük hava, zanaat.' },
];

export const CHROME_TIERS: Opt[] = [
  { id: '0', label: 'İşlemci yok' }, { id: '1', label: '1 · Common (2 parça)' }, { id: '2', label: '2 · Uncommon (4)' },
  { id: '3', label: '3 · Rare (6)' }, { id: '4', label: '4 · Epic (9)' }, { id: '5', label: '5 · Legendary (12)' },
];

export const FACTIONS: Opt[] = [
  { id: 'none', label: 'Bağımsız / yok' },
  { id: 'united', label: 'Birleşik İnsanlık' }, { id: 'republic', label: 'İnsan Cumhuriyeti' },
  { id: 'elf', label: 'Elf İmparatorluğu' }, { id: 'ondrum', label: 'Ondrûm Krallığı' },
  { id: 'velmor', label: 'Velmor Cemiyeti' }, { id: 'ostrav', label: 'Ostrav Loncası' },
  { id: 'sarnic', label: 'Sarnıç Kardeşliği' }, { id: 'emtekk', label: 'EMTEKK' }, { id: 'milisan', label: 'MILISAN' },
  { id: 'arasaka', label: 'ARASAKA' }, { id: 'hurliman', label: 'Hür Liman' }, { id: 'praescia', label: 'PRAESCIA' },
];

export const SYSTEMS = ['Aerendis','Tharyndel','Caelith','Oranth','Isilwen','Meridian','Concordia','Bastion','Ember',
  'Astarion','Corvallis','Vulcan','Prosperion','Valor','Aurum','Imperion','Zenith','Ondrûm','Vargrund','Skarn',
  'Dolgrim','Hrothmar','Harrow','Morwen','Ozgrund','Kragmor','Kestrel','Gemide / hatlarda doğdu','Bilinmiyor'];

export type Rule = { level: 'block' | 'warn'; text: string };
export function checkCombo(race: string, cls: string, sub: string, bg: string): Rule[] {
  const r: Rule[] = [];
  const dwarf = DWARVES.includes(race), designed = race === 'tasarlanmis', human = race === 'insan', elf = ELVES.includes(race);
  const magic = ['cleric', 'mage', 'warlock'].includes(cls);
  if (magic && (dwarf || designed)) r.push({ level: 'block', text: 'Cüceler ve Tasarlanmışlar bu sınıfı seçemez.' });
  if (cls === 'witch' && (dwarf || designed) && sub && sub !== 'alchemist') r.push({ level: 'block', text: 'Cüceler ve Tasarlanmışlar Cadı sınıfında yalnız Simya dalını seçebilir.' });
  if (human && magic) {
    if (cls === 'cleric' && sub === 'mercy' && bg === 'ringbearer') r.push({ level: 'warn', text: 'Velmor ruhsatlı Şifa Yolu: yasal.' });
    else r.push({ level: 'warn', text: 'İnsanlara büyü yasak. Bu karakter yasa dışı (Uyanmış) sayılır ve aranır.' });
  }
  if (human && cls === 'witch' && sub !== 'alchemist') r.push({ level: 'warn', text: 'İnsanlara büyü yasak; Simya dışı dallar yasa dışı sayılır.' });
  if (cls === 'netrunner' && !human) r.push({ level: 'block', text: 'Ağ Koşucusu yalnız insanlara açık.' });
  if (sub === 'chronomancer' && race !== 'yildiz-dogan') r.push({ level: 'block', text: 'Chronomancer yalnız Yıldız Doğanlara açık.' });
  if (sub === 'laneweaver' && !elf) r.push({ level: 'block', text: 'Laneweaver yalnız elflere açık.' });
  if (race === 'minotor' && ['engineer', 'chromed'].includes(cls)) r.push({ level: 'warn', text: 'Vesayet Yasası: Minotorlara yasak. Gizlice öğrenilebilir ama elflerle arası bozulur.' });
  if (race === 'minotor' && bg === 'pilot') r.push({ level: 'warn', text: 'Vesayet Yasası: Minotorların pilot olması yasak.' });
  if (cls === 'runesmith' && elf) r.push({ level: 'warn', text: 'Elfler ancak cüce ustalardan öğrenmişse Rün Ustası olabilir.' });
  if (cls === 'runesmith' && human) r.push({ level: 'warn', text: 'İnsanlar için Rün Ustalığı yalnız Ostrav\'da yasal.' });
  if (cls === 'chromed' && elf) r.push({ level: 'warn', text: 'Elfler kromlu olabilir ama elflerle ilişkisi kötü başlar.' });
  if (cls === 'chromed' && RUNE_PROSTHESIS.includes(race)) r.push({ level: 'warn', text: 'Bu ırk insan kromu yerine rünlü protez kullanır.' });
  if ((bg === 'awakened' || bg === 'ringbearer') && !human) r.push({ level: 'warn', text: 'Bu geçmiş insanlar için tanımlı.' });
  return r;
}
