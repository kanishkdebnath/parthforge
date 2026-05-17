import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { formatDeadline } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface TitleProps {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  /** Disables submit when value is empty (titles must be non-empty). */
  required?: boolean;
}

export function InlineEditableTitle({
  value,
  onSave,
  placeholder = 'Untitled',
  className,
  required = true,
}: TitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Guard against the unmount-blur double-fire: once commit OR cancel has
  // handled this edit session, the blur that follows the unmount is a no-op.
  const settledRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (editing) settledRef.current = false;
  }, [editing]);

  const commit = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const next = draft.trim();
    if (required && next.length === 0) {
      setDraft(value);
      setEditing(false);
      return;
    }
    if (next !== value) onSave(next);
    setEditing(false);
  };

  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        placeholder={placeholder}
        className={cn(
          'w-full bg-transparent outline-none border-b border-active focus:border-active',
          className
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        'block text-left w-full hover:bg-slate-50/60 -mx-1 px-1 rounded-sm transition-colors',
        !value && 'text-slate-400 italic',
        className
      )}
    >
      {value || placeholder}
    </button>
  );
}

interface TextProps {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
}

export function InlineEditableText({ value, onSave, placeholder = 'Add a description…', className }: TextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  // Guard against the unmount-blur double-fire: once commit OR cancel has
  // handled this edit session, the blur that follows the unmount is a no-op.
  const settledRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      const len = ref.current?.value.length ?? 0;
      ref.current?.setSelectionRange(len, len);
    }
  }, [editing]);

  useEffect(() => {
    if (editing) settledRef.current = false;
  }, [editing]);

  const commit = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    const next = draft.trim();
    if (next !== value) onSave(next);
    setEditing(false);
  };

  const cancel = () => {
    if (settledRef.current) return;
    settledRef.current = true;
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
          if (e.key === 'Escape') cancel();
        }}
        rows={Math.max(2, draft.split('\n').length)}
        placeholder={placeholder}
        className={cn(
          'w-full bg-transparent outline-none resize-none border-b border-active focus:border-active whitespace-pre-wrap',
          className
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        'text-left w-full hover:bg-slate-50/60 -mx-1 px-1 rounded-sm transition-colors whitespace-pre-wrap',
        !value && 'text-slate-400 italic',
        className
      )}
    >
      {value || placeholder}
    </button>
  );
}

interface DateProps {
  value: Date | string | undefined;
  onSave: (next: Date | null) => void | Promise<void>;
  placeholder?: string;
  className?: string;
}

/** Date pill with a popover Calendar. Clicking the formatted date opens the picker;
 * picking a date saves; the "Clear" button sends null. */
export function InlineEditableDate({
  value,
  onSave,
  placeholder = 'add deadline',
  className,
}: DateProps) {
  const [open, setOpen] = useState(false);
  const formatted = formatDeadline(value);
  const dateValue = value ? (typeof value === 'string' ? new Date(value) : value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'font-display italic lowercase text-slate-600 hover:text-slate-900 transition-colors',
            !value && 'text-slate-400',
            className
          )}
        >
          {formatted ? `due ${formatted}` : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(d: Date | undefined) => {
            onSave(d ?? null);
            setOpen(false);
          }}
          autoFocus
        />
        {value && (
          <div className="border-t p-2">
            <button
              type="button"
              onClick={() => {
                onSave(null);
                setOpen(false);
              }}
              className="text-xs text-slate-600 hover:text-overdue px-2 py-1"
            >
              Clear deadline
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
