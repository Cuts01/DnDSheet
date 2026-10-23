import { ABILITIES, type Ability, type Character, type ClassEntry, type Effect, type ItemEntry, type ProfLevel } from '../model/character';
import { SKILLS, SLOT_TABLE, pactTable, type SkillDef } from './tables';
import { t as tr } from '../i18n.svelte';

/* Funciones puras: reciben el personaje y devuelven valores derivados. */

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export const totalLevel = (c: Character) => c.classes.reduce((s, k) => s + k.level, 0);
export const profBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);
export const pb = (c: Character) => profBonus(totalLevel(c));

/* ---------- Ability scores ---------- */

export interface ScoreBreakdown {
  base: number;
  species: number;
  background: number;
  asi: number;
  feats: number;
  other: number;
  total: number;
}

const sumFor = (list: { ability: Ability; amount: number }[], a: Ability) =>
  list.reduce((s, b) => s + (b.ability === a ? b.amount : 0), 0);

export function scoreBreakdown(c: Character, a: Ability): ScoreBreakdown {
  const base = c.abilities[a];
  const species = sumFor(c.bonuses.species, a);
  const background = sumFor(c.bonuses.background, a);
  const other = sumFor(c.bonuses.other, a);
  let asi = 0;
  let feats = 0;
  const valid = new Set(asiSlots(c).map((s) => s.key));
  for (const [key, adv] of Object.entries(c.advancements)) {
    if (!valid.has(key)) continue;
    if (adv.kind === 'asi') asi += sumFor(adv.asi, a);
    else if (adv.featAbility === a) feats += 1;
  }
  for (const f of c.feats) if (f.ability === a) feats += 1;
  return { base, species, background, asi, feats, other, total: base + species + background + asi + feats + other };
}

export const score = (c: Character, a: Ability) => scoreBreakdown(c, a).total;
export const abilityMod = (c: Character, a: Ability) => mod(score(c, a));

/* ---------- Niveles de ASI ---------- */

const DEFAULT_ASI = [4, 8, 12, 16, 19];
const CLASS_ASI: Record<string, number[]> = {
  fighter: [4, 6, 8, 12, 14, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19]
};

export interface AsiSlot {
  key: string;
  classId: string;
  className: string;
  level: number;
  epic: boolean;
}

/*
 * Niveles de ASI que ya alcanzaste en cada clase. En 2024 el de nivel 19 es Epic Boon (solo feat).
 * extraLevels permite que el compendium indique otros niveles (clases homebrew).
 */
export function asiSlots(c: Character, levelsFor?: (k: ClassEntry) => number[] | null): AsiSlot[] {
  const out: AsiSlot[] = [];
  for (const k of c.classes) {
    const custom = levelsFor?.(k);
    const levels = custom ?? CLASS_ASI[k.name.trim().toLowerCase()] ?? DEFAULT_ASI;
    for (const l of levels) {
      if (l > k.level) continue;
      out.push({ key: `${k.id}:${l}`, classId: k.id, className: k.name, level: l, epic: c.ruleset === '2024' && l === 19 });
    }
  }
  return out;
}

/* ---------- Point buy ---------- */

export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export function pointBuySpent(c: Character): number | null {
  let total = 0;
  for (const a of ABILITIES) {
    const cost = POINT_BUY_COST[c.abilities[a]];
    if (cost === undefined) return null;
    total += cost;
  }
  return total;
}

export function arrayValid(c: Character): boolean {
  const vals = ABILITIES.map((a) => c.abilities[a]).sort((x, y) => y - x);
  return vals.every((v, i) => v === STANDARD_ARRAY[i]);
}

/* ---------- Eldritch Invocations ---------- */

export function invocationsKnown(c: Character): number {
  const lvl = classLevel(c, 'warlock');
  if (lvl === 0) return 0;
  const table2014 = [0, 0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8];
  const table2024 = [0, 1, 3, 3, 3, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10, 10, 10];
  return (c.ruleset === '2024' ? table2024 : table2014)[Math.min(20, lvl)];
}

