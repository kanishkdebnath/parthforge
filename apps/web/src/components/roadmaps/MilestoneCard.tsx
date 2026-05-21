import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreHorizontal, ChevronDown, ChevronRight } from 'lucide-react';
import type { Milestone } from '@pathforge/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InlineEditableTitle } from '@/components/InlineEditable';
import { RingProgress } from './RingProgress';
import { EditMilestoneDialog } from './EditMilestoneDialog';
import { DeleteMilestoneConfirm } from './DeleteMilestoneConfirm';
import { StepList } from './StepList';
import { AddStepInline } from './AddStepInline';
import { useUpdateMilestone, useDeleteMilestone } from '@/hooks/useRoadmaps';
import { milestoneCompletionPct } from '@/lib/milestone-progress';
import { isOverdue } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface Props {
  roadmapId: string;
  milestone: Milestone;
}

export function MilestoneCard({ roadmapId, milestone }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: milestone._id,
  });
  const updateMilestone = useUpdateMilestone(roadmapId, milestone._id);
  const deleteMilestone = useDeleteMilestone(roadmapId, milestone._id);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
        'bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm transition-shadow',
        isDragging && 'shadow-md ring-2 ring-brand-ring'
      )}
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          data-tour="milestone-drag-handle"
          aria-label="Drag to reorder milestone"
          className="cursor-grab text-slate-300 dark:text-slate-600 hover:text-slate-500 transition-colors shrink-0"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <RingProgress pct={pct} done={isDone} size="sm" />
        <h3 className="flex-1 min-w-0 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          <InlineEditableTitle
            value={milestone.title}
            onSave={(next) => {
              void updateMilestone.mutateAsync({ title: next });
            }}
          />
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
          {milestone.steps.filter((s) => s.completed).length} / {milestone.steps.length}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 transition-colors shrink-0"
          aria-label={collapsed ? 'Expand milestone' : 'Collapse milestone'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Milestone actions"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors shrink-0"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              Edit milestone
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setConfirmDelete(true)}
              className="text-overdue focus:text-overdue"
            >
              Delete milestone
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {milestone.description && !collapsed && (
        <p className="mt-3 ml-11 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{milestone.description}</p>
      )}

      {!collapsed && (
        <div className="mt-3">
          {milestone.deadline && (
            <p
              className={cn(
                'ml-11 mb-2 text-xs tabular-nums',
                overdue ? 'text-overdue' : 'text-slate-500 dark:text-slate-400'
              )}
            >
              {overdue
                ? 'Overdue'
                : `due ${new Date(milestone.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </p>
          )}
          <StepList roadmapId={roadmapId} milestoneId={milestone._id} steps={milestone.steps} />
          <AddStepInline roadmapId={roadmapId} milestoneId={milestone._id} />
        </div>
      )}

      <EditMilestoneDialog
        roadmapId={roadmapId}
        milestone={milestone}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
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
            // Hook's onError already toasted.
          }
        }}
      />
    </div>
  );
}
