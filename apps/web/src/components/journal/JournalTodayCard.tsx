import { useNavigate } from 'react-router-dom';
import { todayLocal } from '@/lib/journalDate';
import { useJournalDay, useUpsertJournalDay } from '@/hooks/useJournal';

const EMOJI = ['😢', '😟', '😐', '🙂', '😄'] as const;

export function JournalTodayCard() {
  const today = todayLocal();
  const navigate = useNavigate();
  const { data: day, isLoading } = useJournalDay(today);
  const save = useUpsertJournalDay(today);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
        <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!day) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
          Today's journal
        </div>
        <div className="text-base text-slate-900 dark:text-slate-100 mb-3">
          How are you feeling today?
        </div>
        <div className="flex gap-2">
          {EMOJI.map((face, i) => (
            <button
              key={i}
              type="button"
              disabled={save.isPending}
              onClick={async () => {
                await save.mutateAsync({
                  mood: { scale: i + 1, tags: [] },
                  events: [],
                  links: [],
                  references: [],
                });
                navigate(`/journal?date=${today}`);
              }}
              className="h-10 w-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xl hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950 transition"
              aria-label={`Mood ${i + 1} of 5`}
            >
              {face}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Today's journal
        </div>
        <div className="text-xl">{EMOJI[day.mood.scale - 1]}</div>
      </div>
      <div className="text-sm text-slate-700 dark:text-slate-300 mb-3">
        {day.summary || 'No summary yet.'}
      </div>
      <button
        type="button"
        onClick={() => navigate(`/journal?date=${today}`)}
        className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
      >
        Open journal →
      </button>
    </div>
  );
}
