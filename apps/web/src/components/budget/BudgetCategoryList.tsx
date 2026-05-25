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
import type {
  BudgetCategory,
  BudgetCategoryGroup,
} from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import {
  useBudgetCategories,
  useReorderBudgetCategories,
} from '@/hooks/useBudget';
import { BudgetCategoryDialog } from './BudgetCategoryDialog';
import { BudgetDeleteCategoryConfirm } from './BudgetDeleteCategoryConfirm';
import { BudgetEmptyHint } from './BudgetEmptyHint';

interface Props {
  selectedGroup: BudgetCategoryGroup | null;
  groups: BudgetCategoryGroup[];
}

export function BudgetCategoryList({ selectedGroup, groups }: Props) {
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetCategory | undefined>();
  const [archiving, setArchiving] = useState<BudgetCategory | null>(null);

  const { data: allCategories = [] } = useBudgetCategories();
  // Show non-archived only; the categories management page is for live items.
  const liveInGroup = selectedGroup
    ? allCategories.filter(
        (c) => c.groupId === selectedGroup._id && !c.archived
      )
    : [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const reorder = useReorderBudgetCategories(selectedGroup?._id ?? '');

  function onDragEnd(event: DragEndEvent) {
    if (!selectedGroup) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = liveInGroup.findIndex((c) => c._id === active.id);
    const newIndex = liveInGroup.findIndex((c) => c._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(liveInGroup, oldIndex, newIndex);
    reorder.mutate(reordered.map((c) => c._id));
  }

  if (!selectedGroup) {
    return (
      <BudgetEmptyHint
        heading={groups.length === 0 ? 'No groups yet' : 'Pick a group'}
        hint={
          groups.length === 0
            ? 'Use + New on the left to create your first group.'
            : 'Select one on the left to see its categories.'
        }
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            {selectedGroup.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {liveInGroup.length} {liveInGroup.length === 1 ? 'category' : 'categories'}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setNewOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New
        </Button>
      </div>

      {liveInGroup.length === 0 ? (
        <BudgetEmptyHint
          heading="No categories in this group yet"
          hint="Use + New above to add one."
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={liveInGroup.map((c) => c._id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1">
              {liveInGroup.map((c) => (
                <CategoryRow
                  key={c._id}
                  category={c}
                  groupColor={selectedGroup.color}
                  onEdit={() => setEditing(c)}
                  onArchive={() => setArchiving(c)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <BudgetCategoryDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        groups={groups}
        defaultGroupId={selectedGroup._id}
      />
      <BudgetCategoryDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        groups={groups}
        category={editing}
      />
      <BudgetDeleteCategoryConfirm
        category={archiving}
        onClose={() => setArchiving(null)}
      />
    </div>
  );
}

interface CategoryRowProps {
  category: BudgetCategory;
  groupColor: string;
  onEdit: () => void;
  onArchive: () => void;
}

function CategoryRow({ category, groupColor, onEdit, onArchive }: CategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: category._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const color = category.color ?? groupColor;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="touch-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 text-sm text-slate-900 dark:text-slate-100 truncate">
        {category.name}
      </span>
      <span className="text-[11px] text-slate-500 capitalize">
        {category.kind}
      </span>
      <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEdit}
          className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          aria-label="Edit category"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="p-1 text-slate-500 hover:text-red-600"
          aria-label="Archive category"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
