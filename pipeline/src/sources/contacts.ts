/**
 * Kontakty na odbory magistrátu.
 *
 * Bereme **jen oficiální kontakt odboru** — telefon, e-mail a adresu, které
 * město uvádí jako kontakt pracoviště. Jména a přímé linky jednotlivých
 * úředníků na stránkách sice jsou, ale do aplikace je netaháme: udělal by se
 * z toho vyhledatelný rejstřík osob, což docs/PRAVNI.md výslovně vylučuje.
 * Občan navíc typicky hledá „kam zavolat", ne konkrétního člověka.
 *
 * Seznam odborů se čte z rozcestníku, ne z pevného seznamu v kódu — když
 * magistrát odbor přejmenuje nebo přidá, pipeline si toho všimne sama.
 */
import * as cheerio from 'cheerio';
import type { Contact, SourceRef } from '@kladno/schema';
import { collapse } from '../lib/text.js';
import { absoluteUrl, CITY_ORIGIN } from '../lib/vismo.js';

/** Rozcestník „Odbory magistrátu". */
export const DEPARTMENTS_INDEX_URL = 'https://www.mestokladno.cz/odbory-magistratu/os-200244';

/** Vytáhne z rozcestníku adresy jednotlivých odborů. */
export function parseDepartmentLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const main = $('#hlobsah');
  const urls = new Set<string>();

  main.find('a[href*="/os-"]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    const url = absoluteUrl(href);
    if (url.startsWith(CITY_ORIGIN) && /\/os-\d+$/.test(url)) urls.add(url);
  });

  return [...urls];
}

/**
 * Přečte kontaktní údaje ze stránky odboru.
 *
 * VISMO je drží v definičním seznamu:
 *   <dl><dt>Telefon:</dt><dd>pevná linka: <a href="tel:…">…</a></dd>
 *       <dt>E-mail:</dt><dd>oficiální: <a href="mailto:…">…</a></dd></dl>
 */
export function parseDepartment(html: string, url: string, fetchedAt: string): Contact | null {
  const $ = cheerio.load(html);
  const main = $('#hlobsah');
  if (main.length === 0) return null;

  const name = collapse(main.find('h2').first().text()) || collapse($('title').text());
  if (!name) return null;

  const id = /\/os-(\d+)$/.exec(url)?.[1];
  if (!id) return null;

  // Pozor: bereme jen kontakt uvedený jako kontakt pracoviště. Seznam osob
  // (`dl.kontakty`) se záměrně přeskakuje — viz komentář v hlavičce souboru.
  const phone = officialContact($, main, 'telefon', 'a[href^="tel:"]', 'tel:');

  const email = officialContact($, main, 'e-mail', 'a[href^="mailto:"]', 'mailto:');

  const source: SourceRef = {
    name: 'Magistrát města Kladna',
    url: 'https://www.mestokladno.cz/odbory-magistratu/os-200244',
    license: 'Obsah © Statutární město Kladno, aplikace odkazuje na originál',
    fetchedAt,
  };

  return {
    id,
    name,
    department: null,
    role: null,
    phone: phone && phone.length > 0 ? phone : null,
    email: email && isEmail(email) ? email : null,
    building: findDefinition($, main, 'adresa'),
    officeHours: findDefinition($, main, 'úřední hodiny'),
    detailUrl: url,
    source,
  };
}

/**
 * Kontakt uvedený jako kontakt pracoviště.
 *
 * VISMO má na stránce odboru dva různé zdroje kontaktů:
 *
 *   <dl><dt>E-mail:</dt><dd>oficiální: <a href="mailto:odbor.dopravy@…">…</a></dd></dl>
 *   <dl class="kontakty">… seznam jednotlivých úředníků …</dl>
 *
 * Bereme výhradně ten první. Kdybychom sáhli po prvním `mailto:` na stránce,
 * vytáhli bychom e-mail konkrétní úřednice ze seznamu osob — a přesně to
 * docs/PRAVNI.md zakazuje. Pracoviště, které vlastní kontakt nemá, zůstane
 * bez e-mailu; občan pak použije kontakt nadřízeného odboru.
 */
function officialContact(
  $: cheerio.CheerioAPI,
  scope: ReturnType<cheerio.CheerioAPI>,
  label: string,
  selector: string,
  scheme: string,
): string | null {
  let found: string | null = null;

  scope.find('dl').each((_, list) => {
    if (found) return;
    const $list = $(list);
    if ($list.hasClass('kontakty')) return;

    $list.find('dt').each((_, term) => {
      if (found) return;
      if (!collapse($(term).text()).toLowerCase().startsWith(label)) return;

      const href = $(term).next('dd').find(selector).first().attr('href');
      const raw = href?.replace(new RegExp(`^${scheme}`, 'i'), '').split('?')[0]?.trim();
      if (raw) found = decodeURIComponent(raw).split(/[,;\s]+/)[0]?.trim() ?? null;
    });
  });

  return found;
}

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value);
}

/** Najde hodnotu v definičním seznamu podle popisku, například „Adresa:". */
function findDefinition(
  $: cheerio.CheerioAPI,
  scope: ReturnType<cheerio.CheerioAPI>,
  label: string,
): string | null {
  let found: string | null = null;
  scope.find('dt').each((_, element) => {
    if (found) return;
    const term = collapse($(element).text()).toLowerCase().replace(':', '');
    if (!term.startsWith(label)) return;
    const value = collapse($(element).next('dd').text());
    if (value) found = value;
  });
  return found;
}

