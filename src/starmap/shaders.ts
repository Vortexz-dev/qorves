// Sistem görünümü shader'ları: yıldız yüzeyi, korona, gezegen, kara delik, ışınlar.
export const NOISE = `
vec3 hash3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
float noise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(dot(hash3(i),f), dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x), mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)), dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
             mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)), dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x), mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)), dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a*noise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
float ridged(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a*(1.0 - abs(noise(p))); p *= 2.1; a *= 0.5; } return s; }
`;
// ---------- yıldız yüzeyi ----------
export const STAR_VS = `varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){ vP = position; vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
export const STAR_FS = NOISE + `uniform vec3 uColor; uniform vec3 uHot; uniform float uTime; uniform float uScale; uniform float uContrast; uniform float uSpots; uniform float uInt;
varying vec3 vP; varying vec3 vN; varying vec3 vV;
void main(){ vec3 p = normalize(vP);
  float t = uTime * 0.05;
  float g = fbm(p * uScale + vec3(t, -t*0.7, t*0.4));
  float cells = ridged(p * uScale * 2.4 + vec3(-t*1.3, t, 0.0));
  float gran = mix(0.5, g * 0.6 + cells * 0.7, uContrast);
  float spots = smoothstep(0.42, 0.62, fbm(p * 2.2 + vec3(0.0, t*0.2, 3.0))) * uSpots;
  float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float limb = pow(mu, 0.42);
  vec3 c = mix(uColor * 0.55, uHot, clamp(gran * 1.1, 0.0, 1.0));
  c *= (1.0 - spots * 0.75);
  c = mix(uColor * 0.35, c, limb);
  gl_FragColor = vec4(c * uInt, 1.0); }`;
// ---------- korona (kameraya bakan düzlem) ----------
export const CORONA_VS = `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
export const CORONA_FS = NOISE + `uniform vec3 uColor; uniform float uTime; uniform float uR; uniform float uRays; uniform float uFlare; uniform float uInt; varying vec2 vUv;
void main(){ float r = length(vUv); if (r > 1.0) discard; float a = atan(vUv.y, vUv.x);
  float d = max(r - uR, 0.0) / (1.0 - uR);
  float rays = fbm(vec3(cos(a)*3.0, sin(a)*3.0, uTime*0.08)) * 0.5 + 0.5;
  float streak = pow(rays, 3.0) * uRays;
  float glow = exp(-d * (7.0 - streak * 4.0)) * 0.9 + exp(-d * 2.2) * 0.25;
  // patlama kemerleri: kenara yakın, açıya bağlı lob
  float fl = smoothstep(0.55, 0.9, noise(vec3(a * 2.5, uTime * 0.15, 7.0)) * 0.5 + 0.5) * exp(-d * 14.0) * uFlare;
  float inside = smoothstep(uR * 0.98, uR * 1.02, r);
  float v = (glow + fl * 1.6) * inside * (1.0 - smoothstep(0.85, 1.0, r));
  gl_FragColor = vec4(uColor * v * uInt, v); }`;
