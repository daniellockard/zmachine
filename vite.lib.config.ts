import { defineConfig } from 'vite';
import path from 'path';

/**
 * Vite configuration for building a minified library bundle.
 * Outputs: dist/zmachine.min.js (UMD) and dist/zmachine.esm.min.js (ESM)
 */
export default defineConfig({
  esbuild: {
    // Handle TypeScript properly
    target: 'es2020',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'ZMachine',
      formats: ['umd', 'es'],
      fileName: (format) => format === 'umd' ? 'zmachine.min.js' : 'zmachine.esm.min.js',
    },
    minify: 'esbuild', // Use esbuild (built-in, no extra install)
    rollupOptions: {
      output: {
        // Ensure the UMD build exposes ZMachine globally
        globals: {},
        exports: 'named',
      },
    },
    sourcemap: true,
  },
});
