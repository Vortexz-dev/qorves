import { backend, type UserProfile, type World } from './backend';
export type Stage = 'boot' | 'press' | 'login' | 'register' | 'desktop';
export const session = $state<{ stage: Stage; user: UserProfile | null; world: World | null; remembered: UserProfile | null }>({
  stage: 'boot', user: null, world: null, remembered: null,
});
export async function enterDesktop(u: UserProfile) {
  session.user = u; session.world = await backend.world(); session.stage = 'desktop';
}
export async function logout() {
  await backend.logout(); session.user = null; session.remembered = null; session.stage = 'press';
}
export function lock() { session.remembered = session.user; session.user = null; session.stage = 'press'; }
