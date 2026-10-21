import { z } from 'zod';

/*
 * Modelo del personaje.
 * Principio: solo se guardan inputs (lo que eliges) y consumo (lo que gastaste).
 * Todo lo calculable (mods, PB, slots maximos, DC...) se deriva en lib/rules.
 */

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];

export const CASTER_TYPES = ['none', 'full', 'half', 'third', 'artificer', 'pact'] as const;
export type CasterType = (typeof CASTER_TYPES)[number];

export const PROF_LEVELS = ['none', 'prof', 'expertise'] as const;
export type ProfLevel = (typeof PROF_LEVELS)[number];

export const HIT_DICE = [6, 8, 10, 12] as const;
export const MAX_LEVEL = 20;

const int = (min = -99, max = 999) => z.coerce.number().int().min(min).max(max);
const abilityEnum = z.enum(ABILITIES);
const score = int(1, 30);

export const ClassEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  subclass: z.string().default(''),
  /* "packId:subclassId" si la subclass se eligio de un pack importado; null si es texto libre. */
  subclassId: z.string().nullable().default(null),
  level: int(1, 20),
  hitDie: z.coerce.number().refine((n) => (HIT_DICE as readonly number[]).includes(n), 'hitDie invalido'),
  caster: z.enum(CASTER_TYPES),
  spellAbility: abilityEnum.nullable()
});
export type ClassEntry = z.infer<typeof ClassEntrySchema>;

export const ResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  max: int(0, 99),
  used: int(0, 99),
  recharge: z.enum(['short', 'long', 'none'])
});
export type Resource = z.infer<typeof ResourceSchema>;

export const AC_MODES = ['auto', 'unarmored', 'unarmored-con', 'unarmored-wis', 'unarmored-cha', 'mage', 'light', 'medium', 'heavy', 'custom'] as const;

/*
 * Efectos: modificadores con fuente (raza, subclass, feat, spell, item...).
 * Hoy solo afectan speed; en etapas siguientes se suman initiative, AC, etc.
 * Los packs del compendium traeran sus efectos y se agregaran solos al elegir la entrada.
 */
export const EFFECT_TARGETS = ['speed', 'initiative', 'ac', 'passive-perception', 'passive-investigation', 'passive-insight'] as const;
export type EffectTarget = (typeof EFFECT_TARGETS)[number];
export const EFFECT_LABEL: Record<EffectTarget, string> = {
  speed: 'Speed',
  initiative: 'Initiative',
  ac: 'AC',
  'passive-perception': 'Passive Perception',
  'passive-investigation': 'Passive Investigation',
  'passive-insight': 'Passive Insight'
};
export const EFFECT_SOURCES = ['species', 'class', 'subclass', 'feat', 'spell', 'item', 'other'] as const;
export type EffectSource = (typeof EFFECT_SOURCES)[number];

export const EffectSchema = z.object({
  id: z.string(),
  source: z.string(),
  sourceType: z.enum(EFFECT_SOURCES),
  target: z.enum(EFFECT_TARGETS),
  value: int(-200, 200),
  /* true: se activa y desactiva desde Combate (Bladesong, Longstrider...). */
  conditional: z.boolean(),
  active: z.boolean()
});
export type Effect = z.infer<typeof EffectSchema>;

export const BonusSchema = z.object({ ability: abilityEnum, amount: int(-10, 10) });
export type Bonus = z.infer<typeof BonusSchema>;

/* Eleccion en un nivel de ASI: subir abilities o tomar un feat (opcionalmente con su +1). */
export const AdvancementSchema = z.object({
  kind: z.enum(['asi', 'feat']),
  asi: z.array(BonusSchema).default([]),
  featRef: z.string().nullable().default(null),
  featName: z.string().default(''),
  featAbility: abilityEnum.nullable().default(null)
});
export type Advancement = z.infer<typeof AdvancementSchema>;

/* Feats que no vienen de un nivel de ASI: origin feat de raza o background, bonus feats, etc. */
export const FeatEntrySchema = z.object({
  id: z.string(),
  ref: z.string().nullable().default(null),
  name: z.string(),
  source: z.enum(['species', 'background', 'other']),
  ability: abilityEnum.nullable().default(null)
});
export type FeatEntry = z.infer<typeof FeatEntrySchema>;

