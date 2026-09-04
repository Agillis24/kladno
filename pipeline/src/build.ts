/**
 * Orchestrace pipeline: stáhnout zdroje → normalizovat → ověřit → zapsat do data/v1/.
 *
 * Dvě zásady, na kterých stojí spolehlivost:
 *
 *  1. Selhání jednoho zdroje neshodí ostatní. Když se rozbije scraper uzavírek,
 *     úřední deska se aktualizuje dál a u uzavírek zůstane předchozí verze
 *     označená jako zastaralá.
 *  2. Nikdy nepublikovat prázdno. Data, která propadnou o víc než 40 %, se
 *     zahodí a nechá se to, co v repozitáři je (lib/guard.ts).
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  airFileSchema,
  articleFileSchema,
  boardFileSchema,
  contactFileSchema,
  districtFileSchema,
  eventFileSchema,
  noticeFileSchema,
  placeFileSchema,
  streetFileSchema,
  type DatasetEntry,
  type Street,
} from '@kladno/schema';
import { fetchText, fetchUrl } from './lib/http.js';
import { DATA_DIR, staleEntry, writeDataset, writeManifest, type WriteOutcome } from './lib/output.js';
import { isPathAllowed, parseRobots, type RobotsRules } from './lib/robots.js';
import { AIR_DATA_URL, AIR_METADATA_URL, parseAirStations, parseAirValues } from './sources/air.js';
import { FEED_URL, OFN_URL, parseFeedBoard, parseOfnBoard } from './sources/board.js';
import {
  DEPARTMENTS_INDEX_URL,
  parseDepartment,
  parseDepartmentLinks,
} from './sources/contacts.js';
import { EVENTS_URL, parseEvents } from './sources/events.js';
import { NEWS_URL, parseNews } from './sources/news.js';
import {
  buildDistricts,
  buildStreets,
  parseAddressPoints,
  recentSnapshotDates,
  ruianUrl,
  unpackRuianCsv,
} from './sources/ruian.js';
import { parseTraffic, TRAFFIC_URL } from './sources/traffic.js';
import { parseWasteYards, WASTE_URL } from './sources/waste.js';
import { mergeBoard } from './normalize/board.js';

const ROBOTS_URL = 'https://www.mestokladno.cz/robots.txt';

/** Kolik odborů se smí projít v jednom běhu. Stránky jsou stabilní, spěch není. */
const MAX_DEPARTMENTS = 40;

type Problem = { dataset: string; message: string };

const entries: Record<string, DatasetEntry> = {};
const problems: Problem[] = [];
const outcomes: WriteOutcome[] = [];

/**
 * Zpracuje jeden dataset a odchytí jeho chyby.
 *
 * Když krok selže, zapíše se důvod a v manifestu se dataset označí jako zastaralý.
 * Běh pokračuje dál.
 */
async function step(name: string, file: string, run: () => Promise<WriteOutcome>): Promise<void> {
  try {
    const outcome = await run();
    outcomes.push(outcome);
    if (!outcome.published && outcome.reason) problems.push({ dataset: name, message: outcome.reason });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    problems.push({ dataset: name, message });
    entries[name] = await staleEntry(name, file, message, entries);
    outcomes.push({ name, file, published: false, count: 0, reason: message });
  }
}

async function loadRobots(): Promise<RobotsRules> {
  try {
    const { text } = await fetchText(ROBOTS_URL);
    return parseRobots(text);
  } catch {
    // Když se robots.txt nepodaří stáhnout, držíme se posledního známého stavu:
    // jmenovité zákazy z webu města k 3. 9. 2026.
    return {
      disallowedPaths: [
        '/VismoOnline_ActionScripts/CaptchaImage.aspx',
        '/VismoOnline_ActionScripts/Image.aspx',
        '/vismo/ZaslatEmailem.asp',
        '/vismo/galerie3.asp',
        '/vismo/navstevnost.asp',
        '/aa/',
        '/AA/',
      ],
      hasBlanketBlock: true,
    };
  }
}