export function profAmount(level: ProfLevel, bonus: number): number {
  switch (level) {
    case 'prof':
      return bonus;
    case 'expertise':
      return bonus * 2;
    default:
      return 0;
  }
}

/* Proficient en un save: los marcados a mano más los que dan los features (autoSaves). */
export const hasSave = (c: Character, a: Ability) => c.saves.includes(a) || c.autoSaves.includes(a);
export const saveBonus = (c: Character, a: Ability) => abilityMod(c, a) + (hasSave(c, a) ? pb(c) : 0);

/*
 * Skills: lo marcado a mano manda (expertise); si no, cuenta como proficient si alguna fuente la otorga.
 * Las fuentes de feats tienen la forma feat<modo>:<dueño>|<ref>|<n>, con modo p (proficiency), x (expertise)
 * o e (proficiency, o expertise si otra fuente ya la daba). Si el feat ya no está en ese slot, la fuente se ignora.
 */
const FEAT_SOURCE = /^feat([pxeu]):([^|]+)\|([^|]*)\|\d+$/;
/*
 * Fuentes de class features: ftr<modo>:<classId>@<nivel>@<subclassId>|<featureId>|<n>.
 * Valen mientras tengas esa clase en ese nivel (y esa subclass, si el feature es de subclass).
 */
const FTR_SOURCE = /^ftr([pxeu]):([^@|]+)@(\d+)@([^|]*)\|/;
/* Modo u (upgrade): expertise en una skill que ya tienes por otra fuente. No da proficiency por sí sola. */
export type SkillMode = 'prof' | 'expertise' | 'either' | 'upgrade';
const LETTER: Record<SkillMode, string> = { prof: 'p', expertise: 'x', either: 'e', upgrade: 'u' };
export const featureSource = (mode: SkillMode, classId: string, level: number, subId: string, featureId: string, n: string | number) =>
  `ftr${LETTER[mode]}:${classId}@${level}@${subId}|${featureId}|${n}`;
export const featSource = (mode: SkillMode, owner: string, ref: string, i: number) => `feat${LETTER[mode]}:${owner}|${ref}|${i}`;
const isUpgrade = (src: string) => src.startsWith('ftru:') || src.startsWith('featu:');

function liveSource(c: Character, src: string): boolean {
  const ftr = FTR_SOURCE.exec(src);
  if (ftr) {
    const k = c.classes.find((x) => x.id === ftr[2]);
    return !!k && k.level >= Number(ftr[3]) && (!ftr[4] || k.subclassId === ftr[4]);
  }
  const m = FEAT_SOURCE.exec(src);
  if (!m) return true;
  const [, , owner, ref] = m;
  const a = c.advancements[owner];
  if (a) return a.kind === 'feat' && (a.featRef ?? '') === ref;
  const f = c.feats.find((x) => x.id === owner);
  return !!f && (f.ref ?? '') === ref;
}

/* Fuentes que te dan proficiency en la skill (no incluye las de expertise sobre una proficiency que ya tienes). */
export const skillSources = (c: Character, id: string) =>
  Object.entries(c.skillPicks)
    .filter(([src, list]) => list.includes(id) && !isUpgrade(src) && liveSource(c, src))
    .map(([src]) => src);

/* Elecciones de expertise sobre una skill que ya tienes (Rogue y Bard Expertise, Deft Explorer, Scholar...). */
export const upgradeSources = (c: Character, id: string) =>
  Object.entries(c.skillPicks)
    .filter(([src, list]) => list.includes(id) && isUpgrade(src) && liveSource(c, src))
    .map(([src]) => src);

/* Tools con expertise por una elección de upgrade (Thieves' Tools del Rogue 2014). Devuelve los ids "tool:<slug>". */
export const toolExpertise = (c: Character): Set<string> =>
  new Set(
    Object.entries(c.skillPicks)
      .filter(([src]) => isUpgrade(src) && liveSource(c, src))
      .flatMap(([, list]) => list.filter((x) => x.startsWith('tool:')))
  );

