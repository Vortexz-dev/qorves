/* Beden görselleri üzerindeki anatomik noktalar (576×1024 görsel uzayı) ve damar/sinir yolları. */
export type Pt = [number, number];
export interface Body {
  img: string;
  brain: Pt; os: Pt; face: Pt; neck: Pt; heart: Pt; ribs: Pt; spine: Pt; pelvis: Pt; thighL: Pt;
  shL: Pt; shR: Pt; elL: Pt; elR: Pt; wrL: Pt; wrR: Pt; haL: Pt; haR: Pt;
  hipL: Pt; hipR: Pt; knL: Pt; knR: Pt; anL: Pt; anR: Pt; ftL: Pt; ftR: Pt; top: number; foot: number;
}
export const HUMAN: Body = {
  img: 'img/persona/body-human.webp',
  brain: [290, 62], os: [312, 78], face: [290, 108], neck: [290, 172], heart: [303, 268], ribs: [258, 292], spine: [290, 390], pelvis: [290, 468], thighL: [228, 590],
  shL: [206, 208], shR: [376, 208], elL: [152, 362], elR: [430, 362], wrL: [106, 468], wrR: [474, 468], haL: [84, 525], haR: [496, 525],
  hipL: [242, 498], hipR: [338, 498], knL: [228, 686], knR: [348, 686], anL: [214, 900], anR: [362, 900], ftL: [204, 952], ftR: [376, 952], top: 28, foot: 975,
};
export const DWARF: Body = {
  img: 'img/persona/body-dwarf.webp',
  brain: [288, 86], os: [312, 100], face: [288, 136], neck: [288, 205], heart: [300, 290], ribs: [252, 310], spine: [288, 400], pelvis: [288, 500], thighL: [215, 600],
  shL: [182, 226], shR: [396, 226], elL: [122, 386], elR: [458, 386], wrL: [72, 482], wrR: [506, 482], haL: [50, 525], haR: [528, 525],
  hipL: [236, 522], hipR: [342, 522], knL: [210, 690], knR: [370, 690], anL: [195, 882], anR: [384, 882], ftL: [182, 932], ftR: [398, 932], top: 50, foot: 950,
};
const path = (ps: Pt[], dx = 0) => ps.map((p, i) => (i ? 'L' : 'M') + (p[0] + dx).toFixed(0) + ' ' + p[1].toFixed(0)).join(' ');
/** Atardamarlar (kırmızı, kalpten dışa), toplardamarlar (mavi, kalbe), sinirler (sarı, beyinden). */
export function vessels(b: Body) {
  const sp = (y: number): Pt => [b.spine[0], y];
  const art = [
    [b.heart, [b.neck[0] - 6, b.neck[1]], [b.face[0] - 8, b.face[1]], b.brain],
    [b.heart, [b.shL[0] + 20, b.shL[1] + 8], b.elL, b.wrL, b.haL],
    [b.heart, [b.shR[0] - 20, b.shR[1] + 8], b.elR, b.wrR, b.haR],
    [b.heart, [b.heart[0] - 8, b.heart[1] + 70], [b.pelvis[0] - 4, b.pelvis[1] - 20], b.hipL, b.knL, b.anL, b.ftL],
    [b.heart, [b.heart[0] - 8, b.heart[1] + 70], [b.pelvis[0] + 4, b.pelvis[1] - 20], b.hipR, b.knR, b.anR, b.ftR],
  ] as Pt[][];
  const vein = art.map((ps) => ps.slice().reverse());
  const ner = [
    [b.brain, b.neck, sp(b.ribs[1]), sp(b.spine[1]), b.pelvis],
    [sp(b.shL[1] + 10), b.shL, b.elL, b.wrL, b.haL],
    [sp(b.shR[1] + 10), b.shR, b.elR, b.wrR, b.haR],
    [b.pelvis, b.hipL, b.knL, b.anL, b.ftL],
    [b.pelvis, b.hipR, b.knR, b.anR, b.ftR],
  ] as Pt[][];
  return { art: art.map((p) => path(p, -3)), vein: vein.map((p) => path(p, 4)), ner: ner.map((p) => path(p)) };
}
