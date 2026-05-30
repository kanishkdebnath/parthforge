import { useMemo, useState } from 'react';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetMonthSelector } from '@/components/budget/BudgetMonthSelector';
import { BudgetReportNarrative } from '@/components/budget/BudgetReportNarrative';
import { BudgetReportGroups } from '@/components/budget/BudgetReportGroups';
import { BudgetExportMenu } from '@/components/budget/BudgetExportMenu';
import {
  useBudgetCategories,
  useBudgetGroups,
  useBudgetReport,
  useBudgetTargets,
  useBudgetTransactions,
} from '@/hooks/useBudget';
import { currentIsoMonth } from '@/lib/budget-month';
import type { BudgetExportInput } from '@/lib/budget-export';
import type { CategoryKind } from '@pathforge/shared';

function monthLabel(month: string): string {
  const parts = month.split('-').map(Number);
  const y = parts[0] ?? new Date().getUTCFullYear();
  const m = parts[1] ?? 1;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export default function BudgetReportPage() {
  const [month, setMonth] = useState<string>(currentIsoMonth());
  const reportQ = useBudgetReport(month);
  const transactionsQ = useBudgetTransactions(month);
  const targetsQ = useBudgetTargets(month);
  const groupsQ = useBudgetGroups();
  const categoriesQ = useBudgetCategories();
  const allReady =
    reportQ.isSuccess &&
    transactionsQ.isSuccess &&
    targetsQ.isSuccess &&
    groupsQ.isSuccess &&
    categoriesQ.isSuccess;

  const exportInput: BudgetExportInput | null = useMemo(() => {
    if (!allReady) return null;
    const DEFAULT_KIND: CategoryKind = 'expense';
    const report = reportQ.data!;
    const groupsById = new Map(groupsQ.data!.map((g) => [g._id, g]));
    const catsById = new Map(categoriesQ.data!.map((c) => [c._id, c]));

    const transactions = transactionsQ.data!.map((tx) => {
      const cat = catsById.get(tx.categoryId);
      const grp = cat ? groupsById.get(cat.groupId) : undefined;
      return {
        date: new Date(tx.date).toISOString().slice(0, 10),
        groupName: grp?.name ?? '(unknown group)',
        categoryName: cat?.name ?? '(unknown category)',
        kind: cat?.kind ?? DEFAULT_KIND,
        amount: tx.amount,
        description: tx.description ?? '',
      };
    });

    // Build a lookup: categoryId → { actual, delta } from the report tree
    const reportCatById = new Map<string, { actual: number; delta: number; kind: 'income' | 'expense' }>();
    for (const g of report.groups) {
      for (const c of g.categories) {
        reportCatById.set(c.categoryId, { actual: c.actual, delta: c.delta, kind: g.kind });
      }
    }

    const targets = targetsQ.data!.map((t) => {
      const cat = catsById.get(t.categoryId);
      const grp = cat ? groupsById.get(cat.groupId) : undefined;
      const rc = reportCatById.get(t.categoryId);
      const actual = rc?.actual ?? 0;
      const kind: CategoryKind = rc?.kind ?? cat?.kind ?? DEFAULT_KIND;
      return {
        groupName: grp?.name ?? '(unknown group)',
        categoryName: cat?.name ?? '(unknown category)',
        kind,
        target: t.amount,
        actual,
        delta: rc?.delta ?? actual - t.amount,
      };
    });

    // Include report-side categories that have actuals but no stored target row (target=0)
    for (const [catId, rc] of reportCatById) {
      if (targetsQ.data!.some((t) => t.categoryId === catId)) continue;
      if (rc.actual === 0) continue;
      const cat = catsById.get(catId);
      const grp = cat ? groupsById.get(cat.groupId) : undefined;
      targets.push({
        groupName: grp?.name ?? '(unknown group)',
        categoryName: cat?.name ?? '(unknown category)',
        kind: rc.kind,
        target: 0,
        actual: rc.actual,
        delta: rc.delta,
      });
    }

    const recurringTemplateIds = new Set(
      transactionsQ.data!
        .map((tx) => tx.recurringTemplateId)
        .filter((id): id is string => Boolean(id))
    );

    const recurring = report.recurringDue.map((r) => ({
      label: r.label,
      dayOfMonth: r.dayOfMonth,
      amount: r.amount,
      applied: recurringTemplateIds.has(r.templateId),
    }));

    return {
      month,
      monthLabel: monthLabel(month),
      currency: report.currency,
      report,
      transactions,
      targets,
      recurring,
    };
  }, [
    allReady,
    month,
    reportQ.data,
    transactionsQ.data,
    targetsQ.data,
    groupsQ.data,
    categoriesQ.data,
  ]);

  const anyErrored =
    reportQ.isError ||
    transactionsQ.isError ||
    targetsQ.isError ||
    groupsQ.isError ||
    categoriesQ.isError;
  const disabledReason = !allReady
    ? anyErrored
      ? 'Report data failed to load'
      : 'Report data not loaded'
    : undefined;

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <div className="flex items-center justify-between mb-4">
        <BudgetMonthSelector month={month} onChange={setMonth} />
        <BudgetExportMenu input={exportInput} disabledReason={disabledReason} />
      </div>
      {reportQ.isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : reportQ.isError ? (
        <p className="text-sm text-red-600">Couldn't load report.</p>
      ) : !reportQ.data ? null : (
        <div className="space-y-6">
          <BudgetReportNarrative report={reportQ.data} />
          <BudgetReportGroups report={reportQ.data} />
        </div>
      )}
    </main>
  );
}
