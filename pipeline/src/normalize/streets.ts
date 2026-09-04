/**
 * Rozpoznávání názvů ulic ve volném textu.
 *
 * Tohle je jádro personalizace: podle něj aplikace pozná, že se uzavírka týká
 * „mojí" ulice. Text uzavírek je psaný lidmi a vypadá třeba takto:
 *
 *   „…v úseku – od čp. 433 ul. M. Horákové k propojce u OD Tesco mezi
 *    ul. Americká a M. Horákové."
 *
 * Past jsou obecné názvy. Kladno má ulice Dlouhá, Horní, Lesní, Stará, Úzká
 * a náměstí Práce — a věta „Práce jsou ve finální fázi" pak označí uzavírku
 * jako týkající se náměstí Práce. Proto platí dvě pravidla, odvozená z toho,
 * jak zdroj skutečně píše:
 *
 *  1. **Jednoslovný název musí být uvozený** slovem „ulice", „ul.", „náměstí"
 *     a podobně. V reálných textech uzavírek to tak vždy je („ul. Kladenská",
 *     „ul. Tyršova", „ul. Na Vyhaslém"), takže se tím nic neztrácí.
 *  2. **Víceslovný název stačí sám o sobě** — „Milady Horákové" nebo
 *     „náměstí Svobody" nemá jak vzniknout náhodou.
 *
 * Radši ulici neoznačit, než poslat člověku upozornění na místo, se kterým
 * nemá nic společného.
 */
import type { Street } from '@kladno/schema';
import { normalize } from '../lib/text.js';

/** Slova, po kterých následuje název ulice. */
const PREFIXES = [
  'ulice',
  'ulici',
  'ulic',
  'ul',
  'trida',
  'tride',
  'tridy',
  'namesti',
  'nam',
  'nabrezi',
];

export type StreetMatch = {
  id: string;
  name: string;
  /** True, když shodu potvrdil kontext („ul. X"). */
  confident: boolean;
};

/** Najde v textu názvy ulic z číselníku. */
export function findStreets(text: string, streets: Street[]): StreetMatch[] {
  const haystack = normalize(text);
  if (!haystack) return [];

  const matches = new Map<string, StreetMatch>();

  for (const street of streets) {
    const needle = street.normalized;
    if (needle.length < 3) continue;

    const withContext = hasContextMatch(haystack, needle);
    // Jednoslovné názvy bez uvození nepřijímáme — viz komentář nahoře.
    const multiWord = needle.includes(' ');
    const bare = multiWord && hasWordMatch(haystack, needle);
    if (!withContext && !bare) continue;

    const existing = matches.get(street.id);
    if (!existing || (withContext && !existing.confident)) {
      matches.set(street.id, { id: street.id, name: street.name, confident: withContext });
    }
  }

  // Delší název vyhrává: u „Milady Horákové" nechceme vypsat ještě „Horákové".
  const result = [...matches.values()];
  return result
    .filter(
      (match) =>
        !result.some(
          (other) =>
            other !== match &&
            other.name.length > match.name.length &&
            normalize(other.name).includes(normalize(match.name)),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}

/** Shoda na hranicích slov, aby „lesni" nechytilo „lesnicky". */
function hasWordMatch(haystack: string, needle: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 ? ' ' : haystack[at - 1]!;
    const after = haystack[at + needle.length] ?? ' ';
    if (isBoundary(before) && isBoundary(after)) return true;
    from = at + 1;
  }
}

/**
 * Shoda uvozená slovem „ulice", „ul." a podobně.
 *
 * Zvládá i zkrácené křestní jméno: zdroj píše „ul. M. Horákové" tam, kde
 * číselník má „Milady Horákové".
 */
function hasContextMatch(haystack: string, needle: string): boolean {
  const shortened = shortenFirstWord(needle);

  for (const prefix of PREFIXES) {
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(prefix, from);
      if (at < 0) break;
      from = at + 1;

      const before = at === 0 ? ' ' : haystack[at - 1]!;
      if (!isBoundary(before)) continue;

      // Mezi „ul." a názvem bývá tečka, mezera nebo obojí.
      const rest = haystack.slice(at + prefix.length).replace(/^[.\s]+/, '');
      for (const candidate of shortened ? [needle, shortened] : [needle]) {
        if (!rest.startsWith(candidate)) continue;
        const after = rest[candidate.length] ?? ' ';
        if (isBoundary(after)) return true;
      }
    }
  }
  return false;
}

/** „milady horakove" → „m. horakove". Null, když název není víceslovný. */
function shortenFirstWord(needle: string): string | null {
  const space = needle.indexOf(' ');
  if (space < 1) return null;
  const initial = needle[0];
  return initial ? `${initial}.${needle.slice(space)}` : null;
}

function isBoundary(char: string): boolean {
  return !/[a-z0-9]/.test(char);
}
