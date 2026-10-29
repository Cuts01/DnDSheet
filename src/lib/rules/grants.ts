import { ABILITIES, type Ability, type Character, type ClassEntry } from '../model/character';
import { slug, type Feature, type FeatureGrants, type Pack, type PackEffect, type PackFeat, type PackOption } from '../model/pack';
import { abilityMod, featureSource, pb, score, skillLevel, skillSources, upgradeSources, type SkillMode } from './derive';
import { allGrantedEffects, featInstances, findClass, findSpecies, findSubclass, featList, proficiencies, racialFeatAllowed } from './features';
import { featSpells } from './spells';
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
  // Recursos de feats (Lucky, Martial Adept, Metamagic Adept...). Cada instancia del feat tiene los suyos.
  const total = c.classes.reduce((s, k) => s + k.level, 0);
  // Rasgos de raza (Healing Hands, Breath Weapon, Relentless Endurance...).
  const sp = findSpecies(packs, c.species.ref);
  sp?.item.traits.forEach((tr, ti) => {
    tr.resources.forEach((r, i) => {
      const recharge = (tableValue(r.recharge, total) ?? 'long') as Recharge;
      const max = evalAmount(r.uses, c, total);
      if (max <= 0) return;
      const key = `${PREFIX[recharge] ?? 'L'}:sp:${sp.value}#${ti}#${i}`;
      out.push({ key, name: r.name, max, used: Math.min(max, c.featureUsed[key] ?? 0), die: r.die ? (tableValue(r.die, total) ?? '') : '', recharge, featureId: `sp:${sp.value}#${ti}`, picks: [] });
    });
  });
  for (const fi of featInstances(c, packs)) {
    const f = fi.feat?.item;
    if (!f?.resources.length) continue;
    const fid = `feat:${fi.owner}`;
    f.resources.forEach((r, i) => {
      const recharge = (tableValue(r.recharge, total) ?? 'long') as Recharge;
      const max = evalAmount(r.uses, c, total);
      if (max <= 0) return;
      const key = `${PREFIX[recharge] ?? 'L'}:${fid}#${i}`;
      out.push({
        key,
        name: r.name,
        max,
        used: Math.min(max, c.featureUsed[key] ?? 0),
        die: r.die ? (tableValue(r.die, total) ?? '') : '',
        recharge,
        featureId: fid,
        picks: i === 0 ? (c.featureChoices[fid] ?? []) : []
      });
    });
  }
  return out;
}

