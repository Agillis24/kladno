import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { districtFileSchema, streetFileSchema } from '@kladno/schema';
import {
  buildDistricts,
  buildStreets,
  decodeRuianCsv,
  parseAddressPoints,
  recentSnapshotDates,
  ruianUrl,
  sjtskToWgs84,
} from './ruian.js';
import { FIXTURES } from '../lib/fixtures.js';

// Vzorek reálného CSV z ČÚZK: všech 6 částí obce, 115 ulic, kódování windows-1250.
const csv = decodeRuianCsv(readFileSync(join(FIXTURES, 'ruian-kladno-2026-08-31.csv')));

describe('souřadnice', () => {
  it('převede S-JTSK na WGS84', () => {
    // Kudrnova 1, Kladno-Dubí. Ověřeno proti poloze kladenských zastávek v PID GTFS.
    const geo = sjtskToWgs84(762148.71, 1033673.43);
    expect(geo.lat).toBeCloseTo(50.1467, 3);
    expect(geo.lng).toBeCloseTo(14.1355, 3);
  });

  it('zvládne i souřadnice zapsané záporně', () => {
    expect(sjtskToWgs84(-762148.71, -1033673.43)).toEqual(sjtskToWgs84(762148.71, 1033673.43));
  });
});

describe('adresní místa', () => {
  const points = parseAddressPoints(csv);

  it('přečte CSV ve windows-1250 i s diakritikou', () => {
    expect(points.length).toBeGreaterThan(200);
    expect(points.some((point) => point.districtName === 'Kročehlavy')).toBe(true);
    expect(points.some((point) => point.streetName.includes('ř') || point.streetName.includes('á')))
      .toBe(true);
  });

  it('všechny body leží v okolí Kladna', () => {
    for (const point of points) {
      expect(point.geo.lat).toBeGreaterThan(50.05);
      expect(point.geo.lat).toBeLessThan(50.25);
      expect(point.geo.lng).toBeGreaterThan(14.0);
      expect(point.geo.lng).toBeLessThan(14.25);
    }
  });

  it('pozná, že se změnil formát CSV', () => {
    expect(() => parseAddressPoints('Sloupec A;Sloupec B\n1;2\n')).toThrow(/sloupec/);
  });
});

describe('číselník ulic', () => {
  const streets = buildStreets(parseAddressPoints(csv));

  it('sloučí adresy do ulic', () => {
    expect(streets.length).toBeGreaterThan(100);
    expect(streetFileSchema.parse(streets)).toHaveLength(streets.length);
  });

  it('u každé ulice zná těžiště, obálku i části obce', () => {
    for (const street of streets) {
      const [minLat, minLng, maxLat, maxLng] = street.bbox;
      expect(street.center.lat).toBeGreaterThanOrEqual(minLat);
      expect(street.center.lat).toBeLessThanOrEqual(maxLat);
      expect(street.center.lng).toBeGreaterThanOrEqual(minLng);
      expect(street.center.lng).toBeLessThanOrEqual(maxLng);
      expect(street.districts.length).toBeGreaterThan(0);
    }
  });

  it('normalizuje název pro hledání v textu', () => {
    const street = streets.find((entry) => entry.name === 'Kročehlavská');
    expect(street?.normalized).toBe('krocehlavska');
  });

  it('řadí česky', () => {
    const names = streets.map((street) => street.name);
    expect([...names].sort((a, b) => a.localeCompare(b, 'cs'))).toEqual(names);
  });
});

describe('části obce', () => {
  const districts = buildDistricts(parseAddressPoints(csv));

  it('najde šest úředních částí — ne jedenáct, jak uvádělo zadání', () => {
    expect(districts).toHaveLength(6);
    expect(districts.map((district) => district.name).sort((a, b) => a.localeCompare(b, 'cs')))
      .toEqual(['Dubí', 'Kladno', 'Kročehlavy', 'Rozdělov', 'Švermov', 'Vrapice']);
    expect(districtFileSchema.parse(districts)).toHaveLength(6);
  });

  it('nezná lidové názvy lokalit, protože nejsou v RÚIAN', () => {
    const names = districts.map((district) => district.name);
    for (const folk of ['Dříň', 'Sítná', 'Hnidousy', 'Motyčín', 'Ostrovec']) {
      expect(names).not.toContain(folk);
    }
  });
});

describe('adresa snímku', () => {
  it('sestaví URL pro kód obce Kladno', () => {
    expect(ruianUrl('20260831')).toBe(
      'https://vdp.cuzk.cz/vymenny_format/csv/20260831_OB_532053_ADR.csv.zip',
    );
  });

  it('nabídne poslední dny předchozích měsíců', () => {
    expect(recentSnapshotDates(new Date('2026-09-04T00:00:00Z'), 3)).toEqual([
      '20260831',
      '20260731',
      '20260630',
    ]);
  });
});
