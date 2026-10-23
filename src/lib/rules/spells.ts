import { uid, type Ability, type Character, type ClassEntry, type SpellEntry } from '../model/character';
import type { Pack, PackFeat, PackSpell } from '../model/pack';
import { abilityMod, pactSlots, pb, slotMax, spellcasting, type CastingLine } from './derive';
import { featInstances, findRef, findSubclass, type Ref } from './features';
import { t as tr } from '../i18n.svelte';

/* Mecánicas genéricas de spellcasting: cuántos cantrips y spells corresponden por nivel de clase. */

type Table = number[]; // índice = nivel de clase - 1
const steps = (pairs: [number, number][]): Table =>
  Array.from({ length: 20 }, (_, i) => {
    let v = 0;
    for (const [lvl, n] of pairs) if (i + 1 >= lvl) v = n;
    return v;
  });

const CANTRIPS: Record<'2014' | '2024', Record<string, Table>> = {
  '2014': {
    artificer: steps([[1, 2], [10, 3], [14, 4]]),
    bard: steps([[1, 2], [4, 3], [10, 4]]),
    cleric: steps([[1, 3], [4, 4], [10, 5]]),
    druid: steps([[1, 2], [4, 3], [10, 4]]),
    sorcerer: steps([[1, 4], [4, 5], [10, 6]]),
    warlock: steps([[1, 2], [4, 3], [10, 4]]),
    wizard: steps([[1, 3], [4, 4], [10, 5]])
  },
  '2024': {
    artificer: steps([[1, 2], [10, 3], [14, 4]]),
    bard: steps([[1, 2], [4, 3], [10, 4]]),
    cleric: steps([[1, 3], [4, 4], [10, 5]]),
    druid: steps([[1, 2], [4, 3], [10, 4]]),
    sorcerer: steps([[1, 4], [4, 5], [10, 6]]),
    warlock: steps([[1, 2], [4, 3], [10, 4]]),
    wizard: steps([[1, 3], [4, 4], [10, 5]])
  }
};

/* 2014: clases que conocen un número fijo de spells. */
const KNOWN_2014: Record<string, Table> = {
  bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11]
};

/* 2024: todas las clases usan una tabla de Prepared Spells. */
const FULL_24 = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const HALF_24 = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
const PREPARED_2024: Record<string, Table> = {
  artificer: HALF_24,
  bard: FULL_24,
  cleric: FULL_24,
  druid: FULL_24,
  paladin: HALF_24,
  ranger: HALF_24,
  sorcerer: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  wizard: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25]
};

const key = (k: ClassEntry) => k.name.trim().toLowerCase();

export interface SpellLimits {
  cantrips: number | null; // null = la clase no tiene tabla de cantrips
  spells: number | null; // null = sin límite conocido (clase homebrew o sin tabla)
  kind: 'known' | 'prepared';
}

export function spellLimits(c: Character, k: ClassEntry): SpellLimits {
  const name = key(k);
  const i = Math.min(20, Math.max(1, k.level)) - 1;
  const cantrips = CANTRIPS[c.ruleset][name]?.[i] ?? null;
  if (c.ruleset === '2024') return { cantrips, spells: PREPARED_2024[name]?.[i] ?? null, kind: 'prepared' };
  if (KNOWN_2014[name]) return { cantrips, spells: KNOWN_2014[name][i], kind: 'known' };
  const mod = k.spellAbility ? abilityMod(c, k.spellAbility) : 0;
  if (['cleric', 'druid', 'wizard'].includes(name)) return { cantrips, spells: Math.max(1, mod + k.level), kind: 'prepared' };
  if (name === 'paladin') return { cantrips, spells: k.level < 2 ? 0 : Math.max(1, mod + Math.floor(k.level / 2)), kind: 'prepared' };
  if (name === 'artificer') return { cantrips, spells: Math.max(1, mod + Math.floor(k.level / 2)), kind: 'prepared' };
  return { cantrips, spells: null, kind: 'known' };
}

