/**
 * Uzavírky a dopravní opatření ze sekce webu města.
 *
 * Jediný zdroj informací o uzavírkách v Kladně. Není strojově čitelný —
 * jde o seznam dokumentů VISMO, kde je podstatná informace ve volném textu
 * (docs/ZDROJE.md, kap. 6). Proto je to nejkřehčí scraper projektu a má
 * nejpodrobnější fixture.
 */
import type { Notice, SourceRef, Street } from '@kladno/schema';
import { parseDocumentList } from '../lib/vismo.js';
import { toIsoDateTime } from '../lib/text.js';
import { findStreets } from '../normalize/streets.js';

export const TRAFFIC_URL =
  'https://www.mestokladno.cz/uzavirky-komunikaci-a-informace-z-dopravy/ds-43821';

const WARNING_WORDS = ['uzavírka', 'uzavirka', 'zákaz', 'objízdn', 'omezení'];
const CRITICAL_WORDS = ['úplná uzavírka', 'uplna uzavirka', 'úplné uzavírce', 'úplné uzavírky'];

export function parseTraffic(html: string, streets: Street[], fetchedAt: string): Notice[] {
  const items = parseDocumentList(html);
  if (items.length === 0) {
    throw new Error('Sekce uzavírek nevrátila žádné položky — změnila se struktura stránky');
  }

  const source: SourceRef = {
    name: 'Uzavírky komunikací a informace z dopravy',
    url: TRAFFIC_URL,
    license: 'Obsah © Statutární město Kladno, aplikace odkazuje na originál',
    fetchedAt,
  };

  const notices: Notice[] = [];
  for (const item of items) {
    const text = `${item.title} ${item.description ?? ''}`;
    const validity = extractValidity(text, item.date);

    notices.push({
      id: item.id ?? slugId(item.title),
      kind: 'traffic',
      severity: severityOf(text),
      title: item.title,
      description: item.description,
      validFrom: validity.from,
      validTo: validity.to,
      streets: findStreets(text, streets).map((match) => match.name),
      geo: null,
      detailUrl: item.detailUrl,
      source,
    });
  }

  notices.sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  return notices;
}

type FoundDate = { iso: string; index: number };

/**
 * Vytáhne platnost z textu.
 *
 * Zdroj píše rozsahy různě a často nedbale:
 *   „s platností od 3.9.2026 do ukončení opravy"
 *   „v termínu od 23.06. do 30.09. 2026"   ← první datum je bez roku
 *   „celkové dokončení do 30.04. 2027"     ← žádný začátek
 *
 * Pravidla, která z toho plynou:
 *  - datum bez roku dostane rok od nejbližšího dalšího data v textu,
 *  - začátek se bere jen tehdy, když stojí za slovem „od"; jinak platí datum
 *    vyvěšení dokumentu. **Nikdy se nebere první datum v textu** — bývá to
 *    termín dokončení, ne začátek, a uzavírka by se pak tvářila, že začne
 *    za rok.
 *  - konec, který není datum („do ukončení opravy"), zůstane prázdný. Aplikace
 *    pak uzavírku zobrazí bez data ukončení, místo aby si nějaké vymyslela.
 */
export function extractValidity(
  text: string,
  fallbackDate: string | null,
): { from: string; to: string | null } {
  const dates = findDates(text, fallbackDate);
  const fromDay = findAfterKeyword(text, 'od', dates) ?? fallbackDate;
  const toDay = findAfterKeyword(text, 'do', dates);

  const from = fromDay ? toIsoDateTime(fromDay) : new Date().toISOString();
  const to = toDay && (!fromDay || toDay >= fromDay) ? toIsoDateTime(toDay) : null;
  return { from, to };
}

/**
 * Najde v textu data i v neúplném zápisu.
 *
 * Rok se doplňuje z nejbližšího následujícího úplného data — „od 23.06. do
 * 30.09. 2026" tak dá 23. 6. i 30. 9. roku 2026.
 */
function findDates(text: string, fallbackDate: string | null): FoundDate[] {
  const raw = [...text.matchAll(/(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}))?/g)].map((match) => ({
    day: Number(match[1]),
    month: Number(match[2]),
    year: match[3] ? Number(match[3]) : null,
    index: match.index ?? 0,
  }));

  const fallbackYear = fallbackDate ? Number(fallbackDate.slice(0, 4)) : new Date().getFullYear();
  const dates: FoundDate[] = [];

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i]!;
    let year = entry.year;
    if (year === null) {
      year = raw.slice(i + 1).find((next) => next.year !== null)?.year ?? fallbackYear;
    }
    const iso = `${year}-${String(entry.month).padStart(2, '0')}-${String(entry.day).padStart(2, '0')}`;
    if (!Number.isNaN(Date.parse(iso)) && entry.month >= 1 && entry.month <= 12) {
      dates.push({ iso, index: entry.index });
    }
  }
  return dates;
}

/** Najde první datum, které v textu následuje těsně po klíčovém slově. */
function findAfterKeyword(text: string, keyword: string, dates: FoundDate[]): string | null {
  const lower = text.toLowerCase();
  for (const match of lower.matchAll(new RegExp(`\\b${keyword}\\b`, 'g'))) {
    const at = match.index ?? 0;
    // Datum musí následovat těsně za slovem, ne o dvě věty dál.
    const candidate = dates.find((date) => date.index > at && date.index - at < 20);
    if (candidate) return candidate.iso;
  }
  return null;
}

function severityOf(text: string): Notice['severity'] {
  const lower = text.toLowerCase();
  if (CRITICAL_WORDS.some((word) => lower.includes(word))) return 'critical';
  if (WARNING_WORDS.some((word) => lower.includes(word))) return 'warning';
  return 'info';
}

/** Náhradní ID pro položku bez odkazu na detail. */
function slugId(title: string): string {
  let hash = 0;
  for (const char of title) hash = (hash * 31 + char.codePointAt(0)!) % 1_000_000_007;
  return `t${hash}`;
}