export const InvocationEntrySchema = z.object({
  id: z.string(),
  ref: z.string().nullable().default(null),
  name: z.string()
});

/* Spell en la lista del personaje. Nombre y nivel se copian para que funcione sin el pack. */
export const SpellEntrySchema = z.object({
  id: z.string(),
  ref: z.string().nullable().default(null),
  name: z.string(),
  level: int(0, 9),
  /* Clase con la que se lanza (ability, DC). null = la primera clase caster. */
  classId: z.string().nullable().default(null),
  prepared: z.boolean().default(false),
  /* Siempre preparada (Domain, Oath, feats...): no cuenta para el límite. */
  always: z.boolean().default(false),
  notes: z.string().default('')
});
export type SpellEntry = z.infer<typeof SpellEntrySchema>;

export const WeaponInfoSchema = z.object({
  category: z.enum(['simple', 'martial']),
  range: z.enum(['melee', 'ranged']),
  damage: z.string(),
  damageType: z.string(),
  versatile: z.string().nullable().default(null),
  properties: z.array(z.string()).default([]),
  normalRange: z.number().int().nullable().default(null),
  longRange: z.number().int().nullable().default(null),
  mastery: z.string().nullable().default(null)
});
export const ArmorInfoSchema = z.object({
  category: z.enum(['light', 'medium', 'heavy', 'shield']),
  ac: int(0, 30),
  dexMax: z.number().int().nullable().default(null),
  strength: z.number().int().nullable().default(null),
  stealthDisadvantage: z.boolean().default(false)
});

/* Los datos del item se copian del pack al agregarlo: el inventario no depende de que el pack siga importado. */
export const ItemEntrySchema = z.object({
  id: z.string(),
  ref: z.string().nullable().default(null),
  name: z.string(),
  kind: z.enum(['weapon', 'armor', 'gear', 'tool', 'other']),
  qty: int(0, 9999).default(1),
  equipped: z.boolean().default(false),
  attuned: z.boolean().default(false),
  bonus: int(-5, 10).default(0),
  attackAbility: abilityEnum.nullable().default(null),
  weight: z.number().min(0).default(0),
  notes: z.string().default(''),
  weapon: WeaponInfoSchema.nullable().default(null),
  armor: ArmorInfoSchema.nullable().default(null)
});
export type ItemEntry = z.infer<typeof ItemEntrySchema>;

export const ABILITY_METHODS = ['manual', 'pointbuy', 'array'] as const;

const strList = z.array(z.string()).default([]);

