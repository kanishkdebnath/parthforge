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
import type { Roadmap } from '@pathforge/shared';
import { MilestoneCard } from './MilestoneCard';
import { useReorderMilestones } from '@/hooks/useRoadmaps';

interface Props {
  roadmap: Roadmap;
}

export function MilestoneList({ roadmap }: Props) {
  const reorder = useReorderMilestones(roadmap._id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = roadmap.milestones.map((m) => m._id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    reorder.mutate(next);
  };

  if (roadmap.milestones.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={roadmap.milestones.map((m) => m._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {roadmap.milestones.map((m) => (
            <MilestoneCard key={m._id} roadmapId={roadmap._id} milestone={m} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
