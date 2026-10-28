import { describe, expect, it } from 'vitest';
import { CLASS_PRESETS, blankCharacter, classFromPreset, uid, type Character, type ItemEntry } from '../model/character';
import { parsePack, type Pack } from '../model/pack';
import { armorClass, asiSlots, attacks, invocationsKnown, passive, pointBuySpent, score, skillLevel, skillSources, speed } from './derive';
import { allGrantedEffects, applyBackground, applySpecies, backgroundList, proficiencies, skillChoiceSlots, speciesList } from './features';
import { SKILLS } from './tables';

const cls = (name: string, level: number) => classFromPreset(CLASS_PRESETS.find((p) => p.name === name)!, level);

function char(classes: [string, number][], patch: Partial<Character> = {}): Character {
  return { ...blankCharacter(), classes: classes.map(([n, l]) => cls(n, l)), ...patch };
}

const item = (p: Partial<ItemEntry>): ItemEntry => ({
  id: uid(), ref: null, name: 'X', kind: 'other', qty: 1, equipped: true, attuned: false, bonus: 0,
  attackAbility: null, weight: 0, notes: '', weapon: null, armor: null, ...p
});

const pack: Pack = (() => {
  const r = parsePack({
    format: 'cuts5e-pack', version: 1,
    pack: { id: 't', name: 'Test', ruleset: '2014' },
    classes: [{
      name: 'Fighter', hitDie: 10, caster: 'none', saves: ['str', 'con'],
      proficiencies: { armor: ['light', 'medium', 'heavy', 'shields'], weapons: ['simple', 'martial'], skills: { count: 2, from: ['Acrobatics', 'Athletics', 'Perception'] } },
      multiclass: { armor: ['light', 'medium', 'shields'], weapons: ['simple', 'martial'] }
    }],
    species: [{ name: 'Mountain Dwarf', speed: 25, darkvision: 60, asi: { fixed: { con: 2, str: 2 } }, proficiencies: { armor: ['light', 'medium'], weapons: ['battleaxe', 'warhammer'] } }],
    backgrounds: [{ name: 'Soldier', skills: ['Athletics', 'Intimidation'], tools: ['vehicles (land)'] }]
  });
  if (!r.ok) throw new Error(r.errors.join());
  return r.pack;
})();

describe('ability scores', () => {
  it('suma raza, background, ASI y half-feat', () => {
    const c = char([['Fighter', 6]]);
    c.abilities = { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 };
    c.bonuses.species = [{ ability: 'str', amount: 2 }];
    const slots = asiSlots(c);
    expect(slots.map((s) => s.level)).toEqual([4, 6]);
    c.advancements[slots[0].key] = { kind: 'asi', asi: [{ ability: 'str', amount: 2 }], featRef: null, featName: '', featAbility: null };
    c.advancements[slots[1].key] = { kind: 'feat', asi: [], featRef: null, featName: 'Resilient', featAbility: 'con' };
    expect(score(c, 'str')).toBe(19);
    expect(score(c, 'con')).toBe(14);
    expect(pointBuySpent(c)).toBe(27);
  });
  it('ignora ASI de niveles que ya no tienes', () => {
    const c = char([['Wizard', 4]]);
    const key = asiSlots(c)[0].key;
    c.advancements[key] = { kind: 'asi', asi: [{ ability: 'int', amount: 2 }], featRef: null, featName: '', featAbility: null };
    expect(score(c, 'int')).toBe(10);
    c.classes[0].level = 3;
    expect(score(c, 'int')).toBe(8);
  });
});

describe('selecciones del compendium', () => {
  it('raza y background otorgan bonos, speed, skills y proficiencies', () => {
    let c = char([['Fighter', 1]]);
    c = applySpecies(c, speciesList([pack], '2014')[0]);
    c = applyBackground(c, backgroundList([pack], '2014')[0], [pack]);
    expect(c.species.speed).toBe(25);
    expect(score(c, 'str')).toBe(10);
    expect(skillLevel(c, SKILLS.find((s) => s.id === 'athletics')!)).toBe('prof');
    const p = proficiencies(c, [pack]);
    expect(p.armor).toContain('heavy');
    expect(p.weapons).toContain('warhammer');
    expect(skillChoiceSlots(c, [pack])[0]).toMatchObject({ count: 2, from: ['acrobatics', 'athletics', 'perception'] });
  });
});

