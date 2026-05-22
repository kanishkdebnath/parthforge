import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJournalMonth } from '@/hooks/useJournal';
import {
  monthLabel,
  monthGridCells,
  shiftMonth,
  todayLocal,
  monthOf,
} from '@/lib/journalDate';
import { MOOD_SCALE_BG } from '@/lib/moodColors';

interface JournalMonthGridProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function JournalMonthGrid({ selectedDate, onSelectDate }: JournalMonthGridProps) {
  const [yyyyMm, setYyyyMm] = useState(() => monthOf(selectedDate));
  const { data: days = [] } = useJournalMonth(yyyyMm);

  useEffect(() => {
    const selectedMonth = monthOf(selectedDate);
    if (selectedMonth !== yyyyMm) {
      setYyyyMm(selectedMonth);
    }
  }, [selectedDate, yyyyMm]);

  const moodByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of days) map.set(d.date, d.mood.scale);
    return map;
  }, [days]);

  const cells = monthGridCells(yyyyMm);
  const today = todayLocal();

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">{monthLabel(yyyyMm)}</div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setYyyyMm(shiftMonth(yyyyMm, -1))}
            className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-900"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setYyyyMm(shiftMonth(yyyyMm, 1))}
            className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-900"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-slate-400 mb-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (date === null) {
            return <div key={i} className="aspect-square" />;
          }
          const scale = moodByDate.get(date);
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const day = Number(date.slice(-2));
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={cn(
                'aspect-square rounded-md text-[11px] flex items-center justify-center transition',
                scale ? MOOD_SCALE_BG[scale] : 'bg-slate-50 dark:bg-slate-900 text-slate-400',
                isSelected && 'ring-2 ring-slate-900 dark:ring-slate-100',
                isToday && !isSelected && 'ring-1 ring-slate-400'
              )}
              aria-label={`Open ${date}`}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-400">
        <span>low</span>
        <span className="h-3 w-3 rounded bg-red-300" />
        <span className="h-3 w-3 rounded bg-orange-300" />
        <span className="h-3 w-3 rounded bg-slate-300" />
        <span className="h-3 w-3 rounded bg-emerald-300" />
        <span className="h-3 w-3 rounded bg-sky-300" />
        <span>high</span>
      </div>
    </div>
  );
}
