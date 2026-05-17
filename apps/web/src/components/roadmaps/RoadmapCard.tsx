import { Link } from 'react-router-dom';
import type { Roadmap } from '@pathforge/shared';
import { roadmapOverallPct } from '@/lib/milestone-progress';
import { formatDeadline, isOverdue, pluralize } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface Props {
  roadmap: Roadmap;
  index: number;
}

export function RoadmapCard({ roadmap, index }: Props) {
  const { pct, done, total } = roadmapOverallPct(roadmap);
  const isDone = total > 0 && done === total;
  const overdue = isOverdue(roadmap.deadline, isDone);
  const milestoneCount = roadmap.milestones.length;

  return (
    <Link
      to={`/roadmaps/${roadmap._id}`}
      className="group block rounded-md border border-slate-200 bg-white p-6 transition-all hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-baseline justify-between">
        <span className="smcp text-xs text-slate-500">RM.{String(index + 1).padStart(2, '0')}</span>
        {roadmap.deadline && (
          <span
            className={cn(
              'font-display italic lowercase text-sm',
              overdue ? 'text-overdue' : 'text-slate-500'
            )}
          >
            due {formatDeadline(roadmap.deadline)}
          </span>
        )}
      </div>

      <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-slate-900 group-hover:text-slate-950">
        {roadmap.title}
      </h2>

      {roadmap.description && (
        <p className="mt-2 text-sm text-slate-600 line-clamp-2">{roadmap.description}</p>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2 tabular">
          <span>
            {done} of {total} {pluralize(total, 'step')}
          </span>
          <span className={cn(isDone && 'text-done font-medium')}>{pct}%</span>
        </div>
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', isDone ? 'bg-done' : 'bg-active')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-4 text-xs text-slate-500 tabular">
        {milestoneCount} {pluralize(milestoneCount, 'milestone')}
      </div>
    </Link>
  );
}
