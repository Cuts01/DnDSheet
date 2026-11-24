import { describe, expect, it } from 'vitest';
import { blankCharacter, type Character } from '../model/character';
import type { Pack } from '../model/pack';
import { applyBackground, applySpecies, backgroundList, speciesList } from './features';
import w2014 from '../../../public/packs/wiki-2014.json';
import w2024 from '../../../public/packs/wiki-2024.json';
import { PackSchema } from '../model/pack';

const packs = [PackSchema.parse(w2014), PackSchema.parse(w2024)] as Pack[];
const pc = (ruleset: '2014' | '2024'): Character => ({ ...blankCharacter(), ruleset, abilities: { str: 8, dex: 14, con: 13, int: 10, wis: 15, cha: 12 } });
const bg = (pack: string, name: string) => backgroundList(packs, '2024').find((r) => r.pack.pack.id === pack && r.item.name === name)!;
const sp = (pack: string, name: string) => speciesList(packs, '2024').find((r) => r.pack.pack.id === pack && r.item.name === name)!;

describe('contenido 2014 en un PJ 2024', () => {
  it('background 2014: +2/+1 a las mejores características y un Origin feat a elegir', () => {
    const c = applyBackground(pc('2024'), bg('wiki-2014', 'Athlete'), packs);
    expect(c.bonuses.background).toEqual([{ ability: 'wis', amount: 2 }, { ability: 'dex', amount: 1 }]);
    expect(c.feats.filter((f) => f.source === 'background')).toHaveLength(1);
  });
  it('background 2014 con feat propio lo conserva sin agregar otro', () => {
    const c = applyBackground(pc('2024'), bg('wiki-2014', 'Giant Foundling'), packs);
    const f = c.feats.filter((x) => x.source === 'background');
    expect(f).toHaveLength(1);
    expect(f[0].name).toBe('Strike of the Giants');
  });
  it('en un PJ 2014 el background 2014 no da aumentos ni feat', () => {
    const c = applyBackground(pc('2014'), backgroundList(packs, '2014').find((r) => r.item.name === 'Athlete')!, packs);
    expect(c.bonuses.background).toEqual([]);
    expect(c.feats).toHaveLength(0);
  });
  it('species 2014 en un PJ 2024 no da aumentos', () => {
    const ref = speciesList(packs, '2024').find((r) => r.pack.pack.id === 'wiki-2014' && Object.keys(r.item.asi.fixed).length)!;
    expect(applySpecies(pc('2024'), ref).bonuses.species).toEqual([]);
    expect(applySpecies(pc('2014'), ref).bonuses.species.length).toBeGreaterThan(0);
  });
  it('background 2024 sigue igual', () => {
    const r = backgroundList(packs, '2024').find((x) => x.pack.pack.id === 'wiki-2024' && x.item.asi.length === 3)!;
    const c = applyBackground(pc('2024'), r, packs);
    expect(c.bonuses.background.map((b) => b.ability)).toEqual(r.item.asi.slice(0, 2));
  });
  void sp;
});
