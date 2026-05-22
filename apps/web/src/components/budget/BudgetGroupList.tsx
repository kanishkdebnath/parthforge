import { useState } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Archive, Plus } from 'lucide-react';
import type { BudgetCategoryGroup } from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import { useReorderBudgetGroups } from '@/hooks/useBudget';
import { BudgetGroupDialog } from './BudgetGroupDialog';
import { BudgetDeleteGroupConfirm } from './BudgetDeleteGroupConfirm';

interface Props {
  groups: BudgetCategoryGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function BudgetGroupList({ groups, selectedId, onSelect }: Props) {
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetCategoryGroup | undefined>();
  const [archiving, setArchiving] = useState<BudgetCategoryGroup | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reorder = useReorderBudgetGroups();

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groups.findIndex((g) => g._id === active.id);
    const newIndex = groups.findIndex((g) => g._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(groups, oldIndex, newIndex);
    reorder.mutate(reordered.map((g) => g._id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Groups
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New
        </Button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={groups.map((g) => g._id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-1">
            {groups.map((g) => (
              <GroupRow
                key={g._id}
                group={g}
                selected={g._id === selectedId}
                onSelect={() => onSelect(g._id)}
                onEdit={() => setEditing(g)}
                onArchive={() => setArchiving(g)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <BudgetGroupDialog open={newOpen} onOpenChange={setNewOpen} />
      <BudgetGroupDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        group={editing}
      />
      <BudgetDeleteGroupConfirm
        group={archiving}
        onClose={() => setArchiving(null)}
      />
    </div>
  );
}

interface GroupRowProps {
  group: BudgetCategoryGroup;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
}

function GroupRow({ group, selected, onSelect, onEdit, onArchive }: GroupRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: group._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors ${
        selected
          ? 'bg-slate-100 dark:bg-slate-800'
          : 'hover:bg-slate-50 dark:hover:bg-slate-900'
      }`}
      onClick={onSelect}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: group.color }}
      />
      <span className="flex-1 text-sm text-slate-900 dark:text-slate-100 truncate">
        {group.name}
      </span>
      <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          aria-label="Edit group"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onArchive();
          }}
          className="p-1 text-slate-500 hover:text-red-600"
          aria-label="Archive group"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
