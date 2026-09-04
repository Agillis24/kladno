/**
 * Kalendář akcí z XML kanálu `?6`.
 *
 * Zadání tvrdilo, že strojový export akcí neexistuje a bude se muset scrapovat.
 * Existuje (docs/ZDROJE.md, kap. 5.1) — a je v něm datum, čas, místo i odkaz
 * na detail. Souřadnice v něm nejsou, `place` je volný text.
 */
import { XMLParser } from 'fast-xml-parser';
import type { EventItem, SourceRef } from '@kladno/schema';
import { decodeEntities, stripHtml, toIsoDateTime } from '../lib/text.js';

export const EVENTS_URL = 'https://www.mestokladno.cz/rss/?6';

const xml = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true });

type RawDate = { start_date?: string; start_time?: string; end_date?: string; end_time?: string };
type RawEvent = {
  id?: string;
  name?: string;
  description?: string;
  dates?: { date?: RawDate | RawDate[] };
  place?: { other?: string; name?: string };
  organizer?: { name?: string };
  types?: { type?: string | string[] };
  details?: { url?: string };
};

export function parseEvents(content: string, fetchedAt: string): EventItem[] {
  const parsed: unknown = xml.parse(content);
  const raw = toArray((parsed as { events?: { event?: RawEvent | RawEvent[] } }).events?.event);
  if (raw.length === 0) {
    throw new Error('Kanál ?6 nevrátil žádné akce — změnila se struktura zdroje');
  }

  const source: SourceRef = {
    name: 'Kalendář akcí města Kladna',
    url: 'https://www.mestokladno.cz/ap',
    license: 'Obsah © Statutární město Kladno, aplikace odkazuje na originál',
    fetchedAt,
  };

  const events: EventItem[] = [];
  for (const item of raw) {
    const id = item.id ? String(item.id) : null;
    const title = item.name ? decodeEntities(String(item.name)).trim() : null;
    const date = toArray(item.dates?.date)[0];
    if (!id || !title || !date?.start_date) continue;

    // Čas chybí u poloviny akcí — bez něj je akce celodenní.
    const allDay = !date.start_time;
    const startsAt = toIsoDateTime(date.start_date, date.start_time ?? null);
    const endsAt = date.end_date
      ? toIsoDateTime(date.end_date, date.end_time ?? (allDay ? null : date.start_time))
      : null;

    const detailUrl = item.details?.url ? String(item.details.url).trim() : null;

    events.push({
      id,
      title,
      // `description` je čistý text. Pole `note` je HTML vyexportované z Wordu
      // (MsoNormal, mso-themecolor) — do MVP ho záměrně nebereme.
      description: item.description ? stripHtml(String(item.description)) || null : null,
      startsAt,
      endsAt: endsAt && endsAt >= startsAt ? endsAt : null,
      allDay,
      venue: pickVenue(item),
      organizer: item.organizer?.name ? decodeEntities(String(item.organizer.name)).trim() : null,
      geo: null,
      category: pickCategory(item),
      detailUrl: detailUrl && /^https?:\/\//.test(detailUrl) ? detailUrl : null,
      source,
    });
  }

  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  return events;
}

function pickVenue(item: RawEvent): string | null {
  const value = item.place?.other ?? item.place?.name;
  if (!value) return null;
  const text = decodeEntities(String(value)).trim();
  return text.length > 0 ? text : null;
}

function pickCategory(item: RawEvent): string | null {
  const type = toArray(item.types?.type)[0];
  if (!type) return null;
  const text = decodeEntities(String(type)).trim();
  return text.length > 0 ? text : null;
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
