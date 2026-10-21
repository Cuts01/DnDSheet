import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Config separada sin el plugin PWA. Svelte compila los runes de i18n.svelte.ts que usan las reglas.
export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['src/**/*.test.ts']
  }
});
