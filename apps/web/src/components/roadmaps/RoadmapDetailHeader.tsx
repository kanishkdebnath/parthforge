import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import type { Roadmap } from '@pathforge/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InlineEditableTitle, InlineEditableText, InlineEditableDate } from '@/components/InlineEditable';
import { useUpdateRoadmap, useDeleteRoadmap, useArchiveRoadmap } from '@/hooks/useRoadmaps';
import { roadmapOverallPct } from '@/lib/milestone-progress';
import { formatDeadline, isOverdue, pluralize } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface Props {
  roadmap: Roadmap;
}

export function RoadmapDetailHeader({ roadmap }: Props) {
  const navigate = useNavigate();
  const updateRoadmap = useUpdateRoadmap(roadmap._id);
  const deleteRoadmap = useDeleteRoadmap(roadmap._id);
  const archive = useArchiveRoadmap(roadmap._id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { pct, done, total } = roadmapOverallPct(roadmap);
  const isDone = total > 0 && done === total;
  const overdue = isOverdue(roadmap.deadline, isDone);

  return (
    <header>
      <Link
        to={roadmap.archived ? '/roadmaps/archived' : '/roadmaps'}
        className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        ← {roadmap.archived ? 'Archive' : 'Roadmaps'}
      </Link>

      <div className="mt-6 flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="smcp text-xs text-slate-500">
            {roadmap.archived ? 'Archived' : 'In pursuit'} {isDone && '· complete'}
          </p>
          <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight text-slate-900 leading-tight">
            <InlineEditableTitle
              value={roadmap.title}
              onSave={(next) => {
                void updateRoadmap.mutateAsync({ title: next });
              }}
              className="dropcap"
            />
          </h1>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {roadmap.archived ? (
              <DropdownMenuItem onSelect={() => archive.unarchive()}>Unarchive</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => archive.archive()}>Archive</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setConfirmDelete(true)}
              className="text-overdue focus:text-overdue"
            >
              Delete forever
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 max-w-2xl text-slate-700">
        <InlineEditableText
          value={roadmap.description ?? ''}
          onSave={(next) => void updateRoadmap.mutateAsync({ description: next })}
        />
      </div>

      <div className="mt-4 flex items-baseline gap-6">
        <InlineEditableDate
          value={roadmap.deadline}
          onSave={(d) => void updateRoadmap.mutateAsync({ deadline: d })}
        />
        {overdue && (
          <span className="smcp text-xs text-overdue">Overdue</span>
        )}
      </div>

      <div className="mt-8 max-w-2xl">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2 tabular">
          <span>
            {done} of {total} {pluralize(total, 'step')} complete
          </span>
          <span className={cn(isDone && 'text-done font-medium')}>{pct}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', isDone ? 'bg-done' : 'bg-active')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
              Delete this roadmap?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete "{roadmap.title}" along with its{' '}
              {roadmap.milestones.length} {pluralize(roadmap.milestones.length, 'milestone')} and
              every step inside. Cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteRoadmap.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  await deleteRoadmap.mutateAsync();
                  navigate(roadmap.archived ? '/roadmaps/archived' : '/roadmaps');
                } catch {
                  // Hook's onError already surfaced a toast. Keep the dialog
                  // open so the user can retry without re-opening.
                }
              }}
              disabled={deleteRoadmap.isPending}
              className="bg-overdue text-overdue-foreground hover:bg-overdue/90"
            >
              {deleteRoadmap.isPending ? 'Deleting…' : 'Delete forever'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
