export type Role = 'player' | 'dm';
export interface Character {
  name: string; age: string; race: string; origin: string; faction: string; clan: string; job: string;
  cls: string; sub: string; cls2: string; sub2: string; level: number; background: string;
  chrome: string; visibleChrome: boolean; stats: Record<string, number>; bio: string;
}
export interface FileMeta { id: string; name: string; type: string; size: number; uploadedAt: number }
export interface UserProfile {
  uid: string; username: string; role: Role; avatar: string; createdAt: number;
  character: Character | null; file: FileMeta | null;
  desktop: { icons: Record<string, { x: number; y: number }> };
  apps: string[];
}
export interface World { era: 'SS'; year: number; day: number }
export interface Backend {
  readonly kind: 'mock' | 'firebase';
  restore(): Promise<UserProfile | null>;
  login(username: string, password: string): Promise<UserProfile>;
  register(username: string, password: string, avatar: string, character: Character, file: File | null): Promise<UserProfile>;
  logout(): Promise<void>;
  patchProfile(uid: string, patch: Partial<UserProfile>): Promise<void>;
  usernameTaken(username: string): Promise<boolean>;
  world(): Promise<World>;
}
export class AuthError extends Error {}
