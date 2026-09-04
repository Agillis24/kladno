/**
 * Ochrana proti publikaci rozbitých dat.
 *
 * Když město změní web nebo feed, scraper typicky nespadne — jen vrátí prázdno
 * nebo pár položek. To je horší než chyba, protože se to tiše rozšíří do aplikací.
 * Proto se každý nový výstup porovná s tím, co v `data/v1/` už leží, a při
 * podezřelém propadu se nová data zahodí a nechá se předchozí verze.
 */

/** Práh propadu, při kterém data nepublikujeme. */
export const DROP_THRESHOLD = 0.4;

export type GuardVerdict =
  | { publish: true; reason: null }
  | { publish: false; reason: string };

/**
 * Rozhodne, jestli se smí nový výstup zapsat.
 *
 * @param name    název datasetu, jen pro hlášku
 * @param next    počet položek, které jsme právě získali
 * @param previous počet položek z minulého běhu, nebo null když ještě žádná data nejsou
 */
export function checkDatasetSize(
  name: string,
  next: number,
  previous: number | null,
): GuardVerdict {
  // První běh: nemáme s čím porovnávat, ale prázdný dataset stejně nedává smysl.
  if (previous === null) {
    return next > 0
      ? { publish: true, reason: null }
      : { publish: false, reason: `${name}: první běh vrátil nula položek` };
  }

  if (previous > 0 && next === 0) {
    return {
      publish: false,
      reason: `${name}: zdroj vrátil nula položek, minule jich bylo ${previous}`,
    };
  }

  if (previous > 0) {
    const drop = (previous - next) / previous;
    if (drop > DROP_THRESHOLD) {
      const percent = Math.round(drop * 100);
      return {
        publish: false,
        reason: `${name}: počet položek klesl o ${percent} % (${previous} → ${next}), práh je ${Math.round(
          DROP_THRESHOLD * 100,
        )} %`,
      };
    }
  }

  return { publish: true, reason: null };
}
