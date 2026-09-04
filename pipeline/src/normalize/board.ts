/** Spojení dvou zdrojů úřední desky do kanonického modelu. */
import type { BoardItem, SourceRef } from '@kladno/schema';
import type { FeedRecord, OfnRecord } from '../sources/board.js';

const LICENSE = 'Otevřená data podle OFN, Statutární město Kladno';
const SOURCE_NAME = 'Úřední deska města Kladna';

/**
 * Spojí OFN a kanál 9 přes ID dokumentu.
 *
 * OFN je vedoucí zdroj: je registrovaný v Národním katalogu otevřených dat
 * a má lhůtu u všech záznamů. Kanál 9 doplňuje složku a použije se jako
 * záložní zdroj tam, kde OFN mlčí. Dokumenty, které jsou jen v kanálu 9,
 * se přidávají také — deska se mění během dne a feedy se generují každý zvlášť.
 */
export function mergeBoard(
  ofn: OfnRecord[],
  feed: FeedRecord[],
  fetchedAt: string,
): BoardItem[] {
  const byId = new Map<string, FeedRecord>();
  for (const record of feed) byId.set(record.id, record);

  const source: SourceRef = {
    name: SOURCE_NAME,
    url: 'https://www.mestokladno.cz/uredni-deska/',
    license: LICENSE,
    fetchedAt,
  };

  const items: BoardItem[] = [];
  const seen = new Set<string>();

  for (const record of ofn) {
    const extra = byId.get(record.id);
    seen.add(record.id);
    items.push({
      id: record.id,
      title: record.title,
      category: extra?.category ?? null,
      categoryPath: extra?.categoryPath ?? null,
      postedFrom: record.postedFrom,
      // OFN u 47 ze 114 záznamů uvádí `nespecifikovaný: true` místo data —
      // konec vyvěšení prostě není znám (typicky volební dokumenty).
      postedTo: record.postedTo ?? extra?.postedTo ?? null,
      refNumber: record.refNumber,
      fileNumber: record.fileNumber,
      detailUrl: record.detailUrl,
      // OFN dává přílohy pod /assets/, kanál 9 pod /VismoOnline_ActionScripts/.
      // Držíme se OFN — je to kratší cesta mimo oblast, kterou robots.txt jmenovitě zakazuje.
      attachments: record.attachments.length > 0 ? record.attachments : (extra?.attachments ?? []),
      source,
    });
  }

  for (const record of feed) {
    if (seen.has(record.id) || !record.postedFrom) continue;
    items.push({
      id: record.id,
      title: record.title,
      category: record.category,
      categoryPath: record.categoryPath,
      postedFrom: record.postedFrom,
      postedTo: record.postedTo,
      refNumber: null,
      fileNumber: null,
      detailUrl: `https://www.mestokladno.cz/vismo/dokumenty2.asp?id=${record.id}`,
      attachments: record.attachments,
      source,
    });
  }

  // Nejnovější nahoře; při shodě data rozhoduje ID, ať je pořadí stabilní mezi běhy.
  items.sort((a, b) => b.postedFrom.localeCompare(a.postedFrom) || Number(b.id) - Number(a.id));
  return items;
}

/**
 * Dokumenty, které mají být ve výpisech.
 *
 * Po uplynutí lhůty dokument z běžných výpisů mizí (docs/PRAVNI.md, kap. 3.1).
 * Záznamy bez lhůty ponecháváme — město u nich sejmutí neuvedlo.
 */
export function activeBoardItems(items: BoardItem[], today: string): BoardItem[] {
  return items.filter((item) => item.postedTo === null || item.postedTo >= today);
}