/* Quien elige opciones: class features con "choose" y feats con "choose" (Martial Adept, Fighting Initiate...). */
interface Chooser {
  id: string; // clave en c.featureChoices
  name: string;
  choose: NonNullable<Feature['choose']>;
  level: number;
  owned?: OwnedClassFeature;
}
function choosers(c: Character, packs: Pack[]): Chooser[] {
  const out: Chooser[] = [];
  for (const o of ownedFeatures(c, packs))
    if (o.feature.choose) out.push({ id: o.feature.id, name: o.feature.name, choose: o.feature.choose, level: o.entry.level, owned: o });
  const total = c.classes.reduce((s, k) => s + k.level, 0);
  for (const fi of featInstances(c, packs)) {
    const f = fi.feat?.item;
    if (f?.choose) out.push({ id: `feat:${fi.owner}`, name: f.name, choose: f.choose, level: total });
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
  effects?: PackEffect[];
}

export function optionList(packs: Pack[], ruleset: string, list: string): { name: string; options: ChoiceOption[] } {
  const sorted = [...packs].sort((a, b) => Number(b.pack.ruleset === ruleset) - Number(a.pack.ruleset === ruleset));
  if (list.startsWith('feat:')) {
    const cat = list.slice(5).replace(/-/g, ' ').toLowerCase();
    const seen = new Set<string>();
    const options = featList(sorted, ruleset)
      .filter((f) => f.item.category.toLowerCase() === cat && f.pack.pack.ruleset === ruleset)
      .filter((f) => !seen.has(f.item.name) && seen.add(f.item.name))
      .map((f) => ({ name: f.item.name, text: f.item.text, prerequisite: '', minLevel: 1, grants: null, effects: f.item.effects }));
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
  for (const ch of choosers(c, packs)) {
    const count = evalAmount(ch.choose.count, c, ch.level);
    if (count <= 0) continue;
    const list = optionList(packs, c.ruleset, ch.choose.list);
    out.push({
      featureId: ch.id,
      featureName: ch.name,
      label: ch.choose.label || list.name,
      count,
      level: ch.level,
      options: list.options,
      chosen: c.featureChoices[ch.id] ?? []
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

/* Efectos de las opciones elegidas: de la lista del pack o de feats (Fighting Style 2024 se elige como feat). */
export function chosenOptionEffects(c: Character, packs: Pack[]) {
  const out: { id: string; name: string; effects: PackEffect[] }[] = [];
  for (const cs of choosers(c, packs)) {
    const ch = cs.choose;
    const o = { feature: { id: cs.id } };
    const chosen = c.featureChoices[cs.id] ?? [];
    if (!chosen.length) continue;
    if (ch.list.startsWith('feat:')) {
      for (const name of chosen) {
        const f = featList(packs, c.ruleset).find((x) => x.item.name === name && x.pack.pack.ruleset === c.ruleset) ?? featList(packs, c.ruleset).find((x) => x.item.name === name);
        if (f?.item.effects.length) out.push({ id: `${o.feature.id}~${f.item.id}`, name: f.item.name, effects: f.item.effects });
      }
      continue;
    }
    for (const opt of optionList(packs, c.ruleset, ch.list).options) {
      const effects = (opt as ChoiceOption & { effects?: PackEffect[] }).effects ?? [];
      if (effects.length && chosen.includes(opt.name)) out.push({ id: `${o.feature.id}~${slug(opt.name)}`, name: opt.name, effects });
    }
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
  mode: SkillMode;
}

const SKILL_IDS = SKILLS.map((s) => s.id);
const ids = (names: string[]) => names.map((n) => slug(n));
const modeLabel = { prof: 'proficiency', expertise: 'expertise', either: 'proficiency / expertise', upgrade: 'expertise' } as const;

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
      // Upgrade: solo skills donde ya eres proficient y que no tienen expertise por otra vía (las ya elegidas se mantienen).
      if (g.mode === 'upgrade') {
        const mine = c.skillPicks[source] ?? [];
        const proficient = (id: string) => c.skills[id] === 'prof' || skillSources(c, id).length > 0;
        const expertElsewhere = (id: string) => {
          const s = SKILLS.find((x) => x.id === id)!;
          const others = upgradeSources(c, id).filter((x) => x !== source);
          return others.length > 0 || c.skills[id] === 'expertise' || (skillLevel({ ...c, skillPicks: { ...c.skillPicks, [source]: [] } }, s) === 'expertise' && !mine.includes(id));
        };
        const base = from.length ? from : SKILL_IDS;
        from = base.filter((id) => mine.includes(id) || (proficient(id) && !expertElsewhere(id)));
        // Tools elegibles en el mismo slot, si eres proficient y no los elegiste en otro.
        if (g.tools.length) {
          const owned = proficiencies(c, packs).tools.map((x) => slug(x));
          const elsewhere = Object.entries(c.skillPicks).filter(([k]) => k !== source && /^ftru:|^featu:/.test(k)).flatMap(([, v]) => v);
          for (const tname of g.tools) {
            const id = `tool:${slug(tname)}`;
            if (mine.includes(id) || (owned.includes(slug(tname)) && !elsewhere.includes(id))) from.push(id);
          }
        }
      }
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
export function syncGrants(
  c: Character,
  packs: Pack[]
): { skillPicks: Character['skillPicks']; autoSaves: Ability[]; hpBonus: number; scoreBonus: Character['scoreBonus'] } | null {
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
  // Feats: saves fijos y Resilient (el save de la ability que sube).
  for (const fi of featInstances(c, packs)) {
    fi.feat?.item.grants?.saves.forEach((a) => saves.add(a));
    if (fi.feat?.item.saveFromAsi && fi.ability) saves.add(fi.ability);
  }
  const granted = allGrantedEffects(c, packs);
  const hpBonus = Math.max(0, granted.reduce((s, e) => s + (e.target === 'hp' && (!e.conditional || e.active) ? e.value : 0), 0));
  const scoreBonus: Character['scoreBonus'] = granted
    .filter((e) => e.target.startsWith('score-') && (!e.conditional || e.active))
    .map((e) => ({ ability: e.target.slice(6) as Ability, amount: e.value, max: e.max ?? 20 }));
  // Quita elecciones de skills de features que ya no tienes (bajaste de nivel o cambiaste de subclass).
  const live = new Set(featureSkillSlots(c, packs).map((s) => s.source));
  for (const k of Object.keys(picks)) {
    if (!/^ftr[pxeu]:/.test(k) || FIXED.test(k) || live.has(k)) continue;
    // Elecciones guardadas antes de que existiera el modo upgrade: se pasan a la nueva clave.
    const moved = k.replace(/^ftr[pxe]:/, 'ftru:');
    if (live.has(moved) && !picks[moved]) picks[moved] = picks[k];
    delete picks[k];
  }
  const autoSaves = ABILITIES.filter((a) => saves.has(a));
  const canon = (o: Record<string, string[]>) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  const same =
    canon(picks) === canon(c.skillPicks) &&
    JSON.stringify(autoSaves) === JSON.stringify(c.autoSaves) &&
    hpBonus === c.hpBonus &&
    JSON.stringify(scoreBonus) === JSON.stringify(c.scoreBonus ?? []);
  return same ? null : { skillPicks: picks, autoSaves, hpBonus, scoreBonus };
}

/* Resistencias a daño de raza, class features, feats y opciones elegidas. */
export function resistances(c: Character, packs: Pack[]): string[] {
  const out = new Set<string>();
  const add = (g: FeatureGrants | null | undefined) => g?.resistances.forEach((x) => out.add(x.toLowerCase()));
  findSpecies(packs, c.species.ref)?.item.traits.forEach((tr) => add(tr.grants));
  for (const u of grantUnits(c, packs)) add(u.grants);
  for (const fi of featInstances(c, packs)) add(fi.feat?.item.grants);
  return [...out].sort();
}

/* ---------- Requisitos de feats ---------- */

const ABILITY_NAMES: Record<string, Ability> = {
  strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha'
};

/*
 * Revisa el prerequisite de un feat contra el personaje. Devuelve las partes que no cumple (vacío = cumple).
 * Entiende nivel, abilities mínimas, spellcasting, proficiencies de armor y armas, Fighting Style, background,
 * feats previos y raza. Lo que no reconoce (ej. "No other dragonmark") no bloquea.
 */
export function featPrereqFails(c: Character, feat: PackFeat, packs: Pack[]): string[] {
  const fails: string[] = [];
  const text = feat.prerequisite.trim();
  const level = c.classes.reduce((s, k) => s + k.level, 0);
  if (feat.minLevel > level) fails.push(`Level ${feat.minLevel}+`);
  if (!text) return fails;
  const low = text.toLowerCase();
  // Nivel escrito en el texto: "Level 4+" o "4th level".
  const lv = /level (\d+)\+|(\d+)(?:st|nd|rd|th) level/.exec(low);
  if (lv && Number(lv[1] ?? lv[2]) > level && !fails.length) fails.push(`Level ${lv[1] ?? lv[2]}+`);
  // Abilities: "Intelligence, Wisdom or Charisma 13+" (basta una).
  const ab = /((?:strength|dexterity|constitution|intelligence|wisdom|charisma)(?:(?:,\s*|\s+or\s+)(?:strength|dexterity|constitution|intelligence|wisdom|charisma))*)\s+(\d+)/.exec(low);
  if (ab) {
    const need = Number(ab[2]);
    const list = ab[1].split(/,\s*|\s+or\s+/).map((x) => ABILITY_NAMES[x.trim()]).filter(Boolean);
    if (!list.some((a) => score(c, a) >= need)) fails.push(ab[0].replace(/\b\w/g, (m) => m.toUpperCase()));
  }
  const caster = c.classes.some((k) => k.caster !== 'none');
  if (/spellcasting|pact magic/.test(low) && !caster) fails.push('Spellcasting / Pact Magic');
  if (/ability to cast at least one spell/.test(low)) {
    const canCast = caster || c.spells.length > 0 || featSpells(c, packs).granted.length > 0;
    if (!canCast) fails.push('Cast at least one spell');
  }
  const profs = proficiencies(c, packs);
  const armor = profs.armor.map((x) => x.toLowerCase());
  for (const kind of ['light', 'medium', 'heavy'])
    if (new RegExp(`${kind} armor (training)?|proficiency with ${kind} armor`).test(low) && !armor.some((x) => x.startsWith(kind))) fails.push(`${kind[0].toUpperCase()}${kind.slice(1)} armor`);
  if (/shield training/.test(low) && !armor.some((x) => x.startsWith('shield'))) fails.push('Shields');
  if (/martial weapon/.test(low) && !profs.weapons.some((x) => /martial/i.test(x))) fails.push('Martial weapon');
  if (/fighting style feature/.test(low) && !ownedFeatures(c, packs).some((o) => /fighting style/i.test(o.feature.name))) fails.push('Fighting Style');
  const bg = /^(.+?) background$/i.exec(text);
  if (bg && !c.background.name.toLowerCase().includes(bg[1].toLowerCase())) fails.push(text);
  const prev = /strike of the giants/i.test(low) && !featInstances(c, packs).some((f) => /strike of the giants/i.test(f.name) && f.feat?.item.name !== feat.name);
  if (prev) fails.push('Strike of the Giants');
  if (feat.category.toLowerCase() === 'racial' && !racialFeatAllowed(feat, c)) fails.push(text);
  return fails;
}
