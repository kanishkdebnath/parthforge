import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BudgetInputRow } from '@/components/budget/BudgetInputRow';
import {
  useBudgetCategories,
  useBudgetReport,
  useCreateBudgetTransaction,
} from '@/hooks/useBudget';
import { formatMoney } from '@/lib/budget-formatting';
import { currentIsoMonth, formatMonthLabel } from '@/lib/budget-month';

export function BudgetWidget() {
  const navigate = useNavigate();
  const month = currentIsoMonth();
  const { data: report, isLoading, isError } = useBudgetReport(month);
  const { data: categories = [] } = useBudgetCategories();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const create = useCreateBudgetTransaction();

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
      <Header month={month} />
      <div className="mt-3 min-h-[110px]">
        {isLoading ? (
          <Skeleton />
        ) : isError || !report ? (
          <div className="text-xs text-slate-400">Couldn't load.</div>
        ) : report.totals.income === 0 && report.totals.expense === 0 ? (
          <EmptyState onOpen={() => navigate('/budget')} />
        ) : (
          <Body report={report} />
        )}
      </div>
      <Footer
        onAdd={() => setQuickAddOpen(true)}
        onOpen={() => navigate('/budget')}
      />
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Quick add — {formatMonthLabel(month)}</DialogTitle>
          </DialogHeader>
          <BudgetInputRow
            categories={categories}
            compact
            onSave={async (body) => {
              await create.mutateAsync(body);
              setQuickAddOpen(false);
            }}
            onCancel={() => setQuickAddOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Header({ month }: { month: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300">
        <Wallet className="h-4 w-4" />
      </div>
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Budget — {formatMonthLabel(month).split(' ')[0]}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
    </div>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div>
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Track expenses and income against monthly targets.
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-2 text-xs text-sky-600 dark:text-sky-400 hover:underline"
      >
        Add your first transaction →
      </button>
    </div>
  );
}

function Body({ report }: { report: import('@pathforge/shared').BudgetReport }) {
  const { totals, targetTotals, currency, groups } = report;
  const expenseTarget = targetTotals.expense;
  const pct = expenseTarget > 0
    ? Math.min(100, Math.round((totals.expense / expenseTarget) * 100))
    : 0;

  // Top three expense categories by actual descending.
  const topExpense = groups
    .filter((g) => g.kind === 'expense')
    .flatMap((g) => g.categories)
    .filter((c) => c.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 3);

  const netColor = totals.net >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-slate-500">Net so far</span>
        <span className={`text-base font-semibold tabular-nums ${netColor}`}>
          {totals.net >= 0 ? '+' : '−'}{formatMoney(Math.abs(totals.net), currency)}
        </span>
      </div>
      {expenseTarget > 0 ? (
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-slate-500">Spent</span>
            <span className="text-slate-700 dark:text-slate-300 tabular-nums">
              {formatMoney(totals.expense, currency)} of {formatMoney(expenseTarget, currency)}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${totals.expense > expenseTarget ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">{pct}% of plan</div>
        </div>
      ) : (
        <div className="text-xs text-slate-500">
          Spent {formatMoney(totals.expense, currency)} (no plan set).
        </div>
      )}
      {topExpense.length > 0 && (
        <div>
          <div className="text-[11px] text-slate-500 mb-1">Top categories</div>
          <ul className="space-y-0.5">
            {topExpense.map((c) => {
              const over = c.target > 0 && c.actual > c.target;
              return (
                <li
                  key={c.categoryId}
                  className="flex items-baseline justify-between text-xs"
                >
                  <span className="text-slate-700 dark:text-slate-300 truncate">{c.name}</span>
                  <span className="tabular-nums">
                    {formatMoney(c.actual, currency)}
                    {c.target > 0 && ` / ${formatMoney(c.target, currency)}`}
                    {over && <span className="ml-1 text-red-600">⚠</span>}
                    {!over && c.target > 0 && c.actual <= c.target && (
                      <span className="ml-1 text-emerald-600">✓</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Footer({ onAdd, onOpen }: { onAdd: () => void; onOpen: () => void }) {
  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <button
        type="button"
        onClick={onAdd}
        className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      >
        + Quick add
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
      >
        Open Budget →
      </button>
    </div>
  );
}
