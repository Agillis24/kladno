import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Adresář s uloženými vzorky vstupů.
 *
 * Každý scraper se testuje proti reálnému snímku staženému v den ověření.
 * Když město změní web nebo formát feedu, testy padnou a je hned vidět kde —
 * to je jediná obrana proti tichému rozpadu pipeline.
 */
export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures');
