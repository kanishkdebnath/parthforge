import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreHorizontal, Link2 } from 'lucide-react';
import type { Step } from '@pathforge/shared';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InlineEditableTitle } from '@/components/InlineEditable';
import { LinkChips } from './LinkChips';
import { EditStepLinksDialog } from './EditStepLinksDialog';
import { useUpdateStep, useDeleteStep } from '@/hooks/useRoadmaps';
import { useTour } from '@/components/tour/TourProvider';
import { cn } from '@/lib/utils';

interface Props {
  roadmapId: string;
  milestoneId: string;
  step: Step;
}

export function StepRow({ roadmapId, milestoneId, step }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step._id,
  });
  const updateStep = useUpdateStep(roadmapId, milestoneId);
  const deleteStep = useDeleteStep(roadmapId, milestoneId, step._id);
  const [linksOpen, setLinksOpen] = useState(false);
  const { markComplete } = useTour();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-start gap-2.5 py-1.5 pl-1 pr-2 rounded-md',
          isDragging && 'bg-white dark:bg-slate-900 shadow-sm ring-1 ring-brand-ring',
          !isDragging && 'hover:bg-slate-50 dark:hover:bg-slate-800'
        )}
      >
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag step"
          className="mt-1 text-slate-200 opacity-0 group-hover:opacity-100 hover:text-slate-500 transition-opacity shrink-0"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Checkbox
          data-tour="step-checkbox"
          checked={step.completed}
          onCheckedChange={(c) => {
            updateStep.mutate({ stepId: step._id, patch: { completed: c === true } });
            markComplete('roadmaps-toggle-step');
          }}
          className={cn(
            'mt-1 transition-colors',
            step.completed && 'bg-brand border-brand data-[state=checked]:bg-brand'
          )}
        />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'text-sm transition-colors duration-150',
              step.completed ? 'text-slate-400 dark:text-slate-500 line-through decoration-slate-300' : 'text-slate-900 dark:text-slate-100'
            )}
          >
            <InlineEditableTitle
              value={step.title}
              onSave={(next) => {
                void updateStep.mutateAsync({ stepId: step._id, patch: { title: next } });
              }}
            />
          </div>
          <LinkChips links={step.links} />
        </div>

        <button
          type="button"
          onClick={() => setLinksOpen(true)}
          aria-label="Edit links"
          className={cn(
            'mt-1 text-slate-300 dark:text-slate-600 hover:text-brand transition-opacity shrink-0',
            step.links.length > 0 ? 'opacity-60' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Step actions"
            className="mt-0.5 flex h-6 w-6 items-center justify-center rounded text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-opacity shrink-0"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setLinksOpen(true)}>Edit links</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => deleteStep.mutate()}
              className="text-overdue focus:text-overdue"
            >
              Delete step
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <EditStepLinksDialog
        roadmapId={roadmapId}
        milestoneId={milestoneId}
        step={step}
        open={linksOpen}
        onOpenChange={setLinksOpen}
      />
    </>
  );
}
