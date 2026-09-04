/**
 * Aktuality z RSS kanálu `?5`.
 *
 * Proti běžnému kanálu `?1` nese navíc pole `wh_authorname` (autor) a `wh_path`
 * (rubrika). Kanál `?4` „Tiskové zprávy" je dlouhodobě prázdný, takže se nepoužívá.
 */
import { XMLParser } from 'fast-xml-parser';
import type { Article, SourceRef } from '@kladno/schema';
import { decodeEntities, stripHtml } from '../lib/text.js';

export const NEWS_URL = 'https://www.mestokladno.cz/rss/?5';

const xml = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true });

type RawItem = {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string | { '#text'?: string };
  wh_authorname?: string;
  wh_path?: string;
};

export function parseNews(content: string, fetchedAt: string): Article[] {
  const parsed: unknown = xml.parse(content);
  const items = toArray(
    (parsed as { rss?: { channel?: { item?: RawItem | RawItem[] } } }).rss?.channel?.item,
  );
  if (items.length === 0) {
    throw new Error('Kanál ?5 nevrátil žádné aktuality — změnila se struktura zdroje');
  }

  const source: SourceRef = {
    name: 'Aktuality města Kladna',
    url: 'https://www.mestokladno.cz/aktuality/ds-901',
    license: 'Obsah © Statutární město Kladno, aplikace odkazuje na originál',
    fetchedAt,
  };

  const articles: Article[] = [];
  for (const item of items) {
    const title = item.title ? decodeEntities(String(item.title)).trim() : null;
    const link = item.link ? decodeEntities(String(item.link)).trim() : null;
    if (!title || !link) continue;

    const guid = typeof item.guid === 'object' ? item.guid['#text'] : item.guid;
    const id = guid ? String(guid) : (/\bid=(\d+)/.exec(link)?.[1] ?? link);
    const published = item.pubDate ? new Date(String(item.pubDate)) : null;
    if (!published || Number.isNaN(published.getTime())) continue;

    const perex = item.description ? stripHtml(String(item.description)) : '';

    articles.push({
      id,
      title,
      perex: perex.length > 0 ? perex : null,
      publishedAt: published.toISOString(),
      author: item.wh_authorname ? decodeEntities(String(item.wh_authorname)).trim() : null,
      section: item.wh_path ? decodeEntities(String(item.wh_path)).trim() : null,
      detailUrl: link,
      source,
    });
  }

  articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
  return articles;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
