import { describe, expect, it } from 'vitest';
import { CLASS_PRESETS, blankCharacter, classFromPreset, type Character } from '../model/character';
import { parsePack, type Pack } from '../model/pack';
import { asiSlots, passive } from './derive';
import { allGrantedEffects } from './features';
import { spellAttacks, spellEntryFrom, spellList, subclassSpells } from './spells';

/* Pruebas con los packs reales de content/dist (se saltan si no están). */
const fsName = 'node:fs';
const { readFileSync, existsSync } = await import(/* @vite-ignore */ fsName);
const load = (r: string): Pack | null => {
  const f = `content/dist/wiki-${r}.json`;
  if (!existsSync(f)) return null;
  const p = parsePack(JSON.parse(readFileSync(f, 'utf8')));
  return p.ok ? p.pack : null;
};
const p14 = load('2014');
const p24 = load('2024');
const cls = (name: string, level: number) => classFromPreset(CLASS_PRESETS.find((p) => p.name === name)!, level);

describe.skipIf(!p14 || !p24)('packs de la wiki', () => {
  it('Observant como ASI de Warlock 4 suma +5 a passive Perception', () => {
    const c: Character = { ...blankCharacter(), classes: [cls('Warlock', 4)] };
    const slot = asiSlots(c)[0];
    c.advancements[slot.key] = { kind: 'feat', asi: [], featRef: 'wiki-2014:observant', featName: 'Observant', featAbility: 'wis' } as Character['advancements'][string];
    expect(passive(c, 'perception', allGrantedEffects(c, [p14!]))).toBe(passive(c, 'perception') + 5);
  });

  it('Life Domain 2014 da sus spells según nivel, y Land druid según terreno', () => {
    const k = cls('Cleric', 3);
    k.subclassId = 'wiki-2014:cleric/life-domain';
    const c: Character = { ...blankCharacter(), classes: [k] };
    const names = subclassSpells(c, [p14!]).always.map((g) => g.name).sort();
    expect(names).toEqual(['Bless', 'Cure Wounds', 'Lesser Restoration', 'Spiritual Weapon']);
    const d = cls('Druid', 5);
    d.subclassId = 'wiki-2014:druid/circle-of-the-land';
    const cd: Character = { ...blankCharacter(), classes: [d], spellVariants: { [d.id]: 'Coast' } };
    const info = subclassSpells(cd, [p14!]);
    expect(info.variants[0].options).toContain('Underdark');
    expect(info.always.map((g) => g.name).sort()).toEqual(['Mirror Image', 'Misty Step', 'Water Breathing', 'Water Walk']);
  });

  it('Warlock 2014 Fiend expande la lista; 2024 Fiend las prepara', () => {
    const k = cls('Warlock', 3);
    k.subclassId = 'wiki-2014:warlock/fiend';
    const c: Character = { ...blankCharacter(), classes: [k] };
    const info = subclassSpells(c, [p14!]);
    expect(info.always).toHaveLength(0);
    expect(info.expanded.get(k.id)?.has('scorchingray')).toBe(true);
    expect(info.expanded.get(k.id)?.has('fireball')).toBe(false);
    const k2 = cls('Warlock', 3);
    k2.subclassId = 'wiki-2024:warlock/fiend-patron';
    const c2: Character = { ...blankCharacter(), ruleset: '2024', classes: [k2] };
    expect(subclassSpells(c2, [p24!]).always.map((g) => g.name)).toContain('Scorching Ray');
  });

  it('Eldritch Blast escala por nivel y suma CHA con Agonizing Blast', () => {
    const c: Character = { ...blankCharacter(), classes: [cls('Warlock', 5)], abilities: { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 18 } };
    const eb = spellList([p14!], '2014').find((r) => r.item.name === 'Eldritch Blast')!;
    const fb = spellList([p14!], '2014').find((r) => r.item.name === 'Fire Bolt')!;
    c.spells = [spellEntryFrom(eb, c.classes[0].id), spellEntryFrom(fb, c.classes[0].id)];
    c.invocations = [{ id: 'i', ref: 'wiki-2014:agonizing-blast', name: 'Agonizing Blast' }];
    const a = spellAttacks(c, [p14!]);
    expect(a.find((x) => x.name === 'Eldritch Blast')).toMatchObject({ kind: 'attack', toHit: 7, damage: '1d10 + 4 force', note: '2 rayos' });
    expect(a.find((x) => x.name === 'Fire Bolt')?.damage).toBe('2d10 fire');
  });
});

