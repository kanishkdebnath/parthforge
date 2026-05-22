import { useEffect, useMemo, useState } from 'react';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetGroupList } from '@/components/budget/BudgetGroupList';
import { BudgetCategoryList } from '@/components/budget/BudgetCategoryList';
import { useBudgetGroups } from '@/hooks/useBudget';

export default function BudgetCategoriesPage() {
  const { data: groups = [], isPending } = useBudgetGroups();
  const liveGroups = useMemo(
    () => groups.filter((g) => !g.archived),
    [groups]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select the first group as soon as data loads (or when the previous
  // selection is no longer in the live set).
  useEffect(() => {
    if (liveGroups.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !liveGroups.some((g) => g._id === selectedId)) {
      setSelectedId(liveGroups[0]!._id);
    }
  }, [liveGroups, selectedId]);

  const selected = liveGroups.find((g) => g._id === selectedId) ?? null;

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      {isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-8 items-start">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <BudgetGroupList
              groups={liveGroups}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <BudgetCategoryList
              selectedGroup={selected}
              groups={liveGroups}
            />
          </div>
        </div>
      )}
    </main>
  );
}
