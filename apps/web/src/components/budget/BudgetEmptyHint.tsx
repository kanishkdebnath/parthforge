import type { ReactNode } from 'react';

interface Props {
  /** Short headline — the "what is missing" line. */
  heading: string;
  /** Optional one-line hint about how to fix it. */
  hint?: ReactNode;
}

/**
 * Inline empty-state used inside Budget cards/columns (CategoryList,
 * LogColumn, etc.). Distinct from the page-level treatment used by Jobs
 * (`EmptyJobsState`) and Roadmaps (`EmptyRoadmapsState`) because Budget
 * empties sit *inside* nested cards — a full-page `mt-16 max-w-md`
 * treatment would feel out of place. Centered, padded, muted; consistent
 * across every inline Budget empty so the cards line up visually.
 */
export function BudgetEmptyHint({ heading, hint }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {heading}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-[28ch]">
          {hint}
        </p>
      )}
    </div>
  );
}
