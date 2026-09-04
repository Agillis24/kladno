import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { airFileSchema } from '@kladno/schema';
import { parseAirStations, parseAirValues } from './air.js';
import { FIXTURES } from '../lib/fixtures.js';

const FETCHED_AT = '2026-09-03T21:00:00.000Z';
const csv = readFileSync(join(FIXTURES, 'chmi-ovzdusi-2026-09-03.csv'), 'utf8');
const metadata = readFileSync(join(FIXTURES, 'chmi-metadata-kladno-2026-09-03.json'), 'utf8');

describe('ovzduší ČHMÚ', () => {
  const values = parseAirValues(csv);
  const stations = parseAirStations(metadata, values, FETCHED_AT);

  it('najde obě kladenské stanice — ne čtyři, jak uvádělo zadání', () => {
    expect(stations.map((station) => station.code)).toEqual(['SKLM', 'SKLS']);
    expect(airFileSchema.parse(stations)).toHaveLength(2);
  });

  it('zná polohu stanic', () => {
    const central = stations.find((station) => station.code === 'SKLM');
    expect(central?.geo.lat).toBeCloseTo(50.1439, 3);
    expect(central?.geo.lng).toBeCloseTo(14.1018, 3);
  });

  it('spáruje naměřené hodnoty přes IdRegistration', () => {
    const central = stations.find((station) => station.code === 'SKLM');
    const ozone = central?.measurements.find((measurement) => measurement.code === 'O3');
    expect(ozone?.value).toBe(69);

    const svermov = stations.find((station) => station.code === 'SKLS');
    expect(svermov?.measurements.find((m) => m.code === 'NO2')?.value).toBe(3.3);
  });

  it('vytáhne index kvality ovzduší a přeloží ho do slov', () => {
    for (const station of stations) {
      expect(station.index).toBe(2);
      expect(station.indexLabel).toBe('dobrá');
    }
  });

  it('nedává index mezi běžné veličiny', () => {
    for (const station of stations) {
      expect(station.measurements.some((measurement) => measurement.code === 'INDX')).toBe(false);
    }
  });

  it('zvládne chybějící měření — stanice může být zrovna mimo provoz', () => {
    const empty = parseAirStations(metadata, new Map(), FETCHED_AT);
    expect(empty).toHaveLength(2);
    expect(empty[0]?.index).toBeNull();
    expect(empty[0]?.measurements.every((measurement) => measurement.value === null)).toBe(true);
    expect(airFileSchema.parse(empty)).toHaveLength(2);
  });

  it('pozná, že se změnila struktura metadat', () => {
    expect(() => parseAirStations('{"data":{}}', values, FETCHED_AT)).toThrow(/Localities/);
  });

  it('pozná, že v metadatech zmizely kladenské stanice', () => {
    expect(() => parseAirStations('{"data":{"Localities":[]}}', values, FETCHED_AT)).toThrow(
      /kladenské stanice/,
    );
  });
});
