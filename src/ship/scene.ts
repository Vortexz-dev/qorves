/*
 * Gemi hologramı (three.js). Kabin + 0–5 dorse, holografik fresnel kabuk, kenar çizgileri, alttan yukarı açılış taraması,
 * iç plan kipi (kabuk saydamlaşır, odalar görünür). Yalnız açıkken çizer; kapanınca her şeyi serbest bırakır.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ROOMS, KINDS, type Trailer } from './data';

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
type Mod = { id: string; group: THREE.Group; inner: THREE.Group; hit: THREE.Mesh; center: THREE.Vector3; mats: THREE.ShaderMaterial[]; rmats: THREE.ShaderMaterial[]; len: number };
const CAB_COLOR = new THREE.Color('#33e6ff'), TR_COLOR = new THREE.Color('#5fd0ff'), ROOM_COLOR = new THREE.Color('#ffb547');
const TL = 28, GAP = 3.2, CAB_REAR = -12.5;

export class ShipScene {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; private controls: OrbitControls;
  private clock = new THREE.Clock(); private raf = 0; private mats: THREE.ShaderMaterial[] = []; private glows: { s: THREE.Sprite; base: number; ph: number }[] = [];
  private mods: Mod[] = []; private interior = new THREE.Group(); private labels: { p: THREE.Vector3; el: HTMLDivElement; mod: string }[] = [];
  private ray = new THREE.Raycaster(); private ptr = new THREE.Vector2(); private hov: string | null = null; sel: string | null = null;
  private reveal = -2; private revealTo = 20; private inside = false; private fly: { t0: number; a: THREE.Vector3; b: THREE.Vector3; ca: THREE.Vector3; cb: THREE.Vector3 } | null = null;
  private glowTex: THREE.Texture; private trailers: Trailer[] = []; private shipGroup = new THREE.Group(); private ro: ResizeObserver; private idle = 0;
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
    this.scene.add(this.shipGroup, this.interior); this.interior.visible = false;
    this.buildFloor(); this.buildCab(); this.buildRooms();
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onMove); el.addEventListener('click', this.onClick);
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
    this.mods.push({ id: 'cab', group: g, inner: this.interior, hit, center: new THREE.Vector3(-2, 7, 0), mats: L, rmats: [], len: 36 });
  }
  // ---------- iç plan ----------
  private buildRooms() {
    for (const r of ROOMS) {
      const w = r.x1 - r.x0, h = r.y1 - r.y0, d = r.id === 'motor' ? 4.6 : 6.2;
      const m = this.add(new THREE.BoxGeometry(w - 0.15, h - 0.15, d), this.interior, ROOM_COLOR, this.mods[0].rmats, 0.55); m.position.set((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0);
      this.label(new THREE.Vector3((r.x0 + r.x1) / 2, r.y1 + 0.3, 0), r.n, 'cab', 'room', r.id);
    }
    const furn: [number, number, number, number, number, number][] = [[2.6, 8.3, -1.4, 1.2, 1.2, 1.2], [2.6, 8.3, 1.4, 1.2, 1.2, 1.2], [3.9, 9.4, 0, 0.4, 1.0, 5], // koltuklar + konsol
      [-5.6, 8.4, 0, 4, 0.5, 2.4], [-5.6, 10.8, 0, 4, 0.5, 2.4], [-1.4, 4.1, 0, 2, 0.15, 2.2], [-2.9, 3.6, 0, 0.8, 1.2, 5]]; // ranzalar, masa, koltuk
    for (const [x, y, z, w, h, d] of furn) { const f = this.add(new THREE.BoxGeometry(w, h, d), this.interior, new THREE.Color('#ffd28a'), this.mods[0].rmats, 0.8); f.position.set(x, y, z); }
  }
  private label(p: THREE.Vector3, text: string, mod: string, cls = '', img = '') {
    const el = document.createElement('div'); el.className = 'sh-lbl ' + cls; el.textContent = text; if (img) { el.dataset.img = img; el.title = 'Fotoğrafı aç'; } this.overlay.appendChild(el); this.labels.push({ p, el, mod });
  }
  // ---------- dorseler ----------
  setTrailers(list: Trailer[]) {
    const same = list.length === this.trailers.length && list.every((t, i) => t.kind === this.trailers[i].kind && t.id === this.trailers[i].id);
    this.trailers = list.map((t) => ({ ...t })); if (same) return;
    for (const m of this.mods.filter((m) => m.id !== 'cab')) { this.shipGroup.remove(m.group); this.interior.remove(m.inner);
      for (const gg of [m.group, m.inner]) gg.traverse((o) => { (o as THREE.Mesh).geometry?.dispose?.(); });
      const sp = new Set<THREE.Object3D>(); m.group.traverse((o) => { if ((o as THREE.Sprite).isSprite) { sp.add(o); ((o as THREE.Sprite).material as THREE.Material).dispose(); } }); this.glows = this.glows.filter((x) => !sp.has(x.s));
      const all = [...m.mats, ...m.rmats]; this.mats = this.mats.filter((x) => !all.includes(x)); all.forEach((x) => x.dispose()); }
    this.mods = this.mods.filter((m) => m.id === 'cab');
    for (const l of this.labels.filter((l) => l.mod !== 'cab')) l.el.remove(); this.labels = this.labels.filter((l) => l.mod === 'cab');
    list.forEach((t, i) => this.buildTrailer(t, i));
  }
  private buildTrailer(t: Trailer, i: number) {
    const g = new THREE.Group(), L: THREE.ShaderMaterial[] = [], C = TR_COLOR, x1 = CAB_REAR - 1 - i * (TL + GAP), x0 = x1 - TL, cx = (x0 + x1) / 2;
    for (const z of [-2.2, 2.2]) { const r = this.add(new THREE.BoxGeometry(TL, 0.8, 0.7), g, C, L, 1, false); r.position.set(cx, 3.8, z); }
    const king = this.add(new THREE.BoxGeometry(3, 0.4, 5), g, C, L, 1, false); king.position.set(x1 - 1.5, 3.6, 0);
    const bar = this.add(new THREE.BoxGeometry(GAP + 3.5, 0.5, 0.5), g, new THREE.Color('#d8fbff'), L, 1, false); bar.position.set(x1 + (GAP + 1) / 2 - 1, 3.4, 0); // çeki kolu
    for (const z of [-2.8, 2.8]) { const leg = this.add(new THREE.BoxGeometry(0.35, 3.4, 0.35), g, C, L, 1, false); leg.position.set(x1 - 5, 1.9, z); }
    const k = t.kind, Y = 4.2;
    if (k === 'tanker') { const b = this.add(new THREE.CapsuleGeometry(3.6, TL - 9, 6, 24).rotateZ(Math.PI / 2), g, C, L); b.position.set(cx, Y + 3.6, 0);
      for (let j = -2; j <= 2; j++) { const r = this.add(this.cyl(3.75, 0.35), g, C, L, 0.8, false); r.position.set(cx + j * 4.8, Y + 3.6, 0); } }
    else if (k === 'hangar') { const deck = this.add(new THREE.BoxGeometry(TL, 0.6, 8.2), g, C, L); deck.position.set(cx, Y + 0.3, 0);
      const sh = this.add(this.profile([[0, 0], [9, 0], [11, 1.4], [9, 3], [2, 3.3], [0, 2]], 4.6), g, new THREE.Color('#9ff6ff'), L); sh.position.set(cx - 6, Y + 0.7, 0);
      const box = this.add(new THREE.BoxGeometry(4, 3, 7.6), g, C, L); box.position.set(x0 + 2.3, Y + 2.1, 0); }
    else if (k === 'yasam') { const b = this.add(new THREE.CapsuleGeometry(3.8, TL - 8.5, 6, 20).rotateZ(Math.PI / 2), g, C, L); b.scale.set(1, 1, 1.05); b.position.set(cx, Y + 4, 0);
      for (let j = 0; j < 7; j++) for (const z of [-3.95, 3.95]) this.glow(g, x0 + 4 + j * 3.3, Y + 4.6, z, 1.3, '#ffe2a8', 0.7); }
    else { const h = 8.6, b = this.add(new THREE.BoxGeometry(TL, h, 8.2), g, C, L); b.position.set(cx, Y + h / 2, 0);
      const ribs = k === 'lab' ? 3 : 13; for (let j = 1; j < ribs; j++) for (const z of [-4.12, 4.12]) { const r = this.add(new THREE.BoxGeometry(0.12, h - 0.4, 0.06), g, C, L, 0.6, false); r.position.set(x0 + (TL / ribs) * j, Y + h / 2, z); }
      if (k === 'lab') { for (const z of [-4.15, 4.15]) { const w = this.add(new THREE.BoxGeometry(TL * 0.5, 1.4, 0.08), g, new THREE.Color('#9ff6ff'), L, 0.9, false); w.position.set(cx + 2, Y + 6, z); }
        const dish = this.add(new THREE.SphereGeometry(2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), g, C, L); dish.position.set(x0 + 5, Y + h + 1.6, 0); dish.rotation.z = 0.5;
        const mast = this.add(new THREE.CylinderGeometry(0.12, 0.12, 2, 6), g, C, L, 1, false); mast.position.set(x0 + 5, Y + h + 0.6, 0); }
      if (k === 'depo') { const u = this.add(new THREE.BoxGeometry(1.4, 5, 6), g, new THREE.Color('#d8fbff'), L); u.position.set(x1 + 0.6, Y + 5, 0); } }
    for (const z of [-2.4, 2.4]) this.glow(g, x0 - 0.6, 3.2, z, 2.4, '#5ff0ff', 0.55);
    this.shipGroup.add(g);
    // iç plan: dorse odaları
    const rooms = KINDS[k]?.rooms ?? [], ig = new THREE.Group(), R: THREE.ShaderMaterial[] = []; this.interior.add(ig);
    for (const r of rooms) { const a = x0 + 0.5 + r.a * (TL - 1), b = x0 + 0.5 + r.b * (TL - 1);
      const m = this.add(new THREE.BoxGeometry(b - a - 0.25, 6.4, 6.6), ig, ROOM_COLOR, R, 0.55); m.position.set((a + b) / 2, Y + 3.6, 0);
      this.label(new THREE.Vector3((a + b) / 2, Y + 7.4, 0), r.n, t.id, 'room', r.img); }
    this.label(new THREE.Vector3(cx, Y + 12.2, 0), `${i + 1}. ${t.name || KINDS[k]?.name}`, t.id, 'tr');
    const hit = new THREE.Mesh(new THREE.BoxGeometry(TL, 11, 9.5), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(cx, Y + 4.6, 0); g.add(hit);
    this.mods.push({ id: t.id, group: g, inner: ig, hit, center: new THREE.Vector3(cx, 7, 0), mats: L, rmats: R, len: TL });
    if (this.inside) for (const x of L) x.uniforms.uA.value = 0.28;
  }
  // ---------- etkileşim ----------
  setInterior(on: boolean) { this.inside = on; this.interior.visible = on; for (const m of this.mods) for (const x of m.mats) x.uniforms.uA.value = on ? 0.28 : 1; }
  focus(id: string | null) {
    this.sel = id; for (const m of this.mods) for (const x of m.mats) x.uniforms.uHi.value = m.id === id ? 1 : 0;
    const m = id ? this.mods.find((x) => x.id === id) : null; this.controls.autoRotate = false;
    const minX = this.mods.length > 1 ? this.mods[this.mods.length - 1].center.x - TL / 2 : -21;
    const tb = m ? m.center.clone() : new THREE.Vector3((minX + 14) / 2, 6, 0);
    const dist = m ? 74 : 60 + this.trailers.length * 30;
    let dir = this.camera.position.clone().sub(this.controls.target).normalize(); if (dir.y < 0.25) dir.y = 0.35; dir.normalize();
    if (m) dir = new THREE.Vector3(0.45, 0.42, Math.sign(dir.z || 1)).normalize();
    this.fly = { t0: performance.now(), a: this.controls.target.clone(), b: tb, ca: this.camera.position.clone(), cb: tb.clone().addScaledVector(dir, dist) };
  }
  overview() { this.focus(null); }
  private pick(e: PointerEvent | MouseEvent) {
    const r = this.renderer.domElement.getBoundingClientRect(); this.ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera); const hits = this.ray.intersectObjects(this.mods.map((m) => m.hit), false);
    return hits.length ? this.mods.find((m) => m.hit === hits[0].object)?.id ?? null : null;
  }
  private onMove = (e: PointerEvent) => { const id = this.pick(e); if (id !== this.hov) { this.hov = id; this.renderer.domElement.style.cursor = id ? 'pointer' : 'grab'; this.hooks.hover(id); } };
  private onClick = (e: MouseEvent) => { const id = this.pick(e); this.hooks.select(id); };
  private onVis = () => { if (!document.hidden && !this.raf) this.loop(); };
  replay() { this.reveal = -2; }
  private resize() { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  private loop = () => {
    if (document.hidden) { this.raf = 0; return; }
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    if (this.reveal < this.revealTo) this.reveal += dt * 7.5;
    const fl = 0.93 + Math.random() * 0.07 * (Math.random() < 0.04 ? 3 : 1);
    for (const m of this.mats) { m.uniforms.uTime.value = t; m.uniforms.uReveal.value = this.reveal; m.uniforms.uFlick.value = fl; }
    for (const g of this.glows) (g.s.material as THREE.SpriteMaterial).opacity = this.reveal > g.s.getWorldPosition(new THREE.Vector3()).y ? g.base * (0.82 + 0.18 * Math.sin(t * 7 + g.ph)) : 0;
    if (this.fly) { const k = Math.min(1, (performance.now() - this.fly.t0) / 1200), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.controls.target.lerpVectors(this.fly.a, this.fly.b, e); this.camera.position.lerpVectors(this.fly.ca, this.fly.cb, e); if (k >= 1) this.fly = null; }
    if (!this.controls.autoRotate && !this.fly) { this.idle += dt; if (this.idle > 40 && !this.sel) this.controls.autoRotate = true; }
    this.controls.update(); this.renderer.render(this.scene, this.camera);
    const w = this.host.clientWidth, h = this.host.clientHeight, v = new THREE.Vector3();
    for (const l of this.labels) { const show = this.inside ? true : l.el.classList.contains('tr'); if (!show || this.reveal < 14) { l.el.style.display = 'none'; continue; }
      v.copy(l.p).project(this.camera); if (v.z > 1) { l.el.style.display = 'none'; continue; }
      l.el.style.display = 'block'; l.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
      l.el.classList.toggle('on', l.mod === this.sel || l.mod === this.hov); }
  };
  dispose() {
    cancelAnimationFrame(this.raf); this.raf = 0; this.ro.disconnect(); document.removeEventListener('visibilitychange', this.onVis);
    const el = this.renderer.domElement; el.removeEventListener('pointermove', this.onMove); el.removeEventListener('click', this.onClick);
    this.controls.dispose(); this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mt)) mt.forEach((x) => x.dispose()); else mt?.dispose?.(); });
    this.glowTex.dispose(); for (const l of this.labels) l.el.remove(); this.renderer.dispose(); el.remove();
  }
}
function makeGlow() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
