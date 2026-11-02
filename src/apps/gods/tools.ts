// God's Eye araç yardımcıları: zar atışını sohbete yaz.
import type { Roll } from '../../lib/live';
import { sendChat, colorOf, now } from '../../lib/gods';
import { fmtMod } from '../../lib/dice';
export function rollText(r: Roll) {
  const dice = r.groups.map((g) => (g.keep ? `2d20 [${g.vals.join(', ')}]` : `${Math.abs(g.n)}d${g.d} [${g.vals.join(', ')}]`)).join(' + ');
  const simple = r.groups.length === 1 && !r.mod && !r.adv && r.groups[0].vals.length === 1;
  return `${simple ? '' : r.expr + (r.adv ? (r.adv === 'adv' ? ' AV' : ' DZ') : '') + ' · '}${dice}${r.mod ? ' ' + fmtMod(r.mod) : ''} → ${r.total}${r.nat === 'nat20' ? ' · KRİTİK' : r.nat === 'nat1' ? ' · KRİTİK BAŞARISIZ' : ''}${r.label ? ' · ' + r.label : ''}`.slice(0, 400);
}
export function postRoll(r: Roll, dm: boolean, name: string) {
  return sendChat({ uid: r.uid, name, col: dm ? '#ffffff' : colorOf(r.uid), k: 'roll', t: rollText(r), at: now(), ...(r.nat ? { nat: r.nat } : {}) }).catch(() => {});
}

// ---------- cetvel denetleyicisi (oyuncu + DM ortak) ----------
import { saveRuler, dropRuler, distText, type Ruler, type Scene } from '../../lib/gods';
import { snapEnd } from './render';
export class RulerCtl {
  mine: Ruler | null = null; private last = 0; private t: ReturnType<typeof setTimeout> | undefined; private linger: ReturnType<typeof setTimeout> | undefined;
  constructor(private o: { uid: string; name: string; col: string; sid: () => string; scene: () => Scene | null; mark: () => void }) {}
  private send(final = false) {
    const r = this.mine; if (!r) return; clearTimeout(this.t);
    const go = () => { this.last = now(); saveRuler({ ...r, at: now() }).catch(() => {}); };
    if (final || now() - this.last > 160) go(); else this.t = setTimeout(go, 160);
  }
  start(p: { x: number; y: number }, e: { altKey: boolean }) {
    const s = this.o.scene(); if (!s) return; clearTimeout(this.linger);
    const a = snapEnd([0, 0], p, false, e.altKey, s.grid ?? 0);
    this.mine = { sid: this.o.sid(), uid: this.o.uid, name: this.o.name, col: this.o.col, a, b: [...a], d: distText(s, 0), at: now() }; this.o.mark();
  }
  move(p: { x: number; y: number }, e: { shiftKey: boolean; altKey: boolean }) {
    const s = this.o.scene(), r = this.mine; if (!s || !r) return;
    r.b = snapEnd(r.a, p, e.shiftKey, e.altKey, s.grid ?? 0); r.d = distText(s, Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1])); this.o.mark();
    if (Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) > 4) this.send();
  }
  end() {
    const r = this.mine; if (!r) return; clearTimeout(this.t);
    if (this.last) this.send(true);
    this.linger = setTimeout(() => { this.mine = null; this.last = 0; this.o.mark(); dropRuler(r.sid, r.uid); }, 1600);
  }
  dispose() { clearTimeout(this.t); clearTimeout(this.linger); const r = this.mine; if (r && this.last) dropRuler(r.sid, r.uid); this.mine = null; }
}
