import type { Character } from '../model/character';
import type { Block, Catalog, CatalogClub, CatalogCourse, CatalogJob, CatalogTeam, Shift } from '../model/campaign';

/* Horario de Strixhaven armado con el catálogo de la campaña: bloques, choques, límites y resumen. */

export type ItemKind = 'required' | 'elective' | 'club' | 'team' | 'job';
export interface TimedEntry extends Block {
  key: string; // `${kind}:${id}` del elemento (los bloques del mismo elemento no chocan entre sí)
  kind: ItemKind;
  label: string;
  detail: string;
}
export interface DayNote {
  key: string;
  kind: ItemKind;
  day: number;
  label: string;
  text: string;
}

const hhmm = (m: number) => {
  const x = ((m % 1440) + 1440) % 1440;
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
};
export const fmtSpan = (s: number, e: number) => `${hhmm(s)}–${hhmm(e)}${e > 1440 ? ' (madrugada)' : ''}`;

export const courseLabel = (c: CatalogCourse) => (c.code ? `${c.code} · ${c.name}` : c.name);

/* "Lunes y arcanes · 9:00–10:30" a partir de los bloques. */
export function whenText(blocks: Block[], dayNames: string[]): string {
  const groups = new Map<string, number[]>();
  for (const b of blocks) {
    const k = fmtSpan(b.start, b.end);
    groups.set(k, [...(groups.get(k) ?? []), b.day]);
  }
  const parts = [...groups].map(([span, days]) => {
    const n = days.map((d) => dayNames[d - 1] ?? String(d));
    const list = n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0];
    return `${list} · ${span}`;
  });
  return parts.join('; ');
}

export interface Picked {
  required: CatalogCourse[];
  electives: CatalogCourse[];
  clubs: CatalogClub[];
  team: CatalogTeam | null;
  job: CatalogJob | null;
  shifts: Shift[];
}
export function picked(c: Character, cat: Catalog): Picked {
  const s = c.strixhaven.schedule;
  const job = cat.jobs.find((j) => j.id === s.job) ?? null;
  return {
    required: cat.courses.filter((x) => x.required),
    electives: s.electives.map((id) => cat.courses.find((x) => x.id === id && !x.required)).filter((x): x is CatalogCourse => !!x),
    clubs: s.clubs.map((id) => cat.clubs.find((x) => x.id === id)).filter((x): x is CatalogClub => !!x),
    team: cat.teams.find((t) => t.id === s.team) ?? null,
    job,
    shifts: job ? job.shifts.filter((x) => s.shifts.includes(x.id)) : []
  };
}

/* Todos los bloques con hora y las notas del día (eventos, turnos sin hora). */
export function scheduleOf(c: Character, cat: Catalog): { timed: TimedEntry[]; notes: DayNote[] } {
  const p = picked(c, cat);
  const timed: TimedEntry[] = [];
  const notes: DayNote[] = [];
  const addCourse = (x: CatalogCourse, kind: ItemKind) =>
    x.blocks.forEach((b) => timed.push({ ...b, key: `course:${x.id}`, kind, label: x.code || x.name, detail: x.name }));
  p.required.forEach((x) => addCourse(x, 'required'));
  p.electives.forEach((x) => addCourse(x, 'elective'));
  for (const x of p.clubs) {
    x.blocks.forEach((b) => timed.push({ ...b, key: `club:${x.id}`, kind: 'club', label: x.name, detail: x.where || x.when }));
    x.events.forEach((e) => notes.push({ key: `club:${x.id}`, kind: 'club', day: e.day, label: x.name, text: e.text }));
  }
  if (p.team) {
    const t = p.team;
    t.blocks.forEach((b) => timed.push({ ...b, key: `team:${t.id}`, kind: 'team', label: t.name, detail: t.when }));
    t.events.forEach((e) => notes.push({ key: `team:${t.id}`, kind: 'team', day: e.day, label: t.name, text: e.text }));
  }
  if (p.job) {
    const j = p.job;
    for (const sh of p.shifts) {
      if (sh.start !== null && sh.end !== null)
        timed.push({ day: sh.day, start: sh.start, end: sh.end, key: `job:${j.id}`, kind: 'job', label: j.name, detail: sh.label });
      else notes.push({ key: `job:${j.id}`, kind: 'job', day: sh.day, label: j.name, text: `${sh.label} (hora a convenir)` });
    }
  }
  timed.sort((a, b) => a.day - b.day || a.start - b.start);
  return { timed, notes };
}

const overlaps = (a: Block, b: Block) => a.day === b.day && a.start < b.end && b.start < a.end;

/* Pares de bloques que se pisan (de elementos distintos). */
export function clashes(timed: TimedEntry[]): [TimedEntry, TimedEntry][] {
  const out: [TimedEntry, TimedEntry][] = [];
  for (let i = 0; i < timed.length; i++)
    for (let j = i + 1; j < timed.length; j++) if (timed[i].key !== timed[j].key && overlaps(timed[i], timed[j])) out.push([timed[i], timed[j]]);
  return out;
}

/* Con qué choca un elemento que todavía no elegiste. */
export function clashNames(blocks: Block[], key: string, timed: TimedEntry[]): string[] {
  const names = new Set<string>();
  for (const b of blocks) for (const t of timed) if (t.key !== key && overlaps(b, t)) names.add(t.label);
  return [...names];
}

