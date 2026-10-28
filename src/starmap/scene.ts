/*
 * Qorves küme haritası (three.js). Yalnız uygulama açık ve sekme görünürken çizer; kapanınca her şeyi serbest bırakır.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { glowTex, softTex, ringTex, diskTex, beamTex, reticleTex, nebulaTex } from './textures';

export interface SysData { id: string; name: string; x: number; y: number; z: number; size: number; stype: string; star: string; owner: string; ownerText: string; danger: string }
export interface LaneData { id: string; a: string; b: string; name: string; kind: string; days: string; danger: string; status: string }
export interface MapData { factions: Record<string, { name: string; color: string; state: string | null }>; systems: SysData[]; lanes: LaneData[] }
export type Quality = 'low' | 'med' | 'high';
export const STAR_COLOR: Record<string, string> = { A: '#bcd0ff', F: '#f8f7ff', G: '#fff0b0', K: '#ffc98a', M: '#ff8f62', redgiant: '#ff6a3a', whitedwarf: '#e6f2ff',
  pulsar: '#9fd4ff', magnetar: '#c48dff', blackhole: '#ff9a3c', triple: '#ffb070', binary: '#fff4dc', unknown: '#6c7484' };
export const LANE_COLOR: Record<string, string> = { 'Rün': '#6ff7ff', Astar: '#ffd36b', Karma: '#c78bff' };
const Q = { low: { dpr: 1, bg: 5000, disk: 6000, neb: 6, bloom: false }, med: { dpr: 1.5, bg: 12000, disk: 15000, neb: 10, bloom: true }, high: { dpr: 2, bg: 22000, disk: 32000, neb: 14, bloom: true } };

interface SysObj { d: SysData; pos: THREE.Vector3; group: THREE.Group; core: THREE.Sprite; halo: THREE.Sprite; haloOp: number; coreOp: number; extra: THREE.Object3D[]; terr: THREE.Mesh; label: HTMLDivElement; known: boolean; dim: number }
export interface Hooks { hover: (id: string | null) => void; select: (id: string | null) => void }

const POINT_VS = `attribute float size; attribute vec3 color; attribute float tw; varying vec3 vC; varying float vT; uniform float uPR; uniform float uTime;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; vC = color;
  vT = 0.75 + 0.25 * sin(uTime * (0.6 + tw * 2.0) + tw * 40.0);
  gl_PointSize = clamp(size * uPR * (420.0 / -mv.z), 0.6, 9.0 * uPR); }`;
const POINT_FS = `varying vec3 vC; varying float vT; void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p); if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d); a = a * a; gl_FragColor = vec4(vC * vT, a); }`;
// Hat şeridi ekran uzayında sabit kalınlıkta: merkez çizgi + yön, kalınlık piksel cinsinden.
const LANE_VS = `attribute float aU; attribute float aV; attribute vec3 aDir; uniform vec2 uRes; uniform float uW; varying float vU; varying float vV;
void main(){ vU = aU; vV = aV; vec4 c = projectionMatrix * modelViewMatrix * vec4(position,1.0); vec4 n = projectionMatrix * modelViewMatrix * vec4(position + aDir,1.0);
  vec2 sc = c.xy / max(abs(c.w), 1e-4); vec2 sn = n.xy / max(abs(n.w), 1e-4); vec2 d = normalize((sn - sc) * uRes + 1e-6); vec2 perp = vec2(-d.y, d.x);
  c.xy += perp * aV * uW / uRes * 2.0 * c.w; gl_Position = c; }`;
const LANE_FS = `uniform vec3 uColor; uniform float uTime; uniform float uOp; uniform float uMode; uniform float uLen; varying float vU; varying float vV;
void main(){ float core = exp(-vV * vV * 5.0); float edge = smoothstep(0.0, 6.0, vU) * smoothstep(uLen, uLen - 6.0, vU);
  float a; 
  if (uMode < 0.5) { float f1 = fract((vU - uTime * 9.0) / 7.0); float f2 = fract((vU + uTime * 6.0) / 11.0);
    float d1 = smoothstep(0.0, 0.12, f1) * (1.0 - smoothstep(0.32, 0.5, f1)); float d2 = smoothstep(0.0, 0.1, f2) * (1.0 - smoothstep(0.18, 0.3, f2));
    a = core * (0.32 + 0.75 * d1 + 0.3 * d2); }
  else if (uMode < 1.5) { float f = fract(vU / 5.0); a = core * 0.45 * step(f, 0.45); }           // kapalı
  else if (uMode < 2.5) { float f = fract((vU - uTime * 4.0) / 6.0); a = core * (0.25 + 0.6 * step(f, 0.3)) * (0.75 + 0.25 * sin(uTime * 13.0)); } // tehlikeli
  else if (uMode < 3.5) { float f = fract(vU / 3.0); a = core * 0.28 * step(f, 0.25); }           // çökmüş
  else { float f = fract((vU - uTime * 2.0) / 9.0); a = core * 0.5 * smoothstep(0.0, 0.1, f) * (1.0 - smoothstep(0.1, 0.25, f)); } // söylenti
  gl_FragColor = vec4(uColor, a * uOp * edge); }`;

export class ClusterScene {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; controls: OrbitControls;
  composer: EffectComposer | null = null; bloom: UnrealBloomPass | null = null;
  sys = new Map<string, SysObj>(); lanes: { d: LaneData; mesh: THREE.Mesh; mat: THREE.ShaderMaterial; mid: THREE.Vector3; label?: HTMLDivElement }[] = [];
  private bgPoints: THREE.Points[] = []; private nebulae: THREE.Sprite[] = []; private pointMats: THREE.ShaderMaterial[] = [];
  private tex: Record<string, THREE.Texture> = {}; private reticle: THREE.Sprite; private hovRet: THREE.Sprite;
  private raf = 0; private clock = new THREE.Clock(); private running = false; private fly: { t0: number; dur: number; fromT: THREE.Vector3; toT: THREE.Vector3; fromP: THREE.Vector3; toP: THREE.Vector3 } | null = null;
  hovered: string | null = null; selected: string | null = null; showLabels = true; showLanes = true; showTerr = true; quality: Quality;
  private down = { x: 0, y: 0 }; private v = new THREE.Vector3();
  constructor(private host: HTMLElement, private overlay: HTMLElement, private data: MapData, private known: (id: string) => boolean, private hooks: Hooks, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x020309, 1); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.5, 6000); this.camera.position.set(0, 250, 330);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.07, minDistance: 25, maxDistance: 900, maxPolarAngle: Math.PI * 0.47, minPolarAngle: 0.08,
      screenSpacePanning: false, rotateSpeed: 0.6, zoomSpeed: 0.9, panSpeed: 0.8 });
    this.controls.target.set(0, 0, 20);
    for (const [k, f] of Object.entries({ glow: glowTex, soft: softTex, ring: ringTex, disk: diskTex, beam: beamTex, ret: reticleTex })) this.tex[k] = f();
    this.buildBackground(); this.buildGrid(); this.buildSystems(); this.buildLanes();
    this.reticle = this.sprite('ret', '#fcee0a', 1); this.reticle.visible = false; this.scene.add(this.reticle);
    this.hovRet = this.sprite('ret', '#00f0ff', 0.7); this.hovRet.visible = false; this.scene.add(this.hovRet);
    this.setQuality(quality);
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onMove); el.addEventListener('pointerdown', this.onDown); el.addEventListener('pointerup', this.onUp);
    addEventListener('resize', this.resize); document.addEventListener('visibilitychange', this.onVis);
    this.resize(); this.start();
  }
  private sprite(tex: string, color: string, op: number, add = true) {
    const m = new THREE.SpriteMaterial({ map: this.tex[tex], color: new THREE.Color(color), transparent: true, opacity: op, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    return new THREE.Sprite(m);
  }
  private pointsMat() {
    const m = new THREE.ShaderMaterial({ vertexShader: POINT_VS, fragmentShader: POINT_FS, uniforms: { uPR: { value: 1 }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.pointMats.push(m); return m;
  }
  private buildBackground() {
    const q = Q[this.quality];
    const temp = (r: number) => { const c = new THREE.Color(); r < 0.1 ? c.set('#9bb7ff') : r < 0.35 ? c.set('#dfe8ff') : r < 0.7 ? c.set('#fff2d6') : r < 0.9 ? c.set('#ffc98f') : c.set('#ff9b72'); return c; };
    // uzak gök küresi
    { const n = q.bg, p = new Float32Array(n * 3), col = new Float32Array(n * 3), s = new Float32Array(n), tw = new Float32Array(n);
      for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, r = 1800 + Math.random() * 1500, k = Math.sqrt(1 - u * u);
        p.set([r * k * Math.cos(th), r * u * 0.6, r * k * Math.sin(th)], i * 3); const c = temp(Math.random()); const b = 0.35 + Math.random() * 0.65; col.set([c.r * b, c.g * b, c.b * b], i * 3);
        s[i] = 2 + Math.random() ** 3 * 8; tw[i] = Math.random(); }
      this.addPoints(p, col, s, tw); }
    // küme diski: merkeze yoğun, düzleme yakın; Dış Halka (doğu kenarı) seyrek
    { const n = q.disk, p = new Float32Array(n * 3), col = new Float32Array(n * 3), s = new Float32Array(n), tw = new Float32Array(n); let i = 0;
      while (i < n) { const r = Math.abs(this.gauss()) * 210 + Math.random() * 40, th = Math.random() * 6.283, x = r * Math.cos(th), z = r * Math.sin(th);
        if (r > 175 && x > 110 && Math.random() < 0.8) continue;
        if (r > 260 && Math.random() < 0.6) continue;
        const y = this.gauss() * (6 + r * 0.06);
        p.set([x, y, z], i * 3); const c = temp(Math.random()); const b = 0.25 + Math.random() * 0.6; col.set([c.r * b, c.g * b, c.b * b], i * 3);
        s[i] = 0.6 + Math.random() ** 4 * 3.2; tw[i] = Math.random(); i++; }
      this.addPoints(p, col, s, tw); }
    // bulutsular
    const cols = ['#5b2cff', '#00b8c4', '#ff2a8a', '#2a5bff', '#8a2cff', '#00e0a0'];
    for (let k = 0; k < q.neb; k++) {
      const t = nebulaTex(1 + k * 7919); this.tex['neb' + k] = t;
      const m = new THREE.SpriteMaterial({ map: t, color: new THREE.Color(cols[k % cols.length]), transparent: true, opacity: 0.1 + Math.random() * 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(m); const a = Math.random() * 6.283, r = 60 + Math.random() * 380;
      sp.position.set(Math.cos(a) * r, -30 - Math.random() * 120, Math.sin(a) * r); sp.scale.setScalar(260 + Math.random() * 520); m.rotation = Math.random() * 6;
      this.scene.add(sp); this.nebulae.push(sp);
    }
  }
  private addPoints(p: Float32Array, c: Float32Array, s: Float32Array, tw: Float32Array) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('size', new THREE.BufferAttribute(s, 1)); g.setAttribute('tw', new THREE.BufferAttribute(tw, 1));
    const pts = new THREE.Points(g, this.pointsMat()); pts.frustumCulled = false; this.scene.add(pts); this.bgPoints.push(pts);
  }
  private gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2; }
  private buildGrid() {
    const v: number[] = [];
    for (let r = 50; r <= 250; r += 50) for (let i = 0; i < 128; i++) { const a = (i / 128) * 6.283, b = ((i + 1) / 128) * 6.283; v.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(b) * r, 0, Math.sin(b) * r); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; v.push(Math.cos(a) * 20, 0, Math.sin(a) * 20, Math.cos(a) * 250, 0, Math.sin(a) * 250); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.07, depthWrite: false })); l.position.y = -0.6; this.scene.add(l);
    // Dış Halka: doğu kenarında soluk yay
    const arc: number[] = []; for (let i = 0; i <= 64; i++) { const a = -1.15 + (i / 64) * 2.1; arc.push(Math.cos(a) * 205, 0, Math.sin(a) * 205); }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.Float32BufferAttribute(arc, 3));
    this.scene.add(new THREE.Line(ag, new THREE.LineDashedMaterial({ color: 0xa7b3c6, dashSize: 3, gapSize: 4, transparent: true, opacity: 0.25 }))).children.at(-1);
    (this.scene.children.at(-1) as THREE.Line).computeLineDistances();
  }
  private buildSystems() {
    const terrGeo = new THREE.CircleGeometry(34, 48); terrGeo.rotateX(-Math.PI / 2);
    const stalkV: number[] = [], ringV: number[] = [];
    for (const d of this.data.systems) {
      const known = this.known(d.id), pos = new THREE.Vector3(d.x, d.y, d.z), group = new THREE.Group(); group.position.copy(pos);
      const col = known ? STAR_COLOR[d.stype] ?? '#ffffff' : '#6c7484', s = d.size, extra: THREE.Object3D[] = [];
      const core = this.sprite('glow', col, 1); const halo = this.sprite('glow', col, 0.35);
      let cs = 7 * s, hs = 26 * s;
      if (d.stype === 'redgiant') { cs = 11 * s; hs = 46 * s; } if (d.stype === 'whitedwarf') { cs = 4.5 * s; hs = 16 * s; } if (d.stype === 'unknown' || d.owner === 'dm') { cs = 4; hs = 10; halo.material.opacity = 0.12; }
      core.scale.setScalar(cs); halo.scale.setScalar(hs); group.add(halo, core);
      if (d.stype === 'blackhole') {
        core.material.color.set('#ffb070'); core.scale.setScalar(1.6);
        const ring = this.sprite('ring', '#ff9a50', 0.55); ring.scale.setScalar(22 * s); const disk = this.sprite('disk', '#000000', 1, false); disk.scale.setScalar(8 * s); disk.renderOrder = 2;
        const comp = this.sprite('glow', STAR_COLOR.K, 0.9); comp.scale.setScalar(5); comp.position.set(7, 1, -5);
        halo.material.color.set('#7a3010'); halo.scale.setScalar(16 * s); group.add(ring, disk, comp); extra.push(ring);
      }
      if (d.stype === 'pulsar') { for (const r of [0, Math.PI / 2]) { const b = this.sprite('beam', '#bfe6ff', 0.55); b.scale.set(70, 70, 1); b.material.rotation = r; group.add(b); extra.push(b); } }
      if (d.stype === 'magnetar') { const b = this.sprite('glow', '#7a4dff', 0.4); b.scale.setScalar(40); group.add(b); extra.push(b); }
      if (d.stype === 'triple') { for (const [c, o] of [['#ff6a4a', [5, 0.5, 3]], ['#eaf4ff', [-4, -0.5, 4]]] as [string, [number, number, number]][]) { const x = this.sprite('glow', c, 0.95); x.scale.setScalar(3.6); x.position.set(o[0], o[1], o[2]); group.add(x); }
        const neb = this.sprite('soft', '#59ff9a', 0.12); neb.scale.setScalar(55); const neb2 = this.sprite('soft', '#ff4a5a', 0.08); neb2.scale.setScalar(40); neb2.position.set(8, 0, 6); group.add(neb, neb2); }
      if (d.stype === 'binary') { const x = this.sprite('glow', '#ff6a4a', 0.95); x.scale.setScalar(3.4); x.position.set(5.5, 0.6, -3); group.add(x); extra.push(x); }
      if (d.name === 'Ozgrund') { const dust = this.sprite('soft', '#8a5a3a', 0.25); dust.scale.setScalar(36); group.add(dust); }
      this.scene.add(group);
      const fc = this.data.factions[d.owner]?.color ?? '#888';
      const tm = new THREE.MeshBasicMaterial({ map: this.tex.soft, color: new THREE.Color(fc), transparent: true, opacity: d.owner === 'dm' ? 0 : 0.13, depthWrite: false, blending: THREE.AdditiveBlending });
      const terr = new THREE.Mesh(terrGeo, tm); terr.position.set(d.x, -0.4, d.z); terr.scale.setScalar(d.owner === 'east' || d.owner === 'north' ? 0.8 : 1); this.scene.add(terr);
      stalkV.push(d.x, d.y, d.z, d.x, 0, d.z);
      for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283, b = ((i + 1) / 24) * 6.283; ringV.push(d.x + Math.cos(a) * 2.2, 0, d.z + Math.sin(a) * 2.2, d.x + Math.cos(b) * 2.2, 0, d.z + Math.sin(b) * 2.2); }
      const label = document.createElement('div'); label.className = 'sm-lbl' + (known ? '' : ' unk') + (d.owner === 'dm' ? ' dm' : '');
      label.innerHTML = `<b>${known ? d.name : 'Bilinmeyen sinyal'}</b><i class="ev"></i>`; label.style.setProperty('--fc', fc);
      this.overlay.appendChild(label);
      const haloOp = d.stype === 'blackhole' ? 0.1 : d.owner === 'dm' || d.stype === 'unknown' ? 0.12 : 0.35, coreOp = d.stype === 'blackhole' ? 0.45 : 1;
      this.sys.set(d.id, { d, pos, group, core, halo, haloOp, coreOp, extra, terr, label, known, dim: 1 });
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(stalkV, 3));
    this.scene.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.28, depthWrite: false })));
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(ringV, 3));
    this.scene.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.35, depthWrite: false })));
  }
  private buildLanes() {
    const MODE: Record<string, number> = { open: 0, closed: 1, danger: 2, collapsed: 3, rumor: 4 };
    for (const d of this.data.lanes) {
      const A = this.sys.get(d.a)!.pos, B = this.sys.get(d.b)!.pos, dir = B.clone().sub(A), len = dir.length(); dir.normalize();
      const w = d.status === 'open' ? 2.4 : 1.8, N = 24;
      const pos: number[] = [], u: number[] = [], vv: number[] = [], dd: number[] = [], idx: number[] = [];
      for (let i = 0; i <= N; i++) { const t = i / N, c = A.clone().lerp(B, t);
        for (const side of [-1, 1]) { pos.push(c.x, c.y, c.z); dd.push(dir.x, dir.y, dir.z); u.push(t * len); vv.push(side); } }
      for (let i = 0; i < N; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aDir', new THREE.Float32BufferAttribute(dd, 3));
      g.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1)); g.setAttribute('aV', new THREE.Float32BufferAttribute(vv, 1)); g.setIndex(idx);
      const col = d.status === 'danger' ? '#ff3355' : d.status === 'rumor' ? '#b06bff' : d.status === 'collapsed' ? '#8892a6' : d.status === 'closed' ? '#8892a6' : LANE_COLOR[d.kind] ?? '#9fe8ff';
      const mat = new THREE.ShaderMaterial({ vertexShader: LANE_VS, fragmentShader: LANE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(col) }, uTime: { value: 0 }, uOp: { value: 1 }, uMode: { value: MODE[d.status] ?? 0 }, uLen: { value: len }, uRes: { value: new THREE.Vector2(1, 1) }, uW: { value: w } } });
      const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; this.scene.add(mesh);
      this.lanes.push({ d, mesh, mat, mid: A.clone().lerp(B, 0.5) });
    }
  }
  setQuality(q: Quality) {
    this.quality = q; const c = Q[q];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, c.dpr));
    this.composer?.dispose(); this.bloom?.dispose(); this.composer = null; this.bloom = null;
    if (c.bloom) {
      this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
      const sz = new THREE.Vector2(this.host.clientWidth, this.host.clientHeight);
      this.bloom = new UnrealBloomPass(q === 'high' ? sz : sz.clone().multiplyScalar(0.5), 0.85, 0.55, 0.12); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    }
    this.resize();
  }
  /** Bölge filtresi ve görünür katmanlar */
  setFilter(hiddenOwners: Set<string>) {
    for (const o of this.sys.values()) { o.dim = hiddenOwners.has(o.d.owner) ? 0.12 : 1; }
    for (const l of this.lanes) l.mat.uniforms.uOp.value = Math.min(this.sys.get(l.d.a)!.dim, this.sys.get(l.d.b)!.dim);
  }
  setLayers(labels: boolean, lanes: boolean, terr: boolean) {
    this.showLabels = labels; this.showLanes = lanes; this.showTerr = terr;
    for (const l of this.lanes) l.mesh.visible = lanes; for (const o of this.sys.values()) o.terr.visible = terr;
  }
  /** Olay işaretleri: sistem → en yüksek seviye; hat → seviye */
  setEvents(sysSev: Map<string, number>, laneSev: Map<string, number>, colors: Record<string, { color: string }>) {
    for (const o of this.sys.values()) { const s = sysSev.get(o.d.id), ev = o.label.querySelector('.ev') as HTMLElement;
      ev.style.display = s ? 'inline-block' : 'none'; if (s) { ev.style.setProperty('--sv', colors[s].color); ev.dataset.s = String(s); } }
    for (const l of this.lanes) { const s = laneSev.get(l.d.id);
      if (s && !l.label) { l.label = document.createElement('div'); l.label.className = 'sm-lev'; this.overlay.appendChild(l.label); }
      if (l.label) { l.label.style.display = s ? 'block' : 'none'; if (s) l.label.style.setProperty('--sv', colors[s].color); } }
  }
  flyTo(id: string, dist = 85, dur = 1400) {
    const o = this.sys.get(id); if (!o) return;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    if (dir.y < 0.35) { dir.y = 0.45; dir.normalize(); }
    this.fly = { t0: performance.now(), dur, fromT: this.controls.target.clone(), toT: o.pos.clone(), fromP: this.camera.position.clone(), toP: o.pos.clone().addScaledVector(dir, dist) };
  }
  /** Sistemden dönüşte: kamerayı sistemin dibine koy (ters geçişin başlangıcı). */
  placeNear(id: string, dist = 10) { const o = this.sys.get(id); if (!o) return; const dir = new THREE.Vector3(0, 0.45, 0.9).normalize(); this.controls.target.copy(o.pos); this.camera.position.copy(o.pos).addScaledVector(dir, dist); this.fly = null; }
  overview() { this.fly = { t0: performance.now(), dur: 1400, fromT: this.controls.target.clone(), toT: new THREE.Vector3(0, 0, 20), fromP: this.camera.position.clone(), toP: new THREE.Vector3(0, 250, 330) }; }
  select(id: string | null) { this.selected = id; this.hooks.select(id); }
  private pick(cx: number, cy: number) {
    const r = this.renderer.domElement.getBoundingClientRect(); let best: string | null = null, bd = 24;
    for (const o of this.sys.values()) { if (o.dim < 0.5) continue; this.v.copy(o.pos).project(this.camera); if (this.v.z > 1) continue;
      const x = (this.v.x * 0.5 + 0.5) * r.width + r.left, y = (-this.v.y * 0.5 + 0.5) * r.height + r.top, d = Math.hypot(x - cx, y - cy); if (d < bd) { bd = d; best = o.d.id; } }
    return best;
  }
  private onMove = (e: PointerEvent) => { const id = e.buttons ? null : this.pick(e.clientX, e.clientY); if (id !== this.hovered) { this.hovered = id; this.hooks.hover(id); this.renderer.domElement.style.cursor = id ? 'pointer' : ''; } };
  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY }; this.fly = null; };
  private onUp = (e: PointerEvent) => { if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) return; const id = this.pick(e.clientX, e.clientY); if (id) { this.select(id); this.flyTo(id); } };
  private resize = () => {
    const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h); this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    for (const m of this.pointMats) m.uniforms.uPR.value = this.renderer.getPixelRatio();
    const pr = this.renderer.getPixelRatio(); for (const l of this.lanes) { l.mat.uniforms.uRes.value.set(w * pr, h * pr); l.mat.uniforms.uW.value = (l.d.status === 'open' ? 2.4 : 1.8) * pr; }
  };
  private onVis = () => { if (document.hidden) this.stop(); else this.start(); };
  start() { if (this.running) return; this.running = true; this.clock.getDelta(); this.raf = requestAnimationFrame(this.frame); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  private frame = () => {
    if (!this.running) return; this.raf = requestAnimationFrame(this.frame);
    const t = this.clock.getElapsedTime();
    if (this.fly) { const k = Math.min(1, (performance.now() - this.fly.t0) / this.fly.dur), e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      this.controls.target.lerpVectors(this.fly.fromT, this.fly.toT, e); this.camera.position.lerpVectors(this.fly.fromP, this.fly.toP, e); if (k >= 1) this.fly = null; }
    this.controls.update();
    for (const m of this.pointMats) m.uniforms.uTime.value = t;
    for (const l of this.lanes) l.mat.uniforms.uTime.value = t;
    for (const o of this.sys.values()) {
      const st = o.d.stype, pulse = st === 'redgiant' ? 1 + Math.sin(t * 0.7) * 0.06 : st === 'magnetar' ? 1 + Math.sin(t * 9) * 0.05 * Math.sin(t * 2.3) : 1 + Math.sin(t * 1.3 + o.pos.x) * 0.03;
      const hl = o.d.id === this.hovered || o.d.id === this.selected ? 1.25 : 1;
      o.group.scale.setScalar(pulse * hl); o.core.material.opacity = o.coreOp * o.dim; o.halo.material.opacity = o.haloOp * o.dim;
      (o.terr.material as THREE.MeshBasicMaterial).opacity = (o.d.owner === 'dm' ? 0 : 0.13) * o.dim;
      if (st === 'pulsar') o.extra.forEach((b, i) => ((b as THREE.Sprite).material.rotation = t * 2.2 + i * Math.PI / 2));
      if (st === 'blackhole') ((o.extra[0] as THREE.Sprite).material.rotation = t * 0.25);
      if (st === 'magnetar') ((o.extra[0] as THREE.Sprite).material as THREE.SpriteMaterial).opacity = (0.25 + 0.2 * Math.abs(Math.sin(t * 3.1))) * o.dim;
    }
    const ret = (sp: THREE.Sprite, id: string | null, s: number) => { const o = id ? this.sys.get(id) : null; sp.visible = !!o; if (o) { sp.position.copy(o.pos); const d = this.camera.position.distanceTo(o.pos); sp.scale.setScalar(Math.max(8, d * 0.06) * s); sp.material.rotation = t * 0.6 * s; } };
    ret(this.reticle, this.selected, 1); ret(this.hovRet, this.hovered !== this.selected ? this.hovered : null, 0.8);
    // etiketler
    const w = this.host.clientWidth, h = this.host.clientHeight;
    for (const o of this.sys.values()) {
      this.v.copy(o.pos).project(this.camera); const d = this.camera.position.distanceTo(o.pos), focus = o.d.id === this.hovered || o.d.id === this.selected;
      let a = focus ? 1 : Math.max(0, Math.min(1, (720 - d) / 380)) * o.dim; if (!this.showLabels && !focus) a = 0; if (this.v.z > 1) a = 0;
      o.label.style.opacity = String(a); o.label.style.visibility = a < 0.02 ? 'hidden' : 'visible';
      if (a >= 0.02) o.label.style.transform = `translate3d(${(this.v.x * 0.5 + 0.5) * w}px,${(-this.v.y * 0.5 + 0.5) * h}px,0)`;
      o.label.classList.toggle('focus', focus);
    }
    for (const l of this.lanes) if (l.label && l.label.style.display !== 'none') {
      this.v.copy(l.mid).project(this.camera); l.label.style.visibility = this.v.z > 1 || !this.showLanes ? 'hidden' : 'visible';
      l.label.style.transform = `translate3d(${(this.v.x * 0.5 + 0.5) * w}px,${(-this.v.y * 0.5 + 0.5) * h}px,0)`;
    }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  };
  sysScreen(id: string) { const o = this.sys.get(id); if (!o) return null; this.v.copy(o.pos).project(this.camera); return { x: (this.v.x * 0.5 + 0.5) * this.host.clientWidth, y: (-this.v.y * 0.5 + 0.5) * this.host.clientHeight }; }
  dispose() {
    this.stop(); const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onMove); el.removeEventListener('pointerdown', this.onDown); el.removeEventListener('pointerup', this.onUp);
    removeEventListener('resize', this.resize); document.removeEventListener('visibilitychange', this.onVis);
    this.controls.dispose();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose(); });
    Object.values(this.tex).forEach((t) => t.dispose()); this.composer?.dispose(); this.bloom?.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); el.remove(); this.overlay.innerHTML = '';
  }
}
