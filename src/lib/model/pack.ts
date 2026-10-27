import { z } from 'zod';
import { ABILITIES, CASTER_TYPES, EFFECT_TARGETS } from './character';

/*
 * Formato de los packs de contenido (compendium).
 * La app no trae contenido: tu armas estos JSON (desde tus fuentes o homebrew) y los importas en Datos.
 * Clases y subclases van en listas separadas para que un pack homebrew pueda agregar subclases
 * a una clase definida en otro pack (o en los presets de la app).
 */

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const PackEffectSchema = z.object({
  target: z.enum(EFFECT_TARGETS).describe('speed en ft; initiative, ac y passives como bonus'),
  value: z.number().int().min(-200).max(200).describe('Bonus, puede ser negativo'),
  conditional: z
    .boolean()
    .default(false)
    .describe('true si se activa y desactiva en juego (ej. Bladesong). false si aplica siempre'),
  max: z.number().int().min(1).max(30).optional().describe('Abilities: tope del score (Primal Champion: 24)'),
  scale: z
    .enum(['none', 'level', 'pb'])
    .default('none')
    .describe('Multiplica el valor: level = nivel total (o de la clase en class features), pb = proficiency bonus. Ej. Tough: hp 2 por level')
});
export type PackEffect = z.infer<typeof PackEffectSchema>;

const strs = z.array(z.string()).default([]);

/* Lo que otorga un feature al tenerlo: proficiencies fijas o a elección. */
export const FeatureGrantsSchema = z
  .object({
    skills: strs.describe('Skills con proficiency'),
    expertise: strs.describe('Skills con expertise (también dan proficiency)'),
    skillChoices: z
      .array(
        z.object({
          count: z.union([z.number().int().min(1).max(18), z.string().min(1)]).describe('Número o tabla por nivel, ej. "2@1,4@6"'),
          from: strs.describe('vacío = cualquier skill (en modo upgrade: las que ya tienes)'),
          tools: strs.describe("Tools que también se pueden elegir en modo upgrade, ej. Thieves' Tools (Rogue 2014)"),
          mode: z
            .enum(['prof', 'expertise', 'either', 'upgrade'])
            .default('prof')
            .describe('expertise: proficiency y expertise. upgrade: expertise en una skill que ya tienes. either: proficiency, o expertise si ya la tenías')
        })
      )
      .default([]),
    armor: strs,
    weapons: strs,
    tools: strs,
    languages: strs,
    saves: z.array(z.enum(ABILITIES)).default([]),
    toolChoices: z.array(z.object({ count: z.number().int().min(1).max(6), from: strs.describe('Nombres; "artisan" = artisan tools') })).default([]),
    languageChoices: z.number().int().min(0).max(6).default(0),
    saveChoices: z.array(z.object({ count: z.number().int().min(1).max(6), from: z.array(z.enum(ABILITIES)).default([...ABILITIES]) })).default([]),
    resistances: strs.describe('Tipos de daño con resistance, ej. necrotic, radiant')
  })
  .nullable()
  .default(null);
export type FeatureGrants = NonNullable<z.infer<typeof FeatureGrantsSchema>>;

/*
 * Cantidades que cambian con el nivel de la clase. Una tabla "4@3,5@7,6@15" toma el valor del mayor nivel alcanzado.
 * Cada valor puede ser un número, pb, level, una ability (su modificador, mínimo 1) o sumas y productos simples:
 * "level*5", "pb*2", "1+cha", "level/2" (redondea abajo).
 */
export const AmountSchema = z.string().min(1);

export const ResourceDefSchema = z.object({
  name: z.string().min(1).describe('Ej. Superiority Dice, Rage, Ki Points'),
  uses: AmountSchema,
  recharge: z.string().default('long').describe('short, long o short1 (uno por Short Rest, todos por Long Rest). Acepta tabla: "long@1,short@5"'),
  die: z.string().default('').describe('Dado del recurso, puede ser tabla: "d8@3,d10@10,d12@18"')
});
export type ResourceDef = z.infer<typeof ResourceDefSchema>;
export const FeatureResourceSchema = ResourceDefSchema.nullable().default(null);

/* Elegir opciones de una lista del pack (maneuvers, fighting styles, metamagic...). "feat:<categoría>" usa feats del pack. */
export const FeatureChooseSchema = z
  .object({
    list: z.string().min(1),
    count: AmountSchema,
    label: z.string().default('').describe('Nombre para mostrar; por defecto el de la lista')
  })
  .nullable()
  .default(null);

