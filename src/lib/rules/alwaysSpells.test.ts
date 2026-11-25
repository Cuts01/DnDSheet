import { describe, expect, it } from 'vitest';
import { blankCharacter, type Character } from '../model/character';
import { PackSchema, type Pack } from '../model/pack';
import { subclassSpells } from './spells';
import w2014 from '../../../public/packs/wiki-2014.json';
import w2024 from '../../../public/packs/wiki-2024.json';

const packs = [PackSchema.parse(w2014), PackSchema.parse(w2024)] as Pack[];
const pal = (level: number): Character => {
  const b = blankCharacter();
  return { ...b, ruleset: '2024', classes: [{ ...b.classes[0], id: 'p', name: 'Paladin', level, caster: 'half', spellAbility: 'cha', subclassId: null } as Character['classes'][number]] };
};

describe('spells always prepared por features de clase', () => {
  it('Paladin 2024: Divine Smite desde 2 y Find Steed desde 5', () => {
    expect(subclassSpells(pal(1), packs).always.map((s) => s.name)).toEqual([]);
    expect(subclassSpells(pal(2), packs).always.map((s) => s.name)).toEqual(['Divine Smite']);
    expect(subclassSpells(pal(7), packs).always.map((s) => s.name).sort()).toEqual(['Divine Smite', 'Find Steed']);
  });
  it('Ranger 2024: Hunter’s Mark desde 1', () => {
    const c = pal(1);
    c.classes[0].name = 'Ranger';
    expect(subclassSpells(c, packs).always.map((s) => s.name)).toEqual(["Hunter's Mark"]);
  });
});