export function skillLevel(c: Character, s: SkillDef): ProfLevel {
  const manual = c.skills[s.id];
  if (manual === 'expertise') return manual;
  const src = skillSources(c, s.id);
  if (!src.length && manual !== 'prof') return 'none';
  // Solo sube a expertise si ya eras proficient por otra fuente o a mano.
  if (upgradeSources(c, s.id).length) return 'expertise';
  if (manual) return manual;
  if (src.some((x) => x.startsWith('featx:') || x.startsWith('ftrx:'))) return 'expertise';
  if (src.some((x) => x.startsWith('feate:') || x.startsWith('ftre:')) && src.length > 1) return 'expertise';
  return 'prof';
}
export const skillBonus = (c: Character, s: SkillDef) =>
  abilityMod(c, s.ability) + profAmount(skillLevel(c, s), pb(c));

/* Passive = 10 + skill, más efectos como Observant (+5). */
export function passive(c: Character, skillId: string, granted: Effect[] = []): number {
  const s = SKILLS.find((k) => k.id === skillId)!;
  return 10 + skillBonus(c, s) + effectSum(c, granted, `passive-${skillId}` as Effect['target']);
}

/* ---------- Spellcasting ---------- */

const isSlotCaster = (k: ClassEntry) => k.caster !== 'none' && k.caster !== 'pact';

/*
 * Caster level para la tabla de spell slots.
 * Un solo spellcasting class: se usa la progresion de su propia tabla.
 * Varias: regla de multiclass (half redondea abajo en 2014 y arriba en 2024, third siempre abajo).
 */
export function casterLevel(c: Character): number {
  const casters = c.classes.filter(isSlotCaster);
  if (casters.length === 0) return 0;
  if (casters.length === 1) {
    const k = casters[0];
    switch (k.caster) {
      case 'full':
        return k.level;
      case 'artificer':
        return Math.ceil(k.level / 2);
      case 'half':
        return c.ruleset === '2014' && k.level < 2 ? 0 : Math.ceil(k.level / 2);
      case 'third':
        return k.level < 3 ? 0 : Math.ceil(k.level / 3);
    }
  }
  let total = 0;
  for (const k of casters) {
    if (k.caster === 'full') total += k.level;
    else if (k.caster === 'artificer') total += Math.ceil(k.level / 2);
    else if (k.caster === 'half') total += c.ruleset === '2024' ? Math.ceil(k.level / 2) : Math.floor(k.level / 2);
    else if (k.caster === 'third') total += Math.floor(k.level / 3);
  }
  return total;
}

/* Spell slots maximos por nivel (array de 9). */
export function slotMax(c: Character): number[] {
  const lvl = Math.min(20, casterLevel(c));
  const row = lvl > 0 ? SLOT_TABLE[lvl - 1] : [];
  return Array.from({ length: 9 }, (_, i) => row[i] ?? 0);
}

export const pactLevel = (c: Character) =>
  c.classes.filter((k) => k.caster === 'pact').reduce((s, k) => s + k.level, 0);
export const pactSlots = (c: Character) => pactTable(pactLevel(c));

export interface CastingLine {
  classId: string;
  className: string;
  ability: Ability;
  attack: number;
  dc: number;
}

export function spellcasting(c: Character): CastingLine[] {
  return c.classes
    .filter((k) => k.caster !== 'none' && k.spellAbility)
    .map((k) => {
      const m = abilityMod(c, k.spellAbility!);
      return {
        classId: k.id,
        className: k.name,
        ability: k.spellAbility!,
        attack: pb(c) + m + c.spellBonus.attack,
        dc: 8 + pb(c) + m + c.spellBonus.dc
      };
    });
}

/* Nivel en una clase por nombre (para features automaticos: Arcane Recovery, Unarmored Movement...). */
export const classLevel = (c: Character, name: string) =>
  c.classes.filter((k) => k.name.trim().toLowerCase() === name).reduce((s, k) => s + k.level, 0);
