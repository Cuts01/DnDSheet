import { describe, expect, it } from 'vitest';
import en from './i18n/en';

// Textos que se escriben igual en los dos idiomas.
const SAME = new Set(['total']);

describe('i18n', () => {
  it('cada texto pasado a t() tiene traducción al inglés', async () => {
    const fsName = 'node:fs';
    const pathName = 'node:path';
    const fs = await import(/* @vite-ignore */ fsName);
    const path = await import(/* @vite-ignore */ pathName);
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.(svelte|ts)$/.test(f.name) && !f.name.endsWith('.test.ts') && !p.includes('i18n')) files.push(p);
      }
    };
    walk('src');
    const missing: string[] = [];
    for (const f of files) {
      const src: string = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\btr?\(\s*'((?:[^'\\]|\\.)*)'/g)) {
        const key = m[1].replace(/\\'/g, "'");
        if (!(key in en) && !SAME.has(key)) missing.push(`${path.basename(f)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('las traducciones conservan los placeholders', () => {
    for (const [es, txt] of Object.entries(en)) {
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
      expect(ph(txt), es).toBe(ph(es));
    }
  });
});
