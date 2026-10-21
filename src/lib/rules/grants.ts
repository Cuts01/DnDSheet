import { ABILITIES, type Ability, type Character, type ClassEntry } from '../model/character';
import { slug, type Feature, type FeatureGrants, type Pack, type PackOption } from '../model/pack';
import { abilityMod, featureSource, pb, skillSources } from './derive';
import { findClass, findSubclass, featList } from './features';
import { SKILLS } from './tables';

/*
 * Lo que dan los class features además de su texto: proficiencies (fijas o a elección),
 * recursos con usos (Superiority Dice, Rage, Ki...) y elecciones de listas (maneuvers, fighting styles...).
 */

export interface OwnedClassFeature {
  feature: Feature;
  entry: ClassEntry;
  /* '' si es de la clase; id de la subclass ("pack:sub") si es de subclass. */
  subId: string;
  sourceName: string;
}

/* Features que ya tienes, con la clase que los da. */
export function ownedFeatures(c: Character, packs: Pack[]): OwnedClassFeature[] {
  const out: OwnedClassFeature[] = [];
  for (const entry of c.classes) {
    const cls = findClass(packs, entry.name, c.ruleset)?.cls;
    for (const f of cls?.features ?? []) if (f.level <= entry.level) out.push({ feature: f, entry, subId: '', sourceName: cls!.name });
    const sub = findSubclass(packs, entry.subclassId)?.sub;
    for (const f of sub?.features ?? [])
      if (f.level <= entry.level) out.push({ feature: f, entry, subId: entry.subclassId ?? '', sourceName: sub!.name });
  }
  return out;
}

/* ---------- Cantidades por nivel ---------- */

/* Toma el valor de una tabla "a@1,b@5" para el nivel; sin "@" es el valor directo. null si aún no aplica. */
export function tableValue(expr: string, level: number): string | null {
  if (!expr.includes('@')) return expr.trim();
  let best: string | null = null;
  let bestLevel = -1;
  for (const part of expr.split(',')) {
    const [v, l] = part.split('@');
    const n = Number(l);
    if (n <= level && n > bestLevel) {
      best = v.trim();
      bestLevel = n;
    }
  }
  return best;
}

/* Evalúa un valor: número, pb, level, una ability (modificador, mínimo 1), con + * y / simples. */
export function evalAmount(expr: string, c: Character, level: number): number {
  const v = tableValue(expr, level);
  if (v === null) return 0;
  const term = (t: string): number => {
    const [head, ...ops] = t.split(/(?=[*/])/);
    let n = factor(head.trim());
    for (const op of ops) {
      const x = Number(op.slice(1));
      n = op[0] === '*' ? n * x : Math.floor(n / x);
    }
    return n;
  };
  const factor = (f: string): number => {
    if (/^-?\d+$/.test(f)) return Number(f);
    if (f === 'pb') return pb(c);
    if (f === 'level') return level;
    if ((ABILITIES as readonly string[]).includes(f)) return Math.max(1, abilityMod(c, f as Ability));
    return 0;
  };
  return Math.max(0, v.split('+').reduce((s, t) => s + term(t), 0));
}

/* ---------- Recursos ---------- */

export type Recharge = 'short' | 'long' | 'short1';
const PREFIX: Record<Recharge, string> = { short: 'S', long: 'L', short1: 'O' };

export interface FeatureResource {
  key: string; // clave en c.featureUsed
  name: string;
  max: number;
  used: number;
  die: string;
  recharge: Recharge;
  featureId: string;
  /* Opciones elegidas del mismo feature (maneuvers de Combat Superiority, por ejemplo). */
  picks: string[];
}

