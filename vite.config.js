import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist'
  },
  server: {
    port: 5173,
    strictPort: false, // If port 5173 is taken, automatically find another available port
    host: true // Listen on all addresses
  }
});
