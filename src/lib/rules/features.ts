import { CLASS_PRESETS, uid, type Ability, type Character, type ClassEntry, type ClassPreset, type Effect, type ItemEntry } from '../model/character';
import { sameName, slug, type Feature, type Pack, type PackBackground, type PackClass, type PackFeat, type PackItem, type PackSpecies, type PackSubclass } from '../model/pack';

import { asiSlots, featSource, skillSources } from './derive';
import { SKILLS } from './tables';
import { t as tr } from '../i18n.svelte';
import { featureProficiencies, featureSkillSlots } from './grants';

const SKILL_IDS = SKILLS.map((s) => s.id);

/* Consultas puras sobre los packs importados. */

export interface SubclassOption {
  value: string; // "packId:subclassId"
  sub: PackSubclass;
  pack: Pack;
}

const byRuleset = (ruleset: string) => (a: Pack, b: Pack) =>
  Number(b.pack.ruleset === ruleset) - Number(a.pack.ruleset === ruleset);

/* Clase del pack que corresponde a la clase del personaje. Prefiere el mismo ruleset. */
export function findClass(packs: Pack[], name: string, ruleset: string): { cls: PackClass; pack: Pack } | null {
  for (const pack of [...packs].sort(byRuleset(ruleset))) {
    const cls = pack.classes.find((c) => sameName(c.name, name));
    if (cls) return { cls, pack };
  }
  return null;
}

/* Subclases disponibles para una clase: primero las del ruleset del personaje. */
export function subclassOptions(packs: Pack[], className: string, ruleset: string): SubclassOption[] {
  return [...packs]
    .sort(byRuleset(ruleset))
    .flatMap((pack) =>
      pack.subclasses
        .filter((s) => sameName(s.class, className))
        .map((sub) => ({ value: `${pack.pack.id}:${sub.id}`, sub, pack }))
    );
}

export function findSubclass(packs: Pack[], value: string | null): { sub: PackSubclass; pack: Pack } | null {
  if (!value) return null;
  const i = value.indexOf(':');
  const pack = packs.find((p) => p.pack.id === value.slice(0, i));
  const sub = pack?.subclasses.find((s) => s.id === value.slice(i + 1));
  return pack && sub ? { sub, pack } : null;
}

export interface OwnedFeature {
  feature: Feature;
  source: 'class' | 'subclass';
  sourceName: string;
  owned: boolean;
}

export interface ClassFeatures {
  entry: ClassEntry;
  cls: PackClass | null;
  sub: PackSubclass | null;
  subclassLabel: string;
  subclassLevel: number;
  features: OwnedFeature[];
}

export function characterFeatures(c: Character, packs: Pack[]): ClassFeatures[] {
  return c.classes.map((entry) => {
    const cls = findClass(packs, entry.name, c.ruleset)?.cls ?? null;
    const sub = findSubclass(packs, entry.subclassId)?.sub ?? null;
    const features: OwnedFeature[] = [
      ...(cls?.features ?? []).map((f) => ({ feature: f, source: 'class' as const, sourceName: cls!.name, owned: f.level <= entry.level })),
      ...(sub?.features ?? []).map((f) => ({ feature: f, source: 'subclass' as const, sourceName: sub!.name, owned: f.level <= entry.level }))
    ].sort((a, b) => a.feature.level - b.feature.level || Number(a.source === 'subclass') - Number(b.source === 'subclass'));
    return {
      entry,
      cls,
      sub,
      subclassLabel: cls?.subclassLabel ?? 'Subclass',
      subclassLevel: cls?.subclassLevel ?? 3,
      features
    };
  });
}

/* Efectos de los features que ya tienes. Los condicionales leen su estado de c.toggles. */
export function grantedEffects(c: Character, packs: Pack[]): Effect[] {
  const out: Effect[] = [];
  for (const group of characterFeatures(c, packs)) {
    for (const own of group.features) {
      if (!own.owned) continue;
      own.feature.effects.forEach((e, i) => {
        const id = `${own.feature.id}#${i}`;
        out.push({
          id,
          source: own.feature.name,
          sourceType: own.source,
          target: e.target,
          value: e.value,
          conditional: e.conditional,
          active: e.conditional ? (c.toggles[id] ?? false) : true
        });
      });
    }
  }
  return out;
}

