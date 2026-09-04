/** Pomocné funkce pro práci s českým textem a s HTML z VISMO. */

/**
 * Název bez diakritiky, malými písmeny, jednoduché mezery.
 *
 * Používá se jako klíč při hledání ulic v textu uzavírek — „Čs. armády"
 * a „cs. armady" musí být tatáž věc.
 */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    // U+0300–U+036F jsou kombinující diakritická znaménka, která NFD oddělí od písmen.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Zbaví text HTML značek a slepí zbylé mezery. */
export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

/**
 * Dekóduje HTML entity.
 *
 * Nutné i tam, kde by být neměly: OFN feed města má v URL příloh `&amp;`
 * místo `&` u 113 ze 114 záznamů (docs/ZDROJE.md, kap. 3.1).
 */
export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Vytáhne obsah hlavního bloku stránky VISMO (`#hlobsah`) bez patičky se sdílením. */
export function extractVismoContent(html: string): string {
  const start = html.indexOf('id="hlobsah"');
  if (start < 0) return html;
  const rest = html.slice(start);
  // Patička se sdílením a blok „Kontext" už k obsahu nepatří.
  for (const marker of ['Sdílet na Facebooku', 'id="kontext"', 'class="kontext"']) {
    const cut = rest.indexOf(marker);
    if (cut > 0) return rest.slice(0, cut);
  }
  return rest;
}

/**
 * Převede české datum („3.9.2026", „3. 9. 2026") na ISO den.
 * Vrací null, když text datum neobsahuje.
 */
export function parseCzechDate(value: string): string | null {
  const match = value.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  if (!day || !month || !year) return null;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/**
 * Spojí den a čas na ISO okamžik v pražském čase.
 *
 * Kanály města uvádějí datum a čas odděleně a bez zóny; bereme je jako místní čas.
 */
export function toIsoDateTime(date: string, time?: string | null): string {
  const offset = pragueOffset(date);
  const clock = time && /^\d{1,2}:\d{2}/.test(time) ? padTime(time) : '00:00:00';
  return new Date(`${date}T${clock}${offset}`).toISOString();
}

function padTime(time: string): string {
  const [h = '0', m = '0', s = '0'] = time.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

/**
 * Posun pražského času vůči UTC pro daný den.
 *
 * Letní čas v EU platí od poslední neděle v březnu do poslední neděle v říjnu.
 */
function pragueOffset(isoDay: string): '+01:00' | '+02:00' {
  const date = new Date(`${isoDay}T12:00:00Z`);
  const year = date.getUTCFullYear();
  const start = lastSundayOfMonth(year, 2);
  const end = lastSundayOfMonth(year, 9);
  return date >= start && date < end ? '+02:00' : '+01:00';
}

function lastSundayOfMonth(year: number, monthIndex: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0, 1, 0, 0));
  lastDay.setUTCDate(lastDay.getUTCDate() - lastDay.getUTCDay());
  return lastDay;
}

/**
 * Slepí bílé znaky na jednoduché mezery.
 *
 * VISMO sype do stránek nedělitelné mezery (`&nbsp;`) i uvnitř vět, takže
 * bez tohohle kroku by se texty porovnávaly a zobrazovaly rozbité.
 */
export function collapse(value: string): string {
  return value.replace(/[\s\u00a0]+/g, ' ').trim();
}