describe('equipo', () => {
  it('AC automatico con armor, shield y Unarmored Defense', () => {
    const c = char([['Monk', 3]]);
    c.abilities = { str: 10, dex: 16, con: 12, int: 10, wis: 16, cha: 8 };
    expect(armorClass(c)).toBe(16);
    c.inventory.push(item({ name: 'Shield', kind: 'armor', armor: { category: 'shield', ac: 2, dexMax: null, strength: null, stealthDisadvantage: false } }));
    expect(armorClass(c)).toBe(15);
    c.inventory.push(item({ name: 'Half Plate', kind: 'armor', bonus: 1, armor: { category: 'medium', ac: 15, dexMax: 2, strength: null, stealthDisadvantage: true } }));
    expect(armorClass(c)).toBe(20);
  });
  it('heavy armor sin STR baja la speed (salvo dwarves 2014)', () => {
    const c = char([['Fighter', 1]]);
    c.abilities.str = 13;
    c.inventory.push(item({ name: 'Plate', kind: 'armor', armor: { category: 'heavy', ac: 18, dexMax: 0, strength: 15, stealthDisadvantage: true } }));
    expect(armorClass(c)).toBe(18);
    expect(speed(c)).toBe(20);
    c.species.name = 'Hill Dwarf';
    expect(speed(c)).toBe(30);
  });
  it('ataques: finesse usa la mejor ability y sin proficiency no suma PB', () => {
    const c = char([['Rogue', 5]]);
    c.abilities = { str: 10, dex: 18, con: 12, int: 10, wis: 10, cha: 10 };
    c.inventory.push(item({ name: 'Rapier', kind: 'weapon', bonus: 1, weapon: { category: 'martial', range: 'melee', damage: '1d8', damageType: 'piercing', versatile: null, properties: ['finesse'], normalRange: null, longRange: null, mastery: null } }));
    const [rapier] = attacks(c, ['simple', 'rapier']);
    expect(rapier).toMatchObject({ ability: 'dex', toHit: 4 + 3 + 1, damage: '1d8 + 5', proficient: true });
    const [noProf] = attacks(c, ['simple']);
    expect(noProf.toHit).toBe(5);
  });
  it('invocations conocidas por ruleset', () => {
    expect(invocationsKnown(char([['Warlock', 5]]))).toBe(3);
    expect(invocationsKnown(char([['Warlock', 5]], { ruleset: '2024' }))).toBe(5);
  });
});

describe('migracion de AC', () => {
  it('respaldos sin inventario pasan a AC automatico', async () => {
    const { CharacterSchema } = await import('../model/character');
    const old: Record<string, unknown> = { ...char([['Rogue', 3]]), ac: { mode: 'unarmored', base: 10, shield: false, bonus: 0 } };
    delete old.inventory;
    const r = CharacterSchema.safeParse(old);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ac.mode).toBe('auto');
  });
});

