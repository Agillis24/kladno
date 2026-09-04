/**
 * Síťová diagnostika webu města.
 *
 * Pipeline v GitHub Actions hlásí u všech zdrojů z `mestokladno.cz` chybu
 * `ETIMEDOUT`, zatímco `curl` ze stejného runneru dostane odpověď za 0,4 s
 * a lokálně funguje všechno. Tenhle skript porovná, co dělá Node jinak.
 *
 * Spouští se ručně workflow „Diagnostika dostupnosti webu města", nic nezapisuje.
 */
import dns from 'node:dns';
import { lookup } from 'node:dns/promises';
import { fetchText } from './lib/http.js';

const HOST = 'www.mestokladno.cz';
const ROBOTS = `https://${HOST}/robots.txt`;
const FEED = `https://${HOST}/rss/?9`;
const IPV4 = '78.156.158.91';

const UA = 'MojeKladnoBot/1.0 (+https://github.com/Agillis24/kladno)';

async function zkus(popis: string, url: string, init: RequestInit = {}): Promise<void> {
  const start = Date.now();
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    console.log(`  OK    ${popis.padEnd(26)} → ${response.status} za ${Date.now() - start} ms`);
  } catch (error) {
    const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
    const detail = cause?.code ?? cause?.message ?? 'bez příčiny';
    console.log(
      `  CHYBA ${popis.padEnd(26)} → ${(error as Error).message} (${detail}) za ${Date.now() - start} ms`,
    );
  }
}

console.log('=== co vrací dns.lookup ===');
console.log('  výchozí pořadí:', JSON.stringify(await lookup(HOST, { all: true })));
dns.setDefaultResultOrder('ipv4first');
console.log('  po ipv4first  :', JSON.stringify(await lookup(HOST, { all: true })));

console.log('\n=== jednotlivé varianty požadavku ===');
await zkus('holý fetch', ROBOTS);
await zkus('hlavičky pipeline', ROBOTS, {
  headers: { 'User-Agent': UA, 'Accept-Language': 'cs,en;q=0.5' },
  redirect: 'follow',
});
await zkus('kanál 9 (padá v pipeline)', FEED, {
  headers: { 'User-Agent': UA, Accept: 'application/xml, text/xml' },
  redirect: 'follow',
});

console.log('\n=== přímo na IPv4 adresu ===');
await zkus('IP + hlavička Host', `https://${IPV4}/robots.txt`, {
  headers: { Host: HOST, 'User-Agent': UA },
});

console.log('\n=== pětkrát za sebou, jestli nejde o rate limit ===');
for (let i = 1; i <= 5; i++) {
  await zkus(`pokus ${i}`, ROBOTS, { headers: { 'User-Agent': UA } });
  await new Promise((resolve) => setTimeout(resolve, 1_500));
}

// Holý fetch v CI prochází, ale pipeline na týchž adresách hlásí ETIMEDOUT.
// Tenhle blok volá přímo klienta z pipeline, aby se rozlišilo, jestli je chyba
// v našem kódu, nebo v prostředí runneru.
console.log('\n=== přes HTTP klienta pipeline ===');
const pres: [string, string][] = [
  ['robots.txt', ROBOTS],
  ['kanál 9', FEED],
  ['úřední deska OFN', `https://${HOST}/opendata-uredni-deska`],
];
for (const [popis, url] of pres) {
  const start = Date.now();
  try {
    const result = await fetchText(url);
    console.log(
      `  OK    ${popis.padEnd(26)} → ${result.status}, ${result.text.length} B za ${Date.now() - start} ms`,
    );
  } catch (error) {
    console.log(
      `  CHYBA ${popis.padEnd(26)} → ${(error as Error).message} za ${Date.now() - start} ms`,
    );
  }
}