export function featureResources(c: Character, packs: Pack[]): FeatureResource[] {
  const out: FeatureResource[] = [];
  const seen = new Set<string>();
  for (const o of ownedFeatures(c, packs)) {
    const r = o.feature.resource;
    if (!r) continue;
    const level = o.entry.level;
    const recharge = (tableValue(r.recharge, level) ?? 'long') as Recharge;
    const max = evalAmount(r.uses, c, level);
    if (max <= 0) continue;
    // Un recurso con el mismo nombre (Channel Divinity de clase y subclass) se muestra una vez, el de más usos.
    const name = r.name;
    const dup = out.find((x) => x.name === name);
    if (dup) {
      if (max > dup.max) Object.assign(dup, { max });
      continue;
    }
    const key = `${PREFIX[recharge] ?? 'L'}:${o.feature.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      name,
      max,
      used: Math.min(max, c.featureUsed[key] ?? 0),
      die: r.die ? (tableValue(r.die, level) ?? '') : '',
      recharge,
      featureId: o.feature.id,
      picks: c.featureChoices[o.feature.id] ?? []
    });
  }
  return out;
}

/* ---------- Elecciones de listas ---------- */

export interface ChoiceOption {
  name: string;
  text: string;
  prerequisite: string;
  minLevel: number;
  grants: FeatureGrants | null;
}

export function optionList(packs: Pack[], ruleset: string, list: string): { name: string; options: ChoiceOption[] } {
  const sorted = [...packs].sort((a, b) => Number(b.pack.ruleset === ruleset) - Number(a.pack.ruleset === ruleset));
  if (list.startsWith('feat:')) {
    const cat = list.slice(5).replace(/-/g, ' ').toLowerCase();
    const seen = new Set<string>();
    const options = featList(sorted, ruleset)
      .filter((f) => f.item.category.toLowerCase() === cat && f.pack.pack.ruleset === ruleset)
      .filter((f) => !seen.has(f.item.name) && seen.add(f.item.name))
      .map((f) => ({ name: f.item.name, text: f.item.text, prerequisite: '', minLevel: 1, grants: null }));
    return { name: cat.replace(/\b\w/g, (m) => m.toUpperCase()), options };
  }
  // Las listas del mismo ruleset primero; si no hay, las del otro.
  const own = sorted.filter((p) => p.pack.ruleset === ruleset).flatMap((p) => p.options.filter((o) => o.list === list));
  const all: PackOption[] = own.length ? own : sorted.flatMap((p) => p.options.filter((o) => o.list === list));
  const seen = new Set<string>();
  const options = all.filter((o) => !seen.has(o.name) && seen.add(o.name)).sort((a, b) => a.name.localeCompare(b.name));
  return { name: all[0]?.listName || list, options };
}

export interface FeatureChoiceSlot {
  featureId: string;
  featureName: string;
  label: string;
  count: number;
  level: number;
  options: ChoiceOption[];
  chosen: string[];
}

export function featureChoiceSlots(c: Character, packs: Pack[]): FeatureChoiceSlot[] {
  const out: FeatureChoiceSlot[] = [];
  for (const o of ownedFeatures(c, packs)) {
    const ch = o.feature.choose;
    if (!ch) continue;
    const count = evalAmount(ch.count, c, o.entry.level);
    if (count <= 0) continue;
    const list = optionList(packs, c.ruleset, ch.list);
    out.push({
      featureId: o.feature.id,
      featureName: o.feature.name,
      label: ch.label || list.name,
      count,
      level: o.entry.level,
      options: list.options,
      chosen: c.featureChoices[o.feature.id] ?? []
    });
  }
  return out;
}

/* Lo fijo que da cada feature y cada opción elegida de su lista (Divine Order: Protector da Heavy armor...). */
interface GrantUnit {
  o: OwnedClassFeature;
  id: string;
  grants: FeatureGrants;
}
function grantUnits(c: Character, packs: Pack[]): GrantUnit[] {
  const out: GrantUnit[] = [];
  for (const o of ownedFeatures(c, packs)) {
    if (o.feature.grants) out.push({ o, id: o.feature.id, grants: o.feature.grants });
    const ch = o.feature.choose;
    const chosen = c.featureChoices[o.feature.id] ?? [];
    if (!ch || !chosen.length) continue;
    for (const opt of optionList(packs, c.ruleset, ch.list).options)
      if (opt.grants && chosen.includes(opt.name)) out.push({ o, id: `${o.feature.id}~${slug(opt.name)}`, grants: opt.grants });
  }
  return out;
}

/* ---------- Tools, idiomas y saves a elección ---------- */

export const STANDARD_LANGUAGES = [
  'Common', 'Common Sign Language', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc',
  'Abyssal', 'Celestial', 'Deep Speech', 'Draconic', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'
];

const TOOL_GROUPS: Record<string, string> = {
  artisan: "artisan's tools",
  instrument: 'musical instrument',
  gaming: 'gaming set'
};

function toolOptions(packs: Pack[], ruleset: string, from: string[]): string[] {
  const items = packs.filter((p) => p.pack.ruleset === ruleset || !packs.some((x) => x.pack.ruleset === ruleset)).flatMap((p) => p.items);
  const tools = items.filter((i) => i.kind === 'tool');
  const out = new Set<string>();
  const list = from.length ? from : Object.keys(TOOL_GROUPS);
  for (const f of list) {
    const group = TOOL_GROUPS[f.toLowerCase()];
    if (group) tools.filter((t) => t.category.toLowerCase().startsWith(group.slice(0, 8))).forEach((t) => out.add(t.name));
    else out.add(f);
  }
  return [...out].sort();
}

export interface ExtraChoice {
  key: string; // clave en c.featureChoices
  featureName: string;
  kind: 'tool' | 'language' | 'save';
  count: number;
  options: string[];
  chosen: string[];
}

export function extraChoices(c: Character, packs: Pack[]): ExtraChoice[] {
  const out: ExtraChoice[] = [];
  for (const o of ownedFeatures(c, packs)) {
    const g = o.feature.grants;
    if (!g) continue;
    const id = o.feature.id;
    g.toolChoices.forEach((t, i) =>
      out.push({ key: `${id}#tool${i}`, featureName: o.feature.name, kind: 'tool', count: t.count, options: toolOptions(packs, c.ruleset, t.from), chosen: c.featureChoices[`${id}#tool${i}`] ?? [] })
    );
    if (g.languageChoices)
      out.push({ key: `${id}#lang`, featureName: o.feature.name, kind: 'language', count: g.languageChoices, options: STANDARD_LANGUAGES, chosen: c.featureChoices[`${id}#lang`] ?? [] });
    g.saveChoices.forEach((s, i) =>
      out.push({ key: `${id}#save${i}`, featureName: o.feature.name, kind: 'save', count: s.count, options: [...s.from], chosen: c.featureChoices[`${id}#save${i}`] ?? [] })
    );
  }
  return out;
}

