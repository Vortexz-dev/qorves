import './global.css';
import { mount } from 'svelte';
import App from './App.svelte';
// Sekme gizlenince CSS animasyonları ve ses durur (boşta FPS harcanmaz).
document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('paused', document.hidden));
document.addEventListener('contextmenu', (e) => { if (!(e.target as HTMLElement).closest('input,textarea')) e.preventDefault(); });
export default mount(App, { target: document.getElementById('app')! });
