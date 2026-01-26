import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Use jsdom for web tests, node for everything else
    environmentMatchGlobs: [
      ['src/web/**/*.test.ts', 'jsdom'],
    ],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/web/main.ts'],
    },
  },
});