describe('passives y feats con skills', () => {
  const fp: Pack = (() => {
    const r = parsePack({
      format: 'cuts5e-pack', version: 1,
      pack: { id: 'f', name: 'Feats', ruleset: '2014' },
      feats: [
        { name: 'Observant', effects: [{ target: 'passive-perception', value: 5 }, { target: 'passive-investigation', value: 5 }] },
        { name: 'Observant 24', skills: [{ count: 1, mode: 'either', from: ['Insight', 'Investigation', 'Perception'] }] },
        { name: 'Skill Expert', skills: [{ count: 1, mode: 'prof', from: [] }, { count: 1, mode: 'expertise', from: [] }] }
      ]
    });
    if (!r.ok) throw new Error(r.errors.join(', '));
    return r.pack;
  })();
  const sk = (id: string) => SKILLS.find((s) => s.id === id)!;

  it('Observant 2014 suma +5 a passive Perception e Investigation', () => {
    const c = char([['Fighter', 1]], { feats: [{ id: 'x', ref: 'f:observant', name: 'Observant', source: 'other', ability: null }] as Character['feats'] });
    const g = allGrantedEffects(c, [fp]);
    expect(passive(c, 'perception', g)).toBe(passive(c, 'perception') + 5);
    expect(passive(c, 'investigation', g)).toBe(passive(c, 'investigation') + 5);
    expect(passive(c, 'insight', g)).toBe(passive(c, 'insight'));
  });

  it('either da proficiency, o expertise si ya eras proficient', () => {
    const c = char([['Fighter', 1]], { feats: [{ id: 'o', ref: 'f:observant-24', name: 'Observant 24', source: 'other', ability: null }] as Character['feats'] });
    const slot = skillChoiceSlots(c, [fp]).find((s) => s.mode === 'either')!;
    c.skillPicks[slot.source] = ['perception'];
    expect(skillLevel(c, sk('perception'))).toBe('prof');
    c.skillPicks.background = ['perception'];
    expect(skillLevel(c, sk('perception'))).toBe('expertise');
    // Si se quita el feat, su fuente deja de contar.
    c.feats = [];
    expect(skillSources(c, 'perception')).toEqual(['background']);
  });

  it('Skill Expert: expertise solo entre skills proficient', () => {
    const c = char([['Fighter', 1]], { feats: [{ id: 's', ref: 'f:skill-expert', name: 'Skill Expert', source: 'other', ability: null }] as Character['feats'] });
    c.skillPicks.background = ['athletics'];
    const [p, x] = skillChoiceSlots(c, [fp]).filter((s) => s.mode);
    c.skillPicks[p.source] = ['stealth'];
    const x2 = skillChoiceSlots(c, [fp]).find((s) => s.mode === 'expertise')!;
    expect(x2.from.sort()).toEqual(['athletics', 'stealth']);
    c.skillPicks[x.source] = ['stealth'];
    expect(skillLevel(c, sk('stealth'))).toBe('expertise');
  });
});

describe('tope de 20 en abilities', () => {
  it('un ASI no sube un score sobre 20; Primal Champion sí, hasta 24', async () => {
    const { scoreBreakdown, asiSlots } = await import('./derive');
    const { blankCharacter, classFromPreset, CLASS_PRESETS } = await import('../model/character');
    const k = classFromPreset(CLASS_PRESETS.find((p) => p.name === 'Fighter')!, 20);
    const c = { ...blankCharacter(), classes: [k], abilities: { str: 15, dex: 10, con: 14, int: 10, wis: 10, cha: 10 } };
    c.bonuses.species = [{ ability: 'str' as const, amount: 2 }];
    const slots = asiSlots(c);
    c.advancements[slots[0].key] = { kind: 'asi', asi: [{ ability: 'str', amount: 2 }], featRef: null, featName: '', featAbility: null };
    c.advancements[slots[1].key] = { kind: 'asi', asi: [{ ability: 'str', amount: 2 }], featRef: null, featName: '', featAbility: null };
    const b = scoreBreakdown(c, 'str');
    expect(b.total).toBe(20);
    expect(b.capped).toBe(1);
    c.scoreBonus = [{ ability: 'str', amount: 4, max: 24 }];
    expect(scoreBreakdown(c, 'str').total).toBe(24);
    c.bonuses.other = [{ ability: 'str', amount: 2 }];
    expect(scoreBreakdown(c, 'str').total).toBe(26);
  });
});

describe('tope de 20 con raza', () => {
  it('el +2 de raza tampoco pasa de 20 y se cuenta como sobrante', async () => {
    const { scoreBreakdown } = await import('./derive');
    const { blankCharacter } = await import('../model/character');
    const c = { ...blankCharacter(), abilities: { str: 19, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };
    c.bonuses.species = [{ ability: 'str' as const, amount: 2 }];
    const b = scoreBreakdown(c, 'str');
    expect(b.total).toBe(20);
    expect(b.capped).toBe(1);
    c.abilities.str = 22; // base manual sobre 20 (homebrew) se respeta
    expect(scoreBreakdown(c, 'str').total).toBe(22);
  });
});
