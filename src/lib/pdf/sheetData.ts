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
import { orderAttacks } from '../rules/attackOrder';
import { COLLEGES, EXTRACURRICULARS, JOB_PAY_GP, belovedCount, collegeOf, relStatus, studentDice, YEAR_NAMES } from '../strixhaven';

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
  attacks: { name: string; hit: string; damage: string; range: string }[];
  armor: { name: string; ac: string; equipped: boolean }[];
  consumables: { name: string; qty: number }[];
  coins: { pp: number; gp: number; ep: number; sp: number; cp: number };
  /* Valores sueltos para la plantilla de la página 1. */
  front: { player: string; age: string; height: string; weight: string; size: string; classLine: string; originLine: string; ac: string; init: string; speed: string; prof: string; maxHp: string; perception: number; hitDice: string; hitDiceTotal: number };
  /* Una línea por rasgo para el recuadro Traits and Features (el texto completo va en las páginas siguientes). */
  traitLines: { text: string; head?: boolean }[];
  casting: { label: string; ability: string; attack: string; dc: number }[];
  slots: { level: number; count: number }[];
  pact: { count: number; level: number } | null;
  resources: { name: string; detail: string; short: string }[];
  profs: { label: string; value: string }[];
  resistances: string;
  equipment: string[];
  currency: string;
  features: { heading: string; items: TextItem[] }[];
  spells: SpellRow[];
  /* head en negrita (cantidad, nombre y bonus); tail normal (estado y notas). */
  inventory: { head: string; tail: string }[];
  notes: string;
  /* Campaña de Strixhaven (solo si está activada). */
  strix: { label: string; value: string }[] | null;
}

const recharge = (r: string) =>
  r === 'short' ? 'Short Rest' : r === 'short1' ? t('1 por Short Rest, todos por Long Rest') : r === 'none' ? t('Manual') : 'Long Rest';

const rest = (r: string) => (r === 'short' ? 'SR' : r === 'short1' ? 'SR/LR' : r === 'none' ? '-' : 'LR');

const levelName = (l: number) => (l === 0 ? 'Cantrips' : `${t('Nivel')} ${l}`);

