import { useNavigate } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import type { Roadmap } from '@pathforge/shared';
import { useRoadmaps } from '@/hooks/useRoadmaps';
import { cn } from '@/lib/utils';

/** Secondary dashboard widget. Highlights the most-recently-updated active
 *  roadmap with a progress bar, shows active + archived counts, and exposes
 *  "+ New" and "Open Roadmaps →" links. */
export function RoadmapsWidget() {
  const navigate = useNavigate();
  const { data: active = [], isLoading: loadingActive, isError: errorActive } =
    useRoadmaps({ archived: false });
  const { data: archived = [] } = useRoadmaps({ archived: true });

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
      <Header />
      <div className="mt-3 min-h-[72px]">
        {loadingActive ? (
          <div className="h-4 w-40 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        ) : errorActive ? (
          <div className="text-xs text-slate-400">Couldn't load.</div>
        ) : active.length === 0 ? (
          <EmptyState />
        ) : (
          <Highlight active={active} archived={archived.length} />
        )}
      </div>
      <Footer onNew={() => navigate('/roadmaps')} onOpen={() => navigate('/roadmaps')} />
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
        <MapIcon className="h-4 w-4" />
      </div>
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Roadmaps</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-sm text-slate-500 dark:text-slate-400">
      Break a goal into milestones with steps.
    </div>
  );
}

function Highlight({ active, archived }: { active: Roadmap[]; archived: number }) {
  const highlight = pickHighlight(active);
  const { completed, total } = countSteps(highlight);
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
        {highlight.title}
      </div>
      <div className="mt-1.5 h-1.5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={cn('h-full bg-sky-500')}
          style={{ width: `${pct}%` }}
          aria-label={`${completed} of ${total} steps`}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        {completed} of {total} steps
      </div>
      <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
        {active.length} active · {archived} archived
      </div>
    </div>
  );
}

function Footer({ onNew, onOpen }: { onNew: () => void; onOpen: () => void }) {
  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <button
        type="button"
        onClick={onNew}
        className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      >
        + New
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
      >
        Open Roadmaps →
      </button>
    </div>
  );
}

function pickHighlight(active: Roadmap[]): Roadmap {
  // Sort descending by updatedAt — the API already returns them this way, but
  // we re-sort defensively in case the caller's cache shape changes.
  return [...active].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0]!;
}

function countSteps(roadmap: Roadmap): { completed: number; total: number } {
  let completed = 0;
  let total = 0;
  for (const m of roadmap.milestones) {
    for (const s of m.steps) {
      total += 1;
      if (s.completed) completed += 1;
    }
  }
  return { completed, total };
}
