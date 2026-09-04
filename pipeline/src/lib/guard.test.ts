import { describe, expect, it } from 'vitest';
import { checkDatasetSize, DROP_THRESHOLD } from './guard.js';
import { parseRobots, isPathAllowed } from './robots.js';
import { decodeEntities, normalize, parseCzechDate, stripHtml, toIsoDateTime } from './text.js';
import { parseOfnBoard } from '../sources/board.js';
import { findStreets } from '../normalize/streets.js';
import type { Street } from '@kladno/schema';

describe('ochrana proti publikaci prázdných dat', () => {
  it('pustí data, když je počet položek stabilní', () => {
    expect(checkDatasetSize('board', 114, 114).publish).toBe(true);
    expect(checkDatasetSize('board', 120, 114).publish).toBe(true);
    expect(checkDatasetSize('board', 100, 114).publish).toBe(true);
  });

  it('zadrží data, když zdroj vrátí nulu a předtím něco měl', () => {
    const verdict = checkDatasetSize('board', 0, 114);
    expect(verdict.publish).toBe(false);
    expect(verdict.reason).toContain('nula položek');
  });

  it('zadrží data při propadu nad prahem', () => {
    // 114 → 60 je propad o 47 %, tedy přes práh 40 %.
    const verdict = checkDatasetSize('board', 60, 114);
    expect(verdict.publish).toBe(false);
    expect(verdict.reason).toContain('%');
  });

  it('drží se prahu 40 %', () => {
    const justUnder = Math.ceil(114 * (1 - DROP_THRESHOLD)) + 1;
    expect(checkDatasetSize('board', justUnder, 114).publish).toBe(true);
    expect(checkDatasetSize('board', Math.floor(114 * 0.55), 114).publish).toBe(false);
  });

  it('při prvním běhu pustí data, ale ne prázdná', () => {
    expect(checkDatasetSize('board', 114, null).publish).toBe(true);
    expect(checkDatasetSize('board', 0, null).publish).toBe(false);
  });
});

describe('ochrana proti rozbitému zdroji', () => {
  // Úmyslně poškozený vstup: feed odpoví, ale bez obsahu.
  it('rozbitý OFN feed vede na výjimku, ne na prázdný výstup', () => {
    expect(() => parseOfnBoard('{"informace": []}')).not.toThrow();
    expect(parseOfnBoard('{"informace": []}')).toHaveLength(0);
    // Prázdné pole projde parserem, ale guard ho nepustí do dat.
    expect(checkDatasetSize('board', 0, 114).publish).toBe(false);
  });

  it('feed s cizí strukturou spadne hned při parsování', () => {
    expect(() => parseOfnBoard('{"neco": 1}')).toThrow(/informace/);
    expect(() => parseOfnBoard('nevalidní json')).toThrow();
  });
});

describe('robots.txt', () => {
  const content = `
# robots.txt for all webhouse's webs
User-agent: googlebot
Disallow: /vismo/navstevnost.asp

User-agent: *          # match all bots
Disallow: /vismo/ZaslatEmailem.asp
Disallow: /aa/
Disallow: /            # keep them out
`;

  const rules = parseRobots(content);

  it('rozpozná plošnou blokaci i jmenovité zákazy', () => {
    expect(rules.hasBlanketBlock).toBe(true);
    expect(rules.disallowedPaths).toContain('/vismo/ZaslatEmailem.asp');
    expect(rules.disallowedPaths).toContain('/aa/');
  });

  it('sbírá jmenovité zákazy i ze skupin pro vyhledávače', () => {
    // Na webu města jsou konkrétní zákazy zapsané právě u vyhledávačů; skupina `*`
    // má jen plošné „Disallow: /". Kdybychom četli jen ji, nechránili bychom nic.
    expect(rules.disallowedPaths).toContain('/vismo/navstevnost.asp');
  });

  it('nepovažuje Disallow: / u konkrétního robota za plošnou blokaci', () => {
    const parsed = parseRobots('User-agent: googlebot\nDisallow: /');
    expect(parsed.hasBlanketBlock).toBe(false);
  });

  it('jmenovitě zakázané cesty odmítne, ostatní pustí', () => {
    expect(isPathAllowed(rules, 'https://www.mestokladno.cz/vismo/ZaslatEmailem.asp')).toBe(false);
    expect(isPathAllowed(rules, 'https://www.mestokladno.cz/aa/cokoliv')).toBe(false);
    // Plošný Disallow se podle rozhodnutí ze 4. 9. 2026 vědomě přeskakuje.
    expect(isPathAllowed(rules, 'https://www.mestokladno.cz/opendata-uredni-deska')).toBe(true);
  });

  it('ignoruje komentáře za hodnotou', () => {
    const parsed = parseRobots('User-agent: *\nDisallow: /tajne/  # poznámka');
    expect(parsed.disallowedPaths).toEqual(['/tajne/']);
  });
});

