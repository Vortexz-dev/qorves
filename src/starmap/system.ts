/*
 * Qorves sistem görünümü (three.js). Tek sahne: yıldız + Kodeks'teki gök cisimleri. Yalnız açık ve görünürken çizer, kapanınca her şeyi bırakır.
 * Cisim listesi kb'den gelir (anahtar süzgecinden geçmiş); burada yeni cisim uydurulmaz. Sayısı verilen adsız uydu grupları yalnız nokta olarak çizilir.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { Body } from '../lib/kb.svelte';
import type { SysData, Quality } from './scene';
import { glowTex, softTex, nebulaTex, reticleTex } from './textures';
import { lookOf } from './looks';
import { STAR_VS, STAR_FS, CORONA_VS, CORONA_FS, PLANET_VS, PLANET_FS, RING_VS, RING_FS, DISK_FS, LENS_FS, BEAM_VS, BEAM_FS, FLOW_VS, FLOW_FS, WORM_FS } from './shaders';

export interface SysHooks { hover: (id: string | null) => void; select: (id: string | null) => void }
/** Hat geçidi: kümedeki gerçek yöne göre sistemin kıyısında (lore'da AB verilen geçitlerde o uzaklıkta). */
export interface LaneGate { id: string; name: string; ang: number; status: string; color: string; canon?: string; au?: number; host?: 'B' }
export interface SysOpts { intro?: boolean; gates?: LaneGate[] }
// Kalite: piksel oranı, kenar yumuşatma, bloom, gürültü oktavı (yüzey ayrıntısı + yüksekte kabartı), küre parçalılığı, yıldız/kaya sayısı
const Q = { low: { dpr: 0.8, aa: false, oct: 3, stars: 3000, rocks: 0.3, bloom: false, seg: 32 }, med: { dpr: 1.25, aa: true, oct: 5, stars: 9000, rocks: 0.7, bloom: true, seg: 64 }, high: { dpr: 2, aa: true, oct: 6, stars: 18000, rocks: 1.2, bloom: true, seg: 128 } };
interface StarDef { r: number; c: string; hot: string; scale: number; contrast: number; spots: number; corona: number; rays: number; flare: number }
const SD = (r: number, c: string, hot: string, o: Partial<StarDef> = {}): StarDef => ({ r, c, hot, scale: 3.2, contrast: 0.85, spots: 0.25, corona: 4.2, rays: 0.8, flare: 0.8, ...o });
export const STARS: Record<string, StarDef> = {
  G: SD(5, '#ffb347', '#fff3cf'), K: SD(4.4, '#ff8a3a', '#ffd49a', { spots: 0.35 }), M: SD(3.4, '#ff4a1e', '#ffa064', { spots: 0.45, flare: 1.4 }),
  F: SD(5.6, '#ffe4a8', '#ffffff'), A: SD(6.4, '#8fb2ff', '#f2f6ff', { spots: 0, rays: 1.1 }),
  redgiant: SD(24, '#ff3a10', '#ff9a50', { scale: 1.5, contrast: 0.55, spots: 0.15, corona: 2.6, rays: 0.4, flare: 0.3 }),
  whitedwarf: SD(1.1, '#bcd8ff', '#ffffff', { scale: 5, contrast: 0.25, spots: 0, corona: 12, rays: 1.4, flare: 0 }),
  pulsar: SD(0.8, '#8fd0ff', '#ffffff', { contrast: 0.2, spots: 0, corona: 10, rays: 1.6, flare: 0 }),
  magnetar: SD(1.2, '#b890ff', '#ffffff', { contrast: 0.4, spots: 0, corona: 9, rays: 1.2, flare: 0.6 }),
};
const STYPE_STAR: Record<string, string> = { triple: 'K', binary: 'F', blackhole: 'K', unknown: 'G' };
type Kind = 'star' | 'star2' | 'planet' | 'moon' | 'belt' | 'swarm' | 'station' | 'gate' | 'singularity' | 'disk' | 'stream' | 'debris' | 'wormhole';
interface O {
  id: string; b: Body | null; kind: Kind; name: string; obj: THREE.Object3D; r: number; orbit: number; omega: number; phase: number; incl: number; parent: O | null;
  pos: THREE.Vector3; label: HTMLDivElement; line?: THREE.Line; dot?: THREE.Sprite; mat?: THREE.ShaderMaterial; spin: number; pick: boolean; extra?: (t: number) => void; l4?: O; oq?: THREE.Quaternion;
}
const h = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0) / 4294967295; };
const gnum = (s?: string) => { const m = (s ?? '').replace(',', '.').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 1; };
const C = (x: string) => new THREE.Color(x);
const c1Of = (m: THREE.ShaderMaterial) => (m.uniforms.uC1.value as THREE.Color).clone().lerp(new THREE.Color('#ffffff'), 0.45);
export class SystemScene {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera; controls: OrbitControls;
  composer: EffectComposer | null = null; bloom: UnrealBloomPass | null = null; bloomBase = 0.7; bloomThr = 0.62; quality: Quality;
  objs: O[] = []; byId = new Map<string, O>(); private canonGates: { b: Body; base: object }[] = []; edge = 0; hovered: string | null = null; selected: string | null = null;
  showLabels = true; showOrbits = true; moving = true; extent = 120;
  private tex: Record<string, THREE.Texture> = {}; private star!: O; private starDef: StarDef; private timeMats: THREE.ShaderMaterial[] = [];
  private raf = 0; private clock = new THREE.Clock(); private running = false; private t = 0; private v = new THREE.Vector3(); private down = { x: 0, y: 0 };
  private fly: { t0: number; dur: number; fromT: THREE.Vector3; fromP: THREE.Vector3; o: O | null; offT: THREE.Vector3; offP: THREE.Vector3; done?: () => void } | null = null;
  private follow: O | null = null; private lastFollow = new THREE.Vector3(); private reticle: THREE.Sprite; private snapReq: { id: string; res: (u: string[]) => void } | null = null; private snapping = false;
  constructor(private host: HTMLElement, private overlay: HTMLElement, private sys: SysData, bodies: Body[], private hooks: SysHooks, quality: Quality, private opts: SysOpts = {}) {
    this.quality = quality; if (location.search.includes('qc=1')) (globalThis as any).__qcS = this; // QC_HOOK
    this.renderer = new THREE.WebGLRenderer({ antialias: Q[quality].aa, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x010207, 1); this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 9000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.07, minDistance: 1.2, maxDistance: 1400, rotateSpeed: 0.55, zoomSpeed: 1.0, panSpeed: 0.8, screenSpacePanning: false });
    for (const [k, f] of Object.entries({ glow: glowTex, soft: softTex, ret: reticleTex })) this.tex[k] = f();
    this.starDef = STARS[sys.stype] ?? STARS[STYPE_STAR[sys.stype] ?? 'G'];
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.05));
    const pl = new THREE.PointLight(C(this.starDef.c).lerp(C('#ffffff'), 0.6), 2.4, 0, 0); this.scene.add(pl);
    this.buildBackground(); this.buildStar(); this.buildBodies(bodies); this.buildLaneGates(opts.gates ?? []);
    this.reticle = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.ret, color: C('#fcee0a').multiplyScalar(0.55), transparent: true, opacity: 0.7, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    this.reticle.visible = false; this.reticle.renderOrder = 9; this.scene.add(this.reticle);
    this.setQuality(quality);
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onMove); el.addEventListener('pointerdown', this.onDown); el.addEventListener('pointerup', this.onUp);
    addEventListener('resize', this.resize); document.addEventListener('visibilitychange', this.onVis);
    this.resize(); this.update(0);
    // giriş: uzaktan içeri süzülme
    const ov = this.overviewPose();
    if (opts.intro === false) { this.camera.position.copy(ov.p); this.controls.target.copy(ov.t); }
    else { this.camera.position.copy(ov.p.clone().multiplyScalar(7).add(new THREE.Vector3(0, ov.p.length() * 2, 0))); this.controls.target.copy(ov.t); this.flyPose(ov.t, ov.p, 2600, null); }
    this.start();
  }
  private SM(p: THREE.ShaderMaterialParameters) { return new THREE.ShaderMaterial({ ...p, defines: { OCT: Q[this.quality].oct } }); }
  // ---------- ölçek ----------
  private R(au: number) { return this.starDef.r * 1.6 + 3 + 30 * Math.log(1 + au / 0.04); }
  private overviewPose() { const d = Math.max(60, this.extent * 1.55); return { t: new THREE.Vector3(0, 0, 0), p: new THREE.Vector3(0, d * 0.55, d) }; }
  // ---------- arka plan ----------
  private buildBackground() {
    const n = Q[this.quality].stars, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    const tint = ['#9bb7ff', '#dfe8ff', '#fff2d6', '#ffc98f', '#ff9b72'];
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, r = 2500 + Math.random() * 2500, k = Math.sqrt(1 - u * u);
      p.set([r * k * Math.cos(th), r * u, r * k * Math.sin(th)], i * 3); const col = C(tint[Math.floor(Math.random() ** 1.5 * 5)]).multiplyScalar(0.25 + Math.random() ** 2 * 0.9); c.set([col.r, col.g, col.b], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.PointsMaterial({ size: 9, map: this.tex.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; this.scene.add(pts);
    const neb: [string, number][] = this.sys.name === 'Morwen' ? [['#2aff8a', 0.32], ['#ff3a4a', 0.26], ['#2aff8a', 0.2], ['#ff6a3a', 0.18]] : this.sys.name === 'Ozgrund' ? [['#8a4a2a', 0.38], ['#5a3a2a', 0.3], ['#6a3a20', 0.25]]
      : this.sys.name === 'Cellax' ? [['#ff6a2a', 0.12], ['#3a2aff', 0.1]] : [['#4a2cff', 0.12], ['#00a8c4', 0.1], ['#ff2a8a', 0.08]];
    neb.forEach(([col, op], i) => { const t = nebulaTex(Math.floor(h(this.sys.name + i) * 9999)); this.tex['n' + i] = t;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: C(col), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
      const a = h(this.sys.name + 'a' + i) * 6.283; sp.position.set(Math.cos(a) * 1800, (h(this.sys.name + 'y' + i) - 0.5) * 1400, Math.sin(a) * 1800); sp.scale.setScalar(2200 + h(col) * 1600); this.scene.add(sp); });
    if (this.sys.name === 'Ozgrund' || this.sys.name === 'Morwen') { // sistem içi toz / bulutsu
      const t = nebulaTex(77); this.tex.dust = t;
      for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: C(this.sys.name === 'Ozgrund' ? '#7a4a2a' : i % 2 ? '#30ff90' : '#ff4a5a'), transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }));
        const a = i * 1.1; sp.position.set(Math.cos(a) * 60, (i - 3) * 6, Math.sin(a) * 60); sp.scale.setScalar(260 + i * 30); this.scene.add(sp); }
    }
    // yönlendirme ızgarası
    const v: number[] = []; for (let r = 25; r <= 400; r += 25) for (let i = 0; i < 96; i++) { const a = (i / 96) * 6.283, b = ((i + 1) / 96) * 6.283; v.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(b) * r, 0, Math.sin(b) * r); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283; v.push(Math.cos(a) * 12, 0, Math.sin(a) * 12, Math.cos(a) * 400, 0, Math.sin(a) * 400); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    const grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.035, depthWrite: false })); grid.position.y = -0.05; grid.name = 'grid'; this.scene.add(grid);
  }
  // ---------- yıldız ----------
  private starMesh(def: StarDef, r: number) {
    const g = new THREE.Group(); const seg = Q[this.quality].seg;
    const mat = this.SM({ vertexShader: STAR_VS, fragmentShader: STAR_FS, uniforms: { uColor: { value: C(def.c) }, uHot: { value: C(def.hot) }, uTime: { value: 0 }, uScale: { value: def.scale },
      uContrast: { value: def.contrast }, uSpots: { value: def.spots }, uInt: { value: def === STARS.redgiant ? 1.0 : 1.15 } } });
    this.timeMats.push(mat); const s = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), mat); g.add(s);
    const cm = this.SM({ vertexShader: CORONA_VS, fragmentShader: CORONA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: C(def.c).lerp(C(def.hot), 0.35) }, uTime: { value: 0 }, uR: { value: 1 / def.corona }, uRays: { value: def.rays }, uFlare: { value: def.flare }, uInt: { value: 1.1 } } });
    this.timeMats.push(cm); const cor = new THREE.Mesh(new THREE.PlaneGeometry(r * def.corona * 2, r * def.corona * 2), cm); cor.name = 'corona'; g.add(cor);
    const gop = def.r < 1.5 ? 0.6 : 0.3, glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: C(def.c), transparent: true, opacity: gop, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(r * (def.r < 1.5 ? 22 : 9)); g.add(glow);
    // yakında parıltı söner ki yüzey görünsün
    const i0 = mat.uniforms.uInt.value, fade = () => { const d = this.camera.position.distanceTo(g.position), k = Math.max(0.05, Math.min(1, (d - r * 5) / (r * 25))); glow.material.opacity = gop * k; mat.uniforms.uInt.value = i0 * (0.72 + 0.28 * k); };
    return { g, mat, cor, fade };
  }
  private buildStar() {
    const d = this.starDef, { g, cor, fade } = this.starMesh(d, d.r); this.scene.add(g);
    const st = this.sys.stype, extra: ((t: number) => void)[] = [];
    extra.push(() => { cor.quaternion.copy(this.camera.quaternion); fade(); });
    if (st === 'redgiant') extra.push((t) => g.scale.setScalar(1 + Math.sin(t * 2 * Math.PI / 7) * 0.035)); // 380 günlük nabız, hızlandırılmış
    if (st === 'pulsar') { // dönen ışın konileri, eğik eksen
      const axis = new THREE.Group(); axis.rotation.z = 0.5; g.add(axis);
      const bm = this.SM({ vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uC: { value: C('#bfe6ff') }, uTime: { value: 0 } } });
      this.timeMats.push(bm);
      for (const s of [1, -1]) { const cg = new THREE.ConeGeometry(9, 170, 32, 1, true); cg.translate(0, -85, 0); cg.rotateX(s > 0 ? Math.PI : 0); const c = new THREE.Mesh(cg, bm); c.rotation.x = 0.9; axis.add(c); }
      extra.push((t) => (axis.rotation.y = t * 1.6));
    }
    if (st === 'magnetar') { // dipol alan çizgileri
      const fg = new THREE.Group(); fg.rotation.z = 0.35; g.add(fg);
      const fm = this.SM({ vertexShader: FLOW_VS, fragmentShader: FLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: C('#b48cff') }, uTime: { value: 0 }, uSpeed: { value: 0.6 }, uOp: { value: 0.8 } } });
      this.timeMats.push(fm);
      for (const L of [6, 10, 16, 24, 34]) for (let k = 0; k < 8; k++) { const pts: number[] = [], tt: number[] = [], ph = (k / 8) * Math.PI * 2;
        for (let i = 0; i <= 80; i++) { const th = 0.12 + (i / 80) * (Math.PI - 0.24), r = L * Math.sin(th) ** 2; if (r < d.r) continue; pts.push(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)); tt.push(i / 80); }
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); lg.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1)); fg.add(new THREE.Line(lg, fm)); }
      extra.push((t) => { fg.rotation.y = t * 0.25; fm.uniforms.uOp.value = 0.55 + 0.35 * Math.abs(Math.sin(t * 3.1)); });
    }
    if (st === 'whitedwarf') { const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.soft, color: C('#9fc8ff'), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(60); g.add(halo); }
    const label = this.mkLabel(this.sys.stype === 'blackhole' ? 'Saren' : this.sys.name + (st === 'triple' || st === 'binary' ? ' A' : ''), 'star');
    this.star = { id: 'star', b: null, kind: 'star', name: this.sys.name, obj: g, r: d.r, orbit: 0, omega: 0, phase: 0, incl: 0, parent: null, pos: new THREE.Vector3(), label, spin: 0.02, pick: true, extra: (t) => extra.forEach((f) => f(t)) };
    this.add(this.star);
  }
  // ---------- cisimler ----------
  private add(o: O) { this.objs.push(o); this.byId.set(o.id, o); }
  private mkLabel(text: string, kind: string) { const l = document.createElement('div'); l.className = 'sb-lbl k-' + kind; l.innerHTML = `<b>${text}</b>`; this.overlay.appendChild(l); return l; }
  private orbitLine(r: number, color: string, op: number, incl = 0, dashed = false, oq?: THREE.Quaternion) {
    const pts: number[] = []; const n = 256; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push(Math.cos(a) * r, 0, Math.sin(a) * r); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = dashed ? new THREE.LineDashedMaterial({ color: C(color), transparent: true, opacity: op, depthWrite: false, dashSize: r * 0.02, gapSize: r * 0.025 }) : new THREE.LineBasicMaterial({ color: C(color), transparent: true, opacity: op, depthWrite: false });
    const l = new THREE.Line(g, m); if (oq) l.quaternion.copy(oq); else l.rotation.x = -incl; if (dashed) l.computeLineDistances(); this.scene.add(l); return l;
  }
  private planetMat(b: Body) {
    const L = lookOf(b), sd = h(b.id);
    const sc = C(this.starDef.c).lerp(C('#ffffff'), this.sys.stype === 'redgiant' ? 0.35 : 0.6);
    const dir = new THREE.Vector3(h(b.id + 'cx') - 0.5, (h(b.id + 'cy') - 0.5) * 0.9, h(b.id + 'cz') - 0.5).normalize();
    const mat = this.SM({ vertexShader: PLANET_VS, fragmentShader: PLANET_FS, uniforms: {
      uCls: { value: L.sh }, uC1: { value: L.c1 }, uC2: { value: L.c2 }, uC3: { value: L.c3 }, uC4: { value: L.c4 }, uP: { value: L.P }, uQ: { value: L.Q }, uAtm: { value: L.atm }, uAtmS: { value: L.atmS },
      uSeed: { value: sd * 50 }, uTime: { value: 0 }, uCity: { value: L.city }, uCityMode: { value: L.cityMode }, uCityDir: { value: dir }, uStar: { value: new THREE.Vector3() }, uStarCol: { value: sc }, uLit: { value: 1 } } });
    this.timeMats.push(mat); return { mat, L };
  }
  /** Uydu yörüngeleri: her cisim bir öncekinin dışında, aralarında boşlukla; böylece hiçbir eğiklikte iç içe geçmezler. */
  private slots = new Map<O, number>();
  private slot(host: O, r: number, gap = 0.55) {
    let cur = this.slots.get(host); if (cur === undefined) cur = host.r * (host.b?.ring || host.b?.cls === 'garden' ? 2.7 : 1.75) + 0.6;
    const orbit = cur + r; this.slots.set(host, orbit + r + gap); return orbit;
  }
  /** Uydu sistemi komşu gezegenin yörüngesine taşarsa sistemi (yörünge + boyut) birlikte küçült; uydular yine çakışmaz. */
  private fitMoons() {
    const kids = (h: O) => this.objs.filter((x) => x.parent === h && (x.kind === 'moon' || x.kind === 'swarm' || x.kind === 'station'));
    const base = (h: O) => h.r * (h.b?.ring || h.b?.cls === 'garden' ? 2.7 : 1.75) + 0.6;
    const ext = (h: O) => Math.max(h.r * (h.b?.ring ? 2.4 : 1), ...kids(h).map((x) => (x.kind === 'swarm' ? x.r + 0.4 : x.orbit + x.r)));
    const shrink = (h: O, f: number) => { const b0 = base(h);
      for (const x of kids(h)) {
        if (x.kind === 'swarm') { const rs = (x as O & { rs: { r: number; s: number }[] }).rs; for (const m of rs) { m.r = b0 + (m.r - b0) * f; m.s *= f; } x.r = Math.max(...rs.map((m) => m.r)); continue; }
        const o0 = x.orbit; x.orbit = b0 + (x.orbit - b0) * f; x.r *= f; x.obj.scale.multiplyScalar(f); if (x.line) x.line.scale.multiplyScalar(x.orbit / o0);
        if (x.kind === 'moon') x.omega = Math.sign(x.omega || 1) * this.moonOmega(h, x.orbit);
      } };
    const pl = this.objs.filter((o) => o.kind === 'planet' && o.parent === this.star).sort((a, b) => a.orbit - b.orbit);
    for (let it = 0; it < 12; it++) { let hit = false;
      for (let i = 0; i + 1 < pl.length; i++) { const a = pl[i], b = pl[i + 1], room = (b.orbit - a.orbit) * 0.94, ea = ext(a), eb = ext(b);
        if (ea + eb <= room) continue; hit = true; shrink(ea - a.r >= eb - b.r ? a : b, 0.85); }
      if (!hit) break; }
    // küçültme yetmezse (iki halkalı dev çok yakın): dıştaki gezegeni görsel ölçekte biraz dışarı it
    for (let i = 0; i + 1 < pl.length; i++) { const a = pl[i], b = pl[i + 1], need = (ext(a) + ext(b)) / 0.94 - (b.orbit - a.orbit);
      if (need > 0) { const o0 = b.orbit; b.orbit += need; if (b.line) b.line.scale.multiplyScalar(b.orbit / o0); } }
  }
  private moonOmega(host: O, orbit: number) { return Math.min(0.5, Math.max(0.01, 0.32 * Math.pow(orbit / Math.max(host.r, 0.5), -1.5) * 2.2)); }
  private moonletGeo() { // çukurlu, düzensiz küçük uydu
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + (h('m' + Math.round(v.x * 7) + ',' + Math.round(v.y * 7) + ',' + Math.round(v.z * 7)) - 0.5) * 0.35; v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g;
  }
  private bodySize(b: Body, moon: boolean) { return this.bodySize0(b, moon) * 1.7; }
  private bodySize0(b: Body, moon: boolean) {
    const g = gnum(b.grav), c = b.cls;
    if (moon) return Math.min(1.0, 0.38 + g * 1.6) * (b.name === 'Ostrav' || b.name === 'Paludra' || b.name === 'Skalv' ? 1.6 : 1);
    if (c === 'gas') return 3.2 + Math.min(g, 3.2) * 0.55; if (c === 'icegiant' || c === 'stripped') return 2.6;
    if (['terran', 'ocean', 'desert', 'savanna', 'karst', 'jungle', 'snow', 'smog', 'locked', 'volcanic', 'garden', 'venus'].includes(c)) return 1.25 * Math.pow(Math.max(g, 0.4), 0.45);
    return Math.max(0.55, 0.95 * Math.pow(Math.max(g, 0.2), 0.5));
  }
  private buildBodies(list: Body[]) {
    const seg = Q[this.quality].seg, ids = new Set(list.map((b) => b.id));
    // ikinci / üçüncü yıldızlar
    const comp: O[] = [];
    if (this.sys.stype === 'binary' || this.sys.stype === 'triple') {
      const defs: [string, number, StarDef][] = this.sys.stype === 'binary' ? [['Gwathren', 38, SD(1.6, '#ff4a1e', '#ffa064', { spots: 0.5, flare: 1.6, corona: 5 })]]
        : [['Morwen B', 38, SD(1.7, '#ff4a1e', '#ffa064', { spots: 0.4, flare: 1.2, corona: 5 })], ['Morwen C', 900, SD(0.7, '#cfe4ff', '#ffffff', { contrast: 0.2, spots: 0, corona: 14, rays: 1.5, flare: 0 })]];
      for (const [nm, au, def] of defs) { const { g, cor, fade } = this.starMesh(def, def.r); this.scene.add(g);
        const lg = (this.opts.gates ?? []).find((x) => x.host === 'B'); const o: O = { id: 'star-' + nm, b: null, kind: 'star2', name: nm, obj: g, r: def.r, orbit: this.R(au), omega: nm === 'Morwen B' && lg ? 0 : 0.00015, phase: nm === 'Morwen B' && lg ? -lg.ang : h(nm) * 6.28, incl: 0.02, parent: this.star, pos: new THREE.Vector3(), label: this.mkLabel(nm, 'star'), spin: 0.01, pick: true, extra: () => { cor.quaternion.copy(this.camera.quaternion); fade(); } };
        o.line = this.orbitLine(o.orbit, '#ff8a5a', 0.12, o.incl, true); this.add(o); comp.push(o); }
    }
    const last = new Map<string, O>();
    for (const b of list) {
      if (b.parent && !ids.has(b.parent)) continue;
      const parentO = b.star === 'B' ? comp[0] : b.parent ? this.byId.get(b.parent) ?? null : null;
      if (b.parent && !parentO) continue;
      const host = parentO ?? this.star; const au = b.au ?? 0; const sd = h(b.id);
      const localR = (x: number) => (host === this.star ? this.R(x) : host.kind === 'star2' ? host.r * 2 + 3 + 9 * Math.log(1 + x / 0.05) : 0);
      const base = { id: b.id, b, name: b.name, phase: sd * 6.283, incl: (sd - 0.5) * 0.05, pos: new THREE.Vector3(), spin: 0.05 + sd * 0.1, pick: true } as const;
      const omegaFor = (x: number) => Math.min(0.05, Math.max(0.0012, 0.035 * Math.pow(Math.max(x, 0.01), -1.5)));
      if (b.kind === 'planet' || b.kind === 'moon') {
        const moon = !!b.parent && host.kind !== 'star2'; const r = this.bodySize(b, moon); const { mat, L } = this.planetMat(b);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), mat); mesh.rotation.z = (sd - 0.5) * 0.5; this.scene.add(mesh);
        const orbit = moon ? this.slot(host, r) : localR(au);
        const o: O = { ...base, kind: moon ? 'moon' : 'planet', obj: mesh, r, orbit, omega: moon ? this.moonOmega(host, orbit) : omegaFor(au), parent: host, label: this.mkLabel(b.name, moon ? 'moon' : 'planet'), mat };
        if (moon) { o.incl = (sd - 0.5) * 0.35; o.oq = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.incl, h(b.id + 'n') * 6.283, 0, 'YXZ')); }
        else o.oq = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.incl, h(b.id + 'n') * 6.283, 0, 'YXZ'));
        void L;
        if (b.ring || b.cls === 'garden') { const ri = b.cls === 'garden' ? r * 1.5 : r * 1.4, ro = b.cls === 'garden' ? r * 1.62 : r * 2.4;
          const rm = this.SM({ vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: b.cls === 'garden' ? THREE.AdditiveBlending : THREE.NormalBlending,
            uniforms: { uC: { value: C(b.cls === 'garden' ? '#fff4d0' : '#d8c8a8') }, uIn: { value: ri }, uOut: { value: ro }, uSeed: { value: sd * 9 }, uCenter: { value: new THREE.Vector3() } } });
          const ring = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 128, 1), rm); ring.rotation.x = -Math.PI / 2 + 0.35; this.scene.add(ring);
          o.extra = () => { ring.position.copy(o.pos); rm.uniforms.uCenter.value.copy(o.pos); }; }
        const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: c1Of(mat), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false }));
        dot.scale.setScalar(moon ? 0.008 : 0.014); this.scene.add(dot); o.dot = dot;
        o.line = moon ? this.orbitLine(orbit, '#7fe6ff', 0.12, 0, false, o.oq) : this.orbitLine(orbit, '#7fe6ff', 0.2, 0, host.kind === 'star2', o.oq);
        this.add(o); last.set(b.id, o); continue;
      }
      if (b.kind === 'swarm' && parentO) { // sayısı verilen adsız uydular: her biri kendi yörünge kabuğunda, çarpışmasız
        const n = b.count ?? 6, geo = this.moonletGeo(), mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.02 });
        const im = new THREE.InstancedMesh(geo, mat, n); this.scene.add(im); const dummy = new THREE.Object3D(); const hostCls = host.b?.cls ?? '';
        // düzenli iç uydular küçük eğiklikte; dıştakiler düzensiz: büyük eğiklik, bir kısmı ters yönde (gerçek gaz devi uydu sistemleri gibi)
        const TYPES: [string, number][] = [['#d8e2ea', 0], ['#a8b2b6', 0], ['#8a8580', 0], ['#5a5650', 0], ['#3e3a36', 0], ['#d8c060', 0], ['#9a5a3a', 0], ['#c8d4dc', 0]];
        const rs = Array.from({ length: n }, (_, i) => {
          const s0 = 0.09 + h(b.id + 's' + i) ** 2 * 0.26, f = i / Math.max(1, n - 1), irr = f > 0.55;
          const orbit = this.slot(host, s0, irr ? 0.55 : 0.3);
          const incl = irr ? (h(b.id + 'i' + i) - 0.5) * 1.6 : (h(b.id + 'i' + i) - 0.5) * 0.12, node = h(b.id + 'o' + i) * 6.283;
          const retro = irr && h(b.id + 'r' + i) < 0.4 ? -1 : 1;
          const t = f < 0.15 && /gas/.test(hostCls) && h(b.id + 't' + i) < 0.5 ? 5 : f > 0.7 ? (h(b.id + 't' + i) < 0.6 ? 4 : 6) : Math.floor(h(b.id + 't' + i) * 4) + (f > 0.35 ? 1 : 0);
          const c = C(TYPES[t][0]).offsetHSL((h(b.id + 'h' + i) - 0.5) * 0.04, 0, (h(b.id + 'l' + i) - 0.5) * 0.12); im.setColorAt(i, c);
          return { r: orbit, s: s0, a: h(b.id + 'a' + i) * 6.283, w: retro * this.moonOmega(host, orbit), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(incl, node, 0, 'YXZ')), rot: new THREE.Euler(h(b.id + 'x' + i) * 6, h(b.id + 'y' + i) * 6, 0), sq: 0.7 + h(b.id + 'z' + i) * 0.3 };
        });
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        const outer = Math.max(...rs.map((x) => x.r));
        const o: O = { ...base, kind: 'swarm', obj: im, r: outer, orbit: 0, omega: 0, parent: host, label: this.mkLabel(b.name, 'swarm'), pick: false }; (o as O & { rs?: unknown }).rs = rs;
        const v = new THREE.Vector3();
        o.extra = (t) => { rs.forEach((x, i) => { const a = x.a + t * x.w; v.set(Math.cos(-a) * x.r, 0, Math.sin(-a) * x.r).applyQuaternion(x.q); dummy.position.copy(host.pos).add(v); dummy.rotation.copy(x.rot); dummy.rotation.z = t * 0.1; dummy.scale.set(x.s, x.s * x.sq, x.s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); }); im.instanceMatrix.needsUpdate = true; o.pos.copy(host.pos); };
        this.add(o); continue;
      }
      if (b.kind === 'belt') this.buildBelt(b, host, localR, base); 
      else if (b.kind === 'station') this.buildStation(b, parentO, localR, base, omegaFor, last);
      else if (b.kind === 'gate') { if ((this.opts.gates ?? []).some((g) => g.canon === b.id)) this.canonGates.push({ b, base }); else this.buildGates(b, localR, base); }
      else if (b.kind === 'singularity') this.buildSingularity(b, localR(au), base, omegaFor(au));
      else if (b.kind === 'disk') { /* Saelis tekillikle birlikte çizilir */ const s = this.byId.get(b.parent ?? ''); if (s) { const o: O = { ...base, kind: 'disk', obj: new THREE.Object3D(), r: 6, orbit: 0, omega: 0, parent: s, label: this.mkLabel(b.name, 'moon'), pick: true }; o.extra = () => o.pos.copy(s.pos).add(new THREE.Vector3(5, 0, 0)); this.add(o); } }
      else if (b.kind === 'stream') this.buildStream(b, base);
      else if (b.kind === 'debris') this.buildDebris(b, localR(au), base);
      else if (b.kind === 'wormhole') { const wm = this.SM({ vertexShader: CORONA_VS.replace('uv * 2.0 - 1.0', 'uv'), fragmentShader: WORM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 } } });
        this.timeMats.push(wm); const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), wm); this.scene.add(m);
        const o: O = { ...base, kind: 'wormhole', obj: m, r: 3, orbit: localR(au), omega: 0, parent: this.star, label: this.mkLabel(b.name, 'gate') }; o.extra = () => m.quaternion.copy(this.camera.quaternion); this.add(o); }
    }
    this.fitMoons();
    this.extent = Math.max(40, ...this.objs.filter((o) => (o.kind === 'planet' || o.kind === 'belt' || o.kind === 'singularity') && o.orbit < 280).map((o) => o.orbit + (o.b?.au2 ? 0 : o.r)));
  }
  private buildBelt(b: Body, host: O, localR: (x: number) => number, base: object) {
    const ring = b.cls === 'ring', far = (b.au ?? 0) >= 25 || /bulut|sürü/i.test(b.type);
    const r0 = ring ? host.r * 1.8 : localR(b.au ?? 1), r1 = ring ? host.r * 2.8 : b.au2 ? localR(b.au2) : r0 + 6;
    const dense = far ? 1 : 1.0, n = Math.floor((far ? 1800 : ring ? 900 : 2600) * Q[this.quality].rocks * dense);
    const grp = new THREE.Group(); this.scene.add(grp);
    if (far) { // kuyruklu yıldız bulutu: nokta kabuğu
      const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const r = r0 + Math.random() * (r1 - r0), a = Math.random() * 6.283, y = (Math.random() - 0.5) * (r1 - r0) * 0.7; p.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      grp.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fc8e8, size: 1.6, map: this.tex.soft, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
    } else {
      const hot = /kömür|sıcak|toz ve metal|Steinkrans|parçalanmış/i.test(b.type + b.name), metal = /metal|elmas|altın|Skarnit/i.test(b.type + (b.life ?? ''));
      const geo = new THREE.IcosahedronGeometry(1, 0), mat = new THREE.MeshStandardMaterial({ color: hot ? 0x5a3a2a : metal ? 0x8a8070 : 0x7a746c, roughness: 0.95, metalness: metal ? 0.4 : 0, emissive: hot ? 0x401808 : 0x000000 });
      const im = new THREE.InstancedMesh(geo, mat, n), d = new THREE.Object3D();
      for (let i = 0; i < n; i++) { const u = Math.random(), r = r0 + (r1 - r0) * (0.5 + (u - 0.5) * (0.6 + 0.4 * Math.random())), a = Math.random() * 6.283;
        d.position.set(Math.cos(a) * r, (Math.random() - 0.5) * (r1 - r0) * 0.08 + (Math.random() - 0.5) * 0.4, Math.sin(a) * r); d.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        const s = (0.04 + Math.random() ** 3 * 0.32) * (ring ? 0.5 : 1); d.scale.set(s, s * (0.6 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.4)); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
      grp.add(im);
      const dust = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 160, 1), new THREE.MeshBasicMaterial({ color: hot ? 0xff9a5a : 0x9fb8d0, transparent: true, opacity: hot ? 0.028 : 0.03, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      dust.rotation.x = -Math.PI / 2; grp.add(dust);
    }
    if (ring) grp.rotation.x = 0.35;
    const o: O = { ...(base as O), kind: 'belt', obj: grp, r: (r1 - r0) / 2, orbit: (r0 + r1) / 2, omega: 0, parent: host, label: this.mkLabel(b.name, 'belt') };
    const w = far ? 0.0008 : 0.004;
    o.extra = (t) => { grp.rotation.y = t * w; grp.position.copy(host.pos); const a = h(b.id) * 6.283 + t * w; o.pos.set(host.pos.x + Math.cos(-a) * o.orbit, host.pos.y, host.pos.z + Math.sin(-a) * o.orbit); };
    this.add(o);
  }
  private stationMesh(scale: number, ring: boolean, color = '#00f0ff') {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x8a96a4, metalness: 0.7, roughness: 0.35, emissive: C(color), emissiveIntensity: 0.12 });
    if (ring) { const t = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 10, 96), m); t.rotation.x = Math.PI / 2; g.add(t);
      for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2, 6), m); sp.rotation.z = Math.PI / 2; sp.rotation.y = (i * Math.PI) / 4; g.add(sp); } }
    else { g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.2, 12), m)); const t = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 48), m); t.rotation.x = Math.PI / 2; g.add(t);
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.35), m); g.add(p); }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: C(color), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(ring ? 1.2 : 2.2); g.add(gl);
    g.scale.setScalar(scale); this.scene.add(g); return g;
  }
  private buildStation(b: Body, parentO: O | null, localR: (x: number) => number, base: object, omegaFor: (x: number) => number, last: Map<string, O>) {
    const ringy = /halka/i.test(b.name + b.type) || b.name === 'Ceres';
    if (parentO && parentO.kind !== 'star2') { // gezegen yörüngesinde halka istasyon
      const g = this.stationMesh(ringy ? parentO.r * 1.55 : 0.5, ringy); if (ringy) g.rotation.z = 0.15;
      const orb = ringy ? 0 : this.slot(parentO, 0.6);
      const o: O = { ...(base as O), kind: 'station', obj: g, r: ringy ? parentO.r * 1.6 : 0.5, orbit: orb, omega: ringy ? 0 : this.moonOmega(parentO, orb), parent: parentO, label: this.mkLabel(b.name, 'station') };
      if (ringy) o.extra = (t) => { g.position.copy(parentO.pos); g.rotation.y = t * 0.05; o.pos.copy(parentO.pos).add(new THREE.Vector3(o.r, 0, 0)); };
      else o.line = this.orbitLine(o.orbit, '#7fe6ff', 0.12);
      this.add(o); return;
    }
    const l4 = b.l4 ? this.byId.get(b.l4) : undefined;
    const au = b.au ?? 1, g = this.stationMesh(ringy ? 1.4 : 0.9, ringy || /Velaith|Ferraria/.test(b.name), /Catena/.test(b.name) ? '#ff9a3a' : '#00f0ff');
    const o: O = { ...(base as O), kind: 'station', obj: g, r: 1, orbit: l4 ? l4.orbit : localR(au), omega: l4 ? l4.omega : omegaFor(au), parent: this.star, label: this.mkLabel(b.name, 'station'), l4 };
    if (l4) o.phase = l4.phase + Math.PI / 3; else o.line = this.orbitLine(o.orbit, '#7fe6ff', 0.1, o.incl, true);
    if (/geçit/i.test(b.name) && !(this.opts.gates ?? []).some((g) => g.canon === b.id)) { // Nimloth İstasyonu ve iki geçit (hat geçidi yoksa)
      for (let i = 0; i < 2; i++) { const gt = this.gateMesh('#8fd8ff', true); this.scene.add(gt); const ang = 0.3 + i * 0.3; const prev = o.extra; o.extra = (t) => { prev?.(t); gt.position.set(Math.cos(-(o.phase + ang)) * o.orbit, 0, Math.sin(-(o.phase + ang)) * o.orbit); gt.lookAt(0, 0, 0); }; }
    }
    this.add(o); last.set(b.id, o);
  }
  private gateMesh(color: string, whole: boolean) {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x9aa6b4, metalness: 0.8, roughness: 0.3, emissive: C(color), emissiveIntensity: 0.25 });
    g.add(new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 10, 64, whole ? Math.PI * 2 : Math.PI * 1.25), m));
    if (whole) { const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 48), new THREE.MeshBasicMaterial({ color: C(color), transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); g.add(disc); }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: C(color), transparent: true, opacity: whole ? 0.4 : 0.15, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(5); g.add(gl);
    return g;
  }
  private buildGates(b: Body, localR: (x: number) => number, base: object) {
    const n = /Beş/.test(b.name) ? 5 : /geçitleri|İki geçit/i.test(b.name + b.type) ? 2 : 1;
    const broken = /Yıkılmış|enkaz/i.test(b.type + b.name), sealed = /Mühürlü/i.test(b.type), kara = /Kara Hat/i.test(b.type);
    const color = broken ? '#8892a6' : sealed ? '#ff4a5a' : kara ? '#ff3355' : '#8fd8ff';
    const host = b.star === 'B' ? this.byId.get('star-Morwen B') ?? this.star : this.star;
    const radii = Array.from({ length: n }, (_, i) => (b.au2 && n === 2 ? (i ? b.au2 : b.au ?? 1) : b.au && n === 5 ? 30 + i * 3.75 : b.au ?? 1));
    const gates = radii.map((au) => { const g = this.gateMesh(color, !broken); this.scene.add(g); return { g, r: host === this.star ? localR(au) : host.r * 2 + 3 + 9 * Math.log(1 + au / 0.05) }; });
    const o: O = { ...(base as O), kind: 'gate', obj: gates[0].g, r: 1.5, orbit: gates[0].r, omega: 0, parent: host, label: this.mkLabel(b.name, 'gate') };
    o.extra = (t) => { gates.forEach((x, i) => { const a = o.phase + i * (n === 5 ? 1.2566 : 0.5); x.g.position.set(host.pos.x + Math.cos(-a) * x.r, host.pos.y, host.pos.z + Math.sin(-a) * x.r); x.g.lookAt(host.pos); x.g.rotateZ(t * 0.2); }); o.pos.copy(gates[0].g.position); };
    this.add(o);
  }
  /** Geçit + istasyon yapısı: halka, sekiz pilon, enerji zarı; yanında yaşam halkalı istasyon, güneş panelleri, yanıp sönen seyir ışıkları. */
  private gateStation(color: string, status: string) {
    const g = new THREE.Group(), broken = status === 'collapsed', shut = status === 'closed';
    const hull = new THREE.MeshStandardMaterial({ color: 0x8a96a4, metalness: 0.75, roughness: 0.35, emissive: C(color), emissiveIntensity: broken ? 0.02 : 0.08 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.6, roughness: 0.5 });
    const R0 = 2.6, ring = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.2, 12, 96, broken ? Math.PI * 1.35 : Math.PI * 2), hull); g.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(R0 - 0.32, 0.06, 8, 96, broken ? Math.PI * 1.1 : Math.PI * 2), new THREE.MeshBasicMaterial({ color: C(color), transparent: true, opacity: broken ? 0.15 : 0.75, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(inner);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (broken && a > Math.PI * 1.35) continue;
      const py = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.9), dark); py.position.set(Math.cos(a) * R0, Math.sin(a) * R0, 0); py.rotation.z = a; g.add(py); }
    let zm: THREE.ShaderMaterial | null = null;
    if (!broken) { zm = this.SM({ vertexShader: CORONA_VS.replace('uv * 2.0 - 1.0', 'uv'), fragmentShader: WORM_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } } });
      this.timeMats.push(zm); const disc = new THREE.Mesh(new THREE.PlaneGeometry(R0 * 2.1, R0 * 2.1), zm); disc.visible = !shut; g.add(disc); }
    // istasyon: halkanın yanında, kollarla bağlı
    const st = new THREE.Group(); st.position.set(R0 + 2.2, -0.6, -0.4); g.add(st);
    st.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.2, 16), hull));
    const hab = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.13, 10, 48), hull); hab.rotation.x = Math.PI / 2; st.add(hab);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), dark); sp.rotation.z = Math.PI / 2; sp.rotation.y = (i * Math.PI) / 3; st.add(sp); }
    for (const sgn of [1, -1]) { const pnl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.7), new THREE.MeshStandardMaterial({ color: 0x1a2a4a, metalness: 0.4, roughness: 0.3, emissive: 0x0a1a3a, emissiveIntensity: 0.4 })); pnl.position.set(0, sgn * 2.1, 0); st.add(pnl); }
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.0, 8), dark); arm.rotation.z = Math.PI / 2; arm.position.set(R0 + 1.05, -0.3, -0.2); g.add(arm);
    const lights: THREE.Sprite[] = [];
    for (const [x, y, z, c] of [[R0 + 2.2, 0.6, -0.4, '#ff3355'], [R0 + 2.2, -1.8, -0.4, '#00ff9a'], [0, R0 + 0.45, 0, color], [0, -R0 - 0.45, 0, color]] as [number, number, number, string][]) {
      const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: C(c), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); l.position.set(x, y, z); l.scale.setScalar(0.9); g.add(l); lights.push(l); }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: C(color), transparent: true, opacity: broken ? 0.05 : shut ? 0.12 : 0.3, depthWrite: false, blending: THREE.AdditiveBlending })); gl.scale.setScalar(10); g.add(gl);
    this.scene.add(g);
    return { g, tick: (t: number) => { lights.forEach((l, i) => (l.material.opacity = broken ? 0.1 : 0.25 + 0.75 * (Math.sin(t * 2.4 + i * 1.7) > 0.6 ? 1 : 0))); st.rotation.y = t * 0.15; inner.rotation.z = -t * 0.3; } };
  }
  private buildLaneGates(list: LaneGate[]) {
    const edge = this.extent + 16; this.edge = edge; const first = new Map<string, O>();
    for (const lg of list) {
      const host = lg.host === 'B' ? this.byId.get('star-Morwen B') ?? this.star : this.star;
      const rad = lg.au !== undefined ? (host === this.star ? this.R(lg.au) : host.r * 2 + 3 + 9 * Math.log(1 + lg.au / 0.05)) : edge;
      const { g, tick } = this.gateStation(lg.color, lg.status); const dir = new THREE.Vector3(Math.cos(lg.ang), 0, Math.sin(lg.ang));
      const o: O = { id: lg.id, b: null, kind: 'gate', name: lg.name, obj: g, r: 3, orbit: 0, omega: 0, phase: 0, incl: 0, parent: host, pos: new THREE.Vector3(), label: this.mkLabel(lg.name, 'gate'), spin: 0, pick: true };
      o.extra = (t) => { o.pos.copy(host.pos).addScaledVector(dir, rad); g.position.copy(o.pos); g.lookAt(host.pos); tick(t); };
      o.line = this.radial(host === this.star ? rad : 0, lg.ang, lg.color); this.add(o); if (lg.canon && !first.has(lg.canon)) first.set(lg.canon, o);
    }
    for (const { b, base } of this.canonGates) { const f = first.get(b.id); if (!f) continue;
      const o: O = { ...(base as O), kind: 'gate', obj: new THREE.Object3D(), r: 3, orbit: 0, omega: 0, parent: this.star, label: this.mkLabel(b.name, 'gate'), pick: false };
      o.label.style.display = 'none'; o.extra = () => o.pos.copy(f.pos); this.add(o); }
    if (list.length) this.extent = Math.max(this.extent, edge * 0.92);
  }
  /** Yıldızdan geçide uzanan kesik yön çizgisi (hat yönü). */
  private radial(r: number, ang: number, color: string) {
    const g = new THREE.BufferGeometry(); const a = Math.max(this.starDef.r * 3, r * 0.55);
    g.setAttribute('position', new THREE.Float32BufferAttribute([Math.cos(ang) * a, 0, Math.sin(ang) * a, Math.cos(ang) * r, 0, Math.sin(ang) * r], 3));
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: C(color), transparent: true, opacity: r ? 0.22 : 0, dashSize: 1.2, gapSize: 1.6, depthWrite: false })); l.computeLineDistances(); this.scene.add(l); return l;
  }
  private buildSingularity(b: Body, orbit: number, base: object, omega: number) {
    const g = new THREE.Group(); this.scene.add(g); const R = 1.6;
    const hole = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })); hole.renderOrder = 3; g.add(hole);
    const dm = this.SM({ vertexShader: RING_VS, fragmentShader: DISK_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uIn: { value: R * 1.6 }, uOut: { value: R * 5.2 }, uCenter: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, 0, 1) } } });
    this.timeMats.push(dm); const disk = new THREE.Mesh(new THREE.RingGeometry(R * 1.6, R * 5.2, 160, 4), dm); disk.rotation.x = -Math.PI / 2 + 0.22; g.add(disk);
    const lm = this.SM({ vertexShader: CORONA_VS.replace('uv * 2.0 - 1.0', 'uv'), fragmentShader: LENS_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uR: { value: 0.3 } } });
    this.timeMats.push(lm); const lens = new THREE.Mesh(new THREE.PlaneGeometry(R / 0.3 * 2, R / 0.3 * 2), lm); lens.renderOrder = 2; g.add(lens);
    const o: O = { ...(base as O), kind: 'singularity', obj: g, r: R * 2.5, orbit, omega, parent: this.star, label: this.mkLabel(b.name, 'planet') };
    o.extra = (t) => { lens.quaternion.copy(this.camera.quaternion); lens.quaternion.premultiply(g.quaternion.clone().invert()); disk.updateMatrixWorld(); dm.uniforms.uCenter.value.copy(o.pos);
      this.v.copy(this.camera.position).sub(o.pos).normalize(); dm.uniforms.uDir.value.set(this.v.x, 0, this.v.z).normalize(); void t; };
    o.line = this.orbitLine(orbit, '#ff9a5a', 0.22, o.incl, true); this.add(o);
  }
  private buildStream(b: Body, base: object) {
    const s = this.objs.find((x) => x.kind === 'singularity'); if (!s) return;
    const pivot = new THREE.Group(); this.scene.add(pivot);
    const pts: number[] = [], tt: number[] = [], N = 120;
    for (let k = 0; k < 5; k++) for (let i = 0; i < N; i++) { const t = i / (N - 1), x = this.starDef.r + t * (s.orbit - this.starDef.r), bend = Math.sin(t * Math.PI) * s.orbit * 0.18;
      pts.push(x, (k - 2) * 0.12 * Math.sin(t * Math.PI), -bend + (k - 2) * 0.2 * (1 - t)); tt.push(t); }
    const idx: number[] = []; for (let k = 0; k < 5; k++) for (let i = 0; i < N - 1; i++) idx.push(k * N + i, k * N + i + 1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1)); g.setIndex(idx);
    const fm = this.SM({ vertexShader: FLOW_VS, fragmentShader: FLOW_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: C('#ff8a3a') }, uTime: { value: 0 }, uSpeed: { value: 0.8 }, uOp: { value: 0.75 } } });
    this.timeMats.push(fm); pivot.add(new THREE.LineSegments(g, fm));
    const o: O = { ...(base as O), kind: 'stream', obj: pivot, r: 2, orbit: 0, omega: 0, parent: this.star, label: this.mkLabel(b.name, 'belt') };
    o.extra = () => { const a = Math.atan2(s.pos.z, s.pos.x); pivot.rotation.y = -a; o.pos.set(Math.cos(a) * s.orbit * 0.5, 0, Math.sin(a) * s.orbit * 0.5).addScaledVector(new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)), -s.orbit * 0.18); };
    this.add(o);
  }
  private buildDebris(b: Body, orbit: number, base: object) {
    const n = Math.floor(420 * Q[this.quality].rocks), geo = new THREE.BoxGeometry(1, 0.3, 0.4), mat = new THREE.MeshStandardMaterial({ color: 0x6a6660, metalness: 0.6, roughness: 0.6 });
    const im = new THREE.InstancedMesh(geo, mat, n), d = new THREE.Object3D(), a0 = h(b.id) * 6.283;
    for (let i = 0; i < n; i++) { const a = a0 + (Math.random() - 0.5) * 1.1, r = orbit + (Math.random() - 0.5) * 9; d.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 3, Math.sin(a) * r); d.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); d.scale.setScalar(0.1 + Math.random() ** 2 * 0.5); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
    const grp = new THREE.Group(); grp.add(im); this.scene.add(grp);
    const ash = nebulaTex(5); this.tex.ash = ash; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ash, color: C('#8a8a90'), transparent: true, opacity: 0.12, depthWrite: false })); sp.position.set(Math.cos(a0) * orbit, 0, Math.sin(a0) * orbit); sp.scale.setScalar(40); grp.add(sp);
    const o: O = { ...(base as O), kind: 'debris', obj: grp, r: 6, orbit, omega: 0, parent: this.star, label: this.mkLabel(b.name, 'belt') };
    o.extra = (t) => { grp.rotation.y = -t * 0.0015; const a = a0 + t * 0.0015; o.pos.set(Math.cos(a) * orbit, 0, Math.sin(-a) * orbit * -1); };
    this.add(o);
  }
  // ---------- güncelleme ----------
  private update(t: number) {
    for (const o of this.objs) {
      if (o.kind === 'star') { o.pos.set(0, 0, 0); }
      else if (o.orbit && (o.kind === 'planet' || o.kind === 'moon' || o.kind === 'star2' || o.kind === 'station' || o.kind === 'singularity' || o.kind === 'wormhole') && !(o.kind === 'station' && o.extra && o.omega === 0 && o.parent !== this.star)) {
        const a = o.phase + t * o.omega, p = o.parent!.pos;
        if (o.oq) { this.v.set(Math.cos(-a) * o.orbit, 0, Math.sin(-a) * o.orbit).applyQuaternion(o.oq); o.pos.copy(p).add(this.v); }
        else o.pos.set(p.x + Math.cos(-a) * o.orbit, p.y + Math.sin(-a) * o.orbit * Math.sin(o.incl), p.z + Math.sin(-a) * o.orbit * Math.cos(o.incl));
        o.obj.position.copy(o.pos);
        if (o.line && o.parent!.kind !== 'star') o.line.position.copy(p);
      }
      if (o.dot) { o.dot.position.copy(o.pos); const dd = this.camera.position.distanceTo(o.pos); o.dot.material.opacity = Math.max(0, Math.min(0.85, (dd - o.r * 14) / (o.r * 40))); o.dot.visible = !this.snapping; }
      if (o.kind === 'planet' || o.kind === 'moon') { o.obj.rotation.y = t * o.spin; (o.mat!.uniforms.uStar.value as THREE.Vector3).set(0, 0, 0); }
      if (o.kind === 'station') o.obj.rotation.y = t * 0.2;
      if (o.mat && o.parent?.kind === 'star2') o.mat.uniforms.uStar.value.copy(o.parent.pos);
      o.extra?.(t);
    }
  }
  setQuality(q: Quality) {
    this.quality = q; const c = Q[q]; this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, c.dpr));
    this.composer?.dispose(); this.bloom?.dispose(); this.composer = null; this.bloom = null;
    if (c.bloom) { this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
      const sz = new THREE.Vector2(this.host.clientWidth, this.host.clientHeight); const bh = this.sys.stype === 'blackhole';
      this.bloomBase = bh ? 0.5 : 0.7; this.bloomThr = bh ? 0.7 : 0.62; this.bloom = new UnrealBloomPass(q === 'high' ? sz : sz.clone().multiplyScalar(0.5), this.bloomBase, 0.5, this.bloomThr); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass()); }
    this.resize();
  }
  setLayers(labels: boolean, orbits: boolean, moving: boolean) {
    this.showLabels = labels; this.showOrbits = orbits; this.moving = moving;
    for (const o of this.objs) if (o.line) o.line.visible = orbits; const g = this.scene.getObjectByName('grid'); if (g) g.visible = orbits;
  }
  // ---------- kamera ----------
  private flyPose(toT: THREE.Vector3, toP: THREE.Vector3, dur: number, o: O | null, done?: () => void) {
    this.fly = { t0: performance.now(), dur, fromT: this.controls.target.clone(), fromP: this.camera.position.clone(), o, offT: o ? toT.clone().sub(o.pos) : toT.clone(), offP: o ? toP.clone().sub(o.pos) : toP.clone(), done };
  }
  focus(id: string) {
    const o = this.byId.get(id); if (!o) return; this.selected = id;
    const dist = o.kind === 'star' || o.kind === 'star2' ? Math.max(o.r * 6, 14) : o.kind === 'belt' ? Math.max(30, o.orbit * 0.6) : o.kind === 'swarm' ? o.r * 3 : o.kind === 'singularity' ? 22 : o.id.startsWith('lg-') ? 14 : Math.max(o.r * 5.5, 4);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize(); if (dir.y < 0.2) { dir.y = 0.3; dir.normalize(); }
    // aydınlık tarafı göster: yıldız-cisim yönüne biraz yaklaştır
    if (o.kind === 'planet' || o.kind === 'moon') { const sun = o.pos.clone().negate().normalize(); dir.lerp(sun, 0.3).normalize(); dir.y = Math.max(dir.y, 0.22); dir.normalize(); }
    // hat geçidi: halkanın yüzü ve yanındaki istasyon görünsün diye yıldız tarafından, üç çeyrek açıyla
    if (o.id.startsWith('lg-')) { const inw = o.parent!.pos.clone().sub(o.pos).normalize(), side = inw.clone().cross(new THREE.Vector3(0, 1, 0)).normalize(); dir.copy(inw.multiplyScalar(0.8).addScaledVector(side, -0.5).add(new THREE.Vector3(0, 0.32, 0))).normalize(); }
    const toT = o.kind === 'belt' ? o.pos.clone() : o.pos.clone(); this.follow = o.kind === 'belt' ? null : o;
    this.flyPose(toT, toT.clone().addScaledVector(dir, dist), 1500, o.kind === 'belt' ? null : o);
    this.hooks.select(id);
  }
  overview() { this.follow = null; this.selected = null; const ov = this.overviewPose(); this.flyPose(ov.t, ov.p, 1400, null); }
  exit(): Promise<void> { return new Promise((res) => { this.follow = null; this.flyPose(new THREE.Vector3(), new THREE.Vector3(0, this.starDef.r * 1.2, this.starDef.r * 2.2), 1000, null, res); }); }
  select(id: string | null) { this.selected = id; if (!id) this.follow = null; }
  getPose() { return { p: this.camera.position.clone(), t: this.controls.target.clone() }; }
  setPose(x: { p: THREE.Vector3; t: THREE.Vector3 }) { this.fly = null; this.camera.position.copy(x.p); this.controls.target.copy(x.t); this.controls.update(); }
  // ---------- seçim ----------
  private pick(cx: number, cy: number) {
    const rc = this.renderer.domElement.getBoundingClientRect(); let best: string | null = null, bd = 1e9; const fov = Math.tan((this.camera.fov * Math.PI) / 360);
    for (const o of this.objs) { if (!o.pick) continue; this.v.copy(o.pos).project(this.camera); if (this.v.z > 1) continue;
      const x = (this.v.x * 0.5 + 0.5) * rc.width + rc.left, y = (-this.v.y * 0.5 + 0.5) * rc.height + rc.top; const dist = this.camera.position.distanceTo(o.pos);
      const pr = o.kind === 'belt' ? 0 : (o.r / (dist * fov)) * rc.height * 0.5; const d = Math.hypot(x - cx, y - cy) - pr; const lim = o.kind === 'belt' ? 10 : 16;
      if (d < lim && d < bd) { bd = d; best = o.id; } }
    return best;
  }
  private onMove = (e: PointerEvent) => { const id = e.buttons ? null : this.pick(e.clientX, e.clientY); if (id !== this.hovered) { this.hovered = id; this.hooks.hover(id); this.renderer.domElement.style.cursor = id ? 'pointer' : ''; } };
  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY }; if (this.fly && !this.fly.done) this.fly = null; };
  private onUp = (e: PointerEvent) => { if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) return; const id = this.pick(e.clientX, e.clientY); if (id) this.focus(id); };
  private resize = () => { const w = this.host.clientWidth, hh = this.host.clientHeight; if (!w || !hh) return; this.camera.aspect = w / hh; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, hh, false); this.composer?.setSize(w, hh); this.composer?.setPixelRatio(this.renderer.getPixelRatio()); };
  private onVis = () => { if (document.hidden) this.stop(); else this.start(); };
  start() { if (this.running) return; this.running = true; this.clock.getDelta(); this.raf = requestAnimationFrame(this.frame); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  /** Prosedürel görüntü: cismin aydınlık ve gece/ hilal yüzünden iki kare. */
  snapshot(id: string): Promise<string[]> { return new Promise((res) => (this.snapReq = { id, res })); }
  private doSnapshot() {
    const req = this.snapReq!; this.snapReq = null; const o = this.byId.get(req.id); if (!o) return req.res([]);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 9000), S = 288, out: string[] = [], el = this.renderer.domElement;
    this.snapping = true; this.objs.forEach((x) => x.dot && (x.dot.visible = false));
    const hideL = this.objs.map((x) => x.line?.visible); this.objs.forEach((x) => x.line && (x.line.visible = false)); this.reticle.visible = false;
    const dist = o.kind === 'star' || o.kind === 'star2' ? o.r * 7 : o.kind === 'belt' ? o.orbit * 0.5 : o.kind === 'singularity' ? 20 : o.r * 4.3;
    const sun = o.kind === 'star' ? new THREE.Vector3(0.3, 0.4, 1).normalize() : o.pos.clone().negate().normalize();
    const views = [sun.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.75).add(new THREE.Vector3(0, 0.25, 0)).normalize(), sun.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), o.b?.city ? 2.6 : 1.9).add(new THREE.Vector3(0, 0.15, 0)).normalize()];
    const pr = this.renderer.getPixelRatio(), W = el.width, H = el.height;
    for (const v of views) { cam.position.copy(o.pos).addScaledVector(v, dist); cam.lookAt(o.pos); cam.updateMatrixWorld();
      this.renderer.setScissorTest(true); this.renderer.setScissor(0, 0, S / pr, S / pr); this.renderer.setViewport(0, 0, S / pr, S / pr); this.renderer.render(this.scene, cam);
      const c = document.createElement('canvas'); c.width = c.height = S; c.getContext('2d')!.drawImage(el, 0, H - S, S, S, 0, 0, S, S); out.push(c.toDataURL('image/webp', 0.85)); }
    this.renderer.setScissorTest(false); this.renderer.setViewport(0, 0, W / pr, H / pr);
    this.objs.forEach((x, i) => x.line && (x.line.visible = !!hideL[i])); this.snapping = false; void W; req.res(out);
  }
  private frame = () => {
    if (!this.running) return; this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.1); if (this.moving) this.t += dt; const t = this.t, rt = this.clock.elapsedTime;
    const prev = this.follow ? this.follow.pos.clone() : null;
    this.update(t);
    if (this.fly) { const f = this.fly, k = Math.min(1, (performance.now() - f.t0) / f.dur), e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      const toT = f.o ? f.o.pos.clone().add(f.offT) : f.offT, toP = f.o ? f.o.pos.clone().add(f.offP) : f.offP;
      this.controls.target.lerpVectors(f.fromT, toT, e); this.camera.position.lerpVectors(f.fromP, toP, e); if (k >= 1) { this.fly = null; f.done?.(); } }
    else if (this.follow && prev) { const d = this.follow.pos.clone().sub(prev); this.controls.target.add(d); this.camera.position.add(d); }
    this.controls.update();
    for (const m of this.timeMats) m.uniforms.uTime.value = rt;
    const sel = this.selected ? this.byId.get(this.selected) : null; this.reticle.visible = !!sel && sel.kind !== 'belt';
    if (sel) { this.reticle.position.copy(sel.pos); const d = this.camera.position.distanceTo(sel.pos); this.reticle.scale.setScalar(Math.max(sel.r * 2.7, d * 0.045)); this.reticle.material.rotation = rt * 0.6; }
    // etiketler
    const w = this.host.clientWidth, hh = this.host.clientHeight;
    for (const o of this.objs) {
      this.v.copy(o.pos).project(this.camera); const d = this.camera.position.distanceTo(o.pos), foc = o.id === this.hovered || o.id === this.selected;
      let a: number;
      if (o.kind === 'moon' || o.kind === 'swarm' || (o.kind === 'station' && o.parent !== this.star) || o.kind === 'disk') a = Math.max(0, Math.min(1, (60 - this.camera.position.distanceTo(o.parent!.pos)) / 25));
      else if (o.kind === 'belt' || o.kind === 'stream' || o.kind === 'debris') a = Math.max(0, Math.min(0.75, (900 - d) / 400));
      else a = Math.max(0, Math.min(1, (1400 - d) / 500));
      if (o.kind === 'swarm') a *= 0.6; if (foc) a = 1; if (!this.showLabels && !foc) a = 0; if (this.v.z > 1) a = 0;
      o.label.style.opacity = String(a); o.label.style.visibility = a < 0.03 ? 'hidden' : 'visible';
      if (a >= 0.03) o.label.style.transform = `translate3d(${(this.v.x * 0.5 + 0.5) * w}px,${(-this.v.y * 0.5 + 0.5) * hh}px,0)`;
      o.label.classList.toggle('focus', foc);
    }
    if (this.bloom) { // yıldıza yaklaşınca bloom kısılır, yüzey dokusu görünür
      const r = this.starDef.r, d = this.camera.position.length(), k = Math.max(0.12, Math.min(1, (d - r * 2.5) / (r * 30)));
      this.bloom.strength = this.bloomBase * k; this.bloom.threshold = this.bloomThr + (1 - k) * 0.25; }
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    if (this.snapReq) { this.doSnapshot(); if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); }
  };
  screenOf(id: string) { const o = this.byId.get(id); if (!o) return null; this.v.copy(o.pos).project(this.camera); return { x: (this.v.x * 0.5 + 0.5) * this.host.clientWidth, y: (-this.v.y * 0.5 + 0.5) * this.host.clientHeight }; }
  dispose() {
    this.stop(); const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onMove); el.removeEventListener('pointerdown', this.onDown); el.removeEventListener('pointerup', this.onUp);
    removeEventListener('resize', this.resize); document.removeEventListener('visibilitychange', this.onVis); this.controls.dispose();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose(); });
    Object.values(this.tex).forEach((t) => t.dispose()); this.composer?.dispose(); this.bloom?.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); el.remove(); this.overlay.innerHTML = '';
  }
}
