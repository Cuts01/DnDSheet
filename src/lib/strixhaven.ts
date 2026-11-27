/* Campaña de Strixhaven (Strixhaven: A Curriculum of Chaos): colleges, extracurriculars, jobs, exámenes,
   relaciones y student dice. Todo opcional: solo se usa si el personaje tiene la campaña activada. */
import type { Catalog } from './model/campaign';
import type { Character, StrixRelationship } from './model/character';

export const COLLEGES = [
  { name: 'Lorehold', focus: 'Archaeomancy: history and spirits', mascot: 'Spirit Statue Mascot', colors: 'Red and white' },
  { name: 'Prismari', focus: 'Elemental arts: performance and creativity', mascot: 'Art Elemental Mascot', colors: 'Red and blue' },
  { name: 'Quandrix', focus: 'Numeromancy: mathematics and nature', mascot: 'Fractal Mascot', colors: 'Blue and green' },
  { name: 'Silverquill', focus: 'Eloquence: words, light and shadow', mascot: 'Inkling Mascot', colors: 'White and black' },
  { name: 'Witherbloom', focus: 'Essence studies: life and death', mascot: 'Pest Mascot', colors: 'Black and green' }
] as const;

export const EXTRACURRICULARS: { name: string; skills: [string, string] }[] = [
  { name: 'Dead Languages Society', skills: ['Athletics', 'History'] },
  { name: 'Distinguished Society of Fine Artists', skills: ['Performance', 'Sleight of Hand'] },
  { name: 'Dragonchess Club', skills: ['Deception', 'Investigation'] },
  { name: 'Dragonsguard Historical Society', skills: ['Arcana', 'History'] },
  { name: 'Fantastical Horticulture Club', skills: ['Nature', 'Survival'] },
  { name: 'Future Entrepreneurs of Strixhaven', skills: ['Insight', 'Persuasion'] },
  { name: 'Intramural Gymnastics Club', skills: ['Acrobatics', 'Performance'] },
  { name: 'Intramural Silkball Club', skills: ['Athletics', 'Intimidation'] },
  { name: 'Intramural Water-Dancing Club', skills: ['Athletics', 'Performance'] },
  { name: 'Live-Action Roleplaying Guild', skills: ['Animal Handling', 'Performance'] },
  { name: 'Mage Tower Cheer Squad', skills: ['Perception', 'Persuasion'] },
  { name: 'Playactors Drama Guild', skills: ['Arcana', 'Deception'] },
  { name: 'Strixhaven Iron-Lifters Society', skills: ['Athletics', 'Medicine'] },
  { name: 'Strixhaven Show Band Association', skills: ['Sleight of Hand', 'Performance'] },
  { name: 'Strixhaven Star', skills: ['Investigation', 'Insight'] },
  { name: 'Student-Mages of Faith', skills: ['Insight', 'Religion'] }
];

export const JOBS: { place: string; jobs: string[] }[] = [
  { place: 'Biblioplex', jobs: ['Book clerk', 'Book shelver', 'Café worker', 'Cleanup crew member', 'Garden tender', 'Store worker'] },
  { place: "Bow's End Tavern", jobs: ['Assistant manager', 'Cleanup crew member', 'Cook', 'Host', 'Server'] },
  { place: 'Campus Grounds', jobs: ['Graffiti eraser', 'Lawn manicurist', 'Litter retriever', 'Sidewalk sweeper', 'Statuary repairer', 'Trash collector'] },
  { place: 'Campus Magic Labs', jobs: ['Cleanup crew member', 'Specimen preparer', 'Volunteer lab partner'] },
  { place: 'Dormitories', jobs: ['Cleanup crew member', 'Events assistant', 'Front-desk worker', 'Resident assistant'] },
  { place: 'Firejolt Café', jobs: ['Barista', 'Cashier', 'Cleanup crew member', 'Server'] },
  { place: 'Intramural Fields', jobs: ['Cleanup crew member', 'Crowd manager', 'Equipment assistant', 'Groundskeeper', 'Referee'] },
  { place: 'Strixhaven Performing Arts Society', jobs: ['Cleanup crew member', 'General assistant', 'Refreshments expert', 'Stagehand', 'Ticket taker', 'Usher'] },
  { place: 'Strixhaven Stadium', jobs: ['Cleanup crew member', 'Entertainment assistant', 'Equipment assistant', 'Groundskeeper', 'Refreshments expert', 'Ticket taker', 'Usher'] }
];