const CharacterObject = z.object({
  format: z.literal('cuts5e-character'),
  version: z.literal(1),
  id: z.string(),
  name: z.string(),
  ruleset: z.enum(['2014', '2024']),
  classes: z.array(ClassEntrySchema).min(1),
  abilities: z.object({ str: score, dex: score, con: score, int: score, wis: score, cha: score }),
  saves: z.array(abilityEnum),
  skills: z.record(z.string(), z.enum(PROF_LEVELS)),
  hp: z.object({ max: int(0), current: int(-999), temp: int(0) }),
  hitDiceUsed: z.record(z.string(), int(0, 20)),
  ac: z.object({
    mode: z.enum(AC_MODES),
    base: int(0, 30),
    shield: z.boolean(),
    bonus: int(-10, 10)
  }),
  initiativeBonus: int(-10, 20),
  species: z.object({
    name: z.string(),
    speed: int(0, 200),
    ref: z.string().nullable().default(null),
    size: z.string().default('Medium'),
    darkvision: int(0, 300).default(0)
  }),
  background: z.object({ name: z.string(), ref: z.string().nullable() }).default({ name: '', ref: null }),
  /* abilities = scores base. Los incrementos van aparte y se suman en lib/rules. */
  abilityMethod: z.enum(ABILITY_METHODS).default('manual'),
  bonuses: z
    .object({ species: z.array(BonusSchema), background: z.array(BonusSchema), other: z.array(BonusSchema) })
    .default({ species: [], background: [], other: [] }),
  /* Clave "classId:nivel" de cada nivel de ASI. */
  advancements: z.record(z.string(), AdvancementSchema).default({}),
  feats: z.array(FeatEntrySchema).default([]),
  invocations: z.array(InvocationEntrySchema).default([]),
  pactBoon: z.enum(['none', 'blade', 'chain', 'tome', 'talisman']).default('none'),
  /* Skills elegidas por fuente: class, species, background, feat. Las fijas de raza o background tambien van aqui. */
  skillPicks: z.record(z.string(), z.array(z.string())).default({}),
  /* Proficiencies extra agregadas a mano (las de clase, raza y background se calculan). */
  extraProficiencies: z
    .object({ armor: strList, weapons: strList, tools: strList, languages: strList })
    .default({ armor: [], weapons: [], tools: [], languages: [] }),
  inventory: z.array(ItemEntrySchema).default([]),
  currency: z
    .object({ cp: int(0, 999999), sp: int(0, 999999), ep: int(0, 999999), gp: int(0, 999999), pp: int(0, 999999) })
    .default({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
  effects: z.array(EffectSchema),
  /* Estado on/off de efectos condicionales que vienen de features del compendium. */
  toggles: z.record(z.string(), z.boolean()).default({}),
  spellBonus: z.object({ attack: int(-10, 10), dc: int(-10, 10) }),
  slotsUsed: z.object({
    pact: int(0, 9),
    levels: z.array(int(0, 9)).length(9)
  }),
  arcaneRecoveryUsed: z.boolean(),
  spells: z.array(SpellEntrySchema).default([]),
  /* Opción elegida para listas con variantes (terreno de Circle of the Land), por classId. */
  spellVariants: z.record(z.string(), z.string()).default({}),
  /* Elecciones de spells de feats (Fey Touched, Magic Initiate...) por instancia de feat. */
  featSpells: z
    .record(
      z.string(),
      z.object({
        list: z.string().default(''),
        ability: abilityEnum.nullable().default(null),
        picks: z.record(z.string(), z.array(z.string())).default({})
      })
    )
    .default({}),
  /* Lanzamientos gratis gastados. Clave "L:..." se recupera en Long Rest, "S:..." también en Short Rest. */
  freeUsed: z.record(z.string(), z.boolean()).default({}),
  /* Spell con concentration activa ('' = ninguna). */
  concentration: z.string().default(''),
  resources: z.array(ResourceSchema),
  /* Usos gastados de recursos de features (Superiority Dice, Rage...). Clave "<S|L|O>:<featureId>" según cómo se recupera. */
  featureUsed: z.record(z.string(), z.number().int().min(0).max(999)).default({}),
  /* Elecciones de features: opciones (maneuvers...), tools, idiomas y saves, por id de feature. */
  featureChoices: z.record(z.string(), z.array(z.string())).default({}),
  /* Saves que dan los features (Diamond Soul, Slippery Mind...). Se calculan solos desde los packs. */
  autoSaves: z.array(abilityEnum).default([]),
  notes: z.string(),
  updatedAt: z.string()
});
/* Migra respaldos anteriores: el campo `speed` manual pasa a ser la speed base de la raza. */
function migrate(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = { ...(raw as Record<string, unknown>) };
  if (!r.species) r.species = { name: '', speed: typeof r.speed === 'number' ? r.speed : 30 };
  if (!Array.isArray(r.effects)) r.effects = [];
  // Respaldos anteriores al inventario: el AC pasa a automatico (conserva el bonus).
  if (!Array.isArray(r.inventory) && r.ac && typeof r.ac === 'object') {
    const ac = { ...(r.ac as Record<string, unknown>) };
    if (['unarmored', 'unarmored-con', 'unarmored-wis'].includes(String(ac.mode)) && !ac.shield) ac.mode = 'auto';
    r.ac = ac;
  }
  delete r.speed;
  // El nivel total no puede pasar de 20: se recorta desde la ultima clase agregada.
  if (Array.isArray(r.classes)) {
    const classes = r.classes.map((k: Record<string, unknown>) => ({ ...k }));
    let extra = classes.reduce((s: number, k) => s + (Number(k.level) || 0), 0) - MAX_LEVEL;
    if (extra > 0) {
      r.classes = classes;
      for (let i = classes.length - 1; i >= 0 && extra > 0; i--) {
        const k = classes[i] as { level: number };
        const cut = Math.min(extra, Number(k.level) - 1);
        k.level = Number(k.level) - cut;
        extra -= cut;
      }
    }
  }
  return r;
}

export const CharacterSchema = z.preprocess(migrate, CharacterObject);
export type Character = z.infer<typeof CharacterObject>;

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

/* Datos por defecto de clases (nombres de clase, hit die, tipo de caster y saves iniciales). */
export interface ClassPreset {
  name: string;
  hitDie: number;
  caster: CasterType;
  spellAbility: Ability | null;
  saves: Ability[];
}

export const CLASS_PRESETS: ClassPreset[] = [
  { name: 'Artificer', hitDie: 8, caster: 'artificer', spellAbility: 'int', saves: ['con', 'int'] },
  { name: 'Barbarian', hitDie: 12, caster: 'none', spellAbility: null, saves: ['str', 'con'] },
  { name: 'Bard', hitDie: 8, caster: 'full', spellAbility: 'cha', saves: ['dex', 'cha'] },
  { name: 'Cleric', hitDie: 8, caster: 'full', spellAbility: 'wis', saves: ['wis', 'cha'] },
  { name: 'Druid', hitDie: 8, caster: 'full', spellAbility: 'wis', saves: ['int', 'wis'] },
  { name: 'Fighter', hitDie: 10, caster: 'none', spellAbility: null, saves: ['str', 'con'] },
  { name: 'Monk', hitDie: 8, caster: 'none', spellAbility: null, saves: ['str', 'dex'] },
  { name: 'Paladin', hitDie: 10, caster: 'half', spellAbility: 'cha', saves: ['wis', 'cha'] },
  { name: 'Ranger', hitDie: 10, caster: 'half', spellAbility: 'wis', saves: ['str', 'dex'] },
  { name: 'Rogue', hitDie: 8, caster: 'none', spellAbility: null, saves: ['dex', 'int'] },
  { name: 'Sorcerer', hitDie: 6, caster: 'full', spellAbility: 'cha', saves: ['con', 'cha'] },
  { name: 'Warlock', hitDie: 8, caster: 'pact', spellAbility: 'cha', saves: ['wis', 'cha'] },
  { name: 'Wizard', hitDie: 6, caster: 'full', spellAbility: 'int', saves: ['int', 'wis'] }
];

export function classFromPreset(p: ClassPreset, level = 1): ClassEntry {
  return {
    id: uid(),
    name: p.name,
    subclass: '',
    subclassId: null,
    level,
    hitDie: p.hitDie,
    caster: p.caster,
    spellAbility: p.spellAbility
  };
}

/* Personaje en blanco. La pantalla de creacion lo completa con lo que elijas. */
export function blankCharacter(): Character {
  const fighter = CLASS_PRESETS.find((p) => p.name === 'Fighter')!;
  return {
    format: 'cuts5e-character',
    version: 1,
    id: uid(),
    name: '',
    ruleset: '2014',
    classes: [classFromPreset(fighter)],
    abilities: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    saves: [...fighter.saves],
    skills: {},
    hp: { max: 0, current: 0, temp: 0 },
    hitDiceUsed: {},
    ac: { mode: 'auto', base: 10, shield: false, bonus: 0 },
    initiativeBonus: 0,
    species: { name: '', speed: 30, ref: null, size: 'Medium', darkvision: 0 },
    background: { name: '', ref: null },
    abilityMethod: 'pointbuy',
    bonuses: { species: [], background: [], other: [] },
    advancements: {},
    feats: [],
    invocations: [],
    pactBoon: 'none',
    skillPicks: {},
    extraProficiencies: { armor: [], weapons: [], tools: [], languages: [] },
    inventory: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    effects: [],
    toggles: {},
    spellBonus: { attack: 0, dc: 0 },
    slotsUsed: { pact: 0, levels: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
    spells: [],
    spellVariants: {},
    featSpells: {},
    freeUsed: {},
    concentration: '',
    arcaneRecoveryUsed: false,
    resources: [],
    featureUsed: {},
    featureChoices: {},
    autoSaves: [],
    notes: '',
    updatedAt: new Date().toISOString()
  };
}
