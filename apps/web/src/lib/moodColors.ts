/**
 * Tailwind classes for each mood scale value (1 = lowest, 5 = highest).
 * Used by JournalMonthGrid (full calendar) and JournalTodayCard
 * (14-day mini heatmap on the dashboard).
 */
export const MOOD_SCALE_BG: Record<number, string> = {
  1: 'bg-red-300 dark:bg-red-900 text-red-900 dark:text-red-100',
  2: 'bg-orange-300 dark:bg-orange-900 text-orange-900 dark:text-orange-100',
  3: 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200',
  4: 'bg-emerald-300 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100',
  5: 'bg-sky-300 dark:bg-sky-900 text-sky-900 dark:text-sky-100',
};