export const JOB_PAY_GP = 5;

/* College: el elegido o, si no hay, el del background "<College> Student". */
export function collegeOf(c: Character): string {
  if (c.strixhaven.college) return c.strixhaven.college;
  const m = /^(Lorehold|Prismari|Quandrix|Silverquill|Witherbloom) Student$/i.exec(c.background.name.trim());
  return m ? COLLEGES.find((x) => x.name.toLowerCase() === m[1].toLowerCase())!.name : '';
}

/* Con Job solo se puede estar en un extracurricular; sin Job, en dos. */
export const maxExtracurriculars = (c: Character) => (c.strixhaven.job ? 1 : 2);

export interface StudentDie {
  id: string;
  source: string;
  skills: string[];
  used: boolean;
}

/* Student Dice (d4): uno por extracurricular y uno o dos por examen aprobado o con honores del año actual.
   Cada uno se usa una vez por Long Rest en una prueba con sus skills. */
/* catalog: clubes de la campaña (cada club elegido da un dado con sus habilidades; el equipo de Mage Tower cuenta como club). */
export function studentDice(c: Character, catalog?: Catalog | null): StudentDie[] {
  const s = c.strixhaven;
  const out: StudentDie[] = [];
  const sch = s.schedule;
  if (catalog && (sch.clubs.length || sch.team)) {
    for (const id of sch.clubs) {
      const k = catalog.clubs.find((x) => x.id === id);
      if (k) out.push({ id: `ec:${k.name}`, source: k.name, skills: [...k.skills], used: false });
    }
    const t = catalog.teams.find((x) => x.id === sch.team);
    if (t && catalog.rules.teamGivesDie) out.push({ id: `ec:${t.name}`, source: t.name, skills: [], used: false });
  } else
    s.extracurriculars.slice(0, maxExtracurriculars(c)).forEach((name) => {
      const e = EXTRACURRICULARS.find((x) => x.name === name);
      out.push({ id: `ec:${name}`, source: name, skills: e ? [...e.skills] : [], used: false });
    });
  for (const ex of s.exams) {
    if (ex.year !== s.year) continue; // los dados de exámenes se pierden al terminar el año
    const n = ex.result === 'aced' ? 2 : ex.result === 'passed' ? 1 : 0;
    for (let i = 0; i < n; i++)
      out.push({ id: `ex:${ex.id}#${i}`, source: ex.name || 'Exam', skills: ex.skills.split(/,\s*/).filter(Boolean), used: false });
  }
  for (const d of out) d.used = s.diceUsed.includes(d.id);
  return out;
}

export type RelStatus = 'beloved' | 'friend' | 'rival' | 'neutral';

/* Friend con 2+ puntos, Rival con −2 o menos. Beloved es un Friend elegido; termina si baja de 1 punto. */
export function relStatus(r: StrixRelationship): RelStatus {
  if (r.beloved && r.points >= 1) return 'beloved';
  if (r.points >= 2) return 'friend';
  if (r.points <= -2) return 'rival';
  return 'neutral';
}

/* Beloved Inspiration: tantos usos por Long Rest como Beloveds. */
export const belovedCount = (c: Character) => c.strixhaven.relationships.filter((r) => relStatus(r) === 'beloved').length;

export const YEAR_NAMES = ['', 'First year', 'Second year', 'Third year', 'Fourth year'];
