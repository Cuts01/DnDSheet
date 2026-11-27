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
  updatedAt: z.string().default('')
});
export type Campaign = z.infer<typeof CampaignSchema>;

export const blankCampaign = (id: string, name = ''): Campaign => CampaignSchema.parse({ id, name });
