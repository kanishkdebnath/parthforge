import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type {
  BudgetCategory,
  BudgetRecurringTemplate,
} from '@pathforge/shared';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateBudgetRecurring,
  useUpdateBudgetRecurring,
} from '@/hooks/useBudget';
import {
  parseMajorToMinor,
  formatMinorForInput,
} from '@/lib/budget-formatting';

const Schema = z.object({
  label: z.string().min(1, 'Required').max(120),
  categoryId: z.string().min(1, 'Pick a category'),
  amountText: z.string().min(1, 'Required'),
  dayOfMonth: z.coerce.number().int().min(1).max(28),
  active: z.boolean(),
});
type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: BudgetCategory[];
  template?: BudgetRecurringTemplate;
}

export function BudgetRecurringFormDialog({
  open,
  onOpenChange,
  categories,
  template,
}: Props) {
  const create = useCreateBudgetRecurring();
  const update = useUpdateBudgetRecurring(template?._id ?? '');

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      label: template?.label ?? '',
      categoryId: template?.categoryId ?? categories[0]?._id ?? '',
      amountText: template ? formatMinorForInput(template.amount) : '',
      dayOfMonth: template?.dayOfMonth ?? 1,
      active: template?.active ?? true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        label: template?.label ?? '',
        categoryId: template?.categoryId ?? categories[0]?._id ?? '',
        amountText: template ? formatMinorForInput(template.amount) : '',
        dayOfMonth: template?.dayOfMonth ?? 1,
        active: template?.active ?? true,
      });
    }
  }, [open, template, categories, form]);

  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: FormValues) {
    const amount = parseMajorToMinor(values.amountText);
    if (amount === null || amount <= 0) {
      form.setError('amountText', { message: 'Enter a positive amount' });
      return;
    }
    const body = {
      label: values.label,
      categoryId: values.categoryId,
      amount,
      dayOfMonth: values.dayOfMonth,
      active: values.active,
    };
    if (template) {
      await update.mutateAsync(body);
    } else {
      await create.mutateAsync({ ...body, cadence: 'monthly' });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template ? 'Edit template' : 'New recurring template'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Label</label>
            <Input {...form.register('label')} placeholder="Rent, Salary, Spotify…" autoFocus />
            {form.formState.errors.label && (
              <p className="text-xs text-red-600">{form.formState.errors.label.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Category</label>
            <Select
              value={form.watch('categoryId')}
              onValueChange={(v) => form.setValue('categoryId', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.filter((c) => !c.archived).map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name} ({c.kind})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Amount</label>
              <Input {...form.register('amountText')} placeholder="0" inputMode="decimal" />
              {form.formState.errors.amountText && (
                <p className="text-xs text-red-600">{form.formState.errors.amountText.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Day of month (1–28)</label>
              <Input
                type="number"
                min={1}
                max={28}
                {...form.register('dayOfMonth', { valueAsNumber: true })}
              />
              {form.formState.errors.dayOfMonth && (
                <p className="text-xs text-red-600">{form.formState.errors.dayOfMonth.message}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={form.watch('active')}
              onChange={(e) => form.setValue('active', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="active" className="text-sm text-slate-700 dark:text-slate-300">
              Active (eligible for Apply each month)
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {template ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
