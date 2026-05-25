import type { BudgetReport } from '@pathforge/shared';
import { formatMoney } from '@/lib/budget-formatting';

interface Props {
  report: BudgetReport;
}

export function BudgetReportNarrative({ report }: Props) {
  const { totals, targetTotals, currency, narrative } = report;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6 space-y-3">
      <p className="text-base text-slate-900 dark:text-slate-100 leading-relaxed">
        {narrative}
      </p>
      <div className="flex gap-6 text-sm">
        <Headline label="Income" amount={totals.income} target={targetTotals.income} currency={currency} positive />
        <Headline label="Expense" amount={totals.expense} target={targetTotals.expense} currency={currency} />
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Net</div>
          <div
            className={`text-base font-semibold tabular-nums ${
              totals.net >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {totals.net >= 0 ? '+' : '−'}{formatMoney(Math.abs(totals.net), currency)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Headline({
  label,
  amount,
  target,
  currency,
  positive = false,
}: {
  label: string;
  amount: number;
  target: number;
  currency: string;
  positive?: boolean;
}) {
  const color = positive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${color}`}>
        {formatMoney(amount, currency)}
      </div>
      {target > 0 && (
        <div className="text-[11px] text-slate-500">of {formatMoney(target, currency)}</div>
      )}
    </div>
  );
}