export function sheetData(c: Character, packs: Pack[]): SheetData {
  const granted = allGrantedEffects(c, packs);
  const ac = armorClassInfo(c, granted);
  const profs = proficiencies(c, packs);
  const pools = hitDicePools(c);
  const sp = findSpecies(packs, c.species.ref)?.item ?? null;
  const bg = findBackground(packs, c.background.ref)?.item ?? null;

  const classOnly = c.classes.map((k) => `${k.name}${k.subclass ? ` (${k.subclass})` : ''} ${k.level}`).join(' / ');
  const lines = [
    `${classOnly || t('Sin clase')} · ${t('nivel')} ${totalLevel(c)}`,
    [c.species.name || sp?.name, c.background.name || bg?.name, `D&D 5e ${c.ruleset}`].filter(Boolean).join(' · '),
    [
      c.age ? `${t('Edad')}: ${c.age}` : '',
      c.height ? `${t('Altura')}: ${c.height}` : '',
      c.weight ? `${t('Peso')}: ${c.weight}` : '',
      `${t('Tamaño')}: ${c.species.size}`,
      c.playerName ? `${t('Jugador')}: ${c.playerName}` : ''
    ]
      .filter(Boolean)
      .join(' · ')
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
  const rangeOf = (id: string) => {
    const w = c.inventory.find((i) => i.id === id)?.weapon;
    if (!w) return '5 ft';
    if (w.normalRange) return `${w.normalRange}/${w.longRange ?? w.normalRange} ft`;
    return w.properties.some((x) => x.toLowerCase() === 'reach') ? '10 ft' : '5 ft';
  };
  const atkAll = [
    ...attacks(c, profs.weapons, granted).map((a) => ({
      key: `w:${a.id}`,
      name: a.name,
      hit: fmt(a.toHit),
      damage: [a.damage, a.damageType, a.versatile ? `(${t('versátil')} ${a.versatile})` : ''].filter(Boolean).join(' '),
      range: rangeOf(a.id)
    })),
    ...spellAttacks(c, packs, grantedSpells).map((s) => ({
      key: `s:${s.id}`,
      name: s.name,
      hit: s.kind === 'attack' ? fmt(s.toHit) : s.kind === 'save' ? `DC ${s.dc}` : '-',
      damage: [s.damage, s.kind === 'save' && s.save ? `(${s.save})` : '', s.note].filter(Boolean).join(' '),
      range: (() => {
        const ref = grantedSpells.find((g) => g.name === s.name)?.ref ?? null;
        const own = c.spells.find((x) => x.name === s.name);
        return (ref?.item ?? findSpell(packs, own?.ref ?? null)?.item)?.range ?? '';
      })()
    }))
  ];
  // En el orden que eligió el jugador en Combate.
  const atk = orderAttacks(atkAll, c.attackOrder).map(({ key: _k, ...rest }) => rest);

  const casting = spellcasting(c).map((l) => ({ label: l.className, ability: ABILITY_LABEL[l.ability], attack: fmt(l.attack), dc: l.dc }));
  const slots = slotMax(c)
    .map((count, i) => ({ level: i + 1, count }))
    .filter((s) => s.count > 0);
  const pt = pactSlots(c);

  const resources = [
    ...featureResources(c, packs).map((r) => ({
      name: r.name,
      detail: `${r.max}${r.die ? ` × ${r.die}` : ''} · ${recharge(r.recharge)}`,
      short: `${r.max}${r.die ? ` × ${r.die}` : ''} · ${rest(r.recharge)}`
    })),
    ...c.resources.filter((r) => r.name && r.max > 0).map((r) => ({ name: r.name, detail: `${r.max} · ${recharge(r.recharge)}`, short: `${r.max} · ${rest(r.recharge)}` }))
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

  const armorRows = c.inventory
    .filter((i) => i.kind === 'armor' && i.armor)
    .sort((a, b) => Number(b.equipped) - Number(a.equipped))
    .map((i) => ({
      name: `${i.name}${i.bonus ? ` ${fmt(i.bonus)}` : ''}`,
      ac: i.armor!.category === 'shield' ? `+${i.armor!.ac + i.bonus}` : String(i.armor!.ac + i.bonus),
      equipped: i.equipped
    }));
  const CONSUMABLE = /potion|poci|scroll|perg|elixir|oil|antitoxin|ration|raci|healer|arrow|flecha|bolt|virote|dart|javelin|caltrop|ball bearing|torch|antorcha|holy water/i;
  const consumables = c.inventory
    .filter((i) => i.kind !== 'armor' && i.kind !== 'weapon' && (CONSUMABLE.test(i.name) || i.qty > 1))
    .map((i) => ({ name: i.name, qty: i.qty }));

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
  const traitLines: SheetData['traitLines'] = [];
  for (const g of features) {
    traitLines.push({ text: g.heading, head: true });
    for (const it of g.items) {
      if (it.title === t('Equipo inicial')) continue;
      const lv = it.tag && /^\S{1,3} \d+$/.test(it.tag.split(" · ")[0]) ? ` (${it.tag.split(' · ')[0]})` : '';
      traitLines.push({ text: `${it.title}${lv}${it.extra ? `: ${it.extra.replace(/^[^:]*: /, '')}` : ''}` });
    }
  }
  if (res.length) traitLines.push({ text: `Resistances: ${res.join(', ')}` });

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

  const inventory = c.inventory.map((i) => {
    const head = `${i.qty > 1 && !i.name.includes(`(${i.qty})`) ? `${i.qty} × ` : ''}${i.name}${i.bonus ? ` ${fmt(i.bonus)}` : ''}`;
    const tags = `${i.equipped ? ` (${t('equipado')})` : ''}${i.attuned ? ' (attuned)' : ''}`;
    const notes = i.notes.trim();
    // Sin etiquetas, los ":" van en negrita con el nombre (como "Armor:" en Proficiencies).
    if (notes && !tags) return { head: `${head}:`, tail: ` ${notes}` };
    return { head, tail: `${tags}${notes ? `: ${notes}` : ''}` };
  });

  let strix: SheetData['strix'] = null;
  if (c.strixhaven.enabled) {
    const s = c.strixhaven;
    const college = collegeOf(c);
    const info = COLLEGES.find((x) => x.name === college);
    const status = { beloved: 'Beloved', friend: 'Friend', rival: 'Rival', neutral: 'Neutral' } as const;
    const res = { '': '-', failed: 'Failed', passed: 'Passed', aced: 'Aced' } as const;
    strix = [
      { label: 'College', value: [college || '-', info?.focus].filter(Boolean).join(' · ') },
      { label: t('Año'), value: YEAR_NAMES[s.year] },
      ...(info ? [{ label: 'Mascot', value: info.mascot }] : []),
      ...s.extracurriculars.map((e) => ({ label: 'Extracurricular', value: `${e} (${EXTRACURRICULARS.find((x) => x.name === e)?.skills.join(', ') ?? ''})` })),
      ...(s.job ? [{ label: 'Job', value: `${s.job} · ${JOB_PAY_GP} gp/${t('semana')}` }] : []),
      { label: 'Student Dice (d4)', value: studentDice(c).map((d) => `${d.source}: ${d.skills.join(', ') || '-'}`).join(' · ') || '-' },
      ...(belovedCount(c) ? [{ label: 'Beloved Inspiration', value: `${belovedCount(c)} / Long Rest` }] : []),
      ...s.exams.map((e) => ({ label: `${t('Examen')} (${t('Año')} ${e.year})`, value: `${e.name || '-'} · ${e.skills || '-'} · ${res[e.result]}` })),
      ...s.relationships
        .filter((r) => r.name.trim())
        .map((r) => {
          const st = relStatus(r);
          const extra = (st === 'friend' || st === 'beloved') && r.boon ? ` · Boon: ${r.boon}` : st === 'rival' && r.bane ? ` · Bane: ${r.bane}` : '';
          return { label: r.name, value: `${status[st]} (${r.points > 0 ? '+' : ''}${r.points})${extra}${r.notes ? ` · ${r.notes}` : ''}` };
        }),
      ...(s.notes.trim() ? [{ label: t('Notas'), value: s.notes.trim() }] : [])
    ];
  }

  return {
    strix,
    name: c.name || t('Sin nombre'),
    photo: c.photo,
    lines,
    stats,
    abilities,
    saves,
    skills,
    passives,
    attacks: atk,
    armor: armorRows,
    consumables,
    coins: { ...c.currency },
    front: {
      player: c.playerName,
      age: c.age,
      height: c.height,
      weight: c.weight,
      size: c.species.size,
      classLine: lines[0],
      originLine: [c.species.name || sp?.name, c.background.name || bg?.name].filter(Boolean).join(' / '),
      ac: String(ac.total),
      init: fmt(initiative(c, granted)),
      speed: `${speed(c, granted)} ft`,
      prof: fmt(pb(c)),
      maxHp: String(maxHp(c)),
      perception: passive(c, 'perception', granted),
      hitDice: pools.map((p) => `${p.total}d${p.die}`).join('+'),
      hitDiceTotal: pools.reduce((n, p) => n + p.total, 0)
    },
    traitLines,
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
