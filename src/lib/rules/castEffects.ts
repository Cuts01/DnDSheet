import type { Character } from '../model/character';
import { BEASTS, type Beast } from '../data/beasts';
import { totalLevel } from './derive';

/* Lo que pasa en la hoja al lanzar ciertos spells (además de gastar el slot). */
export type CastEffect =
  | { kind: 'temp'; amount: number }
  | { kind: 'tempRoll'; count: number; sides: number; bonus: number }
  | { kind: 'shape'; mode: 'pool' | 'temp'; maxCr: number; beasts: Beast[] };

const key = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '');

/* slotLevel: nivel con el que se lanza (el base si es sin slot). */
export function castEffect(c: Character, spellName: string, slotLevel: number): CastEffect | null {
  const up = Math.max(0, slotLevel - 1);
  switch (key(spellName)) {
    case 'armorofagathys':
      return { kind: 'temp', amount: 5 * Math.max(1, slotLevel) };
    case 'falselife':
      return c.ruleset === '2024' ? { kind: 'tempRoll', count: 2, sides: 4, bonus: 4 + 5 * up } : { kind: 'tempRoll', count: 1, sides: 4, bonus: 4 + 5 * up };
    case 'polymorph':
      return { kind: 'shape', mode: c.ruleset === '2024' ? 'temp' : 'pool', maxCr: totalLevel(c), beasts: BEASTS[c.ruleset] ?? BEASTS['2014'] };
    default:
      return null;
  }
}

export const rollDice = (count: number, sides: number, rnd = Math.random) =>
  Array.from({ length: count }, () => 1 + Math.floor(rnd() * sides)).reduce((a, b) => a + b, 0);

/* Los temp HP no se suman: queda el mayor. */
export function gainTemp(c: Character, amount: number): Character {
  const n = structuredClone(c);
  n.hp.temp = Math.max(n.hp.temp, Math.max(0, Math.floor(amount)));
  return n;
}

export function crLabel(cr: number): string {
  return cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr);
}

/* Toma la forma de una beast (Polymorph en ti). */
export function takeShape(c: Character, b: Beast, mode: 'pool' | 'temp', spell = 'Polymorph'): Character {
  const n = structuredClone(c);
  n.shape = { name: b.name, spell, mode, hp: b.hp, max: b.hp, ac: b.ac, cr: b.cr, speed: b.speed };
  if (mode === 'temp') n.hp.temp = Math.max(n.hp.temp, b.hp);
  return n;
}

/* Vuelve a la forma normal. En 2024 se pierden los temp HP que queden de la forma. */
export function endShape(c: Character): Character {
  const n = structuredClone(c);
  if (!n.shape) return n;
  if (n.shape.mode === 'temp') n.hp.temp = 0;
  if (n.concentration && n.concentration === n.shape.spell) n.concentration = '';
  n.shape = null;
  return n;
}

/* Termina la concentration; si era el spell de la forma, también la forma. */
export function endConcentration(c: Character): Character {
  if (c.shape && c.concentration === c.shape.spell) return endShape(c);
  const n = structuredClone(c);
  n.concentration = '';
  return n;
}
