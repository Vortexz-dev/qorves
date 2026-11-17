import { backend, type UserProfile, type World } from './backend';
import { resetKb } from './kb.svelte';
import { tagui } from './tags.svelte';
import { notes } from './notes.svelte';
import { LIVE, watchProfile } from './live';
export type Stage = 'boot' | 'press' | 'login' | 'register' | 'desktop';
export const session = $state<{ stage: Stage; user: UserProfile | null; world: World | null; remembered: UserProfile | null }>({
  stage: 'boot', user: null, world: null, remembered: null,
});
let stopUser = () => {};
export async function enterDesktop(u: UserProfile) {
  stopUser();
  session.user = u; session.world = await backend.world(); session.stage = 'desktop';
  u.lastLogin = Date.now(); backend.patchProfile(u.uid, { lastLogin: u.lastLogin }).catch(() => {});
  if (LIVE) stopUser = watchProfile(u.uid, (nu) => {
    if (!session.user || session.user.uid !== nu.uid) return;
    Object.assign(session.user, nu);
  });
}
export async function logout() {
  stopUser(); stopUser = () => {};
  await backend.logout(); resetKb(); tagui.stack = []; notes.list = []; notes.loaded = false; session.user = null; session.remembered = null; session.stage = 'press';
}
export function lock() { session.remembered = session.user; session.user = null; session.stage = 'press'; }
