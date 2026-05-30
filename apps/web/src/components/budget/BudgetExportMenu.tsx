import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  exportBudgetPdf,
  exportBudgetXlsx,
  exportBudgetBoth,
  type BudgetExportInput,
} from '@/lib/budget-export';

type State = 'idle' | 'preparing' | 'done';

interface Props {
  input: BudgetExportInput | null;  // null until all queries have resolved
  disabledReason?: string;          // shown via title attribute when input is null
}

export function BudgetExportMenu({ input, disabledReason }: Props) {
  const [state, setState] = useState<State>('idle');
  const ready = input !== null;
  const disabled = !ready || state === 'preparing';

  async function run(action: 'pdf' | 'xlsx' | 'both'): Promise<void> {
    if (!input) return;
    setState('preparing');
    try {
      if (action === 'pdf') await exportBudgetPdf(input);
      else if (action === 'xlsx') await exportBudgetXlsx(input);
      else await exportBudgetBoth(input);
      setState('done');
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      console.error('[budget-export]', err);
      toast.error("Couldn't generate export. Try again.");
      setState('idle');
    }
  }

  const label =
    state === 'preparing' ? 'Preparing…' : state === 'done' ? 'Done' : 'Export';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          title={!input ? disabledReason : undefined}
        >
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem onSelect={() => run('pdf')}>PDF (report)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('xlsx')}>Excel (.xlsx logs)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('both')}>Both</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
