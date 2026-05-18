import { Link } from 'react-router-dom';
import {
  Compass,
  Sparkles,
  Flame,
  Heart,
  Leaf,
  Waves,
  Sprout,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { Roadmap } from '@pathforge/shared';
import { roadmapOverallPct } from '@/lib/milestone-progress';
import { formatDeadline, isOverdue, pluralize } from '@/lib/formatters';
import { RingProgress } from './RingProgress';
import { cn } from '@/lib/utils';

interface Props {
  roadmap: Roadmap;
}

// Each palette pairs a gradient with a thematically resonant icon. Full
// class strings (no template interpolation) so Tailwind's JIT picks them up.
const PALETTES: { gradient: string; Icon: LucideIcon }[] = [
  { gradient: 'from-sky-500 to-indigo-500', Icon: Compass },
  { gradient: 'from-violet-500 to-fuchsia-500', Icon: Sparkles },
  { gradient: 'from-amber-500 to-orange-500', Icon: Flame },
  { gradient: 'from-rose-500 to-pink-500', Icon: Heart },
  { gradient: 'from-emerald-500 to-teal-500', Icon: Leaf },
  { gradient: 'from-cyan-500 to-blue-500', Icon: Waves },
  { gradient: 'from-lime-500 to-green-500', Icon: Sprout },
  { gradient: 'from-red-500 to-rose-500', Icon: Target },
];

const DONE_PALETTE = { gradient: 'from-done to-emerald-600', Icon: Trophy };

function paletteFor(id: string): { gradient: string; Icon: LucideIcon } {
  let sum = 0;
  for (let i = 0; i < id.length; i++) sum = (sum + id.charCodeAt(i)) >>> 0;
  return PALETTES[sum % PALETTES.length]!;
}

export function RoadmapCard({ roadmap }: Props) {
  const { pct, total } = roadmapOverallPct(roadmap);
  const isDone = total > 0 && pct === 100;
  const overdue = isOverdue(roadmap.deadline, isDone);
  const milestoneCount = roadmap.milestones.length;
  const { gradient, Icon } = isDone ? DONE_PALETTE : paletteFor(roadmap._id);

  return (
    <Link
      to={`/roadmaps/${roadmap._id}`}
      className="group block bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'h-10 w-10 rounded-xl shrink-0 bg-gradient-to-br flex items-center justify-center shadow-sm',
            gradient
          )}
        >
          <Icon className="h-5 w-5 text-white" strokeWidth={2.25} />
        </div>
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
