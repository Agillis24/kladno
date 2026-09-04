import { z } from 'zod';
import { attachmentSchema, isoDate, sourceRefSchema } from './common.js';

/**
 * Položka úřední desky.
 *
 * Vzniká spojením dvou zdrojů města přes ID dokumentu: OFN feed dodává lhůtu
 * `relevantní_do` a spisové údaje, XML kanál `?9` dodává složku (kategorii),
 * kterou OFN nemá. Podrobnosti v docs/ZDROJE.md, kap. 3.
 */
export const boardItemSchema = z.object({
  /** ID dokumentu ve VISMO, například „1513126". */
  id: z.string().regex(/^\d+$/),
  title: z.string().min(1),
  /** Složka desky, například „Písemnosti mimokladenských institucí". */
  category: z.string().nullable(),
  /** Celá cesta složkou, oddělená „ / ". */
  categoryPath: z.string().nullable(),
  /** Datum vyvěšení. */
  postedFrom: isoDate,
  /** Datum sejmutí. Po jeho uplynutí položka mizí ze základních výpisů. */
  postedTo: isoDate.nullable(),
  refNumber: z.string().nullable(),
  fileNumber: z.string().nullable(),
  detailUrl: z.url(),
  attachments: z.array(attachmentSchema),
  source: sourceRefSchema,
});
export type BoardItem = z.infer<typeof boardItemSchema>;

export const boardFileSchema = z.array(boardItemSchema);
