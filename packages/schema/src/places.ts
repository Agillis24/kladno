import { z } from 'zod';
import { geoSchema, isoDateTime, sourceRefSchema } from './common.js';

/** Sběrný dvůr, kontejner, úřad, sportoviště — cokoli, co má místo na mapě. */
export const placeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  geo: geoSchema.nullable(),
  address: z.string().nullable(),
  openingHours: z.string().nullable(),
  phone: z.string().nullable(),
  url: z.url().nullable(),
  source: sourceRefSchema,
});
export type Place = z.infer<typeof placeSchema>;

/**
 * Kontakt na odbor nebo pracoviště magistrátu.
 *
 * Přebíráme jen pracovní kontakt v rozsahu, v jakém ho město zveřejňuje.
 * Žádné spojování osob napříč dokumenty, žádný rejstřík osob — viz docs/PRAVNI.md.
 */
export const contactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  department: z.string().nullable(),
  role: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.email().nullable(),
  building: z.string().nullable(),
  officeHours: z.string().nullable(),
  detailUrl: z.url(),
  source: sourceRefSchema,
});
export type Contact = z.infer<typeof contactSchema>;

/**
 * Ulice z RÚIAN. Slouží k rozpoznávání ulic v textech uzavírek a úřední desky
 * a k výběru „mojí ulice" v aplikaci.
 */
export const streetSchema = z.object({
  /** Kód ulice v RÚIAN. */
  id: z.string().regex(/^\d+$/),
  name: z.string().min(1),
  /** Název bez diakritiky a malými písmeny — klíč pro hledání v textu. */
  normalized: z.string().min(1),
  /** Části obce, ve kterých ulice leží. Některé ulice zasahují do více částí. */
  districts: z.array(z.string()).min(1),
  /** Těžiště adresních míst ulice. */
  center: geoSchema,
  /** [minLat, minLng, maxLat, maxLng] */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  addressCount: z.number().int().positive(),
});
export type Street = z.infer<typeof streetSchema>;

/** Úřední část obce. Kladno jich má šest, ne jedenáct — viz docs/ZDROJE.md, kap. 9. */
export const districtSchema = z.object({
  id: z.string().regex(/^\d+$/),
  name: z.string().min(1),
  normalized: z.string().min(1),
  center: geoSchema,
  addressCount: z.number().int().positive(),
});
export type District = z.infer<typeof districtSchema>;

/** Naměřená hodnota jedné veličiny na jedné stanici. */
export const airMeasurementSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  measuredAt: isoDateTime.nullable(),
});

/** Stanice ČHMÚ. V Kladně jsou v provozu dvě: SKLM a SKLS. */
export const airStationSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  geo: geoSchema,
  /** Index kvality ovzduší 1–6, nebo null když stanice zrovna neměří. */
  index: z.number().int().min(1).max(6).nullable(),
  indexLabel: z.string().nullable(),
  measurements: z.array(airMeasurementSchema),
  source: sourceRefSchema,
});
export type AirStation = z.infer<typeof airStationSchema>;

export const placeFileSchema = z.array(placeSchema);
export const contactFileSchema = z.array(contactSchema);
export const streetFileSchema = z.array(streetSchema);
export const districtFileSchema = z.array(districtSchema);
export const airFileSchema = z.array(airStationSchema);
