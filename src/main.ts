import './global.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { reloadOnce } from './lib/chunk';
// Vite ön yükleme hatası (eski yayının CSS/JS parçası silinmiş): bir kez yenile.
addEventListener('vite:preloadError', (e) => { if (reloadOnce()) e.preventDefault(); });
// Sekme gizlenince CSS animasyonları ve ses durur (boşta FPS harcanmaz).
document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('paused', document.hidden));
document.addEventListener('contextmenu', (e) => { if (!(e.target as HTMLElement).closest('input,textarea')) e.preventDefault(); });
export default mount(App, { target: document.getElementById('app')! });
