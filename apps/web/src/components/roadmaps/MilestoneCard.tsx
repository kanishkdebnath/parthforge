import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreHorizontal } from 'lucide-react';
import type { Milestone } from '@pathforge/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InlineEditableTitle, InlineEditableText, InlineEditableDate } from '@/components/InlineEditable';
import { DeleteMilestoneConfirm } from './DeleteMilestoneConfirm';
import { useUpdateMilestone, useDeleteMilestone } from '@/hooks/useRoadmaps';
import { milestoneCompletionPct } from '@/lib/milestone-progress';
import { isOverdue, pluralize } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface Props {
  roadmapId: string;
  milestone: Milestone;
  index: number;
}

export function MilestoneCard({ roadmapId, milestone, index }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: milestone._id,
  });
  const updateMilestone = useUpdateMilestone(roadmapId, milestone._id);
  const deleteMilestone = useDeleteMilestone(roadmapId, milestone._id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pct = milestoneCompletionPct(milestone);
  const isDone = milestone.steps.length > 0 && milestone.steps.every((s) => s.completed);
  const overdue = isOverdue(milestone.deadline, isDone);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-md border bg-white px-5 py-5 transition-shadow',
        isDragging ? 'shadow-lg scale-[1.01] border-active' : 'border-slate-200 shadow-none'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="mt-1 cursor-grab text-slate-300 hover:text-slate-500 transition-colors"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="smcp text-xs text-slate-500 shrink-0 tabular">
              M.{String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="min-w-0 flex-1 font-display text-xl font-semibold tracking-tight text-slate-900">
              <InlineEditableTitle
                value={milestone.title}
                onSave={(next) => {
                  void updateMilestone.mutateAsync({ title: next });
                }}
              />
            </h3>
            <InlineEditableDate
              value={milestone.deadline}
              onSave={(d) => {
                void updateMilestone.mutateAsync({ deadline: d });
              }}
              className="text-xs"
            />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => setConfirmDelete(true)}
                  className="text-overdue focus:text-overdue"
                >
                  Delete milestone
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-2 text-sm text-slate-600">
            <InlineEditableText
              value={milestone.description ?? ''}
              onSave={(next) => {
                void updateMilestone.mutateAsync({ description: next });
              }}
              placeholder="add a description…"
            />
          </div>

          {milestone.steps.length === 0 ? (
            <p className="mt-4 text-xs text-slate-400 italic">Add steps to track progress.</p>
          ) : (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5 tabular">
                <span>
                  {milestone.steps.filter((s) => s.completed).length} of {milestone.steps.length}{' '}
                  {pluralize(milestone.steps.length, 'step')}
                </span>
                <span className={cn(isDone && 'text-done font-medium', overdue && 'text-overdue')}>
                  {pct}%
                </span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    isDone ? 'bg-done' : overdue ? 'bg-overdue' : 'bg-active'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs text-slate-400 italic">(Step list arrives in Task 8.)</p>
          </div>
        </div>
      </div>

      <DeleteMilestoneConfirm
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={milestone.title}
        stepCount={milestone.steps.length}
        pending={deleteMilestone.isPending}
        onConfirm={async () => {
          try {
            await deleteMilestone.mutateAsync();
            setConfirmDelete(false);
          } catch {
            // Hook's onError surfaced a toast; keep dialog open for retry.
          }
        }}
      />
    </div>
  );
}
