import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { BudgetCategoryGroup } from '@pathforge/shared';
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
  useCreateBudgetGroup,
  useUpdateBudgetGroup,
} from '@/hooks/useBudget';

const GROUP_COLORS = [
  '#10b981', // emerald
  '#ef4444', // red
  '#f59e0b', // amber
  '#f97316', // orange
  '#8b5cf6', // violet
  '#0ea5e9', // sky
  '#64748b', // slate
  '#ec4899', // pink
] as const;

const GROUP_COLOR_LABELS: Record<string, string> = {
  '#10b981': 'Emerald',
  '#ef4444': 'Red',
  '#f59e0b': 'Amber',
  '#f97316': 'Orange',
  '#8b5cf6': 'Violet',
  '#0ea5e9': 'Sky',
  '#64748b': 'Slate',
  '#ec4899': 'Pink',
};

const Schema = z.object({
  name: z.string().min(1, 'Required').max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color'),
});
type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog is in edit mode for this group. */
  group?: BudgetCategoryGroup;
}

export function BudgetGroupDialog({ open, onOpenChange, group }: Props) {
  const create = useCreateBudgetGroup();
  const update = useUpdateBudgetGroup(group?._id ?? '');

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name: group?.name ?? '',
      color: group?.color ?? GROUP_COLORS[0],
    },
  });

  const { reset } = form;
  useEffect(() => {
    if (open) {
      reset({
        name: group?.name ?? '',
        color: group?.color ?? GROUP_COLORS[0],
      });
    }
  }, [open, group, reset]);

  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: FormValues) {
    if (group) {
      await update.mutateAsync(values);
    } else {
      await create.mutateAsync(values);
    }
    onOpenChange(false);
  }

  const selectedColor = form.watch('color');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? 'Edit group' : 'New group'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Name
            </label>
            <Input
              {...form.register('name')}
              placeholder="Bills, Household, Income…"
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
              Color
            </label>
            <div className="flex gap-2">
              {GROUP_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => form.setValue('color', color, { shouldValidate: true })}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    selectedColor === color
                      ? 'border-slate-900 dark:border-slate-100 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Pick color ${GROUP_COLOR_LABELS[color] ?? color}`}
                />
              ))}
            </div>
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
              {group ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
