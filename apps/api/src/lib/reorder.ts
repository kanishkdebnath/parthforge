/**
 * Validates that the submitted reorder set is a permutation of the existing
 * set. Returns null on success, or an error message on mismatch (extra ids,
 * missing ids, or duplicates).
 *
 * Used by reorder endpoints across multiple features (roadmap milestones,
 * job application rounds, ...). Lives here so route modules don't have to
 * import from a feature-named helper file for generic logic.
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
