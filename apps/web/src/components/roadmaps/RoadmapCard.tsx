import { Link } from 'react-router-dom';
import type { Roadmap } from '@pathforge/shared';
import { roadmapOverallPct } from '@/lib/milestone-progress';
import { formatDeadline, isOverdue, pluralize } from '@/lib/formatters';
import { RingProgress } from './RingProgress';
import { cn } from '@/lib/utils';

interface Props {
  roadmap: Roadmap;
}

export function RoadmapCard({ roadmap }: Props) {
  const { pct, total } = roadmapOverallPct(roadmap);
  const isDone = total > 0 && pct === 100;
  const overdue = isOverdue(roadmap.deadline, isDone);
  const milestoneCount = roadmap.milestones.length;

  return (
    <Link
      to={`/roadmaps/${roadmap._id}`}
      className="group block bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'h-9 w-9 rounded-xl shrink-0 bg-gradient-to-br',
            isDone ? 'from-done to-emerald-600' : 'from-brand to-indigo-500'
          )}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight text-slate-900 truncate group-hover:text-slate-950">
            {roadmap.title}
          </h3>
          {roadmap.description && (
            <p className="mt-1 text-sm text-slate-600 line-clamp-2">{roadmap.description}</p>
          )}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between">
        <RingProgress pct={pct} done={isDone} size="sm" />
        <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
          <span>
            {milestoneCount} {pluralize(milestoneCount, 'milestone')}
          </span>
          {roadmap.deadline && (
            <span className={overdue ? 'text-overdue' : 'text-slate-500'}>
              {overdue ? 'overdue · ' : 'due '}
              {formatDeadline(roadmap.deadline)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
