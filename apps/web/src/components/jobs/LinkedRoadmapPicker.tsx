import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import type { Roadmap } from '@pathforge/shared';
import { cn } from '@/lib/utils';
import { useRoadmaps } from '@/hooks/useRoadmaps';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';

interface LinkedRoadmapPickerProps {
  value: string | undefined;
  onChange: (roadmapId: string | undefined) => void;
}

export function LinkedRoadmapPicker({
  value,
  onChange,
}: LinkedRoadmapPickerProps) {
  const { data: roadmaps } = useRoadmaps({ archived: false });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => roadmaps?.find((r) => r._id === value),
    [roadmaps, value]
  );

  const filtered: Roadmap[] = useMemo(() => {
    if (!roadmaps) return [];
    const q = query.trim().toLowerCase();
    if (!q) return roadmaps;
    return roadmaps.filter((r) =>
      r.title.toLowerCase().includes(q)
    );
  }, [roadmaps, query]);

  return (
    <div className="relative w-full inline-flex items-stretch bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex-1 flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md"
          >
            <span className={cn('truncate', !selected && 'text-slate-400 dark:text-slate-500')}>
              {selected ? selected.title : 'No roadmap linked'}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[280px]" align="start">
          <div className="p-2 border-b border-slate-200 dark:border-slate-800">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roadmaps…"
              className="h-8 text-sm"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">No matches.</p>
            )}
            {filtered.map((r) => (
              <button
                type="button"
                key={r._id}
                onClick={() => {
                  onChange(r._id);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="truncate">{r.title}</span>
                {r._id === value && (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {selected && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label="Clear linked roadmap"
          className="px-2 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 border-l border-slate-200 dark:border-slate-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
