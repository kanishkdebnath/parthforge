import { formatMoney } from '@/lib/budget-formatting';

interface Props {
  income: number;
  expense: number;
  net: number;
  currency: string;
}

export function BudgetNetBand({ income, expense, net, currency }: Props) {
  const netColor = net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3 flex items-center gap-6">
      <Stat label="Income" value={formatMoney(income, currency)} valueClass="text-emerald-600 dark:text-emerald-400" />
      <Stat label="Expense" value={formatMoney(expense, currency)} valueClass="text-red-600 dark:text-red-400" />
      <div className="ml-auto text-right">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Net</div>
        <div className={`text-lg font-semibold tabular-nums ${netColor}`}>
          {net >= 0 ? '+' : '−'}{formatMoney(Math.abs(net), currency)}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-sm font-medium tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );
}
