/* Düello daveti dinleyicisi — masaüstü (CrownHost) de kullanır; oyun motorunu yüklememek için ayrı küçük modül. */
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/backend/firebase';
export interface DuelInv { id: string; from: string; to: string; fromName: string; toName: string; deck: { id: string; lv: number }[]; cr: number; st: 'open' | 'ok' | 'no' | 'gone'; at: number; match?: string }
/** Bana gelen açık davetler (2 dakikadan yeni). */
export const watchInvites = (uid: string, cb: (d: DuelInv[]) => void) =>
  onSnapshot(query(collection(db, 'clash_duels'), where('to', '==', uid), where('st', '==', 'open')), (s) => cb(s.docs.map((d) => ({ ...(d.data() as DuelInv), id: d.id })).filter((d) => Date.now() - d.at < 120_000)), () => cb([]));
