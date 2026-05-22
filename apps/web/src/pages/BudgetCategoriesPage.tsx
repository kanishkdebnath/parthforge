import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';

export default function BudgetCategoriesPage() {
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <p className="text-sm text-slate-500">Categories placeholder — lands in Task 4.</p>
    </main>
  );
}