export const FeatureSchema = z.object({
  id: z.string().optional().describe('Opcional. Si falta se genera desde el nivel y el nombre'),
  level: z.number().int().min(1).max(20),
  name: z.string().min(1),
  text: z.string().default('').describe('Texto del feature. Usa \\n\\n para separar parrafos'),
  effects: z.array(PackEffectSchema).default([]),
  grants: FeatureGrantsSchema,
  resource: FeatureResourceSchema,
  choose: FeatureChooseSchema
});

/* Opciones elegibles por features: maneuvers, fighting styles, metamagic, arcane shots, runes... */
export const PackOptionSchema = z.object({
  list: z.string().min(1).describe('Clave de la lista, ej. maneuvers'),
  listName: z.string().default('').describe('Nombre visible de la lista'),
  name: z.string().min(1),
  prerequisite: z.string().default(''),
  minLevel: z.number().int().min(1).max(20).default(1),
  text: z.string().default(''),
  grants: FeatureGrantsSchema,
  effects: z.array(PackEffectSchema).default([])
});
export type Feature = z.infer<typeof FeatureSchema> & { id: string };

const strings = z.array(z.string()).default([]);

/* Eleccion de N skills de una lista. from vacio = cualquiera. Usa nombres de skill (Animal Handling, etc.). */
export const SkillChoiceSchema = z
  .object({ count: z.number().int().min(1).max(18), from: strings })
  .nullable()
  .default(null);

export const ProfSetSchema = z
  .object({
    armor: strings.describe('light, medium, heavy, shields'),
    weapons: strings.describe('simple, martial, o nombres de armas'),
    tools: strings,
    skills: SkillChoiceSchema
  })
  .default({ armor: [], weapons: [], tools: [], skills: null });

export const GrantSpellSchema = z.object({
  spell: z.string().default('').describe('Spell fija por nombre. Vacío = a elegir'),
  count: z.number().int().min(1).max(10).default(1),
  level: z.number().int().min(0).max(9).default(0),
  schools: strings.describe('Schools permitidas al elegir'),
  lists: strings.describe('Listas de clase permitidas; si hay varias, se pide elegir una'),
  attackOnly: z.boolean().default(false).describe('Solo cantrips con attack roll (Spell Sniper)'),
  ritualOnly: z.boolean().default(false).describe('Solo spells ritual (Pact of the Tome 2024)'),
  minLevel: z.number().int().min(1).max(20).default(1).describe('Nivel total desde el que se tiene (spells de raza: nivel 3 y 5)'),
  uses: z
    .enum(['none', 'long', 'short', 'will'])
    .default('none')
    .describe('none: con slots. long/short: una vez gratis por descanso. will: sin slot cuando quieras')
});

const TraitSchema = z.object({
  name: z.string().min(1),
  text: z.string().default(''),
  effects: z.array(PackEffectSchema).default([]),
  grants: FeatureGrantsSchema,
  resources: z.array(ResourceDefSchema).default([]).describe('Usos del rasgo; "level" es el nivel total'),
  spells: z.array(GrantSpellSchema).default([]).describe('Spells del rasgo (Light Bearer, Infernal Legacy, Drow Magic...)'),
  spellAbility: z.string().default('').describe('Ability para esas spells: int, wis, cha o "pick" (a elegir)')
});

export const AsiChoiceSchema = z.object({
  count: z.number().int().min(1).max(6),
  amount: z.number().int().min(1).max(2),
  from: z.array(z.enum(ABILITIES)).default([...ABILITIES])
});

export const PackSpeciesSchema = z.object({
  name: z.string().min(1),
  size: z.string().default('Medium'),
  speed: z.number().int().min(0).max(120).default(30),
  darkvision: z.number().int().min(0).max(300).default(0),
  asi: z
    .object({
      fixed: z.partialRecord(z.enum(ABILITIES), z.number().int()).default({}),
      choose: z.array(AsiChoiceSchema).default([])
    })
    .default({ fixed: {}, choose: [] })
    .describe('2014: incrementos de la raza. 2024: vacio (los da el background)'),
  skills: strings,
  skillChoices: SkillChoiceSchema,
  proficiencies: ProfSetSchema,
  languages: strings,
  originFeat: z.boolean().default(false).describe('true si la raza da un feat a eleccion (Variant Human, Human 2024)'),
  traits: z.array(TraitSchema).default([]),
  source: z.string().default('')
});

