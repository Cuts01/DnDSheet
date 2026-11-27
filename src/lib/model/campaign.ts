import { z } from 'zod';

/* Arcavios tiene semanas de 10 días; los nombres son editables (el libro no los nombra). */
export const DEFAULT_DAY_NAMES = Array.from({ length: 10 }, (_, i) => `Día ${i + 1}`);

export const CampaignEventSchema = z.object({
  id: z.string(),
  week: z.number().int().min(1),
  day: z.number().int().min(1).max(10),
  title: z.string().max(200).default(''),
  notes: z.string().max(2000).default('')
});
export type CampaignEvent = z.infer<typeof CampaignEventSchema>;

/* ---------- Catálogo de la campaña (lo que reparte el DM: cursos, clubes, equipos, trabajos) ---------- */
const str = (max = 2000) => z.string().max(max).default('');
/* Bloque de horario: día 1-10 y minutos desde las 0:00 (end puede pasar de 1440: madrugada). */
export const BlockSchema = z.object({ day: z.number().int().min(1).max(10), start: z.number().int().min(0), end: z.number().int().min(0) });
export type Block = z.infer<typeof BlockSchema>;
const DayEventSchema = z.object({ day: z.number().int().min(1).max(10), text: str(200) });

export const CatalogCourseSchema = z.object({
  id: z.string(),
  code: str(20),
  name: str(200),
  college: str(60),
  required: z.boolean().default(false),
  level2: z.boolean().default(false).describe('Nivel 2.º año: cuenta para el límite maxLevel2'),
  desc: str(),
  room: str(200),
  prof: str(200),
  blocks: z.array(BlockSchema).default([])
});
export const CatalogClubSchema = z.object({
  id: z.string(),
  name: str(200),
  category: str(80),
  when: str(300),
  where: str(300),
  sponsor: str(300),
  skills: z.array(z.string().max(80)).default([]).describe('Habilidades del Student Die'),
  desc: str(),
  president: str(200),
  vice: str(200),
  yearEvent: str(500),
  blocks: z.array(BlockSchema).default([]),
  events: z.array(DayEventSchema).default([])
});
export const CatalogTeamSchema = z.object({
  id: z.string(),
  name: str(200),
  college: str(60),
  when: str(300),
  coach: str(300),
  mascot: str(200),
  captain: str(200),
  vice: str(200),
  desc: str(),
  blocks: z.array(BlockSchema).default([]),
  events: z.array(DayEventSchema).default([])
});
export const ShiftSchema = z.object({
  id: z.string(),
  label: str(80),
  day: z.number().int().min(1).max(10),
  start: z.number().int().min(0).nullable().default(null).describe('null: hora a convenir'),
  end: z.number().int().min(0).nullable().default(null)
});
export const CatalogJobSchema = z.object({
  id: z.string(),
  name: str(200),
  desc: str(),
  positions: z.array(z.string().max(120)).default([]),
  boss: str(300),
  when: str(300),
  shifts: z.array(ShiftSchema).default([])
});
export const CatalogRulesSchema = z.object({
  minElectives: z.number().int().min(0).default(1),
  maxElectives: z.number().int().min(0).default(3),
  maxLevel2: z.number().int().min(0).default(1),
  maxClubs: z.number().int().min(0).default(2),
  maxJobs: z.number().int().min(0).default(1),
  teamCountsAsClub: z.boolean().default(true),
  jobUsesClubSlot: z.boolean().default(false).describe('Regla del libro: dos clubes, o un club y un trabajo'),
  scholarshipReplacesJob: z.boolean().default(true),
  pay: str(80)
});
export type CatalogRules = z.infer<typeof CatalogRulesSchema>;
export const CatalogSchema = z.object({
  dayTypes: z.array(z.string().max(30)).length(10).default(['', '', '', '', '', '', '', '', '', '']),
  rules: CatalogRulesSchema.default(() => CatalogRulesSchema.parse({})),
  courses: z.array(CatalogCourseSchema).default([]),
  clubs: z.array(CatalogClubSchema).default([]),
  teams: z.array(CatalogTeamSchema).default([]),
  jobs: z.array(CatalogJobSchema).default([]),
  guide: z.array(z.object({ title: str(120), text: str(6000) })).default([])
});
export type Catalog = z.infer<typeof CatalogSchema>;
export type CatalogCourse = z.infer<typeof CatalogCourseSchema>;
export type CatalogClub = z.infer<typeof CatalogClubSchema>;
export type CatalogTeam = z.infer<typeof CatalogTeamSchema>;
export type CatalogJob = z.infer<typeof CatalogJobSchema>;
export type Shift = z.infer<typeof ShiftSchema>;

/*
 * Campaña: datos compartidos por los PJs que juegan en ella.
 * Lo personal del PJ (college, relationships, sus clases de Strixhaven) sigue en el personaje.
 */
export const CampaignSchema = z.object({
  id: z.string(),
  name: z.string().max(120).default(''),
  dm: z.string().max(120).default(''),
  notes: z.string().max(8000).default('').describe('Detalles y house rules'),
  strixhaven: z.boolean().default(false),
  calendar: z
    .object({
      dayNames: z.array(z.string().max(40)).length(10).default(DEFAULT_DAY_NAMES),
      term: z.string().max(80).default('').describe('Ej. Year 1, Fall term'),
      week: z.number().int().min(1).default(1),
      day: z.number().int().min(1).max(10).default(1)
    })
    .default(() => ({ dayNames: DEFAULT_DAY_NAMES, term: '', week: 1, day: 1 })),
  events: z.array(CampaignEventSchema).default([]),
  catalog: CatalogSchema.nullable().default(null),
  updatedAt: z.string().default('')
});
export type Campaign = z.infer<typeof CampaignSchema>;

export const blankCampaign = (id: string, name = ''): Campaign => CampaignSchema.parse({ id, name });

/* Archivo para compartir una campaña (con su catálogo) e importarla en otra app. */
export const CampaignFileSchema = z.object({
  format: z.literal('dndsheet-campaign'),
  version: z.number().int(),
  campaign: CampaignSchema
});
