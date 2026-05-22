import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Check,
  Circle,
  Map as MapIcon,
  RotateCcw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTour, type SectionStatus } from './TourProvider';
import { TOUR_STEPS, type TourStepGroup } from './tourSteps';

type SectionMeta = {
  icon: React.ComponentType<{ className?: string }>;
  iconWrapper: string;   // Tailwind classes for the colored icon tile
  tagline: string;
};

const SECTION_META: Record<TourStepGroup, SectionMeta> = {
  Roadmaps: {
    icon: MapIcon,
    iconWrapper: 'bg-sky-500/15 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300',
    tagline: 'Goals broken into milestones with steps.',
  },
  Jobs: {
    icon: Briefcase,
    iconWrapper: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300',
    tagline: 'Track applications, rounds, and outcomes.',
  },
};

const SECTION_ORDER: TourStepGroup[] = ['Roadmaps', 'Jobs'];

export function TourPanel() {
  const {
    isDemoUser,
    open,
    activeSection,
    completedStepIds,
    sectionStatus,
    openPanel,
    closePanel,
    openSection,
    backToMenu,
    restart,
    markComplete,
  } = useTour();

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

  return (
    <aside
      aria-label="Onboarding tour"
      className="fixed right-4 top-20 bottom-4 z-50 w-80 flex flex-col rounded-2xl border border-slate-200/70 bg-white/95 shadow-2xl shadow-slate-950/40 ring-1 ring-inset ring-white/5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/90"
    >
      <PanelHeader
        activeSection={activeSection}
        sectionStatus={sectionStatus}
        onBack={backToMenu}
        onClose={closePanel}
      />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeSection === null ? (
          <MenuView
            sectionStatus={sectionStatus}
            onOpenSection={openSection}
          />
        ) : (
          <SectionStepList
            group={activeSection}
            completedStepIds={completedStepIds}
            onMarkComplete={markComplete}
          />
        )}
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

function PanelHeader({
  activeSection,
  sectionStatus,
  onBack,
  onClose,
}: {
  activeSection: TourStepGroup | null;
  sectionStatus: (group: TourStepGroup) => SectionStatus;
  onBack: () => void;
  onClose: () => void;
}) {
  if (activeSection === null) {
    return (
      <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/60">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Pathfinder tutorials
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Pick a section to learn
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const status = sectionStatus(activeSection);

  return (
    <div className="border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/60">
      <button
        type="button"
        onClick={onBack}
        className="mb-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <ArrowLeft className="h-3 w-3" /> All tutorials
      </button>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {activeSection}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {status.completed} / {status.total} this section
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MenuView({
  sectionStatus,
  onOpenSection,
}: {
  sectionStatus: (group: TourStepGroup) => SectionStatus;
  onOpenSection: (group: TourStepGroup, opts?: { resetIfDone?: boolean }) => void;
}) {
  return (
    <div className="space-y-3">
      {SECTION_ORDER.map((group) => {
        const meta = SECTION_META[group];
        const status = sectionStatus(group);
        const Icon = meta.icon;

        let statusText: string;
        let ctaText: string;
        let resetIfDone = false;

        if (status.state === 'done') {
          statusText = 'Done';
          ctaText = 'Re-run →';
          resetIfDone = true;
        } else if (status.state === 'in-progress') {
          statusText = `${status.completed} of ${status.total}`;
          ctaText = 'Continue →';
        } else {
          statusText = `${status.total} steps`;
          ctaText = 'Start →';
        }

        return (
          <button
            key={group}
            type="button"
            onClick={() => onOpenSection(group, resetIfDone ? { resetIfDone: true } : undefined)}
            disabled={status.total === 0}
            className={cn(
              'group w-full rounded-xl border bg-gradient-to-b p-3 text-left transition',
              'border-slate-200/70 from-white to-slate-50 hover:border-slate-300 hover:from-white hover:to-white',
              'dark:border-slate-700/60 dark:from-slate-800/60 dark:to-slate-900/60 dark:hover:border-slate-600',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            <div className={cn('mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg', meta.iconWrapper)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{group}</div>
            <div className="mt-0.5 mb-2 text-xs text-slate-600 dark:text-slate-400">
              {meta.tagline}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs dark:border-slate-700/50">
              <span
                className={cn(
                  status.state === 'done'
                    ? 'inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                )}
              >
                {status.state === 'done' && <Check className="h-3 w-3" />}
                {statusText}
              </span>
              <span className="font-medium text-sky-600 group-hover:text-sky-700 dark:text-sky-400 dark:group-hover:text-sky-300">
                {ctaText}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SectionStepList({
  group,
  completedStepIds,
  onMarkComplete,
}: {
  group: TourStepGroup;
  completedStepIds: Set<string>;
  onMarkComplete: (id: string) => void;
}) {
  const steps = TOUR_STEPS.filter((s) => s.group === group);

  return (
    <ol className="space-y-3">
      {steps.map((step) => {
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
                onClick={() => onMarkComplete(step.id)}
                className="mt-0.5 shrink-0 text-slate-400 hover:text-emerald-600"
                aria-label="Mark step complete"
              >
                <Circle className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <div
                className={
                  done
                    ? 'text-sm font-medium text-slate-400 line-through dark:text-slate-500'
                    : 'text-sm font-medium text-slate-900 dark:text-slate-100'
                }
              >
                {step.title}
              </div>
              <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{step.body}</div>
              {step.cta && (
                <Link
                  to={step.cta.to}
                  onClick={() => onMarkComplete(step.id)}
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
  );
}
