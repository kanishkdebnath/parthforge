import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetMonthSelector } from '@/components/budget/BudgetMonthSelector';
import { BudgetInputRow } from '@/components/budget/BudgetInputRow';
import { BudgetNetBand } from '@/components/budget/BudgetNetBand';
import { BudgetLogColumn } from '@/components/budget/BudgetLogColumn';
import { BudgetEditTransactionDialog } from '@/components/budget/BudgetEditTransactionDialog';
import {
  useBudgetCategories,
  useBudgetGroups,
  useBudgetTransactions,
  useCreateBudgetTransaction,
} from '@/hooks/useBudget';
import { useMe } from '@/hooks/useAuth';
import { currentIsoMonth, toIsoMonth } from '@/lib/budget-month';
import type { BudgetTransaction } from '@pathforge/shared';

export default function BudgetPage() {
  const [month, setMonth] = useState<string>(currentIsoMonth());
  const [editing, setEditing] = useState<BudgetTransaction | null>(null);
  const { data: me } = useMe();
  const currency = me?.currency ?? 'INR';

  const { data: groups = [] } = useBudgetGroups();
  const { data: categories = [] } = useBudgetCategories();
  const { data: transactions = [], isPending } = useBudgetTransactions(month);
  const create = useCreateBudgetTransaction();

  const liveGroups = useMemo(() => groups.filter((g) => !g.archived), [groups]);

  const { income, expense } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    const categoriesById = new Map(categories.map((c) => [c._id, c]));
    for (const t of transactions) {
      const cat = categoriesById.get(t.categoryId);
      if (!cat) continue;
      if (cat.kind === 'income') inc += t.amount;
      else exp += t.amount;
    }
    return { income: inc, expense: exp };
  }, [transactions, categories]);
  const net = income - expense;

  async function handleAdd(body: {
    amount: number;
    categoryId: string;
    date: Date;
    description?: string;
  }) {
    const created = await create.mutateAsync(body);
    const createdMonth = toIsoMonth(new Date(created.date));
    if (createdMonth !== month) {
      // The user backdated/future-dated into a different month. Surface
      // a toast offering to navigate, but don't auto-switch (the row clearing
      // in the input row already implied the action succeeded).
      toast.info(
        `Added to ${createdMonth} — switch?`,
        {
          action: {
            label: 'Switch',
            onClick: () => setMonth(createdMonth),
          },
        }
      );
    }
  }

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />

      <div className="flex items-center justify-between mb-4">
        <BudgetMonthSelector month={month} onChange={setMonth} />
      </div>

      <div className="space-y-4 mb-6">
        <BudgetInputRow
          categories={categories}
          onSave={handleAdd}
        />
        <BudgetNetBand income={income} expense={expense} net={net} currency={currency} />
      </div>

      {isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BudgetLogColumn
            kind="income"
            groups={liveGroups}
            categories={categories}
            transactions={transactions}
            currency={currency}
            onEditTransaction={setEditing}
          />
          <BudgetLogColumn
            kind="expense"
            groups={liveGroups}
            categories={categories}
            transactions={transactions}
            currency={currency}
            onEditTransaction={setEditing}
          />
        </div>
      )}

      <BudgetEditTransactionDialog
        transaction={editing}
        categories={categories}
        onClose={() => setEditing(null)}
      />
    </main>
  );
}
