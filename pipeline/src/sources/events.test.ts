import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { eventFileSchema } from '@kladno/schema';
import { parseEvents } from './events.js';
import { parseNews } from './news.js';
import { FIXTURES } from '../lib/fixtures.js';

const FETCHED_AT = '2026-09-03T21:00:00.000Z';
const eventsRaw = readFileSync(join(FIXTURES, 'rss6-akce-2026-09-03.xml'), 'utf8');
const newsRaw = readFileSync(join(FIXTURES, 'rss5-aktuality-2026-09-03.xml'), 'utf8');

describe('kalendář akcí (kanál ?6)', () => {
  const events = parseEvents(eventsRaw, FETCHED_AT);

  it('přečte 28 akcí ze snímku z 3. 9. 2026', () => {
    expect(events).toHaveLength(28);
    expect(eventFileSchema.parse(events)).toHaveLength(28);
  });

  it('spojí datum a čas do pražského času', () => {
    const concert = events.find((event) => event.title.startsWith('Charitativní koncert'));
    expect(concert).toBeDefined();
    // 2. 10. 2026 v 18:00 letního času je 16:00 UTC.
    expect(concert?.startsAt).toBe('2026-10-02T16:00:00.000Z');
    expect(concert?.endsAt).toBe('2026-10-02T19:00:00.000Z');
    expect(concert?.allDay).toBe(false);
  });

  it('označí akce bez času jako celodenní — takových je polovina', () => {
    const allDay = events.filter((event) => event.allDay);
    expect(allDay.length).toBeGreaterThan(10);
    const chess = events.find((event) => event.title.includes('Šachový kroužek'));
    expect(chess?.allDay).toBe(true);
  });

  it('vezme místo jako volný text a souřadnice nechá prázdné', () => {
    const chess = events.find((event) => event.title.includes('Šachový kroužek'));
    expect(chess?.venue).toBe('ŠK Kladno, Na Kovárně 567, Kladno');
    expect(chess?.geo).toBeNull();
  });

  it('nepustí do popisu HTML z Wordu', () => {
    const withHtml = events.filter(
      (event) => event.description?.includes('<') || event.description?.includes('mso-'),
    );
    expect(withHtml).toHaveLength(0);
  });

  it('řadí podle začátku', () => {
    const starts = events.map((event) => event.startsAt);
    expect([...starts].sort()).toEqual(starts);
  });

  it('pozná, že zdroj přestal vracet akce', () => {
    expect(() => parseEvents('<events></events>', FETCHED_AT)).toThrow(/nevrátil/);
  });
});

describe('aktuality (kanál ?5)', () => {
  const news = parseNews(newsRaw, FETCHED_AT);

  it('přečte 50 aktualit', () => {
    expect(news).toHaveLength(50);
  });

  it('vezme autora a rubriku z polí wh_*, kvůli kterým tenhle kanál používáme', () => {
    expect(news.some((article) => article.author !== null)).toBe(true);
    expect(news.some((article) => article.section !== null)).toBe(true);
  });

  it('řadí od nejnovější', () => {
    const dates = news.map((article) => article.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('pozná, že zdroj přestal vracet položky', () => {
    expect(() => parseNews('<rss><channel></channel></rss>', FETCHED_AT)).toThrow(/nevrátil/);
  });
});