/** Ověří, že cesta není jmenovitě zakázaná (plošný Disallow ignorujeme, viz lib/robots.ts). */
function ensureAllowed(rules: RobotsRules, url: string): void {
  if (!isPathAllowed(rules, url)) {
    throw new Error(`robots.txt jmenovitě zakazuje ${url}`);
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log('Pipeline „Moje Kladno" — start', new Date().toISOString());

  const robots = await loadRobots();
  console.log(
    `robots.txt: ${robots.disallowedPaths.length} jmenovitých zákazů` +
      `${robots.hasBlanketBlock ? ', plošný Disallow (vědomě přeskočen, viz docs/PRAVNI.md)' : ''}`,
  );

  // Ulice se načtou první — potřebují je uzavírky i sběrné dvory.
  let streets: Street[] = [];

  await step('streets', 'streets.json', async () => {
    const { csv, fetchedAt } = await fetchRuian();
    const points = parseAddressPoints(csv);
    streets = buildStreets(points);
    const districts = buildDistricts(points);

    await writeDataset(
      'districts',
      'districts.json',
      districts,
      districtFileSchema,
      entries,
      fetchedAt,
    );
    return writeDataset('streets', 'streets.json', streets, streetFileSchema, entries, fetchedAt);
  });

  await step('board', 'board.json', async () => {
    ensureAllowed(robots, OFN_URL);
    ensureAllowed(robots, FEED_URL);
    const ofn = await fetchText(OFN_URL, { accept: 'application/ld+json, application/json' });
    const feed = await fetchText(FEED_URL, { accept: 'application/xml, text/xml' });
    const items = mergeBoard(parseOfnBoard(ofn.text), parseFeedBoard(feed.text), ofn.fetchedAt);
    return writeDataset('board', 'board.json', items, boardFileSchema, entries, ofn.fetchedAt);
  });

  await step('events', 'events.json', async () => {
    ensureAllowed(robots, EVENTS_URL);
    const { text, fetchedAt } = await fetchText(EVENTS_URL, { accept: 'application/xml, text/xml' });
    const events = parseEvents(text, fetchedAt);
    return writeDataset('events', 'events.json', events, eventFileSchema, entries, fetchedAt);
  });

  await step('news', 'news.json', async () => {
    ensureAllowed(robots, NEWS_URL);
    const { text, fetchedAt } = await fetchText(NEWS_URL, { accept: 'application/rss+xml' });
    const news = parseNews(text, fetchedAt);
    return writeDataset('news', 'news.json', news, articleFileSchema, entries, fetchedAt);
  });

  await step('air', 'air.json', async () => {
    const meta = await fetchText(AIR_METADATA_URL, { accept: 'application/json' });
    const data = await fetchText(AIR_DATA_URL, { accept: 'text/csv' });
    const stations = parseAirStations(meta.text, parseAirValues(data.text), data.fetchedAt);
    return writeDataset('air', 'air.json', stations, airFileSchema, entries, data.fetchedAt);
  });

  await step('traffic', 'traffic.json', async () => {
    ensureAllowed(robots, TRAFFIC_URL);
    const { text, fetchedAt } = await fetchText(TRAFFIC_URL, { accept: 'text/html' });
    const notices = parseTraffic(text, streets, fetchedAt);
    return writeDataset('traffic', 'traffic.json', notices, noticeFileSchema, entries, fetchedAt);
  });

  await step('waste', 'waste.json', async () => {
    ensureAllowed(robots, WASTE_URL);
    const { text, fetchedAt } = await fetchText(WASTE_URL, { accept: 'text/html' });
    const places = parseWasteYards(text, streets, fetchedAt);
    return writeDataset('waste', 'waste.json', places, placeFileSchema, entries, fetchedAt);
  });

  await step('contacts', 'contacts.json', async () => {
    ensureAllowed(robots, DEPARTMENTS_INDEX_URL);
    const index = await fetchText(DEPARTMENTS_INDEX_URL, { accept: 'text/html' });
    const links = parseDepartmentLinks(index.text).slice(0, MAX_DEPARTMENTS);
    console.log(`  kontakty: ${links.length} odborů z rozcestníku`);

    const contacts = [];
    for (const url of links) {
      if (!isPathAllowed(robots, url)) continue;
      try {
        const page = await fetchText(url, { accept: 'text/html' });
        const contact = parseDepartment(page.text, url, page.fetchedAt);
        if (contact) contacts.push(contact);
      } catch (error) {
        // Jeden nedostupný odbor nesmí shodit celý číselník kontaktů.
        console.warn(`  kontakty: ${url} přeskočen (${(error as Error).message})`);
      }
    }
    return writeDataset(
      'contacts',
      'contacts.json',
      contacts,
      contactFileSchema,
      entries,
      index.fetchedAt,
    );
  });

  await writeManifest(entries);
  await writeFile(
    join(DATA_DIR, '..', '..', 'pipeline-problems.json'),
    `${JSON.stringify(problems, null, 1)}\n`,
    'utf8',
  );

  report(startedAt);
}

/** RÚIAN publikuje snapshot k poslednímu dni měsíce, ale ne hned — zkusíme i starší. */
async function fetchRuian(): Promise<{ csv: string; fetchedAt: string }> {
  const errors: string[] = [];
  for (const date of recentSnapshotDates(new Date())) {
    try {
      const result = await fetchUrl(ruianUrl(date), { accept: 'application/zip' });
      return { csv: unpackRuianCsv(result.body), fetchedAt: result.fetchedAt };
    } catch (error) {
      errors.push(`${date}: ${(error as Error).message}`);
    }
  }
  throw new Error(`RÚIAN nedostupný pro žádný z posledních snapshotů — ${errors.join('; ')}`);
}

function report(startedAt: number): void {
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\nHotovo za ${seconds} s`);
  for (const outcome of outcomes) {
    const status = outcome.published ? 'zapsáno' : 'PONECHÁNO STARÉ';
    console.log(`  ${outcome.name.padEnd(10)} ${String(outcome.count).padStart(5)}  ${status}`);
  }
  if (problems.length > 0) {
    console.log(`\n${problems.length} problém(ů):`);
    for (const problem of problems) console.log(`  ${problem.dataset}: ${problem.message}`);
  }
}

await main();
