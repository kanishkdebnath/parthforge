import { Link } from 'react-router-dom';
import { Check, Circle, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTour } from './TourProvider';
import { TOUR_STEPS, type TourStep, type TourStepGroup } from './tourSteps';

const GROUPED_STEPS = TOUR_STEPS.reduce<Record<TourStepGroup, TourStep[]>>(
  (acc, step) => {
    acc[step.group].push(step);
    return acc;
  },
  { Roadmaps: [], Jobs: [] },
);

export function TourPanel() {
  const { isDemoUser, open, completedStepIds, openPanel, closePanel, restart, markComplete } = useTour();

  if (!isDemoUser) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        aria-label="Resume tour"
        className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full bg-slate-900/95 px-4 py-2 text-sm font-medium text-white shadow-2xl shadow-slate-950/40 ring-1 ring-white/10 backdrop-blur-md hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:ring-slate-900/10"
      >
        Resume tour ▸
      </button>
    );
  }

  const completedCount = TOUR_STEPS.filter((s) => completedStepIds.has(s.id)).length;

  return (
    <aside
      aria-label="Onboarding tour"
      className="fixed right-4 top-20 bottom-4 z-50 w-80 flex flex-col rounded-2xl border border-slate-200/70 bg-white/95 shadow-2xl shadow-slate-950/40 ring-1 ring-inset ring-white/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90"
    >
      <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/60">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pathfinder tour</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {completedCount} / {TOUR_STEPS.length}
          </div>
        </div>
        <button
          type="button"
          onClick={closePanel}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {(['Roadmaps', 'Jobs'] as const).map((group) => (
          <section key={group} className="mb-6 last:mb-0">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  group === 'Roadmaps' ? 'bg-sky-500' : 'bg-emerald-500'
                }`}
                aria-hidden="true"
              />
              {group}
            </h3>
            <ol className="space-y-3">
              {GROUPED_STEPS[group].map((step) => {
                const done = completedStepIds.has(step.id);
                return (
                  <li key={step.id} className="flex items-start gap-3">
                    {done ? (
                      <span
                        className="mt-0.5 shrink-0 text-emerald-600"
                        aria-label="Step complete"
                      >
                        <Check className="h-4 w-4" />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markComplete(step.id)}
                        className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-600"
                        aria-label="Mark step complete"
                      >
                        <Circle className="h-4 w-4" />
                      </button>
                    )}
                    <div className="min-w-0">
                      <div className={done ? 'text-sm font-medium text-slate-400 line-through dark:text-slate-500' : 'text-sm font-medium text-slate-900 dark:text-slate-100'}>
                        {step.title}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{step.body}</div>
                      {step.cta && (
                        <Link
                          to={step.cta.to}
                          onClick={() => markComplete(step.id)}
                          className="mt-1 inline-block text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                        >
                          {step.cta.label} →
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 px-4 py-3 dark:border-slate-700/60">
        <Button type="button" variant="ghost" size="sm" onClick={restart}>
          <RotateCcw className="mr-1 h-3 w-3" /> Restart
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={closePanel}>
          Close
        </Button>
      </div>
    </aside>
  );
}
