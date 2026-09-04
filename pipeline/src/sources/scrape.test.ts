/**
 * Testy scraperů webu města.
 *
 * Tyhle tři zdroje nejsou strojově čitelné, takže jsou nejkřehčí částí pipeline.
 * Fixtures jsou skutečné stránky stažené 3. 9. 2026 — když město šablonu změní,
 * tady to praskne jako první.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contactFileSchema, noticeFileSchema, placeFileSchema } from '@kladno/schema';
import { buildStreets, decodeRuianCsv, parseAddressPoints } from './ruian.js';
import { extractValidity, parseTraffic } from './traffic.js';
import { parseWasteYards } from './waste.js';
import { parseDepartment, parseDepartmentLinks } from './contacts.js';
import { FIXTURES } from '../lib/fixtures.js';

const FETCHED_AT = '2026-09-03T21:00:00.000Z';
const streets = buildStreets(
  parseAddressPoints(decodeRuianCsv(readFileSync(join(FIXTURES, 'ruian-kladno-2026-08-31.csv')))),
);
const trafficHtml = readFileSync(
  join(FIXTURES, 'mestokladno-uzavirky-ds43821-2026-09-03.html'),
  'utf8',
);
const wasteHtml = readFileSync(
  join(FIXTURES, 'mestokladno-sberne-dvory-ds200618-2026-09-03.html'),
  'utf8',
);
const departmentHtml = readFileSync(
  join(FIXTURES, 'mestokladno-odbor-os1018-2026-09-03.html'),
  'utf8',
);
// Oddělení účetnictví nemá vlastní úřední e-mail — na stránce je jen seznam osob.
const departmentWithoutOwnEmailHtml = readFileSync(
  join(FIXTURES, 'mestokladno-oddeleni-os1037-2026-09-04.html'),
  'utf8',
);

describe('uzavírky', () => {
  const notices = parseTraffic(trafficHtml, streets, FETCHED_AT);

  it('vytáhne položky ze seznamu dokumentů', () => {
    expect(notices.length).toBeGreaterThanOrEqual(8);
    expect(noticeFileSchema.parse(notices)).toHaveLength(notices.length);
  });

  it('u každé položky zná název a odkaz na originál', () => {
    for (const notice of notices) {
      expect(notice.title.length).toBeGreaterThan(5);
      expect(notice.detailUrl).toMatch(/^https:\/\/www\.mestokladno\.cz\//);
      expect(notice.kind).toBe('traffic');
    }
  });

  it('označí úplnou uzavírku jako kritickou', () => {
    const full = notices.find((notice) => notice.title.includes('Úplná uzavírka'));
    expect(full?.severity).toBe('critical');
  });

  it('najde v textu ulici z číselníku RÚIAN', () => {
    const withStreets = notices.filter((notice) => notice.streets.length > 0);
    expect(withStreets.length).toBeGreaterThan(0);

    const hrebecska = notices.find((notice) => notice.title.includes('Hřebečská'));
    expect(hrebecska?.streets).toContain('Hřebečská');
  });

  it('nespojí s uzavírkou ulici, kterou text jen náhodou připomíná', () => {
    // „Práce jsou ve finální fázi" nesmí označit náměstí Práce.
    const zastavky = notices.find((notice) => notice.title.includes('Zastávky na náměstí'));
    expect(zastavky?.streets).not.toContain('Práce');
  });

  it('pozná, že stránka přestala mít seznam dokumentů', () => {
    expect(() => parseTraffic('<html><body>nic</body></html>', streets, FETCHED_AT)).toThrow(
      /nevrátila/,
    );
  });
});

describe('platnost uzavírky z volného textu', () => {
  it('vezme datum za slovem „od"', () => {
    const validity = extractValidity('s platností od 3.9.2026 do ukončení opravy', null);
    expect(validity.from.startsWith('2026-09-02T22:00')).toBe(true);
    // „do ukončení opravy" není datum — konec zůstane neznámý, nic si nevymýšlíme.
    expect(validity.to).toBeNull();
  });

  it('vezme rozsah od–do', () => {
    const validity = extractValidity('uzavírka od 1.9.2026 do 30.9.2026', null);
    expect(validity.to).not.toBeNull();
    expect(validity.to!.startsWith('2026-09-29T22:00')).toBe(true);
  });

  it('doplní rok u data, které ho nemá', () => {
    // Reálný zápis ze stránky města: rok je uvedený jen u druhého data.
    const validity = extractValidity('v termínu od 23.06. do 30.09. 2026 k uzavírce', null);
    expect(validity.from.startsWith('2026-06-22T22:00')).toBe(true);
    expect(validity.to!.startsWith('2026-09-29T22:00')).toBe(true);
  });

  it('nevezme jako začátek termín dokončení uvedený v textu', () => {
    // Text mluví jen o dokončení; začátek musí zůstat na datu vyvěšení,
    // jinak by se uzavírka tvářila, že začne až za rok.
    const validity = extractValidity(
      'Prodloužení termínu úplné uzavírky. Termín: celkové dokončení do 30.04. 2027.',
      '2026-09-02',
    );
    expect(validity.from.startsWith('2026-09-01T22:00')).toBe(true);
    expect(validity.to!.startsWith('2027-04-29T22:00')).toBe(true);
  });

  it('když datum v textu není, použije datum vyvěšení', () => {
    const validity = extractValidity('bez data', '2026-09-01');
    expect(validity.from.startsWith('2026-08-31T22:00')).toBe(true);
  });
});

describe('sběrné dvory', () => {
  const places = parseWasteYards(wasteHtml, streets, FETCHED_AT);

  it('najde tři sběrné dvory', () => {
    expect(places).toHaveLength(3);
    expect(placeFileSchema.parse(places)).toHaveLength(3);
  });

  it('přečte adresu, telefon a otevírací dobu', () => {
    const rozdelov = places.find((place) => place.address?.includes('Smečenská'));
    expect(rozdelov?.phone).toBe('606 765 663');
    expect(rozdelov?.openingHours).toContain('Pondělí 8:00–17:00');
    expect(rozdelov?.openingHours).toContain('Neděle 9:00–12:00');
  });

  it('dohledá polohu podle ulice z RÚIAN', () => {
    const rozdelov = places.find((place) => place.address?.includes('Smečenská'));
    expect(rozdelov?.geo).not.toBeNull();
    expect(rozdelov?.geo?.lat).toBeGreaterThan(50.1);
    expect(rozdelov?.geo?.lat).toBeLessThan(50.2);
  });

  it('pozná, že stránka přestala obsahovat dvory', () => {
    expect(() => parseWasteYards('<div id="hlobsah">nic</div>', streets, FETCHED_AT)).toThrow(
      /žádné dvory/,
    );
  });
});

describe('kontakty odborů', () => {
  const url = 'https://www.mestokladno.cz/odbor-dopravy-a-sluzeb/os-1018';
  const contact = parseDepartment(departmentHtml, url, FETCHED_AT);

  it('přečte název, telefon a e-mail odboru', () => {
    expect(contact?.name).toBe('Odbor dopravy a služeb');
    expect(contact?.phone).toBe('+420312604331');
    expect(contact?.email).toBe('odbor.dopravy@mestokladno.cz');
    expect(contactFileSchema.parse([contact])).toHaveLength(1);
  });

  it('bere jen oficiální kontakt odboru, ne jednotlivé úředníky', () => {
    // Na stránce je 16 e-mailů, z toho 15 osobních (jmeno.prijmeni@…).
    // Do dat smí jen ten úřední, který VISMO uvádí jako kontakt pracoviště.
    expect(contact?.email).toBe('odbor.dopravy@mestokladno.cz');
    expect(contact?.role).toBeNull();
    expect(contact?.department).toBeNull();

    const asJson = JSON.stringify(contact);
    for (const personal of ['alena.fertekova', 'dana.fikrlova', 'jana.abrhamova']) {
      expect(asJson).not.toContain(personal);
    }
  });

  it('u pracoviště bez vlastního e-mailu nesáhne po adrese úřednice ze seznamu osob', () => {
    // Oddělení účetnictví nemá blok „E-mail:", jen seznam osob. Dřívější verze
    // parseru odtud vytáhla soukromý pracovní e-mail první uvedené úřednice.
    const ucetnictvi = parseDepartment(
      departmentWithoutOwnEmailHtml,
      'https://www.mestokladno.cz/oddeleni-ucetnictvi/os-1037',
      FETCHED_AT,
    );
    expect(ucetnictvi?.name).toBe('Oddělení účetnictví');
    expect(ucetnictvi?.email).toBeNull();
    expect(JSON.stringify(ucetnictvi)).not.toContain('katerina.zahrubska');
  });

  it('vytáhne odkazy na odbory z rozcestníku', () => {
    const html = `<div id="hlobsah">
      <a href="/odbor%2Dfinancni/os-1012">Odbor finanční</a>
      <a href="/oddeleni%2Ducetnictvi/os-1037">Oddělení účetnictví</a>
      <a href="/nejaky-dokument/d-123">Dokument</a>
      <a href="https://jinde.cz/os-999">Cizí web</a>
    </div>`;
    expect(parseDepartmentLinks(html)).toEqual([
      'https://www.mestokladno.cz/odbor-financni/os-1012',
      'https://www.mestokladno.cz/oddeleni-ucetnictvi/os-1037',
    ]);
  });
});
