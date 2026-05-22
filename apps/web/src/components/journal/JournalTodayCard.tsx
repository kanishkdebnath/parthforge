import { useNavigate } from 'react-router-dom';
import type { JournalDay } from '@pathforge/shared';
import { useJournalDay, useJournalMonth, useUpsertJournalDay } from '@/hooks/useJournal';
import { dayLabel, monthOf, todayLocal } from '@/lib/journalDate';
import { MOOD_SCALE_BG } from '@/lib/moodColors';
import { cn } from '@/lib/utils';

const EMOJI = ['😢', '😟', '😐', '🙂', '😄'] as const;

/** Hero "Today's journal" card on the dashboard. Renders one of three
 *  branches based on the data-tour-anchored card root:
 *    - loading skeleton
 *    - empty prompt with five emoji quick-set buttons
 *    - filled state with mood, summary, tags, 14-day heatmap, + Add an event
 *  Each branch wraps in the same outer `<div data-tour="journal-today-card" ...>`
 *  so the Journal tutorial's step-1 callout anchors regardless of state. */
export function JournalTodayCard() {
  const today = todayLocal();
  const navigate = useNavigate();
  const { data: day, isLoading } = useJournalDay(today);
  const save = useUpsertJournalDay(today);

  // Current month + previous month — the 14-day window may cross a month boundary.
  const thisMonth = monthOf(today);
  const prevMonth = previousMonth(thisMonth);
  const { data: thisMonthDays = [] } = useJournalMonth(thisMonth);
  const { data: prevMonthDays = [] } = useJournalMonth(prevMonth);
  const moodByDate = buildMoodIndex(thisMonthDays, prevMonthDays);

  if (isLoading) {
    return (
      <div
        data-tour="journal-today-card"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6"
      >
        <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
      </div>
    );
  }

  if (!day) {
    return (
      <div
        data-tour="journal-today-card"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6"
      >
        <CardHeader date={today} />
        <div className="text-base text-slate-900 dark:text-slate-100 mt-2 mb-3">
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
        <HeatmapStrip today={today} moodByDate={moodByDate} />
        <div className="flex justify-end mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigate(`/journal?date=${today}`)}
            className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
          >
            Open Journal →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-tour="journal-today-card"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <CardHeader date={today} />
          <div className="text-sm text-slate-700 dark:text-slate-300 mt-2">
            {day.summary || 'No summary yet.'}
          </div>
          {day.mood.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {day.mood.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-3xl leading-none shrink-0">{EMOJI[day.mood.scale - 1]}</div>
      </div>

      <HeatmapStrip today={today} moodByDate={moodByDate} />

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => navigate(`/journal?date=${today}`)}
          className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          + Add an event
        </button>
        <button
          type="button"
          onClick={() => navigate(`/journal?date=${today}`)}
          className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
        >
          Open Journal →
        </button>
      </div>
    </div>
  );
}

function CardHeader({ date }: { date: string }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      Today's journal · {dayLabel(date)}
    </div>
  );
}

function HeatmapStrip({
  today,
  moodByDate,
}: {
  today: string;
  moodByDate: Map<string, number>;
}) {
  const cells = lastNDays(today, 14);
  return (
    <div className="mt-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">Last 14 days</div>
      <div className="flex gap-1.5">
        {cells.map((date) => {
          const scale = moodByDate.get(date);
          const isToday = date === today;
          return (
            <div
              key={date}
              title={date}
              className={cn(
                'h-5 w-5 rounded',
                scale ? MOOD_SCALE_BG[scale] : 'bg-slate-100 dark:bg-slate-800',
                isToday && 'ring-2 ring-slate-900 dark:ring-slate-100'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function lastNDays(end: string, n: number): string[] {
  const [y, m, d] = end.split('-').map(Number) as [number, number, number];
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i));
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
        dt.getUTCDate()
      ).padStart(2, '0')}`
    );
  }
  return out;
}

function buildMoodIndex(
  thisMonthDays: JournalDay[],
  prevMonthDays: JournalDay[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const day of [...thisMonthDays, ...prevMonthDays]) {
    map.set(day.date, day.mood.scale);
  }
  return map;
}

function previousMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number) as [number, number];
  const dt = new Date(Date.UTC(y, m - 2, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}
