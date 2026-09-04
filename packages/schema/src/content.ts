import { z } from 'zod';
import { geoSchema, isoDateTime, sourceRefSchema } from './common.js';

/** Aktualita nebo tisková zpráva. */
export const articleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  perex: z.string().nullable(),
  publishedAt: isoDateTime,
  author: z.string().nullable(),
  /** Rubrika z pole `wh_path` kanálu `?5`. */
  section: z.string().nullable(),
  detailUrl: z.url(),
  source: sourceRefSchema,
});
export type Article = z.infer<typeof articleSchema>;

/**
 * Kulturní, sportovní nebo jiná akce.
 *
 * Zdrojem je XML kanál `?6`. Souřadnice v něm nejsou, `venue` je volný text
 * (například „ŠK Kladno, Na Kovárně 567") — geokódování až ve fázi 4.
 */
export const eventItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable(),
  startsAt: isoDateTime,
  endsAt: isoDateTime.nullable(),
  /** True, když zdroj neuvedl čas — akce se pak zobrazuje jako celodenní. */
  allDay: z.boolean(),
  venue: z.string().nullable(),
  organizer: z.string().nullable(),
  geo: geoSchema.nullable(),
  category: z.string().nullable(),
  detailUrl: z.url().nullable(),
  source: sourceRefSchema,
});
export type EventItem = z.infer<typeof eventItemSchema>;

/** Druh události, na kterou aplikace upozorňuje. */
export const noticeKindSchema = z.enum([
  'traffic',
  'water',
  'electricity',
  'heat',
  'cleaning',
  'waste',
  'weather',
  'air',
  'other',
]);
export type NoticeKind = z.infer<typeof noticeKindSchema>;

export const noticeSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type NoticeSeverity = z.infer<typeof noticeSeveritySchema>;

/** Uzavírka, odstávka, čištění, výstraha — všechno „něco se děje". */
export const noticeSchema = z.object({
  id: z.string().min(1),
  kind: noticeKindSchema,
  severity: noticeSeveritySchema,
  title: z.string().min(1),
  description: z.string().nullable(),
  validFrom: isoDateTime,
  validTo: isoDateTime.nullable(),
  /** Názvy ulic rozpoznané v textu. Porovnává se proti číselníku z RÚIAN. */
  streets: z.array(z.string()),
  geo: geoSchema.nullable(),
  detailUrl: z.url().nullable(),
  source: sourceRefSchema,
});
export type Notice = z.infer<typeof noticeSchema>;

export const articleFileSchema = z.array(articleSchema);
export const eventFileSchema = z.array(eventItemSchema);
export const noticeFileSchema = z.array(noticeSchema);
