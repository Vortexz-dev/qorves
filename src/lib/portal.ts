/** Öğeyi body'ye taşır (dönüştürülmüş pencerelerin içindeki fixed konum sorununu önler). */
export function portal(node: HTMLElement) { document.body.appendChild(node); return { destroy() { node.remove(); } }; }
/** Yeniden adlandırma kutusu: menü kapandıktan sonra odaklan ve metni seç. */
export function autoSel(n: HTMLInputElement) { const t = setTimeout(() => { n.focus(); n.select(); }, 40); return { destroy: () => clearTimeout(t) }; }
