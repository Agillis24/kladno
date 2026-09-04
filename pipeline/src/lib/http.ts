/**
 * HTTP klient pipeline.
 *
 * Šetrný režim není volitelný (viz docs/PRAVNI.md): nejméně 1,5 s mezi požadavky
 * na tentýž host, sekvenčně, vlastní identifikovatelný User-Agent, podmíněné
 * požadavky a exponenciální backoff. Web města je pomalý a nemá smysl ho zatěžovat.
 */
import { setDefaultResultOrder } from 'node:dns';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Vynucení IPv4.
 *
 * `www.mestokladno.cz` má v DNS záznam AAAA (`2a00:d940:0:3::91`), ale na IPv6
 * spojení nepřijímá — ověřeno 4. 9. 2026 diagnostickým během v GitHub Actions:
 * `curl -4` vrátí 200, `curl -6` skončí chybou 7 (nelze se připojit). Node si
 * podle DNS pořadí občas vybere IPv6 a celý běh pak spadne na „fetch failed"
 * u všech zdrojů z webu města, zatímco ČHMÚ i ČÚZK projdou.
 *
 * Lokálně se to neprojeví, protože běžné české připojení IPv6 k tomuhle webu
 * nepoužije. Proto to odhalil až ostrý běh v CI.
 */
setDefaultResultOrder('ipv4first');

/** Prodleva mezi dvěma požadavky na tentýž host. */
const HOST_DELAY_MS = 1_500;
const TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;

export const USER_AGENT = 'MojeKladnoBot/1.0 (+https://github.com/Agillis24/kladno)';

/** Poslední dokončený požadavek na daný host. Drží rozestup mezi voláními. */
const lastRequestAt = new Map<string, number>();

/** Hodnoty z minulého běhu, aby šlo posílat podmíněné požadavky. */
export type ConditionalState = {
  etag?: string;
  lastModified?: string;
};

export type FetchResult = {
  /** Tělo odpovědi. Prázdné, když server vrátil 304. */
  body: Buffer;
  status: number;
  /** True, když se obsah od minulého běhu nezměnil. */
  notModified: boolean;
  conditional: ConditionalState;
  fetchedAt: string;
  url: string;
};

async function respectHostDelay(host: string): Promise<void> {
  const last = lastRequestAt.get(host);
  if (last !== undefined) {
    const waited = Date.now() - last;
    if (waited < HOST_DELAY_MS) await sleep(HOST_DELAY_MS - waited);
  }
  lastRequestAt.set(host, Date.now());
}

/**
 * Stáhne URL v šetrném režimu.
 *
 * Vrací i stav 304, aby volající poznal, že se nemusí nic přepočítávat.
 * Chyby 5xx a síťové výpadky zkouší třikrát s rostoucí prodlevou; 4xx nikoli,
 * protože opakovat zjevně chybný požadavek nemá smysl.
 */
export async function fetchUrl(
  url: string,
  options: { conditional?: ConditionalState; accept?: string } = {},
): Promise<FetchResult> {
  const host = new URL(url).host;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await respectHostDelay(host);

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'cs,en;q=0.5',
    };
    if (options.accept) headers.Accept = options.accept;
    if (options.conditional?.etag) headers['If-None-Match'] = options.conditional.etag;
    if (options.conditional?.lastModified) {
      headers['If-Modified-Since'] = options.conditional.lastModified;
    }

    try {
      const response = await fetch(url, {
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const fetchedAt = new Date().toISOString();
      const conditional: ConditionalState = {};
      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');
      if (etag) conditional.etag = etag;
      if (lastModified) conditional.lastModified = lastModified;

      if (response.status === 304) {
        return { body: Buffer.alloc(0), status: 304, notModified: true, conditional, fetchedAt, url };
      }
      if (response.status >= 400) {
        // 4xx je chyba na naší straně, opakování by nic nezměnilo.
        if (response.status < 500 || attempt === MAX_ATTEMPTS) {
          throw new Error(`HTTP ${response.status} ${response.statusText} pro ${url}`);
        }
        lastError = new Error(`HTTP ${response.status} pro ${url}`);
        await sleep(HOST_DELAY_MS * 2 ** attempt);
        continue;
      }

      const body = Buffer.from(await response.arrayBuffer());
      return { body, status: response.status, notModified: false, conditional, fetchedAt, url };
    } catch (error) {
      lastError = error;
      const isLast = attempt === MAX_ATTEMPTS;
      const isClientError = error instanceof Error && /HTTP 4\d\d/.test(error.message);
      if (isLast || isClientError) break;
      await sleep(HOST_DELAY_MS * 2 ** attempt);
    }
  }

  throw new Error(`${url}: ${describe(lastError)}`);
}

/**
 * Čitelný popis chyby včetně příčiny.
 *
 * Samotné `fetch failed` z Node neřekne nic — teprve `error.cause` prozradí,
 * jestli šlo o odmítnuté spojení, DNS, nebo timeout. Bez toho se v logu CI
 * hledá příčina zbytečně dlouho.
 */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    return `${error.message} (${cause.message}${code ? `, ${code}` : ''})`;
  }
  return error.message;
}

/** Stáhne URL a vrátí text v UTF-8. */
export async function fetchText(
  url: string,
  options: { conditional?: ConditionalState; accept?: string } = {},
): Promise<FetchResult & { text: string }> {
  const result = await fetchUrl(url, options);
  return { ...result, text: result.body.toString('utf8') };
}
