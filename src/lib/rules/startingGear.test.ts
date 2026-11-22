import { describe, expect, it } from 'vitest';
import { blankCharacter } from '../model/character';
import { parsePack, type Pack } from '../model/pack';
import { applyStartingGear, gearEntries, parseEquipment, undoStartingGear } from './startingGear';
import { applyBackground, findRef } from './features';

const fsName = 'node:fs';
const { readFileSync, existsSync } = await import(/* @vite-ignore */ fsName);
const p24 = existsSync('public/packs/wiki-2024.json') ? (parsePack(JSON.parse(readFileSync('public/packs/wiki-2024.json', 'utf8'))) as { pack: Pack }).pack : null;

describe('equipo inicial del background', () => {
  it('lee cantidades, notas, oro y la opción B', () => {
    const p = parseEquipment("Dagger, Light Hammer, 2 Pouches, Oil (3 flasks), Book (prayers), Gaming Set (same as above), 26 GP (or 50 GP)");
    expect(p.alt).toBe(50);
    expect(p.gp).toBe(26);
    expect(p.items).toEqual([
      { name: 'Dagger', qty: 1, note: '' },
      { name: 'Light Hammer', qty: 1, note: '' },
      { name: 'Pouches', qty: 2, note: '' },
      { name: 'Oil', qty: 3, note: '' },
      { name: 'Book', qty: 1, note: 'prayers' },
      { name: 'Gaming Set', qty: 1, note: '' }
    ]);
  });
  it('2014: sin opción B, oro en la bolsa', () => {
    const p = parseEquipment('Holy symbol, prayer book, 5 sticks of incense, vestments, common clothes, 15 gp');
    expect(p.alt).toBeNull();
    expect(p.gp).toBe(15);
    expect(p.items.map((i) => i.name)).toContain('Holy symbol');
  });
  it.skipIf(!p24)('aplica A o B y deshace al cambiar de background', () => {
    let c = { ...blankCharacter(), ruleset: '2024' as const };
    c = applyBackground(c, findRef([p24!], 'wiki-2024:genie-touched', (p) => p.backgrounds), [p24!]);
    const bg = findRef([p24!], 'wiki-2024:genie-touched', (p) => p.backgrounds)!.item;
    c = applyStartingGear(c, bg.equipment, 'A', [p24!]);
    expect(c.inventory.map((i) => i.name)).toContain('Light Hammer');
    expect(c.inventory.find((i) => i.name === 'Light Hammer')?.weapon).toBeTruthy();
    expect(c.currency.gp).toBe(2);
    c = applyStartingGear(c, bg.equipment, 'B', [p24!]);
    expect(c.inventory).toHaveLength(0);
    expect(c.currency.gp).toBe(50);
    c = undoStartingGear(c);
    expect(c.currency.gp).toBe(0);
    c = applyStartingGear(c, bg.equipment, 'A', [p24!]);
    c = applyBackground(c, findRef([p24!], 'wiki-2024:sage', (p) => p.backgrounds), [p24!]);
    expect(c.inventory).toHaveLength(0);
    expect(gearEntries(parseEquipment('2 Daggers, 20 Arrows'), [p24!], '2024').map((e) => [e.name, e.qty, !!e.ref])).toEqual([
      ['Dagger', 2, true],
      [expect.stringMatching(/Arrow/), 20, true]
    ]);
  });
});
