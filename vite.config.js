import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: false, // If 5173 is busy, try the next available port
    host: 'localhost'
  },
  build: {
    outDir: 'dist'
  }
});
