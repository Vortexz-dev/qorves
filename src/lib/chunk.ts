// Yeni yayından sonra açık kalan sekme eski parça adlarını ister (404) ve uygulama kara ekranda kalır.
// Böyle bir yükleme hatasında sayfa bir kez kendini yeniler; döngüye girmemek için 30 sn kilit tutulur.
const RK = 'qv.chunkReload';
export const isChunkErr = (e: unknown) => /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|preload/i.test(String((e as Error)?.message ?? e));
export function reloadOnce(): boolean {
  const last = +(sessionStorage.getItem(RK) || 0);
  if (Date.now() - last < 30_000) return false;
  sessionStorage.setItem(RK, String(Date.now())); location.reload(); return true;
}
export function safeLoad<T>(f: () => Promise<T>): () => Promise<T> {
  return () => f().catch((e) => { if (isChunkErr(e) && reloadOnce()) return new Promise<T>(() => {}); throw e; });
}
