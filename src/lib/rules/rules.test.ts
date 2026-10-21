import { describe, expect, it } from 'vitest';
import { CharacterSchema, classFromPreset, CLASS_PRESETS, blankCharacter, type Character } from '../model/character';
import { armorClass, averageHp, casterLevel, pactSlots, profBonus, skillBonus, slotMax, saveBonus, speed } from './derive';
import { damage, heal, longRest, shortRest, validArcane } from './rests';
import { SKILLS } from './tables';

const preset = (name: string, level: number) => classFromPreset(CLASS_PRESETS.find((p) => p.name === name)!, level);

function make(classes: [string, number][], patch: Partial<Character> = {}): Character {
  return { ...blankCharacter(), classes: classes.map(([n, l]) => preset(n, l)), saves: ['wis', 'cha'], ...patch };
}

describe('proficiency y bonos', () => {
  it('PB por nivel', () => {
    expect([1, 4, 5, 8, 9, 13, 17, 20].map(profBonus)).toEqual([2, 2, 3, 3, 4, 5, 6, 6]);
  });
  it('saves y skills con expertise', () => {
    const c = make([['Warlock', 4]], { abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 17 }, skills: { deception: 'expertise', arcana: 'prof' } });
    expect(saveBonus(c, 'cha')).toBe(5);
    expect(saveBonus(c, 'dex')).toBe(2);
    expect(skillBonus(c, SKILLS.find((s) => s.id === 'deception')!)).toBe(7);
    expect(skillBonus(c, SKILLS.find((s) => s.id === 'arcana')!)).toBe(2);
  });
});

describe('spell slots', () => {
  it('Warlock puro: sin spell slots, 2 Pact slots de nivel 2 en nivel 4', () => {
    const c = make([['Warlock', 4]]);
    expect(casterLevel(c)).toBe(0);
    expect(pactSlots(c)).toEqual({ count: 2, slotLevel: 2 });
  });
  it('Warlock 4 / Wizard 2: Pact slots aparte, Wizard como caster level 2', () => {
    const c = make([['Warlock', 4], ['Wizard', 2]]);
    expect(slotMax(c).slice(0, 2)).toEqual([3, 0]);
    expect(pactSlots(c)).toEqual({ count: 2, slotLevel: 2 });
  });
  it('Paladin solo usa su propia tabla', () => {
    expect(slotMax(make([['Paladin', 1]], { ruleset: '2014' }))[0]).toBe(0);
    expect(slotMax(make([['Paladin', 1]], { ruleset: '2024' }))[0]).toBe(2);
    expect(slotMax(make([['Paladin', 3]])).slice(0, 2)).toEqual([3, 0]);
    expect(slotMax(make([['Paladin', 5]])).slice(0, 2)).toEqual([4, 2]);
  });
  it('multiclass half caster: 2014 redondea abajo, 2024 arriba', () => {
    expect(casterLevel(make([['Paladin', 3], ['Sorcerer', 2]], { ruleset: '2014' }))).toBe(3);
    expect(casterLevel(make([['Paladin', 3], ['Sorcerer', 2]], { ruleset: '2024' }))).toBe(4);
  });
  it('Pact Magic en niveles altos', () => {
    expect(pactSlots(make([['Warlock', 11]]))).toEqual({ count: 3, slotLevel: 5 });
    expect(pactSlots(make([['Warlock', 17]]))).toEqual({ count: 4, slotLevel: 5 });
  });
});

describe('AC y HP', () => {
  it('Mage Armor y shield', () => {
    const c = make([['Wizard', 1]], { abilities: { str: 8, dex: 16, con: 14, int: 16, wis: 10, cha: 10 } });
    c.ac = { mode: 'mage', base: 0, shield: true, bonus: 0 };
    expect(armorClass(c)).toBe(18);
    c.ac = { mode: 'medium', base: 14, shield: false, bonus: 1 };
    expect(armorClass(c)).toBe(17);
  });
  it('HP promedio multiclass', () => {
    const c = make([['Warlock', 4], ['Wizard', 1]], { abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 17 } });
    // Warlock: 8 + 5*3 = 23, Wizard 1: 4, CON +2 x5 = 10
    expect(averageHp(c)).toBe(37);
  });
  it('el dano consume temp primero', () => {
    let c = make([['Warlock', 4]]);
    c.hp = { max: 23, current: 23, temp: 5 };
    c = damage(c, 8);
    expect(c.hp).toEqual({ max: 23, current: 20, temp: 0 });
    c = heal(c, 50);
    expect(c.hp.current).toBe(23);
  });
});

