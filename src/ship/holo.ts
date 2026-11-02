/*
 * Gemi hologramı v2 (three.js): tır + dorseler (katalog tipine göre), her yuva işaretli (boş/dolu), takılı parçalar modelde görünür.
 * Yuvalar sabit ekran boyutlu işaretlerdir (uzak/uzun tırda da kolay tıklanır). Yalnız açıkken çizer; kapanınca her şeyi serbest bırakır.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { part, slots as allSlots, type ShipDoc, type Addon, type TrailerDef, type Engine, type Core } from './sys';

const VS = `varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = `uniform vec3 uColor; uniform float uA; uniform float uTime; uniform float uReveal; uniform float uHi; uniform float uFlick; uniform float uLine;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main(){
  if (vW.y > uReveal) discard;
  float edge = smoothstep(uReveal - 0.6, uReveal, vW.y);
  float f = uLine > 0.5 ? 1.0 : pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float scan = smoothstep(0.0, 0.08, fract(vW.y * 0.35 - uTime * 0.25)) * (1.0 - smoothstep(0.08, 0.16, fract(vW.y * 0.35 - uTime * 0.25)));
  float a = (uLine > 0.5 ? 0.55 : (0.06 + f * 0.75)) * uA;
  a += scan * 0.12 * uA + edge * 0.9;
  vec3 c = mix(uColor, vec3(1.0), edge * 0.8 + uHi * 0.25) * (1.0 + uHi * 0.6);
  gl_FragColor = vec4(c * uFlick, a);
}`;
export interface Hooks { hover: (id: string | null) => void; select: (id: string | null) => void }
export const SLOT_COLORS = { empty: '#ffb547', full: '#39ff8a', hov: '#ffffff', sel: '#fcee0a' };
type Mod = { id: string; group: THREE.Group; inner: THREE.Group; hit: THREE.Mesh; center: THREE.Vector3; mats: THREE.ShaderMaterial[]; rmats: THREE.ShaderMaterial[]; len: number };
const CAB_COLOR = new THREE.Color('#33e6ff'), TR_COLOR = new THREE.Color('#5fd0ff'), ROOM_COLOR = new THREE.Color('#ffb547');
const TL = 28, GAP = 3.2, CAB_REAR = -12.5;
const TLEN: Record<string, number> = { T1: 28, T2: 36, T3: 44, T4: 54 }, TWID: Record<string, number> = { T1: 8.2, T2: 9.2, T3: 10.2, T4: 11.6 }, THM: Record<string, number> = { T1: 1, T2: 1.12, T3: 1.5, T4: 1.75 };
/** Şasi ölçeği (kabin ve tır yuvaları). */
const CAB_S: Record<string, number> = { T1: 1, T2: 1.15, T3: 1.3, T4: 1.5 };
/** Marka tonu: hologram camgöbeğine karışır; firmalar ayırt edilsin. */
const BRAND_TINT: Record<string, string> = { gn: '#ffb04a', kz: '#ff6a3c', dk: '#d8a060', hd: '#5fffd8', sr: '#8aa0c8', vm: '#ffc4dc', pc: '#ff8a50', wb: '#fff3d6', ara: '#ff4a5e', ara_k: '#ff6a7a', ara_p: '#ff7a6a', ara_i: '#ff9aa8', mil: '#a8d870', mil_o: '#b8e080', mil_opt: '#c8f090', emt: '#b07aff', emt_m: '#9a8aff', emt_g: '#c38bff', emt_y: '#ff7ae0', ic: '#c0c8d8', kk: '#9dff6a', yf: '#ffd27a', pyra: '#ff9a50', ost: '#80b8ff', gh: '#c8ff5a' };

