import { defineConfig } from 'vitest/config';

// Config separada: los tests del motor de reglas no necesitan Svelte ni el plugin PWA.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts']
  }
});
