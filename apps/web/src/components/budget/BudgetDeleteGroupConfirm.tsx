import type { BudgetCategoryGroup } from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useArchiveBudgetGroup } from '@/hooks/useBudget';

interface Props {
  group: BudgetCategoryGroup | null;
  onClose: () => void;
}

export function BudgetDeleteGroupConfirm({ group, onClose }: Props) {
  const archive = useArchiveBudgetGroup(group?._id ?? '');

  if (!group) return null;

  function onConfirm() {
    archive.mutate(undefined, {
      onSuccess: () => onClose(),
    });
  }

  return (
    <Dialog open={!!group} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive "{group.name}"?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Archived groups are hidden from the input dropdown but stay visible
          in historical month reports. You'll get an error if this group still
          has any live categories — move or archive them first.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={archive.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={archive.isPending}>
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
