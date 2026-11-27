import { describe, expect, it } from 'vitest';
import { blankCharacter, type Character } from '../model/character';
import { armorClassInfo } from './derive';

const pc = (): Character => ({ ...blankCharacter(), ruleset: '2024', abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } });

describe('spells que cambian la AC', () => {
  it('Shield of Faith suma +2 solo mientras hay concentration y solo en Combate', () => {
    const c = pc();
    const base = armorClassInfo(c, [], { spells: true }).total;
    c.concentration = 'Shield of Faith';
    expect(armorClassInfo(c, [], { spells: true }).total).toBe(base + 2);
    expect(armorClassInfo(c).total).toBe(base);
  });
  it('Mage Armor y Shield se acumulan; Barkskin 2024 pone mínimo 17', () => {
    const c = pc();
    c.activeEffects = ['Mage Armor', 'Shield'];
    expect(armorClassInfo(c, [], { spells: true }).total).toBe(13 + 2 + 5);
    c.activeEffects = ['Barkskin'];
    expect(armorClassInfo(c, [], { spells: true }).total).toBe(17);
  });
});
