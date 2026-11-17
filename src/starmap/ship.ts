import * as THREE from 'three';

const hull = () => new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.96 });
const dark = () => new THREE.MeshBasicMaterial({ color: 0x1c3d2a, transparent: true, opacity: 0.95 });
const glass = () => new THREE.MeshBasicMaterial({ color: 0x9fffff, transparent: true, opacity: 0.7 });
const glow = () => new THREE.MeshBasicMaterial({ color: 0x39ff8a, transparent: true, opacity: 0.85 });
const padM = () => new THREE.MeshBasicMaterial({ color: 0xc8ffe0, transparent: true, opacity: 0.9 });
const trim = () => new THREE.MeshBasicMaterial({ color: 0x4aff9a, transparent: true, opacity: 0.9 });

function box(mat: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  return m;
}
function cyl(mat: THREE.Material, rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  return m;
}

/** Qorves scout-freighter: nose +Z, up +Y. Yaw-only. Landing pads, no wheels. scale 1 ≈ slightly smaller than the old cone 6.8. */
export function buildShip(scale = 1) {
  const g = new THREE.Group();
  const H = hull(), D = dark(), G = glass(), E = glow(), P = padM(), T = trim();
  // fuselage
  g.add(cyl(H, 0.55, 0.72, 3.4, 8, 0, 0.05, 0.15, Math.PI / 2));
  g.add(box(H, 1.15, 0.7, 2.8, 0, 0.02, -0.15));
  g.add(cyl(H, 0.22, 0.55, 1.35, 8, 0, 0.08, 2.15, Math.PI / 2)); // nose
  g.add(cyl(G, 0.28, 0.22, 0.7, 8, 0, 0.28, 1.55, Math.PI / 2)); // canopy
  g.add(box(D, 0.95, 0.18, 1.8, 0, -0.38, -0.2)); // belly cargo
  // side nacelles + engine bells
  for (const s of [-1, 1]) {
    g.add(cyl(D, 0.22, 0.26, 1.7, 8, s * 0.95, -0.05, -0.55, Math.PI / 2));
    g.add(cyl(E, 0.2, 0.14, 0.45, 8, s * 0.95, -0.05, -1.55, Math.PI / 2));
    g.add(box(T, 0.08, 0.08, 1.1, s * 0.55, 0.18, 0.4));
  }
  g.add(cyl(E, 0.32, 0.22, 0.5, 8, 0, 0, -1.95, Math.PI / 2)); // main bell
  g.add(cyl(D, 0.36, 0.32, 0.35, 8, 0, 0, -1.7, Math.PI / 2));
  // wings + fins
  const wing = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.1, 1.15), T);
  wing.position.set(0, -0.05, -0.35);
  g.add(wing);
  for (const s of [-1, 1]) {
    g.add(box(T, 0.12, 0.55, 0.7, s * 1.45, 0.15, -0.45, 0, 0, s * 0.18));
    g.add(box(H, 0.18, 0.08, 0.55, s * 1.55, -0.02, 0.15));
  }
  g.add(box(T, 0.1, 0.85, 0.7, 0, 0.55, -0.85)); // vertical stab
  g.add(box(T, 0.85, 0.08, 0.35, 0, 0.9, -0.95));
  // sensor mast
  g.add(cyl(D, 0.04, 0.04, 0.55, 6, 0.15, 0.55, 0.6));
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), G); dish.position.set(0.15, 0.85, 0.6); g.add(dish);
  // landing pads (skids / discs, no wheels) — 3 points
  const pads: [number, number, number][] = [[-0.7, -0.55, 0.7], [0.7, -0.55, 0.7], [0, -0.55, -1.15]];
  for (const [x, y, z] of pads) {
    g.add(cyl(D, 0.045, 0.045, 0.38, 6, x, y + 0.1, z));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.07, 8), P);
    disc.position.set(x, y - 0.1, z);
    g.add(disc);
  }
  g.scale.setScalar(scale);
  g.rotation.set(0, 0, 0);
  return g;
}

export function spinYaw(obj: THREE.Object3D, t: number, speed = 0.25) {
  obj.rotation.x = 0;
  obj.rotation.z = 0;
  obj.rotation.y = t * speed;
}
