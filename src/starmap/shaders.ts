// Sistem görünümü shader'ları: yıldız yüzeyi, korona, gezegen, kara delik, ışınlar.
export const NOISE = `
vec3 hash3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }
float noise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(dot(hash3(i),f), dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x), mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)), dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
             mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)), dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x), mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)), dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z); }
#ifndef OCT
#define OCT 5
#endif
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++){ s += a*noise(p); p = p*2.03 + 17.1; a *= 0.5; } return s; }
float ridged(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < OCT - 1; i++){ s += a*(1.0 - abs(noise(p))); p *= 2.1; a *= 0.5; } return s; }
// krater alanı (Worley F1): x = çanak (0..1), y = kenar
vec2 crater(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); float d1 = 8.0; float rr = 0.3;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) { vec3 g = vec3(float(x), float(y), float(z)); vec3 h = hash3(i + g) * 0.5 + 0.5;
    float d = length(g + h * 0.8 + 0.1 - f) / (0.25 + 0.55 * fract(h.x * 7.3)); if (d < d1) { d1 = d; } }
  float bowl = 1.0 - smoothstep(0.0, 0.62, d1); float rim = exp(-pow((d1 - 0.68) / 0.09, 2.0)); return vec2(bowl, rim); }
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
// uCls: 0 kayalık 1 karasal 2 okyanus 3 gaz 4 buz devi 5 buz 6 lav 7 çöl 8 orman/bataklık 9 kar 10 volkanik 11 cam 12 sera 13 smog 14 kilitli 15 bahçe 16 karst 17 kara delik zarı
// uP: x frekans, y girdap/türbülans, z fırtına | ekvator çölü | krater, w kutup başlığı
// uQ: x deniz seviyesi | bant sıklığı, y bulut örtüsü, z kontrast, w buz/kırağı lekeleri
// Şehir ışıkları: uCity yoğunluk (0 = yok), uCityMode 0 seyrek 1 kıyı 2 vadi 3 alacakaranlık 4 ekümenopolis 5 tek üs
export const PLANET_FS = NOISE + `uniform float uCls; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4; uniform vec4 uP; uniform vec4 uQ; uniform vec3 uAtm; uniform float uAtmS; uniform float uSeed; uniform float uTime;
uniform float uCity; uniform float uCityMode; uniform vec3 uCityDir; uniform vec3 uStar; uniform vec3 uStarCol; uniform float uLit;
varying vec3 vP; varying vec3 vN; varying vec3 vW;
float cityLights(vec3 p, float land, float ndl, float coast){
  if (uCity <= 0.0) return 0.0;
  vec3 s = p + uSeed * 0.37;
  if (uCityMode > 4.5) { // tek üs / küçük yerleşke: birkaç yüz metrelik bir ışık kümesi
    float d = acos(clamp(dot(p, normalize(uCityDir)), -1.0, 1.0)); float m = smoothstep(0.03 + uCity * 0.5, 0.0, d);
    float sp = smoothstep(0.55, 0.85, noise(s * 140.0) * 0.5 + 0.5); return m * (0.25 + sp) * 0.8; }
  float reg = noise(s * 4.2) * 0.5 + 0.5 + (noise(s * 11.0) * 0.12);
  float thr = mix(0.86, 0.42, uCity); if (uCityMode > 3.5) thr = 0.34;
  float r = smoothstep(thr, thr + 0.1, reg);
  if (uCityMode > 0.5 && uCityMode < 1.5) r *= 0.25 + 1.6 * coast;                         // kıyılar, nehir ağızları
  else if (uCityMode > 1.5 && uCityMode < 2.5) r *= smoothstep(0.72, 0.9, ridged(s * 3.4)) * 1.6; // kanyon vadileri
  else if (uCityMode > 2.5 && uCityMode < 3.5) r *= smoothstep(0.32, 0.04, abs(ndl));          // alacakaranlık kuşağı
  float core = smoothstep(thr + 0.08, thr + 0.24, reg);                                      // kent merkezleri
  float sp = smoothstep(0.6, 0.9, noise(s * 95.0) * 0.5 + 0.5);                              // dağınık ışık noktaları
  float rd = (1.0 - smoothstep(0.0, 0.012, abs(noise(s * 18.0)))) * smoothstep(thr - 0.12, thr, reg) * 0.35; // ulaşım ağları
  float l = r * (sp * 0.75 + core * 0.45) + rd;
  if (uCityMode > 3.5) { // ekümenopolis: kesintisiz parıltı değil; bölgeler, ana arterler ve aralarında karanlık parklar/sanayi boşlukları
    float grid = (1.0 - smoothstep(0.0, 0.025, abs(fract(s.x * 34.0 + noise(s * 6.0) * 2.0) - 0.5))) + (1.0 - smoothstep(0.0, 0.025, abs(fract(s.z * 34.0 + noise(s * 5.0) * 2.0) - 0.5)));
    float sp2 = smoothstep(0.62, 0.92, noise(s * 160.0) * 0.5 + 0.5);
    l = r * (0.008 + sp * 0.13 + sp2 * 0.16 + core * 0.06) + grid * 0.035 * r; }
  return l * land; }
