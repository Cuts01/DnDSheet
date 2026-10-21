import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

/* Solo en npm run dev: sirve content/dist en /__content/ para actualizar los packs con un botón. */
const contentDev = {
  name: 'content-dev',
  apply: 'serve' as const,
  configureServer(server: { middlewares: { use: (p: string, fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b?: string) => void; statusCode: number }) => void) => void } }) {
    server.middlewares.use('/__content', async (req, res) => {
      const name = (req.url ?? '').replace(/^\//, '');
      if (!/^wiki-(2014|2024)\.json$/.test(name)) {
        res.statusCode = 404;
        return res.end();
      }
      try {
        res.setHeader('Content-Type', 'application/json');
        const fsName = 'node:fs/promises';
        const fs = await import(/* @vite-ignore */ fsName);
        res.end(await fs.readFile(new URL(`./content/dist/${name}`, import.meta.url), 'utf8'));
      } catch {
        res.statusCode = 404;
        res.end();
      }
    });
  }
};

// base relativa: funciona igual en GitHub Pages (/repo/), en la raiz de un dominio o en local.
export default defineConfig({
  base: './',
  // Versión visible en Datos para saber qué código está corriendo.
  define: { __APP_VERSION__: JSON.stringify('2026-10-20 · pact boons, invocations y límites') },
  plugins: [
    contentDev,
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Hoja 5e',
        short_name: 'Hoja 5e',
        description: 'Hoja de personaje personal para D&D 5e, offline.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#121318',
        theme_color: '#121318',
        lang: 'es',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Solo se cachea el codigo de la app. El contenido (personaje, compendium) vive en IndexedDB.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true
      }
    })
  ]
});
