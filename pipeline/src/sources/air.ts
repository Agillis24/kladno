/**
 * Kvalita ovzduší ze stanic ČHMÚ.
 *
 * V Kladně jsou v provozu dvě stanice, ne čtyři, jak uvádělo zadání
 * (docs/ZDROJE.md, kap. 8.1). Data jsou ve dvou souborech: metadata popisují
 * stanice a jejich měřicí programy, hodinové CSV nese naměřené hodnoty
 * pod číselným `IdRegistration`.
 *
 * Nejcennější veličina je `INDX` — hotový index kvality ovzduší 1 až 6,
 * který se dá rovnou ukázat na hlavní obrazovce.
 */
import type { AirStation, SourceRef } from '@kladno/schema';
import { parseCsv } from './ruian.js';

export const AIR_DATA_URL =
  'https://opendata.chmi.cz/air_quality/now/data/airquality_1h_avg_CZ.csv';
export const AIR_METADATA_URL =
  'https://opendata.chmi.cz/air_quality/now/metadata/metadata.json';

/** Kódy kladenských stanic v síti ČHMÚ. */
export const KLADNO_STATIONS = ['SKLM', 'SKLS'] as const;

/** Slovní popis indexu kvality ovzduší podle metodiky ČHMÚ. */
const INDEX_LABELS: Record<number, string> = {
  1: 'velmi dobrá',
  2: 'dobrá',
  3: 'normální',
  4: 'zhoršená',
  5: 'špatná',
  6: 'velmi špatná',
};

type Measurement = {
  IdRegistration?: number;
  ComponentCode?: string;
  ComponentName?: string;
  Unit?: string;
};
type MeasuringProgram = { Measurements?: Measurement[] };
type Locality = {
  LocalityCode?: string;
  Name?: string;
  Active?: boolean;
  Localization?: { LatAsNumber?: number; LonAsNumber?: number };
  MeasuringPrograms?: MeasuringProgram[];
};

/** Naměřená hodnota z hodinového CSV, klíčem je `IdRegistration`. */
export function parseAirValues(csv: string): Map<string, { value: number; at: string }> {
  const rows = parseCsv(csv, ',');
  const values = new Map<string, { value: number; at: string }>();
  for (const row of rows.slice(1)) {
    const id = row[0]?.trim();
    const at = row[1]?.trim();
    const value = Number(row[3]?.trim());
    if (!id || !at || !Number.isFinite(value)) continue;
    const parsedAt = new Date(at);
    if (Number.isNaN(parsedAt.getTime())) continue;
    values.set(id, { value, at: parsedAt.toISOString() });
  }
  return values;
}

export function parseAirStations(
  metadataJson: string,
  values: Map<string, { value: number; at: string }>,
  fetchedAt: string,
): AirStation[] {
  const parsed: unknown = JSON.parse(metadataJson);
  const localities = (parsed as { data?: { Localities?: Locality[] } }).data?.Localities;
  if (!Array.isArray(localities)) {
    throw new Error('Metadata ČHMÚ nemají pole Localities — změnila se struktura zdroje');
  }

  const source: SourceRef = {
    name: 'Kvalita ovzduší, ČHMÚ',
    url: 'https://opendata.chmi.cz/air_quality/',
    license: 'CC BY 4.0, Český hydrometeorologický ústav',
    fetchedAt,
  };

  const stations: AirStation[] = [];
  for (const code of KLADNO_STATIONS) {
    const locality = localities.find((item) => item.LocalityCode === code);
    if (!locality) continue;

    const lat = locality.Localization?.LatAsNumber;
    const lng = locality.Localization?.LonAsNumber;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;

    const measurements: AirStation['measurements'] = [];
    let index: number | null = null;

    for (const program of locality.MeasuringPrograms ?? []) {
      for (const measurement of program.Measurements ?? []) {
        const id = measurement.IdRegistration;
        const componentCode = measurement.ComponentCode;
        if (id === undefined || !componentCode) continue;

        const reading = values.get(String(id));
        if (componentCode === 'INDX') {
          index = reading ? Math.round(reading.value) : null;
          continue;
        }
        measurements.push({
          code: componentCode,
          name: measurement.ComponentName ?? componentCode,
          value: reading?.value ?? null,
          unit: measurement.Unit ?? null,
          measuredAt: reading?.at ?? null,
        });
      }
    }

    const validIndex = index !== null && index >= 1 && index <= 6 ? index : null;
    stations.push({
      code,
      name: locality.Name ?? code,
      geo: { lat, lng },
      index: validIndex,
      indexLabel: validIndex === null ? null : (INDEX_LABELS[validIndex] ?? null),
      measurements,
      source,
    });
  }

  if (stations.length === 0) {
    throw new Error('V metadatech ČHMÚ nejsou kladenské stanice — změnil se zdroj');
  }
  return stations;
}
