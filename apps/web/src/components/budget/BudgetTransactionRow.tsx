import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { BudgetTransaction } from '@pathforge/shared';
import { useDeleteBudgetTransaction } from '@/hooks/useBudget';
import { formatMoney } from '@/lib/budget-formatting';

interface Props {
  transaction: BudgetTransaction;
  currency: string;
  onEdit: () => void;
}

export function BudgetTransactionRow({ transaction, currency, onEdit }: Props) {
  const del = useDeleteBudgetTransaction(transaction._id);
  const [confirming, setConfirming] = useState(false);

  const dateLabel = new Date(transaction.date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="group flex items-start gap-3 px-3 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums">
            {formatMoney(transaction.amount, currency)}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {dateLabel}
          </span>
        </div>
        {transaction.description && (
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {transaction.description}
          </div>
        )}
      </div>
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEdit}
          className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {confirming ? (
          <button
            type="button"
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="p-1 text-red-600 text-xs font-medium"
            aria-label="Confirm delete"
          >
            Confirm
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            onBlur={() => setConfirming(false)}
            className="p-1 text-slate-500 hover:text-red-600"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
