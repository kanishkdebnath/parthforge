import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetCurrencySelector } from '@/components/budget/BudgetCurrencySelector';

export default function BudgetSettingsPage() {
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <BudgetCurrencySelector />
    </main>
  );
}
