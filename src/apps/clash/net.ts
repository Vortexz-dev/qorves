/* SPIRE//CLASH ağ katmanı — Firestore (Spark) üstünde komut kilit-adımı (lockstep).
   Durum hiç gönderilmez; yalnız "şu tikte şu kartı şuraya koydum" komutları yazılır (maç başına ~50–120 yazma).
   İki istemci aynı tohum + aynı komutlarla aynı simülasyonu koşar. Geç gelen komut geri sarma ile işlenir. Bkz. docs: CLASH_NET.md */
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, query, where, getDocs, runTransaction, serverTimestamp, Timestamp, updateDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../../lib/backend/firebase';
import { DEFAULT_DECK, validDeck } from './cards';
import type { Cmd, Side } from './engine';

export interface Profile { deck: string[]; w: number; l: number; d: number; cr: number; name: string }
export async function loadProfile(uid: string, name: string): Promise<Profile> {
  try { const s = await getDoc(doc(db, 'clash_decks', uid)); const d = s.data() as Partial<Profile> | undefined; return { deck: validDeck(d?.deck) ? d!.deck! : DEFAULT_DECK.slice(), w: d?.w ?? 0, l: d?.l ?? 0, d: d?.d ?? 0, cr: d?.cr ?? 0, name }; }
  catch { return { deck: DEFAULT_DECK.slice(), w: 0, l: 0, d: 0, cr: 0, name }; }
}
export async function saveProfile(uid: string, p: Profile) { await setDoc(doc(db, 'clash_decks', uid), { deck: p.deck, w: p.w, l: p.l, d: p.d, cr: p.cr, name: p.name.slice(0, 40), at: Date.now() }); }

export interface Match { id: string; players: [string, string]; names: [string, string]; decks: { 0: string[]; 1: string[] } | [string[], string[]]; cr: [number, number]; seed: number; t0: number; left?: string[]; res?: Record<string, { w: number; h: string; c: number[] }> }

/** Sunucu saati farkı: kendi kuyruk belgemize serverTimestamp yazıp geri okuruz. */
async function serverOffset(uid: string): Promise<number> {
  const r = doc(db, 'clash_queue', uid);
  const a = Date.now(); await setDoc(r, { ping: serverTimestamp() }, { merge: true });
  const b = Date.now(); const s = await getDoc(r); const ts = (s.data()?.ping as Timestamp | undefined)?.toMillis();
  return ts ? ts - (a + b) / 2 : 0;
}

/** Rakip ara. Bulunca / eşleşilince onMatch çağrılır. Dönen fonksiyon aramayı iptal eder. */
export function seek(me: { uid: string; name: string; deck: string[]; cr: number }, onMatch: (m: Match, side: Side, offset: number) => void, onErr: (e: unknown) => void): () => void {
  let stop = false, un: Unsubscribe | null = null, poll: ReturnType<typeof setInterval> | null = null, off = 0;
  const qref = doc(db, 'clash_queue', me.uid);
  const done = async (mid: string) => {
    if (stop) return; stop = true; un?.(); if (poll) clearInterval(poll);
    const ms = await getDoc(doc(db, 'clash_matches', mid)); const m = { ...(ms.data() as Omit<Match, 'id'>), id: mid } as Match;
    await deleteDoc(qref).catch(() => {});
    onMatch(m, m.players[0] === me.uid ? 0 : 1, off);
  };
  (async () => {
    off = await serverOffset(me.uid);
    await setDoc(qref, { uid: me.uid, name: me.name.slice(0, 40), deck: me.deck, cr: me.cr, at: serverTimestamp(), match: null });
    un = onSnapshot(qref, (s) => { const m = s.data()?.match; if (m) done(m); });
    const tryPair = async () => {
      if (stop) return;
      const since = Timestamp.fromMillis(Date.now() + off - 45000);
      const qs = await getDocs(query(collection(db, 'clash_queue'), where('at', '>', since)));
      const others = qs.docs.filter((d) => d.id !== me.uid && !d.data().match && validDeck(d.data().deck)).sort((a, b) => (a.data().at?.toMillis?.() ?? 0) - (b.data().at?.toMillis?.() ?? 0));
      for (const o of others) {
        try {
          const mid = await runTransaction(db, async (tx) => {
            const mine = await tx.get(qref), theirs = await tx.get(o.ref);
            if (!mine.exists() || !theirs.exists() || mine.data()!.match || theirs.data()!.match) return null;
            const t = theirs.data()!; const id = Math.random().toString(36).slice(2, 12);
            const seed = (Math.random() * 2 ** 31) | 0;
            // eski kuyruktaki (önce gelen) host = taraf 0
            tx.set(doc(db, 'clash_matches', id), { players: [o.id, me.uid], names: [String(t.name).slice(0, 40), me.name.slice(0, 40)], decks: { 0: t.deck, 1: me.deck } /* Firestore iç içe dizi kabul etmez → harita */, cr: [t.cr ?? 0, me.cr], seed,
              t0: Date.now() + off + 5000, at: serverTimestamp(), left: [] });
            tx.update(o.ref, { match: id }); tx.update(qref, { match: id });
            return id;
          });
          if (mid) return; // dinleyici done()'u tetikler
        } catch { /* yarış: başka biri aldı */ }
      }
    };
    await tryPair(); poll = setInterval(tryPair, 3500);
  })().catch(onErr);
  return () => { stop = true; un?.(); if (poll) clearInterval(poll); deleteDoc(qref).catch(() => {}); };
}

/** Maç kanalı: komut gönder/al, ayrılma ve sonuç. */
export function channel(m: Match, side: Side, onCmd: (c: Cmd) => void, onLeft: (who: string) => void) {
  const col = collection(db, 'clash_matches', m.id, 'cmds');
  let n = 0;
  const un1 = onSnapshot(col, (s) => { for (const ch of s.docChanges()) if (ch.type === 'added') { const d = ch.doc.data() as { t: number; s: Side; c: string; x: number; y: number; n: number }; onCmd({ t: d.t, side: d.s, card: d.c, x: d.x, y: d.y, n: d.n }); } });
  const un2 = onSnapshot(doc(db, 'clash_matches', m.id), (s) => { const l = (s.data()?.left as string[] | undefined) ?? []; for (const u of l) if (u !== m.players[side]) onLeft(u); });
  return {
    send: (c: Omit<Cmd, 'n' | 'side'>) => { const k = n++; const id = `${side}_${String(k).padStart(4, '0')}`; return setDoc(doc(col, id), { u: m.players[side], s: side, t: c.t, c: c.card, x: c.x, y: c.y, n: k }); },
    leave: () => updateDoc(doc(db, 'clash_matches', m.id), { left: [...new Set([m.players[side]])] }).catch(() => {}),
    result: (w: number, h: string, c: number[]) => updateDoc(doc(db, 'clash_matches', m.id), { [`res.${side}`]: { w, h, c } }).catch(() => {}),
    close: () => { un1(); un2(); },
  };
}
