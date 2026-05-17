import type { Milestone, Roadmap } from '@pathforge/shared';

export function milestoneCompletionPct(m: Milestone): number {
  if (m.steps.length === 0) return 0;
  const done = m.steps.filter((s) => s.completed).length;
  return Math.round((done / m.steps.length) * 100);
}

export function roadmapOverallPct(r: Roadmap): { pct: number; done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const m of r.milestones) {
    for (const s of m.steps) {
      total += 1;
      if (s.completed) done += 1;
    }
  }
  return { pct: total === 0 ? 0 : Math.round((done / total) * 100), done, total };
}

/**
 * Mirrors the server's `recomputeMilestoneCompletedAt` so the optimistic
 * update produces the same `completedAt` shape the server would write.
 */
export function deriveCompletedAt(steps: ReadonlyArray<{ completed: boolean }>): Date | undefined {
  if (steps.length === 0) return undefined;
  if (steps.some((s) => !s.completed)) return undefined;
  return new Date();
}
