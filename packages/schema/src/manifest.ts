import { z } from 'zod';
import { isoDateTime } from './common.js';

/**
 * Záznam o jednom datovém souboru v manifestu.
 *
 * `stale` říká aplikaci, že data jsou starší než den a poslední aktualizace se
 * nezdařila — aplikace pak nad seznamem zobrazí nenápadný proužek místo toho,
 * aby předstírala, že je vše aktuální.
 */
export const datasetEntrySchema = z.object({
  file: z.string().min(1),
  /** SHA-256 obsahu souboru. Aplikace podle něj pozná, že se něco změnilo. */
  hash: z.string().length(64),
  count: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  /** Kdy naposledy zdroj skutečně odpověděl a data prošla kontrolou. */
  lastSuccessfulFetch: isoDateTime,
  stale: z.boolean(),
  /** Vyplněno, když poslední pokus selhal a drží se předchozí data. */
  lastError: z.string().nullable(),
});
export type DatasetEntry = z.infer<typeof datasetEntrySchema>;

/** `index.json` — jediný soubor, který aplikace musí stáhnout, aby věděla, co je nového. */
export const manifestSchema = z.object({
  version: z.literal('v1'),
  generatedAt: isoDateTime,
  datasets: z.record(z.string(), datasetEntrySchema),
});
export type Manifest = z.infer<typeof manifestSchema>;
