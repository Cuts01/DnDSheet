import { describe, expect, it } from 'vitest';
import example from '../../../public/packs/ejemplo-homebrew.json';
import { CLASS_PRESETS, blankCharacter, classFromPreset } from '../model/character';
import { parsePack, type Pack } from '../model/pack';
import { speed } from './derive';
import { characterFeatures, classChoices, grantedEffects, subclassOptions } from './features';
import { longRest } from './rests';

function pack(): Pack {
  const r = parsePack(example);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.pack;
}

function fighter(level: number) {
  const c = blankCharacter();
  c.classes = [classFromPreset(CLASS_PRESETS.find((p) => p.name === 'Fighter')!, level)];
  return c;
}

describe('packs', () => {
  it('el ejemplo es valido y genera ids', () => {
    const p = pack();
    expect(p.subclasses.map((s) => s.id)).toEqual(['steamwright/boiler-workshop', 'fighter/clockwork-duelist']);
    expect(p.subclasses[1].features[0].id).toBe('ejemplo-homebrew/fighter/clockwork-duelist/3-wound-spring');
  });
  it('rechaza packs mal formados con mensajes', () => {
    const r = parsePack({ format: 'cuts5e-pack', version: 1, pack: { id: 'x', name: 'x', ruleset: '2014' }, classes: [{ name: 'X', hitDie: 7, caster: 'full' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toContain('classes.0.hitDie');
  });
  it('subclases por clase y clases homebrew en la lista', () => {
    const p = pack();
    expect(subclassOptions([p], 'fighter', '2014').map((o) => o.sub.name)).toEqual(['Clockwork Duelist']);
    expect(classChoices([p], '2014').some((k) => k.name === 'Steamwright')).toBe(true);
  });
  it('features por nivel y efectos otorgados', () => {
    const p = pack();
    const c = fighter(7);
    c.classes[0].subclassId = 'ejemplo-homebrew:fighter/clockwork-duelist';
    const [group] = characterFeatures(c, [p]);
    expect(group.features.map((f) => [f.feature.name, f.owned])).toEqual([
      ['Wound Spring', true],
      ['Balanced Gears', true],
      ['Escapement', false]
    ]);
    const g = grantedEffects(c, [p]);
    expect(speed(c, g)).toBe(35);
    const id = g.find((e) => e.conditional)!.id;
    c.toggles[id] = true;
    expect(speed(c, grantedEffects(c, [p]))).toBe(45);
    const rested = longRest(c);
    expect(speed(rested, grantedEffects(rested, [p]))).toBe(35);
  });
});
