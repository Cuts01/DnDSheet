import { describe, expect, it } from 'vitest';
import { blankCharacter, type Character } from '../model/character';
import { CatalogSchema } from '../model/campaign';
import { clashes, scheduleOf, scheduleRows, syncFromSchedule, tally, whenText } from './schedule';
import { studentDice } from '../strixhaven';

const days = ['Lunes', 'Martes', 'Arcanes', 'Astres', 'Miércoles', 'Jueves', 'Viernes', 'Dracones', 'Sábado', 'Domingo'];
const cat = CatalogSchema.parse({
  rules: { minElectives: 1, maxElectives: 3, maxLevel2: 1, maxClubs: 3, maxJobs: 1 },
  courses: [
    { id: 'R1', code: 'GEN 101', name: 'Fisiologías', required: true, blocks: [{ day: 1, start: 540, end: 630 }, { day: 3, start: 540, end: 630 }] },
    { id: 'E1', code: 'LOR 105', name: 'Cartografía', blocks: [{ day: 1, start: 600, end: 690 }] },
    { id: 'E2', code: 'WIT 125', name: 'Plaga', level2: true, blocks: [{ day: 4, start: 840, end: 930 }] }
  ],
  clubs: [{ id: 'C1', name: 'Horticultura', skills: ['Nature', 'Survival'], blocks: [{ day: 7, start: 540, end: 720 }], events: [{ day: 9, text: 'Excursiones' }] }],
  teams: [{ id: 'T1', name: 'Mage Tower · Witherbloom', blocks: [{ day: 7, start: 1080, end: 1230 }] }],
  jobs: [{ id: 'J1', name: 'Biblioplex', shifts: [{ id: 's1', label: 'Tarde', day: 2, start: 1080, end: 1170 }, { id: 's2', label: 'Guardia', day: 9 }] }]
});
const pc = (): Character => {
  const c = { ...blankCharacter(), ruleset: '2024' as const };
  c.strixhaven = { ...c.strixhaven, enabled: true };
  return c;
};

describe('horario de Strixhaven con catálogo', () => {
  it('suma las obligatorias, detecta choques y arma el texto del horario', () => {
    const c = pc();
    c.strixhaven.schedule.electives = ['E1'];
    const { timed } = scheduleOf(c, cat);
    expect(timed.map((x) => x.label)).toEqual(['GEN 101', 'LOR 105', 'GEN 101']);
    expect(clashes(timed)).toHaveLength(1);
    expect(whenText(cat.courses[0].blocks, days)).toBe('Lunes y Arcanes · 9:00–10:30');
    expect(tally(c, cat, days).warnings[0]).toContain('Choque el Lunes');
  });
  it('clubes, equipo y trabajo: Student Dice, turnos sin hora y beca', () => {
    const c = pc();
    c.strixhaven.schedule = { ...c.strixhaven.schedule, electives: ['E2'], clubs: ['C1'], team: 'T1', job: 'J1', shifts: ['s1', 's2'] };
    syncFromSchedule(c, cat);
    expect(c.strixhaven.extracurriculars).toEqual(['Horticultura', 'Mage Tower · Witherbloom']);
    expect(studentDice(c, cat).map((d) => d.skills.join(','))).toEqual(['Nature,Survival']);
    const { notes } = scheduleOf(c, cat);
    expect(notes.map((n) => n.text)).toEqual(['Excursiones', 'Guardia (hora a convenir)']);
    const tl = tally(c, cat, days);
    expect(tl.clubs).toBe(2);
    expect(tl.warnings.some((w) => w.includes('beca'))).toBe(true);
    expect(scheduleRows(c, cat, days).map((r) => r.kind)).toEqual(['Obligatoria', 'Optativa', 'Club', 'Mage Tower', 'Trabajo']);
  });
});

describe('fechas del calendario (meses de 30 días)', () => {
  it('11 de septiembre es la semana 1, día 1; el cierre de altas cae el 8 de octubre', async () => {
    const { CampaignSchema, dateOf } = await import('../model/campaign');
    const k = CampaignSchema.parse({ id: 'x', calendar: { start: { day: 11, month: 9, year: 4565 } } });
    expect(dateOf(k.calendar, 1, 1)?.label).toBe('11 de septiembre');
    expect(dateOf(k.calendar, 1, 4)?.label).toBe('14 de septiembre');
    expect(dateOf(k.calendar, 3, 8)?.label).toBe('8 de octubre');
    expect(dateOf(k.calendar, 8, 10)?.label).toBe('30 de noviembre');
  });
});
