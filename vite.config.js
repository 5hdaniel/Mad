import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Sentry source map upload (TASK-1967)
    // Only active during release builds when SENTRY_AUTH_TOKEN is available
    ...(process.env.SENTRY_AUTH_TOKEN ? [
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: 'magicaudit',
        project: 'electron',
        sourcemaps: {
          filesToDeleteAfterUpload: ['**/*.js.map'], // Don't ship source maps
        },
      }),
    ] : []),
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron'),
      '@types': path.resolve(__dirname, './types'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true, // Enable sourcemaps for better debugging
  },
  // Ensure TypeScript files are handled
  esbuild: {
    loader: 'tsx',
    include: /src\/.*\.[tj]sx?$/,
  },
});
