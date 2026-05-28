import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { evaluateExpression } from '@/lib/budget-expression';
import { getCurrencySymbol } from '@/lib/budget-formatting';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The expression text shown when the popover opens. Usually the current amount field value. */
  initialExpression: string;
  currency: string;
  /** Called with a major-unit string (already rounded to currency precision) when the user commits. */
  onCommit: (majorString: string) => void;
  /** Trigger element rendered inside <PopoverTrigger asChild>. */
  trigger: React.ReactNode;
}

interface PadKey {
  label: string;
  insert: string;
  ariaLabel?: string;
  action?: 'backspace' | 'clear';
  variant?: 'op' | 'paren' | 'util';
}

const PAD: PadKey[][] = [
  [
    { label: '7', insert: '7' },
    { label: '8', insert: '8' },
    { label: '9', insert: '9' },
    { label: '÷', insert: '÷', ariaLabel: 'divide', variant: 'op' },
    { label: '(', insert: '(', variant: 'paren' },
  ],
  [
    { label: '4', insert: '4' },
    { label: '5', insert: '5' },
    { label: '6', insert: '6' },
    { label: '×', insert: '×', ariaLabel: 'multiply', variant: 'op' },
    { label: ')', insert: ')', variant: 'paren' },
  ],
  [
    { label: '1', insert: '1' },
    { label: '2', insert: '2' },
    { label: '3', insert: '3' },
    { label: '−', insert: '−', ariaLabel: 'subtract', variant: 'op' },
    { label: '⌫', insert: '', action: 'backspace', ariaLabel: 'backspace', variant: 'util' },
  ],
  [
    { label: '0', insert: '0' },
    { label: '.', insert: '.' },
    { label: '00', insert: '00' },
    { label: '+', insert: '+', ariaLabel: 'add', variant: 'op' },
    { label: 'C', insert: '', action: 'clear', ariaLabel: 'clear', variant: 'util' },
  ],
];

function isJpyStyle(currency: string): boolean {
  return currency === 'JPY';
}

function formatPreviewMajor(value: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  const isSubunitless = isJpyStyle(currency);
  const formatted = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: isSubunitless ? 0 : 2,
  }).format(value);
  return `${symbol}${formatted}`;
}

/** Round a float result to a major-unit string with currency-correct precision. */
function roundForCommit(value: number, currency: string): string {
  if (isJpyStyle(currency)) {
    return String(Math.round(value));
  }
  const minor = Math.round(value * 100);
  const major = minor / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

export function BudgetCalculatorPopover({
  open,
  onOpenChange,
  initialExpression,
  currency,
  onCommit,
  trigger,
}: Props) {
  const [expression, setExpression] = useState(initialExpression);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset the expression each time we open, mirroring the current amount field.
  useEffect(() => {
    if (open) {
      setExpression(initialExpression);
      // Defer focus so the popover content is mounted.
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, initialExpression]);

  const evaluation = useMemo(() => evaluateExpression(expression), [expression]);

  const previewText =
    evaluation.ok
      ? `= ${formatPreviewMajor(evaluation.value, currency)}`
      : evaluation.reason === 'incomplete'
        ? '…'
        : 'Invalid expression';

  const previewClass = !evaluation.ok && evaluation.reason === 'invalid'
    ? 'text-red-600'
    : 'text-slate-500';

  const canCommit = evaluation.ok;

  function insertAtCaret(text: string) {
    const el = inputRef.current;
    if (!el) {
      setExpression((cur) => cur + text);
      return;
    }
    const start = el.selectionStart ?? expression.length;
    const end = el.selectionEnd ?? expression.length;
    const next = expression.slice(0, start) + text + expression.slice(end);
    setExpression(next);
    // Move caret just past the inserted text, after React commits.
    requestAnimationFrame(() => {
      const caret = start + text.length;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  function backspace() {
    const el = inputRef.current;
    if (!el) {
      setExpression((cur) => cur.slice(0, -1));
      return;
    }
    const start = el.selectionStart ?? expression.length;
    const end = el.selectionEnd ?? expression.length;
    if (start !== end) {
      const next = expression.slice(0, start) + expression.slice(end);
      setExpression(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start, start);
      });
      return;
    }
    if (start === 0) return;
    const next = expression.slice(0, start - 1) + expression.slice(start);
    setExpression(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start - 1, start - 1);
    });
  }

  function clearAll() {
    setExpression('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handlePadClick(key: PadKey) {
    if (key.action === 'backspace') {
      backspace();
      return;
    }
    if (key.action === 'clear') {
      clearAll();
      return;
    }
    insertAtCaret(key.insert);
  }

  function commit() {
    if (!canCommit) return;
    onCommit(roundForCommit(evaluation.value, currency));
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
      return;
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[280px] p-3 space-y-3"
        onOpenAutoFocus={(e) => {
          // We handle focus manually via the effect above so the expression
          // text is selected.
          e.preventDefault();
        }}
      >
        <div className="space-y-1">
          <label className="block text-[10px] uppercase tracking-wide text-slate-500">
            Expression
          </label>
          <Input
            ref={inputRef}
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 1200+450"
            className="text-base tabular-nums h-9"
            aria-label="Calculator expression"
            spellCheck={false}
            autoComplete="off"
          />
          <div
            className={cn('text-sm tabular-nums', previewClass)}
            aria-live="polite"
          >
            {previewText}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {PAD.flat().map((key, idx) => (
            <Button
              key={`${key.label}-${idx}`}
              type="button"
              variant={key.variant === 'op' || key.variant === 'paren' ? 'outline' : key.variant === 'util' ? 'ghost' : 'secondary'}
              size="sm"
              className="h-9 px-0 text-sm tabular-nums"
              onClick={() => handlePadClick(key)}
              aria-label={key.ariaLabel ?? key.label}
            >
              {key.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={commit} disabled={!canCommit}>
            Use
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
