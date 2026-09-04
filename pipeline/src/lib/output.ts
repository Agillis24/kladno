/**
 * Zápis datových souborů a manifestu.
 *
 * Data se zapisují jen tehdy, když projdou schématem i kontrolou propadu.
 * Když neprojdou, zůstane v `data/v1/` předchozí verze a v manifestu se
 * u datasetu objeví `stale: true` a text chyby — aplikace pak uživateli
 * ukáže proužek „data z ..., aktualizace se nezdařila".
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodType } from 'zod';
import { type DatasetEntry, type Manifest, manifestSchema } from '@kladno/schema';
import { checkDatasetSize } from './guard.js';

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(here, '..', '..', '..', 'data', 'v1');

export type WriteOutcome = {
  name: string;
  file: string;
  published: boolean;
  count: number;
  reason: string | null;
};

/** Kolik položek má soubor, který už v `data/v1/` leží. Null, když tam ještě není. */
async function previousCount(file: string): Promise<number | null> {
  const path = join(DATA_DIR, file);
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Ověří data schématem, porovná je s předchozí verzí a při úspěchu zapíše.
 *
 * Validace schématu je tvrdá: když data neodpovídají modelu, vyhodí výjimku
 * a celý běh padá. Propad počtu položek naopak jen zabrání zápisu, protože to
 * není chyba v našem kódu, ale změna na straně zdroje.
 */
export async function writeDataset<T>(
  name: string,
  file: string,
  items: T[],
  schema: ZodType<T[]>,
  entries: Record<string, DatasetEntry>,
  fetchedAt: string,
): Promise<WriteOutcome> {
  const parsed = schema.safeParse(items);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 5)
      .map((issue: { path: PropertyKey[]; message: string }) =>
        `  ${issue.path.join('.') || '(kořen)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`${name}: data neodpovídají schématu\n${issues}`);
  }

  const before = await previousCount(file);
  const verdict = checkDatasetSize(name, items.length, before);

  if (!verdict.publish) {
    entries[name] = await staleEntry(name, file, verdict.reason, entries);
    return { name, file, published: false, count: items.length, reason: verdict.reason };
  }

  const json = `${JSON.stringify(parsed.data, null, 1)}\n`;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, file), json, 'utf8');

  entries[name] = {
    file,
    hash: sha256(json),
    count: items.length,
    bytes: Buffer.byteLength(json, 'utf8'),
    lastSuccessfulFetch: fetchedAt,
    stale: false,
    lastError: null,
  };
  return { name, file, published: true, count: items.length, reason: null };
}

/**
 * Záznam pro dataset, který se nepodařilo aktualizovat.
 *
 * Zachovává předchozí hodnoty (hash, počet, čas posledního úspěchu), aby aplikace
 * poznala, jak stará data drží, a doplní důvod selhání.
 */
export async function staleEntry(
  name: string,
  file: string,
  reason: string,
  entries: Record<string, DatasetEntry>,
): Promise<DatasetEntry> {
  const previous = await readManifest();
  const old = previous?.datasets[name] ?? entries[name];
  const path = join(DATA_DIR, file);
  const exists = existsSync(path);
  const content = exists ? await readFile(path, 'utf8') : '';

  return {
    file,
    hash: old?.hash ?? sha256(content),
    count: old?.count ?? (exists ? safeLength(content) : 0),
    bytes: Buffer.byteLength(content, 'utf8'),
    lastSuccessfulFetch: old?.lastSuccessfulFetch ?? new Date(0).toISOString(),
    stale: true,
    lastError: reason,
  };
}

function safeLength(content: string): number {
  try {
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export async function readManifest(): Promise<Manifest | null> {
  const path = join(DATA_DIR, 'index.json');
  if (!existsSync(path)) return null;
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(await readFile(path, 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeManifest(entries: Record<string, DatasetEntry>): Promise<void> {
  const manifest: Manifest = {
    version: 'v1',
    generatedAt: new Date().toISOString(),
    datasets: entries,
  };
  const parsed = manifestSchema.parse(manifest);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, 'index.json'), `${JSON.stringify(parsed, null, 1)}\n`, 'utf8');
}
