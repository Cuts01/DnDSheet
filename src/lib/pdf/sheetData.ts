/* Datos de la hoja para el PDF: todo ya calculado y en texto, para que el dibujo no dependa de las reglas. */
import { t } from '../i18n.svelte';
import { ABILITIES, type Ability, type Character, type SpellEntry } from '../model/character';
import type { Pack } from '../model/pack';
import {
  abilityMod,
  armorClassInfo,
  attacks,
  classSummary,
  fmt,
  hasSave,
  hitDicePools,
  initiative,
  maxHp,
  pactSlots,
  passive,
  pb,
  saveBonus,
  score,
  skillBonus,
  skillLevel,
  slotMax,
  speed,
  spellcasting,
  totalLevel
} from '../rules/derive';
import {
  allGrantedEffects,
  characterFeatures,
  featInstances,
  findBackground,
  findInvocation,
  findSpecies,
  proficiencies
} from '../rules/features';
import { featureChoiceSlots, featureResources, resistances } from '../rules/grants';
import { featSpells, findSpell, isReady, spellAttacks, spellKey, subclassSpells } from '../rules/spells';
import { ABILITY_LABEL, SKILLS } from '../rules/tables';

export interface TextItem {
  title: string;
  tag?: string;
  text: string;
  extra?: string;
}

export interface SpellRow {
  name: string;
  level: number;
  mark: 'prepared' | 'always' | 'none';
  meta: string;
  text: string;
  source?: string;
}

export interface SheetData {
  name: string;
  photo: string;
  lines: string[];
  stats: { label: string; value: string; sub?: string }[];
  abilities: { label: string; mod: string; score: number }[];
  saves: { label: string; value: string; prof: boolean }[];
  skills: { label: string; ability: string; value: string; level: 'none' | 'prof' | 'expertise' }[];
  passives: { label: string; value: number }[];
  attacks: { name: string; hit: string; damage: string }[];
  casting: { label: string; ability: string; attack: string; dc: number }[];
  slots: { level: number; count: number }[];
  pact: { count: number; level: number } | null;
  resources: { name: string; detail: string }[];
  profs: { label: string; value: string }[];
  resistances: string;
  equipment: string[];
  currency: string;
  features: { heading: string; items: TextItem[] }[];
  spells: SpellRow[];
  inventory: string[];
  notes: string;
}

const recharge = (r: string) =>
  r === 'short' ? 'Short Rest' : r === 'short1' ? t('1 por Short Rest, todos por Long Rest') : r === 'none' ? t('Manual') : 'Long Rest';

const levelName = (l: number) => (l === 0 ? 'Cantrips' : `${t('Nivel')} ${l}`);

