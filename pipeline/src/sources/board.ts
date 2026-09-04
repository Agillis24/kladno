/**
 * Úřední deska ze dvou zdrojů města.
 *
 * Ani jeden zdroj sám o sobě nestačí (docs/ZDROJE.md, kap. 3):
 *  - OFN JSON-LD má spisové údaje a u dokumentů bez konce vyvěšení poctivě
 *    uvádí `nespecifikovaný: true` (47 ze 114), ale nezná složku;
 *  - XML kanál `?9` složku má u všech záznamů, konec vyvěšení u stejných 67.
 *
 * Obě sady obsahují stejných 114 dokumentů, takže se spojí přes ID.
 */
import { XMLParser } from 'fast-xml-parser';
import { decodeEntities } from '../lib/text.js';

export const OFN_URL = 'https://www.mestokladno.cz/opendata-uredni-deska';
export const FEED_URL = 'https://www.mestokladno.cz/rss/?9';

/** Jeden dokument tak, jak ho podává OFN feed. */
export type OfnRecord = {
  id: string;
  title: string;
  postedFrom: string;
  postedTo: string | null;
  refNumber: string | null;
  fileNumber: string | null;
  detailUrl: string;
  attachments: { name: string; url: string }[];
};

/** Jeden dokument tak, jak ho podává XML kanál 9. */
export type FeedRecord = {
  id: string;
  title: string;
  category: string | null;
  categoryPath: string | null;
  postedFrom: string | null;
  postedTo: string | null;
  attachments: { name: string; url: string }[];
};

type OfnDocument = {
  'název'?: { cs?: string };
  url?: string;
};

type OfnInformation = {
  url?: string;
  iri?: string;
  'název'?: { cs?: string };
  'vyvěšení'?: { datum?: string };
  'relevantní_do'?: { datum?: string } | null;
  'číslo_jednací'?: string;
  'spisová_značka'?: string;
  dokument?: OfnDocument | OfnDocument[];
};

/** Vytáhne číselné ID dokumentu z URL tvaru `/slug/d-1513126`. */
export function documentIdFromUrl(url: string): string | null {
  return /\/d-(\d+)(?:[/?#]|$)/.exec(url)?.[1] ?? null;
}

export function parseOfnBoard(json: string): OfnRecord[] {
  const parsed: unknown = JSON.parse(json);
  const informace = (parsed as { informace?: OfnInformation[] }).informace;
  if (!Array.isArray(informace)) {
    throw new Error('OFN feed nemá pole „informace" — změnila se struktura zdroje');
  }

  const records: OfnRecord[] = [];
  for (const item of informace) {
    const url = item.url ?? item.iri;
    const title = item['název']?.cs;
    const postedFrom = item['vyvěšení']?.datum;
    if (!url || !title || !postedFrom) continue;

    const id = documentIdFromUrl(url);
    if (!id) continue;

    const documents = toArray(item.dokument);
    records.push({
      id,
      title: decodeEntities(title).trim(),
      postedFrom,
      postedTo: item['relevantní_do']?.datum ?? null,
      refNumber: item['číslo_jednací'] ?? null,
      fileNumber: item['spisová_značka'] ?? null,
      // Město tu má `&amp;` i v JSONu, u 113 ze 114 záznamů.
      detailUrl: decodeEntities(url),
      attachments: documents
        .filter((doc) => doc.url)
        .map((doc) => ({
          name: decodeEntities(doc['název']?.cs ?? 'Příloha').trim(),
          url: decodeEntities(doc.url as string),
        })),
    });
  }
  return records;
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,
  trimValues: true,
});

type Feed9Attachment = { ID?: string; URL?: string; NAME?: string };
type Feed9Item = {
  '@id'?: string;
  NAZEV?: string;
  TYP?: string;
  TYPCESTA?: string;
  VYVESENO?: string;
  STAZENO?: string;
  PRILOHY?: { item?: Feed9Attachment | Feed9Attachment[] };
};

export function parseFeedBoard(content: string): FeedRecord[] {
  const parsed: unknown = xml.parse(content);
  const items = toArray((parsed as { ud?: { item?: Feed9Item | Feed9Item[] } }).ud?.item);
  if (items.length === 0) {
    throw new Error('Kanál ?9 nevrátil žádné položky — změnila se struktura zdroje');
  }

  const records: FeedRecord[] = [];
  for (const item of items) {
    const id = item['@id'];
    const title = item.NAZEV;
    if (!id || !title) continue;

    records.push({
      id: String(id),
      title: decodeEntities(String(title)).trim(),
      category: item.TYP ? decodeEntities(item.TYP).trim() : null,
      categoryPath: item.TYPCESTA ? decodeEntities(item.TYPCESTA).trim() : null,
      // Prázdný tag <STAZENO></STAZENO> dá parseru prázdný řetězec, ne undefined —
      // proto `||`, jinak by se prázdno protlačilo dál jako neplatné datum.
      postedFrom: item.VYVESENO || null,
      postedTo: item.STAZENO || null,
      attachments: toArray(item.PRILOHY?.item)
        .filter((att) => att.URL)
        .map((att) => ({
          name: decodeEntities(String(att.NAME ?? 'Příloha')).trim(),
          url: decodeEntities(String(att.URL)),
        })),
    });
  }
  return records;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