void main(){
  vec3 p = normalize(vP); vec3 q = p * 2.0 * uP.x + uSeed;
  vec3 N = normalize(vN); vec3 L = normalize(uStar - vW); vec3 V = normalize(cameraPosition - vW);
  float ndl = dot(N, L); float day = smoothstep(-0.12, 0.35, ndl);
  vec3 col; float emis = 0.0; vec3 ecol = vec3(0.0); float land = 0.0; float spec = 0.0; float clouds = 0.0; float coast = 0.5;
  vec3 w = q + uP.y * vec3(fbm(q * 0.9 + 3.1), fbm(q * 0.9 + 7.7), fbm(q * 0.9 + 1.3)); // girdap
  float n = fbm(w * 1.6); float lat = abs(p.y); float k = uQ.z;
  vec2 cr = vec2(0.0); vec2 cr2 = vec2(0.0);
  if (uCls < 0.5 || (uCls > 4.5 && uCls < 5.5) || (uCls > 13.5 && uCls < 14.5)) { cr = crater(q * 3.2) * uP.z; cr2 = crater(q * 9.0 + 5.0) * uP.z; }
  if (uCls < 0.5) { // kayalık / havasız: krater, maria, kırağı
    float r = ridged(w * 3.0); float mare = smoothstep(0.05, 0.3, fbm(w * 0.8 + 9.0));
    col = mix(uC1, uC2, smoothstep(-0.25 * k, 0.4 * k, n)); col = mix(col, uC3, mare * 0.55); col *= 0.78 + 0.32 * r;
    col *= 1.0 - cr.x * 0.28 - cr2.x * 0.18; col += uC2 * (cr.y * 0.22 + cr2.y * 0.12);
    col = mix(col, uC4, smoothstep(0.55, 0.8, fbm(q * 2.5 + 4.0)) * uQ.w);                 // buz / kükürt / pas lekeleri
    col = mix(col, vec3(0.86, 0.9, 0.94), smoothstep(1.0 - uP.w * 0.35, 1.0 - uP.w * 0.2, lat + n * 0.1) * step(0.01, uP.w));
    land = 1.0; clouds = uQ.y * smoothstep(0.2, 0.6, fbm(q * 1.8 + uTime * 0.005));
  } else if (uCls < 1.5 || (uCls > 14.5 && uCls < 15.5)) { // karasal / bahçe: kıtalar, biyomlar, kutuplar
    float sea = uQ.x; land = smoothstep(sea, sea + 0.035, n); coast = exp(-abs(n - sea) * 22.0);
    vec3 ocean = mix(uC3 * 0.45, uC3, smoothstep(-0.45, sea, n));
    float moist = fbm(w * 2.4 + 11.0); float h2 = smoothstep(sea + 0.05, sea + 0.45, n);
    vec3 ground = mix(uC1, uC2, smoothstep(-0.15, 0.35, moist));                              // orman ↔ kuru ova
    ground = mix(ground, uC4, smoothstep(0.32, 0.0, lat) * uP.z * smoothstep(-0.2, 0.3, moist + 0.2)); // ekvator çölü
    ground = mix(ground, ground * 0.7 + vec3(0.12), h2 * 0.6);                                // yükseklik
    ground = mix(ground, vec3(0.92), smoothstep(0.72, 0.85, ridged(w * 3.0)) * uQ.w);           // karlı zirveler
    col = mix(ocean, ground, land); col = mix(col, vec3(0.93), smoothstep(1.0 - uP.w * 0.3, 1.0 - uP.w * 0.18, lat + n * 0.18));
    spec = 1.0 - land; clouds = uQ.y * smoothstep(0.05, 0.5, fbm(q * 2.3 + vec3(uTime * 0.01, 0.0, uTime * 0.006)) + 0.1 * sin(p.y * 12.0));
  } else if (uCls < 2.5) { // okyanus: adalar, sığlıklar
    land = smoothstep(uQ.x, uQ.x + 0.03, n); coast = exp(-abs(n - uQ.x) * 22.0);
    vec3 sea = mix(uC3 * 0.4, uC3, smoothstep(-0.5, uQ.x, n)); sea = mix(sea, uC4, smoothstep(uQ.x - 0.08, uQ.x, n) * 0.6); // sığ turkuaz
    col = mix(sea, uC1, land); col = mix(col, vec3(0.92), smoothstep(1.0 - uP.w * 0.3, 1.0 - uP.w * 0.18, lat + n * 0.15));
    spec = 1.0 - land; clouds = uQ.y * smoothstep(0.1, 0.5, fbm(q * 2.6 + vec3(uTime * 0.012, 0.0, 0.0)));
  } else if (uCls < 3.5 || (uCls > 11.5 && uCls < 12.5)) { // gaz devi / sera: bant, jet akımı, fırtınalar
    float bf = uQ.x; float ww = fbm(vec3(p.x * 2.0, p.y * bf * 0.4, p.z * 2.0) * uP.x + uSeed + vec3(uTime * 0.008, 0.0, 0.0));
    float yy = p.y + ww * 0.08 * uP.y;
    float b = sin(yy * bf + uSeed) * 0.6 + sin(yy * bf * 2.3 + uSeed * 1.7) * 0.4;
    float fine = fbm(vec3(p.x * 5.0, yy * bf * 1.6, p.z * 5.0) * uP.x + uSeed * 2.0);
    col = mix(uC1, uC2, smoothstep(-0.6 * k, 0.6 * k, b + fine * 0.6 * uP.y));
    col = mix(col, uC3, smoothstep(0.2, 0.6, fine) * 0.45);
    col *= 1.0 - smoothstep(0.75, 1.0, lat) * 0.35;                                           // kutup kararması
    float st = 0.0; for (int i = 0; i < 3; i++) { float fi = float(i); vec3 h = hash3(vec3(uSeed, fi, 3.0)) * 0.5 + 0.5;
      float lo = atan(p.z, p.x) - h.x * 6.28 - uTime * 0.004 * (h.z - 0.5); lo = mod(lo + 3.14159, 6.28318) - 3.14159;
      float la = p.y - (h.y - 0.5) * 1.1; float sz = (0.05 + 0.12 * h.z) * (fi < 0.5 ? 1.6 : 0.8);
      float e = length(vec2(lo * 0.55, la * 1.6)) / sz; st = max(st, smoothstep(1.0, 0.3, e) * step(fi, uP.z * 3.0 - 0.01)); }
    col = mix(col, uC4, st * 0.85);
  } else if (uCls < 4.5) { // buz devi: soluk bantlar, karanlık leke, metan bulutları
    float b = sin(p.y * uQ.x + fbm(q * 2.0) * 2.0 * uP.y); col = mix(uC1, uC2, b * 0.22 * k + 0.5);
    float lo = atan(p.z, p.x) - uSeed; lo = mod(lo + 3.14159, 6.28318) - 3.14159;
    float spot = smoothstep(1.0, 0.4, length(vec2(lo * 0.6, (p.y + 0.25) * 2.2)) / 0.14) * uP.z; col = mix(col, uC3, spot * 0.7);
    col = mix(col, vec3(0.95), smoothstep(0.62, 0.8, fbm(vec3(p.x * 3.0, p.y * 14.0, p.z * 3.0) + uSeed)) * uQ.y);
  } else if (uCls < 5.5) { // buz: çizgisel çatlaklar, kirli buz
    float r = ridged(w * 4.0); float lin = 1.0 - smoothstep(0.0, 0.04, abs(noise(w * 3.0 + 2.0)));
    col = mix(uC1, uC2, smoothstep(0.5, 0.9, r)); col = mix(col, uC3, lin * 0.6 * k); col = mix(col, uC4, smoothstep(0.4, 0.7, fbm(w * 1.2)) * uQ.w);
    col *= 1.0 - cr.x * 0.15; col += cr.y * 0.08; spec = 0.3;
  } else if (uCls < 6.5) { // lav
    float r = ridged(w * 3.0 + vec3(0.0, uTime * 0.01, 0.0)); float crack = smoothstep(0.78 - uP.z * 0.1, 0.95, r);
    col = mix(uC1 * 0.5, uC1, n + 0.5); emis = crack + smoothstep(0.1, -0.4, ndl) * 0.15; ecol = mix(uC2, uC3, crack);
  } else if (uCls < 7.5 || (uCls > 15.5 && uCls < 16.5)) { // çöl / karst / savan
    float r = ridged(w * 3.5); col = mix(uC1, uC2, smoothstep(-0.3 * k, 0.5 * k, n)); col = mix(col, uC3, smoothstep(0.82, 0.95, r) * (uCls > 15.5 ? 1.0 : 0.6));
    col = mix(col, uC4, smoothstep(0.45, 0.75, fbm(w * 1.4 + 6.0)) * uQ.w);                 // tuz düzlükleri / bitki
    col = mix(col, vec3(0.9), smoothstep(1.0 - uP.w * 0.3, 1.0 - uP.w * 0.18, lat + n * 0.1) * step(0.01, uP.w));
    land = 1.0; coast = smoothstep(0.82, 0.95, r); clouds = uQ.y * smoothstep(0.35, 0.7, fbm(q * 2.0 + uTime * 0.004));
  } else if (uCls < 8.5) { // orman / bataklık
    col = mix(uC1, uC2, smoothstep(-0.3, 0.4, n)); land = smoothstep(uQ.x - 0.05, uQ.x, n); coast = exp(-abs(n - uQ.x) * 22.0); col = mix(uC3, col, land);
    col = mix(col, uC4, smoothstep(0.55, 0.8, fbm(w * 2.0 + 3.0)) * 0.5); spec = 1.0 - land;
    clouds = uQ.y * smoothstep(0.0, 0.45, fbm(q * 2.4 + vec3(uTime * 0.01, 0.0, 0.0)));
  } else if (uCls < 9.5) { // kar / buzul süper dünya
    col = mix(uC1, uC2, smoothstep(0.0, 0.5, n)); col = mix(col, uC3, smoothstep(0.2, 0.05, lat) * smoothstep(-0.1, 0.3, n) * uP.z);
    col = mix(col, uC4, (1.0 - smoothstep(0.0, 0.03, abs(noise(w * 2.5)))) * 0.5); land = 1.0;
    clouds = uQ.y * smoothstep(0.1, 0.5, fbm(q * 2.0 + vec3(uTime * 0.015, 0.0, 0.0)));
  } else if (uCls < 10.5) { // volkanik
    col = mix(uC1, uC2, smoothstep(-0.3, 0.4, fbm(w * 2.6))); col = mix(col, uC4, smoothstep(0.5, 0.75, fbm(w * 1.5 + 8.0)) * uQ.w);
    float hot = smoothstep(0.86, 0.96, ridged(w * 5.0)); emis = hot * 0.8; ecol = uC3; land = 1.0;
    clouds = uQ.y * smoothstep(0.3, 0.7, fbm(q * 1.7 + uTime * 0.006));
  } else if (uCls < 11.5) { // cam
    col = uC1 * (0.6 + 0.4 * n) + uC4 * smoothstep(0.7, 0.9, ridged(w * 5.0)) * 0.3; spec = 2.0; land = 1.0;
  } else if (uCls < 13.5) { // smog
    col = mix(uC1, uC2, smoothstep(-0.3, 0.4, n)); land = 1.0; clouds = uQ.y * (0.55 + 0.3 * fbm(q * 2.0 + uTime * 0.01));
  } else if (uCls < 14.5) { // gelgit kilitli: gündüz kavruk, gece buz, ara kuşak yaşanır
    float t = ndl; col = mix(uC2, uC1, smoothstep(-0.2, 0.25, t)); col = mix(col, uC3, smoothstep(0.2, 0.0, abs(t - 0.02)) * (0.6 + 0.4 * n));
    land = 1.0; coast = 0.5; col *= 0.8 + 0.3 * ridged(w * 3.0); col *= 1.0 - cr.x * 0.15;
  } else { col = vec3(0.0); }
  // aydınlatma
  vec3 lit = col * (0.012 + 0.9 * max(ndl, 0.0) * day) * uStarCol;
  #if OCT > 5
  { float e = 0.004; float hx = fbm(w * 6.0 + vec3(e, 0.0, 0.0)) - fbm(w * 6.0); float hy = fbm(w * 6.0 + vec3(0.0, e, 0.0)) - fbm(w * 6.0); // yüksek kalite: yüzey kabartı gölgesi
    lit *= 1.0 + clamp((hx + hy) * 40.0 * dot(L, normalize(vec3(1.0, 1.0, 0.0))), -0.25, 0.25) * land; }
  #endif
  if (clouds > 0.0) lit = mix(lit, vec3(1.0) * (0.03 + max(ndl, 0.0)) * uStarCol, clamp(clouds, 0.0, 1.0) * 0.85);
  vec3 H = normalize(L + V); lit += uStarCol * pow(max(dot(N, H), 0.0), 60.0) * spec * 0.35 * day;
  float cl = cityLights(p, land, ndl, coast);
  vec3 warm = uCityMode > 3.5 ? vec3(1.0, 0.74, 0.46) : vec3(1.0, 0.64, 0.32);
  lit += warm * cl * (1.0 - day) * (1.0 - clamp(clouds, 0.0, 1.0) * 0.85) * (uCityMode > 3.5 ? 0.34 : 0.55);
  lit += ecol * emis * 1.4;
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
