<script lang="ts">
  // God's Eye — DM görünümü: sonsuz tuval, sahneler (OBS benzeri), katmanlar, fırça, metin, depo, oyuncu ataması.
  import { onMount, untrack } from 'svelte';
  import { session } from '../../lib/session.svelte';
  import { watchScenes, saveScene, deleteScene, watchInks, saveInk, deleteInk, watchTokens, moveToken, deleteToken, watchPings, sendPing, watchAsg, setAsg, watchDepot, players, nid, now, STAGE,
    type Scene, type Layer, type Ink, type Token, type Ping, type DepItem } from '../../lib/gods';
  import { drawScene, drawTokens, drawPings, hitLayer, hitToken, setImgListener, fontOf, wrap as wrapText, PING_MS } from './render';
  import { dep } from './store.svelte';
  import { ask } from '../../lib/confirm.svelte';
  import { sfx } from '../../lib/sfx';
  import { wm } from '../../desktop/wm.svelte';
  import Panel from './Panel.svelte';
  import Depot from './Depot.svelte';
  import Chat from './Chat.svelte';
  import FloatWin from './FloatWin.svelte';
  import Dice from '../Dice.svelte';
  import { RulerCtl, postRoll } from './tools';
  import { watchRulers, type Ruler } from '../../lib/gods';
  import { drawRulers, RUL_STALE } from './render';
  const DMPanel = import('../DMPanel.svelte');
  const me = session.user!;
  type Tool = 'sel' | 'pan' | 'brush' | 'text' | 'ping' | 'ruler';
  let scenes = $state<Scene[]>([]), sid = $state(localStorage.getItem('qv.ge.sid') ?? ''), sc = $state<Scene | null>(null);
  let inks: Record<string, Ink> = $state({}), toks = $state<Token[]>([]), pings: Ping[] = [], asg = $state<Record<string, string>>({}), pls = $state<{ uid: string; name: string; user: string }[]>([]);
  let tool = $state<Tool>('sel'), sel = $state(''), brush = $state({ c: '#ff2a55', w: 6 }), view = $state({ x: 0, y: 0, z: 0.5 }), space = false;
  let cv: HTMLCanvasElement, box: HTMLDivElement, depot: Depot, dirty = true, busy = false, live: { lid: string; pts: number[] } | null = null;
  let renS = $state(''), renV = $state(''), renL = $state(''), renLV = $state(''), msg = $state('');
  const cur = $derived(sc?.layers.find((l) => l.id === sel) ?? null);
  const mark = () => (dirty = true);
  let rulers: Ruler[] = [], measuring = false, dice = $state(false), dmp = $state(false);
  const rul = new RulerCtl({ uid: me.uid, name: 'DM', col: '#ffffff', sid: () => sid, scene: () => sc, mark });
  setImgListener(mark);
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  // ---------- geri al / yinele ----------
  type Snap = { layers: Layer[]; inks: Record<string, Ink> };
  let undo: Snap[] = [], redo: Snap[] = [];
  const snap = (): Snap => ({ layers: clone($state.snapshot(sc!.layers) as Layer[]), inks: clone($state.snapshot(inks) as Record<string, Ink>) });
  function push() { if (!sc) return; undo.push(snap()); if (undo.length > 80) undo.shift(); redo = []; }
  async function restore(s: Snap) {
    if (!sc) return; const old = inks; sc.layers = s.layers; inks = s.inks; mark();
    for (const k of new Set([...Object.keys(old), ...Object.keys(s.inks)])) { if (!s.inks[k]) deleteInk(k); else if (JSON.stringify(old[k]) !== JSON.stringify(s.inks[k])) saveInk(k, s.inks[k]); }
    persist(true); if (sel && !sc.layers.some((l) => l.id === sel)) sel = '';
  }
  const doUndo = () => { const s = undo.pop(); if (s && sc) { redo.push(snap()); restore(s); sfx.click(); } };
  const doRedo = () => { const s = redo.pop(); if (s && sc) { undo.push(snap()); restore(s); sfx.click(); } };
  // ---------- kaydetme (sürüklerken ~5 Hz, bırakınca hemen) ----------
  let pT: ReturnType<typeof setTimeout> | undefined, pLast = 0;
  function persist(final = false) {
    if (!sc) return; clearTimeout(pT);
    const go = () => { pLast = now(); const s = $state.snapshot(sc!) as Scene; saveScene(s).catch((e) => flash('Kaydedilemedi: ' + (e?.code ?? e))); };
    if (final || now() - pLast > 200) go(); else pT = setTimeout(go, 200);
  }
  const flash = (s: string) => { msg = s; setTimeout(() => msg === s && (msg = ''), 3200); };
  // ---------- canlı veriler ----------
  onMount(() => {
    const a = watchScenes((l) => { scenes = l; if (!l.some((s) => s.id === sid)) sid = l[0]?.id ?? ''; });
    const b = watchAsg((m) => (asg = m)); const c = watchDepot((l) => (dep.items = l));
    players().then((l) => (pls = l)).catch(() => {});
    return () => { a(); b(); c(); };
  });
  $effect(() => { const s = scenes.find((x) => x.id === sid); untrack(() => { if (!s) { sc = null; return; } if (!sc || sc.id !== s.id) { sc = clone(s); undo = []; redo = []; sel = ''; fitView(); } else if (!busy && now() - pLast > 1500) { sc = clone(s); } mark(); }); });
  $effect(() => {
    if (!sid) return; localStorage.setItem('qv.ge.sid', sid); inks = {}; toks = []; pings = [];
    const a = watchInks(sid, (m) => { if (!busy) inks = m; mark(); });
    const b = watchTokens(sid, (l) => { if (!tokDrag) toks = l; mark(); });
    const c = watchPings(sid, (l) => { if (l.some((p) => now() - p.at < 1500 && !pings.some((q) => q.uid === p.uid && q.at === p.at))) sfx.ping(); pings = l; mark(); });
    const e = watchRulers(sid, (l) => { rulers = l; mark(); });
    return () => { a(); b(); c(); e(); rul.dispose(); };
  });
  // ---------- görünüm ----------
  function fitView() { if (!box || !sc) return; const W = box.clientWidth, H = box.clientHeight, z = Math.min((W - 160) / sc.w, (H - 160) / sc.h); view = { z, x: (W - sc.w * z) / 2, y: (H - sc.h * z) / 2 + 10 }; mark(); }
  const toS = (e: { clientX: number; clientY: number }) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / view.z, y: (e.clientY - r.top - view.y) / view.z }; };
  onMount(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop); if (wm.coreMin || !cv) return;
      const t = now(), lp = pings.some((p) => t - p.at < PING_MS); if (!dirty && !lp) return; dirty = false;
      const W = box.clientWidth, H = box.clientHeight, d = devicePixelRatio || 1;
      if (cv.width !== Math.round(W * d) || cv.height !== Math.round(H * d)) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
      const g = cv.getContext('2d')!; g.setTransform(d, 0, 0, d, 0, 0); g.fillStyle = '#07090e'; g.fillRect(0, 0, W, H);
      // ızgara (yalnız DM)
      const step = 100 * view.z; if (step > 12) { g.strokeStyle = 'rgba(0,240,255,.05)'; g.lineWidth = 1; g.beginPath(); for (let x = view.x % step; x < W; x += step) { g.moveTo(x, 0); g.lineTo(x, H); } for (let y = view.y % step; y < H; y += step) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke(); }
      if (!sc) return;
      g.setTransform(d * view.z, 0, 0, d * view.z, d * view.x, d * view.y);
      g.fillStyle = '#000'; g.fillRect(0, 0, sc.w, sc.h);
      const extra = live ? ({ id: '_', k: 'draw', name: '', ...boxOf(live.lid) } as Layer) : undefined;
      drawScene(g, sc, inks);
      if (live && extra) { const l = sc.layers.find((x) => x.id === live!.lid); if (l) { g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = brush.c; g.lineWidth = brush.w; g.beginPath(); const p = live.pts; g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); if (p.length === 2) g.lineTo(p[0] + .01, p[1]); g.stroke(); g.restore(); } }
      drawTokens(g, toks, tokDrag?.uid); drawPings(g, pings, t, view.z);
      drawRulers(g, [...rulers.filter((r) => r.uid !== me.uid && t - r.at < RUL_STALE), ...(rul.mine ? [rul.mine] : [])], view.z);
      // sahne dışı perde + sınır (yalnız DM)
      g.setTransform(d, 0, 0, d, 0, 0); const sx = view.x, sy = view.y, sw = sc.w * view.z, sh = sc.h * view.z;
      g.fillStyle = 'rgba(4,6,10,.55)'; g.beginPath(); g.rect(0, 0, W, H); g.rect(sx, sy, sw, sh); g.fill('evenodd');
      g.strokeStyle = 'rgba(0,240,255,.85)'; g.lineWidth = 1.5; g.strokeRect(sx - .75, sy - .75, sw + 1.5, sh + 1.5);
      g.fillStyle = 'rgba(0,240,255,.9)'; g.font = '11px "Share Tech Mono", monospace'; g.fillText(`${sc.name.toLocaleUpperCase('tr')} · ${sc.w}×${sc.h} · OYUNCU GÖRÜNÜMÜ`, sx, sy - 8);
    };
    raf = requestAnimationFrame(loop); const ro = new ResizeObserver(mark); ro.observe(box);
    const kd = (e: KeyboardEvent) => {
      if (wm.coreMin || wm.core !== 'gods') return; const tg = e.target as HTMLElement; if (tg.closest('input,textarea,select,[contenteditable]')) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); doRedo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (cur) { e.preventDefault(); delLayer(cur.id); } }
      else if (e.key === ' ') { space = true; e.preventDefault(); }
      else if (!e.ctrlKey && !e.metaKey && !e.altKey) { const m: Record<string, Tool> = { v: 'sel', h: 'pan', b: 'brush', t: 'text', p: 'ping', r: 'ruler' }; if (m[k]) tool = m[k]; else if (k === 'f') fitView(); else if (e.key === 'Escape') sel = ''; }
    };
    const ku = (e: KeyboardEvent) => { if (e.key === ' ') space = false; };
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); };
  });
  const boxOf = (lid: string) => { const l = sc!.layers.find((x) => x.id === lid)!; return { x: l.x, y: l.y, w: l.w, h: l.h }; };
  // ---------- tuval etkileşimi ----------
  type Drag = { kind: 'pan' | 'move' | 'res'; sx: number; sy: number; ox: number; oy: number; l?: Layer; h?: string; o?: { x: number; y: number; w: number; h: number } };
  let dr: Drag | null = null, tokDrag: { uid: string; dx: number; dy: number } | null = null, tokLast = 0;
  function down(e: PointerEvent) {
    if (!sc && e.button === 0 && tool !== 'pan') return;
    cv.setPointerCapture(e.pointerId); const p = sc ? toS(e) : { x: 0, y: 0 };
    if (e.button === 1 || e.button === 2 || tool === 'pan' || space) { dr = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }; return; }
    if (!sc) return;
    if (tool === 'ruler') { measuring = true; rul.start(p, e); return; }
    if (tool === 'ping') { const pg: Ping = { sid, uid: me.uid, name: 'DM', col: '#ffffff', x: Math.round(p.x), y: Math.round(p.y), at: now() }; pings = [...pings.filter((x) => x.uid !== me.uid), pg]; mark(); sfx.ping(); sendPing(pg).catch(() => {}); return; }
    if (tool === 'text') { push(); const l: Layer = { id: nid(), k: 'text', name: 'Metin', x: Math.round(p.x), y: Math.round(p.y), w: 600, h: 120, t: 'Yeni metin', fs: 56, col: '#ffffff', al: 'left' }; sc.layers.push(l); sel = l.id; tool = 'sel'; fitText(l); persist(true); mark(); return; }
    if (tool === 'brush') {
      let l = cur && cur.k === 'draw' ? cur : null;
      if (!l) { push(); l = { id: nid(), k: 'draw', name: 'Çizim ' + (sc.layers.filter((x) => x.k === 'draw').length + 1), x: 0, y: 0, w: sc.w, h: sc.h }; sc.layers.push(l); sel = l.id; persist(true); } else push();
      busy = true; live = { lid: l.id, pts: [p.x, p.y] }; mark(); return;
    }
    const t = hitToken(toks, p.x, p.y); if (t) { tokDrag = { uid: t.uid, dx: t.x - p.x, dy: t.y - p.y }; mark(); return; }
    const l = hitLayer(sc, p.x, p.y);
    if (!l) { sel = ''; dr = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y }; return; }
    sel = l.id; push(); busy = true; dr = { kind: 'move', sx: p.x, sy: p.y, ox: l.x, oy: l.y, l }; mark();
  }
  function hdown(e: PointerEvent, h: string) {
    if (!cur) return; e.stopPropagation(); cv.setPointerCapture(e.pointerId); push(); busy = true; const p = toS(e);
    dr = { kind: 'res', sx: p.x, sy: p.y, ox: 0, oy: 0, l: cur, h, o: { x: cur.x, y: cur.y, w: cur.w, h: cur.h } };
  }
  function move(e: PointerEvent) {
    if (measuring) { rul.move(toS(e), e); return; }
    if (live) { const p = toS(e); const q = live.pts; const lx = q[q.length - 2], ly = q[q.length - 1]; if (Math.hypot(p.x - lx, p.y - ly) * view.z > 2) { q.push(p.x, p.y); mark(); } return; }
    if (tokDrag) { const p = toS(e), t = toks.find((x) => x.uid === tokDrag!.uid); if (t && sc) { t.x = Math.round(Math.max(0, Math.min(sc.w, p.x + tokDrag.dx))); t.y = Math.round(Math.max(0, Math.min(sc.h, p.y + tokDrag.dy))); mark(); if (now() - tokLast > 130) { tokLast = now(); moveToken(t, t.x, t.y).catch(() => {}); } } return; }
    if (!dr) return;
    if (dr.kind === 'pan') { view.x = dr.ox + e.clientX - dr.sx; view.y = dr.oy + e.clientY - dr.sy; mark(); return; }
    const p = toS(e), l = sc!.layers.find((x) => x.id === dr!.l!.id); if (!l) return;
    if (dr.kind === 'move') { l.x = Math.round(dr.ox + p.x - dr.sx); l.y = Math.round(dr.oy + p.y - dr.sy); }
    else { const o = dr.o!, h = dr.h!, dx = p.x - dr.sx, dy = p.y - dr.sy; let { x, y, w, h: hh } = o;
      if (h.includes('e')) w = o.w + dx; if (h.includes('w')) { w = o.w - dx; x = o.x + dx; } if (h.includes('s')) hh = o.h + dy; if (h.includes('n')) { hh = o.h - dy; y = o.y + dy; }
      const lock = (l.lock ?? l.k === 'img') !== e.shiftKey;
      if (lock && o.w > 0 && o.h > 0) { const r = o.w / o.h; if (h.length === 2) { if (Math.abs(w / o.w) > Math.abs(hh / o.h)) hh = w / r; else w = hh * r; } else if (h === 'e' || h === 'w') hh = w / r; else w = hh * r;
        if (h.includes('w')) x = o.x + o.w - w; if (h.includes('n')) y = o.y + o.h - hh; if (h === 'e' || h === 'w') y = o.y + (o.h - hh) / 2; if (h === 'n' || h === 's') x = o.x + (o.w - w) / 2; }
      if (w < 8 || hh < 8) return; l.x = Math.round(x); l.y = Math.round(y); l.w = Math.round(w); l.h = Math.round(hh); }
    mark(); persist();
  }
  function up() {
    if (measuring) { measuring = false; rul.end(); return; }
    if (live && sc) { const l = sc.layers.find((x) => x.id === live!.lid); if (l) { const p = live.pts, n: number[] = []; for (let i = 0; i < p.length; i += 2) n.push(Math.round(((p[i] - l.x) / l.w) * 1e4), Math.round(((p[i + 1] - l.y) / l.h) * 1e4));
        const ink: Ink = { sid, s: [...(inks[l.id]?.s ?? []), { c: brush.c, w: brush.w / l.w, p: n }] }; inks[l.id] = ink; saveInk(l.id, $state.snapshot(ink) as Ink).catch((e) => flash('Çizim kaydedilemedi: ' + (e?.code ?? e))); }
      live = null; busy = false; mark(); return; }
    if (tokDrag) { const t = toks.find((x) => x.uid === tokDrag!.uid); if (t) moveToken(t, t.x, t.y).catch(() => {}); tokDrag = null; mark(); return; }
    if (dr && dr.kind !== 'pan') { persist(true); if (dr.l && dr.l.k === 'text') fitText(sc!.layers.find((x) => x.id === dr!.l!.id)!); }
    dr = null; setTimeout(() => (busy = false), 50);
  }
  function wheel(e: WheelEvent) { e.preventDefault(); const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, z = Math.max(0.05, Math.min(8, view.z * Math.exp(-e.deltaY * 0.0015)));
    view = { z, x: mx - ((mx - view.x) / view.z) * z, y: my - ((my - view.y) / view.z) * z }; mark(); }
  // ---------- katman işlemleri ----------
  let mctx: CanvasRenderingContext2D | null = null;
  function fitText(l: Layer) { mctx ??= document.createElement('canvas').getContext('2d'); mctx!.font = fontOf(l); l.h = Math.max(20, Math.ceil(wrapText(mctx!, l.t ?? '', l.w).length * (l.fs ?? 48) * 1.18)); }
  function edit(f: (l: Layer) => void, final = true) { if (!cur || !sc) return; push(); const l = sc.layers.find((x) => x.id === cur!.id)!; f(l); if (l.k === 'text') fitText(l); mark(); persist(final); }
  let typing = false;
  function editText(f: (l: Layer) => void) { if (!cur || !sc) return; if (!typing) { push(); typing = true; } const l = sc.layers.find((x) => x.id === cur!.id)!; f(l); if (l.k === 'text') fitText(l); mark(); persist(); }
  async function delLayer(id: string) { if (!sc) return; push(); const l = sc.layers.find((x) => x.id === id); sc.layers = sc.layers.filter((x) => x.id !== id); if (l?.k === 'draw') { delete inks[id]; deleteInk(id); } if (sel === id) sel = ''; mark(); persist(true); sfx.click(); }
  function z(id: string, d: number) { if (!sc) return; const i = sc.layers.findIndex((l) => l.id === id), j = Math.max(0, Math.min(sc.layers.length - 1, i + d)); if (i < 0 || i === j) return; push(); const [l] = sc.layers.splice(i, 1); sc.layers.splice(j, 0, l); mark(); persist(true); }
  function reorder(id: string, toIdx: number) { if (!sc) return; const i = sc.layers.findIndex((l) => l.id === id); if (i < 0) return; push(); const [l] = sc.layers.splice(i, 1); sc.layers.splice(Math.max(0, Math.min(sc.layers.length, toIdx)), 0, l); mark(); persist(true); }
  function fill() { edit((l) => { const S = sc!; if ((l.lock ?? l.k === 'img') && l.w && l.h) { const r = Math.max(S.w / l.w, S.h / l.h); l.w = Math.round(l.w * r); l.h = Math.round(l.h * r); l.x = Math.round((S.w - l.w) / 2); l.y = Math.round((S.h - l.h) / 2); } else { l.x = 0; l.y = 0; l.w = S.w; l.h = S.h; } }); }
  function newLayer() { if (!sc) return; push(); const l: Layer = { id: nid(), k: 'draw', name: 'Katman ' + (sc.layers.length + 1), x: 0, y: 0, w: sc.w, h: sc.h }; sc.layers.push(l); sel = l.id; mark(); persist(true); }
  // ---------- depodan / bilgisayardan sahneye bırak ----------
  function placeDep(it: DepItem, p: { x: number; y: number }) {
    if (!sc) return; push();
    if (it.kind === 'image' && it.img) { const r = Math.min(1, (sc.w * 0.6) / it.img.w, (sc.h * 0.6) / it.img.h), w = Math.round(it.img.w * r), h = Math.round(it.img.h * r);
      const l: Layer = { id: nid(), k: 'img', name: it.name, x: Math.round(p.x - w / 2), y: Math.round(p.y - h / 2), w, h, img: { ...it.img }, lock: true }; sc.layers.push(l); sel = l.id; }
    else if (it.kind === 'note') { const l: Layer = { id: nid(), k: 'text', name: it.name, x: Math.round(p.x), y: Math.round(p.y), w: 700, h: 100, t: it.body || it.name, fs: 40, col: '#ffffff', al: 'left' }; fitText(l); sc.layers.push(l); sel = l.id; }
    else { undo.pop(); return; }
    tool = 'sel'; mark(); persist(true); sfx.granted();
  }
  async function drop(e: DragEvent) {
    e.preventDefault(); if (!sc) return flash('Önce bir sahne oluştur.'); const p = toS(e);
    const id = e.dataTransfer?.getData('text/ge-dep'); if (id) { const it = dep.items.find((i) => i.id === id); if (it) placeDep(it, p); return; }
    const fs = [...(e.dataTransfer?.files ?? [])]; if (fs.length) { const out = await depot.upload(fs); out.forEach((it, i) => placeDep(it, { x: p.x + i * 40, y: p.y + i * 40 })); }
  }
  // ---------- sahneler ----------
  let mkBusy = 0;
  async function newScene() { if (Date.now() - mkBusy < 1200) return; mkBusy = Date.now(); const n = Math.max(0, ...scenes.map((x) => +(/^Sahne (\d+)$/.exec(x.name)?.[1] ?? 0))) + 1; const s: Scene = { id: nid(), name: 'Sahne ' + n, w: STAGE.w, h: STAGE.h, order: (scenes.at(-1)?.order ?? 0) + 1, layers: [], imgs: [], at: now() }; scenes = [...scenes, s]; sid = s.id; await saveScene(s); sfx.granted(); }
  async function renameScene(s: Scene) { const v = renV.trim().slice(0, 60); renS = ''; if (!v || v === s.name) return; if (sc && sc.id === s.id) { sc.name = v; persist(true); } else await saveScene({ ...clone($state.snapshot(s) as Scene), name: v }); }
  async function delScene(s: Scene) {
    const who = pls.filter((p) => asg[p.uid] === s.id);
    if (!(await ask('Sahne silinsin mi?', `“${s.name}” ve içindeki katmanlar, çizimler, jetonlar silinecek.${who.length ? ` Bağlı oyuncular (${who.map((w) => w.name).join(', ')}) BAĞLANTI YOK ekranına düşer.` : ''}`, 'Sil'))) return;
    for (const w of who) await setAsg(w.uid, null); await deleteScene(s.id); sfx.click();
  }
  const assign = (uid: string, v: string) => { setAsg(uid, v || null).then(() => { sfx.granted(); flash(v ? `${pls.find((p) => p.uid === uid)?.name} → ${scenes.find((s) => s.id === v)?.name}` : 'Bağlantı kesildi'); }); };
  // seçim kutusu (ekran koordinatı)
  const selBox = $derived(cur && !cur.hid ? { l: view.x + cur.x * view.z, t: view.y + cur.y * view.z, w: cur.w * view.z, h: cur.h * view.z } : null);
  function setOpt(k: 'upx' | 'unit' | 'grid', v: number | string) { if (!sc) return; const o = sc as unknown as Record<string, unknown>; if (v) o[k] = v; else delete o[k]; persist(true); mark(); }
  let ldrag = '';
  const KIND = { img: 'Görsel', text: 'Metin', draw: 'Çizim' } as const;
  const COLORS = ['#ffffff', '#000000', '#ff2a55', '#fcee0a', '#00f0ff', '#39ff8a', '#ff8a00', '#b46cff'];
