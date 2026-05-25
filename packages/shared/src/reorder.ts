import { z } from 'zod';
import { ObjectIdString } from './objectId.js';

/**
 * Generic bulk-reorder request body. Every feature whose API exposes a
 * `PATCH …/reorder` endpoint sends the same shape: a permutation of the
 * existing ids in the new desired order.
 *
 * Extracted from the per-feature copies that used to live in roadmap.ts,
 * jobApplication.ts, and budget.ts after a third caller appeared.
 */
export const ReorderIdsRequestSchema = z.object({
  ids: z.array(ObjectIdString).min(1),
});
export type ReorderIdsRequest = z.infer<typeof ReorderIdsRequestSchema>;
