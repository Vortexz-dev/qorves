<script lang="ts">
  // Qorves Starmap — küme görünümü. Sahne starmap/scene.ts; olay motoru lib/events.ts.
  import { onMount, untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import { openImage, lightbox } from '../lib/lightbox.svelte';
  import { ClusterScene, STAR_COLOR, LANE_COLOR, CAPITALS, type MapData, type Quality, type LaneData, type PinTip } from '../starmap/scene';
  import { SystemScene, type LaneGate, type SysPin } from '../starmap/system';
  import { kb, loadKb, getEntry, childrenOf, bodiesOf, type Body } from '../lib/kb.svelte';
  import { session } from '../lib/session.svelte';
  import { openTag } from '../lib/tags.svelte';
  import { loadEvents, activeAt, setWorldLive, type ActiveEvent, type EvData } from '../lib/events';
  import { watchMarkers, watchDoc, saveMarker, deleteMarker, nid, now as stamp, listUsers, type Marker } from '../lib/live';
  import { watchNotes, saveNote, dropNote, blankNote, glyph, ago, authorHue, NOTE_ICONS, type MapNote } from '../starmap/notes';
  import { ask } from '../lib/confirm.svelte';
  import Fold from '../starmap/Fold.svelte';
  import Palette, { type PItem } from '../starmap/Palette.svelte';
  import NoteForm from '../starmap/NoteForm.svelte';
  import type { WorldEvents } from '../lib/backend';
  import { sfx, ambient } from '../lib/sfx';
  import { coreBack } from '../desktop/wm.svelte';
  import RichText from '../ui/RichText.svelte';
  import Route from '../starmap/Route.svelte';
  import { tmeta } from '../lib/types';

  const STYPE: Record<string, string> = { A: 'A tipi · mavi-beyaz', F: 'F tipi · sarı-beyaz', G: 'G tipi · sarı', K: 'K tipi · turuncu', M: 'M tipi · kızıl cüce', redgiant: 'Kızıl dev',
    whitedwarf: 'Beyaz cüce', pulsar: 'Pulsar', magnetar: 'Magnetar', blackhole: 'Kara delik (tekillik)', triple: 'Üçlü yıldız', binary: 'Çift yıldız', unknown: 'Bilinmiyor' };
  const KIND: Record<string, string> = { planet: 'Gezegen', moon: 'Uydu', belt: 'Kuşak', swarm: 'Uydu grubu', station: 'İstasyon', gate: 'Geçit', singularity: 'Tekillik', disk: 'Birikim diski',
    stream: 'Plazma akıntısı', debris: 'Enkaz sahası', wormhole: 'Kurt deliği', star: 'Yıldız', star2: 'Eş yıldız' };
  let host: HTMLDivElement | undefined = $state(), ov: HTMLDivElement | undefined = $state();
  let mode = $state<'cluster' | 'system'>('cluster'), cur = $state<string | null>(null), sys2: SystemScene | null = null;
  let bsel = $state<string | null>(null), bhov = $state<string | null>(null), snaps = $state<Record<string, string[]>>({});
  // Arayüz: sol ikon rayı + tek çekmece, üstte komut çubuğu, sağda ayrıntı sütunu.
  type Pane = '' | 'sys' | 'layers' | 'notes' | 'alerts' | 'legend' | 'keys';
  let panel = $state<Pane>((localStorage.getItem('qv.mapPanel') as Pane) || ''), aopen = $state(false), palOpen = $state(false);
  const RAIL: { k: Pane; l: string; d: string }[] = [
    { k: 'sys', l: 'Sistemler', d: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.6-4.6' },
    { k: 'layers', l: 'Katmanlar', d: 'M12 3 2.5 8 12 13l9.5-5L12 3zM2.5 12 12 17l9.5-5M2.5 16 12 21l9.5-5' },
    { k: 'notes', l: 'Notlar ve işaretler', d: 'M5 19h3.5L19 8.5 15.5 5 5 15.5V19zm8.5-12 3.5 3.5' },
    { k: 'alerts', l: 'Uyarılar', d: 'M12 3.5 2.5 20h19L12 3.5zM12 10v4.5m0 2.8v.2' },
    { k: 'legend', l: 'Lejant', d: 'M4 6.5h2.5M4 12h2.5M4 17.5h2.5M10 6.5h10M10 12h10M10 17.5h10' },
  ];
  function setPanel(p: Pane) { panel = panel === p ? '' : p; localStorage.setItem('qv.mapPanel', panel); sfx.click(); }
  let orbits = $state(true), moving = $state(true), busy = false;
  let map = $state<MapData | null>(null), sc: ClusterScene | null = null;
  let hov = $state<string | null>(null), sel = $state<string | null>(null);
  let q = $state<Quality>((localStorage.getItem('qv.mapq') as Quality) || 'med');
  let labels = $state(true), lanesOn = $state(true), terr = $state(true), search = $state(''), hidden = $state<string[]>([]), legend = $state(true);
  let routeOpen = $state(false), rFrom = $state(''), routeIds: string[] | null = null;
  const setRoute = (ids: string[] | null) => { routeIds = ids; sc?.highlightRoute(ids); };
  let ev = $state<ActiveEvent[]>([]), evd = $state<EvData | null>(null), now = $state(Date.now()), warp = $state(0), err = $state('');
  const isDM = $derived(session.user?.role === 'dm');
  const base = import.meta.env.BASE_URL;
  const known = (id: string) => !!getEntry(id);
  // DM işaretleri (gemi konumu / görev noktası); kurallar yalnız izinli oyunculara okutur
  let marks = $state<Marker[]>([]);
  let pin = $state<Marker | null>(null), placeMode = $state<'' | 'mark' | 'note'>(''), plist = $state<{ uid: string; name: string }[]>([]);
  // Oyuncu notları (mapnotes): DM hepsini, oyuncu herkese açık + kendi özel notlarını görür
  let notes = $state<MapNote[]>([]), nform = $state<{ n: MapNote; isNew: boolean } | null>(null), nfilter = $state<'all' | 'mine' | 'pub' | 'priv'>('all');
  const me = $derived(session.user?.uid ?? '');
  const myName = () => session.user?.character?.name || (session.user?.role === 'dm' ? 'DM' : session.user?.username) || 'Bilinmeyen';
  const notesOf = (id: string) => notes.filter((n) => n.sys === id).sort((a, b) => b.upd - a.upd);
  const notesShown = $derived(notes.filter((n) => nfilter === 'all' || (nfilter === 'mine' ? n.uid === me : n.vis === nfilter)).sort((a, b) => b.upd - a.upd));
  function openNote(partial: Partial<MapNote>) {
    const sys = partial.sys || cur || sel || '';
    if (!sys) { flashMsg('Önce bir sistem seç ya da haritada bir sisteme Shift + sağ tıkla.'); return; }
    nform = { n: blankNote(me, myName(), sys, { ...partial, sys }), isNew: true }; pin = null; inspect = null; placeMode = ''; sfx.click();
  }
  async function putNote(n: MapNote) {
    await saveNote(n); sfx.granted(); flashMsg(nform?.isNew ? 'Not eklendi.' : 'Not güncellendi.'); nform = null;
  }
  async function delNote(n: MapNote) {
    if (!(await ask('Not silinsin mi?', `“${n.label}” kalıcı olarak silinir.`, 'Sil'))) return;
    await dropNote(n.id); sfx.granted(); nform = null; inspect = null; flashMsg('Not silindi.');
  }
  let toast = $state('');
  function flashMsg(t: string) { toast = t; setTimeout(() => { if (toast === t) toast = ''; }, 2600); }
  const whereOf = (sys: string, body?: string) => (known(sys) ? S.get(sys)?.name ?? sys : 'Bilinmeyen sinyal') + (body ? ' · ' + (bodiesOf(sys).find((b) => b.id === body)?.name ?? (body === 'star' ? 'yıldız' : body)) : '');
  const KINDS: [Marker['kind'], string][] = [['ship', '▲ Gemi'], ['mission', '◆ Görev'], ['objective', '◎ Hedef'], ['poi', '● Nokta'], ['alert', '▲ Uyarı']];
  async function openPin(partial: Partial<Marker>) {
    if (!isDM) return;
    if (!plist.length) plist = (await listUsers()).filter((u) => u.role !== 'dm').map((u) => ({ uid: u.uid, name: u.character?.name || u.username }));
    pin = { id: nid(), sys: cur || sel || '', kind: 'mission', label: '', note: '', cat: '', players: [], at: stamp(), ...partial };
    nform = null; inspect = null; sfx.click();
  }
  async function editMark(m: Marker) {
    if (!plist.length) plist = (await listUsers()).filter((u) => u.role !== 'dm').map((u) => ({ uid: u.uid, name: u.character?.name || u.username }));
    pin = { ...m, players: [...m.players], cat: m.cat ?? '' }; inspect = null;
  }
  async function delMark(m: Marker) {
    if (!(await ask('İşaret silinsin mi?', `“${m.label}” haritadan kaldırılır.`, 'Sil'))) return;
    await deleteMarker(m.id); inspect = null; sfx.granted(); flashMsg('İşaret silindi.');
  }
  async function savePin() {
    if (!pin || !pin.label.trim() || !pin.sys) return;
    const raw = pin;
    const m: Marker = { id: raw.id, sys: raw.sys, kind: raw.kind, label: raw.label.trim(), note: raw.note ?? '', players: raw.players ?? [], at: stamp() };
    if (raw.cat) m.cat = raw.cat;
    if (raw.body) m.body = raw.body;
    if (raw.x != null) m.x = raw.x;
    if (raw.y != null) m.y = raw.y;
    if (raw.z != null) m.z = raw.z;
    await saveMarker(m); sfx.granted(); pin = null; placeMode = ''; flashMsg('İşaret kaydedildi.');
  }
  const marksOf = (id: string) => marks.filter((m) => m.sys === id);
  function applyMarks() {
    const g = new Map<string, { ships: string[]; pins: { kind: string; label: string; id?: string; col?: string; note?: boolean; priv?: boolean }[] }>();
    const at = (id: string) => { const x = g.get(id) ?? { ships: [], pins: [] }; g.set(id, x); return x; };
    for (const m of marks) { const x = at(m.sys); if (m.kind === 'ship') x.ships.push(m.label); else x.pins.push({ kind: m.kind, label: m.label, id: m.id }); }
    if (notesOn) for (const n of notes) at(n.sys).pins.push({ kind: 'note', label: n.label, id: n.id, col: n.col, note: true, priv: n.vis === 'priv' });
    sc?.setMarkers(g);
    if (sys2 && cur) sys2.setPins([
      ...marks.filter((m) => m.sys === cur).map((m) => ({ kind: m.kind, label: m.label, body: m.body, x: m.x, y: m.y, z: m.z, id: m.id })),
      ...(notesOn ? notes.filter((n) => n.sys === cur).map((n) => ({ kind: 'note', label: glyph(n.icon) + ' ' + n.label, body: n.body, x: n.x, y: n.y, z: n.z, id: n.id, col: n.col, sub: (n.vis === 'priv' ? 'ÖZEL · ' : '') + n.by.toLocaleUpperCase('tr'), priv: n.vis === 'priv' })) : []),
    ]);
  }
  let notesOn = $state(localStorage.getItem('qv.mapNotes') !== '0');
  $effect(() => { localStorage.setItem('qv.mapNotes', notesOn ? '1' : '0'); });
  $effect(() => { marks; notes; notesOn; untrack(applyMarks); });
  const S = $derived(map ? new Map(map.systems.map((s) => [s.id, s])) : new Map());
  const focus = $derived(hov ?? sel);
  const fs = $derived(focus ? S.get(focus) : null);
  const ss = $derived(sel ? S.get(sel) : null);
  const se = $derived(sel ? getEntry(sel) : null);
  const evFor = (id: string) => ev.filter((e) => e.sys === id || (e.lane && map?.lanes.find((l) => l.id === e.lane && (l.a === id || l.b === id)))).sort((a, b) => Number(!!b.forced) - Number(!!a.forced) || b.tpl.sev - a.tpl.sev);
  const focusEv = $derived(focus ? evFor(focus) : []);
  const topEv = $derived([...ev].sort((a, b) => Number(!!b.forced) - Number(!!a.forced) || b.tpl.sev - a.tpl.sev).slice(0, 4)); // DM yayınları önce
  const list = $derived(map ? map.systems.filter((s) => !hidden.includes(s.owner) && (!search || (known(s.id) ? s.name : '').toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')))).sort((a, b) => a.name.localeCompare(b.name, 'tr')) : []);
  const lanesOf = (id: string) => (map?.lanes ?? []).filter((l) => (l.a === id || l.b === id) && known(l.id));
  const cs = $derived(cur ? S.get(cur) : null);
  const blist = $derived(cur && kb.ready ? bodiesOf(cur) : []);
  const bmap = $derived(new Map(blist.map((b) => [b.id, b])));
  const bs = $derived<Body | null>(bsel ? bmap.get(bsel) ?? null : null);
  const be = $derived(bs?.ent ? getEntry(bs.ent) : null);
  const starEnt = $derived(cur ? childrenOf(cur).find((e) => e.type === 'star') : null);
  const tree = $derived.by(() => { const cg = new Set(gates.map((g) => g.canon).filter(Boolean)); const top = blist.filter((b) => (!b.parent || !bmap.has(b.parent)) && !cg.has(b.id)); return top.map((b) => ({ b, kids: blist.filter((k) => k.parent === b.id) })); });
  const generic = (t?: string) => !t || /sistemindeki bir|üzerinde\/yakınında|^\W*$/.test(t);
  const rows = (b: Body) => ([['Yörünge', b.orbit ? b.orbit + (/\d/.test(b.orbit) && !/yörünge|L4|arasında|'den/i.test(b.orbit) ? ' AB' : '') : ''], ['Yerçekimi', b.grav], ['Atmosfer', b.atm], ['Sıcaklık', b.temp], ['Yaşam', b.life]] as [string, string | undefined][]).filter(([, v]) => v && v !== '—');
  const STATUS_TR: Record<string, string> = { open: 'Açık', closed: 'Kapalı', danger: 'Tehlikeli', collapsed: 'Çökmüş', rumor: 'Söylenti' };
  const laneCol = (l: LaneData) => l.status === 'danger' ? '#ff3355' : l.status === 'rumor' ? '#b06bff' : l.status === 'collapsed' || l.status === 'closed' ? '#8892a6' : LANE_COLOR[l.kind] ?? '#9fe8ff';
  const DIRS = ['doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı', 'kuzey', 'kuzeydoğu'];
  const dirName = (ang: number) => DIRS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8]; // ekranda +z aşağı = güney
  type GateInfo = LaneGate & { lane: LaneData; to: string };
  /** Her bilinen hat için bir geçit; yön kümedeki hedef sistemin gerçek yönü. Kodeks'teki geçitler (Beş Geçit, Eski Köprü…) kendi hatlarına eşlenir. */
  function gatesFor(id: string): GateInfo[] {
    const s0 = S.get(id); if (!s0) return [];
    const out: GateInfo[] = lanesOf(id).map((l) => { const o = l.a === id ? l.b : l.a, t = S.get(o)!;
      return { id: 'lg-' + l.id, lane: l, to: o, ang: Math.atan2(t.z - s0.z, t.x - s0.x), status: l.status, color: laneCol(l), name: l.name + ' geçidi' }; });
    const free = new Set(out.map((g) => g.id));
    for (const b of bodiesOf(id).filter((b) => b.kind === 'gate' || (b.kind === 'station' && /geçit/i.test(b.name)))) {
      const n = /Beş/.test(b.name) ? 5 : /iki geçit|geçitleri/i.test(b.name + ' ' + b.type) ? 2 : 1, w0 = b.name.split(/\s+/)[0].toLocaleLowerCase('tr');
      const score = (g: GateInfo) => (/kara hat/i.test(b.type) && /kara hat/i.test(g.lane.name) ? 5 : 0) + (g.lane.name.toLocaleLowerCase('tr').includes(w0) ? 4 : 0) + ((S.get(g.to)?.name ?? '').toLocaleLowerCase('tr') === w0 ? 4 : 0);
      const c = out.filter((g) => free.has(g.id)).map((g) => [g, score(g)] as const).sort((x, y) => y[1] - x[1]);
      let pick = c.filter((x) => x[1] > 0).slice(0, n).map((x) => x[0]);
      if (pick.length < n && n > 1) pick = pick.concat(c.filter((x) => x[1] === 0 && x[0].status === 'open').slice(0, n - pick.length).map((x) => x[0]));
      pick.forEach((g, i) => { g.canon = b.id; free.delete(g.id); g.au = b.au2 && n === 2 ? (i ? b.au2 : b.au) : n === 5 ? 30 + i * 3.75 : b.au; if (b.star === 'B') g.host = 'B';
        g.name = (b.kind === 'station' ? b.name.split(' ')[0] + ' geçidi' : b.name.replace(/ geçitleri$/, '')) + ' · ' + g.lane.name; });
    }
    return out;
  }
  const gates = $derived(cur && map && kb.ready ? gatesFor(cur) : []);
  const gmap = $derived(new Map(gates.map((g) => [g.id, g])));
  const gs = $derived(bsel ? gmap.get(bsel) ?? null : null);
  const gcanon = $derived(gs?.canon ? bmap.get(gs.canon) ?? null : null);
  const left = (e: ActiveEvent) => Math.max(1, Math.ceil((e.end - now) / 60000));

  function refreshEvents() {
    if (!map || !evd) return; now = Date.now();
    const vis = map.systems.filter((s) => s.owner !== 'dm' && known(s.id));
    ev = activeAt(now, vis);
    const ss = new Map<string, number>(), ls = new Map<string, number>();
    for (const e of ev) { ss.set(e.sys, Math.max(ss.get(e.sys) ?? 0, e.tpl.sev)); if (e.lane) ls.set(e.lane, Math.max(ls.get(e.lane) ?? 0, e.tpl.sev)); }
    sc?.setEvents(ss, ls, evd.sev);
  }
  function selectSys(id: string) { sfx.click(); sel = id; sc?.select(id); sc?.flyTo(id); }
  let tip = $state<{ t: string; x: number; y: number } | null>(null);
  let inspect = $state<{ m?: Marker; n?: MapNote } | null>(null);
  const KL: Record<string, string> = { ship: 'Gemi', mission: 'Görev', objective: 'Hedef', poi: 'Nokta', alert: 'Uyarı' };
  function onPinHover(p: { kind: string; label: string; id?: string } | null, ev?: PointerEvent) {
    if (!p) { tip = null; return; }
    const n = p.id ? notes.find((x) => x.id === p.id) : null;
    const t = n ? `${glyph(n.icon)} ${n.label} · ${n.by}${n.vis === 'priv' ? ' · özel' : ''}` : (KL[p.kind] ?? p.kind) + ' · ' + p.label;
    tip = { t, x: ev?.clientX ?? lastPt.x, y: ev?.clientY ?? lastPt.y };
  }
  let lastPt = { x: 0, y: 0 };
  function onPinClick(p: { kind: string; label: string; sys?: string; clickable?: boolean; id?: string }) {
    if (p.id) {
      const n = notes.find((x) => x.id === p.id); if (n) { inspect = { n }; sfx.click(); return; }
      const mm = marks.find((x) => x.id === p.id); if (mm) { inspect = { m: mm }; sfx.click(); return; }
    }
    const m = marks.find((x) => x.label === p.label && x.kind === p.kind && (!p.sys || x.sys === p.sys))
      ?? marks.find((x) => x.label === p.label && (!p.sys || x.sys === p.sys));
    if (m) { inspect = { m }; sfx.click(); }
  }
  function showNote(n: MapNote) { inspect = { n }; if (mode === 'cluster') { if (known(n.sys)) selectSys(n.sys); } else if (n.sys !== cur) goSys(n.sys); }
  /** Herhangi bir görünümden sisteme git (sistem görünümündeysek önce kümeye dön). */
  async function goSys(id: string) {
    if (!known(id)) return;
    if (mode === 'system') { if (busy) return; await back(); setTimeout(() => selectSys(id), 950); } else selectSys(id);
  }
  const QL: Record<string, string> = { low: 'DÜŞÜK', med: 'ORTA', high: 'YÜKSEK' };
  /** Komut paleti içeriği: komutlar, sistemler, cisimler (sistem görünümü), notlar ve işaretler. */
  function palItems(): PItem[] {
    const out: PItem[] = [];
    const cmd = (id: string, g: string, t: string, run: () => void, s?: string, kw?: string) => out.push({ id: 'c-' + id, grp: 'KOMUTLAR', g, t, s, kw, run });
    const here = cur || sel;
    if (here && known(here)) cmd('note', '✎', 'Buraya not ekle', () => openNote({ sys: here, body: mode === 'system' && bsel ? bsel : undefined }), whereOf(here, mode === 'system' ? bsel ?? undefined : undefined), 'not işaret ekle yeni');
    cmd('place', '⌖', 'Tıklayarak not koy', () => { placeMode = 'note'; flashMsg('Haritaya tıkla, not oraya düşer. ESC iptal.'); }, 'haritada bir noktaya', 'yerleştir');
    if (isDM) cmd('mark', '◆', 'DM işareti koy (tıklayarak)', () => { placeMode = 'mark'; flashMsg('Haritaya tıkla, işaret oraya düşer. ESC iptal.'); }, 'yalnız DM', 'görev gemi');
    if (mode === 'cluster') { cmd('route', '⇄', 'Rota hesapla', () => { routeOpen = true; rFrom = rFrom || sel || ''; }, 'hiperhat ve doğrudan yolculuk', 'yol mesafe');
      cmd('home', '⌂', 'Kümeye genel bakış', () => { sel = null; sc?.select(null); sc?.overview(); }); }
    else { cmd('back', '‹', 'Kümeye dön', () => void back(), 'ESC'); cmd('all', '⌖', 'Sistemin tamamı', () => { bsel = null; sys2?.select(null); sys2?.overview(); }); }
    cmd('p-notes', '✎', 'Notlar ve işaretler paneli', () => setPanel('notes')); cmd('p-layers', '◧', 'Katmanlar ve bölgeler', () => setPanel('layers'));
    cmd('p-alerts', '⚠', 'Uyarılar', () => setPanel('alerts')); cmd('p-legend', '◑', 'Lejant', () => setPanel('legend'));
    cmd('labels', '𝐓', labels ? 'Etiketleri gizle' : 'Etiketleri göster', () => (labels = !labels));
    if (mode === 'cluster') cmd('lanes', '═', lanesOn ? 'Hatları gizle' : 'Hatları göster', () => (lanesOn = !lanesOn));
    cmd('notes-tog', '✎', notesOn ? 'Notları haritada gizle' : 'Notları haritada göster', () => (notesOn = !notesOn));
    for (const x of ['low', 'med', 'high'] as Quality[]) if (x !== q) cmd('q-' + x, '◇', 'Kalite: ' + QL[x], () => (q = x), 'grafik', 'performans');
    if (mode === 'system' && cs) {
      out.push({ id: 'b-star', grp: 'BU SİSTEM', g: '☀', t: cs.stype === 'blackhole' ? 'Saren' : cs.name, s: 'yıldız', c: STAR_COLOR[cs.stype], run: () => focusBody('star') });
      for (const b of blist) out.push({ id: 'b-' + b.id, grp: 'BU SİSTEM', g: '●', t: b.name, s: KIND[b.kind], run: () => focusBody(b.id) });
      for (const g of gates) out.push({ id: 'g-' + g.id, grp: 'BU SİSTEM', g: '⟐', t: g.lane.name, s: '→ ' + (S.get(g.to)?.name ?? ''), c: g.color, run: () => focusBody(g.id) });
    }
    for (const sy of (map?.systems ?? []).filter((x) => known(x.id) && x.owner !== 'dm').sort((a, b) => a.name.localeCompare(b.name, 'tr')))
      out.push({ id: 's-' + sy.id, grp: 'SİSTEMLER', g: '✦', t: sy.name, s: map?.factions[sy.owner]?.name, c: STAR_COLOR[sy.stype], kw: sy.star, run: () => void goSys(sy.id) });
    for (const n of [...notes].sort((a, b) => b.upd - a.upd))
      out.push({ id: 'n-' + n.id, grp: 'NOTLAR', g: glyph(n.icon), t: n.label, s: n.by + ' · ' + whereOf(n.sys), c: n.col, kw: n.text, run: () => showNote(n) });
    for (const m of marks) out.push({ id: 'm-' + m.id, grp: 'İŞARETLER', g: m.kind === 'ship' ? '▲' : '◆', t: m.label, s: (KL[m.kind] ?? m.kind) + ' · ' + whereOf(m.sys), c: m.kind === 'ship' ? '#39ff8a' : '#ff9b2f', kw: m.note, run: () => { inspect = { m }; void goSys(m.sys); } });
    return out;
  }
  let rdown: { x: number; y: number } | null = null;
  /** Haritadaki tık noktası → konum (sistem + cisim + 3B nokta). */
  function hitAt(cx: number, cy: number) {
    if (mode === 'system' && sys2) { const hit = sys2.groundHit(cx, cy); return { sys: cur ?? '', body: bsel || bhov || '', x: hit?.x, y: hit?.y, z: hit?.z }; }
    if (sc) { const hit = sc.groundHit(cx, cy); return { sys: sc.nearestSys(hit, cx, cy) || sel || '', x: hit?.x, y: hit?.y, z: hit?.z }; }
    return null;
  }
  /** Shift + sağ tık: DM → DM işareti (formdan nota geçebilir), oyuncu → kişisel not. */
  function onPlace(e: MouseEvent) {
    e.preventDefault();
    if (!e.shiftKey) return;
    if (rdown && Math.hypot(e.clientX - rdown.x, e.clientY - rdown.y) > 6) return;
    const h = hitAt(e.clientX, e.clientY); if (!h || !h.sys) return;
    const pos = mode === 'system' ? { x: h.x, y: h.y, z: h.z } : {};
    if (isDM) openPin({ sys: h.sys, body: 'body' in h ? h.body : undefined, ...pos });
    else openNote({ sys: h.sys, body: 'body' in h && h.body ? h.body : undefined, ...pos });
  }
  const sysHooks = {
    hover: (id: string | null) => (bhov = id),
    select: (id: string | null) => selectBody(id),
    pinHover: (p: SysPin | null) => onPinHover(p),
    pinClick: (p: SysPin) => onPinClick(p),
  };
  function makeCluster(near?: string) {
    sc = new ClusterScene(host!, ov!, map!, known, { hover: (id) => (hov = id), select: (id) => { sel = id; if (inspect?.n && inspect.n.sys !== id) inspect = null; }, pinHover: (p) => onPinHover(p), pinClick: (p) => onPinClick(p) }, q);
    if (sel) sc.selected = sel;
    sc.setLayers(labels, lanesOn, terr); sc.setFilter(new Set(hidden)); refreshEvents(); applyMarks(); if (routeIds) sc.highlightRoute(routeIds);
    if (near) { sc.placeNear(near, 9); sc.select(near); sc.flyTo(near, 85, 1800); }
  }
  /** Sisteme gir: kümede yakına dalış + çizgi geçişi, küme sahnesi kapanır, sistem sahnesi uzaktan içeri süzülür. */
  function enter() {
    if (!ss || busy || !known(ss.id) || ss.owner === 'dm' || !map) return; busy = true; sfx.glitch();
    const id = ss.id; sc?.flyTo(id, 12, 1000); setTimeout(() => (warp = 1), 450);
    setTimeout(() => {
      sc?.dispose(); sc = null; hov = null; tip = null; cur = id; routeOpen = false; routeIds = null; bsel = null; mode = 'system';
      sys2 = new SystemScene(host!, ov!, S.get(id)!, bodiesOf(id), sysHooks, q, { gates: gatesFor(id) }); sys2.setLayers(labels, orbits, moving); applyMarks();
      warp = 2; setTimeout(() => { warp = 0; busy = false; }, 900);
    }, 1500);
  }
  /** Kümeye dön: yıldıza dalış, ters geçiş, küme sahnesi sistemin dibinden geri çekilir. */
  async function back() {
    if (!sys2 || busy) return; busy = true; sfx.glitch(); const id = cur!;
    setTimeout(() => (warp = 1), 350); await sys2.exit(); await new Promise((r) => setTimeout(r, 450));
    sys2.dispose(); sys2 = null; bsel = null; bhov = null; tip = null; mode = 'cluster'; sel = id; makeCluster(id); cur = null;
    warp = 2; setTimeout(() => { warp = 0; busy = false; }, 900);
  }
  /** Bir üst seviye: gezegen bakışı → sistem, sistem → küme. Kümede Geri gizlenir. */
  function stepUp() {
    if (busy || mode !== 'system') return;
    if (bsel) { bsel = null; sys2?.select(null); sys2?.overview(); }
    else void back();
  }
  $effect(() => {
    coreBack.go = mode === 'system' ? stepUp : null;
    return () => { if (coreBack.go === stepUp) coreBack.go = null; };
  });
  /** Geçitten hedef sisteme: kümeye dön, hedefi seç, içine gir. */
  async function jump(to: string) { if (busy) return; await back(); setTimeout(() => { if (!known(to)) return; sel = to; sc?.select(to); setTimeout(enter, 900); }, 950); }
  function selectBody(id: string | null) {
    bsel = id; if (!id || !sys2) return; sfx.click();
    if (!snaps[id]) sys2.snapshot(id).then((u) => (snaps = { ...snaps, [id]: u }));
  }
  function focusBody(id: string) { sys2?.focus(id); }
  // Not: önce durumu oku (sahne henüz yokken de bağımlılık kurulsun), sonra uygula.
  $effect(() => { const h = new Set(hidden); sc?.setFilter(h); });
  $effect(() => { const a = labels, b = lanesOn, c = terr; sc?.setLayers(a, b, c); });
  $effect(() => { const a = labels, b = orbits, c = moving; sys2?.setLayers(a, b, c); });
  $effect(() => { const qq = q; untrack(() => applyQuality(qq)); });
  /** Kalite değişince sahne yeni ayarlarla baştan kurulur (piksel oranı, AA, bloom, oktav, nokta/kaya sayıları); kamera yerinde kalır. */
  function applyQuality(qq: Quality) {
    localStorage.setItem('qv.mapq', qq);
    if (sc && sc.quality !== qq && !busy) { const pose = sc.getPose(); sc.dispose(); makeCluster(); sc!.setPose(pose); }
    if (sys2 && sys2.quality !== qq && !busy && cur) { const pose = sys2.getPose(), keep = bsel; sys2.dispose();
      sys2 = new SystemScene(host!, ov!, S.get(cur)!, bodiesOf(cur), sysHooks, qq, { intro: false, gates: gatesFor(cur) }); sys2.setLayers(labels, orbits, moving); sys2.setPose(pose); applyMarks();
      if (keep) { sys2.select(keep); snaps = {}; } }
  }

  onMount(() => {
    let alive = true, timer = 0, stopEv = () => {};
    const u0 = session.user!; const stopMk = watchMarkers(u0.role === 'dm' ? null : u0.uid, (m) => (marks = m));
    const stopNt = watchNotes(u0.uid, u0.role === 'dm', (xs) => { notes = xs; if (inspect?.n) inspect = { n: xs.find((x) => x.id === inspect!.n!.id) ?? inspect.n }; });
    const field = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input,textarea,select,[contenteditable="true"]');
    const esc = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopImmediatePropagation(); palOpen = !palOpen; if (palOpen) sfx.glitch(); return; }
      if (e.key === '/' && !field(e.target) && !palOpen) { e.preventDefault(); palOpen = true; sfx.glitch(); return; }
      if (e.key !== 'Escape' && e.key !== 'Backspace') return;
      if (field(e.target) || lightbox.open) return;
      if (e.key === 'Escape') {
        // önce üstteki katmanı kapat: palet → form → inceleme → yerleştirme → çekmece
        if (palOpen) { palOpen = false; e.stopImmediatePropagation(); return; }
        if (nform || pin) { nform = null; pin = null; placeMode = ''; e.stopImmediatePropagation(); return; }
        if (inspect) { inspect = null; e.stopImmediatePropagation(); return; }
        if (placeMode) { placeMode = ''; e.stopImmediatePropagation(); return; }
        if (panel) { panel = ''; localStorage.setItem('qv.mapPanel', ''); e.stopImmediatePropagation(); return; }
      }
      if (e.key === 'Backspace') {
        if (mode !== 'system') return;
        e.preventDefault(); e.stopImmediatePropagation();
        stepUp(); return;
      }
      if (busy) { e.stopImmediatePropagation(); return; }
      if (mode === 'system') { e.stopImmediatePropagation(); stepUp(); return; }
      if (sel) { sel = null; sc?.select(null); sc?.overview(); e.stopImmediatePropagation(); } };
    addEventListener('keydown', esc, true); const stopAmb = ambient('starmap');
    (async () => {
      try {
        const [data] = await Promise.all([fetch(import.meta.env.BASE_URL + 'data/starmap.json').then((r) => r.json()), loadKb(session.user!)]);
        if (!alive) return; map = data;
        evd = await loadEvents(data.systems, data.lanes);
        makeCluster();
        timer = setInterval(() => { if (!document.hidden) refreshEvents(); }, 15000) as unknown as number;
        stopEv = watchDoc<WorldEvents>(['world', 'events'], (w) => { setWorldLive(w); refreshEvents(); });
      } catch (e) { err = String(e); }
    })();
    return () => { alive = false; clearInterval(timer); stopEv(); stopMk(); stopNt(); stopAmb(); removeEventListener('keydown', esc, true); sc?.dispose(); sc = null; sys2?.dispose(); sys2 = null; };
  });
</script>

<div class="sm" class:placing={!!placeMode}>
  <div class="gl" bind:this={host} role="presentation"
    onpointermove={(e) => { lastPt = { x: e.clientX, y: e.clientY }; if (tip) tip = { ...tip, x: e.clientX, y: e.clientY }; }}
    onpointerdown={(e) => { if (e.button === 2) rdown = { x: e.clientX, y: e.clientY }; }}
    oncontextmenu={onPlace}
    onpointerup={(e) => {
      if (e.button === 2 || !placeMode) return;
      const h = hitAt(e.clientX, e.clientY); if (!h || !h.sys) return;
      const pos = mode === 'system' ? { x: h.x, y: h.y, z: h.z } : {};
      const body = 'body' in h && h.body ? h.body : undefined;
      if (placeMode === 'mark' && isDM) openPin({ sys: h.sys, body, ...pos }); else openNote({ sys: h.sys, body, ...pos });
    }}></div>
  <div class="ov" bind:this={ov}></div>
  <div class="vig"></div>

  <!-- sol: ikon rayı (her şeye tek tıkla erişim) -->
  <nav class="rail" aria-label="Harita araçları">
    {#each RAIL as r (r.k)}
      {@const n = r.k === 'notes' ? notes.length + marks.length : r.k === 'alerts' ? ev.length : 0}
      <button class="ri" class:on={panel === r.k} onclick={() => setPanel(r.k)} aria-label={r.k === 'sys' && mode === 'system' ? 'Cisimler' : r.l}>
        <svg viewBox="0 0 24 24"><path d={r.d} /></svg>
        {#if n}<em class="mono" class:hot={r.k === 'alerts'}>{n > 99 ? '99+' : n}</em>{/if}
        <span class="rt mono">{r.k === 'sys' && mode === 'system' ? 'Cisimler' : r.l}</span>
      </button>
    {/each}
    {#if mode === 'cluster'}
      <button class="ri y" class:on={routeOpen} onclick={() => { routeOpen = !routeOpen; if (routeOpen) { rFrom = rFrom || sel || ''; sfx.glitch(); } else setRoute(null); }} aria-label="Rota hesapla">
        <svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8" /></svg><span class="rt mono">Rota hesapla</span></button>
    {/if}
    <i class="sep"></i>
    <button class="ri" class:on={placeMode === 'note'} onclick={() => { placeMode = placeMode === 'note' ? '' : 'note'; sfx.click(); }} aria-label="Tıklayarak not koy">
      <svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /></svg><span class="rt mono">Tıklayarak not koy</span></button>
    {#if isDM}<button class="ri o" class:on={placeMode === 'mark'} onclick={() => { placeMode = placeMode === 'mark' ? '' : 'mark'; sfx.click(); }} aria-label="DM işareti koy">
      <svg viewBox="0 0 24 24"><path d="M12 3 19.5 12 12 21 4.5 12z" /></svg><span class="rt mono">DM işareti koy</span></button>{/if}
    <span class="fill"></span>
    <button class="ri" class:on={panel === 'keys'} onclick={() => setPanel('keys')} aria-label="Kısayollar"><svg viewBox="0 0 24 24"><path d="M3 7h18v10H3zM6.5 10.5h1m3 0h1m3 0h1m3 0h1M7 14h10" /></svg><span class="rt mono">Kısayollar</span></button>
    {#if mode === 'system'}<button class="ri y" onclick={back} aria-label="Kümeye dön"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg><span class="rt mono">Kümeye dön · ESC</span></button>
    {:else}<button class="ri" onclick={() => { sel = null; sc?.select(null); sc?.overview(); }} aria-label="Genel bakış"><svg viewBox="0 0 24 24"><path d="M3 11 12 4l9 7M6 9.5V20h12V9.5" /></svg><span class="rt mono">Genel bakış</span></button>{/if}
  </nav>

  <!-- sol çekmece: seçili araç -->
  {#if panel}
  <aside class="drawer" style:--fc={cs ? map?.factions[cs.owner]?.color : 'var(--cy)'} transition:fly={{ x: -16, duration: 220 }}>
    <header class="dh"><span class="mono">{panel === 'sys' ? (mode === 'cluster' ? 'SİSTEMLER' : 'SİSTEM · ' + (cs?.name ?? '').toLocaleUpperCase('tr')) : panel === 'layers' ? 'KATMANLAR' : panel === 'notes' ? 'NOTLAR VE İŞARETLER' : panel === 'alerts' ? 'UYARILAR' : panel === 'legend' ? 'LEJANT' : 'KISAYOLLAR'}</span><button class="x" onclick={() => setPanel('')} aria-label="Kapat">✕</button></header>
    {#if panel === 'sys' && mode === 'cluster'}
      <input class="inp" bind:value={search} placeholder="Sistem ara…" />
      <div class="lst">
        {#each list as s (s.id)}
          <button class:on={sel === s.id} onclick={() => selectSys(s.id)} onmouseenter={() => { hov = s.id; if (sc) sc.hovered = s.id; }} onmouseleave={() => { hov = null; if (sc) sc.hovered = null; }}>
            <i style:background={STAR_COLOR[s.stype]}></i>{known(s.id) ? s.name : 'Bilinmeyen sinyal'}{#if known(s.id) && CAPITALS[s.id]}<svg class="capi" class:old={s.id === 'sys-imperion'} viewBox="0 0 16 16"><title>{s.name + ' · ' + CAPITALS[s.id]}</title><path d="M2 12h12l1-7-4 3-3-5-3 5-4-3z"/></svg>{/if}
            <span class="tg2">
            {#if notesOf(s.id).length}<span class="ntg" title="Not">✎{notesOf(s.id).length}</span>{/if}
            {#if marksOf(s.id).length}<span class="mkg" title={marksOf(s.id).map((m) => m.label).join(', ')}>{marksOf(s.id).some((m) => m.kind === 'ship') ? '▲' : '◆'}</span>{/if}
            {#if evFor(s.id).length}<em style:color={evd?.sev[evFor(s.id)[0].tpl.sev].color}>▲</em>{/if}
            </span>
          </button>
        {/each}
      </div>
    {:else if panel === 'sys' && cs}
      <div class="mono sub">{STYPE[cs.stype]} · {map?.factions[cs.owner]?.name}</div>
      <div class="lst blst">
        <button class:on={bsel === 'star'} onclick={() => focusBody('star')} onmouseenter={() => sys2 && (sys2.hovered = 'star')} onmouseleave={() => sys2 && (sys2.hovered = null)}><i style:background={STAR_COLOR[cs.stype]}></i>{cs.stype === 'blackhole' ? 'Saren' : cs.name} <small class="kd">yıldız</small></button>
        {#each tree as n (n.b.id)}
          <button class:on={bsel === n.b.id} onclick={() => focusBody(n.b.id)} onmouseenter={() => sys2 && (sys2.hovered = n.b.id)} onmouseleave={() => sys2 && (sys2.hovered = null)}><i class="k-{n.b.kind}"></i>{n.b.name}<small class="kd">{KIND[n.b.kind]}</small></button>
          {#each n.kids as k (k.id)}
            <button class="kid" class:on={bsel === k.id} onclick={() => focusBody(k.id)} onmouseenter={() => sys2 && (sys2.hovered = k.id)} onmouseleave={() => sys2 && (sys2.hovered = null)}><i class="k-{k.kind}"></i>{k.name}<small class="kd">{KIND[k.kind]}</small></button>
          {/each}
        {/each}
        {#if gates.length}<div class="gh mono">HAT GEÇİTLERİ</div>
          {#each gates as g (g.id)}<button class:on={bsel === g.id} onclick={() => focusBody(g.id)} onmouseenter={() => sys2 && (sys2.hovered = g.id)} onmouseleave={() => sys2 && (sys2.hovered = null)}><i class="k-gate" style:border-color={g.color}></i>{g.lane.name}<small class="kd">→ {S.get(g.to)?.name}</small></button>{/each}{/if}
        {#if !blist.length}<div class="none mono">BU SİSTEMİN DÜNYALARI HAKKINDA BİLGİN YOK</div>{/if}
      </div>
      {#if marksOf(cs.id).length}<div class="mks">{#each marksOf(cs.id) as m (m.id)}<button class="mk-{m.kind} mkr" onclick={() => (inspect = { m })}><b>{m.kind === 'ship' ? '▲ GEMİN BURADA' : '◆ ' + (KL[m.kind] ?? 'Görev').toLocaleUpperCase('tr')}</b>{m.label}{#if m.note}<small>{m.note}</small>{/if}</button>{/each}</div>{/if}
      <button class="ovw mono" onclick={() => { bsel = null; sys2?.select(null); sys2?.overview(); }}>⌖ SİSTEMİN TAMAMI</button>
    {:else if panel === 'layers'}
      {#if mode === 'cluster'}
        <div class="mono h">BÖLGELER <span class="row2"><button class="mini mono" onclick={() => (hidden = [])}>HEPSİ</button><button class="mini mono" onclick={() => (hidden = Object.keys(map?.factions ?? {}).filter((k) => k !== 'dm'))}>HİÇBİRİ</button></span></div>
        <div class="facs">
          {#each Object.entries(map?.factions ?? {}) as [k, f] (k)}
            {#if k !== 'dm'}<label style:--fc={f.color}><input type="checkbox" checked={!hidden.includes(k)} onchange={(e) => (hidden = (e.target as HTMLInputElement).checked ? hidden.filter((x) => x !== k) : [...hidden, k])} /><span></span>{f.name}</label>{/if}
          {/each}
        </div>
      {/if}
      <div class="mono h">GÖRÜNÜM</div>
      <div class="tog">
        {#if mode === 'cluster'}<label><input type="checkbox" bind:checked={lanesOn} />Hatlar</label><label><input type="checkbox" bind:checked={terr} />Bölge tonu</label>
        {:else}<label><input type="checkbox" bind:checked={orbits} />Yörüngeler</label><label><input type="checkbox" bind:checked={moving} />Yörünge hareketi</label>{/if}
        <label><input type="checkbox" bind:checked={labels} />Etiketler</label>
        <label><input type="checkbox" bind:checked={notesOn} />Oyuncu notları</label>
      </div>
      <div class="mono h">GRAFİK KALİTESİ</div>
      <div class="qual mono">{#each ['low', 'med', 'high'] as x}<button class:on={q === x} onclick={() => (q = x as Quality)}>{QL[x]}</button>{/each}</div>
    {:else if panel === 'notes'}
      <div class="nfil mono">{#each [['all', 'TÜMÜ'], ['mine', 'BENİM'], ['pub', 'AÇIK'], ['priv', 'ÖZEL']] as [k, l] (k)}<button class:on={nfilter === k} onclick={() => (nfilter = k as typeof nfilter)}>{l}<em>{k === 'all' ? notes.length : k === 'mine' ? notes.filter((n) => n.uid === me).length : notes.filter((n) => n.vis === k).length}</em></button>{/each}</div>
      <button class="ovw mono add" onclick={() => openNote({})}>✎ {cur || sel ? 'BURAYA NOT EKLE · ' + whereOf((cur || sel)!).toLocaleUpperCase('tr') : 'NOT EKLE'}</button>
      <div class="nl">
        {#each notesShown as n (n.id)}
          <button class="ncard" class:priv={n.vis === 'priv'} style:--nc={n.col} style:--ah={authorHue(n.uid)} onclick={() => showNote(n)}>
            <i>{glyph(n.icon)}</i>
            <div><b>{n.label}</b><small class="mono"><span class="au">{n.uid === me ? 'SEN' : n.by.toLocaleUpperCase('tr')}</span> · {whereOf(n.sys, n.body)}</small>{#if n.text}<p>{n.text}</p>{/if}</div>
            <span class="vb mono">{n.vis === 'priv' ? '⊘ ÖZEL' : '◎'}</span>
          </button>
        {:else}<div class="none mono">{nfilter === 'mine' ? 'HENÜZ NOTUN YOK' : 'GÖSTERİLECEK NOT YOK'}<small>Haritada bir sisteme <b>Shift + sağ tık</b> ya da yukarıdaki düğme.</small></div>{/each}
      </div>
      {#if marks.length}<div class="mono h">DM İŞARETLERİ</div>
      <div class="mks">{#each marks as m (m.id)}<button class="mk-{m.kind}" onclick={() => { inspect = { m }; void goSys(m.sys); }} title={m.note}><b>{m.kind === 'ship' ? '▲' : '◆'}</b>{m.label}<small>{known(m.sys) ? S.get(m.sys)?.name : 'Bilinmeyen sinyal'}</small></button>{/each}</div>{/if}
    {:else if panel === 'alerts'}
      <div class="al">
        {#each [...ev].sort((a, b) => Number(!!b.forced) - Number(!!a.forced) || b.tpl.sev - a.tpl.sev) as e (e.key)}
          {@const sv = evd?.sev[e.tpl.sev]}
          <button class="alr" style:--sv={sv?.color} onclick={() => void goSys(e.sys)}><b class="mono">{sv?.label}</b><span>{e.tpl.name}</span><small class="mono">{S.get(e.sys)?.name}{#if e.lane} · {map?.lanes.find((l) => l.id === e.lane)?.name}{/if} · {left(e)} dk</small></button>
        {:else}<div class="none mono">KÜMEDE AKTİF UYARI YOK</div>{/each}
      </div>
    {:else if panel === 'legend'}
      <div class="lg">
        <div><span class="mono">YILDIZLAR</span>{#each ['G', 'K', 'F', 'M', 'A', 'redgiant', 'whitedwarf', 'pulsar', 'magnetar', 'blackhole'] as t}<em><i style:background={STAR_COLOR[t]}></i>{STYPE[t].split(' · ')[0]}</em>{/each}</div>
        <div><span class="mono">HATLAR</span>{#each Object.entries(LANE_COLOR) as [k, c]}<em><i class="bar" style:background={c}></i>{k}</em>{/each}<em><i class="bar" style:background="#ff3355"></i>Tehlikeli</em><em><i class="bar dash" style:background="#8892a6"></i>Kapalı / çökmüş</em><em><i class="bar dash" style:background="#b06bff"></i>Söylenti</em></div>
        <div><span class="mono">UYARI</span>{#each Object.values(evd?.sev ?? {}) as s}<em><i class="tri" style:border-bottom-color={s.color}></i>{s.label}</em>{/each}</div>
        <div><span class="mono">İŞARET</span><em><b class="lgs" style:color="#39ff8a">▲</b>Gemi</em><em><b class="lgs" style:color="#ff9b2f">◆</b>DM işareti</em><em><b class="lgs" style:color="var(--cy)">✎</b>Oyuncu notu</em><em><b class="lgs" style:color="#b06bff">⊘</b>Özel not</em></div>
      </div>
    {:else if panel === 'keys'}
      <dl class="keys">
        <dt class="mono">CTRL + K  ·  /</dt><dd>Komut paleti: sistem, cisim, not, komut</dd>
        <dt class="mono">SHIFT + SAĞ TIK</dt><dd>{isDM ? 'DM işareti (formdan kişisel nota geçebilirsin)' : 'Tıkladığın yere not bırak'}</dd>
        <dt class="mono">SOL TIK</dt><dd>Sistem ya da cisim seç</dd>
        <dt class="mono">SÜRÜKLE · TEKER</dt><dd>Kamerayı çevir · yakınlaş</dd>
        <dt class="mono">ESC</dt><dd>Önce açık pencereyi kapatır, sonra bir üst seviyeye çıkar</dd>
        <dt class="mono">GERİ SİL</dt><dd>Sistemden kümeye dön</dd>
      </dl>
    {/if}
  </aside>
  {/if}

  <!-- üst: konum izi + komut çubuğu -->
  <div class="cbar">
    <div class="crumb mono">
      <button class:cur={mode === 'cluster' && !sel} onclick={() => { if (mode === 'system') void back(); else { sel = null; sc?.select(null); sc?.overview(); } }}>◈ KÜME</button>
      {#if mode === 'cluster' && ss}<span>›</span><button class="cur" style:--fc={map?.factions[ss.owner]?.color}>{known(ss.id) ? ss.name.toLocaleUpperCase('tr') : '???'}</button>{/if}
      {#if mode === 'system' && cs}<span>›</span><button class:cur={!bsel} style:--fc={map?.factions[cs.owner]?.color} onclick={() => { bsel = null; sys2?.select(null); sys2?.overview(); }}>{cs.name.toLocaleUpperCase('tr')}</button>
        {#if bsel}<span>›</span><button class="cur">{(bsel === 'star' ? (cs.stype === 'blackhole' ? 'Saren' : cs.name) : gs ? gs.lane.name : bs?.name ?? bsel.replace(/^star-/, '')).toLocaleUpperCase('tr')}</button>{/if}{/if}
    </div>
    <button class="srch" onclick={() => { palOpen = true; sfx.glitch(); }}><span>⌕</span>Ara ya da komut yaz…<kbd class="mono">CTRL K</kbd></button>
  </div>

  <!-- sağ sütun: uyarı şeridi + ayrıntı kartı (katmanlı) -->
  <div class="rcol" class:off={routeOpen && mode === 'cluster'}>
  <section class="alerts" class:min={!!(ss && mode === 'cluster') || !!bsel} class:open={aopen} role="complementary" onmouseenter={() => (aopen = true)} onmouseleave={() => (aopen = false)}>
    {#if mode === 'system' && cs}
    <header class="mono"><span class="dot" class:hot={evFor(cs.id).length}></span>YEREL UYARILAR · {cs.name.toLocaleUpperCase('tr')}{#if evFor(cs.id).length > 1}<em class="more">+{evFor(cs.id).length - 1} {aopen ? '▴' : '▾'}</em>{/if}</header>
    {#each evFor(cs.id) as e (e.key)}
      {@const sv = evd?.sev[e.tpl.sev]}
      <article style:--sv={sv?.color}>
        <div class="row1 mono"><b>{sv?.label}</b><span>{evd?.cats[e.tpl.cat]}</span><span class="t">kalan {left(e)} dk</span></div>
        <h4>{e.tpl.name}{#if e.lane} <small>· {map?.lanes.find((l) => l.id === e.lane)?.name}</small>{/if}</h4>
        <p class="msg">“{e.tpl.msg}”</p><p class="eff">{e.tpl.effect}</p><div class="by mono">— {e.tpl.by}{#if e.forced} · DM{/if}</div>
      </article>
    {:else}<div class="none mono">BU SİSTEMDE AKTİF UYARI YOK</div>{/each}
    {:else}
    <header class="mono"><span class="dot" class:hot={ev.length}></span>YEREL UYARILAR{#if fs} · {known(fs.id) ? fs.name.toLocaleUpperCase('tr') : '???'}{:else} · KÜME ({ev.length}){/if}{#if (fs ? focusEv : topEv).length > 1}<em class="more">+{(fs ? focusEv : topEv).length - 1} {aopen ? '▴' : '▾'}</em>{/if}</header>
    {#each (fs ? focusEv : topEv) as e (e.key)}
      {@const sv = evd?.sev[e.tpl.sev]}
      <article style:--sv={sv?.color}>
        <div class="row1 mono"><b>{sv?.label}</b><span>{evd?.cats[e.tpl.cat]}</span><span class="t">kalan {left(e)} dk</span></div>
        <h4>{e.tpl.name}{#if !fs} <small>· {S.get(e.sys)?.name}</small>{/if}{#if e.lane} <small>· {map?.lanes.find((l) => l.id === e.lane)?.name}</small>{/if}</h4>
        <p class="msg">“{e.tpl.msg}”</p>
        <p class="eff">{e.tpl.effect}</p>
        <div class="by mono">— {e.tpl.by}{#if e.forced} · DM{/if}</div>
      </article>
    {:else}
      <div class="none mono">{fs ? 'BU SİSTEMDE AKTİF UYARI YOK' : 'KÜMEDE AKTİF UYARI YOK'}</div>
    {/each}
    {/if}
  </section>
  {#if mode === 'system' && cs && bsel}
    {#key bsel}
      <aside class="pan info bpan card" style:--fc={map?.factions[cs.owner]?.color}>
        <button class="x" onclick={() => { bsel = null; sys2?.select(null); }} aria-label="Kapat">✕</button>
        <div class="ibody">
        {#if bsel === 'star' || bsel.startsWith('star-')}
          <div class="mono k">{bsel === 'star' ? STYPE[cs.stype] : 'Eş yıldız'}</div>
          <h2>{bsel === 'star' ? (cs.stype === 'blackhole' ? 'Saren' : cs.name) : bsel.slice(5)}</h2>
          <div class="own"><span class="chip" role="button" tabindex="0" onclick={() => map?.factions[cs.owner].state && getEntry(map.factions[cs.owner].state!) && openTag(map.factions[cs.owner].state!)} onkeydown={() => {}}>{map?.factions[cs.owner]?.name}</span></div>
          {#if bsel === 'star'}<table class="ph"><tbody><tr><td>Yıldız</td><td>{cs.star || STYPE[cs.stype]}</td></tr>{#if starEnt?.summary && !generic(starEnt.summary) && !cs.star.includes(starEnt.summary.replace(/\.$/, ''))}<tr><td>Not</td><td>{starEnt.summary}</td></tr>{/if}</tbody></table>
          {:else}<p class="sum">{bsel === 'star-Gwathren' ? 'Isilwen B, kızıl cüce, patlama yıldızı; A\'dan ortalama 38 AB.' : bsel === 'star-Morwen B' ? 'M2 V kızıl cüce, A\'dan 38 AB; ara sıra patlama.' : 'Genç, sıcak beyaz cüce; A\'dan ~900 AB. Hithlin bulutsusunu parlatır.'}</p>{/if}
          {@render gallery(bsel, [], bsel === 'star' ? cs.name : bsel.slice(5))}
          <div class="act"><button class="btn ghost" onclick={() => openTag(cur!)}>Sistem kodeksi</button></div>
        {:else if gs}
          <div class="mono k">Hat geçidi + istasyon · {gs.lane.kind}</div>
          <h2>{gs.name}</h2>
          <div class="own"><span class="chip" role="button" tabindex="0" onclick={() => map?.factions[cs.owner].state && getEntry(map.factions[cs.owner].state!) && openTag(map.factions[cs.owner].state!)} onkeydown={() => {}}>{map?.factions[cs.owner]?.name}</span><span class="mono dg" style:color={gs.color}>{STATUS_TR[gs.status] ?? gs.status}</span></div>
          <table class="ph"><tbody>
            <tr><td>Hat</td><td>{gs.lane.name}</td></tr><tr><td>Hedef</td><td>{S.get(gs.to)?.name} · {S.get(gs.to) ? map?.factions[S.get(gs.to)!.owner]?.name : ''}</td></tr>
            <tr><td>Yön</td><td>Sistemin {dirName(gs.ang)} kıyısı{#if gs.au}{" · ~" + gs.au + " AB"}{/if}</td></tr><tr><td>Tür</td><td>{gs.lane.kind}</td></tr><tr><td>Süre</td><td>{gs.lane.days}</td></tr><tr><td>Tehlike</td><td>{gs.lane.danger}</td></tr>
          </tbody></table>
          {#if gcanon}<p class="sum"><b>{gcanon.name}</b> · {gcanon.type}{#if gcanon.orbit} · {gcanon.orbit} AB{/if}</p>{#if gcanon.desc}<p class="desc"><RichText text={gcanon.desc} self={gcanon.ent} /></p>{/if}{#if gcanon.dm}<div class="dmnote"><span class="mono">DM · GİZLİ</span><RichText text={gcanon.dm} self={gcanon.ent} /></div>{/if}{/if}
          {#each ev.filter((e) => e.lane === gs.lane.id) as e (e.key)}<div class="gev" style:--sv={evd?.sev[e.tpl.sev].color}><b class="mono">{evd?.sev[e.tpl.sev].label}</b> {e.tpl.name} · kalan {left(e)} dk</div>{/each}
          {@render gallery(gs.id, [], gs.name)}
          <div class="act">{#if getEntry(gs.lane.id)}<button class="btn ghost" onclick={() => openTag(gs.lane.id)}>Hat kodeksi</button>{/if}<button class="btn" disabled={!known(gs.to) || gs.status === 'collapsed' || gs.status === 'closed'} onclick={() => jump(gs.to)}>Hedefe geç ›</button></div>
        {:else if bs}
          <div class="mono k">{KIND[bs.kind]} · {bs.type}{#if bs.note} · {bs.note}{/if}</div>
          <h2>{bs.name}</h2>
          {#if bs.pop}<div class="ot">Halk arasında: <b>{bs.pop}</b></div>{/if}
          <div class="own"><span class="chip" role="button" tabindex="0" onclick={() => map?.factions[cs.owner].state && getEntry(map.factions[cs.owner].state!) && openTag(map.factions[cs.owner].state!)} onkeydown={() => {}}>{map?.factions[cs.owner]?.name}</span>{#if bs.parent && bmap.get(bs.parent)}<span class="mono dg">↳ {bmap.get(bs.parent)?.name}</span>{/if}</div>
          {#if rows(bs).length}<table class="ph"><tbody>{#each rows(bs) as [k, v] (k)}<tr><td>{k}</td><td>{v}</td></tr>{/each}{#if bs.count}<tr><td>Sayı</td><td>{bs.count}</td></tr>{/if}</tbody></table>{/if}
          {#if be?.summary && !generic(be.summary) && be.type !== 'system'}<p class="sum"><RichText text={be.summary} self={be.id} /></p>{/if}
          {#if bs.desc}<p class="desc"><RichText text={bs.desc} self={bs.ent} /></p>{/if}
          {#if bs.dm}<div class="dmnote"><span class="mono">DM · GİZLİ</span><RichText text={bs.dm} self={bs.ent} /></div>{/if}
          {@render gallery(bs.id, bs.imgs?.length ? bs.imgs.map((x) => ({ u: base + 'img/bo/' + x.f, t: x.t })) : bs.img ? [{ u: base + 'img/bd/' + bs.img, t: 'orbit' }] : [], bs.name)}
          {#if be && childrenOf(be.id).length}
            <Fold k="tags" title="ETİKETLER" count={childrenOf(be.id).length}><div class="tags">{#each childrenOf(be.id) as c (c.id)}<button class="tg" style:--c={tmeta(c.type).color} onclick={() => openTag(c.id)}>{c.name}</button>{/each}</div></Fold>
          {/if}
          {@render noteFold(cs.id, bs.id)}
          <div class="act">{#if be}<button class="btn ghost" onclick={() => openTag(be.id)}>Kodeks</button>{/if}<button class="btn ghost" onclick={() => focusBody(bs.id)}>Odakla</button><button class="btn ghost" onclick={() => openNote({ sys: cs.id, body: bs.id })}>✎ Not ekle</button></div>
        {/if}
        </div>
      </aside>
    {/key}
  {/if}
  {#if mode === 'cluster' && ss && !routeOpen}
    {#key ss.id}
      <aside class="pan info card" style:--fc={map?.factions[ss.owner]?.color}>
        <button class="x" onclick={() => { sel = null; sc?.select(null); }} aria-label="Kapat">✕</button>
        <div class="ibody">
        <div class="mono k">{STYPE[ss.stype]}{#if ss.star && known(ss.id)} · {ss.star}{/if}</div>
        <h2 class="glitch" data-text={known(ss.id) ? ss.name : 'Bilinmeyen sinyal'}>{known(ss.id) ? ss.name : 'Bilinmeyen sinyal'}</h2>
        {#if ss.owner === 'dm'}
          <p class="sum">Haritada adı geçen bir sistem. Hakkında bilinen bir şey yok.</p>
        {:else}
          <div class="own"><span class="chip" role="button" tabindex="0" onclick={() => map?.factions[ss.owner].state && getEntry(map.factions[ss.owner].state!) && openTag(map.factions[ss.owner].state!)} onkeydown={() => {}}>{map?.factions[ss.owner]?.name}</span>
            <span class="mono dg">TEHLİKE {ss.danger}</span></div>
          {#if ss.ownerText}<div class="ot">{ss.ownerText}</div>{/if}
          {#if se?.summary}<p class="sum"><RichText text={se.summary} self={se.id} /></p>{/if}
          {#if childrenOf(ss.id).length}
            <Fold k="bodies" title="GÖK CİSİMLERİ" count={childrenOf(ss.id).length}><div class="tags">{#each childrenOf(ss.id) as c (c.id)}<button class="tg" style:--c={tmeta(c.type).color} onclick={() => openTag(c.id)}>{c.name}</button>{/each}</div></Fold>
          {/if}
          {#if lanesOf(ss.id).length}
            <Fold k="lanes" title="HATLAR" count={lanesOf(ss.id).length}><div class="ln">{#each lanesOf(ss.id) as l (l.id)}
              {@const o = l.a === ss.id ? l.b : l.a}
              <button onclick={() => selectSys(o)}><i style:background={l.status === 'open' ? LANE_COLOR[l.kind] : l.status === 'danger' ? '#ff3355' : '#8892a6'}></i><b>{l.name}</b><span>→ {S.get(o)?.name} · {l.kind} · {l.days}</span></button>
            {/each}</div></Fold>
          {/if}
          {#if marksOf(ss.id).length}<Fold k="marks" title="DM İŞARETLERİ" count={marksOf(ss.id).length}><div class="mks">{#each marksOf(ss.id) as m (m.id)}<button class="mk-{m.kind}" onclick={() => (inspect = { m })}><b>{m.kind === 'ship' ? '▲' : '◆'}</b>{m.label}<small>{KL[m.kind]}</small></button>{/each}</div></Fold>{/if}
          {@render noteFold(ss.id)}
          <div class="act">
            <button class="btn ghost" onclick={() => se && openTag(se.id)}>Kodeks</button>
            <button class="btn ghost" onclick={() => { rFrom = ss.id; routeOpen = true; sfx.glitch(); }}>Buradan rota</button>
            <button class="btn ghost" onclick={() => openNote({ sys: ss.id })}>✎ Not ekle</button>
            {#if isDM}<button class="btn ghost" onclick={() => openPin({ sys: ss.id })}>◆ DM işareti</button>{/if}
            <button class="btn go" onclick={enter} disabled={!known(ss.id)}>Sisteme gir ›</button>
          </div>
        {/if}
        </div>
      </aside>
    {/key}
  {/if}
  </div>
  {#snippet gallery(id: string, imgs: { u: string; t: string }[], name: string)}
    <Fold k="gal" title="GÖRÜNTÜLER" count={imgs.length + (snaps[id]?.length ?? 0) || ''}>
    <div class="gal">
      {#each imgs as g (g.u)}{@const lb = g.t === 'surface' ? 'YÜZEY' : 'YÖRÜNGE'}<button onclick={() => openImage(g.u, name + ' · ' + lb.toLocaleLowerCase('tr'))}><img src={g.u} alt={name + ' · ' + lb} loading="lazy" decoding="async" /><em class="mono">{lb}</em></button>{/each}
      {#each snaps[id] ?? [] as u, i (i)}<button onclick={() => openImage(u, name + ' · simülasyon')}><img src={u} alt={name + ' · simülasyon'} /><em class="mono">SİMÜLASYON</em></button>{/each}
      {#if !snaps[id]}<div class="snapld mono">GÖRÜNTÜ İŞLENİYOR…</div>{/if}
    </div>
    </Fold>
  {/snippet}
  {#snippet noteFold(sys: string, body?: string)}
    {@const xs = notesOf(sys).filter((n) => !body || n.body === body)}
    <Fold k="notes" title="NOTLAR" count={xs.length || ''}>
      <div class="nl in">
        {#each xs as n (n.id)}
          <button class="ncard" class:priv={n.vis === 'priv'} style:--nc={n.col} style:--ah={authorHue(n.uid)} onclick={() => (inspect = { n })}>
            <i>{glyph(n.icon)}</i><div><b>{n.label}</b><small class="mono"><span class="au">{n.uid === me ? 'SEN' : n.by.toLocaleUpperCase('tr')}</span> · {ago(n.upd)}</small></div>
            <span class="vb mono">{n.vis === 'priv' ? '⊘' : '◎'}</span>
          </button>
        {:else}<div class="nnone mono">NOT YOK · <button onclick={() => openNote({ sys, body })}>İLK NOTU BIRAK</button></div>{/each}
      </div>
    </Fold>
  {/snippet}

  {#if mode === 'cluster' && routeOpen && map}<Route {map} {known} {ev} bind:from={rFrom} onroute={setRoute} onclose={() => { routeOpen = false; setRoute(null); }} />{/if}
  {#if warp}
    <div class="warp" class:out={warp === 2}><div class="streaks"></div><div class="flash"></div>
      {#if warp === 1 && (cs || ss)}<div class="wtag mono">{mode === 'system' ? 'KÜMEYE DÖNÜŞ' : 'SİSTEME GİRİŞ · ' + (ss?.name ?? '').toLocaleUpperCase('tr')}</div>{/if}
    </div>
  {/if}
  {#if !map && !err}<div class="ld mono">KÜME VERİSİ YÜKLENİYOR…</div>{/if}
  {#if err}<div class="ld mono err">HARİTA AÇILAMADI: {err}</div>{/if}
  {#if placeMode}<div class="place mono">{placeMode === 'mark' ? '◆ DM İŞARETİ' : '✎ NOT'} · haritaya tıkla, oraya düşer <button onclick={() => (placeMode = '')}>ESC · İPTAL</button></div>{/if}
  {#if toast}<div class="toast mono" transition:fly={{ y: 10, duration: 200 }}>{toast}</div>{/if}
  <div class="hint mono"><span><kbd>SHIFT</kbd>+<kbd>SAĞ TIK</kbd> {isDM ? 'işaret / not' : 'not bırak'}</span><span><kbd>CTRL K</kbd> komut</span><span><kbd>ESC</kbd> geri</span></div>
</div>

  {#if pin}
    <div class="pinf" transition:fly={{ y: -12, duration: 200 }}>
      <header><span class="mono t">{marks.some((m) => m.id === pin!.id) ? 'DM İŞARETİNİ DÜZENLE' : 'YENİ DM İŞARETİ'}</span>{#if !marks.some((m) => m.id === pin!.id)}<button class="sw mono" onclick={() => { const p0 = pin!; pin = null; openNote({ sys: p0.sys, body: p0.body, x: p0.x, y: p0.y, z: p0.z }); }}>KİŞİSEL NOT ⇄</button>{/if}<button class="x" onclick={() => { pin = null; placeMode = ''; }} aria-label="Kapat">✕</button></header>
      <div class="loc mono">⌖ {whereOf(pin.sys, pin.body)}</div>
      <div class="kd">{#each KINDS as [k,l]}<button class:on={pin.kind===k} onclick={() => pin && (pin.kind = k)}>{l}</button>{/each}</div>
      <input class="inp" placeholder="Etiket" bind:value={pin.label} maxlength="60" />
      <input class="inp" placeholder="Kategori (isteğe bağlı)" bind:value={pin.cat} />
      <textarea class="inp" rows="2" placeholder="Not" bind:value={pin.note}></textarea>
      <div class="mono h">KİMLER GÖRÜR</div>
      <div class="pl">{#each plist as p (p.uid)}<label class="ck"><input type="checkbox" checked={pin.players.includes(p.uid)} onchange={(e) => pin && (pin.players = (e.currentTarget as HTMLInputElement).checked ? [...pin.players, p.uid] : pin.players.filter((x) => x !== p.uid))} />{p.name}</label>{/each}</div>
      <div class="act"><button class="btn" onclick={savePin}>Kaydet</button><button class="btn ghost" onclick={() => { pin = null; placeMode = ''; }}>Vazgeç</button></div>
    </div>
  {/if}
  {#if nform}
    {#key nform.n.id}<NoteForm note={nform.n} isNew={nform.isNew} where={whereOf(nform.n.sys, nform.n.body)} onsave={putNote}
      ondelete={nform.isNew ? undefined : () => delNote(nform!.n)} oncancel={() => (nform = null)}
      dmSwitch={isDM && nform.isNew ? () => { const n0 = nform!.n; nform = null; openPin({ sys: n0.sys, body: n0.body, x: n0.x, y: n0.y, z: n0.z }); } : undefined} />{/key}
  {/if}
  {#if palOpen}<Palette items={palItems()} onclose={() => (palOpen = false)} />{/if}

  {#if tip}<div class="ptip mono" style:left="{tip.x}px" style:top="{tip.y}px">{tip.t}</div>{/if}
  {#if inspect?.m}
    {@const m = inspect.m}
    <div class="insp" transition:fly={{ y: 12, duration: 200 }}>
      <div class="mono k">{KL[m.kind] ?? m.kind} · DM · {whereOf(m.sys, m.body)}</div>
      <h3>{m.label}</h3>
      {#if m.note}<p>{m.note}</p>{/if}
      {#if m.cat}<div class="mono cat">{m.cat}</div>{/if}
      <div class="act"><button class="btn ghost" onclick={() => (inspect = null)}>Kapat</button>{#if isDM}<button class="btn ghost" onclick={() => editMark(m)}>Düzenle</button>
        <button class="btn red" onclick={() => delMark(m)}>Sil</button>{/if}</div>
    </div>
  {:else if inspect?.n}
    {@const n = inspect.n}
    <div class="insp note" class:priv={n.vis === 'priv'} style:--nc={n.col} transition:fly={{ y: 12, duration: 200 }}>
      <div class="ih"><i>{glyph(n.icon)}</i><div><div class="mono k">{NOTE_ICONS.find((x) => x.id === n.icon)?.l.toLocaleUpperCase('tr')} · {whereOf(n.sys, n.body)}</div><h3>{n.label}</h3></div>
        <span class="vb mono">{n.vis === 'priv' ? '⊘ ÖZEL' : '◎ HERKESE AÇIK'}</span></div>
      {#if n.text}<p>{n.text}</p>{/if}
      <div class="by mono"><span class="au" style:--ah={authorHue(n.uid)}>{n.uid === me ? 'SEN' : n.by.toLocaleUpperCase('tr')}</span> · {ago(n.upd)}{#if n.upd - n.at > 60000} · düzenlendi{/if}</div>
      <div class="act">
        <button class="btn ghost" onclick={() => (inspect = null)}>Kapat</button>
        {#if n.uid === me}<button class="btn ghost" onclick={() => { nform = { n: { ...n }, isNew: false }; inspect = null; }}>Düzenle</button>{/if}
        {#if n.uid === me || isDM}<button class="btn red" onclick={() => delNote(n)}>Sil</button>{/if}
      </div>
    </div>
  {/if}

<style>
  .sm{position:absolute;inset:0;overflow:hidden;background:#020309}
  .gl{position:absolute;inset:0}.gl :global(canvas){display:block;width:100%;height:100%}
  .ov{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.55))}
  .ov :global(.sm-lbl){position:absolute;left:0;top:0;margin:-30px 0 0 12px;white-space:nowrap;font-family:var(--f-ui);font-size:13px;letter-spacing:.08em;color:#dff6ff;
    text-shadow:0 0 6px #000,0 0 3px #000;display:flex;align-items:center;gap:5px;will-change:transform;transition:opacity .2s}
  .ov :global(.sm-lbl b){font-weight:600;border-left:2px solid var(--fc);padding-left:6px}
  .ov :global(.sm-lbl.focus b){color:var(--ye);font-size:15px}
  .ov :global(.sm-lbl.unk b),.ov :global(.sm-lbl.dm b){color:#8a93a3;font-style:italic}
  .ov :global(.sm-lbl .ev){display:none;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid var(--sv);filter:drop-shadow(0 0 4px var(--sv));animation:evb 1.4s infinite}
  .ov :global(.sm-lev){position:absolute;left:0;top:0;margin:-6px 0 0 -6px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:10px solid var(--sv);filter:drop-shadow(0 0 5px var(--sv));animation:evb 1.4s infinite}
  @keyframes evb{50%{opacity:.35}}
  .pan{position:absolute;z-index:4;background:rgba(5,8,14,.82);border:1px solid rgba(0,240,255,.25);backdrop-filter:blur(6px)}
  .capi{width:13px;height:13px;fill:var(--ye);stroke:none;margin-left:4px;filter:drop-shadow(0 0 3px rgba(252,238,10,.6));flex:none}.capi.old{fill:none;stroke:#b8a060;stroke-width:1.3}
  .ov :global(.sm-lbl .cap){pointer-events:auto;cursor:help;position:relative;display:inline-grid;place-items:center;width:17px;height:17px;border:1px solid rgba(252,238,10,.7);background:rgba(20,16,0,.75);box-shadow:0 0 8px rgba(252,238,10,.35);text-decoration:none}
  .ov :global(.sm-lbl .cap svg){width:12px;height:12px;fill:var(--ye);stroke:var(--ye);stroke-width:.6}
  .ov :global(.sm-lbl .cap.old){border-color:rgba(184,160,96,.6);background:rgba(10,8,0,.6);box-shadow:none}.ov :global(.sm-lbl .cap.old svg){fill:none;stroke:#b8a060;stroke-width:1.2}
  .ov :global(.sm-lbl .mk s){pointer-events:auto;cursor:help;position:relative;text-decoration:none;margin-left:6px;font-size:16px;font-weight:700}
  .ov :global(.sm-lbl .mk .sh){color:#39ff8a;text-shadow:0 0 12px #39ff8a,0 0 2px #39ff8a;animation:evb 1.2s infinite}.ov :global(.sm-lbl .mk .mi){color:#ff9b2f;text-shadow:0 0 12px #ff9b2f,0 0 2px #ff9b2f;animation:evb 1.4s infinite}
  .ov :global(.sm-lbl .mk s:hover::after){content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);white-space:nowrap;font-family:var(--f-mono);font-size:10.5px;letter-spacing:.1em;color:#000;background:#dff6ff;padding:4px 8px}
  .pinf{position:absolute;left:50%;top:70px;transform:translateX(-50%);z-index:12;width:min(380px,90vw);background:rgba(5,8,14,.95);border:1px solid var(--cy);padding:12px;display:flex;flex-direction:column;gap:8px}
  .pinf .kd{display:flex;flex-wrap:wrap;gap:4px}.pinf .kd button{background:none;border:1px solid var(--line);color:var(--mut);padding:4px 8px;font:inherit;font-size:12px}.pinf .kd button.on{border-color:var(--cy);color:var(--cy)}
  .pinf .ck{display:flex;gap:6px;align-items:center;font-size:13px}
  .place{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);z-index:11;background:rgba(0,0,0,.7);border:1px solid var(--ye);color:var(--ye);padding:6px 12px;letter-spacing:.16em}
  .ptip{position:fixed;z-index:20;transform:translate(-50%,-130%);background:rgba(5,8,14,.95);border:1px solid var(--ye);color:var(--ye);padding:4px 8px;font-size:11px;letter-spacing:.12em;pointer-events:none;white-space:nowrap;box-shadow:0 0 16px rgba(252,238,10,.25)}
  .insp{position:absolute;left:50%;bottom:80px;transform:translateX(-50%);z-index:12;width:min(360px,90vw);background:rgba(5,8,14,.96);border:1px solid var(--cy);padding:14px 16px}
  .insp h3{font-family:var(--f-disp);color:#fff;margin:4px 0 8px;font-size:20px}
  .ov :global(.pin-lbl){position:absolute;left:0;top:0;margin:-28px 0 0 0;transform:translate(-50%,-100%);white-space:nowrap;font-family:var(--f-ui);font-size:12px;color:#dff6ff;text-shadow:0 0 6px #000;pointer-events:none;text-align:center}
  .ov :global(.pin-lbl b){display:block;font-weight:600;color:#fff}.ov :global(.pin-lbl i){font-style:normal;font-size:9px;letter-spacing:.2em;color:var(--ye)}
  .mkg{margin-left:auto;color:#39ff8a;font-size:11px}
  .mks{display:flex;flex-direction:column;gap:4px;margin:4px 0 8px}
  .mks button,.mks .mkr{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;text-align:left;background:rgba(0,0,0,.35);border:1px solid rgba(57,255,138,.35);color:var(--tx);padding:5px 8px;font-size:13px}
  .mks .mk-mission{border-color:rgba(255,155,47,.45)}.mks b{color:#39ff8a;font-family:var(--f-mono);font-size:11px}.mks .mk-mission b{color:#ff9b2f}.mks small{color:var(--mut);font-size:11px;margin-left:auto}.mks .mkr small{margin-left:0;flex-basis:100%}
  .ov :global(.sm-lbl .cap:hover::after){content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);white-space:nowrap;font-family:var(--f-mono);font-size:10.5px;letter-spacing:.12em;color:#000;background:var(--ye);padding:4px 8px;box-shadow:0 0 12px rgba(252,238,10,.4)}
  .gh{font-size:9px;letter-spacing:.3em;color:#c78bff;margin:8px 0 2px 4px}
  .gev{font-size:12px;border-left:3px solid var(--sv);padding:3px 8px;background:rgba(255,255,255,.03)}.gev b{color:var(--sv);font-size:9.5px;letter-spacing:.15em}
  .ttl{font-size:12px;letter-spacing:.3em;color:var(--cy)}.ttl small{color:var(--ye);margin-left:6px}
  .lst{flex:1;min-height:80px;overflow:auto;display:flex;flex-direction:column}
  .lst button{display:flex;align-items:center;gap:8px;padding:4px 6px;background:none;border:0;color:var(--tx);text-align:left;font-size:13.5px}
  .lst button i{width:7px;height:7px;border-radius:50%;box-shadow:0 0 6px currentColor;flex:none}
  .lst button em{margin-left:auto;font-style:normal;font-size:10px}
  .lst button:hover{background:rgba(0,240,255,.08)}.lst button.on{color:var(--ye);background:rgba(252,238,10,.08)}
  .h{font-size:9.5px;letter-spacing:.3em;color:var(--mut);margin-top:4px}
  .facs,.tog{display:flex;flex-direction:column;gap:2px;font-size:12.5px}
  .facs label,.tog label{display:flex;align-items:center;gap:7px;cursor:pointer;color:#c9d6e2}
  .facs input,.tog input{accent-color:var(--cy)}
  .facs span{width:10px;height:10px;background:var(--fc);box-shadow:0 0 6px var(--fc);flex:none}
  .qual{display:flex;gap:4px;align-items:center;font-size:9.5px;letter-spacing:.15em;color:var(--mut)}
  .qual button{flex:1;background:none;border:1px solid var(--line);color:var(--mut);font-family:var(--f-mono);font-size:9.5px;padding:4px 0}
  .qual button.on{border-color:var(--cy);color:var(--cy)}
  .ovw.dim{opacity:.7;pointer-events:none}.ovw{background:none;border:1px solid var(--line);color:var(--cy);padding:6px;font-size:10.5px;letter-spacing:.2em}.ovw:hover{border-color:var(--cy)}
  .rcol{position:absolute;right:16px;top:58px;width:min(400px,32vw);z-index:8;display:flex;flex-direction:column;pointer-events:none}
  .rcol > :global(*){pointer-events:auto}
  .alerts{position:static;width:auto;max-height:42vh;overflow:hidden;display:flex;flex-direction:column;gap:6px;transition:max-height .35s}

  .alerts.open{max-height:76vh;overflow:auto}
  .alerts:not(.open) article:not(:first-of-type){display:none}
  .alerts:not(.open) article:first-of-type .eff,.alerts:not(.open) article:first-of-type .by{display:none}
  .alerts.open article:not(:first-of-type){animation:ad .3s both}
  @keyframes ad{from{opacity:0;transform:translateY(-10px)}}
  .alerts header .more{margin-left:auto;font-style:normal;color:var(--cy)}
  .alerts header{font-size:10.5px;letter-spacing:.22em;color:var(--ye);background:rgba(5,8,14,.85);border:1px solid rgba(252,238,10,.35);padding:7px 10px;display:flex;align-items:center;gap:8px}
  .dot{width:8px;height:8px;border-radius:50%;background:#3a4252}.dot.hot{background:var(--rd);box-shadow:0 0 8px var(--rd);animation:evb 1s infinite}
  .alerts article{background:rgba(5,8,14,.88);border:1px solid color-mix(in srgb,var(--sv) 40%,transparent);border-left:3px solid var(--sv);padding:8px 10px;animation:ai .3s both}
  @keyframes ai{from{opacity:0;transform:translateX(12px)}}
  .row1{display:flex;gap:8px;font-size:9.5px;letter-spacing:.15em;color:var(--mut)}.row1 b{color:var(--sv)}.row1 .t{margin-left:auto;color:var(--cy)}
  .alerts h4{font-size:15px;color:#fff;margin:3px 0}.alerts h4 small{color:var(--mut);font-weight:400}
  .msg{font-size:12.5px;color:#d7e3ee;font-style:italic;line-height:1.4}.eff{font-size:12px;color:var(--mut);margin-top:4px;line-height:1.4}
  .by{font-size:9.5px;color:var(--mut);margin-top:4px;letter-spacing:.08em}
  .none{font-size:10px;letter-spacing:.2em;color:var(--mut);background:rgba(5,8,14,.8);padding:10px;border:1px solid var(--line)}
  .info{right:16px;bottom:16px;top:auto;width:min(400px,32vw);max-height:calc(100% - 200px);padding:14px 16px;overflow:hidden;border-color:color-mix(in srgb,var(--fc) 55%,transparent);animation:ii .35s cubic-bezier(.2,.9,.2,1) both;display:flex;flex-direction:column;gap:8px;z-index:7}
  @keyframes ii{from{opacity:0;transform:translateX(30px)}}
  .info .x{position:absolute;right:8px;top:8px;background:none;border:0;color:var(--mut)}
  .k{font-size:10px;letter-spacing:.18em;color:var(--fc)}
  .info .ibody{flex:1 1 auto;min-height:0;overflow:auto;padding-right:4px}
  .info h2{font-family:var(--f-disp);font-size:24px;letter-spacing:.08em;color:#fff;text-shadow:0 0 16px color-mix(in srgb,var(--fc) 60%,transparent)}
  .own{display:flex;align-items:center;gap:10px}.chip{font-size:12.5px;padding:2px 8px;border:1px solid var(--fc);color:var(--fc);cursor:pointer}
  .dg{font-size:10px;letter-spacing:.15em;color:var(--ye)}.ot{font-size:12px;color:var(--mut)}
  .sum{font-size:14px;line-height:1.5;color:#d2dfea}
  .tags{display:flex;flex-wrap:wrap;gap:4px}.tg{font-size:12px;padding:2px 7px;background:color-mix(in srgb,var(--c) 10%,transparent);border:1px solid color-mix(in srgb,var(--c) 45%,transparent);color:var(--c)}
  .ln{display:flex;flex-direction:column;gap:3px}.ln button{display:flex;align-items:center;gap:7px;background:none;border:0;color:var(--tx);text-align:left;font-size:12.5px;padding:2px 0}
  .ln i{width:14px;height:3px;flex:none}.ln span{color:var(--mut);font-size:11.5px}.ln button:hover b{color:var(--ye)}
  .act{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line);flex:none}.act .btn{width:100%}.act .btn.go{grid-column:1/-1}
  .lg{display:flex;flex-direction:column;gap:5px;margin-top:6px}.lg>div{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;max-width:620px}
  .lg span{font-size:9.5px;letter-spacing:.2em;color:var(--mut);width:70px}
  .lg em{font-style:normal;display:flex;align-items:center;gap:5px}.lg i{width:8px;height:8px;border-radius:50%;box-shadow:0 0 5px currentColor}
  .lg i.bar{width:16px;height:3px;border-radius:0}.lg i.dash{background-image:repeating-linear-gradient(90deg,transparent 0 3px,#020309 3px 5px)!important}
  .lg i.tri{width:0;height:0;border-radius:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid;box-shadow:none}
  .ov :global(.sb-lbl){position:absolute;left:0;top:0;margin:-24px 0 0 10px;white-space:nowrap;font-family:var(--f-ui);font-size:12.5px;letter-spacing:.07em;color:#dff6ff;text-shadow:0 0 6px #000,0 0 3px #000;will-change:transform;transition:opacity .2s}
  .ov :global(.sb-lbl b){font-weight:500;border-left:2px solid rgba(0,240,255,.6);padding-left:5px}
  .ov :global(.sb-lbl.k-star b){border-color:var(--ye);color:#fff3c0;font-size:14px}
  .ov :global(.sb-lbl.k-moon),.ov :global(.sb-lbl.k-swarm){font-size:11px;color:#b8cad8}.ov :global(.sb-lbl.k-moon b),.ov :global(.sb-lbl.k-swarm b){border-color:rgba(160,180,200,.5)}
  .ov :global(.sb-lbl.k-belt){font-size:10.5px;color:#9fb0c0;font-style:italic}.ov :global(.sb-lbl.k-belt b){border-color:rgba(160,180,200,.35)}
  .ov :global(.sb-lbl.k-station b){border-color:#00f0ff;color:#bff8ff}.ov :global(.sb-lbl.k-gate b){border-color:#c78bff;color:#e6d4ff}
  .ov :global(.sb-lbl.focus b){color:var(--ye);font-size:14px;border-color:var(--ye)}
  .sub{font-size:9.5px;letter-spacing:.14em;color:var(--fc)}
  .blst button{font-size:13px}.blst .kid{padding-left:20px;font-size:12.5px;color:#b8c8d6}
  .blst .kd{margin-left:auto;font-size:9.5px;color:var(--mut);letter-spacing:.05em}
  .blst i{border-radius:50%;background:#9ab0c4}.blst i.k-belt{border-radius:0;height:2px!important;background:#8a96a4}.blst i.k-station{border-radius:1px;background:#00f0ff}
  .blst i.k-gate{background:none;border:1.5px solid #c78bff}.blst i.k-singularity{background:#000;box-shadow:0 0 0 2px #ff9a3c}.blst i.k-moon{width:5px!important;height:5px!important}
  .back{color:var(--ye)}.back small{color:var(--mut);margin-left:6px}
  .ph{width:100%;border-collapse:collapse;font-size:12px}.ph td{padding:3px 4px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top;color:#d2dfea}.ph td:first-child{color:var(--mut);width:84px;font-family:var(--f-mono);font-size:10px;letter-spacing:.1em}
  .desc{font-size:13px;line-height:1.55;color:#c4d2de}
  .dmnote{border:1px dashed rgba(255,42,70,.5);padding:6px 8px;font-size:12.5px;color:#f2c4cc;line-height:1.45}.dmnote span{display:block;font-size:9px;letter-spacing:.25em;color:var(--rd);margin-bottom:3px}
  .gal{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.gal button{position:relative;padding:0;border:1px solid var(--line);background:#000;aspect-ratio:1;overflow:hidden}
  .gal img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}.gal button:hover img{transform:scale(1.06)}
  .gal em{position:absolute;left:3px;bottom:2px;font-size:7.5px;letter-spacing:.15em;color:var(--cy);font-style:normal;text-shadow:0 0 3px #000}
  .snapld{grid-column:span 2;display:grid;place-items:center;font-size:9px;letter-spacing:.2em;color:var(--mut);border:1px dashed var(--line);aspect-ratio:2}
  .bpan{top:auto}
  .wtag{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:12px;letter-spacing:.4em;color:var(--cy);text-shadow:0 0 10px var(--cy);animation:ai .4s .3s both}
  .warp.out{pointer-events:none}.warp.out .streaks{animation:wzo .9s ease-out forwards}.warp.out .flash{animation:wfo .9s forwards}
  @keyframes wzo{0%{transform:scale(3.4) rotate(12deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:0}}
  @keyframes wfo{0%{opacity:1;background:#020309}100%{opacity:0;background:#020309}}
  .warp{position:absolute;inset:0;z-index:8;overflow:hidden;pointer-events:auto}
  .streaks{position:absolute;inset:-50%;background:repeating-conic-gradient(from 0deg,rgba(160,240,255,0) 0 2.2deg,rgba(160,240,255,.75) 2.3deg 2.5deg,rgba(160,240,255,0) 2.6deg 5deg);
    mask-image:radial-gradient(circle,transparent 4%,#000 30%,transparent 70%);animation:wz 1.1s cubic-bezier(.6,0,.9,.4) forwards}
  @keyframes wz{0%{transform:scale(.2) rotate(0);opacity:0}25%{opacity:1}100%{transform:scale(3.4) rotate(12deg);opacity:1}}
  .flash{position:absolute;inset:0;background:radial-gradient(circle,#fff,rgba(0,240,255,.6) 30%,transparent 70%);opacity:0;animation:wf 1.1s forwards}
  @keyframes wf{0%,80%{opacity:0}92%{opacity:1}100%{opacity:1;background:#020309}}
  .ld{position:absolute;inset:0;display:grid;place-items:center;color:var(--cy);letter-spacing:.3em;font-size:12px}.err{color:var(--rd)}
  .rtb{border-color:rgba(252,238,10,.45)!important;color:var(--ye)!important}.rtb.on{background:rgba(252,238,10,.15)!important}

  /* ——— yeni düzen: ray + çekmece + komut çubuğu + sağ sütun ——— */
  .rail{position:absolute;left:12px;top:58px;bottom:16px;z-index:9;width:44px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 0;
    background:linear-gradient(180deg,rgba(6,10,18,.78),rgba(6,10,18,.55));border:1px solid rgba(0,240,255,.16);backdrop-filter:blur(8px);animation:rl .5s .2s both}
  @keyframes rl{from{opacity:0;transform:translateX(-14px)}}
  .ri{position:relative;width:34px;height:34px;display:grid;place-items:center;background:none;border:1px solid transparent;color:rgba(170,215,235,.62);cursor:pointer;transition:color .15s,background .15s,border-color .15s}
  .ri svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
  .ri:hover{color:#fff;background:rgba(0,240,255,.07)}
  .ri.on{color:var(--cy);border-color:rgba(0,240,255,.45);background:rgba(0,240,255,.1);box-shadow:inset 0 0 12px rgba(0,240,255,.12)}
  .ri.y{color:rgba(252,238,10,.7)}.ri.y.on,.ri.y:hover{color:var(--ye)}.ri.y.on{border-color:rgba(252,238,10,.45);background:rgba(252,238,10,.08)}
  .ri.o{color:rgba(255,155,47,.75)}.ri.o.on{color:#ff9b2f;border-color:rgba(255,155,47,.5);background:rgba(255,155,47,.1)}
  .ri em{position:absolute;right:-5px;top:-4px;min-width:15px;height:14px;padding:0 3px;display:grid;place-items:center;font-style:normal;font-size:8.5px;letter-spacing:0;background:#0b1420;border:1px solid rgba(0,240,255,.5);color:var(--cy)}
  .ri em.hot{border-color:rgba(255,42,85,.7);color:#ff6a85}
  .ri .rt{position:absolute;left:calc(100% + 12px);top:50%;transform:translate(-6px,-50%);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s,transform .15s;
    font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#dff6ff;background:rgba(5,8,14,.95);border:1px solid rgba(0,240,255,.35);padding:5px 9px}
  .ri:hover .rt{opacity:1;transform:translate(0,-50%)}
  .rcol.off{visibility:hidden}
  .rail .sep{width:20px;height:1px;background:rgba(255,255,255,.1);margin:4px 0}
  .rail .fill{flex:1}
  .drawer{position:absolute;left:64px;top:58px;bottom:16px;z-index:8;width:286px;display:flex;flex-direction:column;gap:8px;padding:10px 12px 12px;
    background:rgba(5,8,14,.86);border:1px solid rgba(0,240,255,.2);backdrop-filter:blur(8px);overflow:hidden;
    clip-path:polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)}
  .dh{display:flex;align-items:center;gap:8px;padding-bottom:6px;border-bottom:1px solid rgba(0,240,255,.15)}
  .dh span{font-size:10.5px;letter-spacing:.28em;color:var(--cy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .dh .x{margin-left:auto;background:none;border:0;color:var(--mut);cursor:pointer}.dh .x:hover{color:#fff}
  .drawer .lst{flex:1 1 auto}
  .drawer .h{display:flex;align-items:center;margin-top:8px}
  .row2{margin-left:auto;display:flex;gap:4px}.mini{background:none;border:1px solid var(--line);color:var(--mut);font-size:8.5px;letter-spacing:.15em;padding:2px 6px;cursor:pointer}.mini:hover{color:var(--cy);border-color:var(--cy)}
  .tg2{margin-left:auto;display:flex;align-items:center;gap:6px}.tg2 .mkg{margin-left:0}
  .ntg{color:var(--cy);font-size:10.5px;text-shadow:0 0 6px rgba(0,240,255,.6)}
  .cbar{position:absolute;left:50%;top:54px;transform:translateX(-50%);z-index:7;display:flex;align-items:center;gap:6px;height:34px;
    width:max-content;max-width:min(640px,calc(100% - 64vw - 60px));min-width:min(440px,calc(100% - 64vw - 60px));
    background:rgba(5,8,14,.72);border:1px solid rgba(0,240,255,.18);backdrop-filter:blur(8px);padding:0 4px 0 10px;animation:cb .5s .25s both}
  @keyframes cb{from{opacity:0;transform:translate(-50%,-8px)}}
  .crumb{display:flex;align-items:center;gap:4px;min-width:0;flex:0 1 auto;overflow:hidden}
  .crumb button{background:none;border:0;color:rgba(170,215,235,.6);font-size:10px;letter-spacing:.22em;padding:4px 4px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
  .crumb button:hover{color:#fff}.crumb button.cur{color:var(--fc,var(--cy));text-shadow:0 0 8px color-mix(in srgb,var(--fc,var(--cy)) 55%,transparent);cursor:default}
  .crumb span{color:rgba(255,255,255,.25);font-size:11px}
  .srch{margin-left:auto;flex:1 1 180px;min-width:150px;display:flex;align-items:center;gap:8px;height:26px;background:rgba(0,240,255,.04);border:1px solid rgba(0,240,255,.15);
    color:rgba(170,200,220,.55);font:400 12.5px var(--f-ui);padding:0 6px 0 8px;cursor:text;transition:border-color .15s,background .15s}
  .srch:hover{border-color:rgba(0,240,255,.45);background:rgba(0,240,255,.08);color:#cfe6f2}
  .srch span{color:var(--cy)}.srch kbd{margin-left:auto;font-size:8.5px;letter-spacing:.14em;color:var(--mut);border:1px solid rgba(255,255,255,.14);padding:1px 4px}
  .rcol{position:absolute;right:16px;top:58px;bottom:16px;width:min(400px,32vw);z-index:8;display:flex;flex-direction:column;gap:8px;pointer-events:none}
  .rcol > :global(*){pointer-events:auto}
  .alerts{flex:none;max-height:38vh}
  .alerts.min:not(.open) article{display:none}
  .card{position:relative!important;right:auto!important;bottom:auto!important;top:auto!important;width:auto!important;max-height:none!important;flex:0 1 auto;min-height:0;
    clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
  .card .ibody{flex:1 1 auto;min-height:0;overflow:auto;padding-right:4px;display:flex;flex-direction:column;gap:8px}
  .card .act{position:sticky;bottom:0;background:linear-gradient(transparent,rgba(5,8,14,.96) 30%);padding-bottom:2px}
  .card .act{display:flex;flex-wrap:wrap;gap:6px}.card .act .btn{flex:1 1 28%;width:auto;padding-left:6px;padding-right:6px;white-space:nowrap}.card .act .btn.go{flex-basis:100%}
  .ri:focus,.ncard:focus,.alr:focus{outline:none}.ri:focus-visible,.ncard:focus-visible,.alr:focus-visible{outline:1px solid var(--cy);outline-offset:1px}
  .nfil{display:grid;grid-template-columns:repeat(4,1fr);gap:3px}
  .nfil button{background:none;border:1px solid var(--line);color:var(--mut);font-size:9px;letter-spacing:.14em;padding:5px 0;cursor:pointer;display:flex;justify-content:center;gap:5px}
  .nfil button em{font-style:normal;color:rgba(255,255,255,.35)}.nfil button.on{border-color:var(--cy);color:var(--cy);background:rgba(0,240,255,.07)}.nfil button.on em{color:var(--cy)}
  .ovw.add{border-color:rgba(0,240,255,.4);background:rgba(0,240,255,.06);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nl{flex:1 1 auto;min-height:60px;overflow:auto;display:flex;flex-direction:column;gap:5px;padding-right:2px}
  .nl.in{max-height:220px;flex:none;min-height:0}
  .ncard{position:relative;display:flex;gap:9px;align-items:flex-start;text-align:left;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-left:2px solid var(--nc);padding:7px 9px;color:var(--tx);cursor:pointer;transition:background .15s,border-color .15s}
  .ncard:hover{background:color-mix(in srgb,var(--nc) 8%,transparent);border-color:color-mix(in srgb,var(--nc) 35%,transparent)}
  .ncard i{font-style:normal;color:var(--nc);text-shadow:0 0 8px var(--nc);font-size:14px;line-height:1.2;width:14px;text-align:center;flex:none}
  .ncard>div{min-width:0;flex:1;padding-right:44px}.ncard b{display:block;font-weight:500;font-size:13px;color:#eef8ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ncard small{display:block;font-size:9.5px;letter-spacing:.1em;color:var(--mut);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .au{color:hsl(var(--ah,190) 85% 70%)}
  .ncard p{font-size:12px;color:#aebdca;line-height:1.4;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .ncard .vb{position:absolute;right:7px;top:7px;font-size:8.5px;letter-spacing:.14em;color:rgba(0,240,255,.55)}
  .ncard.priv{border-style:dashed;border-left-style:solid;background:rgba(176,107,255,.04)}.ncard.priv .vb{color:#c99bff}
  .nnone{font-size:9.5px;letter-spacing:.2em;color:var(--mut);padding:4px 0}.nnone button{background:none;border:0;color:var(--cy);font:inherit;letter-spacing:inherit;cursor:pointer;padding:0}
  .none small{display:block;margin-top:8px;font-family:var(--f-ui);letter-spacing:.02em;font-size:12px;color:#8fa2b2;line-height:1.4}.none small b{color:var(--cy);font-weight:500}
  .al{flex:1;overflow:auto;display:flex;flex-direction:column;gap:4px}
  .alr{display:flex;flex-direction:column;gap:2px;text-align:left;background:rgba(255,255,255,.02);border:0;border-left:3px solid var(--sv);padding:6px 9px;color:#eaf4fb;cursor:pointer}
  .alr:hover{background:color-mix(in srgb,var(--sv) 10%,transparent)}.alr b{font-size:9px;letter-spacing:.2em;color:var(--sv);font-weight:500}.alr span{font-size:13px}.alr small{font-size:9.5px;letter-spacing:.1em;color:var(--mut)}
  .drawer .lg{margin-top:0}.drawer .lg>div{flex-direction:column;align-items:flex-start;gap:5px;border-bottom:1px solid rgba(255,255,255,.05);padding-bottom:8px}
  .drawer .lg span{width:auto;margin-bottom:2px}.drawer .lg em{font-size:12px;color:#c9d6e2}
  .lgs{width:12px;text-align:center;font-size:11px}
  .keys{display:grid;grid-template-columns:1fr;gap:3px 0;margin:0}.keys dt{font-size:9.5px;letter-spacing:.18em;color:var(--cy);margin-top:8px}.keys dd{margin:0;font-size:12.5px;color:#c4d2de}
  .place{display:flex;align-items:center;gap:10px}.place button{background:none;border:1px solid rgba(252,238,10,.4);color:var(--ye);font:inherit;font-size:9.5px;letter-spacing:.15em;padding:2px 7px;cursor:pointer}
  .sm.placing .gl{cursor:crosshair}
  .toast{position:absolute;left:50%;bottom:58px;transform:translateX(-50%);z-index:14;background:rgba(5,8,14,.94);border:1px solid rgba(57,255,138,.5);color:#39ff8a;padding:7px 14px;font-size:10.5px;letter-spacing:.16em;box-shadow:0 0 18px rgba(57,255,138,.15)}
  .hint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:5;display:flex;gap:18px;font-size:9px;letter-spacing:.18em;color:rgba(170,200,220,.45);pointer-events:none;white-space:nowrap}
  .hint kbd{font-size:8.5px;color:rgba(200,230,245,.6);border:1px solid rgba(255,255,255,.14);padding:0 4px;margin:0 2px}
  .pinf header{display:flex;align-items:center;gap:8px}.pinf header .t{font-size:11px;letter-spacing:.28em;color:#ff9b2f}
  .pinf .sw{margin-left:auto;background:none;border:1px solid rgba(0,240,255,.45);color:var(--cy);font-size:9.5px;letter-spacing:.16em;padding:3px 8px;cursor:pointer}
  .pinf .x{margin-left:auto;background:none;border:0;color:var(--mut);cursor:pointer}.pinf .sw + .x{margin-left:6px}
  .pinf .loc{font-size:10px;letter-spacing:.14em;color:var(--mut)}.pinf .pl{display:flex;flex-wrap:wrap;gap:4px 14px}
  .pinf{border-color:rgba(255,155,47,.6);clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
  .insp{clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}
  .insp p{font-size:13.5px;line-height:1.5;color:#d2dfea;white-space:pre-wrap}.insp .cat{font-size:10px;color:var(--mut);letter-spacing:.15em;margin-top:6px}
  .insp.note{border-color:color-mix(in srgb,var(--nc) 65%,transparent);box-shadow:0 0 30px color-mix(in srgb,var(--nc) 12%,transparent);width:min(400px,90vw)}
  .insp.note.priv{border-style:dashed}
  .insp .ih{display:flex;gap:10px;align-items:flex-start}.insp .ih>i{font-style:normal;font-size:22px;color:var(--nc);text-shadow:0 0 10px var(--nc);line-height:1.1}
  .insp .ih>div{flex:1;min-width:0}.insp .ih .k{color:var(--nc);opacity:.85}
  .insp .vb{font-size:8.5px;letter-spacing:.16em;color:var(--cy);border:1px solid rgba(0,240,255,.35);padding:2px 6px;white-space:nowrap}.insp.priv .vb{color:#c99bff;border-color:rgba(176,107,255,.5)}
  .insp .by{font-size:9.5px;letter-spacing:.14em;color:var(--mut);margin-top:8px}
  .insp .act{display:flex;justify-content:flex-end}.insp .act .btn{width:auto}
  .ov :global(.sm-lbl .mk .nt){color:var(--nc,#00f0ff);text-shadow:0 0 10px var(--nc,#00f0ff);font-size:13px}
  .ov :global(.pin-lbl.note i){color:var(--nc,#00f0ff)}.ov :global(.pin-lbl.note b){color:#eaffff}
  .ov :global(.pin-lbl.priv b){opacity:.8;font-style:italic}
</style>
