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
export interface Note { id: string; title: string; body: string; x: number; y: number; updatedAt: number }
export interface VaultKey { id: string; k: string; f: string }
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
  listNotes(uid: string): Promise<Note[]>;
  saveNote(uid: string, note: Note): Promise<void>;
  deleteNote(uid: string, id: string): Promise<void>;
  deleteAllNotes(uid: string): Promise<void>;
  /** Bu kullanıcının açabildiği içerik anahtarları (DM: hepsi). */
  vaultKeys(user: UserProfile): Promise<VaultKey[]>;
}
export class AuthError extends Error {}
