import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { BudgetCategory, BudgetCategoryGroup } from '@pathforge/shared';
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
  useCreateBudgetCategory,
  useUpdateBudgetCategory,
} from '@/hooks/useBudget';

const Schema = z.object({
  groupId: z.string().min(1, 'Pick a group'),
  name: z.string().min(1, 'Required').max(80),
  kind: z.enum(['income', 'expense']),
});
type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: BudgetCategoryGroup[];
  /** Pre-select this group when creating. */
  defaultGroupId?: string;
  /** When set, dialog is in edit mode. */
  category?: BudgetCategory;
}

export function BudgetCategoryDialog({
  open,
  onOpenChange,
  groups,
  defaultGroupId,
  category,
}: Props) {
  const create = useCreateBudgetCategory();
  const update = useUpdateBudgetCategory(category?._id ?? '');

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      groupId: category?.groupId ?? defaultGroupId ?? groups[0]?._id ?? '',
      name: category?.name ?? '',
      kind: category?.kind ?? 'expense',
    },
  });

  const { reset } = form;
  useEffect(() => {
    if (open) {
      reset({
        groupId: category?.groupId ?? defaultGroupId ?? groups[0]?._id ?? '',
        name: category?.name ?? '',
        kind: category?.kind ?? 'expense',
      });
    }
  }, [open, category, defaultGroupId, groups, reset]);

  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: FormValues) {
    if (category) {
      await update.mutateAsync(values);
    } else {
      await create.mutateAsync(values);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Group
            </label>
            <Select
              value={form.watch('groupId')}
              onValueChange={(v) => form.setValue('groupId', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g._id} value={g._id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.groupId && (
              <p className="text-xs text-red-600">
                {form.formState.errors.groupId.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Name
            </label>
            <Input
              {...form.register('name')}
              placeholder="Groceries, Salary…"
              autoFocus
            />
            {form.formState.errors.name && (
              <p className="text-xs text-red-600">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Kind
            </label>
            <Select
              value={form.watch('kind')}
              onValueChange={(v) =>
                form.setValue('kind', v as 'income' | 'expense', { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {category ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