/* Clases para elegir: los presets de la app mas las clases de tus packs (homebrew incluido). */
export function classChoices(packs: Pack[], ruleset: string): ClassPreset[] {
  const map = new Map<string, ClassPreset>();
  for (const p of CLASS_PRESETS) map.set(p.name.toLowerCase(), p);
  for (const pack of [...packs].sort(byRuleset(ruleset)).reverse()) {
    for (const k of pack.classes) {
      map.set(k.name.toLowerCase(), {
        name: k.name,
        hitDie: k.hitDie,
        caster: k.caster,
        spellAbility: k.spellAbility,
        saves: k.saves
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------- Compendium: raza, background, feats, invocations, items ---------- */

export interface Ref<T> {
  value: string; // "packId:id"
  item: T;
  pack: Pack;
}

function listOf<T extends { id: string }>(packs: Pack[], ruleset: string, pick: (p: Pack) => T[]): Ref<T>[] {
  return [...packs]
    .sort(byRuleset(ruleset))
    .flatMap((pack) => pick(pack).map((item) => ({ value: `${pack.pack.id}:${item.id}`, item, pack })));
}

export const speciesList = (packs: Pack[], r: string) => listOf(packs, r, (p) => p.species);
export const backgroundList = (packs: Pack[], r: string) => listOf(packs, r, (p) => p.backgrounds);
export const featList = (packs: Pack[], r: string) => listOf(packs, r, (p) => p.feats);
export const invocationList = (packs: Pack[], r: string) => listOf(packs, r, (p) => p.invocations);
export const itemList = (packs: Pack[], r: string) => listOf(packs, r, (p) => p.items);

export function findRef<T extends { id: string }>(packs: Pack[], value: string | null, pick: (p: Pack) => T[]): Ref<T> | null {
  if (!value) return null;
  const i = value.indexOf(':');
  const pack = packs.find((p) => p.pack.id === value.slice(0, i));
  const item = pack ? pick(pack).find((x) => x.id === value.slice(i + 1)) : undefined;
  return pack && item ? { value, item, pack } : null;
}

export const findSpecies = (packs: Pack[], v: string | null) => findRef(packs, v, (p) => p.species);
export const findBackground = (packs: Pack[], v: string | null) => findRef(packs, v, (p) => p.backgrounds);
export const findFeat = (packs: Pack[], v: string | null) => findRef(packs, v, (p) => p.feats);
export const findInvocation = (packs: Pack[], v: string | null) => findRef(packs, v, (p) => p.invocations);

/* Busca un feat por nombre (para el origin feat que nombra un background 2024). */
export function featByName(packs: Pack[], name: string, ruleset: string): Ref<PackFeat> | null {
  const base = name.replace(/\s*\(.*\)$/, '');
  return featList(packs, ruleset).find((f) => sameName(f.item.name, name) || sameName(f.item.name, base)) ?? null;
}

/* ---------- Proficiencies ---------- */

export interface Proficiencies {
  armor: string[];
  weapons: string[];
  tools: string[];
  languages: string[];
}

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

export function proficiencies(c: Character, packs: Pack[]): Proficiencies {
  const out: Proficiencies = { armor: [], weapons: [], tools: [], languages: [] };
  c.classes.forEach((k, i) => {
    const cls = findClass(packs, k.name, c.ruleset)?.cls;
    if (!cls) return;
    const set = i === 0 ? cls.proficiencies : cls.multiclass;
    out.armor.push(...set.armor);
    out.weapons.push(...set.weapons);
    out.tools.push(...set.tools);
  });
  const sp = findSpecies(packs, c.species.ref)?.item;
  if (sp) {
    out.armor.push(...sp.proficiencies.armor);
    out.weapons.push(...sp.proficiencies.weapons);
    out.tools.push(...sp.proficiencies.tools);
    out.languages.push(...sp.languages);
  }
  const bg = findBackground(packs, c.background.ref)?.item;
  if (bg) {
    out.tools.push(...bg.tools);
    out.languages.push(...bg.languages);
  }
  const fp = featureProficiencies(c, packs);
  out.armor.push(...fp.armor);
  out.weapons.push(...fp.weapons);
  out.tools.push(...fp.tools);
  out.languages.push(...fp.languages);
  const x = c.extraProficiencies;
  return {
    armor: uniq([...out.armor, ...x.armor]),
    weapons: uniq([...out.weapons, ...x.weapons]),
    tools: uniq([...out.tools, ...x.tools]),
    languages: uniq([...out.languages, ...x.languages])
  };
}

/* Feats que tiene el personaje: de niveles de ASI alcanzados y de otras fuentes. */
export interface FeatInstance {
  owner: string; // clave del nivel de ASI o id de la entrada de feat
  ref: string | null;
  feat: Ref<PackFeat> | null;
  ability: Ability | null; // ability que subió el feat, si aplica
  name: string;
}
export function featInstances(c: Character, packs: Pack[]): FeatInstance[] {
  const reached = new Set(asiSlots(c, packAsiLevels(packs, c.ruleset)).map((s) => s.key));
  // Si la referencia no existe (feat escrito a mano, pack reemplazado o de otra versión), se busca por nombre.
  const resolve = (ref: string | null, name: string) => findFeat(packs, ref) ?? (name ? featByName(packs, name, c.ruleset) : null);
  return [
    ...Object.entries(c.advancements)
      .filter(([k, a]) => a.kind === 'feat' && reached.has(k))
      .map(([k, a]) => ({ owner: k, ref: a.featRef, feat: resolve(a.featRef, a.featName), ability: a.featAbility, name: a.featName })),
    ...c.feats.map((f) => ({ owner: f.id, ref: f.ref, feat: resolve(f.ref, f.name), ability: f.ability, name: f.name }))
  ];
}

/* Skill choices pendientes por fuente: { source, label, count, from } */
export interface SkillChoiceSlot {
  source: string;
  label: string;
  count: number;
  from: string[]; // ids de skill; vacio = cualquiera
  mode?: 'prof' | 'expertise' | 'either';
}

export function skillChoiceSlots(c: Character, packs: Pack[]): SkillChoiceSlot[] {
  const out: SkillChoiceSlot[] = [];
  const ids = (names: string[]) => names.map((n) => slug(n));
  const first = c.classes[0];
  const cls = first ? findClass(packs, first.name, c.ruleset)?.cls : null;
  if (cls?.proficiencies.skills) out.push({ source: 'class', label: `${cls.name}`, count: cls.proficiencies.skills.count, from: ids(cls.proficiencies.skills.from) });
  c.classes.slice(1).forEach((k) => {
    const mc = findClass(packs, k.name, c.ruleset)?.cls?.multiclass.skills;
    if (mc) out.push({ source: `mc:${k.id}`, label: `${k.name} (multiclass)`, count: mc.count, from: ids(mc.from) });
  });
  const sp = findSpecies(packs, c.species.ref)?.item;
  if (sp?.skillChoices) out.push({ source: 'species-choice', label: sp.name, count: sp.skillChoices.count, from: ids(sp.skillChoices.from) });
  const bg = findBackground(packs, c.background.ref)?.item;
  if (bg?.skillChoices) out.push({ source: 'background-choice', label: bg.name, count: bg.skillChoices.count, from: ids(bg.skillChoices.from) });
  // Feats con skills a elección (Skilled, Skill Expert, Observant 2024, Keen Mind 2024...).
  const modeLabel = { prof: 'proficiency', expertise: 'expertise', either: tr('proficiency o expertise') };
  for (const { owner, ref } of featInstances(c, packs)) {
    const f = findFeat(packs, ref);
    f?.item.skills.forEach((g, i) => {
      const source = featSource(g.mode, owner, ref ?? '', i);
      let from = ids(g.from);
      // Expertise pura: solo entre las skills donde ya eres proficient.
      if (g.mode === 'expertise' && !from.length)
        from = SKILL_IDS.filter((id) => c.skills[id] || skillSources(c, id).some((x) => x !== source));
      out.push({ source, label: `${f.item.name} (${modeLabel[g.mode]})`, count: g.count, from, mode: g.mode });
    });
  }
  // Class features con skills a elección (Rogue Expertise, Bonus Proficiency, Blessings of Knowledge...).
  out.push(...featureSkillSlots(c, packs));
  return out;
}

/* Niveles de ASI segun el pack (features llamados Ability Score Improvement o Epic Boon). */
export function packAsiLevels(packs: Pack[], ruleset: string) {
  return (k: ClassEntry): number[] | null => {
    const cls = findClass(packs, k.name, ruleset)?.cls;
    if (!cls) return null;
    const lv = cls.features.filter((f) => /^(ability score improvement|epic boon)/i.test(f.name)).map((f) => f.level);
    return lv.length ? [...new Set(lv)].sort((a, b) => a - b) : null;
  };
}

/* ---------- Aplicar selecciones (devuelven el personaje modificado) ---------- */

export function applySpecies(c: Character, ref: Ref<PackSpecies> | null): Character {
  const n = structuredClone(c);
  n.species.ref = ref?.value ?? null;
  // Quita lo que otorgaba la raza anterior.
  delete n.skillPicks.species;
  delete n.skillPicks['species-choice'];
  n.bonuses.species = [];
  n.feats = n.feats.filter((f) => f.source !== 'species');
  if (!ref) return n;
  const sp = ref.item;
  n.species.name = sp.name;
  n.species.speed = sp.speed;
  n.species.size = sp.size;
  n.species.darkvision = sp.darkvision;
  n.bonuses.species = Object.entries(sp.asi.fixed).map(([ability, amount]) => ({ ability: ability as Ability, amount: amount! }));
  // Incrementos a eleccion (Half-Elf, Variant Human, razas de Monsters of the Multiverse): valores por defecto editables.
  const used = new Set(n.bonuses.species.map((b) => b.ability));
  for (const ch of sp.asi.choose) {
    for (let i = 0; i < ch.count; i++) {
      const ability = ch.from.find((a) => !used.has(a)) ?? ch.from[0];
      used.add(ability);
      n.bonuses.species.push({ ability, amount: ch.amount });
    }
  }
  if (sp.skills.length) n.skillPicks.species = sp.skills.map((x) => slug(x));
  if (sp.originFeat) n.feats.push({ id: uid(), ref: null, name: '', source: 'species', ability: null });
  return n;
}

export function applyBackground(c: Character, ref: Ref<PackBackground> | null, packs: Pack[]): Character {
  const n = structuredClone(c);
  n.background.ref = ref?.value ?? null;
  delete n.skillPicks.background;
  delete n.skillPicks['background-choice'];
  n.bonuses.background = [];
  n.feats = n.feats.filter((f) => f.source !== 'background');
  if (!ref) return n;
  const bg = ref.item;
  n.background.name = bg.name;
  if (bg.skills.length) n.skillPicks.background = bg.skills.map((x) => slug(x));
  // 2024: por defecto +2 a la primera y +1 a la segunda; se cambia en Editar.
  if (bg.asi.length >= 2) n.bonuses.background = [{ ability: bg.asi[0], amount: 2 }, { ability: bg.asi[1], amount: 1 }];
  if (bg.feat) {
    const f = featByName(packs, bg.feat, n.ruleset);
    n.feats.push({ id: uid(), ref: f?.value ?? null, name: f?.item.name ?? bg.feat, source: 'background', ability: null });
  }
  return n;
}

/* Efectos de raza, feats e invocations (por ahora speed). Se suman a los de class features. */
export function otherGrantedEffects(c: Character, packs: Pack[]): Effect[] {
  const out: Effect[] = [];
  const push = (prefix: string, source: string, type: Effect['sourceType'], effects: { target: Effect['target']; value: number; conditional: boolean }[]) =>
    effects.forEach((e, i) => {
      const id = `${prefix}#${i}`;
      out.push({ id, source, sourceType: type, target: e.target, value: e.value, conditional: e.conditional, active: e.conditional ? (c.toggles[id] ?? false) : true });
    });
  const sp = findSpecies(packs, c.species.ref);
  sp?.item.traits.forEach((t, i) => push(`${sp.value}/t${i}`, t.name, 'species', t.effects));
  for (const { feat: f } of featInstances(c, packs)) {
    if (f) push(f.value, f.item.name, 'feat', f.item.effects);
  }
  for (const inv of c.invocations) {
    const f = findInvocation(packs, inv.ref);
    if (f) push(f.value, f.item.name, 'other', f.item.effects);
  }
  return out;
}

export const allGrantedEffects = (c: Character, packs: Pack[]) => [...grantedEffects(c, packs), ...otherGrantedEffects(c, packs)];

/* Convierte un item del pack en entrada de inventario (copia los datos). */
export function itemEntryFrom(ref: Ref<PackItem>): ItemEntry {
  const it = ref.item;
  return {
    id: uid(),
    ref: ref.value,
    name: it.name,
    kind: it.kind,
    qty: 1,
    equipped: false,
    attuned: false,
    bonus: 0,
    attackAbility: null,
    weight: it.weight,
    notes: it.text,
    weapon: it.weapon ? { ...it.weapon } : null,
    armor: it.armor ? { ...it.armor } : null
  };
}