export class ShipHolo {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; private controls: OrbitControls;
  private clock = new THREE.Clock(); private raf = 0; private mats: THREE.ShaderMaterial[] = []; private glows: { s: THREE.Sprite; base: number; ph: number }[] = [];
  private mods: Mod[] = []; private labels: { p: THREE.Vector3; el: HTMLDivElement; mod: string }[] = [];
  private marks: { key: string; sp: THREE.Sprite; ring: THREE.Sprite; p: THREE.Vector3; full: boolean; el: HTMLDivElement }[] = []; private parts = new THREE.Group(); private partMats: THREE.ShaderMaterial[] = [];
  private ringTex!: THREE.Texture; private dotTex!: THREE.Texture; private doc: ShipDoc | null = null; private sig = ''; private trSig = '';
  private ray = new THREE.Raycaster(); private ptr = new THREE.Vector2(); private hov: string | null = null; sel: string | null = null;
  private reveal = -2; private revealTo = 20; private fly: { t0: number; a: THREE.Vector3; b: THREE.Vector3; ca: THREE.Vector3; cb: THREE.Vector3 } | null = null;
  private glowTex: THREE.Texture; private engGlows: { s: THREE.Sprite; base: number; ph: number }[] = []; private coreGlow: { s: THREE.Sprite; base: number; ph: number } | null = null; private coreMesh: THREE.Mesh | null = null; private trailers: { k: string; id: string }[] = []; private shipGroup = new THREE.Group(); private ro: ResizeObserver; private idle = 0;
  constructor(private host: HTMLElement, private overlay: HTMLElement, private hooks: Hooks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); this.renderer.setClearColor('#03060c');
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2000); this.camera.position.set(46, 26, 58);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = true; this.controls.dampingFactor = 0.07;
    this.controls.target.set(-6, 5, 0); this.controls.minDistance = 14; this.controls.maxDistance = 320; this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.autoRotate = true; this.controls.autoRotateSpeed = 0.45;
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; this.idle = 0; });
    this.glowTex = makeGlow();
    this.ringTex = makeRing(false); this.dotTex = makeRing(true);
    this.scene.add(this.shipGroup, this.parts);
    this.buildFloor(); this.buildCab();
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onMove); el.addEventListener('click', this.onClick); el.addEventListener('pointerdown', this.onDown);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    document.addEventListener('visibilitychange', this.onVis); this.loop();
  }
  // ---------- malzeme ----------
  private mat(color: THREE.Color, a = 1, line = false) {
    const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: color.clone() }, uA: { value: a }, uTime: { value: 0 }, uReveal: { value: this.reveal }, uHi: { value: 0 }, uFlick: { value: 1 }, uLine: { value: line ? 1 : 0 } } });
    this.mats.push(m); return m;
  }
  private add(g: THREE.BufferGeometry, parent: THREE.Object3D, color: THREE.Color, list: THREE.ShaderMaterial[], a = 1, edges = true) {
    const m = this.mat(color, a); list.push(m); const mesh = new THREE.Mesh(g, m); parent.add(mesh);
    if (edges) { const lm = this.mat(color, a, true); list.push(lm); const l = new THREE.LineSegments(new THREE.EdgesGeometry(g, 24), lm); parent.add(l); }
    return mesh;
  }
  private glow(parent: THREE.Object3D, x: number, y: number, z: number, s: number, color: string, base = 0.9) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: base }));
    sp.position.set(x, y, z); sp.scale.setScalar(s); parent.add(sp); this.glows.push({ s: sp, base, ph: Math.random() * 6 }); return sp;
  }
  // ---------- zemin ----------
  private buildFloor() {
    const g = new THREE.Group();
    const ring = (r: number, o: number) => { const geo = new THREE.RingGeometry(r, r + 0.12, 128); const m = new THREE.MeshBasicMaterial({ color: '#00f0ff', transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }); const me = new THREE.Mesh(geo, m); me.rotation.x = -Math.PI / 2; g.add(me); };
    for (const [r, o] of [[30, 0.25], [60, 0.16], [95, 0.1], [140, 0.06]] as const) ring(r, o);
    const grid = new THREE.GridHelper(320, 64, '#0a6f86', '#08303c'); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.35; g.add(grid);
    g.position.y = -0.6; this.scene.add(g);
    const pts = new Float32Array(900 * 3); for (let i = 0; i < 900; i++) { const r = 300 + Math.random() * 600, a = Math.random() * 6.28, b = Math.random() * 3.14; pts.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#7fdcff', size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.6 })));
  }
  private profile(pts: [number, number][], depth: number) {
    const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.18, bevelThickness: 0.18, bevelSegments: 1 }); g.translate(0, 0, -depth / 2); return g;
  }
  private cyl(r: number, len: number, seg = 20) { const g = new THREE.CylinderGeometry(r, r, len, seg, 1); g.rotateZ(Math.PI / 2); return g; }
  // ---------- kabin (uzun burunlu çekici) ----------
  private buildCab() {
    const g = new THREE.Group(), L: THREE.ShaderMaterial[] = [], C = CAB_COLOR;
    for (const z of [-2.2, 2.2]) { const r = this.add(new THREE.BoxGeometry(27, 0.9, 0.8), g, C, L); r.position.set(-0.5, 2, z); }
    this.add(this.profile([[12.5, 2.6], [12.5, 7.2], [11.8, 7.7], [4.5, 8.0], [4.5, 2.6]], 5.4), g, C, L); // kaput
    this.add(this.profile([[4.6, 2.6], [4.6, 8.1], [2.6, 12], [-3.2, 12.4], [-3.6, 13.2], [-8, 13.2], [-8, 2.6]], 7.2), g, C, L); // kabin + yatak bölmesi
    const ws = this.add(new THREE.PlaneGeometry(4.5, 6.2), g, new THREE.Color('#9ff6ff'), L, 0.7); ws.position.set(3.65, 10, 0); ws.rotation.set(0, Math.PI / 2, 0); ws.rotateX(-0.46);
    const gr = this.add(new THREE.BoxGeometry(0.35, 4.6, 4.2), g, new THREE.Color('#d8fbff'), L); gr.position.set(12.75, 5, 0); // ızgara
    const bars = new THREE.Group(); for (let i = -6; i <= 6; i++) { const b = this.add(new THREE.BoxGeometry(0.1, 4.2, 0.06), bars, C, L, 0.8, false); b.position.set(12.98, 5, i * 0.31); } g.add(bars);
    const bump = this.add(new THREE.BoxGeometry(0.9, 1.1, 8.4), g, C, L); bump.position.set(13.2, 2.4, 0);
    for (const y of [3.4, 6]) { const t = this.add(new THREE.CylinderGeometry(0.22, 0.22, 7.6, 10), g, C, L, 1, false); t.rotation.x = Math.PI / 2; t.position.set(14.2, y, 0); } // koruma demiri
    for (const z of [-3.4, -1.2, 1.2, 3.4]) { const t = this.add(new THREE.CylinderGeometry(0.2, 0.2, 4.4, 8), g, C, L, 1, false); t.position.set(14.2, 4.4, z); }
    for (const z of [-3.9, 3.9]) { const s = this.add(new THREE.CylinderGeometry(0.42, 0.42, 10, 14), g, new THREE.Color('#d8fbff'), L); s.position.set(4.4, 11, z); this.glow(g, 4.4, 16.3, z, 2.2, '#ffb547', 0.5); } // egzoz bacaları
    for (const z of [-2.6, 2.6]) this.glow(g, 13.1, 6.6, z, 2.6, '#e6fbff', 0.8); // farlar
    for (let i = 0; i < 5; i++) this.glow(g, -1 + i * 0.8, 12.75, (i - 2) * 1.1, 0.9, '#ffb547', 0.7); // tavan lambaları
    const ant = this.add(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), g, C, L, 1, false); ant.position.set(-6.5, 14.8, 2.6);
    // yan itici kapsülleri (ön ve arka) + bağlantı kolları
    for (const [x, len, r] of [[8.2, 6.4, 1.55], [-9.5, 7.2, 1.75]] as const) for (const z of [-5.6, 5.6]) {
      const p = this.add(new THREE.CapsuleGeometry(r, len, 6, 16).rotateZ(Math.PI / 2), g, C, L); p.position.set(x, 3.6, z);
      const n = this.add(new THREE.CylinderGeometry(r * 0.7, r * 0.95, 1.2, 16).rotateZ(Math.PI / 2), g, new THREE.Color('#d8fbff'), L); n.position.set(x - len / 2 - r - 0.2, 3.6, z);
      const st = this.add(new THREE.BoxGeometry(1.2, 0.5, 2.6), g, C, L, 1, false); st.position.set(x, 3.6, z * 0.66);
      this.glow(g, x - len / 2 - r - 1.4, 3.6, z, 4.5, '#5ff0ff', 0.75);
    }
    // ana motorlar (arka, çift) ve Skarn çekirdeği
    for (const z of [-3.4, 3.4]) {
      const e = this.add(this.cyl(2, 7.5), g, C, L); e.position.set(-15.2, 2.4, z);
      const nz = this.add(new THREE.CylinderGeometry(1.6, 2.3, 1.8, 20).rotateZ(-Math.PI / 2), g, new THREE.Color('#d8fbff'), L); nz.position.set(-19.8, 2.4, z);
      this.glow(g, -21.6, 2.4, z, 9, '#ff9a3c', 0.9); this.glow(g, -21, 2.4, z, 4, '#fff1d0', 0.9);
    }
    const core = this.add(new THREE.BoxGeometry(3.2, 3.2, 3.4), g, new THREE.Color('#ffb547'), L); core.position.set(-9.9, 4.5, 0); this.glow(g, -9.9, 4.5, 0, 6, '#ff9a3c', 0.35);
    const fw = this.add(new THREE.CylinderGeometry(1.8, 1.8, 0.4, 24), g, C, L); fw.position.set(-14, 3.2, 0); // beşinci teker (bağlantı tablası)
    this.shipGroup.add(g);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(36, 15, 13), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(-3.5, 7, 0); g.add(hit);
    this.mods.push({ id: 'cab', group: g, inner: new THREE.Group(), hit, center: new THREE.Vector3(-2, 7, 0), mats: L, rmats: [], len: 36 });
    this.engGlows = this.glows.filter((x) => x.s.position.x < -20); this.coreGlow = this.glows.find((x) => Math.abs(x.s.position.x + 9.9) < 0.01 && x.s.position.y === 4.5) ?? null; this.coreMesh = core;
  }
  private label(p: THREE.Vector3, text: string, mod: string, cls = '') {
    const el = document.createElement('div'); el.className = 'sh-lbl ' + cls; el.textContent = text; this.overlay.appendChild(el); this.labels.push({ p, el, mod }); return el;
  }
  // ---------- gemi durumu ----------
  setShip(doc: ShipDoc) {
    this.doc = doc;
    if (doc.chassis !== this.chassis) { this.chassis = doc.chassis; this.cabS = CAB_S[doc.chassis] ?? 1; const cab = this.mods.find((m) => m.id === 'cab'); if (cab) { cab.group.scale.setScalar(this.cabS); cab.group.position.x = 0; } this.trSig = ''; this.sig = ''; }
    const trSig = doc.trailers.map((t) => t.k + ':' + t.id).join('|');
    if (trSig !== this.trSig) { this.trSig = trSig; this.rebuildTrailers(doc.trailers); }
    const sig = JSON.stringify([doc.engine, doc.core, doc.fit, trSig]);
    if (sig !== this.sig) { this.sig = sig; this.rebuildParts(); }
  }
  private rebuildTrailers(list: { k: string; id: string }[]) {
    for (const m of this.mods.filter((m) => m.id !== 'cab')) { this.shipGroup.remove(m.group);
      m.group.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); });
      const sp = new Set<THREE.Object3D>(); m.group.traverse((o) => { if ((o as THREE.Sprite).isSprite) { sp.add(o); ((o as THREE.Sprite).material as THREE.Material).dispose(); } }); this.glows = this.glows.filter((x) => !sp.has(x.s));
      this.mats = this.mats.filter((x) => !m.mats.includes(x)); m.mats.forEach((x) => x.dispose()); }
    this.mods = this.mods.filter((m) => m.id === 'cab');
    for (const l of this.labels.filter((l) => l.mod !== 'cab')) l.el.remove(); this.labels = this.labels.filter((l) => l.mod === 'cab');
    this.trailers = list.map((t) => ({ ...t })); let x = CAB_REAR * this.cabS - 1;
    for (const t of list) { const d = part(t.id) as TrailerDef | null; if (d) x = this.buildTrailer(t.k, d, x) - GAP; }
    this.trEnd = x;
    this.reveal = Math.min(this.reveal, 0);
  }
  private trTop: Record<string, { x0: number; x1: number; top: number; Y: number }> = {}; private trEnd = CAB_REAR; private cabS = 1; private chassis = 'T1';
  /** Dorse modeli: tipine göre biçim (yaşam = pencereli modül, tanker = tank…), boyuna göre ölçü/kat, markaya göre ton ve ayrıntı. */
  private buildTrailer(key: string, d: TrailerDef, x1: number) {
    const z = d.size as 'T1' | 'T2' | 'T3' | 'T4', TLz = TLEN[z] ?? TL, WD = TWID[z] ?? 8.2, HM = THM[z] ?? 1, decks = z === 'T3' || z === 'T4' ? 2 : 1;
    const g = new THREE.Group(), L: THREE.ShaderMaterial[] = [], C = TR_COLOR.clone().lerp(new THREE.Color(BRAND_TINT[d.brand] ?? '#5fd0ff'), 0.45), x0 = x1 - TLz, cx = (x0 + x1) / 2, Y = 4.2, W = new THREE.Color('#d8fbff'), WIN = new THREE.Color('#9ff6ff');
    const B = (w: number, h: number, dd: number, x: number, y: number, zz: number, c = C, a = 1, e = true) => { const m = this.add(new THREE.BoxGeometry(w, h, dd), g, c, L, a, e); m.position.set(x, y, zz); return m; };
    const hw = WD / 2;
    // şasi: kirişler, şah pimi, ayaklar, akslar (boyla artar)
    for (const zz of [-hw * 0.55, hw * 0.55]) B(TLz, 0.8, 0.7, cx, 3.8, zz, C, 1, false);
    B(3, 0.4, WD * 0.6, x1 - 1.5, 3.6, 0, C, 1, false);
    for (const zz of [-hw * 0.7, hw * 0.7]) B(0.35, 3.4, 0.35, x1 - 5, 1.9, zz, C, 1, false);
    const axles = z === 'T1' ? 2 : z === 'T2' ? 3 : z === 'T3' ? 4 : 5;
    for (let j = 0; j < axles; j++) for (const zz of [-hw * 0.82, hw * 0.82]) { const wh = this.add(new THREE.CylinderGeometry(1.25, 1.25, 1.1, 18).rotateX(Math.PI / 2), g, C, L, 0.8); wh.position.set(x0 + 3 + j * 3.1, 1.25, zz); }
    const ty = d.type, br = d.brand; let top = Y + 8.6 * HM;
    const H = (base: number) => base * HM;
    const ribs = (h: number, n: number, c = C, a = 0.6) => { for (let j = 1; j < n; j++) for (const zz of [-hw - 0.02, hw + 0.02]) B(0.12, h - 0.4, 0.06, x0 + (TLz / n) * j, Y + h / 2, zz, c, a, false); };
    const deckLine = (h: number) => { if (decks < 2) return; for (const zz of [-hw - 0.04, hw + 0.04]) B(TLz - 0.6, 0.16, 0.08, cx, Y + h / 2, zz, W, 0.8, false); };
    const winRow = (y: number, n: number, w = 1.6, h = 1.1, from = x0 + 2, to = x1 - 2, glow = '#ffe2a8') => { for (let j = 0; j < n; j++) { const x = from + ((to - from) * (j + 0.5)) / n; for (const zz of [-hw - 0.05, hw + 0.05]) { B(w, h, 0.06, x, y, zz, WIN, 0.85, true); this.glow(g, x, y, zz * 1.02, 1.1, glow, 0.55); } } };
    const hatch = (x: number, h = 3.2) => { for (const zz of [-hw - 0.06, hw + 0.06]) { B(1.8, h, 0.08, x, Y + h / 2 + 0.2, zz, W, 0.9, true); B(0.5, 0.18, 0.1, x + 0.5, Y + h / 2 + 0.2, zz * 1.01, W, 1, false); } };
    if (/tanker/i.test(ty)) {
      const r = (WD / 2) * 0.86 * (decks > 1 ? 1.15 : 1); const b = this.add(new THREE.CapsuleGeometry(r, TLz - 2 * r - 2, 6, 28).rotateZ(Math.PI / 2), g, C, L); b.position.set(cx, Y + r, 0); top = Y + 2 * r;
      const n = Math.round(TLz / 5.5); for (let j = 0; j < n; j++) { const rr = this.add(this.cyl(r + 0.15, 0.35), g, C, L, 0.8, false); rr.position.set(x0 + 3 + ((TLz - 6) * j) / (n - 1), Y + r, 0); }
      B(TLz - 8, 0.2, 1.4, cx, top + 0.1, 0, W, 0.7, false);
      for (let j = 0; j < 3; j++) { const v = this.add(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 10), g, W, L, 0.9); v.position.set(x0 + TLz * (0.25 + j * 0.25), top + 0.4, 0); }
      if (br === 'kk') { for (let j = 0; j < 4; j++) B(1.6 + (j % 2), 1, 0.1, x0 + 4 + j * (TLz / 4.6), Y + r * 0.9, -r - 0.1, new THREE.Color('#9dff6a'), 0.6, false); } // yamalı, kaçak
      else this.glow(g, x1 - 2, Y + r, r + 0.2, 2.2, '#ffb547', 0.6); // Gnistborn: ısı uyarı feneri
    } else if (/Hangar/i.test(ty)) {
      top = Y + 0.7; B(TLz, 0.7, WD + 0.2, cx, Y + 0.35, 0);
      const hh = H(6.2); for (const zz of [-hw, hw]) B(TLz - 1, hh, 0.3, cx, top + hh / 2, zz); B(TLz - 1, 0.3, WD, cx, top + hh, 0, C, 0.7); // kapalı hangar kabuğu
      for (let j = 0; j < Math.round(TLz / 3.2); j++) B(0.18, 0.3, WD, x0 + 1 + j * 3.2, top + hh + 0.3, 0, C, 0.5, false);
      const sh = this.add(this.profile([[0, 0], [9, 0], [11, 1.4], [9, 3], [2, 3.3], [0, 2]], 4.6), g, WIN, L, 0.8); sh.position.set(cx - 6, top + 0.2, 0); sh.scale.setScalar(HM);
      B(0.2, hh - 0.4, WD - 0.6, x0 + 0.1, top + hh / 2, 0, W, 0.5, false); // arka rampa kapağı
      if (br === 'mil_o') B(4, 3.4, WD * 0.8, x1 - 2.4, top + 1.7, 0); else for (let j = 0; j < 3; j++) this.glow(g, cx + (j - 1) * 6, top + hh - 0.4, 0, 1.6, '#7fa6c8', 0.4);
      top += hh;
    } else if (/Yaşam/i.test(ty)) {
      // pencereli yaşam modülü: kapı ambarları, çatı modülleri (iklim, anten), Pyra = korağacı kaplama, ARASAKA = kurumsal düz panel + gıda havalandırması
      const h = H(8.2); B(TLz, h, WD, cx, Y + h / 2, 0); top = Y + h;
      const wood = br === 'pyra'; ribs(h, wood ? Math.round(TLz * 1.1) : Math.round(TLz / 4.5), wood ? new THREE.Color('#ffb070') : C, wood ? 0.35 : 0.55);
      deckLine(h); const rows = decks; for (let k = 0; k < rows; k++) winRow(Y + (h / rows) * (k + 0.62), Math.round(TLz / 3.6), 1.8, 1.0, x0 + 4, x1 - 3, wood ? '#ffc27a' : '#ffe2a8');
      hatch(x1 - 2.2, Math.min(3.4, h / decks - 0.6)); hatch(x0 + 2.2, Math.min(3.4, h / decks - 0.6));
      for (let j = 0; j < Math.max(2, Math.round(TLz / 9)); j++) { const ac = B(3, 1.1, 2.6, x0 + 5 + j * 8.2, top + 0.55, (j % 2 ? 1 : -1) * hw * 0.35, C, 0.9); for (let q = 0; q < 3; q++) B(0.08, 0.9, 2.2, ac.position.x - 1 + q, top + 0.6, ac.position.z, W, 0.6, false); }
      if (br === 'ara_p') { B(2.4, 1.2, 0.08, cx, Y + h * 0.82, hw + 0.06, new THREE.Color('#ff4a5e'), 0.9, false); this.glow(g, cx, Y + h * 0.82, hw + 0.4, 2.4, '#ff4a5e', 0.5); for (let j = 0; j < 4; j++) { const v = this.add(new THREE.CylinderGeometry(0.35, 0.35, 1.6, 10), g, W, L, 0.9); v.position.set(x0 + 3 + j * 1.2, top + 0.8, hw * 0.6); } }
      if (wood) { const ch = this.add(new THREE.CylinderGeometry(0.35, 0.45, 2.6, 10), g, W, L); ch.position.set(x1 - 5, top + 1.3, -hw * 0.5); this.glow(g, x1 - 5, top + 2.8, -hw * 0.5, 1.5, '#ff9a3c', 0.5); }
      top += 1.2;
    } else if (/Silah/i.test(ty)) {
      top = Y + 0.7; B(TLz, 0.7, WD + 0.2, cx, Y + 0.35, 0);
      for (const zz of [-hw, hw]) B(TLz - 2, 1.6, 0.4, cx, top + 0.8, zz);
      const towers = z === 'T1' ? 1 : z === 'T2' ? 2 : 3;
      for (let j = 0; j < towers; j++) { const tx = x1 - 5 - j * ((TLz - 10) / Math.max(1, towers - 1 || 1)); const tw = B(6, H(4.4), 6, tx, top + H(4.4) / 2, 0); void tw; const rot = this.add(new THREE.CylinderGeometry(2.4, 2.8, 1.4, 16), g, C, L); rot.position.set(tx, top + H(4.4) + 0.7, 0);
        for (const zz of [-0.7, 0.7]) { const bar = this.add(new THREE.CylinderGeometry(0.22, 0.3, 6, 10).rotateZ(Math.PI / 2), g, W, L); bar.position.set(tx + 3.6, top + H(4.4) + 0.9, zz); } }
      B(7, 2.4, WD * 0.75, x0 + 4.5, top + 1.2, 0, C, 0.8); // cephanelik
      if (br === 'kz') for (let j = 0; j < Math.round(TLz / 3); j++) B(2.4, 1.2, 0.2, x0 + 1.5 + j * 3, top + 0.8, -hw - 0.25, new THREE.Color('#ff7a3c'), 0.6, false); // kurt çeliği plakalar
      if (br === 'gh') for (let j = 0; j < 5; j++) { const p = B(1.2 + (j % 3) * 0.6, 1 + (j % 2), 1.2, x0 + 3 + j * (TLz / 5.5), top + 0.8, (j % 2 ? 1 : -1) * hw * 0.4, new THREE.Color('#c8ff5a'), 0.6); p.rotation.y = j * 0.4; } // kitbash
      top += H(4.4) + 1.6;
    } else if (/Madencilik/i.test(ty)) {
      top = Y + 0.7; B(TLz, 0.7, WD + 0.2, cx, Y + 0.35, 0);
      if (br === 'pc') { for (let j = 0; j < 9; j++) { const p = B(1.4 + (j % 3), 1 + (j % 4) * 0.5, 1.6 + (j % 2), x0 + 2 + j * (TLz / 10), top + 0.8, ((j * 37) % 5 - 2) * 0.7, new THREE.Color('#ff9a5a'), 0.6); p.rotation.set(j * 0.3, j, j * 0.2); } }
      else { const hop = this.add(new THREE.CylinderGeometry(3.4 * HM, 2.2 * HM, 4.6 * HM, 6, 1, true), g, C, L); hop.position.set(cx - 3, top + 2.3 * HM, 0); }
      B(4, 3.6, WD * 0.65, x1 - 3, top + 1.8, 0);
      const arm = B(12 * HM, 0.6, 0.6, x0 + 7, top + 5.4 * HM, 0, W); arm.rotation.z = -0.35; B(0.7, 5.6 * HM, 0.7, x0 + 12.5, top + 2.8 * HM, 0, W, 1, false);
      if (br === 'dk') { const drill = this.add(new THREE.ConeGeometry(1.4, 4, 12).rotateZ(Math.PI / 2), g, W, L); drill.position.set(x0 - 1.6, Y + 1.6, 0); }
      if (br === 'ost') { const cl = this.add(new THREE.TorusGeometry(1.4, 0.2, 6, 14, Math.PI), g, W, L); cl.position.set(x0 + 2, top + 4.2 * HM, 0); }
      top += 4.6 * HM;
    } else {
      // kutu gövdeli tipler (kargo, EW, yayın, tıbbi, laboratuvar, yedek kumanda, kaçakçılık)
      const h = H(/EW|Yedek/i.test(ty) ? 7.4 : 8.6); B(TLz, h, WD, cx, Y + h / 2, 0); top = Y + h; deckLine(h);
      const cargo = /Kargo|Kaçakçılık/.test(ty); ribs(h, cargo ? Math.round(TLz / 2.1) : Math.round(TLz / 7));
      if (cargo) { B(0.2, h - 0.6, WD - 0.6, x0 - 0.05, Y + h / 2, 0, W, 0.5, false); for (let j = -1; j <= 1; j += 2) B(0.3, h - 0.4, 0.2, x0 - 0.1, Y + h / 2, j * WD * 0.25, W, 0.8, false); // arka kapı + kilit kolları
        if (br === 'ic') for (let j = 0; j < Math.round(TLz / 4); j++) for (const zz of [-hw - 0.3, hw + 0.3]) B(3.4, h * 0.45, 0.25, x0 + 2 + j * 4, Y + h * 0.4, zz, C, 0.8);
        if (br === 'yf') for (let j = 0; j < Math.round(TLz / 5); j++) this.glow(g, x0 + 2 + j * 5, top + 0.5, 0, 1.4, '#ffd27a', 0.75);
        if (br === 'ara_k') { const rp = B(5, 0.3, WD - 1, x0 - 2.4, Y + 0.6, 0, W, 0.7); rp.rotation.z = 0.32; } }
      if (/EW/.test(ty)) { for (let j = 0; j < 4 + decks; j++) B(0.12, 3 + j * 0.6, 0.12, x0 + 4 + j * 1.4, top + 1.5 + j * 0.3, -hw * 0.55, W, 1, false); const d2 = this.add(new THREE.SphereGeometry(1.4, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), g, C, L); d2.position.set(x1 - 4, top + 0.9, hw * 0.4);
        if (br === 'emt_g') for (let j = 0; j < 3; j++) this.glow(g, x0 + 3 + j * 3, top + 0.2, hw * 0.5, 1.2, '#c38bff', 0.8); else B(TLz * 0.6, 0.12, 0.12, cx, top + 0.4, 0, new THREE.Color('#9dff6a'), 0.6, false); }
      if (/Yayın|Laboratuvar/.test(ty)) { const dish = this.add(new THREE.SphereGeometry(2.2 * HM, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), g, C, L); dish.position.set(x0 + 5, top + 1.8, 0); dish.rotation.z = 0.5;
        const mast = this.add(new THREE.CylinderGeometry(0.12, 0.12, 2, 6), g, C, L, 1, false); mast.position.set(x0 + 5, top + 0.8, 0);
        for (let k = 0; k < decks; k++) for (const zz of [-hw - 0.05, hw + 0.05]) B(TLz * 0.5, 1.4, 0.08, cx + 2, Y + (h / decks) * (k + 0.65), zz, WIN, 0.9, false);
        if (br === 'emt_y') for (const zz of [-hw - 0.4, hw + 0.4]) { B(TLz * 0.36, h * 0.5, 0.05, cx - 2, Y + h * 0.5, zz, new THREE.Color('#ff7ae0'), 0.35, true); this.glow(g, cx - 2, Y + h * 0.5, zz, 5, '#ff7ae0', 0.3); } // holo ekran
        if (br === 'hd') B(TLz * 0.8, 0.5, WD * 0.5, cx, top + 0.25, 0, W, 0.6); }
      if (/Tıbbi/.test(ty)) for (const zz of [-hw - 0.1, hw + 0.1]) { this.glow(g, cx, Y + h * 0.58, zz, 3.2, br === 'vm' ? '#ff9ac0' : '#ff5470', 0.7); B(2.6, 0.7, 0.05, cx, Y + h * 0.58, zz, new THREE.Color('#ffd0d8'), 1, false); B(0.7, 2.6, 0.05, cx, Y + h * 0.58, zz, new THREE.Color('#ffd0d8'), 1, false); winRow(Y + h * 0.6, 2, 2.4, 1.2, x0 + 3, cx - 4, '#e8fbff'); }
      if (/Tıbbi/.test(ty) && br === 'vm') { const cr = this.add(this.cyl(1.2, 4.4, 16), g, WIN, L, 0.8); cr.position.set(x0 + 4, top + 1.2, 0); }
      if (/Yedek/.test(ty)) { for (const zz of [-hw - 0.05, hw + 0.05]) B(3.6, 1.6, 0.08, x1 - 2.4, Y + h * 0.72, zz, WIN, 0.9, false); B(0.1, 1.8, WD * 0.7, x0 - 0.05, Y + h * 0.72, 0, WIN, 0.9, false);
        if (br === 'mil') for (let j = 0; j < 3; j++) B(0.3, 1.2, 0.3, x1 - 1 - j * 0.6, top + 0.6, 0, W, 1, false); else for (const zz of [-hw - 0.3, hw + 0.3]) B(TLz - 2, h * 0.5, 0.3, cx, Y + h * 0.35, zz, C, 0.7); }
      if (/Kaçakçılık/.test(ty)) { for (let j = 0; j < 3; j++) B(1.4, 0.9, 0.06, x0 + 3 + j * 1.8, Y + 1.2, hw + 0.06, new THREE.Color('#7fa6c8'), 0.5, false); }
    }
    for (const zz of [-hw * 0.6, hw * 0.6]) this.glow(g, x0 - 0.6, 3.2, zz, 2.4, '#ff3b4f', 0.55);
    this.shipGroup.add(g); this.trTop[key] = { x0, x1, top, Y };
    this.label(new THREE.Vector3(cx, top + 4.2, 0), `${d.model}${z !== 'T1' ? ' · ' + z : ''} · ${d.type}`, key, 'tr');
    const hit = new THREE.Mesh(new THREE.BoxGeometry(TLz, top - 1, WD + 1.3), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(cx, (top + 1) / 2, 0); g.add(hit);
    this.mods.push({ id: key, group: g, inner: new THREE.Group(), hit, center: new THREE.Vector3(cx, 7, 0), mats: L, rmats: [], len: TLz });
    return x0;
  }
  // ---------- yuvalar + takılı parçalar ----------
  static TRUCK: Record<string, [number, number, number]> = { truck_roof: [-3.6, 14.2, 0], truck_roof2: [-6.6, 14.2, 0], truck_sh_l: [1.5, 9.4, -3.9], truck_sh_r: [1.5, 9.4, 3.9], truck_nose: [9, 8.6, 0], truck_tail: [-11.5, 7.4, 0], truck_flank_l: [-1.6, 7.2, -4.5], truck_flank_r: [-1.6, 7.2, 4.5], truck_bay: [-5.6, 6, 0], truck_bay2: [-3, 6, 0], truck_bay3: [-0.4, 6, 0], engine_mount: [-15.2, 5.4, -3.4], core_mount: [-9.9, 6.9, 0], hitch: [-14, 4.6, 0] };
  anchor(key: string): THREE.Vector3 {
    const t = ShipHolo.TRUCK[key]; if (t) return new THREE.Vector3(...t).multiplyScalar(this.cabS);
    const [k, ii] = key.split('#'), i = +ii, tr = this.trTop[k], d = part(this.trailers.find((x) => x.k === k)?.id ?? '') as TrailerDef | null;
    if (!tr || !d) return new THREE.Vector3();
    const outs = d.slots.map((s, j) => ({ s, j })).filter((x) => x.s.mount === 'Dış'), ins = d.slots.map((s, j) => ({ s, j })).filter((x) => x.s.mount !== 'Dış');
    const L = tr.x1 - tr.x0, oi = outs.findIndex((x) => x.j === i);
    if (oi >= 0) return new THREE.Vector3(tr.x1 - (L * (oi + 1)) / (outs.length + 1), tr.top + 0.9, 0);
    const ni = ins.findIndex((x) => x.j === i); return new THREE.Vector3(tr.x1 - (L * (ni + 1)) / (ins.length + 1), tr.Y + 3.4, 0);
  }
  private rebuildParts() {
    const doc = this.doc!; this.parts.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); }); this.parts.clear();
    this.mats = this.mats.filter((m) => !this.partMats.includes(m)); this.partMats.forEach((m) => m.dispose()); this.partMats = [];
    for (const m of this.marks) { m.el.remove(); (m.sp.material as THREE.Material).dispose(); (m.ring.material as THREE.Material).dispose(); this.scene.remove(m.sp, m.ring); } this.marks = [];
    const P = new THREE.Color('#7dffb0'), keys = allSlots(doc).map((s) => s.key);
    if (!doc.trailers.length) keys.push('hitch');
    for (const key of keys) {
      const p = this.anchor(key), id = key === 'engine_mount' ? doc.engine : key === 'core_mount' ? doc.core : doc.fit[key], full = !!id;
      if (id && key !== 'engine_mount' && key !== 'core_mount') this.partMesh(part(id) as Addon, key, p, P);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dotTex, color: full ? SLOT_COLORS.full : SLOT_COLORS.empty, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false }));
      sp.scale.setScalar(0.034); sp.position.copy(p); sp.renderOrder = 10; sp.userData.slot = key;
      const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ringTex, color: full ? SLOT_COLORS.full : SLOT_COLORS.empty, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false, opacity: 0.9 }));
      ring.scale.setScalar(0.05); ring.position.copy(p); ring.renderOrder = 11; ring.userData.slot = key;
      this.scene.add(sp, ring);
      const sl = allSlots(doc).find((s) => s.key === key);
      const el = document.createElement('div'); el.className = 'sh-slot' + (full ? ' full' : ''); el.innerHTML = `<b>${key === 'hitch' ? 'Dorse bağlantısı' : sl?.label ?? key}</b><span>${id ? part(id)?.model ?? id : 'BOŞ · ' + (sl ? sl.size + ' ' + sl.mount : 'T1 dorse')}</span>`;
      this.overlay.appendChild(el); this.marks.push({ key, sp, ring, p, full, el });
    }
    // motor: itki büyüklüğü ve rengi; çekirdek: güç rengi
    const e = part(doc.engine) as Engine | null, c = part(doc.core) as Core | null;
    const ecol = e?.legality === 'Kaçak' ? '#9dff6a' : e && e.thrust >= 230 ? '#ff7a2a' : e && e.efficiency >= 640 ? '#8fd8ff' : '#ff9a3c';
    const f = e ? 0.75 + (e.thrust - 150) / 220 : 0.2;
    for (const g of this.engGlows) { g.s.userData.s0 ??= g.s.scale.x; (g.s.material as THREE.SpriteMaterial).color.set(g.s.userData.s0 > 5 ? ecol : '#fff1d0'); g.s.scale.setScalar(g.s.userData.s0 * f * (doc.trailers.length ? 0.45 : 1)); }
    const ccol = c?.tech === 'human' ? '#bff8ff' : c?.id === 'core_deepforge' ? '#ff5a3c' : c?.id === 'core_whitebone' ? '#fff3d6' : c?.id === 'core_sparkjack' ? '#7aa8ff' : '#ffb547';
    if (this.coreGlow) (this.coreGlow.s.material as THREE.SpriteMaterial).color.set(ccol);
    if (this.coreMesh) (this.coreMesh.material as THREE.ShaderMaterial).uniforms.uColor.value.set(ccol);
    // kalkan: tüm gemiyi saran silik kabarcık
    if (Object.values(doc.fit).some((id) => (part(id) as Addon)?.cat === 'Kalkan')) {
      const xa = 15 * this.cabS, xb = doc.trailers.length ? this.trEnd : -22 * this.cabS, len = xa - xb, m = this.pmat(new THREE.Color('#6fe9ff'), 0.35);
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), m); b.scale.set(len / 2 + 2, 11 * this.cabS + 3, 9 * this.cabS + 2); b.position.set((xa + xb) / 2, 6.5 * this.cabS, 0); this.parts.add(b);
    }
    this.applyMarks();
  }
  private pmat(c: THREE.Color, a = 1, line = false) { const m = this.mat(c, a, line); this.partMats.push(m); return m; }
  private padd(g: THREE.BufferGeometry, p: THREE.Vector3, c: THREE.Color, a = 1, edges = true) {
    const m = new THREE.Mesh(g, this.pmat(c, a)); m.position.copy(p); this.parts.add(m);
    if (edges) { const l = new THREE.LineSegments(new THREE.EdgesGeometry(g, 24), this.pmat(c, a, true)); l.position.copy(p); this.parts.add(l); } return m;
  }
  private partMesh(a: Addon, key: string, p: THREE.Vector3, C: THREE.Color) {
    if (!a) return; const big = a.size === 'S3' ? 2 : a.size === 'S2' ? 1.5 : 1, inside = !!allSlots(this.doc!).find((s) => s.key === key && s.mount === 'İç'), side = p.z === 0 ? 0 : Math.sign(p.z), up = side === 0;
    const q = p.clone(); if (up) q.y -= 0.6; const v = (x: number, y: number, z: number) => q.clone().add(new THREE.Vector3(x, y, z));
    if (inside) { this.padd(new THREE.BoxGeometry(1.8 * big, 1.4 * big, 1.8 * big), q, new THREE.Color('#ffd28a'), 0.9); return; }
    switch (a.cat) {
      case 'Silah': { const base = up ? v(0, 0.5, 0) : v(0, 0, side * 0.6); this.padd(new THREE.CylinderGeometry(1 * big, 1.2 * big, 0.8, 14), base, C);
        const bar = this.padd(new THREE.CylinderGeometry(0.18 * big, 0.22 * big, 4.2 * big, 8).rotateZ(Math.PI / 2), base.clone().add(new THREE.Vector3(1.8 * big, 0.6, 0)), C); bar.rotation.y = side ? -side * 0.25 : 0;
        if (big > 1) this.padd(new THREE.CylinderGeometry(0.18, 0.22, 4.2 * big, 8).rotateZ(Math.PI / 2), base.clone().add(new THREE.Vector3(1.8 * big, 0.6, 0.6)), C); break; }
      case 'İtici': { const c = up ? v(0, 1, 0) : v(0, 0, side * 0.9); this.padd(new THREE.CapsuleGeometry(0.8 * big, 2.6 * big, 4, 12).rotateZ(Math.PI / 2), c, C);
        this.padd(new THREE.CylinderGeometry(0.5 * big, 0.8 * big, 0.7, 12).rotateZ(Math.PI / 2), c.clone().add(new THREE.Vector3(-2.4 * big, 0, 0)), new THREE.Color('#d8fbff'));
        this.glow(this.parts, c.x - 3.2 * big, c.y, c.z, 3 * big, '#5ff0ff', 0.8); break; }
      case 'Zırh': for (let j = -1; j <= 1; j++) { const pl = this.padd(new THREE.BoxGeometry(2.4 * big, up ? 0.25 : 2.4 * big, up ? 3.2 * big : 0.25), v(j * 2.6 * big, up ? 0.2 : 0, up ? 0 : side * 0.2), C, 0.9); pl.rotation.y = 0; } break;
      case 'Sensör': { this.padd(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6), v(0, up ? 0.8 : 0.4, side * 0.4), C, 1, false);
        const d = this.padd(new THREE.SphereGeometry(1.1 * big, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), v(0, up ? 1.8 : 1.2, side * 0.6), C); d.rotation.z = 0.6; break; }
      case 'Kalkan': this.padd(new THREE.SphereGeometry(1.4 * big, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), v(0, up ? 0.2 : 0, side * 0.6), new THREE.Color('#6fe9ff'), 0.9); break;
      case 'EW': for (let j = 0; j < 3; j++) this.padd(new THREE.CylinderGeometry(0.07, 0.07, 1.8 + j * 0.7, 6), v(-0.8 + j * 0.8, up ? 1 + j * 0.35 : 0.4, side * 0.5), C, 1, false); break;
      default: { this.padd(new THREE.BoxGeometry(1.6 * big, 1.2, 1.6 * big), v(0, up ? 0.7 : 0, side * 0.7), C); this.glow(this.parts, q.x, q.y + (up ? 1.8 : 1), q.z + side * 0.7, 1.6, '#fff1a8', 0.8); }
    }
  }
  private hovSlot: string | null = null; selSlot: string | null = null;
  setSelected(key: string | null) { this.selSlot = key; this.applyMarks(); }
  private applyMarks() {
    for (const m of this.marks) { const c = m.key === this.selSlot ? SLOT_COLORS.sel : m.key === this.hovSlot ? SLOT_COLORS.hov : m.full ? SLOT_COLORS.full : SLOT_COLORS.empty;
      (m.sp.material as THREE.SpriteMaterial).color.set(c); (m.ring.material as THREE.SpriteMaterial).color.set(c);
      const k = m.key === this.selSlot ? 1.45 : m.key === this.hovSlot ? 1.3 : 1; m.sp.scale.setScalar(0.034 * k); m.ring.scale.setScalar(0.05 * k);
      m.el.classList.toggle('on', m.key === this.selSlot); m.el.classList.toggle('hv', m.key === this.hovSlot); m.el.classList.toggle('full', m.full); }
  }
  focus(id: string | null) {
    this.sel = id; for (const m of this.mods) for (const x of m.mats) x.uniforms.uHi.value = m.id === id ? 1 : 0;
    const m = id ? this.mods.find((x) => x.id === id) : null; this.controls.autoRotate = false;
    const minX = this.mods.length > 1 ? this.trEnd : -21 * this.cabS;
    const L = 16 * this.cabS - minX, tb = m ? m.center.clone() : new THREE.Vector3((minX + 16 * this.cabS) / 2, 6, 0);
    const dist = m ? 40 + m.len * 1.2 : L > 70 ? 25 + L * 0.95 : 60 * this.cabS + (CAB_REAR * this.cabS - this.trEnd) * 0.95;
    let dir = this.camera.position.clone().sub(this.controls.target).normalize(); if (dir.y < 0.25) dir.y = 0.35; dir.normalize();
    if (m) dir = new THREE.Vector3(0.45, 0.42, Math.sign(dir.z || 1)).normalize();
    else if (L > 70) dir = new THREE.Vector3(0.18, 0.5, Math.sign(dir.z || 1)).normalize(); // uzun katar: yandan bak, hepsi kadraja girsin
    this.fly = { t0: performance.now(), a: this.controls.target.clone(), b: tb, ca: this.camera.position.clone(), cb: tb.clone().addScaledVector(dir, dist) };
  }
  /** Yuvaya yaklaş (kamera yuvayı ortalar). */
  focusSlot(key: string) {
    const p = this.anchor(key); this.controls.autoRotate = false; const owner = key.includes('#') ? key.split('#')[0] : 'cab';
    for (const m of this.mods) for (const x of m.mats) x.uniforms.uHi.value = m.id === owner ? 0.6 : 0;
    let dir = this.camera.position.clone().sub(this.controls.target).normalize(); if (dir.y < 0.3) dir.y = 0.4; dir.normalize();
    const zs = ShipHolo.TRUCK[key]?.[2] ?? 0; if (zs) dir = new THREE.Vector3(0.35, 0.45, Math.sign(zs)).normalize();
    this.fly = { t0: performance.now(), a: this.controls.target.clone(), b: p.clone(), ca: this.camera.position.clone(), cb: p.clone().addScaledVector(dir, 42) };
  }
  overview() { this.focus(null); }
  private pick(e: PointerEvent | MouseEvent): { slot?: string; mod?: string } | null {
    const r = this.renderer.domElement.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
    // yuva işaretleri: ekranda en yakın işaret (22 px içinde) — uzun tırda da kolay seçim
    const v = new THREE.Vector3(); let best: string | null = null, bd = 22;
    for (const m of this.marks) { v.copy(m.p).project(this.camera); if (v.z > 1) continue; const d = Math.hypot((v.x * 0.5 + 0.5) * r.width - mx, (-v.y * 0.5 + 0.5) * r.height - my); if (d < bd) { bd = d; best = m.key; } }
    if (best) return { slot: best };
    this.ptr.set((mx / r.width) * 2 - 1, -(my / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera); const hits = this.ray.intersectObjects(this.mods.map((m) => m.hit), false);
    const id = hits.length ? this.mods.find((m) => m.hit === hits[0].object)?.id ?? null : null; return id ? { mod: id } : null;
  }
  private down = { x: 0, y: 0 };
  private onMove = (e: PointerEvent) => { const p = this.pick(e), k = p?.slot ?? null; this.renderer.domElement.style.cursor = p ? 'pointer' : 'grab';
    if (k !== this.hovSlot) { this.hovSlot = k; this.applyMarks(); this.hooks.hover(k); } };
  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY }; };
  private onClick = (e: MouseEvent) => { if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) return; const p = this.pick(e);
    this.hooks.select(p?.slot ?? (p?.mod && p.mod !== 'cab' ? 'trailer:' + p.mod : p?.mod === 'cab' ? null : null)); };
  private onVis = () => { if (!document.hidden && !this.raf) this.loop(); };
  replay() { this.reveal = -2; }
  private resize() { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.renderer.setSize(w, h); this.renderer.domElement.style.display = "block"; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  paused = false;
  private loop = () => {
    if (document.hidden) { this.raf = 0; return; }
    this.raf = requestAnimationFrame(this.loop); if (this.paused) return;
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    if (this.reveal < this.revealTo) this.reveal += dt * 7.5;
    const fl = 0.93 + Math.random() * 0.07 * (Math.random() < 0.04 ? 3 : 1);
    for (const m of this.mats) { m.uniforms.uTime.value = t; m.uniforms.uReveal.value = this.reveal; m.uniforms.uFlick.value = fl; }
    for (const g of this.glows) (g.s.material as THREE.SpriteMaterial).opacity = this.reveal > g.s.getWorldPosition(new THREE.Vector3()).y ? g.base * (0.82 + 0.18 * Math.sin(t * 7 + g.ph)) : 0;
    const pulse = 0.75 + 0.25 * Math.sin(t * 3.2);
    for (const m of this.marks) { const vis = this.reveal > 12; m.sp.visible = m.ring.visible = vis; (m.ring.material as THREE.SpriteMaterial).opacity = m.full ? 0.75 : pulse; (m.ring.material as THREE.SpriteMaterial).rotation = m.key === this.selSlot ? t * 1.5 : 0; }
    if (this.fly) { const k = Math.min(1, (performance.now() - this.fly.t0) / 1100), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.controls.target.lerpVectors(this.fly.a, this.fly.b, e); this.camera.position.lerpVectors(this.fly.ca, this.fly.cb, e); if (k >= 1) this.fly = null; }
    if (!this.controls.autoRotate && !this.fly) { this.idle += dt; if (this.idle > 45 && !this.sel && !this.selSlot) this.controls.autoRotate = true; }
    this.controls.update(); this.renderer.render(this.scene, this.camera);
    const w = this.host.clientWidth, h = this.host.clientHeight, v = new THREE.Vector3();
    for (const l of this.labels) { if (this.reveal < 14) { l.el.style.display = 'none'; continue; }
      v.copy(l.p).project(this.camera); if (v.z > 1) { l.el.style.display = 'none'; continue; }
      l.el.style.display = 'block'; l.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`; l.el.classList.toggle('on', l.mod === this.sel); }
    for (const m of this.marks) { const show = this.reveal > 14 && (m.key === this.selSlot || m.key === this.hovSlot);
      if (!show) { m.el.style.display = 'none'; continue; } v.copy(m.p).project(this.camera); if (v.z > 1) { m.el.style.display = 'none'; continue; }
      m.el.style.display = 'block'; m.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w + 18}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(0, -50%)`; }
  };
  dispose() {
    cancelAnimationFrame(this.raf); this.raf = 0; this.ro.disconnect(); document.removeEventListener('visibilitychange', this.onVis);
    const el = this.renderer.domElement; el.removeEventListener('pointermove', this.onMove); el.removeEventListener('click', this.onClick); el.removeEventListener('pointerdown', this.onDown);
    this.controls.dispose(); this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mt)) mt.forEach((x) => x.dispose()); else mt?.dispose?.(); });
    this.glowTex.dispose(); this.ringTex.dispose(); this.dotTex.dispose(); for (const l of this.labels) l.el.remove(); for (const m of this.marks) m.el.remove(); this.renderer.dispose(); el.remove();
  }
}
function makeGlow() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Yuva işareti: dış halka (kesikli köşeler) ya da iç nokta. */
function makeRing(dot: boolean) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d')!; x.strokeStyle = '#fff'; x.fillStyle = '#fff';
  if (dot) { x.beginPath(); x.arc(64, 64, 16, 0, Math.PI * 2); x.fill(); x.lineWidth = 3; x.globalAlpha = 0.55; x.beginPath(); x.arc(64, 64, 30, 0, Math.PI * 2); x.stroke(); }
  else { x.lineWidth = 7; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(64, 64, 52, i * Math.PI / 2 + 0.25, i * Math.PI / 2 + Math.PI / 2 - 0.25); x.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
