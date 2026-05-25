import { useState } from 'react';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetMonthSelector } from '@/components/budget/BudgetMonthSelector';
import { BudgetTargetsForm } from '@/components/budget/BudgetTargetsForm';
import { useBudgetGroups, useBudgetCategories } from '@/hooks/useBudget';
import { useMe } from '@/hooks/useAuth';
import { currentIsoMonth } from '@/lib/budget-month';

export default function BudgetPlanPage() {
  const [month, setMonth] = useState<string>(currentIsoMonth());
  const { data: groups = [] } = useBudgetGroups();
  const { data: categories = [] } = useBudgetCategories();
  const { data: me } = useMe();
  const currency = me?.currency ?? 'INR';

  const liveGroups = groups.filter((g) => !g.archived);

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <div className="flex items-center justify-between mb-4">
        <BudgetMonthSelector month={month} onChange={setMonth} />
      </div>
      <BudgetTargetsForm
        month={month}
        groups={liveGroups}
        categories={categories}
        currency={currency}
      />
    </main>
  );
}