/* Armor, weapons, tools e idiomas que dan los features (para sumar a proficiencies). */
export function featureProficiencies(c: Character, packs: Pack[]) {
  const out = { armor: [] as string[], weapons: [] as string[], tools: [] as string[], languages: [] as string[] };
  for (const { grants: g } of grantUnits(c, packs)) {
    out.armor.push(...g.armor);
    out.weapons.push(...g.weapons);
    out.tools.push(...g.tools);
    out.languages.push(...g.languages);
  }
  for (const x of extraChoices(c, packs)) {
    if (x.kind === 'tool') out.tools.push(...x.chosen);
    if (x.kind === 'language') out.languages.push(...x.chosen);
  }
  return out;
}

/* ---------- Skills a elección (se muestran en Proficiencies) ---------- */

export interface FeatureSkillSlot {
  source: string;
  label: string;
  count: number;
  from: string[];
  mode: 'prof' | 'expertise' | 'either';
}

const SKILL_IDS = SKILLS.map((s) => s.id);
const ids = (names: string[]) => names.map((n) => slug(n));
const modeLabel = { prof: 'proficiency', expertise: 'expertise', either: 'proficiency / expertise' } as const;

export function featureSkillSlots(c: Character, packs: Pack[]): FeatureSkillSlot[] {
  const out: FeatureSkillSlot[] = [];
  for (const o of ownedFeatures(c, packs)) {
    o.feature.grants?.skillChoices.forEach((g, i) => {
      const count = evalAmount(String(g.count), c, o.entry.level);
      if (count <= 0) return;
      const source = featureSource(g.mode, o.entry.id, o.feature.level, o.subId, o.feature.id, i);
      let from = ids(g.from);
      // Expertise sin lista: entre las skills donde ya eres proficient por otra fuente.
      if (g.mode === 'expertise' && !from.length)
        from = SKILL_IDS.filter((id) => c.skills[id] || skillSources(c, id).some((x) => x !== source));
      out.push({ source, label: `${o.feature.name} (${modeLabel[g.mode]})`, count, from, mode: g.mode });
    });
  }
  return out;
}

/* ---------- Sincronizar lo fijo en el personaje ---------- */

const FIXED = /^ftr[px]:.*\|f[px]?$/;

/*
 * Escribe en el personaje lo que los features dan sin elegir: skills fijas (en skillPicks) y saves (autoSaves).
 * Devuelve null si no hay cambios, para no disparar guardados de más.
 */
export function syncGrants(c: Character, packs: Pack[]): { skillPicks: Character['skillPicks']; autoSaves: Ability[] } | null {
  if (!packs.length) return null;
  const picks: Character['skillPicks'] = {};
  for (const [k, v] of Object.entries(c.skillPicks)) if (!FIXED.test(k)) picks[k] = v;
  const saves = new Set<Ability>();
  for (const { o, id, grants: g } of grantUnits(c, packs)) {
    if (g.skills.length) picks[featureSource('prof', o.entry.id, o.feature.level, o.subId, id, 'fp')] = ids(g.skills);
    if (g.expertise.length) picks[featureSource('expertise', o.entry.id, o.feature.level, o.subId, id, 'fx')] = ids(g.expertise);
    g.saves.forEach((a) => saves.add(a));
  }
  for (const x of extraChoices(c, packs)) if (x.kind === 'save') x.chosen.forEach((a) => saves.add(a as Ability));
  // Quita elecciones de skills de features que ya no tienes (bajaste de nivel o cambiaste de subclass).
  const live = new Set(featureSkillSlots(c, packs).map((s) => s.source));
  for (const k of Object.keys(picks)) if (/^ftr[pxe]:/.test(k) && !FIXED.test(k) && !live.has(k)) delete picks[k];
  const autoSaves = ABILITIES.filter((a) => saves.has(a));
  const canon = (o: Record<string, string[]>) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  const same = canon(picks) === canon(c.skillPicks) && JSON.stringify(autoSaves) === JSON.stringify(c.autoSaves);
  return same ? null : { skillPicks: picks, autoSaves };
}