export const wizardLevel = (c: Character) => classLevel(c, 'wizard');
export const arcaneRecoveryBudget = (c: Character) => Math.ceil(wizardLevel(c) / 2);

/* ---------- Defensa ---------- */

/* ---------- Equipo ---------- */

export const equippedArmor = (c: Character): ItemEntry | null =>
  c.inventory.find((i) => i.equipped && i.armor && i.armor.category !== 'shield') ?? null;
export const equippedShield = (c: Character): ItemEntry | null =>
  c.inventory.find((i) => i.equipped && i.armor?.category === 'shield') ?? null;

const AUTO = (c: Character) => c.ac.mode === 'auto';
export const wearingArmor = (c: Character) =>
  AUTO(c) ? !!equippedArmor(c) : !['unarmored', 'unarmored-con', 'unarmored-wis', 'unarmored-cha', 'mage'].includes(c.ac.mode);
export const usingShield = (c: Character) => (AUTO(c) ? !!equippedShield(c) : c.ac.shield);
export const armorCategory = (c: Character) => (AUTO(c) ? (equippedArmor(c)?.armor?.category ?? null) : c.ac.mode);

export interface AcBreakdown {
  label: string;
  total: number;
}

function autoArmorClass(c: Character): AcBreakdown {
  const dex = abilityMod(c, 'dex');
  const armor = equippedArmor(c);
  const shield = equippedShield(c);
  let base: number;
  let label: string;
  if (armor?.armor) {
    const cap = armor.armor.dexMax;
    base = armor.armor.ac + (cap === null ? dex : cap === 0 ? 0 : Math.min(dex, cap)) + armor.bonus;
    label = armor.name;
  } else {
    // Sin armadura: la mejor opcion entre las que tienes por clase.
    const options: [number, string][] = [[10 + dex, tr('Sin armadura')]];
    if (classLevel(c, 'barbarian') > 0) options.push([10 + dex + abilityMod(c, 'con'), 'Unarmored Defense (Barbarian)']);
    if (classLevel(c, 'monk') > 0 && !shield) options.push([10 + dex + abilityMod(c, 'wis'), 'Unarmored Defense (Monk)']);
    options.sort((x, y) => y[0] - x[0]);
    [base, label] = options[0];
  }
  if (shield?.armor) {
    base += shield.armor.ac + shield.bonus;
    label += ` + ${shield.name}`;
  }
  return { label, total: base + c.ac.bonus };
}

export function armorClassInfo(c: Character, granted: Effect[] = []): AcBreakdown {
  const extra = effectSum(c, granted, 'ac');
  const base = AUTO(c) ? autoArmorClass(c) : { label: 'Manual', total: manualArmorClass(c) };
  return extra ? { label: `${base.label} ${extra > 0 ? '+' : ''}${extra} (features)`, total: base.total + extra } : base;
}

export const armorClass = (c: Character) => armorClassInfo(c).total;

function manualArmorClass(c: Character): number {
  const dex = abilityMod(c, 'dex');
  let base: number;
  switch (c.ac.mode) {
    case 'unarmored':
      base = 10 + dex;
      break;
    case 'unarmored-con':
      base = 10 + dex + abilityMod(c, 'con');
      break;
    case 'unarmored-cha':
      base = 10 + dex + abilityMod(c, 'cha');
      break;
    case 'unarmored-wis':
      // Unarmored Defense de Monk no funciona con shield.
      base = 10 + dex + (c.ac.shield ? 0 : abilityMod(c, 'wis'));
      break;
    case 'mage':
      base = 13 + dex;
      break;
    case 'light':
      base = c.ac.base + dex;
      break;
    case 'medium':
      base = c.ac.base + Math.min(dex, 2);
      break;
    default:
      base = c.ac.base;
  }
  return base + (c.ac.shield ? 2 : 0) + c.ac.bonus;
}

const effectSum = (c: Character, granted: Effect[], target: Effect['target']) =>
  [...c.effects, ...granted].reduce((s, e) => s + (e.target === target && (!e.conditional || e.active) ? e.value : 0), 0);

