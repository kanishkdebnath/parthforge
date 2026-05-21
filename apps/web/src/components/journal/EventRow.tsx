import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DraftEvent {
  _id: string;        // tmp uuid until server assigns
  text: string;
  important: boolean;
  time?: string;
}

interface EventRowProps {
  event: DraftEvent;
  onChange: (next: DraftEvent) => void;
  onDelete: () => void;
}

export function EventRow({ event, onChange, onDelete }: EventRowProps) {
  return (
    <div className="grid grid-cols-[28px_72px_1fr_28px] gap-2 items-center py-2 border-b border-slate-100 dark:border-slate-800">
      <button
        type="button"
        onClick={() => onChange({ ...event, important: !event.important })}
        className="flex justify-center"
        aria-label={event.important ? 'Unmark important' : 'Mark important'}
      >
        <Star
          className={cn(
            'h-4 w-4 transition',
            event.important
              ? 'fill-amber-500 stroke-amber-500'
              : 'stroke-slate-300 dark:stroke-slate-600'
          )}
        />
      </button>
      <input
        type="text"
        value={event.time ?? ''}
        onChange={(e) => onChange({ ...event, time: e.target.value || undefined })}
        placeholder="time"
        className="bg-transparent text-xs text-slate-600 dark:text-slate-400 border-0 outline-none focus:ring-0 placeholder:text-slate-300"
      />
      <input
        type="text"
        value={event.text}
        onChange={(e) => onChange({ ...event, text: e.target.value })}
        placeholder="What happened?"
        className="bg-transparent text-sm text-slate-900 dark:text-slate-100 border-0 outline-none focus:ring-0"
        maxLength={500}
      />
      <button
        type="button"
        onClick={onDelete}
        className="text-slate-300 hover:text-red-500 text-sm"
        aria-label="Delete event"
      >
        ✕
      </button>
    </div>
  );
}
