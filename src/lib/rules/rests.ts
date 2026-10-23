import type { Character } from '../model/character';
import { abilityMod, maxHp, arcaneRecoveryBudget, hitDicePools, pactSlots, slotMax, totalLevel } from './derive';
import { t as tr } from '../i18n.svelte';

/* Acciones sobre el personaje. Todas son puras: devuelven una copia nueva. */

const clone = (c: Character): Character => structuredClone(c);

export function damage(c: Character, amount: number): Character {
  const n = clone(c);
  let rest = Math.max(0, Math.floor(amount));
  const fromTemp = Math.min(n.hp.temp, rest);
  n.hp.temp -= fromTemp;
  rest -= fromTemp;
  n.hp.current = Math.max(0, n.hp.current - rest);
  return n;
}

export function heal(c: Character, amount: number): Character {
  const n = clone(c);
  n.hp.current = Math.min(maxHp(n), Math.max(0, n.hp.current) + Math.max(0, Math.floor(amount)));
  return n;
}

export function setTemp(c: Character, amount: number): Character {
  const n = clone(c);
  n.hp.temp = Math.max(0, Math.floor(amount));
  return n;
}

export interface HitDieSpend {
  die: number;
  roll: number;
}

export interface ShortRestInput {
  hitDice: HitDieSpend[];
  /* Niveles de slot de Wizard a recuperar con Arcane Recovery, ej. [2, 1]. */
  arcane: number[];
}

export function validArcane(c: Character, levels: number[]): string | null {
  if (levels.length === 0) return null;
  if (c.arcaneRecoveryUsed) return tr('Arcane Recovery ya se usó desde el último Long Rest.');
  const budget = arcaneRecoveryBudget(c);
  if (budget === 0) return tr('No tienes niveles de Wizard.');
  if (levels.some((l) => l < 1 || l > 5)) return tr('Solo se recuperan slots de nivel 1 a 5.');
  const sum = levels.reduce((s, l) => s + l, 0);
  if (sum > budget) return tr('La suma de niveles ({sum}) supera el límite ({max}).', { sum, max: budget });
  const count = new Map<number, number>();
  for (const l of levels) count.set(l, (count.get(l) ?? 0) + 1);
  for (const [l, k] of count) if (k > c.slotsUsed.levels[l - 1]) return tr('No hay suficientes slots de nivel {n} gastados.', { n: l });
  return null;
}

export function shortRest(c: Character, input: ShortRestInput): Character {
  const n = clone(c);
  const con = abilityMod(n, 'con');

  for (const { die, roll } of input.hitDice) {
    const pool = hitDicePools(n).find((p) => p.die === die);
    if (!pool || pool.available <= 0) continue;
    n.hitDiceUsed[String(die)] = pool.used + 1;
    const gained = Math.max(0, Math.min(die, Math.max(1, roll)) + con);
    n.hp.current = Math.min(maxHp(n), Math.max(0, n.hp.current) + gained);
  }

  if (input.arcane.length && validArcane(n, input.arcane) === null) {
    for (const l of input.arcane) n.slotsUsed.levels[l - 1] -= 1;
    n.arcaneRecoveryUsed = true;
  }

  n.slotsUsed.pact = 0;
  for (const r of n.resources) if (r.recharge === 'short') r.used = 0;
  for (const k of Object.keys(n.freeUsed)) if (k.startsWith('S:')) delete n.freeUsed[k];
  // Recursos de features: S se recupera entero, O recupera uno.
  for (const [k, v] of Object.entries(n.featureUsed)) {
    if (k.startsWith('S:')) delete n.featureUsed[k];
    else if (k.startsWith('O:')) n.featureUsed[k] = Math.max(0, v - 1);
  }
  return n;
}

export function longRest(c: Character): Character {
  const n = clone(c);
  n.hp.current = maxHp(n);
  n.hp.temp = 0;
  n.slotsUsed.pact = 0;
  n.slotsUsed.levels = n.slotsUsed.levels.map(() => 0);
  n.arcaneRecoveryUsed = false;
  n.concentration = '';
  n.freeUsed = {};
  n.featureUsed = {};
  for (const r of n.resources) if (r.recharge !== 'none') r.used = 0;
  // Los efectos condicionales (Bladesong, Longstrider...) no sobreviven a un Long Rest.
  for (const e of n.effects) if (e.conditional) e.active = false;
  n.toggles = {};

  if (n.ruleset === '2024') {
    n.hitDiceUsed = {};
  } else {
    // 2014: recuperas la mitad de tus Hit Dice totales (minimo 1). Se devuelven primero los dados mas grandes.
    let budget = Math.max(1, Math.floor(totalLevel(n) / 2));
    for (const pool of hitDicePools(n)) {
      const back = Math.min(budget, pool.used);
      n.hitDiceUsed[String(pool.die)] = pool.used - back;
      budget -= back;
    }
  }
  return n;
}

/* Recorta el consumo si bajaste niveles o cambiaste clases, para que nunca quede mas gastado que el maximo. */
export function clampUsage(c: Character): Character {
  const n = clone(c);
  const max = slotMax(n);
  n.slotsUsed.levels = n.slotsUsed.levels.map((u, i) => Math.min(u, max[i]));
  n.slotsUsed.pact = Math.min(n.slotsUsed.pact, pactSlots(n).count);
  for (const r of n.resources) r.used = Math.min(r.used, r.max);
  const pools = hitDicePools(n);
  const used: Record<string, number> = {};
  for (const p of pools) if (p.used > 0) used[String(p.die)] = p.used;
  n.hitDiceUsed = used;
  n.hp.current = Math.min(n.hp.current, maxHp(n));
  return n;
}
