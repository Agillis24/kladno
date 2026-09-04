import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boardFileSchema } from '@kladno/schema';
import { documentIdFromUrl, parseFeedBoard, parseOfnBoard } from './board.js';
import { activeBoardItems, mergeBoard } from '../normalize/board.js';
import { FIXTURES } from '../lib/fixtures.js';

const ofnRaw = readFileSync(join(FIXTURES, 'ofn-uredni-deska-2026-09-03.json'), 'utf8');
const feedRaw = readFileSync(join(FIXTURES, 'rss9-uredni-deska-2026-09-03.xml'), 'utf8');
const FETCHED_AT = '2026-09-03T21:00:00.000Z';

describe('OFN úřední deska', () => {
  const records = parseOfnBoard(ofnRaw);

  it('přečte všech 114 záznamů ze snímku z 3. 9. 2026', () => {
    expect(records).toHaveLength(114);
  });

  it('opraví &amp; v URL příloh — město ho posílá u 113 ze 114 záznamů', () => {
    const broken = records.filter((record) =>
      record.attachments.some((attachment) => attachment.url.includes('&amp;')),
    );
    expect(broken).toHaveLength(0);

    const first = records.find((record) => record.id === '1513126');
    expect(first?.attachments[0]?.url).toBe(
      'https://www.mestokladno.cz/assets/File.ashx?id_org=6506&id_dokumenty=1513127',
    );
  });

  it('má lhůtu jen u části záznamů — u 47 z nich je „nespecifikovaný"', () => {
    expect(records.filter((record) => record.postedTo !== null)).toHaveLength(67);
    expect(records.filter((record) => record.postedTo === null)).toHaveLength(47);
    expect(records.filter((record) => record.refNumber !== null)).toHaveLength(10);
    expect(records.filter((record) => record.fileNumber !== null)).toHaveLength(1);
  });

  it('vytáhne ID dokumentu z adresy detailu', () => {
    expect(documentIdFromUrl('https://www.mestokladno.cz/neco/d-1513126')).toBe('1513126');
    expect(documentIdFromUrl('https://www.mestokladno.cz/neco/ds-901')).toBeNull();
  });
});

describe('XML kanál ?9', () => {
  const records = parseFeedBoard(feedRaw);

  it('přečte 114 záznamů', () => {
    expect(records).toHaveLength(114);
  });

  it('má kategorii u všech záznamů — to je důvod, proč ho vůbec stahujeme', () => {
    expect(records.every((record) => record.category !== null)).toBe(true);
    expect(new Set(records.map((record) => record.category)).size).toBe(19);
  });

  it('nese celou cestu složkou', () => {
    const item = records.find((record) => record.id === '1513124');
    expect(item?.categoryPath).toBe(
      'Základní dokumenty Města / Písemnosti doručované veřejnou vyhláškou / ' +
        'Písemnosti doručované veřejnou vyhláškou - Odbor životního prostředí',
    );
  });
});

describe('spojení obou zdrojů', () => {
  const items = mergeBoard(parseOfnBoard(ofnRaw), parseFeedBoard(feedRaw), FETCHED_AT);

  it('dá 114 položek — obě sady pokrývají stejné dokumenty', () => {
    expect(items).toHaveLength(114);
    expect(boardFileSchema.parse(items)).toHaveLength(114);
  });

  it('doplní kategorii z kanálu 9 a lhůtu z OFN', () => {
    const item = items.find((entry) => entry.id === '1513126');
    expect(item?.category).toBe('Písemnosti mimokladenských institucí');
    expect(item?.postedTo).toBe('2026-10-07');
    expect(item?.postedFrom).toBe('2026-09-03');
  });

  it('nenechá žádnou položku bez kategorie', () => {
    expect(items.filter((item) => item.category === null)).toHaveLength(0);
  });

  it('řadí od nejnovějšího', () => {
    const dates = items.map((item) => item.postedFrom);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('vynechá dokumenty po lhůtě, ale ponechá ty bez ní', () => {
    const active = activeBoardItems(items, '2026-09-04');
    expect(active.length).toBeGreaterThan(0);
    expect(active.length).toBeLessThan(items.length);
    expect(active.every((item) => item.postedTo === null || item.postedTo >= '2026-09-04')).toBe(
      true,
    );
  });
});

describe('odolnost proti změně zdroje', () => {
  it('pozná, že OFN feed přestal mít pole informace', () => {
    expect(() => parseOfnBoard('{"typ":"Úřední deska"}')).toThrow(/informace/);
  });

  it('pozná, že kanál 9 vrátil prázdno', () => {
    expect(() => parseFeedBoard('<ud></ud>')).toThrow(/nevrátil/);
  });
});
