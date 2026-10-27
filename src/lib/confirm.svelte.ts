export const dlg = $state({ open: false, title: '', text: '', ok: 'Tamam', danger: false, resolve: null as null | ((v: boolean) => void) });
export function ask(title: string, text: string, ok = 'Onayla', danger = true): Promise<boolean> {
  return new Promise((r) => Object.assign(dlg, { open: true, title, text, ok, danger, resolve: r }));
}
export function answer(v: boolean) { dlg.resolve?.(v); dlg.open = false; dlg.resolve = null; }