/* Nivel máximo de spell que puede aprender esta clase sola (para filtrar su lista). */
export function maxSpellLevel(c: Character, k: ClassEntry): number {
  const L = k.level;
  switch (k.caster) {
    case 'full':
      return Math.min(9, Math.ceil(L / 2));
    case 'half':
      if (c.ruleset === '2014' && L < 2) return 0;
      return L >= 17 ? 5 : L >= 13 ? 4 : L >= 9 ? 3 : L >= 5 ? 2 : 1;
    case 'artificer':
      return L >= 17 ? 5 : L >= 13 ? 4 : L >= 9 ? 3 : L >= 5 ? 2 : 1;
    case 'third':
      return L >= 19 ? 4 : L >= 13 ? 3 : L >= 7 ? 2 : L >= 3 ? 1 : 0;
    case 'pact':
      // Mystic Arcanum desde nivel 11.
      return L >= 17 ? 9 : L >= 15 ? 8 : L >= 13 ? 7 : L >= 11 ? 6 : Math.min(5, Math.ceil(L / 2));
    default:
      return 0;
  }
}

/* Spells de los packs: primero los del ruleset del personaje. `all` incluye los de otro ruleset. */
export const spellList = (packs: Pack[], ruleset: string, all = false): Ref<PackSpell>[] =>
  [...packs]
    .filter((p) => all || p.pack.ruleset === ruleset || p.pack.homebrew)
    .sort((a, b) => Number(b.pack.ruleset === ruleset) - Number(a.pack.ruleset === ruleset))
    .flatMap((p) => p.spells.map((s) => ({ pack: p, item: s, value: `${p.pack.id}:${s.id}` })));

export const findSpell = (packs: Pack[], v: string | null) => findRef(packs, v, (p) => p.spells);

export const inClassList = (s: PackSpell, className: string) =>
  s.classes.some((x) => x.trim().toLowerCase() === className.trim().toLowerCase());

export function spellEntryFrom(ref: Ref<PackSpell>, classId: string | null): SpellEntry {
  return { id: uid(), ref: ref.value, name: ref.item.name, level: ref.item.level, classId, prepared: false, always: false, notes: '' };
}

/* Clase con la que se lanza cada spell: la elegida o la primera con spellcasting. */
export function castingFor(c: Character, s: SpellEntry): CastingLine | null {
  const lines = spellcasting(c);
  return lines.find((l) => l.classId === s.classId) ?? lines[0] ?? null;
}

/* Conteo para el límite: cantrips aparte; las "always" no cuentan. En clases que preparan solo cuentan las preparadas. */
export function spellUsage(c: Character, k: ClassEntry, granted: Set<string> = new Set()) {
  const first = c.classes.find((x) => x.caster !== 'none')?.id ?? null;
  const mine = c.spells.filter((s) => (s.classId ?? first) === k.id && !s.always && !granted.has(spellKey(s.name)));
  const lim = spellLimits(c, k);
  return {
    cantrips: mine.filter((s) => s.level === 0).length,
    spells: mine.filter((s) => s.level > 0 && (lim.kind === 'known' || s.prepared)).length
  };
}

/* ¿La spell está lista para lanzarse? Cantrips, always, conocidas (known) o preparadas. */
export function isReady(c: Character, s: SpellEntry): boolean {
  if (s.level === 0 || s.always || s.prepared) return true;
  const k = c.classes.find((x) => x.id === s.classId) ?? c.classes.find((x) => x.caster !== 'none');
  return k ? spellLimits(c, k).kind === 'known' : true;
}

export interface SlotOption {
  kind: 'slot' | 'pact';
  level: number;
  left: number;
}

/* Slots disponibles para lanzar una spell de este nivel (el mismo o mayor). */
export function slotOptions(c: Character, spellLevel: number): SlotOption[] {
  const out: SlotOption[] = [];
  const max = slotMax(c);
  for (let l = Math.max(1, spellLevel); l <= 9; l++) {
    const left = max[l - 1] - c.slotsUsed.levels[l - 1];
    if (max[l - 1] > 0) out.push({ kind: 'slot', level: l, left });
  }
  const pact = pactSlots(c);
  if (pact.count > 0 && pact.slotLevel >= spellLevel)
    out.push({ kind: 'pact', level: pact.slotLevel, left: pact.count - c.slotsUsed.pact });
  return out;
}

