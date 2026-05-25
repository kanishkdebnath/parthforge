import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type {
  BudgetCategory,
  BudgetCategoryGroup,
  BudgetTransaction,
  CategoryKind,
} from '@pathforge/shared';
import { BudgetTransactionRow } from './BudgetTransactionRow';
import { formatMoney } from '@/lib/budget-formatting';

interface Props {
  kind: CategoryKind;
  groups: BudgetCategoryGroup[];
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  currency: string;
  onEditTransaction: (txn: BudgetTransaction) => void;
}

/**
 * Income or expense column. Renders only groups that have at least one
 * category of the matching kind AND at least one transaction in the month
 * for those categories.
 */
export function BudgetLogColumn({
  kind,
  groups,
  categories,
  transactions,
  currency,
  onEditTransaction,
}: Props) {
  const accent =
    kind === 'income'
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-red-700 dark:text-red-400';

  // Filter to categories of this kind (incl. archived — historical txns).
  const inKind = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind]
  );
  const categoriesById = useMemo(
    () => new Map(inKind.map((c) => [c._id, c])),
    [inKind]
  );

  // Bucket transactions by category, only those of this kind.
  const byCategory = useMemo(() => {
    const map = new Map<string, BudgetTransaction[]>();
    for (const t of transactions) {
      if (!categoriesById.has(t.categoryId)) continue;
      const arr = map.get(t.categoryId) ?? [];
      arr.push(t);
      map.set(t.categoryId, arr);
    }
    // Sort each category's transactions newest-first.
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return map;
  }, [transactions, categoriesById]);

  const total = useMemo(
    () =>
      Array.from(byCategory.values()).flat().reduce((s, t) => s + t.amount, 0),
    [byCategory]
  );

  // Group ordering: same as the groups prop. Within each group, categories
  // ordered by the category list's order field. Only groups with at least
  // one transaction-bearing category in this kind are rendered.
  const groupedRows = useMemo(() => {
    const sortedCats = [...inKind].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return groups.map((g) => {
      const cats = sortedCats.filter(
        (c) => c.groupId === g._id && (byCategory.get(c._id)?.length ?? 0) > 0
      );
      return { group: g, cats };
    }).filter((row) => row.cats.length > 0);
  }, [groups, inKind, byCategory]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${accent}`}>
          {kind === 'income' ? 'Incomes' : 'Expenses'}
        </h2>
        <div className={`text-base font-semibold tabular-nums ${accent}`}>
          {formatMoney(total, currency)}
        </div>
      </div>
      {groupedRows.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 py-4">
          {kind === 'income' ? 'No incomes this month.' : 'No expenses this month.'}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedRows.map(({ group, cats }) => (
            <GroupBlock
              key={group._id}
              group={group}
              cats={cats}
              byCategory={byCategory}
              currency={currency}
              onEditTransaction={onEditTransaction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface GroupBlockProps {
  group: BudgetCategoryGroup;
  cats: BudgetCategory[];
  byCategory: Map<string, BudgetTransaction[]>;
  currency: string;
  onEditTransaction: (txn: BudgetTransaction) => void;
}

function GroupBlock({
  group,
  cats,
  byCategory,
  currency,
  onEditTransaction,
}: GroupBlockProps) {
  const [open, setOpen] = useState(true);
  const groupTotal = cats.reduce(
    (s, c) => s + (byCategory.get(c._id)?.reduce((ss, t) => ss + t.amount, 0) ?? 0),
    0
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: group.color }}
        />
        <span>{group.name}</span>
        <span className="ml-auto text-slate-500 tabular-nums">
          {formatMoney(groupTotal, currency)}
        </span>
      </button>
      {open && (
        <div className="mt-1.5 ml-5 space-y-2">
          {cats.map((c) => (
            <CategoryBlock
              key={c._id}
              category={c}
              transactions={byCategory.get(c._id) ?? []}
              currency={currency}
              onEditTransaction={onEditTransaction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CategoryBlockProps {
  category: BudgetCategory;
  transactions: BudgetTransaction[];
  currency: string;
  onEditTransaction: (txn: BudgetTransaction) => void;
}

function CategoryBlock({
  category,
  transactions,
  currency,
  onEditTransaction,
}: CategoryBlockProps) {
  const subtotal = transactions.reduce((s, t) => s + t.amount, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-0.5 px-1">
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
          {category.name}{category.archived ? ' (archived)' : ''}
        </span>
        <span className="text-xs text-slate-500 tabular-nums">
          {formatMoney(subtotal, currency)}
        </span>
      </div>
      <div className="space-y-0.5">
        {transactions.map((t) => (
          <BudgetTransactionRow
            key={t._id}
            transaction={t}
            currency={currency}
            onEdit={() => onEditTransaction(t)}
          />
        ))}
      </div>
    </div>
  );
}