describe.skipIf(!p14)('spells de feats', () => {
  it('Fey Touched da Misty Step gratis y una spell elegida de nivel 1', async () => {
    const { featSpells, spellAttacks } = await import('./spells');
    const c: Character = { ...blankCharacter(), classes: [cls('Warlock', 4)] };
    c.feats = [{ id: 'f', ref: 'wiki-2014:fey-touched', name: 'Fey Touched', source: 'other', ability: 'cha' }];
    let r = featSpells(c, [p14!]);
    expect(r.granted.map((g) => g.name)).toEqual(['Misty Step']);
    expect(r.slots[0].picks[0].options.every((o) => o.item.level === 1 && ['Divination', 'Enchantment'].includes(o.item.school))).toBe(true);
    c.featSpells['f|wiki-2014:fey-touched'] = { list: '', ability: null, picks: { 1: ['Dissonant Whispers'] } };
    r = featSpells(c, [p14!]);
    expect(r.granted.map((g) => g.name)).toEqual(['Misty Step', 'Dissonant Whispers']);
    expect(r.granted[1].ability).toBe('cha');
    expect(r.granted[1].freeKey?.startsWith('L:')).toBe(true);
    const atk = spellAttacks(c, [p14!], r.granted);
    expect(atk.map((a) => a.name)).toContain('Dissonant Whispers');
  });

  it('Magic Initiate pide lista y usa su ability', async () => {
    const { featSpells } = await import('./spells');
    const c: Character = { ...blankCharacter(), classes: [cls('Fighter', 1)] };
    c.feats = [{ id: 'm', ref: 'wiki-2014:magic-initiate', name: 'Magic Initiate', source: 'other', ability: null }];
    let r = featSpells(c, [p14!]);
    expect(r.slots[0].lists).toContain('Wizard');
    expect(r.slots[0].picks[0].options).toHaveLength(0);
    c.featSpells['m|wiki-2014:magic-initiate'] = { list: 'Wizard', ability: null, picks: { 0: ['Fire Bolt', 'Mage Hand'], 1: ['Shield'] } };
    r = featSpells(c, [p14!]);
    expect(r.slots[0].ability).toBe('int');
    expect(r.granted.map((g) => g.name)).toEqual(['Fire Bolt', 'Mage Hand', 'Shield']);
  });
});

describe.skipIf(!p14)('feats sin referencia', () => {
  it('un feat escrito a mano (sin ref) se reconoce por nombre', async () => {
    const { featSpells } = await import('./spells');
    const c: Character = { ...blankCharacter(), classes: [cls('Warlock', 4)] };
    const slot = asiSlots(c)[0];
    c.advancements[slot.key] = { kind: 'feat', asi: [], featRef: null, featName: 'Fey Touched', featAbility: 'cha' } as Character['advancements'][string];
    expect(featSpells(c, [p14!]).granted.map((g) => g.name)).toEqual(['Misty Step']);
  });
});

describe.skipIf(!p14 || !p24)('pact boons e invocations', () => {
  it('Pact of the Chain 2014 da Find Familiar; Armor of Shadows da Mage Armor a voluntad', async () => {
    const { featSpells } = await import('./spells');
    const c: Character = { ...blankCharacter(), classes: [cls('Warlock', 4)], pactBoon: 'chain' };
    c.invocations = [{ id: 'a', ref: 'wiki-2014:armor-of-shadows', name: 'Armor of Shadows' }];
    const g = featSpells(c, [p14!]).granted;
    expect(g.map((x) => [x.name, x.uses])).toEqual([
      ['Mage Armor', 'will'],
      ['Find Familiar', 'none']
    ]);
  });
  it('Pact of the Chain 2024 es una invocation con Find Familiar sin slot', async () => {
    const { featSpells } = await import('./spells');
    const c: Character = { ...blankCharacter(), ruleset: '2024', classes: [cls('Warlock', 1)] };
    c.invocations = [{ id: 'p', ref: 'wiki-2024:pact-of-the-chain', name: 'Pact of the Chain' }];
    expect(featSpells(c, [p24!]).granted.map((x) => [x.name, x.uses])).toEqual([['Find Familiar', 'will']]);
  });
});
