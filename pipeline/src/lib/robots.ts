/**
 * Vyhodnocení `robots.txt`.
 *
 * Zadavatel 4. 9. 2026 rozhodl, že plošný `Disallow: /` na webu města
 * nerespektujeme — je to generický soubor dodavatele CMS z roku 2011, který
 * blokuje i vlastní otevřená data města (docs/PRAVNI.md, kap. 1).
 *
 * Konkrétní zákazy ale platí dál, a to **ze všech skupin**, ne jen ze skupiny
 * pro `*`. Na webu města jsou totiž jmenovité zákazy zapsané u vyhledávačů
 * (`Disallow: /vismo/ZaslatEmailem.asp` a podobně), zatímco skupina `*` má
 * jen plošné „nechte nás být". Kdybychom četli pouze skupinu pro `*`, vyšlo
 * by z toho, že žádná konkrétní cesta zakázaná není — a přesně ty cesty, které
 * správce chránit chtěl, bychom volali. Rozdíl je věcný: `Disallow: /` je
 * plošná blokace, kdežto `Disallow: /vismo/ZaslatEmailem.asp` chrání konkrétní
 * skript, který robot nemá spouštět, ať už se jmenuje jakkoli.
 */

export type RobotsRules = {
  /** Konkrétní zakázané prefixy cest, posbírané ze všech skupin. */
  disallowedPaths: string[];
  /** True, když soubor obsahuje plošný `Disallow: /` pro `User-agent: *`. */
  hasBlanketBlock: boolean;
};

/** Rozebere `robots.txt`. */
export function parseRobots(content: string): RobotsRules {
  const disallowed = new Set<string>();
  let hasBlanketBlock = false;
  let inWildcardGroup = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;

    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'user-agent') {
      inWildcardGroup = value === '*';
      continue;
    }

    if (key !== 'disallow' || !value) continue;

    if (value === '/') {
      // Plošná blokace se počítá jen tehdy, když míří na všechny roboty.
      if (inWildcardGroup) hasBlanketBlock = true;
      continue;
    }
    disallowed.add(value);
  }

  return { disallowedPaths: [...disallowed], hasBlanketBlock };
}

/**
 * Smí pipeline stáhnout tuhle cestu?
 *
 * Plošnou blokaci ignoruje podle rozhodnutí výše, jmenovité zákazy dodržuje.
 * Porovnává se bez ohledu na velikost písmen — web města má stejnou cestu
 * uvedenou jako `/aa/` i `/AA/`.
 */
export function isPathAllowed(rules: RobotsRules, url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return !rules.disallowedPaths.some((prefix) => path.startsWith(prefix.toLowerCase()));
}