/* Gasta el slot y marca concentration si corresponde. Devuelve el personaje nuevo. */
export function castSpell(c: Character, opt: SlotOption | null, concentration: string | null): Character {
  const n = structuredClone(c);
  if (opt?.kind === 'slot' && opt.left > 0) n.slotsUsed.levels[opt.level - 1]++;
  if (opt?.kind === 'pact' && opt.left > 0) n.slotsUsed.pact++;
  if (concentration) n.concentration = concentration;
  return n;
}

/* ---------- Spells de subclass (Domain, Oath, Circle, Patron) ---------- */

export const spellKey = (name: string) => name.toLowerCase().replace('power word:', 'power word').replace(/[^a-z0-9]/g, '');

/* Índice nombre -> spell del pack, prefiriendo el ruleset del personaje. */
export function spellIndex(packs: Pack[], ruleset: string): Map<string, Ref<PackSpell>> {
  const map = new Map<string, Ref<PackSpell>>();
  for (const r of spellList(packs, ruleset, true)) {
    const k = spellKey(r.item.name);
    if (!map.has(k)) map.set(k, r);
  }
  return map;
}

export interface GrantedSpell {
  key: string;
  name: string;
  level: number;
  classId: string;
  source: string; // nombre de la subclass o del feat
  ref: Ref<PackSpell> | null;
  ability?: Ability; // feats: ability con la que se lanza
  uses?: 'none' | 'long' | 'short' | 'will'; // feats: lanzamiento gratis
  freeKey?: string; // clave en c.freeUsed
}

export interface SubclassSpellInfo {
  always: GrantedSpell[];
  expanded: Map<string, Set<string>>; // classId -> claves de spells que se suman a su lista
  variants: { classId: string; subclass: string; options: string[]; value: string }[];
}

export function subclassSpells(c: Character, packs: Pack[]): SubclassSpellInfo {
  const index = spellIndex(packs, c.ruleset);
  const out: SubclassSpellInfo = { always: [], expanded: new Map(), variants: [] };
  for (const k of c.classes) {
    const found = findSubclass(packs, k.subclassId);
    if (!found || !found.sub.spells.length) continue;
    const groups = found.sub.spells;
    const options = [...new Set(groups.map((g) => g.variant).filter(Boolean))];
    const value = options.includes(c.spellVariants[k.id] ?? '') ? c.spellVariants[k.id] : (options[0] ?? '');
    if (options.length) out.variants.push({ classId: k.id, subclass: found.sub.name, options, value });
    const maxLvl = maxSpellLevel(c, k);
    for (const g of groups) {
      if (g.variant && g.variant !== value) continue;
      if (g.mode === 'expanded') {
        if (g.level > maxLvl) continue;
        const set = out.expanded.get(k.id) ?? new Set<string>();
        g.spells.forEach((n) => set.add(spellKey(n)));
        out.expanded.set(k.id, set);
        continue;
      }
      if (g.level > k.level) continue;
      for (const n of g.spells) {
        const key = spellKey(n);
        if (out.always.some((x) => x.key === key)) continue;
        const ref = index.get(key) ?? null;
        out.always.push({ key, name: ref?.item.name ?? n, level: ref?.item.level ?? 1, classId: k.id, source: found.sub.name, ref });
      }
    }
  }
  return out;
}

/* ---------- Ataques de spells para Combate ---------- */

export interface SpellAttack {
  id: string;
  name: string;
  kind: 'attack' | 'save' | 'auto';
  toHit: number;
  dc: number;
  save: string | null;
  damage: string;
  note: string;
}

const tier = (level: number) => (level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1);

