import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Archive, Trash2 } from 'lucide-react';
import type { Roadmap } from '@pathforge/shared';
import { RingProgress } from './RingProgress';
import { EditRoadmapDialog } from './EditRoadmapDialog';
import { DeleteRoadmapConfirm } from './DeleteRoadmapConfirm';
import { useArchiveRoadmap } from '@/hooks/useRoadmaps';
import { roadmapOverallPct } from '@/lib/milestone-progress';
import { formatDeadline, isOverdue, pluralize } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface Props {
  roadmap: Roadmap;
}

export function RoadmapSidebar({ roadmap }: Props) {
  const archive = useArchiveRoadmap(roadmap._id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { pct, done, total } = roadmapOverallPct(roadmap);
  const isDone = total > 0 && pct === 100;
  const overdue = isOverdue(roadmap.deadline, isDone);

  return (
    <>
      <aside className="w-full lg:w-[280px] lg:shrink-0 lg:sticky lg:top-20 lg:self-start space-y-6">
        <Link
          to={roadmap.archived ? '/roadmaps/archived' : '/roadmaps'}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {roadmap.archived ? 'Archive' : 'Roadmaps'}
        </Link>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 break-words">
            {roadmap.title}
          </h1>
          {roadmap.description && (
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{roadmap.description}</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <RingProgress pct={pct} done={isDone} size="lg" />
          <div className="text-xs text-slate-500 text-center tabular-nums">
            {done} of {total} {pluralize(total, 'step')}
            {roadmap.deadline && (
              <>
                <br />
                <span className={overdue ? 'text-overdue' : ''}>
                  {overdue ? 'overdue · ' : 'due '}
                  {formatDeadline(roadmap.deadline)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-1 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit details
          </button>
          <button
            type="button"
            onClick={() => (roadmap.archived ? archive.unarchive() : archive.archive())}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            {roadmap.archived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors',
              'text-red-700 hover:bg-red-50'
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete forever
          </button>
        </div>
      </aside>

      <EditRoadmapDialog roadmap={roadmap} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteRoadmapConfirm roadmap={roadmap} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