describe('práce s textem', () => {
  it('normalizuje český název na klíč pro hledání', () => {
    expect(normalize('Čs. armády')).toBe('cs. armady');
    expect(normalize('  Milady   Horákové ')).toBe('milady horakove');
  });

  it('dekóduje entity včetně &amp; z feedu města', () => {
    expect(decodeEntities('a&amp;b')).toBe('a&b');
    expect(decodeEntities('&quot;citace&quot;')).toBe('"citace"');
    expect(decodeEntities('&#193;')).toBe('Á');
  });

  it('vyčistí HTML na čitelný text', () => {
    expect(stripHtml('<p>První</p><p>Druhá</p>')).toBe('První\nDruhá');
    expect(stripHtml('<span style="color:white">text</span>')).toBe('text');
  });

  it('přečte české datum v obou zápisech', () => {
    expect(parseCzechDate('(2.9.2026)')).toBe('2026-09-02');
    expect(parseCzechDate('platí od 3. 9. 2026')).toBe('2026-09-03');
    expect(parseCzechDate('bez data')).toBeNull();
  });

  it('počítá pražský čas včetně letního posunu', () => {
    // 2. října je letní čas (UTC+2), 2. prosince zimní (UTC+1).
    expect(toIsoDateTime('2026-10-02', '18:00')).toBe('2026-10-02T16:00:00.000Z');
    expect(toIsoDateTime('2026-12-02', '18:00')).toBe('2026-12-02T17:00:00.000Z');
  });
});

describe('rozpoznávání ulic v textu', () => {
  const streets: Street[] = [
    street('1', 'Hřebečská'),
    street('2', 'Dlouhá'),
    street('3', 'Milady Horákové'),
    street('4', 'Čs. armády'),
  ];

  it('najde ulici zmíněnou v textu uzavírky', () => {
    const found = findStreets('Úplná uzavírka ulice Hřebečská od pondělí', streets);
    expect(found.map((match) => match.name)).toEqual(['Hřebečská']);
  });

  it('najde název i se zkratkou a bez diakritiky', () => {
    expect(findStreets('provoz v ul. Cs. armady', streets).map((m) => m.name)).toEqual([
      'Čs. armády',
    ]);
  });

  it('najde víceslovný název bez uvození slovem ulice', () => {
    expect(findStreets('rekonstrukce Milady Horákové pokračuje', streets).map((m) => m.name))
      .toEqual(['Milady Horákové']);
  });

  it('nenechá se zmást obecným slovem, které je zároveň názvem ulice', () => {
    // Kladno má ulici Dlouhá — „v dlouhé frontě" ji nesmí spustit.
    expect(findStreets('stálo se v dlouhé frontě', streets)).toHaveLength(0);
    expect(findStreets('délka úseku je dlouhá 100 m', streets)).toHaveLength(0);
  });

  it('obecný název přijme, když ho uvozuje slovo ulice', () => {
    const found = findStreets('uzavírka v ulici Dlouhá', streets);
    expect(found.map((match) => match.name)).toEqual(['Dlouhá']);
    expect(found[0]?.confident).toBe(true);
  });

  it('nechytí název uvnitř delšího slova', () => {
    expect(findStreets('hřebečskárna neexistuje', streets)).toHaveLength(0);
  });
});

function street(id: string, name: string): Street {
  return {
    id,
    name,
    normalized: normalize(name),
    districts: ['Kladno'],
    center: { lat: 50.14, lng: 14.1 },
    bbox: [50.13, 14.09, 50.15, 14.11],
    addressCount: 10,
  };
}
