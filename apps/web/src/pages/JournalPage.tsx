import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { todayLocal } from '@/lib/journalDate';
import { JournalMonthGrid } from '@/components/journal/JournalMonthGrid';
import { DayEditor } from '@/components/journal/DayEditor';

export default function JournalPage() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date');

  // Default to today on first mount if no date in URL.
  useEffect(() => {
    if (!date) {
      setParams({ date: todayLocal() }, { replace: true });
    }
  }, [date, setParams]);

  const selected = date ?? todayLocal();

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Journal</h1>
      <div className="grid grid-cols-[280px_1fr] gap-8 items-start">
        <JournalMonthGrid
          selectedDate={selected}
          onSelectDate={(d) => setParams({ date: d })}
        />
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
          <DayEditor date={selected} />
        </div>
      </div>
    </main>
  );
}
