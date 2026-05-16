import type { Roadmap } from '@pathforge/shared';
import type { RoadmapDoc } from '../models/Roadmap.js';

/**
 * Returns a fresh `new Date()` when every step in the milestone is completed
 * AND the milestone has at least one step. Returns undefined otherwise.
 *
 * The empty-milestone case (no steps) is intentionally NOT "done" — an empty
 * milestone has no work to verify.
 */
export function recomputeMilestoneCompletedAt(
  steps: ReadonlyArray<{ completed: boolean }>
): Date | undefined {
  if (steps.length === 0) return undefined;
  if (steps.some((s) => !s.completed)) return undefined;
  return new Date();
}

/**
 * Validates that the submitted reorder set is a permutation of the existing
 * set. Returns null on success, or an error message on mismatch (extra ids,
 * missing ids, or duplicates).
 */
export function validateReorderIds(
  existing: ReadonlyArray<string>,
  submitted: ReadonlyArray<string>
): string | null {
  const msg = 'Reorder set does not match current order';
  if (existing.length !== submitted.length) return msg;
  const existingSet = new Set(existing);
  const seen = new Set<string>();
  for (const id of submitted) {
    if (!existingSet.has(id)) return msg;
    if (seen.has(id)) return msg;
    seen.add(id);
  }
  return null;
}

/**
 * Converts a Mongoose lean roadmap doc into the wire `Roadmap` shape:
 * stringifies all ObjectIds at every level, preserves Date instances as Dates,
 * and leaves undefined optionals undefined (so the JSON serializer drops them).
 *
 * Typed loosely on input because the lean doc shape varies (ObjectId vs string
 * after `.lean()` vs full Document) — the function itself enforces the output
 * shape. Output type matches `Roadmap` from @pathforge/shared.
 */
export function serializeRoadmap(doc: RoadmapDoc): Roadmap {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    title: doc.title,
    description: doc.description ?? undefined,
    deadline: doc.deadline ?? undefined,
    archived: doc.archived,
    milestones: (doc.milestones ?? []).map((m) => ({
      _id: String(m._id),
      title: m.title,
      description: m.description ?? undefined,
      deadline: m.deadline ?? undefined,
      completedAt: m.completedAt ?? undefined,
      steps: (m.steps ?? []).map((s) => ({
        _id: String(s._id),
        title: s.title,
        links: (s.links ?? []).map((l) => ({
          url: l.url,
          label: l.label ?? undefined,
        })),
        completed: s.completed,
        completedAt: s.completedAt ?? undefined,
      })),
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