describe('speed', () => {
  it('base de raza + Unarmored Movement de Monk sin armadura', () => {
    const c = make([['Monk', 6]]); c.species = { ...c.species, name: 'Wood Elf', speed: 35 };
    c.ac = { mode: 'unarmored-wis', base: 0, shield: false, bonus: 0 };
    expect(speed(c)).toBe(50);
    c.ac.mode = 'light';
    expect(speed(c)).toBe(35);
  });
  it('Fast Movement de Barbarian no aplica con heavy armor', () => {
    const c = make([['Barbarian', 5]]);
    expect(speed(c)).toBe(40);
    c.ac = { mode: 'heavy', base: 18, shield: false, bonus: 0 };
    expect(speed(c)).toBe(30);
  });
  it('efectos fijos y condicionales', () => {
    const c = make([['Wizard', 2]]);
    c.effects = [
      { id: 'm', source: 'Mobile', sourceType: 'feat', target: 'speed', value: 10, conditional: false, active: false },
      { id: 'b', source: 'Bladesong', sourceType: 'subclass', target: 'speed', value: 10, conditional: true, active: false }
    ];
    expect(speed(c)).toBe(40);
    c.effects[1].active = true;
    expect(speed(c)).toBe(50);
  });
  it('migra respaldos con speed manual', () => {
    const old: Record<string, unknown> = { ...blankCharacter(), speed: 25 };
    delete old.species;
    delete old.effects;
    const r = CharacterSchema.safeParse(old);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.species).toMatchObject({ name: '', speed: 25 });
  });
});

describe('nivel maximo', () => {
  it('recorta respaldos con mas de 20 niveles desde la ultima clase', () => {
    const c = make([['Warlock', 5], ['Wizard', 15], ['Fighter', 1]]);
    const r = CharacterSchema.safeParse(c);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.classes.map((k) => k.level)).toEqual([5, 14, 1]);
  });
});

describe('rests', () => {
  it('Short Rest: Pact slots, recursos short y Hit Dice', () => {
    const c = make([['Warlock', 4]], { abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 17 } });
    c.hp = { max: 23, current: 5, temp: 0 };
    c.slotsUsed.pact = 2;
    c.resources = [
      { id: 'a', name: 'short', max: 1, used: 1, recharge: 'short' },
      { id: 'b', name: 'long', max: 1, used: 1, recharge: 'long' }
    ];
    const n = shortRest(c, { hitDice: [{ die: 8, roll: 6 }, { die: 8, roll: 8 }], arcane: [] });
    expect(n.slotsUsed.pact).toBe(0);
    expect(n.resources.map((r) => r.used)).toEqual([0, 1]);
    expect(n.hitDiceUsed['8']).toBe(2);
    expect(n.hp.current).toBe(5 + 8 + 10);
  });
  it('Arcane Recovery respeta el limite', () => {
    const c = make([['Warlock', 4], ['Wizard', 3]]);
    c.slotsUsed.levels = [2, 1, 0, 0, 0, 0, 0, 0, 0];
    expect(validArcane(c, [1, 1])).toBeNull();
    expect(validArcane(c, [2, 1])).not.toBeNull();
    const n = shortRest(c, { hitDice: [], arcane: [2] });
    expect(n.slotsUsed.levels[1]).toBe(0);
    expect(n.arcaneRecoveryUsed).toBe(true);
    expect(validArcane(n, [1])).not.toBeNull();
  });
  it('Long Rest 2014 recupera la mitad de Hit Dice, 2024 todos', () => {
    const base = make([['Warlock', 4], ['Wizard', 2]]);
    base.hitDiceUsed = { '8': 4, '6': 2 };
    base.slotsUsed = { pact: 2, levels: [3, 0, 0, 0, 0, 0, 0, 0, 0] };
    base.arcaneRecoveryUsed = true;
    const a = longRest({ ...base, ruleset: '2014' });
    expect(a.hitDiceUsed).toEqual({ '8': 1, '6': 2 });
    expect(a.slotsUsed.levels[0]).toBe(0);
    expect(a.arcaneRecoveryUsed).toBe(false);
    const b = longRest({ ...base, ruleset: '2024' });
    expect(b.hitDiceUsed).toEqual({});
  });
});
