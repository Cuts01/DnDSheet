import { describe, expect, it } from 'vitest';
import { blankCharacter, type Character } from '../model/character';
import { castEffect, endConcentration, gainTemp, takeShape } from './castEffects';
import { damage, heal, longRest } from './rests';
import { castSpell } from './spells';

const pc = (ruleset: '2014' | '2024'): Character => {
  const c: Character = { ...blankCharacter(), ruleset };
  c.classes = [{ ...c.classes[0], name: 'Wizard', level: 9 }].filter(Boolean) as Character['classes'];
  c.hp = { max: 50, current: 40, temp: 0 };
  return c;
};

describe('efectos al lanzar', () => {
  it('Armor of Agathys da 5 temp HP por nivel de slot y no se suma', () => {
    const c = pc('2014');
    expect(castEffect(c, 'Armor of Agathys', 1)).toEqual({ kind: 'temp', amount: 5 });
    expect(castEffect(c, 'Armor of Agathys', 3)).toEqual({ kind: 'temp', amount: 15 });
    expect(gainTemp({ ...c, hp: { ...c.hp, temp: 8 } }, 5).hp.temp).toBe(8);
    expect(gainTemp({ ...c, hp: { ...c.hp, temp: 8 } }, 15).hp.temp).toBe(15);
  });
  it('False Life cambia de dados según el ruleset', () => {
    expect(castEffect(pc('2014'), 'False Life', 2)).toEqual({ kind: 'tempRoll', count: 1, sides: 4, bonus: 9 });
    expect(castEffect(pc('2024'), 'False Life', 1)).toEqual({ kind: 'tempRoll', count: 2, sides: 4, bonus: 4 });
  });
});

describe('Polymorph', () => {
  const ape = { name: 'Giant Ape', cr: 7, hp: 157, ac: 12, size: 'Huge', speed: '40 ft' };
  it('2014: la forma tiene HP propios y el sobrante pasa a tus HP', () => {
    let c = castSpell(pc('2014'), null, 'Polymorph');
    c = takeShape(c, ape, 'pool');
    c = damage(c, 20);
    expect(c.shape?.hp).toBe(137);
    expect(c.hp.current).toBe(40);
    c = heal(c, 10);
    expect(c.shape?.hp).toBe(147);
    c = damage(c, 150);
    expect(c.shape).toBeNull();
    expect(c.concentration).toBe('');
    expect(c.hp.current).toBe(37);
  });
  it('2024: da temp HP y termina al acabarse', () => {
    let c = castSpell(pc('2024'), null, 'Polymorph');
    c = takeShape(c, { ...ape, hp: 168 }, 'temp');
    expect(c.hp.temp).toBe(168);
    c = damage(c, 170);
    expect(c.shape).toBeNull();
    expect(c.concentration).toBe('');
    expect(c.hp.current).toBe(38);
  });
  it('terminar la concentration o concentrarse en otro spell quita la forma', () => {
    let c = takeShape(castSpell(pc('2024'), null, 'Polymorph'), ape, 'temp');
    expect(endConcentration(c).shape).toBeNull();
    expect(endConcentration(c).hp.temp).toBe(0);
    c = castSpell(c, null, 'Haste');
    expect(c.shape).toBeNull();
    expect(c.concentration).toBe('Haste');
    expect(longRest(takeShape(pc('2014'), ape, 'pool')).shape).toBeNull();
  });
});