// ---------- gezegen ----------
export const PLANET_VS = `varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main(){ vP = position; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`;
// uCls: 0 kayalık 1 karasal 2 okyanus 3 gaz 4 buz devi 5 buz 6 lav 7 çöl 8 orman 9 kar 10 volkanik 11 cam 12 sera 13 smog 14 kilitli 15 bahçe 16 karst 17 kara delik zarı
export const PLANET_FS = NOISE + `uniform float uCls; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uAtm; uniform float uAtmS; uniform float uSeed; uniform float uTime; uniform float uCity; uniform vec3 uStar; uniform vec3 uStarCol; uniform float uLit;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
void main(){
  vec3 p = normalize(vP); vec3 q = p * 2.0 + uSeed;
  vec3 N = normalize(vN); vec3 L = normalize(uStar - vW); vec3 V = normalize(cameraPosition - vW);
  float ndl = dot(N, L); float day = smoothstep(-0.12, 0.35, ndl);
  vec3 col; float emis = 0.0; vec3 ecol = vec3(0.0); float land = 0.0; float spec = 0.0; float clouds = 0.0;
  float n = fbm(q * 1.6); float lat = abs(p.y);
  if (uCls < 0.5) { // kayalık
    float cr = ridged(q * 3.0); col = mix(uC1, uC2, smoothstep(-0.2, 0.4, n)); col *= 0.75 + 0.35 * cr; land = 1.0;
  } else if (uCls < 1.5 || (uCls > 14.5 && uCls < 15.5)) { // karasal / bahçe
    float sea = uCls > 14.5 ? 0.12 : 0.02; land = smoothstep(sea, sea + 0.04, n);
    vec3 ocean = mix(uC3 * 0.55, uC3, smoothstep(-0.4, sea, n));
    vec3 ground = mix(uC1, uC2, smoothstep(0.05, 0.4, fbm(q * 3.1)));
    col = mix(ocean, ground, land); col = mix(col, vec3(0.92), smoothstep(0.78, 0.9, lat + n * 0.2));
    spec = 1.0 - land; clouds = smoothstep(0.08, 0.45, fbm(q * 2.3 + vec3(uTime * 0.01, 0.0, uTime * 0.006)));
  } else if (uCls < 2.5) { // okyanus
    land = smoothstep(0.36, 0.4, n); col = mix(mix(uC3 * 0.5, uC3, n + 0.5), uC1, land); col = mix(col, vec3(0.9), smoothstep(0.82, 0.92, lat + n * 0.15));
    spec = 1.0 - land; clouds = smoothstep(0.15, 0.5, fbm(q * 2.6 + vec3(uTime * 0.012, 0.0, 0.0)));
  } else if (uCls < 3.5 || (uCls > 11.5 && uCls < 12.5)) { // gaz devi / sera
    float w = fbm(vec3(p.x * 2.0, p.y * 9.0, p.z * 2.0) + uSeed + vec3(uTime * 0.01, 0.0, 0.0));
    float b = sin(p.y * (uCls > 11.5 ? 9.0 : 22.0) + w * 3.5 + uSeed);
    col = mix(uC1 * 0.8, uC2, smoothstep(-0.7, 0.7, b)); col = mix(col, uC3 * 0.85, smoothstep(0.15, 0.55, fbm(vec3(p.x * 4.0, p.y * 18.0, p.z * 4.0) + uSeed * 2.0)));
    float storm = smoothstep(0.08, 0.0, length(vec2(atan(p.z, p.x) - 1.3 - uSeed, (p.y + 0.25) * 3.0))); col = mix(col, uC3 * 1.1, storm * 0.8);
  } else if (uCls < 4.5) { // buz devi
    float b = sin(p.y * 10.0 + fbm(q * 2.0) * 2.0); col = mix(uC1, uC2, b * 0.25 + 0.5);
  } else if (uCls < 5.5) { // buz
    float r = ridged(q * 4.0); col = mix(uC1, uC2, smoothstep(0.55, 0.9, r)); spec = 0.3;
  } else if (uCls < 6.5) { // lav
    float r = ridged(q * 3.0 + vec3(0.0, uTime * 0.01, 0.0)); float crack = smoothstep(0.78, 0.95, r);
    col = mix(uC1 * 0.5, uC1, n + 0.5); emis = crack + smoothstep(0.1, -0.4, ndl) * 0.15; ecol = mix(uC2, uC3, crack);
  } else if (uCls < 7.5 || (uCls > 15.5 && uCls < 16.5)) { // çöl / karst
    float r = ridged(q * 3.5); col = mix(uC1, uC2, smoothstep(-0.3, 0.5, n)); col = mix(col, uC3, smoothstep(0.82, 0.95, r) * (uCls > 15.5 ? 1.0 : 0.6)); land = 1.0;
    clouds = smoothstep(0.35, 0.7, fbm(q * 2.0 + uTime * 0.004)) * 0.5;
  } else if (uCls < 8.5) { // orman
    col = mix(uC1, uC2, smoothstep(-0.3, 0.4, n)); land = smoothstep(-0.25, -0.2, n); col = mix(uC3, col, land); spec = 1.0 - land;
    clouds = smoothstep(0.0, 0.45, fbm(q * 2.4 + vec3(uTime * 0.01, 0.0, 0.0)));
  } else if (uCls < 9.5) { // kar
    col = mix(uC1, uC2, smoothstep(0.0, 0.5, n)); col = mix(col, uC3, smoothstep(0.18, 0.05, lat) * smoothstep(-0.1, 0.3, n));
    clouds = smoothstep(0.1, 0.5, fbm(q * 2.0 + vec3(uTime * 0.015, 0.0, 0.0))) * 0.7;
  } else if (uCls < 10.5) { // volkanik
    col = mix(uC1, uC2, smoothstep(-0.3, 0.4, fbm(q * 2.6))); float hot = smoothstep(0.86, 0.96, ridged(q * 5.0)); emis = hot; ecol = uC3; land = 1.0;
  } else if (uCls < 11.5) { // cam
    col = uC1 * (0.6 + 0.4 * n); spec = 2.0;
  } else if (uCls < 13.5) { // smog
    col = mix(uC1, uC2, smoothstep(-0.3, 0.4, n)); land = 1.0; clouds = 0.55 + 0.3 * fbm(q * 2.0 + uTime * 0.01);
  } else if (uCls < 14.5) { // gelgit kilitli
    float t = ndl; col = mix(uC2, uC1, smoothstep(-0.2, 0.25, t)); col = mix(col, uC3, smoothstep(0.18, 0.0, abs(t - 0.02)) * (0.6 + 0.4 * n)); land = smoothstep(-0.05, 0.1, abs(t));
    col *= 0.8 + 0.3 * ridged(q * 3.0);
  } else { col = vec3(0.0); }
  // aydınlatma
  vec3 lit = col * (0.015 + 0.9 * max(ndl, 0.0) * day) * uStarCol;
  if (clouds > 0.0) lit = mix(lit, vec3(1.0) * (0.04 + max(ndl, 0.0)) * uStarCol, clouds * 0.85);
  vec3 H = normalize(L + V); lit += uStarCol * pow(max(dot(N, H), 0.0), 60.0) * spec * 0.35 * day;
  // gece şehir ışıkları
  if (uCity > 0.0) { float c = smoothstep(0.55, 0.75, noise(q * 38.0) * 0.5 + 0.5) * smoothstep(0.0, 0.3, fbm(q * 7.0) + 0.2);
    float cl = uCls > 12.5 && uCls < 13.5 ? 1.6 : 1.0;
    lit += vec3(1.0, 0.62, 0.28) * c * land * (1.0 - day) * (1.0 - clouds * 0.6) * 1.2 * cl * uCity; }
  lit += ecol * emis * 1.4;
  // atmosfer kenarı
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  lit += uAtm * fr * uAtmS * (0.15 + smoothstep(-0.3, 0.5, ndl));
  if (uCls > 16.5) lit = vec3(0.0);
  gl_FragColor = vec4(lit * uLit, 1.0);
}`;
// ---------- halka (gezegen halkası / ayna halkası) ----------
export const RING_VS = `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
export const RING_FS = NOISE + `uniform vec3 uC; uniform float uIn; uniform float uOut; uniform float uSeed; uniform vec3 uCenter; varying vec2 vUv; varying vec3 vW;
void main(){ float r = length(vW - uCenter); float t = (r - uIn) / (uOut - uIn); if (t < 0.0 || t > 1.0) discard;
  float b = 0.55 + 0.45 * sin(t * 60.0 + uSeed) * sin(t * 13.0 + uSeed * 3.0); float a = b * smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.85, t) * 0.75;
  gl_FragColor = vec4(uC * (0.6 + 0.6 * b), a); }`;
// ---------- birikim diski (Saelis) ----------
export const DISK_FS = NOISE + `uniform float uTime; uniform float uIn; uniform float uOut; uniform vec3 uCenter; uniform vec3 uDir; varying vec2 vUv; varying vec3 vW;
void main(){ vec3 d = vW - uCenter; float r = length(d); float t = (r - uIn) / (uOut - uIn); if (t < 0.0 || t > 1.0) discard;
  float a = atan(d.z, d.x);
  float sw = fbm(vec3(cos(a - uTime * (0.9 / (0.4 + t))) * 2.0 * (1.0 + t * 3.0), sin(a - uTime * (0.9 / (0.4 + t))) * 2.0 * (1.0 + t * 3.0), t * 6.0));
  float streak = 0.55 + 0.6 * sw;
  float dop = 0.65 + 0.55 * dot(normalize(vec3(-d.z, 0.0, d.x)), uDir);
  vec3 hot = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.55, 0.18), smoothstep(0.0, 0.55, t)); hot = mix(hot, vec3(0.45, 0.08, 0.02), smoothstep(0.5, 1.0, t));
  float alpha = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.7, 1.0, t)) * streak;
  gl_FragColor = vec4(hot * streak * dop * 0.95, alpha); }`;
// ---------- mercek halkası (kara deliğin arkasındaki disk görüntüsü + foton halkası) ----------
export const LENS_FS = NOISE + `uniform float uTime; uniform float uR; varying vec2 vUv;
void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  float photon = exp(-pow((r - uR * 1.08) / (uR * 0.035), 2.0)) * 1.2;
  float arcR = uR * 1.55; float arc = exp(-pow((r - arcR) / (uR * 0.32), 2.0));
  float a = atan(p.y, p.x); float top = pow(abs(sin(a)), 1.4);
  float sw = 0.6 + 0.5 * fbm(vec3(cos(a + uTime * 0.6) * 3.0, sin(a + uTime * 0.6) * 3.0, r * 4.0));
  vec3 c = vec3(1.0, 0.62, 0.25) * arc * top * sw * 0.8 + vec3(1.0, 0.9, 0.75) * photon;
  float v = max(max(c.r, c.g), c.b); if (r < uR * 0.98) discard;
  gl_FragColor = vec4(c, clamp(v, 0.0, 1.0)); }`;
// ---------- pulsar ışını (koni) ----------
export const BEAM_VS = `varying float vY; varying vec3 vN; varying vec3 vW; void main(){ vY = uv.y; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`;
export const BEAM_FS = `uniform vec3 uC; uniform float uTime; varying float vY; varying vec3 vN; varying vec3 vW;
void main(){ vec3 V = normalize(cameraPosition - vW); float edge = pow(abs(dot(normalize(vN), V)), 1.5);
  float fall = pow(vY, 2.2); float flick = 0.85 + 0.15 * sin(uTime * 40.0 + vY * 30.0);
  float a = edge * fall * flick * 0.45; gl_FragColor = vec4(uC * a, a); }`;
// ---------- akan çizgi (manyetik alan, plazma akıntısı) ----------
export const FLOW_VS = `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
export const FLOW_FS = `uniform vec3 uC; uniform float uTime; uniform float uSpeed; uniform float uOp; varying float vT;
void main(){ float f = fract(vT * 6.0 - uTime * uSpeed); float a = (0.25 + 0.75 * smoothstep(0.0, 0.15, f) * (1.0 - smoothstep(0.25, 0.5, f))) * uOp;
  gl_FragColor = vec4(uC * a, a); }`;
// ---------- kurt deliği ----------
export const WORM_FS = NOISE + `uniform float uTime; varying vec2 vUv; void main(){ vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard; float a = atan(p.y, p.x);
  float sw = fbm(vec3(cos(a * 2.0 + r * 8.0 - uTime) * 2.0, sin(a * 2.0 + r * 8.0 - uTime) * 2.0, uTime * 0.2));
  float ring = exp(-pow((r - 0.45) / 0.18, 2.0)); float core = smoothstep(0.3, 0.0, r);
  vec3 c = mix(vec3(0.3, 0.6, 1.0), vec3(0.8, 0.4, 1.0), sw + 0.5) * ring * (0.6 + sw) + vec3(0.02, 0.0, 0.05) * core;
  float v = clamp(ring * (0.6 + sw) * (1.0 - smoothstep(0.8, 1.0, r)), 0.0, 1.0); gl_FragColor = vec4(c, v); }`;
