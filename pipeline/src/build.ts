/**
 * Orchestrace pipeline: stáhnout zdroje → normalizovat → validovat → zapsat do data/v1/.
 *
 * Kostra. Skutečné zdroje se doplní ve fázi 1 podle docs/PLAN.md — až bude
 * odsouhlasený plán a rozhodnutá otázka robots.txt z docs/PRAVNI.md.
 */
import { DATA_VERSION } from '@kladno/schema';

export function main(): void {
  console.log(`pipeline: kostra, datový kontrakt ${DATA_VERSION}, zatím bez zdrojů`);
}

main();
