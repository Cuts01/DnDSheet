import { describe, expect, it } from 'vitest';
import { blankCharacter, type Character } from '../model/character';
import { saveBonus } from './derive';

describe('Aura of Protection', () => {
  it('suma el Charisma modifier (mínimo +1) a los saves desde Paladin 6', () => {
    const base = blankCharacter();
    const c: Character = { ...base, ruleset: '2024', abilities: { str: 20, dex: 12, con: 12, int: 5, wis: 10, cha: 20 }, saves: ['wis', 'cha'] };
    c.classes = [{ ...base.classes[0], id: 'p', name: 'Paladin', level: 5 } as Character['classes'][number]];
    const before = saveBonus(c, 'str');
    c.classes[0].level = 6;
    expect(saveBonus(c, 'str') - before).toBe(5);
    c.abilities.cha = 8;
    expect(saveBonus(c, 'str') - before).toBe(1);
  });
});