export const initiative = (c: Character, granted: Effect[] = []) =>
  abilityMod(c, 'dex') + c.initiativeBonus + effectSum(c, granted, 'initiative');

/* ---------- Speed ---------- */

export interface SpeedPart {
  label: string;
  value: number;
  active: boolean;
  /* auto: class feature calculado en la app; effect: agregado a mano; feature: viene de un pack */
  kind: 'auto' | 'effect' | 'feature';
  effectId?: string;
  conditional: boolean;
  note?: string;
}


export function speedParts(c: Character, granted: Effect[] = []): SpeedPart[] {
  const parts: SpeedPart[] = [];

  const monk = classLevel(c, 'monk');
  if (monk >= 2) {
    const ok = !wearingArmor(c) && !usingShield(c);
    parts.push({
      label: 'Unarmored Movement (Monk)',
      value: 10 + 5 * Math.floor((monk - 2) / 4),
      active: ok,
      kind: 'auto',
      conditional: false,
      note: ok ? undefined : tr('requiere no usar armadura ni shield')
    });
  }

  const barbarian = classLevel(c, 'barbarian');
  if (barbarian >= 5) {
    const ok = armorCategory(c) !== 'heavy';
    parts.push({
      label: 'Fast Movement (Barbarian)',
      value: 10,
      active: ok,
      kind: 'auto',
      conditional: false,
      note: ok ? undefined : tr('no aplica con heavy armor')
    });
  }

  const heavy = AUTO(c) ? equippedArmor(c) : null;
  const req = heavy?.armor?.category === 'heavy' ? heavy.armor.strength : null;
  if (req && score(c, 'str') < req) {
    const dwarf = c.ruleset === '2014' && /dwarf|duergar/i.test(c.species.name);
    parts.push({
      label: `${heavy!.name} (${tr('requiere STR {n}', { n: req })})`,
      value: -10,
      active: !dwarf,
      kind: 'auto',
      conditional: false,
      note: dwarf ? tr('los dwarves ignoran esta penalidad') : undefined
    });
  }

  for (const e of [...c.effects, ...granted]) {
    if (e.target !== 'speed') continue;
    parts.push({
      label: e.source || tr('Sin nombre'),
      value: e.value,
      active: !e.conditional || e.active,
      kind: granted.includes(e) ? 'feature' : 'effect',
      effectId: e.id,
      conditional: e.conditional
    });
  }
  return parts;
}

export function speed(c: Character, granted: Effect[] = []): number {
  return Math.max(0, c.species.speed + speedParts(c, granted).reduce((s, p) => s + (p.active ? p.value : 0), 0));
}

/* ---------- Hit Dice ---------- */

export interface HitDiePool {
  die: number;
  total: number;
  used: number;
  available: number;
}

export function hitDicePools(c: Character): HitDiePool[] {
  const totals = new Map<number, number>();
  for (const k of c.classes) totals.set(k.hitDie, (totals.get(k.hitDie) ?? 0) + k.level);
  return [...totals.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([die, total]) => {
      const used = Math.min(total, c.hitDiceUsed[String(die)] ?? 0);
      return { die, total, used, available: total - used };
    });
}

/* HP maximo promedio: dado completo en nivel 1 de la primera clase, promedio redondeado arriba despues. */
export function averageHp(c: Character): number {
  const con = abilityMod(c, 'con');
  let hp = 0;
  c.classes.forEach((k, i) => {
    for (let l = 1; l <= k.level; l++) {
      const first = i === 0 && l === 1;
      hp += (first ? k.hitDie : k.hitDie / 2 + 1) + con;
    }
  });
  return Math.max(1, hp);
}

export const classSummary = (c: Character) =>
  (c.species.name.trim() ? `${c.species.name.trim()} · ` : '') +
  c.classes.map((k) => `${k.name}${k.subclass ? ` (${k.subclass})` : ''} ${k.level}`).join(' / ');