export function sheetData(c: Character, packs: Pack[]): SheetData {
  const granted = allGrantedEffects(c, packs);
  const ac = armorClassInfo(c, granted);
  const profs = proficiencies(c, packs);
  const pools = hitDicePools(c);
  const sp = findSpecies(packs, c.species.ref)?.item ?? null;
  const bg = findBackground(packs, c.background.ref)?.item ?? null;

  const lines = [
    `${classSummary(c) || t('Sin clase')} · ${t('nivel')} ${totalLevel(c)}`,
    [c.species.name || sp?.name, c.background.name || bg?.name, `D&D 5e ${c.ruleset}`].filter(Boolean).join(' · ')
  ];

  const stats = [
    { label: 'AC', value: String(ac.total), sub: ac.label },
    { label: t('Iniciativa'), value: fmt(initiative(c, granted)) },
    { label: 'Speed', value: `${speed(c, granted)} ft` },
    { label: 'Proficiency', value: fmt(pb(c)) },
    { label: t('HP máximo'), value: String(maxHp(c)) },
    { label: 'Hit Dice', value: pools.map((p) => `${p.total}d${p.die}`).join(' + ') || '-' }
  ];

  const abilities = ABILITIES.map((a) => ({ label: ABILITY_LABEL[a], mod: fmt(abilityMod(c, a)), score: score(c, a) }));
  const saves = ABILITIES.map((a: Ability) => ({ label: ABILITY_LABEL[a], value: fmt(saveBonus(c, a)), prof: hasSave(c, a) }));
  const skills = SKILLS.map((s) => ({ label: s.name, ability: ABILITY_LABEL[s.ability], value: fmt(skillBonus(c, s)), level: skillLevel(c, s) }));
  const passives = [
    { label: 'Passive Perception', value: passive(c, 'perception', granted) },
    { label: 'Passive Insight', value: passive(c, 'insight', granted) },
    { label: 'Passive Investigation', value: passive(c, 'investigation', granted) }
  ];

  // Ataques con armas y spells de ataque o save (incluye las que dan subclass y feats).
  const sub = subclassSpells(c, packs);
  const fs = featSpells(c, packs);
  const grantedSpells = [...sub.always];
  for (const g of fs.granted) if (!grantedSpells.some((x) => x.key === g.key)) grantedSpells.push(g);
  const atk = [
    ...attacks(c, profs.weapons, granted).map((a) => ({
      name: a.name,
      hit: fmt(a.toHit),
      damage: [a.damage, a.damageType, a.versatile ? `(${t('versátil')} ${a.versatile})` : ''].filter(Boolean).join(' ')
    })),
    ...spellAttacks(c, packs, grantedSpells).map((s) => ({
      name: s.name,
      hit: s.kind === 'attack' ? fmt(s.toHit) : s.kind === 'save' ? `DC ${s.dc}` : '-',
      damage: [s.damage, s.kind === 'save' && s.save ? `(${s.save})` : '', s.note].filter(Boolean).join(' ')
    }))
  ];

  const casting = spellcasting(c).map((l) => ({ label: l.className, ability: ABILITY_LABEL[l.ability], attack: fmt(l.attack), dc: l.dc }));
  const slots = slotMax(c)
    .map((count, i) => ({ level: i + 1, count }))
    .filter((s) => s.count > 0);
  const pt = pactSlots(c);

  const resources = [
    ...featureResources(c, packs).map((r) => ({ name: r.name, detail: `${r.max}${r.die ? ` × ${r.die}` : ''} · ${recharge(r.recharge)}` })),
    ...c.resources.filter((r) => r.name && r.max > 0).map((r) => ({ name: r.name, detail: `${r.max} · ${recharge(r.recharge)}` }))
  ];

  const profRows = [
    { label: 'Armor', value: profs.armor.join(', ') },
    { label: 'Weapons', value: profs.weapons.join(', ') },
    { label: 'Tools', value: profs.tools.join(', ') },
    { label: t('Idiomas'), value: profs.languages.join(', ') }
  ].filter((r) => r.value);

  const equipped = c.inventory.filter((i) => i.equipped || i.attuned);
  const equipment = equipped.map((i) => `${i.name}${i.bonus ? ` ${fmt(i.bonus)}` : ''}${i.attuned ? ' (attuned)' : ''}`);
  const cur = c.currency;
  const currency = (['pp', 'gp', 'ep', 'sp', 'cp'] as const)
    .filter((k) => cur[k] > 0)
    .map((k) => `${cur[k]} ${k}`)
    .join(' · ');

  /* ---------- Rasgos y features ---------- */
  const choiceMap = new Map(featureChoiceSlots(c, packs).map((s) => [s.featureId, s]));
  const features: SheetData['features'] = [];
  if (sp?.traits.length) {
    features.push({ heading: `${c.ruleset === '2024' ? 'Species' : t('Raza')}: ${sp.name}`, items: sp.traits.map((tr) => ({ title: tr.name, text: tr.text })) });
  }
  if (bg) {
    const items: TextItem[] = bg.traits.map((tr) => ({ title: tr.name, text: tr.text }));
    if (bg.equipment) items.push({ title: t('Equipo inicial'), text: bg.equipment });
    if (items.length) features.push({ heading: `Background: ${bg.name}`, items });
  }
  for (const g of characterFeatures(c, packs)) {
    const items = g.features
      .filter((f) => f.owned)
      .map((f) => {
        const ch = choiceMap.get(f.feature.id);
        return {
          title: f.feature.name,
          tag: `${t('Nv')} ${f.feature.level}${f.source === 'subclass' ? ` · ${f.sourceName}` : ''}`,
          text: f.feature.text,
          extra: ch && ch.chosen.length ? `${ch.label}: ${ch.chosen.join(', ')}` : undefined
        };
      });
    if (items.length) features.push({ heading: `${g.entry.name} ${g.entry.level}${g.entry.subclass ? ` (${g.entry.subclass})` : ''}`, items });
  }
  const feats = featInstances(c, packs).filter((f) => f.feat || f.name);
  if (feats.length) {
    features.push({
      heading: 'Feats',
      items: feats.map((f) => {
        const pf = f.feat?.item;
        const ch = choiceMap.get(`feat:${f.owner}`);
        return {
          title: pf?.name ?? f.name,
          tag: pf?.prerequisite ? `${t('Requisito')}: ${pf.prerequisite}` : undefined,
          text: pf?.text ?? '',
          extra: ch && ch.chosen.length ? `${ch.label}: ${ch.chosen.join(', ')}` : undefined
        };
      })
    });
  }
  const inv = c.invocations.filter((i) => i.ref || i.name);
  if (inv.length || c.pactBoon !== 'none') {
    const items: TextItem[] = inv.map((i) => {
      const f = findInvocation(packs, i.ref)?.item;
      return { title: f?.name ?? i.name, tag: f?.prerequisite ? `${t('Requisito')}: ${f.prerequisite}` : undefined, text: f?.text ?? '' };
    });
    if (c.pactBoon !== 'none') items.unshift({ title: `Pact of the ${c.pactBoon[0].toUpperCase()}${c.pactBoon.slice(1)}`, text: '' });
    features.push({ heading: 'Eldritch Invocations', items });
  }
  const res = resistances(c, packs);

  /* ---------- Spells ---------- */
  const row = (s: SpellEntry, source?: string): SpellRow => {
    const d = findSpell(packs, s.ref)?.item ?? null;
    const meta = d
      ? [d.school, d.castingTime + (d.ritual ? ' (ritual)' : ''), d.range, d.components, d.duration + (d.concentration ? ' (C)' : '')].filter(Boolean).join(' · ')
      : '';
    return {
      name: s.name,
      level: s.level,
      mark: s.always ? 'always' : s.level > 0 && isReady(c, s) ? 'prepared' : 'none',
      meta,
      text: [d?.text ?? '', s.notes].filter(Boolean).join('\n'),
      source
    };
  };
  const own = c.spells.map((s) => row(s));
  const virtual = grantedSpells
    .filter((g) => !c.spells.some((s) => spellKey(s.name) === g.key))
    .map((g) =>
      row(
        { id: `g:${g.key}`, ref: g.ref?.value ?? null, name: g.name, level: g.level, classId: g.classId, prepared: false, always: true, notes: '' },
        g.source
      )
    );
  const spells = [...own, ...virtual].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const inventory = c.inventory.map(
    (i) =>
      `${i.qty > 1 ? `${i.qty} × ` : ''}${i.name}${i.bonus ? ` ${fmt(i.bonus)}` : ''}${i.equipped ? ` (${t('equipado')})` : ''}${i.attuned ? ' (attuned)' : ''}${i.notes ? `: ${i.notes}` : ''}`
  );

  return {
    name: c.name || t('Sin nombre'),
    photo: c.photo,
    lines,
    stats,
    abilities,
    saves,
    skills,
    passives,
    attacks: atk,
    casting,
    slots,
    pact: pt.count ? { count: pt.count, level: pt.slotLevel } : null,
    resources,
    profs: profRows,
    resistances: res.join(', '),
    equipment,
    currency,
    features,
    spells,
    inventory,
    notes: c.notes
  };
}

export { levelName };
