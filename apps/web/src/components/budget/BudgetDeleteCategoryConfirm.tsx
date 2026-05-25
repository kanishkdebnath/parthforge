import type { BudgetCategory } from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useArchiveBudgetCategory } from '@/hooks/useBudget';

interface Props {
  category: BudgetCategory | null;
  onClose: () => void;
}

export function BudgetDeleteCategoryConfirm({ category, onClose }: Props) {
  const archive = useArchiveBudgetCategory(category?._id ?? '');

  if (!category) return null;

  function onConfirm() {
    archive.mutate(undefined, {
      onSuccess: () => onClose(),
    });
  }

  return (
    <Dialog open={!!category} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive "{category.name}"?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Archived categories disappear from the input dropdown but their past
          transactions remain in historical reports (greyed). You can't hard-delete
          a category — archive is the only option.
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
