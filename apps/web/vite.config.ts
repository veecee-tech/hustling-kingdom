import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: { port: 5173, strictPort: true },
});
