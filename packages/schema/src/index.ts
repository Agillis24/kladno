/**
 * Kanonický datový model aplikace „Moje Kladno".
 *
 * Obrazovky aplikace nikdy nevědí, ze kterého zdroje data pocházejí — pipeline
 * všechny zdroje převádí na tyto typy. Zod schémata a validace přibudou ve fázi 1
 * podle docs/PLAN.md; dokud není plán odsouhlasen, drží tenhle soubor jen tvar modelu.
 */

/** Odkaz na původní zdroj. Povinný u každé položky — aplikace vždy odkazuje na originál. */
export type SourceRef = {
  name: string;
  url: string;
  license: string;
  /** ISO 8601 */
  fetchedAt: string;
};

/** Verze datového kontraktu mezi pipeline a aplikací. */
export const DATA_VERSION = 'v1' as const;
