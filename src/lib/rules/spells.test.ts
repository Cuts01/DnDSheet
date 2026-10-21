import { describe, expect, it } from 'vitest';
import { CLASS_PRESETS, blankCharacter, classFromPreset, type Character } from '../model/character';
import { castSpell, maxSpellLevel, slotOptions, spellLimits, spellUsage } from './spells';

const cls = (name: string, level: number) => classFromPreset(CLASS_PRESETS.find((p) => p.name === name)!, level);
const char = (classes: [string, number][], patch: Partial<Character> = {}): Character => ({
  ...blankCharacter(),
  classes: classes.map(([n, l]) => cls(n, l)),
  ...patch
});

describe('spells', () => {
  it('límites 2014: Wizard prepara INT + nivel, Warlock conoce por tabla', () => {
    const c = char([['Wizard', 5], ['Warlock', 3]], { abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 10, cha: 14 } });
    expect(spellLimits(c, c.classes[0])).toEqual({ cantrips: 4, spells: 8, kind: 'prepared' });
    expect(spellLimits(c, c.classes[1])).toEqual({ cantrips: 2, spells: 4, kind: 'known' });
  });

  it('límites 2024: tablas de prepared', () => {
    const c = char([['Warlock', 3]], { ruleset: '2024' });
    expect(spellLimits(c, c.classes[0])).toEqual({ cantrips: 2, spells: 4, kind: 'prepared' });
    const p = char([['Paladin', 1]], { ruleset: '2024' });
    expect(spellLimits(p, p.classes[0]).spells).toBe(2);
  });

  it('nivel máximo de spell por clase', () => {
    const c = char([['Wizard', 5]]);
    expect(maxSpellLevel(c, c.classes[0])).toBe(3);
    expect(maxSpellLevel(c, cls('Paladin', 1))).toBe(0);
    expect(maxSpellLevel({ ...c, ruleset: '2024' }, cls('Paladin', 1))).toBe(1);
    expect(maxSpellLevel(c, cls('Warlock', 11))).toBe(6);
  });

  it('lanzar gasta el slot elegido y marca concentration', () => {
    const c = char([['Wizard', 5], ['Warlock', 3]]);
    const opts = slotOptions(c, 2);
    expect(opts.map((o) => `${o.kind}${o.level}`)).toEqual(['slot2', 'slot3', 'pact2']);
    const n = castSpell(c, opts.find((o) => o.kind === 'pact')!, 'Hold Person');
    expect(n.slotsUsed.pact).toBe(1);
    expect(n.concentration).toBe('Hold Person');
    const m = castSpell(n, opts[0], null);
    expect(m.slotsUsed.levels[1]).toBe(1);
    expect(m.concentration).toBe('Hold Person');
  });

  it('conteo: always no cuenta, known cuenta sin preparar', () => {
    const c = char([['Warlock', 3]]);
    const id = c.classes[0].id;
    c.spells = [
      { id: 'a', ref: null, name: 'Eldritch Blast', level: 0, classId: id, prepared: false, always: false, notes: '' },
      { id: 'b', ref: null, name: 'Hex', level: 1, classId: id, prepared: false, always: false, notes: '' },
      { id: 'c', ref: null, name: 'Misty Step', level: 2, classId: null, prepared: false, always: true, notes: '' }
    ];
    expect(spellUsage(c, c.classes[0])).toEqual({ cantrips: 1, spells: 1 });
  });
});
