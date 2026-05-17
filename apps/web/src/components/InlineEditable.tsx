import { useEffect, useRef, useState } from 'react';
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
      settledRef.current = false;
    }
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
          'block w-full bg-transparent outline-none border-b border-brand focus:border-brand',
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