/* ---------- Ataques ---------- */

export interface Attack {
  id: string;
  name: string;
  ability: Ability;
  proficient: boolean;
  toHit: number;
  damage: string;
  versatile: string | null;
  damageType: string;
  notes: string[];
}

const dmg = (dice: string, bonus: number) => (bonus === 0 ? dice : `${dice} ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}`);

export function martialArtsDie(c: Character): number {
  const lvl = classLevel(c, 'monk');
  if (lvl === 0) return 0;
  const steps = c.ruleset === '2024' ? [6, 8, 10, 12] : [4, 6, 8, 10];
  return steps[lvl >= 17 ? 3 : lvl >= 11 ? 2 : lvl >= 5 ? 1 : 0];
}

const isMonkWeapon = (w: NonNullable<ItemEntry['weapon']>, name: string) =>
  /shortsword/i.test(name) ||
  (w.category === 'simple' && w.range === 'melee' && !w.properties.some((p) => /two-handed|heavy/i.test(p)));

/*
 * Weapon proficiency: categorias (simple, martial) o nombres. Compara sin mayusculas y tolera plural.
 */
export function proficientWith(weaponName: string, category: string, weaponProfs: string[]): boolean {
  const norm = (x: string) => x.toLowerCase().replace(/s$/, '').trim();
  const n = norm(weaponName);
  return weaponProfs.some((p) => {
    const q = norm(p);
    return q === category || q === `${category} weapon` || q === n || n.includes(q);
  });
}

export function attacks(c: Character, weaponProfs: string[]): Attack[] {
  const out: Attack[] = [];
  const str = abilityMod(c, 'str');
  const dex = abilityMod(c, 'dex');
  const p = pb(c);
  const monkDie = martialArtsDie(c);

  for (const it of c.inventory) {
    const w = it.weapon;
    if (!it.equipped || !w) continue;
    const finesse = w.properties.some((x) => /finesse/i.test(x));
    let ability: Ability = w.range === 'ranged' ? 'dex' : 'str';
    if (finesse || (monkDie && isMonkWeapon(w, it.name))) ability = dex > str ? 'dex' : 'str';
    if (it.attackAbility) ability = it.attackAbility;
    const m = abilityMod(c, ability);
    const proficient = proficientWith(it.name, w.category, weaponProfs);
    let dice = w.damage;
    if (monkDie && isMonkWeapon(w, it.name)) {
      const avg = (d: string) => {
        const [n, f] = d.split('d').map(Number);
        return f ? n * (f + 1) / 2 : Number(d) || 0;
      };
      if (avg(`1d${monkDie}`) > avg(dice)) dice = `1d${monkDie}`;
    }
    const notes: string[] = [];
    if (w.normalRange) notes.push(`${w.normalRange}/${w.longRange ?? w.normalRange} ft`);
    if (w.properties.length) notes.push(w.properties.join(', '));
    if (w.mastery) notes.push(`Mastery: ${w.mastery}`);
    if (!proficient) notes.push(tr('sin proficiency'));
    out.push({
      id: it.id,
      name: it.bonus ? `${it.name} +${it.bonus}` : it.name,
      ability,
      proficient,
      toHit: m + (proficient ? p : 0) + it.bonus,
      damage: dmg(dice, m + it.bonus),
      versatile: w.versatile ? dmg(w.versatile, m + it.bonus) : null,
      damageType: w.damageType,
      notes
    });
  }

  const unarmedAbility: Ability = monkDie && dex > str ? 'dex' : 'str';
  const um = abilityMod(c, unarmedAbility);
  out.push({
    id: 'unarmed',
    name: 'Unarmed Strike',
    ability: unarmedAbility,
    proficient: true,
    toHit: um + p,
    damage: monkDie ? dmg(`1d${monkDie}`, um) : `${Math.max(1, 1 + um)}`,
    versatile: null,
    damageType: 'bludgeoning',
    notes: monkDie ? ['Martial Arts'] : []
  });
  return out;
}
