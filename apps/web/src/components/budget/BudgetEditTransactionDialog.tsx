import type {
  BudgetCategory,
  BudgetTransaction,
} from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BudgetInputRow } from './BudgetInputRow';
import { useUpdateBudgetTransaction } from '@/hooks/useBudget';

interface Props {
  transaction: BudgetTransaction | null;
  categories: BudgetCategory[];
  onClose: () => void;
}

export function BudgetEditTransactionDialog({
  transaction,
  categories,
  onClose,
}: Props) {
  const update = useUpdateBudgetTransaction(transaction?._id ?? '');

  if (!transaction) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
        </DialogHeader>
        <BudgetInputRow
          categories={categories}
          initial={transaction}
          compact
          onSave={async (body) => {
            await update.mutateAsync({
              amount: body.amount,
              categoryId: body.categoryId,
              date: body.date,
              description: body.description ?? null,
            });
            onClose();
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
