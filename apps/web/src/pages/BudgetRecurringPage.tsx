import { useState } from 'react';
import { Plus } from 'lucide-react';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetRecurringList } from '@/components/budget/BudgetRecurringList';
import { BudgetRecurringFormDialog } from '@/components/budget/BudgetRecurringFormDialog';
import { Button } from '@/components/ui/button';
import {
  useBudgetCategories,
  useBudgetRecurring,
} from '@/hooks/useBudget';
import { useMe } from '@/hooks/useAuth';

export default function BudgetRecurringPage() {
  const { data: templates = [], isPending } = useBudgetRecurring();
  const { data: categories = [] } = useBudgetCategories();
  const { data: me } = useMe();
  const currency = me?.currency ?? 'INR';
  const [newOpen, setNewOpen] = useState(false);

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Templates for monthly repeats. They never auto-create transactions —
          you Apply them each month.
        </p>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New template
        </Button>
      </div>

      {isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <BudgetRecurringList
          templates={templates}
          categories={categories}
          currency={currency}
        />
      )}

      <BudgetRecurringFormDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        categories={categories}
      />
    </main>
  );
}
