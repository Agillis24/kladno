import { z } from 'zod';

/** Verze datového kontraktu mezi pipeline a aplikací. */
export const DATA_VERSION = 'v1' as const;

/** ISO 8601 okamžik, například 2026-09-04T08:00:00.000Z. */
export const isoDateTime = z.iso.datetime();

/** Kalendářní den bez času, například 2026-09-04. */
export const isoDate = z.iso.date();

/**
 * Odkaz na původní zdroj. Povinný u každé položky — aplikace je průvodce,
 * ne náhrada úředního zdroje, a u všeho musí umět otevřít originál.
 */
export const sourceRefSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
  license: z.string().min(1),
  fetchedAt: isoDateTime,
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

/** Souřadnice WGS84. */
export const geoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Geo = z.infer<typeof geoSchema>;

/** Příloha dokumentu. Soubory nekopírujeme, jen na ně odkazujeme. */
export const attachmentSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
  mime: z.string().optional(),
  sizeKb: z.number().nonnegative().optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;
