import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, formatMonthLabel } from '@/lib/budget-month';
import { Button } from '@/components/ui/button';

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export function BudgetMonthSelector({ month, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="px-3 text-base font-medium text-slate-900 dark:text-slate-100 tabular-nums">
        {formatMonthLabel(month)}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(addMonths(month, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
