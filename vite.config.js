import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    port: 3002,
    open: true
  },
  build: {
    outDir: 'dist'
  }
});
