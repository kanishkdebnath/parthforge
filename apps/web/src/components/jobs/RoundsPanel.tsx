import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import { RoundCard } from './RoundCard';
import { RoundFormDialog } from './RoundFormDialog';
import { useReorderRounds } from '@/hooks/useJobs';
import { useTour } from '@/components/tour/TourProvider';

interface RoundsPanelProps {
  job: JobApplication;
}

export function RoundsPanel({ job }: RoundsPanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const total = job.rounds.length;
  const done = job.rounds.filter((r) => r.outcome === 'passed').length;
  const { markComplete } = useTour();

  const reorder = useReorderRounds(job._id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = job.rounds.map((r) => r._id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    reorder.mutate(next);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Interview rounds
          </h3>
          {total > 0 && (
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium px-2 py-0.5 rounded-full">
              {done} of {total} done
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          data-tour="job-add-round"
          className="text-slate-700 dark:text-slate-300"
          onClick={() => {
            setAddOpen(true);
            markComplete('jobs-add-round');
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add round
        </Button>
      </div>

      {total === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 italic">
          No interview rounds yet. Add one when you have a phone screen scheduled.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={job.rounds.map((r) => r._id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2.5">
              {job.rounds.map((r, idx) => (
                <RoundCard key={r._id} jobId={job._id} index={idx + 1} round={r} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <RoundFormDialog jobId={job._id} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
