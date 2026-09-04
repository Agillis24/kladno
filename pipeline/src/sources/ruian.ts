/**
 * Ulice a části města z RÚIAN.
 *
 * Zdrojem je měsíční CSV adresních míst pro obec Kladno (kód 532053, ověřeno
 * v ARES). Pozor na dvě pasti: soubor je v kódování windows-1250 a souřadnice
 * jsou v S-JTSK, ne ve WGS84.
 *
 * Číselník ulic je základ personalizace — podle něj se v textech uzavírek
 * hledají názvy ulic a z něj si uživatel vybírá „svoji" ulici.
 */
import { unzipSync } from 'fflate';
import iconv from 'iconv-lite';
import proj4 from 'proj4';
import type { District, Geo, Street } from '@kladno/schema';
import { normalize } from '../lib/text.js';

/** Kód obce Kladno v RÚIAN. */
export const KLADNO_MUNICIPALITY_CODE = '532053';

/**
 * S-JTSK (Křovákovo zobrazení, EPSG:5514).
 *
 * RÚIAN uvádí souřadnice jako kladná čísla, ale definice očekává záporné —
 * proto se při převodu obě otáčejí.
 */
const SJTSK =
  '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813972222222 ' +
  '+k=0.9999 +x_0=0 +y_0=0 +ellps=bessel ' +
  '+towgs84=589,76,480,0,0,0,0 +units=m +no_defs';

/** Převede souřadnice z RÚIAN na WGS84. */
export function sjtskToWgs84(y: number, x: number): Geo {
  const [lng, lat] = proj4(SJTSK, 'EPSG:4326', [-Math.abs(y), -Math.abs(x)]);
  return { lat: round6(lat as number), lng: round6(lng as number) };
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** URL měsíčního CSV pro Kladno. `date` je poslední den měsíce ve tvaru RRRRMMDD. */
export function ruianUrl(date: string): string {
  return `https://vdp.cuzk.cz/vymenny_format/csv/${date}_OB_${KLADNO_MUNICIPALITY_CODE}_ADR.csv.zip`;
}

/**
 * Poslední dny několika posledních měsíců, od nejnovějšího.
 *
 * ČÚZK zveřejňuje snapshot k poslednímu dni měsíce, ale ne hned první den
 * následujícího — proto se zkouší i starší měsíce.
 */
export function recentSnapshotDates(now: Date, count = 3): string[] {
  const dates: string[] = [];
  for (let back = 0; back < count; back++) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 0));
    const year = day.getUTCFullYear();
    const month = String(day.getUTCMonth() + 1).padStart(2, '0');
    dates.push(`${year}${month}${String(day.getUTCDate()).padStart(2, '0')}`);
  }
  return dates;
}

export type AddressPoint = {
  streetCode: string;
  streetName: string;
  districtCode: string;
  districtName: string;
  geo: Geo;
};

/** Rozbalí ZIP z ČÚZK a vrátí obsah CSV jako text. */
export function unpackRuianCsv(zip: Buffer): string {
  const files = unzipSync(new Uint8Array(zip));
  const name = Object.keys(files).find((file) => file.toLowerCase().endsWith('.csv'));
  if (!name) throw new Error('Archiv z ČÚZK neobsahuje CSV — změnila se struktura zdroje');
  return decodeRuianCsv(Buffer.from(files[name] as Uint8Array));
}

/** RÚIAN posílá CSV ve windows-1250. V UTF-8 by se rozsypala diakritika. */
export function decodeRuianCsv(content: Buffer): string {
  return iconv.decode(content, 'win1250');
}

export function parseAddressPoints(csv: string): AddressPoint[] {
  const rows = parseCsv(csv, ';');
  const header = rows[0];
  if (!header) throw new Error('RÚIAN CSV je prázdné');

  const index = {
    streetCode: header.indexOf('Kód ulice'),
    streetName: header.indexOf('Název ulice'),
    districtCode: header.indexOf('Kód části obce'),
    districtName: header.indexOf('Název části obce'),
    y: header.indexOf('Souřadnice Y'),
    x: header.indexOf('Souřadnice X'),
  };
  for (const [key, value] of Object.entries(index)) {
    if (value < 0) throw new Error(`RÚIAN CSV nemá sloupec pro „${key}" — změnil se formát`);
  }

  const points: AddressPoint[] = [];
  for (const row of rows.slice(1)) {
    const streetName = row[index.streetName]?.trim();
    const districtName = row[index.districtName]?.trim();
    const y = Number(row[index.y]);
    const x = Number(row[index.x]);
    // Adresy bez ulice (185 z 9 716) mají jen číslo popisné — do číselníku ulic nepatří.
    if (!streetName || !districtName || !Number.isFinite(y) || !Number.isFinite(x)) continue;

    points.push({
      streetCode: row[index.streetCode]?.trim() ?? '',
      streetName,
      districtCode: row[index.districtCode]?.trim() ?? '',
      districtName,
      geo: sjtskToWgs84(y, x),
    });
  }
  return points;
}

/** Sloučí adresní místa do číselníku ulic s těžištěm a obálkou. */
export function buildStreets(points: AddressPoint[]): Street[] {
  const groups = new Map<string, AddressPoint[]>();
  for (const point of points) {
    const key = point.streetCode || point.streetName;
    const bucket = groups.get(key);
    if (bucket) bucket.push(point);
    else groups.set(key, [point]);
  }

  const streets: Street[] = [];
  for (const [key, group] of groups) {
    const first = group[0];
    if (!first) continue;
    const lats = group.map((point) => point.geo.lat);
    const lngs = group.map((point) => point.geo.lng);

    streets.push({
      id: /^\d+$/.test(key) ? key : String(hashToId(key)),
      name: first.streetName,
      normalized: normalize(first.streetName),
      districts: [...new Set(group.map((point) => point.districtName))].sort(),
      center: { lat: round6(average(lats)), lng: round6(average(lngs)) },
      bbox: [Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)],
      addressCount: group.length,
    });
  }

  streets.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  return streets;
}

/**
 * Části obce podle RÚIAN.
 *
 * Kladno jich má šest. Zadání uvádělo jedenáct, ale Dříň, Sítná, Hnidousy,
 * Motyčín a Ostrovec jsou lidové názvy lokalit, ne úřední části obce
 * (docs/ZDROJE.md, kap. 9).
 */
export function buildDistricts(points: AddressPoint[]): District[] {
  const groups = new Map<string, AddressPoint[]>();
  for (const point of points) {
    const bucket = groups.get(point.districtName);
    if (bucket) bucket.push(point);
    else groups.set(point.districtName, [point]);
  }

  const districts: District[] = [];
  for (const [name, group] of groups) {
    const first = group[0];
    if (!first) continue;
    districts.push({
      id: /^\d+$/.test(first.districtCode) ? first.districtCode : String(hashToId(name)),
      name,
      normalized: normalize(name),
      center: {
        lat: round6(average(group.map((point) => point.geo.lat))),
        lng: round6(average(group.map((point) => point.geo.lng))),
      },
      addressCount: group.length,
    });
  }

  districts.sort((a, b) => b.addressCount - a.addressCount);
  return districts;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Náhradní číselné ID pro případ, že by zdroj kód neuvedl. */
function hashToId(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.codePointAt(0)!) % 100_000_000;
  return hash;
}

/** Minimální CSV parser, který zvládá uvozovky. */
export function parseCsv(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (quoted) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}
