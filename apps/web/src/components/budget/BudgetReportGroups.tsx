import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BudgetReport, BudgetReportGroupRow } from '@pathforge/shared';
import { formatMoney } from '@/lib/budget-formatting';

interface Props {
  report: BudgetReport;
}

export function BudgetReportGroups({ report }: Props) {
  // Render expense groups first (most users care more), then income.
  const expense = report.groups.filter((g) => g.kind === 'expense');
  const income = report.groups.filter((g) => g.kind === 'income');

  return (
    <div className="space-y-6">
      {expense.length > 0 && (
        <Section title="Expenses" rows={expense} currency={report.currency} />
      )}
      {income.length > 0 && (
        <Section title="Incomes" rows={income} currency={report.currency} />
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: BudgetReportGroupRow[];
  currency: string;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-2">{title}</h2>
      <div className="space-y-2">
        {rows.map((g) => (
          <GroupRow key={g.groupId} group={g} currency={currency} />
        ))}
      </div>
    </section>
  );
}

function GroupRow({
  group,
  currency,
}: {
  group: BudgetReportGroupRow;
  currency: string;
}) {
  const [open, setOpen] = useState(true);
  const overTarget = group.target > 0 && group.actual > group.target;
  const underTarget = group.target > 0 && group.actual < group.target;
  const pct = group.target > 0 ? Math.min(100, Math.round((group.actual / group.target) * 100)) : 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900 text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        )}
        <span className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {group.name}
        </span>
        <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
          {formatMoney(group.actual, currency)}
        </span>
        {group.target > 0 && (
          <span className="text-xs tabular-nums text-slate-500">
            / {formatMoney(group.target, currency)}
          </span>
        )}
        {overTarget && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
            over
          </span>
        )}
        {underTarget && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
            under
          </span>
        )}
      </button>
      {group.target > 0 && (
        <div className="px-4 pb-2">
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${overTarget ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      )}
      {open && group.categories.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-2">
          {group.categories.map((c) => {
            const cOverTarget = c.target > 0 && c.actual > c.target;
            const cUnderTarget = c.target > 0 && c.actual < c.target;
            const cPct = c.target > 0 ? Math.min(100, Math.round((c.actual / c.target) * 100)) : 0;
            return (
              <div key={c.categoryId} className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                    {c.name}
                  </span>
                  <span className="text-sm tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(c.actual, currency)}
                  </span>
                  {c.target > 0 && (
                    <span className="text-xs tabular-nums text-slate-500">
                      / {formatMoney(c.target, currency)}
                    </span>
                  )}
                  {cOverTarget && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                  {cUnderTarget && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                </div>
                {c.target > 0 && (
                  <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${cOverTarget ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, cPct)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
