import { useState } from 'react';
import { Pencil, Trash2, Play } from 'lucide-react';
import type {
  BudgetRecurringTemplate,
  BudgetCategory,
} from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import {
  useApplyBudgetRecurring,
  useDeleteBudgetRecurring,
} from '@/hooks/useBudget';
import { formatMoney } from '@/lib/budget-formatting';
import { currentIsoMonth } from '@/lib/budget-month';
import { BudgetRecurringFormDialog } from './BudgetRecurringFormDialog';

interface Props {
  templates: BudgetRecurringTemplate[];
  categories: BudgetCategory[];
  currency: string;
}

export function BudgetRecurringList({ templates, categories, currency }: Props) {
  const [editing, setEditing] = useState<BudgetRecurringTemplate | undefined>();
  const month = currentIsoMonth();

  const categoriesById = new Map(categories.map((c) => [c._id, c]));

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 text-center">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
          No recurring templates yet
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create one for things that repeat monthly — rent, salary, subscriptions.
          They never auto-create transactions; you click Apply each month.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {templates.map((t) => (
          <Row
            key={t._id}
            template={t}
            category={categoriesById.get(t.categoryId) ?? null}
            currency={currency}
            currentMonth={month}
            onEdit={() => setEditing(t)}
          />
        ))}
      </ul>
      <BudgetRecurringFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(undefined)}
        categories={categories}
        currency={currency}
        template={editing}
      />
    </>
  );
}

interface RowProps {
  template: BudgetRecurringTemplate;
  category: BudgetCategory | null;
  currency: string;
  currentMonth: string;
  onEdit: () => void;
}

function Row({ template, category, currency, currentMonth, onEdit }: RowProps) {
  const apply = useApplyBudgetRecurring(template._id);
  const del = useDeleteBudgetRecurring(template._id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const dueThisMonth = template.active && template.lastRunMonth !== currentMonth;
  const appliedThisMonth = template.lastRunMonth === currentMonth;

  return (
    <li className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {template.label}
          </span>
          {!template.active && (
            <span className="text-[10px] uppercase tracking-wide text-slate-500 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
              Inactive
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {category?.name ?? 'Unknown category'} · day {template.dayOfMonth} · {formatMoney(template.amount, currency)}
          {appliedThisMonth && ' · applied this month'}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={dueThisMonth ? 'default' : 'outline'}
          disabled={!dueThisMonth || apply.isPending}
          onClick={() => apply.mutate()}
        >
          <Play className="h-3.5 w-3.5 mr-1" /> Apply
        </Button>
        <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {confirmingDelete ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => del.mutate()}
            disabled={del.isPending}
            onBlur={() => setConfirmingDelete(false)}
          >
            Confirm
          </Button>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}
