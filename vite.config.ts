import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: true,
    target: 'es2022',
  },
  test: {
    include: ['../tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
