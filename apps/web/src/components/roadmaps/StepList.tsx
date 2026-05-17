import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Step } from '@pathforge/shared';
import { StepRow } from './StepRow';
import { useReorderSteps } from '@/hooks/useRoadmaps';

interface Props {
  roadmapId: string;
  milestoneId: string;
  steps: Step[];
}

export function StepList({ roadmapId, milestoneId, steps }: Props) {
  const reorder = useReorderSteps(roadmapId, milestoneId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = steps.map((s) => s._id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    reorder.mutate(next);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={steps.map((s) => s._id)} strategy={verticalListSortingStrategy}>
        <div className="ml-9 space-y-0">
          {steps.map((s) => (
            <StepRow key={s._id} roadmapId={roadmapId} milestoneId={milestoneId} step={s} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
