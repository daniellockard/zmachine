import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/web/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/web/**/*.ts'],
      exclude: ['src/web/**/*.test.ts', 'src/web/main.ts'],
    },
  },
});
