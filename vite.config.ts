import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({
  base: '/qorves/',
  plugins: [svelte()],
  build: { target: 'es2022', chunkSizeWarningLimit: 800 },
});
