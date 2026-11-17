/* Veri Tüneli — three.js sahnesi. Gerçek 3B: kıvrımlı boru (TubeGeometry), akan veri duvarı (shader), 3B engeller, bloom. */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { type Tunnel, type Ob, R, PR, VMAX, hit, obRot } from '../logic/tunnel';
import { seeded } from '../logic/common';

const RV = 3.2; // dünya biriminde boru yarıçapı (mantık R=1)
const CAM_BACK = 7.5; // kamera paketin ne kadar gerisinde
export interface TunnelView {
  frame(dt: number, mx: number, my: number): { z: number; lives: number; over: 0 | 1 | -1; hitNow: boolean; passed: boolean };
  start(): void; resize(): void; dispose(): void; started: boolean;
}
export function createTunnel(canvas: HTMLCanvasElement, tn: Tunnel, acc: string, acc2: string): TunnelView {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#01030a');
  scene.fog = new THREE.FogExp2('#01030a', 0.028);
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
  // kıvrımlı merkez hattı
  const rr = seeded(tn.len * 7 + tn.D);
  const pts: THREE.Vector3[] = []; const segLen = 24; const n = Math.ceil((tn.len + 80) / segLen) + 2;
  let x = 0, y = 0;
  for (let i = -2; i < n; i++) {
    const amp = i < 3 ? 0 : tn.curve * 7;
    x = x * 0.6 + (rr() - 0.5) * amp; y = y * 0.6 + (rr() - 0.5) * amp;
    pts.push(new THREE.Vector3(x, y, -i * segLen));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const total = curve.getLength(); const z0 = 2 * segLen; // mantık z=0 dünya hattında
  const SEG = Math.ceil(total / 1.2);
  const frames = curve.computeFrenetFrames(SEG, false);
  const uAt = (z: number) => Math.max(0, Math.min(1, (z + z0) / total));
  function frameAt(z: number) {
    const u = uAt(z); const f = u * SEG; const i = Math.min(SEG - 1, Math.floor(f)), k = f - i;
    const nrm = frames.normals[i]!.clone().lerp(frames.normals[i + 1]!, k).normalize().negate(); // ekran sağı = -N (kamera up = B)
    const bin = frames.binormals[i]!.clone().lerp(frames.binormals[i + 1]!, k).normalize();
    const tan = curve.getTangentAt(u); const pos = curve.getPointAt(u);
    return { pos, tan, nrm, bin };
  }
  // boru: akan veri duvarı
  const tubeGeo = new THREE.TubeGeometry(curve, SEG, RV, 64, false);
  const tubeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false, transparent: false,
    uniforms: { uTime: { value: 0 }, uSpin: { value: 0 }, uLen: { value: total }, uA: { value: new THREE.Color(acc) }, uB: { value: new THREE.Color(acc2) }, uCam: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vD=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `
      varying vec2 vUv; varying float vD; uniform float uTime,uSpin,uLen; uniform vec3 uA,uB;
      float h(float n){ return fract(sin(n*127.1)*43758.5453); }
      void main(){
        float s = vUv.x*uLen;                 // boy (birim)
        float a = fract(vUv.y + uSpin/6.28318); // çevre
        float cols = 56.0; float c = floor(a*cols); float ca = fract(a*cols);
        float spd = 2.0 + h(c)*6.0; float k = 0.35 + h(c+7.0)*0.6;
        float t = s*k + uTime*spd;
        float cell = floor(t); float f = fract(t);
        float lane = step(0.35, h(c*3.7)); float on = lane * step(0.62, h(cell + c*13.0)) * step(0.2, f) * step(f, 0.8);
        float glyph = on * step(0.18, ca) * step(ca, 0.82);
        float bright = h(cell*3.1 + c) ; vec3 col = mix(uA, uB, step(0.93, h(c*1.7+floor(uTime*0.3))));
        float ring = smoothstep(0.93, 1.0, abs(fract(s/6.0)-0.5)*2.0) * 0.8;
        float seam = smoothstep(0.04,0.0,ca)*0.18;
        float hot = step(0.9, bright); vec3 base = vec3(0.002,0.006,0.016) + col*(glyph*(0.06+bright*0.3 + hot*0.9) + ring*0.35 + seam*0.5);
        float fog = exp(-vD*0.032);
        gl_FragColor = vec4(base*fog, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(tubeGeo, tubeMat));
  // engeller
  const obMatA = new THREE.MeshStandardMaterial({ color: '#1a0414', emissive: new THREE.Color(acc2), emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.35, transparent: true, opacity: 0.92 });
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(acc2).multiplyScalar(3) });
  const blkMat = new THREE.MeshStandardMaterial({ color: '#05121a', emissive: new THREE.Color(acc), emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3 });
  const blkEdge = new THREE.LineBasicMaterial({ color: new THREE.Color(acc).multiplyScalar(2.4) });
  scene.add(new THREE.AmbientLight('#335', 1.2));
  const keyL = new THREE.PointLight(acc, 30, 30); scene.add(keyL);
  const ext = { depth: 0.5, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 };
  function shapeFor(o: Ob): THREE.BufferGeometry[] {
    const S = RV * 1.04;
    if (o.kind === 'plate') { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.absarc(0, 0, S, 0, o.span, false); sh.lineTo(0, 0); return [new THREE.ExtrudeGeometry(sh, { ...ext, curveSegments: 32 })]; }
    if (o.kind === 'bar' || o.kind === 'cross') {
      const w = o.span * RV; const g = [new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-S, -w / 2), new THREE.Vector2(S, -w / 2), new THREE.Vector2(S, w / 2), new THREE.Vector2(-S, w / 2)]), ext)];
      if (o.kind === 'cross') g.push(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, -S), new THREE.Vector2(w / 2, -S), new THREE.Vector2(w / 2, S), new THREE.Vector2(-w / 2, S)]), ext));
      return g;
    }
    if (o.kind === 'iris') { const sh = new THREE.Shape(); sh.absarc(0, 0, S, 0, Math.PI * 2, false); const [hx, hy, hr] = o.hole!; const hole = new THREE.Path(); hole.absarc(hx * RV, hy * RV, hr * RV, 0, Math.PI * 2, true); sh.holes.push(hole); return [new THREE.ExtrudeGeometry(sh, { ...ext, curveSegments: 48 })]; }
    return o.blocks!.map(([bx, by, bs]) => { const g = new THREE.BoxGeometry(bs * 2 * RV, bs * 2 * RV, bs * 2 * RV); g.translate(bx * RV, by * RV, 0); return g; });
  }
  interface ObV { o: Ob; g: THREE.Group; spin: THREE.Group; mats: THREE.Material[]; passed: boolean; struck: number }
  const obv: ObV[] = tn.obs.map((o) => {
    const g = new THREE.Group(); const spin = new THREE.Group(); g.add(spin);
    const isB = o.kind === 'blocks';
    for (const geo of shapeFor(o)) {
      if (!isB) geo.translate(0, 0, -0.25);
      const m = new THREE.Mesh(geo, isB ? blkMat : obMatA); spin.add(m);
      spin.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), isB ? blkEdge : edgeMat));
    }
    const f = frameAt(o.z); g.position.copy(f.pos);
    const m4 = new THREE.Matrix4().makeBasis(f.nrm, f.bin, f.tan.clone().negate()); g.quaternion.setFromRotationMatrix(m4);
    scene.add(g);
    return { o, g, spin, mats: [], passed: false, struck: 0 };
  });
  // çıkış kapısı
  const gate = new THREE.Mesh(new THREE.TorusGeometry(RV * 0.92, 0.12, 12, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff') }));
  { const f = frameAt(tn.len); gate.position.copy(f.pos); gate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.nrm, f.bin, f.tan.clone().negate())); scene.add(gate); }
  // paket
  const pkt = new THREE.Group();
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(PR * RV * 1.25, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff') }));
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(PR * RV * 2.0, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(acc), wireframe: true, transparent: true, opacity: 0.8 }));
  pkt.add(core, shell); scene.add(pkt);
  const trailN = 26; const trailGeo = new THREE.BufferGeometry(); const trailPos = new Float32Array(trailN * 3); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: new THREE.Color(acc), size: 0.14, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(trail);
  // hız çizgileri
  const sN = 260; const sGeo = new THREE.BufferGeometry(); const sPos = new Float32Array(sN * 6); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sOff = Array.from({ length: sN }, () => ({ a: Math.random() * Math.PI * 2, r: RV * (0.55 + Math.random() * 0.4), z: Math.random() * 60 }));
  const streaks = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(acc).multiplyScalar(1.4), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(streaks);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.45, 0.55); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let z = 0, t = 0, px = 0, py = 0, lives = tn.lives, inv = 0, over: 0 | 1 | -1 = 0, shake = 0, started = false;
  const trailHist: THREE.Vector3[] = [];
  const view: TunnelView = {
    started: false,
    start() { started = true; view.started = true; },
    resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); bloom.resolution.set(w / 2, h / 2); },
    frame(dt, mx, my) {
      let hitNow = false, passed = false;
      if (started && !over) {
        t += dt; inv = Math.max(0, inv - dt);
        // fare hedefine sınırlı hızla git (kesit diski içinde)
        let tx = mx, ty = my; const tr = Math.hypot(tx, ty), lim = R - PR - 0.02; if (tr > lim) { tx *= lim / tr; ty *= lim / tr; }
        const dx = tx - px, dy = ty - py, dd = Math.hypot(dx, dy), stepv = VMAX * dt;
        if (dd > stepv) { px += (dx / dd) * stepv; py += (dy / dd) * stepv; } else { px = tx; py = ty; }
        z += tn.speed(z) * dt;
        for (const v of obv) {
          if (v.passed) continue;
          if (z > v.o.z + v.o.th / 2) { v.passed = true; if (!v.struck) passed = true; continue; }
          if (Math.abs(z - v.o.z) < v.o.th / 2 && inv <= 0 && hit(v.o, px, py, obRot(tn, v.o, t))) { lives--; inv = 1.3; shake = 0.5; v.struck = 1; hitNow = true; if (lives <= 0) over = -1; }
        }
        if (z >= tn.len && !over) over = 1;
      } else if (!started) { // başlamadan önce imleci serbestçe dene
        let tx = mx, ty = my; const tr = Math.hypot(tx, ty), lim = R - PR - 0.02; if (tr > lim) { tx *= lim / tr; ty *= lim / tr; }
        px += (tx - px) * Math.min(1, dt * 8); py += (ty - py) * Math.min(1, dt * 8);
      }
      // görsel
      const spin = tn.spinAt(t);
      tubeMat.uniforms.uTime.value = performance.now() / 1000; tubeMat.uniforms.uSpin.value = spin;
      for (const v of obv) {
        v.spin.rotation.z = v.o.a + obRot(tn, v.o, t);
        const d = v.o.z - z; v.g.visible = d > -6 && d < 70;
        if (v.struck === 1) { v.struck = 2; v.spin.children.forEach((c) => { const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m && 'emissive' in m) { const mm = m.clone(); mm.emissive = new THREE.Color('#ff2020'); mm.emissiveIntensity = 1.6; (c as THREE.Mesh).material = mm; } }); }
      }
      const fp = frameAt(z), fc = frameAt(z - CAM_BACK), fl = frameAt(z + 10);
      const P = fp.pos.clone().addScaledVector(fp.nrm, px * RV).addScaledVector(fp.bin, py * RV);
      pkt.position.copy(P); pkt.rotation.x += dt * 2.3; pkt.rotation.y += dt * 3.1; shell.rotation.z -= dt * 4;
      pkt.visible = !(inv > 0 && Math.floor(inv * 14) % 2 === 0);
      keyL.position.copy(P);
      trailHist.unshift(P.clone()); if (trailHist.length > trailN) trailHist.pop();
      trailHist.forEach((q, i) => { trailPos[i * 3] = q.x; trailPos[i * 3 + 1] = q.y; trailPos[i * 3 + 2] = q.z + 0; }); trailGeo.attributes.position!.needsUpdate = true;
      // kamera: paketin gerisinde, biraz paketi takip eder (hafif gecikme), yön boru ekseni
      const cpos = fc.pos.clone().addScaledVector(fc.nrm, px * RV * 0.45).addScaledVector(fc.bin, py * RV * 0.45);
      if (shake > 0) { shake = Math.max(0, shake - dt); cpos.addScaledVector(fc.nrm, (Math.random() - 0.5) * shake * 0.8).addScaledVector(fc.bin, (Math.random() - 0.5) * shake * 0.8); }
      camera.position.copy(cpos); camera.up.copy(fc.bin); camera.lookAt(fl.pos.clone().addScaledVector(fl.nrm, px * RV * 0.3).addScaledVector(fl.bin, py * RV * 0.3));
      camera.fov = 72 + Math.min(14, (tn.speed(z) - 9) * 1.4); camera.updateProjectionMatrix();
      // hız çizgileri
      const v = tn.speed(z);
      sOff.forEach((s, i) => {
        s.z -= v * dt * (started ? 1 : 0.15); if (s.z < -4) s.z += 60;
        const a = s.a + spin; const f1 = frameAt(z + s.z), f2 = frameAt(z + s.z + 0.6 + v * 0.05);
        const p1 = f1.pos.clone().addScaledVector(f1.nrm, Math.cos(a) * s.r).addScaledVector(f1.bin, Math.sin(a) * s.r);
        const p2 = f2.pos.clone().addScaledVector(f2.nrm, Math.cos(a) * s.r).addScaledVector(f2.bin, Math.sin(a) * s.r);
        sPos.set([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z], i * 6);
      });
      sGeo.attributes.position!.needsUpdate = true;
      gate.rotation.z += dt * 1.5;
      composer.render(dt);
      return { z, lives, over, hitNow, passed };
    },
    dispose() {
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mt)) mt.forEach((x) => x.dispose()); else mt?.dispose?.(); });
      composer.dispose(); renderer.dispose();
    },
  };
  return view;
}
