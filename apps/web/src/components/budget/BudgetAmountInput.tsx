import { forwardRef, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BudgetCalculatorPopover } from './BudgetCalculatorPopover';

interface Props
  extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange'> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currency: string;
}

/**
 * Drop-in replacement for <Input> on budget amount fields. Adds a calculator
 * icon button anchored to the input's right edge that opens an expression
 * popover (see BudgetCalculatorPopover). The bare typed input still works for
 * users who just want to type a number — the calculator is purely additive.
 */
export const BudgetAmountInput = forwardRef<HTMLInputElement, Props>(
  function BudgetAmountInput(
    { value, onChange, currency, className, ...inputProps },
    ref,
  ) {
    const [open, setOpen] = useState(false);

    function handleCommit(majorString: string) {
      // Synthesize an onChange event so the parent form's controlled state
      // updates exactly as if the user had typed the rounded value.
      const syntheticEvent = {
        target: { value: majorString },
        currentTarget: { value: majorString },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }

    return (
      <div className="relative">
        <Input
          ref={ref}
          value={value}
          onChange={onChange}
          className={cn('pr-10', className)}
          {...inputProps}
        />
        <BudgetCalculatorPopover
          open={open}
          onOpenChange={setOpen}
          initialExpression={value}
          currency={currency}
          onCommit={handleCommit}
          trigger={
            <button
              type="button"
              aria-label="Open calculator"
              className="absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Calculator className="h-4 w-4" />
            </button>
          }
        />
      </div>
    );
  },
);
