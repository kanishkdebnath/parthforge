import { useState } from 'react';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetMonthSelector } from '@/components/budget/BudgetMonthSelector';
import { BudgetReportNarrative } from '@/components/budget/BudgetReportNarrative';
import { BudgetReportGroups } from '@/components/budget/BudgetReportGroups';
import { useBudgetReport } from '@/hooks/useBudget';
import { currentIsoMonth } from '@/lib/budget-month';

export default function BudgetReportPage() {
  const [month, setMonth] = useState<string>(currentIsoMonth());
  const { data: report, isPending, isError } = useBudgetReport(month);

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <div className="flex items-center justify-between mb-4">
        <BudgetMonthSelector month={month} onChange={setMonth} />
      </div>
      {isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : isError ? (
        <p className="text-sm text-red-600">Couldn't load report.</p>
      ) : !report ? null : (
        <div className="space-y-6">
          <BudgetReportNarrative report={report} />
          <BudgetReportGroups report={report} />
        </div>
      )}
    </main>
  );
}