export interface Tally {
  electives: number;
  level2: number;
  clubs: number;
  jobs: number;
  scholarship: boolean;
  warnings: string[];
}
/* Cuenta lo elegido contra las reglas de la campaña y arma los avisos. */
export function tally(c: Character, cat: Catalog, dayNames: string[]): Tally {
  const r = cat.rules;
  const s = c.strixhaven.schedule;
  const p = picked(c, cat);
  const jobs = p.job ? 1 : 0;
  const clubs = p.clubs.length + (p.team && r.teamCountsAsClub ? 1 : 0) + (r.jobUsesClubSlot ? jobs : 0);
  const level2 = p.electives.filter((x) => x.level2).length;
  const scholarship = s.scholarship || !!p.team;
  const w: string[] = [];
  const { timed } = scheduleOf(c, cat);
  const seen = new Set<string>();
  for (const [a, b] of clashes(timed)) {
    const k = [a.day, a.label, b.label].join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    w.push(`Choque el ${dayNames[a.day - 1] ?? a.day}: ${a.label} (${fmtSpan(a.start, a.end)}) y ${b.label} (${fmtSpan(b.start, b.end)}).`);
  }
  if (p.electives.length > r.maxElectives) w.push(`Tienes ${p.electives.length} optativas; el máximo es ${r.maxElectives}.`);
  if (level2 > r.maxLevel2) w.push(`Solo puedes llevar ${r.maxLevel2} optativa(s) de Nivel 2.º año (llevas ${level2}).`);
  else if (level2 > 1) w.push(`Llevas ${level2} optativas de Nivel 2.º año: se permite, pero el DM no lo recomienda (son pesadas).`);
  if (clubs > r.maxClubs) w.push(`Cuentas ${clubs} clubes${r.jobUsesClubSlot && jobs ? ' contando el trabajo' : ''}; el máximo es ${r.maxClubs}.`);
  if (jobs && scholarship && r.scholarshipReplacesJob) w.push('Con beca deportiva no tienes trabajo: la beca lo sustituye.');
  if (p.job && !p.shifts.length) w.push(`Marca los turnos que harás en ${p.job.name}.`);
  if (p.electives.length < r.minElectives) w.push(`Elige al menos ${r.minElectives} optativa(s).`);
  return { electives: p.electives.length, level2, clubs, jobs, scholarship, warnings: w };
}

/* Filas para el resumen y el PDF. */
export function scheduleRows(c: Character, cat: Catalog, dayNames: string[]): { kind: string; name: string; when: string; where: string; who: string }[] {
  const p = picked(c, cat);
  const rows: { kind: string; name: string; when: string; where: string; who: string }[] = [];
  const extra = (x: CatalogCourse) => {
    const dc = classDC(cat, x);
    const die = c.strixhaven.schedule.study[x.id];
    return [dc ? `DC ${dc}` : '', die ? `estudio ${die}` : ''].filter(Boolean).join(', ');
  };
  const kind = (k: string, x: CatalogCourse) => (extra(x) ? `${k} (${extra(x)})` : k);
  for (const x of p.required) rows.push({ kind: kind('Obligatoria', x), name: courseLabel(x), when: whenText(x.blocks, dayNames), where: x.room, who: x.prof });
  for (const x of p.electives)
    rows.push({ kind: kind('Optativa', x), name: courseLabel(x) + (x.level2 ? ' (Nivel 2.º año)' : ''), when: whenText(x.blocks, dayNames), where: x.room, who: x.prof });
  for (const x of p.clubs) rows.push({ kind: 'Club', name: x.name, when: x.when, where: x.where, who: x.sponsor });
  if (p.team) rows.push({ kind: 'Mage Tower', name: p.team.name, when: p.team.when, where: 'Estadio', who: p.team.coach });
  if (p.job) {
    const pos = c.strixhaven.schedule.position;
    const turns = p.shifts.map((sh) => `${dayNames[sh.day - 1] ?? sh.day} ${sh.start !== null && sh.end !== null ? fmtSpan(sh.start, sh.end) : '(a convenir)'}`).join(', ');
    rows.push({ kind: 'Trabajo', name: p.job.name + (pos ? ` (${pos})` : ''), when: turns || p.job.when, where: p.job.name, who: p.job.boss });
  }
  return rows;
}

/* Mantiene los campos que usa el resto de la app (Student Dice, tarjeta de Strixhaven): clubes y trabajo. */
export function syncFromSchedule(c: Character, cat: Catalog) {
  const p = picked(c, cat);
  c.strixhaven.extracurriculars = [...p.clubs.map((x) => x.name), ...(p.team ? [p.team.name] : [])].slice(0, 4);
  const pos = c.strixhaven.schedule.position;
  c.strixhaven.job = p.job ? `${p.job.name}${pos ? `: ${pos}` : ''}` : '';
}

/* DC del check de clase de un curso (0 si la campaña no usa checks). */
export const classDC = (cat: Catalog, x: CatalogCourse) => (x.level2 ? cat.rules.level2DC || cat.rules.classDC : cat.rules.classDC);
