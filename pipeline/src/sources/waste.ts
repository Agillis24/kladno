/**
 * Sběrné dvory.
 *
 * Město je uvádí v tabulkách — jedna tabulka na dvůr:
 *
 *   <table>
 *     <tr><th colspan="2">Sběrný dvůr Smečenská 381, Kladno Rozdělov<br><b>606 765 663</b></th></tr>
 *     <tr><td>Pondělí</td><td>8:00 - 17:00</td></tr>
 *     …
 *   </table>
 *
 * Souřadnice v tabulce nejsou, ale adresa začíná názvem ulice — dohledáme ho
 * v číselníku z RÚIAN a použijeme těžiště ulice. Není to přesná poloha vrátnice,
 * ale na „kde to zhruba je" to stačí a nic lepšího z veřejných zdrojů není.
 */
import * as cheerio from 'cheerio';
import type { Place, SourceRef, Street } from '@kladno/schema';
import { collapse, normalize } from '../lib/text.js';

export const WASTE_URL =
  'https://www.mestokladno.cz/sberne-dvory-a-mobilni-sberne-dvory/ds-200618';

const DAYS = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle'];

export function parseWasteYards(html: string, streets: Street[], fetchedAt: string): Place[] {
  const $ = cheerio.load(html);
  const main = $('#hlobsah');
  if (main.length === 0) {
    throw new Error('Stránka sběrných dvorů nemá blok #hlobsah — změnila se struktura');
  }

  const source: SourceRef = {
    name: 'Sběrné dvory města Kladna',
    url: WASTE_URL,
    license: 'Obsah © Statutární město Kladno, aplikace odkazuje na originál',
    fetchedAt,
  };

  const places: Place[] = [];

  main.find('table').each((_, table) => {
    const $table = $(table);
    const heading = collapse($table.find('th').first().text());
    if (!/^Sběrný dvůr\s+\S/.test(heading)) return;

    // Za názvem bývá poznámka v závorce a telefon, do adresy nepatří ani jedno.
    const withoutPhone = heading.replace(/\+?\d[\d ]{7,}/g, '').trim();
    const address = withoutPhone.replace(/^Sběrný dvůr\s+/, '').split('(')[0]!.trim();
    if (!address) return;

    places.push({
      id: `sd-${slug(address)}`,
      name: `Sběrný dvůr ${address}`,
      kind: 'sberny-dvur',
      geo: locate(address, streets),
      address,
      openingHours: collectHours($, $table),
      phone: /(\+?\d[\d ]{7,})/.exec(heading)?.[1]?.trim() ?? null,
      url: WASTE_URL,
      source,
    });
  });

  if (places.length === 0) {
    throw new Error('Na stránce sběrných dvorů nejsou žádné dvory — změnila se struktura');
  }
  return places;
}

/** Posbírá řádky tabulky ve tvaru „den | čas". */
function collectHours($: cheerio.CheerioAPI, table: ReturnType<cheerio.CheerioAPI>): string | null {
  const parts: string[] = [];

  table.find('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 2) return;
    const day = collapse($(cells[0]!).text()).toLowerCase();
    const time = collapse($(cells[1]!).text());
    if (!DAYS.includes(day)) return;
    if (!/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(time)) return;
    parts.push(`${capitalize(day)} ${time.replace(/\s*-\s*/, '–')}`);
  });

  return parts.length > 0 ? parts.join(', ') : null;
}

/** Zkusí najít ulici z adresy v číselníku RÚIAN a vrátit její těžiště. */
function locate(address: string, streets: Street[]): Place['geo'] {
  const normalized = normalize(address);
  const best = streets
    .filter((street) => normalized.startsWith(street.normalized))
    .sort((a, b) => b.normalized.length - a.normalized.length)[0];
  return best ? best.center : null;
}

function slug(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}


function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
