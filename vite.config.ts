import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'src/web',
  publicDir: 'public',
  // Use VITE_BASE env var for GitHub Pages, otherwise use root
  base: process.env.VITE_BASE || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: '../../dist/web',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/web/index.html'),
      },
    },
  },
  server: {
    port: 8080,
    host: '127.0.0.1',
    open: true,
  },
});