export function spellAttacks(c: Character, packs: Pack[], granted: GrantedSpell[] = []): SpellAttack[] {
  const total = c.classes.reduce((s, k) => s + k.level, 0);
  const t = tier(total);
  const agonizing = c.invocations.some((i) => /agonizing blast/i.test(i.name) || /agonizing-blast/.test(i.ref ?? ''));
  const entries: { id: string; ref: Ref<PackSpell> | null; spell: SpellEntry | null; classId: string | null }[] = [
    ...c.spells.filter((s) => isReady(c, s)).map((s) => ({ id: s.id, ref: findSpell(packs, s.ref), spell: s, classId: s.classId })),
    ...granted.map((g) => ({ id: `g:${g.key}`, ref: g.ref, spell: null, classId: g.classId }))
  ];
  const seen = new Set<string>();
  const out: SpellAttack[] = [];
  for (const e of entries) {
    const sp = e.ref?.item;
    if (!sp || !sp.damage || seen.has(spellKey(sp.name))) continue;
    seen.add(spellKey(sp.name));
    const g = granted.find((x) => `g:${x.key}` === e.id);
    const line = g?.ability
      ? abilityLine(c, g.ability, g.source)
      : (spellcasting(c).find((l) => l.classId === e.classId) ?? spellcasting(c)[0]);
    if (!line) continue;
    const mod = abilityMod(c, line.ability);
    const withMod = (d: string, m: number) => (m === 0 ? d : `${d} ${m > 0 ? '+' : '-'} ${Math.abs(m)}`);
    let damage = sp.damage.replace(/\s*\+\s*mod\b/, (x) => (mod === 0 ? '' : ` ${mod > 0 ? '+' : '-'} ${Math.abs(mod)}`));
    let note = sp.level === 0 ? '' : `${tr('nivel')} ${sp.level}`;
    if (sp.level === 0 && sp.scaling === 'dice') damage = damage.replace(/^(\d+)d/, (_, n) => `${Number(n) * t}d`);
    const isEB = /eldritch blast/i.test(sp.name);
    if (isEB && agonizing) damage = damage.replace(/^(\S+)/, (d) => withMod(d, mod));
    if (sp.level === 0 && sp.scaling === 'beams' && t > 1) note = tr('{n} rayos', { n: t });
    out.push({
      id: e.id,
      name: sp.name,
      kind: sp.attack === 'auto' ? 'auto' : sp.attack ? 'attack' : 'save',
      toHit: line.attack,
      dc: line.dc,
      save: sp.save,
      damage,
      note
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------- Spells de feats (Fey Touched, Magic Initiate, Telepathic...) ---------- */

const invocationByName = (packs: Pack[], name: string, ruleset: string) => {
  if (!name) return null;
  const k = spellKey(name);
  for (const p of [...packs].sort((a, b) => Number(b.pack.ruleset === ruleset) - Number(a.pack.ruleset === ruleset))) {
    const item = p.invocations.find((i) => spellKey(i.name) === k);
    if (item) return { pack: p, item, value: `${p.pack.id}:${item.id}` };
  }
  return null;
};

const LIST_ABILITY: Record<string, Ability> = {
  artificer: 'int', bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha',
  ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int'
};
const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export interface FeatPick {
  index: number;
  count: number;
  level: number;
  schools: string[];
  lists: string[];
  attackOnly: boolean;
  ritualOnly: boolean;
  uses: 'none' | 'long' | 'short' | 'will';
  chosen: string[];
  options: Ref<PackSpell>[];
}

export interface FeatSpellSlot {
  key: string; // owner|ref
  name: string;
  ability: Ability;
  chooseAbility: boolean;
  lists: string[]; // listas posibles; con más de una se elige
  list: string;
  picks: FeatPick[];
}

export const freeKey = (uses: 'none' | 'long' | 'short' | 'will', instance: string, name: string) =>
  `${uses === 'short' ? 'S' : 'L'}:${instance}|${spellKey(name)}`;

export function featSpells(c: Character, packs: Pack[]): { slots: FeatSpellSlot[]; granted: GrantedSpell[] } {
  const index = spellIndex(packs, c.ruleset);
  const all = [...new Map(spellList(packs, c.ruleset).map((r) => [spellKey(r.item.name), r])).values()];
  const slots: FeatSpellSlot[] = [];
  const granted: GrantedSpell[] = [];
  // Fuentes: feats, Eldritch Invocations (y Pact Boons 2024) y el Pact Boon de 2014.
  type Source = { key: string; ability: Ability | null; feat: Pick<PackFeat, 'name' | 'spells' | 'spellAbility'> };
  const sources: Source[] = featInstances(c, packs).flatMap((inst) =>
    inst.feat?.item.spells.length ? [{ key: `${inst.owner}|${inst.ref ?? ''}`, ability: inst.ability, feat: inst.feat.item }] : []
  );
  for (const inv of c.invocations) {
    const f = findRef(packs, inv.ref, (p) => p.invocations) ?? invocationByName(packs, inv.name, c.ruleset);
    if (f?.item.spells.length) sources.push({ key: `inv:${inv.id}`, ability: null, feat: f.item });
  }
  const PACT_2014: Record<string, PackFeat['spells']> = {
    chain: [{ spell: 'Find Familiar', count: 1, level: 1, schools: [], lists: [], attackOnly: false, ritualOnly: false, uses: 'none', minLevel: 1 }],
    tome: [{ spell: '', count: 3, level: 0, schools: [], lists: [], attackOnly: false, ritualOnly: false, uses: 'none', minLevel: 1 }]
  };
  // Rasgos de raza con spells (Light Bearer, Infernal Legacy, Drow Magic...).
  const sp = findRef(packs, c.species.ref, (p) => p.species);
  sp?.item.traits.forEach((tr, i) => {
    if (tr.spells.length) sources.push({ key: `sp:${sp.value}#${i}`, ability: null, feat: { name: tr.name, spells: tr.spells, spellAbility: tr.spellAbility || 'pick' } });
  });
  if (c.ruleset === '2014' && PACT_2014[c.pactBoon] && c.classes.some((k) => k.caster === 'pact' && k.level >= 3)) {
    const name = `Pact of the ${c.pactBoon[0].toUpperCase()}${c.pactBoon.slice(1)}`;
    sources.push({ key: `pact:${c.pactBoon}`, ability: null, feat: { name, spells: PACT_2014[c.pactBoon], spellAbility: 'cha' } });
  }
  for (const inst of sources) {
    const feat = inst.feat;
    const key = inst.key;
    const state = c.featSpells[key];
    const lists = [...new Set(feat.spells.flatMap((s) => s.lists))];
    const list = lists.length === 1 ? lists[0] : lists.includes(state?.list ?? '') ? state!.list : '';
    const how = feat.spellAbility;
    const ability: Ability =
      how === 'asi'
        ? (inst.ability ?? 'cha')
        : how === 'list'
          ? (LIST_ABILITY[list.toLowerCase()] ?? 'int')
          : how === 'pick'
            ? (state?.ability ?? 'int')
            : ABIL.includes(how)
              ? (how as Ability)
              : 'cha';
    const picks: FeatPick[] = [];
    const lvl = c.classes.reduce((s, k) => s + k.level, 0);
    feat.spells.forEach((g, i) => {
      if ((g.minLevel ?? 1) > lvl) return;
      const base = { source: feat.name, ability, uses: g.uses, classId: '' };
      if (g.spell) {
        const ref = index.get(spellKey(g.spell)) ?? null;
        granted.push({ ...base, key: spellKey(g.spell), name: ref?.item.name ?? g.spell, level: ref?.item.level ?? 1, ref, freeKey: freeKey(g.uses, key, g.spell) });
        return;
      }
      const allowed = g.lists.length ? (list ? [list] : []) : [];
      const options = all
        .filter((r) => r.item.level === g.level)
        .filter((r) => !g.schools.length || g.schools.includes(r.item.school))
        .filter((r) => !g.lists.length || (allowed.length > 0 && allowed.some((l) => inClassList(r.item, l))))
        .filter((r) => !g.attackOnly || r.item.attack === 'ranged' || r.item.attack === 'melee')
        .filter((r) => !g.ritualOnly || r.item.ritual)
        .sort((a, b) => a.item.name.localeCompare(b.item.name));
      const chosen = (state?.picks[i] ?? []).slice(0, g.count);
      picks.push({ index: i, count: g.count, level: g.level, schools: g.schools, lists: g.lists, attackOnly: g.attackOnly, ritualOnly: g.ritualOnly, uses: g.uses, chosen, options });
      for (const n of chosen) {
        if (!n) continue;
        const ref = index.get(spellKey(n)) ?? null;
        granted.push({ ...base, key: spellKey(n), name: ref?.item.name ?? n, level: ref?.item.level ?? g.level, ref, freeKey: freeKey(g.uses, key, n) });
      }
    });
    slots.push({ key, name: feat.name, ability, chooseAbility: how === 'pick', lists, list, picks });
  }
  return { slots, granted };
}

/* Ataque y DC con la ability de un feat. */
export function abilityLine(c: Character, ability: Ability, label: string): CastingLine {
  const m = abilityMod(c, ability);
  return { classId: '', className: label, ability, attack: pb(c) + m + c.spellBonus.attack, dc: 8 + pb(c) + m + c.spellBonus.dc };
}