</script>
<div class="dm" bind:this={box} class:pan={tool === 'pan'}>
  <canvas bind:this={cv} class={tool} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onwheel={wheel} oncontextmenu={(e) => e.preventDefault()} ondragover={(e) => e.preventDefault()} ondrop={drop}></canvas>
  {#if selBox && tool === 'sel'}
    <div class="sb" style:left="{selBox.l}px" style:top="{selBox.t}px" style:width="{selBox.w}px" style:height="{selBox.h}px">
      {#each ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as h (h)}<i class="h {h}" onpointerdown={(e) => hdown(e, h)} onpointermove={move} onpointerup={up} role="presentation"></i>{/each}
    </div>
  {/if}
  {#if !scenes.length}<div class="empty"><p>Henüz sahne yok.</p><button class="btn" onclick={newScene}>+ İlk sahneyi oluştur</button></div>{/if}

  <Panel side="top" label="SAHNELER" id="scn" w={860}>
    <div class="sc">
      <div class="sl">
        {#each scenes as s (s.id)}
          <div class="si" class:on={s.id === sid} role="button" tabindex="0" onclick={() => (sid = s.id)} onkeydown={(e) => e.key === 'Enter' && (sid = s.id)}>
            {#if renS === s.id}<!-- svelte-ignore a11y_autofocus --><input autofocus bind:value={renV} onblur={() => renameScene(s)} onkeydown={(e) => { if (e.key === 'Enter') renameScene(s); if (e.key === 'Escape') renS = ''; }} onclick={(e) => e.stopPropagation()} />
            {:else}<b ondblclick={() => { renS = s.id; renV = s.name; }}>{s.name}</b>{/if}
            <small>{pls.filter((p) => asg[p.uid] === s.id).length} oyuncu</small>
            <span class="ops"><button onclick={(e) => { e.stopPropagation(); renS = s.id; renV = s.name; }} title="Yeniden adlandır">✎</button><button onclick={(e) => { e.stopPropagation(); delScene(s); }} title="Sil">×</button></span>
          </div>
        {/each}
        <button class="si add" onclick={newScene}>+ Yeni sahne</button>
      </div>
      <div class="pl">
        <span class="mono">OYUNCULAR</span>
        {#each pls as p (p.uid)}
          <label class="pr"><span>{p.name}</span><select class="inp" value={asg[p.uid] ?? ''} onchange={(e) => assign(p.uid, (e.target as HTMLSelectElement).value)}><option value="">— Bağlı değil —</option>{#each scenes as s (s.id)}<option value={s.id}>{s.name}</option>{/each}</select></label>
        {:else}<small class="mut">Oyuncu bulunamadı.</small>{/each}
        {#if sc}
          <span class="mono">CETVEL ÖLÇEĞİ · {sc.name.toLocaleUpperCase('tr')}</span>
          <label class="pr"><span>1 piksel =</span><input class="inp" type="number" min="0" step="0.01" placeholder="1" value={sc.upx ?? ''} onchange={(e) => { const v = +(e.target as HTMLInputElement).value; setOpt('upx', v > 0 ? v : 0); }} /></label>
          <label class="pr"><span>Birim adı</span><input class="inp" maxlength="16" placeholder="metre" value={sc.unit ?? ''} onchange={(e) => { setOpt('unit', (e.target as HTMLInputElement).value.trim().slice(0, 16)); }} /></label>
          <label class="pr"><span>Izgara (px, 0 = yok)</span><input class="inp" type="number" min="0" max="500" placeholder="0" value={sc.grid ?? ''} onchange={(e) => { const v = Math.round(+(e.target as HTMLInputElement).value); setOpt('grid', v > 0 ? Math.min(500, v) : 0); }} /></label>
          <small class="mut">Örnek: 1 piksel = 0.05 metre → 1920 px genişlik 96 metre. Izgara açıksa cetvel uçları ızgaraya oturur (Alt: serbest).</small>
        {/if}
      </div>
    </div>
  </Panel>

  <Panel side="left" label="DEPO" id="dep" w={330}><Depot bind:this={depot} /></Panel>

  <Panel side="right" label="KATMANLAR" id="lay" w={300}>
    <div class="ly">
      <div class="la"><button class="btn small" onclick={newLayer} disabled={!sc}>+ Katman</button><button class="btn ghost small" onclick={() => (tool = 'text')} disabled={!sc}>+ Metin</button></div>
      <div class="ll">
        {#if sc}{#each [...sc.layers].reverse() as l, ri (l.id)}
          {@const idx = sc.layers.length - 1 - ri}
          <div class="li" class:on={l.id === sel} class:hid={l.hid} role="button" tabindex="0" draggable="true" onclick={() => (sel = l.id)} onkeydown={(e) => e.key === 'Enter' && (sel = l.id)}
            ondragstart={() => (ldrag = l.id)} ondragover={(e) => e.preventDefault()} ondrop={(e) => { e.preventDefault(); if (ldrag && ldrag !== l.id) reorder(ldrag, idx); ldrag = ''; }}>
            <button class="eye" onclick={(e) => { e.stopPropagation(); push(); const x = sc!.layers.find((y) => y.id === l.id)!; x.hid = !x.hid; mark(); persist(true); }} title={l.hid ? 'Göster' : 'Gizle'}>{l.hid ? '◌' : '◉'}</button>
            <i class="kd mono">{KIND[l.k]}</i>
            {#if renL === l.id}<!-- svelte-ignore a11y_autofocus --><input autofocus bind:value={renLV} onblur={() => { const v = renLV.trim(); renL = ''; if (v) edit((x) => (x.name = v.slice(0, 60))); }} onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') renL = ''; }} onclick={(e) => e.stopPropagation()} />
            {:else}<span class="ln" ondblclick={() => { renL = l.id; renLV = l.name; }} role="presentation">{l.name}</span>{/if}
            <span class="ops"><button onclick={(e) => { e.stopPropagation(); z(l.id, 1); }} title="Yukarı">▲</button><button onclick={(e) => { e.stopPropagation(); z(l.id, -1); }} title="Aşağı">▼</button><button onclick={(e) => { e.stopPropagation(); delLayer(l.id); }} title="Sil">×</button></span>
          </div>
        {:else}<div class="mut">Boş sahne. Depodan görsel sürükle ya da fırçayla çiz.</div>{/each}{/if}
      </div>
      {#if cur}
        <div class="pp">
          <span class="mono">SEÇİLİ · {KIND[cur.k].toLocaleUpperCase('tr')}</span>
          <div class="row"><button class="btn ghost small" onclick={fill}>Sahneyi doldur</button><button class="btn ghost small" onclick={() => z(cur!.id, 99)}>En öne</button><button class="btn ghost small" onclick={() => z(cur!.id, -99)}>En arkaya</button></div>
          <label class="ck"><input type="checkbox" checked={cur.lock ?? cur.k === 'img'} onchange={(e) => edit((l) => (l.lock = (e.target as HTMLInputElement).checked))} /> En-boy oranını koru <small>(Shift: tersine)</small></label>
          {#if cur.k === 'text'}
            <textarea class="inp" rows="3" value={cur.t} oninput={(e) => editText((l) => (l.t = (e.target as HTMLTextAreaElement).value))} onblur={() => (typing = false)}></textarea>
            <div class="row"><label class="fl">Boyut<input class="inp" type="number" min="8" max="400" value={cur.fs} onchange={(e) => edit((l) => (l.fs = Math.max(8, Math.min(400, +(e.target as HTMLInputElement).value || 48))))} /></label>
              <button class="btn ghost small" class:on={cur.bold} onclick={() => edit((l) => (l.bold = !l.bold))}><b>K</b></button>
              {#each [['left', '⟸'], ['center', '≡'], ['right', '⟹']] as [a, s] (a)}<button class="btn ghost small" class:on={(cur.al ?? 'left') === a} onclick={() => edit((l) => (l.al = a as Layer['al']))}>{s}</button>{/each}</div>
            <div class="cl">{#each COLORS as c (c)}<button style:background={c} class:on={cur.col === c} onclick={() => edit((l) => (l.col = c))} aria-label={c}></button>{/each}<input type="color" value={cur.col} onchange={(e) => edit((l) => (l.col = (e.target as HTMLInputElement).value))} /></div>
          {/if}
          {#if cur.k === 'draw'}<button class="btn ghost small" onclick={() => { if (!cur || !inks[cur.id]) return; push(); const id = cur.id; delete inks[id]; deleteInk(id); mark(); }}>Çizimi temizle</button>{/if}
        </div>
      {/if}
    </div>
  </Panel>

  <div class="tools" role="toolbar" aria-label="Araçlar">
    {#each [['sel', 'Seç / taşı (V)', 'M5 3l14 8-6 2-3 6z'], ['pan', 'Kaydır (H · Boşluk · orta tuş)', 'M12 2v20M2 12h20M12 2l-3 3m3-3 3 3M12 22l-3-3m3 3 3-3M2 12l3-3m-3 3 3 3M22 12l-3-3m3 3-3 3'], ['brush', 'Fırça (B)', 'M3 21c3 0 5-2 5-4.5S10 13 12 13l8-8-2-2-8 8c0 2-1 3.5-3.5 3.5S3 17 3 21z'], ['text', 'Metin (T)', 'M5 5h14M12 5v14M9 19h6'], ['ping', 'İşaret (P)', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z'], ['ruler', 'Cetvel (R) · Shift: düz · Alt: ızgarasız', 'M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2']] as [k, t, d] (k)}
      <button class:on={tool === k} onclick={() => (tool = k as Tool)} title={t} aria-label={t}><svg viewBox="0 0 24 24"><path {d} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg></button>
    {/each}
    {#if tool === 'brush'}<span class="sep"></span>{#each COLORS as c (c)}<button class="swc" style:background={c} class:on={brush.c === c} onclick={() => (brush.c = c)} aria-label={c}></button>{/each}<input type="color" bind:value={brush.c} title="Renk" /><input type="range" min="1" max="60" bind:value={brush.w} title="Kalınlık" /><small class="mono">{brush.w}px</small>{/if}
    <span class="sep"></span>
    <button onclick={doUndo} title="Geri al (Ctrl+Z)" aria-label="Geri al"><svg viewBox="0 0 24 24"><path d="M9 7H4V2M4 7a9 9 0 1 1-1 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
    <button onclick={doRedo} title="Yinele (Ctrl+Y)" aria-label="Yinele"><svg viewBox="0 0 24 24"><path d="M15 7h5V2M20 7a9 9 0 1 0 1 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
    <button onclick={fitView} title="Sahneye sığdır (F)" aria-label="Sığdır"><svg viewBox="0 0 24 24"><path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
    <small class="mono zm">{Math.round(view.z * 100)}%</small>
    <span class="sep"></span>
    <button class:on={dice} onclick={() => { dice = !dice; sfx.click(); }} title="Zar at (Discord'a ve sohbete düşer)" aria-label="Zar"><svg viewBox="0 0 24 24"><path d="M12 2 21 7v10l-9 5-9-5V7zM12 12 21 7M12 12 3 7M12 12v10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></button>
    <button class:on={dmp} onclick={() => { dmp = !dmp; sfx.click(); }} title="DM Paneli (God's Eye üstünde)" aria-label="DM Paneli"><svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 12h6M12 9v6" stroke="currentColor" stroke-width="1.4"/></svg></button>
  </div>
  {#if msg}<div class="msg mono">{msg}</div>{/if}
  <Chat />
  {#if dice}<FloatWin title="ZAR ATICI" id="dice" w={700} h={500} onclose={() => (dice = false)}><Dice compact onrolled={(r) => postRoll(r, true, 'DM')} /></FloatWin>{/if}
  {#if dmp}<FloatWin title="DM PANELİ" id="dmp" w={Math.min(1180, innerWidth - 80)} h={Math.min(720, innerHeight - 120)} onclose={() => (dmp = false)}>{#await DMPanel then m}<m.default />{/await}</FloatWin>{/if}
</div>
<style>
  .dm{position:absolute;inset:46px 0 0 0;overflow:hidden;background:#07090e}
  canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
  canvas.pan,canvas.ping{cursor:grab}canvas.brush{cursor:crosshair}canvas.text{cursor:text}canvas.ruler{cursor:crosshair}canvas.ping{cursor:crosshair}
  .sb{position:absolute;border:1px solid var(--cy);pointer-events:none;box-shadow:0 0 0 1px rgba(0,0,0,.6)}
  .h{position:absolute;width:11px;height:11px;margin:-6px;background:#04050a;border:1.5px solid var(--cy);pointer-events:auto}
  .nw{left:0;top:0;cursor:nwse-resize}.n{left:50%;top:0;cursor:ns-resize}.ne{left:100%;top:0;cursor:nesw-resize}.e{left:100%;top:50%;cursor:ew-resize}
  .se{left:100%;top:100%;cursor:nwse-resize}.s{left:50%;top:100%;cursor:ns-resize}.sw{left:0;top:100%;cursor:nesw-resize}.w{left:0;top:50%;cursor:ew-resize}
  .empty{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:10px;color:var(--mut);pointer-events:none}.empty .btn{pointer-events:auto}
  .sc{display:grid;grid-template-columns:1fr 280px;gap:12px;padding:10px;overflow:auto}
  .sl{display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start}
  .si{position:relative;display:flex;flex-direction:column;min-width:130px;padding:7px 10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.02);cursor:pointer;color:#dde;font:inherit;text-align:left}
  .si.on{border-color:var(--cy);background:rgba(0,240,255,.08)}.si b{font-weight:600;font-size:14px}.si small{font-size:11px;color:var(--mut)}
  .si input{font:inherit;background:#000;border:1px solid var(--cy);color:#fff;width:120px}
  .si.add{justify-content:center;color:var(--cy);border-style:dashed}
  .ops{position:absolute;top:3px;right:3px;display:none;gap:2px}.si:hover .ops,.li:hover .ops{display:flex}
  .ops button{width:18px;height:18px;padding:0;font-size:11px;line-height:1;background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.18);color:#ddd;cursor:pointer}
  .pl{display:flex;flex-direction:column;gap:6px}.pl>span{font-size:9.5px;letter-spacing:.3em;color:var(--ye)}
  .pr{display:grid;grid-template-columns:1fr 150px;gap:8px;align-items:center;font-size:13.5px}.pr select{padding:3px 4px;font-size:12.5px}
  .mut{color:var(--mut);font-size:12.5px;padding:8px}
  .ly{display:flex;flex-direction:column;gap:8px;padding:10px;min-height:0;flex:1}
  .la{display:flex;gap:6px}
  .ll{flex:1;min-height:80px;overflow:auto;display:flex;flex-direction:column;gap:3px}
  .li{position:relative;display:flex;align-items:center;gap:6px;padding:5px 6px;border:1px solid transparent;background:rgba(255,255,255,.025);cursor:pointer;font-size:13.5px}
  .li.on{border-color:var(--cy);background:rgba(0,240,255,.08)}.li.hid .ln{opacity:.4}
  .eye{width:20px;background:none;border:none;color:var(--cy);cursor:pointer;padding:0}
  .kd{font-style:normal;font-size:9px;letter-spacing:.12em;color:var(--mut);width:44px}
  .ln{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.li input{flex:1;font:inherit;background:#000;border:1px solid var(--cy);color:#fff;min-width:0}
  .pp{display:flex;flex-direction:column;gap:7px;border-top:1px solid rgba(0,240,255,.15);padding-top:8px}.pp>span{font-size:9.5px;letter-spacing:.3em;color:var(--ye)}
  .row{display:flex;gap:5px;flex-wrap:wrap;align-items:center}.ck{font-size:13px;display:flex;align-items:center;gap:6px}.ck small{color:var(--mut)}
  .fl{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--mut)}.fl input{width:64px;padding:3px}
  .btn.on{background:rgba(0,240,255,.2);color:#fff}
  .pp textarea{resize:vertical;font-family:var(--f-ui)}
  .cl{display:flex;gap:4px;align-items:center}.cl button{width:20px;height:20px;border:1px solid rgba(255,255,255,.25);padding:0;cursor:pointer}.cl button.on{outline:2px solid var(--cy);outline-offset:1px}.cl input{width:28px;height:22px;padding:0;border:none;background:none}
  .tools{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:3px;padding:5px;background:rgba(5,8,14,.9);border:1px solid rgba(0,240,255,.3);z-index:5}
  .tools button{width:34px;height:32px;display:grid;place-items:center;background:none;border:1px solid transparent;color:#cfe;cursor:pointer;padding:0}
  .tools button:hover{border-color:rgba(0,240,255,.35)}.tools button.on{background:var(--cy);color:#04050a}
  .tools svg{width:19px;height:19px}.tools .sep{width:1px;height:22px;background:rgba(255,255,255,.12);margin:0 4px}
  .tools .swc{width:18px;height:18px;border:1px solid rgba(255,255,255,.25)}.tools .swc.on{outline:2px solid var(--cy);outline-offset:1px;background-clip:content-box}
  .tools input[type=color]{width:26px;height:24px;border:none;background:none;padding:0}.tools input[type=range]{width:90px}
  .tools small{font-size:10.5px;color:var(--mut);min-width:34px;text-align:right}
  .msg{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);font-size:11.5px;color:#39ff8a;background:rgba(0,0,0,.7);padding:4px 10px;z-index:5}
</style>
