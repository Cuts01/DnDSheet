import { describe, expect, it } from 'vitest';
import { MIN_WIKI_BUILT } from './packImport';

const shipped = import.meta.glob<{ pack: { id: string; built: string } }>('../../public/packs/wiki-*.json', { eager: true, import: 'default' });

/* Los packs que vienen con la app nunca deben verse como "versión antigua". */
describe('packs de la wiki', () => {
  it('hay un mínimo para cada pack incluido', () => {
    expect(Object.values(shipped).map((p) => p.pack.id).sort()).toEqual(Object.keys(MIN_WIKI_BUILT).sort());
  });
  for (const p of Object.values(shipped)) {
    it(`${p.pack.id} incluido en la app cumple la fecha mínima`, () => {
      expect(p.pack.built >= MIN_WIKI_BUILT[p.pack.id]).toBe(true);
    });
  }
});
