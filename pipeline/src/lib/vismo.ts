/**
 * Čtení stránek VISMO.
 *
 * CMS má pro seznamy dokumentů jeden ustálený tvar, který se opakuje napříč
 * sekcemi webu:
 *
 *   <div class="dok"><ul class="ui">
 *     <li class="u">
 *       <strong><a href="/slug/d-1513097"><img …>Nadpis</a></strong>
 *       <span>(2.9.2026)</span>
 *       <div>Popis…</div>
 *     </li>
 *   </ul></div>
 *
 * Díky tomu stačí jeden parser pro uzavírky, odpady i další rubriky. Kdyby ho
 * město změnilo, padnou testy proti fixtures a bude hned vidět kde.
 */
import * as cheerio from 'cheerio';
import { collapse, parseCzechDate } from './text.js';

export const CITY_ORIGIN = 'https://www.mestokladno.cz';

export type VismoListItem = {
  /** ID dokumentu, když na něj položka odkazuje. */
  id: string | null;
  title: string;
  /** Datum ve `<span>` za nadpisem, obvykle datum vyvěšení. */
  date: string | null;
  description: string | null;
  detailUrl: string | null;
};

/** Vytáhne položky seznamu dokumentů z jedné stránky VISMO. */
export function parseDocumentList(html: string): VismoListItem[] {
  const $ = cheerio.load(html);
  const items: VismoListItem[] = [];

  $('div.dok li.u').each((_, element) => {
    const li = $(element);
    const link = li.find('strong a').first();
    const title = collapse(link.text());
    if (!title) return;

    const href = link.attr('href') ?? null;
    const detailUrl = href ? absoluteUrl(href) : null;
    const id = detailUrl ? (/\/d-(\d+)/.exec(detailUrl)?.[1] ?? null) : null;

    // Popis je v <div> hned za nadpisem; někdy chybí.
    const description = collapse(li.find('div').first().text());
    const dateText = collapse(li.find('span').first().text());

    items.push({
      id,
      title,
      date: dateText ? parseCzechDate(dateText) : null,
      description: description || null,
      detailUrl,
    });
  });

  return items;
}

/** Hlavní textový obsah stránky bez navigace, patičky a sdílení. */
export function extractMainText(html: string): string {
  const $ = cheerio.load(html);
  const main = $('#hlobsah');
  if (main.length === 0) return '';
  main.find('script, style, .skryt, .cist, #kontext, .kontext').remove();
  return collapse(main.text());
}

/** Doplní doménu města k relativní adrese a dekóduje procenta ve slugu. */
export function absoluteUrl(href: string): string {
  const url = href.startsWith('http') ? href : `${CITY_ORIGIN}${href.startsWith('/') ? '' : '/'}${href}`;
  try {
    // VISMO kóduje pomlčky ve slugu jako %2D, což je zbytečné a špatně se to čte.
    return decodeURI(url);
  } catch {
    return url;
  }
}