export const PackBackgroundSchema = z.object({
  name: z.string().min(1),
  skills: strings,
  skillChoices: SkillChoiceSchema,
  tools: strings,
  languages: strings,
  asi: z.array(z.enum(ABILITIES)).default([]).describe('2024: las tres abilities que puede subir (+2/+1 o +1/+1/+1)'),
  feat: z.string().nullable().default(null).describe('2024: nombre del origin feat que otorga'),
  traits: z.array(TraitSchema).default([]),
  equipment: z.string().default(''),
  source: z.string().default('')
});


export const PackFeatSchema = z.object({
  name: z.string().min(1),
  category: z.string().default('general').describe('origin, general, fighting style, epic boon, racial...'),
  prerequisite: z.string().default(''),
  minLevel: z.number().int().min(1).max(20).default(1),
  asi: z
    .object({ amount: z.number().int().min(1).max(2).default(1), from: z.array(z.enum(ABILITIES)).min(1) })
    .nullable()
    .default(null)
    .describe('Half-feats: +1 a una de estas abilities'),
  repeatable: z.boolean().default(false),
  skills: z
    .array(
      z.object({
        count: z.number().int().min(1).max(18),
        from: strings.describe('vacío = cualquier skill'),
        mode: z.enum(['prof', 'expertise', 'either']).default('prof').describe('either: proficiency, o expertise si ya eras proficient')
      })
    )
    .default([])
    .describe('Skills que otorga el feat a elección'),
  spells: z.array(GrantSpellSchema).default([]).describe('Spells que otorga el feat (Fey Touched, Magic Initiate...)'),
  grants: FeatureGrantsSchema.describe('Proficiencies fijas que da el feat (armor, weapons, tools, saves...)'),
  saveFromAsi: z.boolean().default(false).describe('Resilient: proficiency en el save de la ability que sube el feat'),
  resources: z.array(ResourceDefSchema).default([]).describe('Usos del feat (Lucky: Luck Points). "level" es el nivel total'),
  choose: FeatureChooseSchema.describe('Opciones a elegir (Martial Adept: maneuvers, Fighting Initiate: un Fighting Style)'),
  spellAbility: z
    .string()
    .default('')
    .describe('Ability para estas spells: int, wis, cha, con, "asi" (la que sube el feat), "list" (según la lista elegida) o "pick"'),
  text: z.string().default(''),
  effects: z.array(PackEffectSchema).default([]),
  source: z.string().default('')
});

export const PACT_BOONS = ['blade', 'chain', 'tome', 'talisman'] as const;

export const PackInvocationSchema = z.object({
  name: z.string().min(1),
  prerequisite: z.string().default(''),
  minLevel: z.number().int().min(1).max(20).default(1).describe('Nivel de Warlock minimo'),
  pact: z.enum(PACT_BOONS).nullable().default(null),
  repeatable: z.boolean().default(false),
  spells: z.array(GrantSpellSchema).default([]).describe('Spells que otorga (Armor of Shadows, Pact of the Chain...)'),
  spellAbility: z.string().default('cha'),
  text: z.string().default(''),
  effects: z.array(PackEffectSchema).default([]),
  source: z.string().default('')
});

export const SPELL_SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'] as const;

export const PackSpellSchema = z.object({
  name: z.string().min(1),
  level: z.number().int().min(0).max(9).describe('0 = cantrip'),
  school: z.enum(SPELL_SCHOOLS),
  classes: strings.describe('Listas de clase que la incluyen, ej. ["Wizard", "Sorcerer"]'),
  castingTime: z.string().default('Action'),
  range: z.string().default('Self'),
  components: z.string().default('V, S').describe('V, S, M'),
  material: z.string().default('').describe('Componente material, si importa (costo o se consume)'),
  duration: z.string().default('Instantaneous'),
  concentration: z.boolean().default(false),
  ritual: z.boolean().default(false),
  text: z.string().default(''),
  higher: z.string().default('').describe('Qué cambia al lanzarla con un slot mayor o al subir de nivel (cantrips)'),
  attack: z.enum(['melee', 'ranged', 'auto']).nullable().default(null).describe('Tipo de ataque, para la tarjeta de Ataques'),
  save: z.enum(ABILITIES).nullable().default(null).describe('Saving throw que pide'),
  damage: z.string().default('').describe('Daño base, ej. "1d10 force" o "1d4 + 1 force"'),
  scaling: z.enum(['none', 'dice', 'beams']).default('none').describe('Cantrips: dados o rayos extra en niveles 5, 11 y 17'),
  source: z.string().default('')
});

