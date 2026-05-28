import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BudgetCategory,
  BudgetTransaction,
  CategoryKind,
} from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { parseMajorToMinor, formatMinorForInput } from '@/lib/budget-formatting';
import { BudgetAmountInput } from './BudgetAmountInput';

interface Props {
  categories: BudgetCategory[];
  /** ISO currency code for the calculator preview symbol. */
  currency: string;
  /** When set, the row is in edit mode for this transaction. */
  initial?: BudgetTransaction;
  /** Called on Add / Save. Returns the body to send. Throw to keep the form open. */
  onSave: (body: {
    amount: number;
    categoryId: string;
    date: Date;
    description?: string;
  }) => Promise<void> | void;
  onCancel?: () => void;
  /** Optional: pre-select a kind when creating. Defaults to 'expense'. */
  defaultKind?: CategoryKind;
  /** Compact mode for the dashboard quick-add modal. */
  compact?: boolean;
}

export function BudgetInputRow({
  categories,
  currency,
  initial,
  onSave,
  onCancel,
  defaultKind = 'expense',
  compact = false,
}: Props) {
  // Derive the kind for editing from the chosen category.
  const initialCategory = initial
    ? categories.find((c) => c._id === initial.categoryId)
    : undefined;
  const initialKind: CategoryKind = initialCategory?.kind ?? defaultKind;

  const [kind, setKind] = useState<CategoryKind>(initialKind);
  const [amountText, setAmountText] = useState(
    initial ? formatMinorForInput(initial.amount) : ''
  );
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? '');
  const [date, setDate] = useState<string>(
    initial ? toLocalDateString(new Date(initial.date)) : toLocalDateString(new Date())
  );
  const [time, setTime] = useState<string>(
    initial ? toLocalTimeString(new Date(initial.date)) : toLocalTimeString(new Date())
  );
  const [description, setDescription] = useState<string>(initial?.description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountRef = useRef<HTMLInputElement>(null);

  // Refocus amount when kind toggles or after successful save.
  useEffect(() => {
    amountRef.current?.focus();
  }, [kind]);

  // Reset internal state when the editing target changes.
  useEffect(() => {
    if (initial) {
      const cat = categories.find((c) => c._id === initial.categoryId);
      setKind(cat?.kind ?? defaultKind);
      setAmountText(formatMinorForInput(initial.amount));
      setCategoryId(initial.categoryId);
      setDate(toLocalDateString(new Date(initial.date)));
      setTime(toLocalTimeString(new Date(initial.date)));
      setDescription(initial.description ?? '');
    }
  }, [initial, categories, defaultKind]);

  // Live-filtered list for the kind toggle.
  const filteredCategories = useMemo(
    () => categories.filter((c) => !c.archived && c.kind === kind),
    [categories, kind]
  );

  // If the current categoryId is invalid for the active kind, clear it.
  useEffect(() => {
    if (categoryId && !filteredCategories.some((c) => c._id === categoryId)) {
      setCategoryId('');
    }
  }, [categoryId, filteredCategories]);

  async function submit() {
    setError(null);
    const amount = parseMajorToMinor(amountText);
    if (amount === null || amount <= 0) {
      setError('Enter a positive amount');
      return;
    }
    if (!categoryId) {
      setError('Pick a category');
      return;
    }
    const merged = new Date(`${date}T${time}`);
    if (Number.isNaN(merged.getTime())) {
      setError('Invalid date or time');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        amount,
        categoryId,
        date: merged,
        description: description.trim() === '' ? undefined : description.trim(),
      });
      if (!initial) {
        // Create mode: clear inputs and refocus.
        setAmountText('');
        setDescription('');
        setCategoryId('');
        amountRef.current?.focus();
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onAmountKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && categoryId) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 ${compact ? 'p-4' : 'p-5'} space-y-3`}
    >
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            Amount
          </label>
          <BudgetAmountInput
            ref={amountRef}
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            onKeyDown={onAmountKeyDown}
            placeholder="0"
            inputMode="decimal"
            className="text-lg tabular-nums"
            currency={currency}
          />
        </div>
        <div className="flex gap-1.5 self-end pb-px">
          <Button
            type="button"
            variant={kind === 'income' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setKind('income')}
            className={kind === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            + Income
          </Button>
          <Button
            type="button"
            variant={kind === 'expense' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setKind('expense')}
            className={kind === 'expense' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            − Expense
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
            Category
          </label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder={filteredCategories.length === 0 ? 'No categories' : 'Pick one'} />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
              Time
            </label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-[90px]"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-1">
          Description (optional)
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="what / why"
          maxLength={500}
        />
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={submit} disabled={submitting}>
          {initial ? 'Save' : 'Add'}
        </Button>
      </div>
    </div>
  );
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalTimeString(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}