export const SubclassSpellsSchema = z.object({
  level: z.number().int().min(1).max(20).describe('always: nivel de clase. expanded: nivel de spell'),
  spells: strings,
  mode: z.enum(['always', 'expanded']).default('always').describe('always: siempre preparadas. expanded: se suman a tu lista de clase'),
  variant: z.string().default('').describe('Opción a elegir, ej. el terreno de Circle of the Land')
});

export const WeaponDataSchema = z.object({
  category: z.enum(['simple', 'martial']),
  range: z.enum(['melee', 'ranged']),
  damage: z.string().describe('Ej. 1d8, 2d6 o 1'),
  damageType: z.string(),
  versatile: z.string().nullable().default(null),
  properties: strings.describe('finesse, light, heavy, two-handed, reach, thrown, ammunition, loading, versatile...'),
  normalRange: z.number().int().nullable().default(null),
  longRange: z.number().int().nullable().default(null),
  mastery: z.string().nullable().default(null)
});

export const ArmorDataSchema = z.object({
  category: z.enum(['light', 'medium', 'heavy', 'shield']),
  ac: z.number().int().min(0).max(30),
  dexMax: z.number().int().min(0).max(10).nullable().default(null).describe('null = DEX completo, 0 = sin DEX'),
  strength: z.number().int().min(0).max(30).nullable().default(null),
  stealthDisadvantage: z.boolean().default(false)
});

export const ITEM_KINDS = ['weapon', 'armor', 'gear', 'tool', 'other'] as const;

export const PackItemSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(ITEM_KINDS),
  category: z.string().default('').describe('Para agrupar: Adventuring Gear, Ammunition, Artisan Tools...'),
  cost: z.string().default(''),
  weight: z.number().min(0).default(0),
  text: z.string().default(''),
  weapon: WeaponDataSchema.nullable().default(null),
  armor: ArmorDataSchema.nullable().default(null)
});

export const PackClassSchema = z.object({
  name: z.string().min(1).describe('Nombre de la clase. Se compara sin mayusculas con la clase del personaje'),
  hitDie: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]).describe('6, 8, 10 o 12'),
  caster: z.enum(CASTER_TYPES),
  spellAbility: z.enum(ABILITIES).nullable().default(null),
  saves: z.array(z.enum(ABILITIES)).default([]),
  subclassLevel: z.number().int().min(1).max(20).default(3).describe('Nivel en que se elige la subclass'),
  subclassLabel: z.string().default('Subclass').describe('Ej. Otherworldly Patron, Arcane Tradition'),
  proficiencies: ProfSetSchema.describe('Lo que otorga como clase inicial'),
  multiclass: ProfSetSchema.describe('Lo que otorga al tomarla como multiclass'),
  features: z.array(FeatureSchema).default([])
});

export const PackSubclassSchema = z.object({
  id: z.string().optional().describe('Opcional. Si falta se genera como clase/nombre'),
  class: z.string().min(1).describe('Nombre de la clase a la que pertenece'),
  name: z.string().min(1),
  caster: z
    .enum(CASTER_TYPES)
    .optional()
    .describe('Opcional. Cambia el spellcasting de la clase al elegir esta subclass (ej. Eldritch Knight: third)'),
  spellAbility: z.enum(ABILITIES).nullable().optional(),
  features: z.array(FeatureSchema).default([]),
  spells: z.array(SubclassSpellsSchema).default([]).describe('Domain, Oath, Circle o Patron spells')
});

export const PackSchema = z.object({
  $schema: z.string().optional(),
  format: z.literal('cuts5e-pack'),
  version: z.literal(1),
  pack: z.object({
    id: z.string().min(1).describe('Identificador unico. Importar otro pack con el mismo id lo reemplaza'),
    name: z.string().min(1),
    ruleset: z.enum(['2014', '2024']),
    homebrew: z.boolean().default(false),
    built: z.string().default('').describe('Fecha de generación (ISO). Sirve para avisar si un pack quedó viejo')
  }),
  classes: z.array(PackClassSchema).default([]),
  subclasses: z.array(PackSubclassSchema).default([]),
  species: z.array(PackSpeciesSchema).default([]),
  backgrounds: z.array(PackBackgroundSchema).default([]),
  feats: z.array(PackFeatSchema).default([]),
  invocations: z.array(PackInvocationSchema).default([]),
  items: z.array(PackItemSchema).default([]),
  spells: z.array(PackSpellSchema).default([]),
  options: z.array(PackOptionSchema).default([])
});
export type PackInput = z.input<typeof PackSchema>;
type PackParsed = z.infer<typeof PackSchema>;

export interface PackClass extends Omit<z.infer<typeof PackClassSchema>, 'features'> {
  key: string;
  features: Feature[];
}
export interface PackSubclass extends Omit<z.infer<typeof PackSubclassSchema>, 'features' | 'id'> {
  id: string;
  features: Feature[];
}
type WithId<T> = T & { id: string };
export type PackSpecies = WithId<z.infer<typeof PackSpeciesSchema>>;
export type PackBackground = WithId<z.infer<typeof PackBackgroundSchema>>;
export type PackFeat = WithId<z.infer<typeof PackFeatSchema>>;
export type PackInvocation = WithId<z.infer<typeof PackInvocationSchema>>;
export type PackItem = WithId<z.infer<typeof PackItemSchema>>;
export type PackSpell = WithId<z.infer<typeof PackSpellSchema>>;
export type PackOption = z.infer<typeof PackOptionSchema>;
export type WeaponData = z.infer<typeof WeaponDataSchema>;
export type ArmorData = z.infer<typeof ArmorDataSchema>;
export type ProfSet = z.infer<typeof ProfSetSchema>;
export type SkillChoice = z.infer<typeof SkillChoiceSchema>;

export interface Pack
  extends Omit<PackParsed, 'classes' | 'subclasses' | 'species' | 'backgrounds' | 'feats' | 'invocations' | 'items' | 'spells' | 'options' | '$schema'> {
  classes: PackClass[];
  subclasses: PackSubclass[];
  species: PackSpecies[];
  backgrounds: PackBackground[];
  feats: PackFeat[];
  invocations: PackInvocation[];
  items: PackItem[];
  spells: PackSpell[];
  options: PackOption[];
}

/* Ids estables por nombre; si se repite un nombre se agrega un sufijo. */
function withIds<T extends { name: string }>(list: T[]): (T & { id: string })[] {
  const seen = new Map<string, number>();
  return list.map((x) => {
    const base = slug(x.name);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...x, id: n === 1 ? base : `${base}-${n}` };
  });
}

/* Completa ids estables: pack/clase/nivel-nombre. Se usan para recordar el estado de efectos condicionales. */
export function normalizePack(p: PackParsed): Pack {
  const pid = p.pack.id;
  const feats = (prefix: string, list: z.infer<typeof FeatureSchema>[]): Feature[] =>
    list
      .map((f) => ({ ...f, id: f.id ?? `${prefix}/${f.level}-${slug(f.name)}` }))
      .sort((a, b) => a.level - b.level);
  return {
    format: p.format,
    version: p.version,
    pack: p.pack,
    classes: p.classes.map((c) => {
      const key = slug(c.name);
      return { ...c, key, features: feats(`${pid}/${key}`, c.features) };
    }),
    subclasses: p.subclasses.map((s) => {
      const id = s.id ?? `${slug(s.class)}/${slug(s.name)}`;
      return { ...s, id, features: feats(`${pid}/${id}`, s.features) };
    }),
    species: withIds(p.species),
    backgrounds: withIds(p.backgrounds),
    feats: withIds(p.feats),
    invocations: withIds(p.invocations),
    items: withIds(p.items),
    spells: withIds(p.spells),
    options: p.options
  };
}

export type PackParseResult = { ok: true; pack: Pack } | { ok: false; errors: string[] };

export function parsePack(raw: unknown): PackParseResult {
  const r = PackSchema.safeParse(raw);
  if (!r.success) {
    return {
      ok: false,
      errors: r.error.issues.slice(0, 10).map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
    };
  }
  const pack = normalizePack(r.data);
  const ids = new Set<string>();
  for (const s of pack.subclasses) {
    if (ids.has(s.id)) return { ok: false, errors: [`Subclass repetida: ${s.id}`] };
    ids.add(s.id);
  }
  return { ok: true, pack };
}

export const sameName = (a: string, b: string) => slug(a) === slug(b);
export { slug };
