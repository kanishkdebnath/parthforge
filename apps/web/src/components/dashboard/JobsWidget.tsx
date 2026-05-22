import { useNavigate } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import type { JobApplication, JobApplicationStatus } from '@pathforge/shared';
import { useJobs } from '@/hooks/useJobs';

const STATUS_ORDER: JobApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
];

const STATUS_LABEL: Record<JobApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

/** Secondary dashboard widget. Highlights the most pressing active job
 *  (offer → interviewing → applied → any), shows a per-status count strip,
 *  and exposes "+ New" and "Open Jobs →" links. */
export function JobsWidget() {
  const navigate = useNavigate();
  const { data: active = [], isLoading, isError } = useJobs({ archived: false });

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6">
      <Header />
      <div className="mt-3 min-h-[72px]">
        {isLoading ? (
          <div className="h-4 w-40 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        ) : isError ? (
          <div className="text-xs text-slate-400">Couldn't load.</div>
        ) : active.length === 0 ? (
          <EmptyState />
        ) : (
          <ActiveBody jobs={active} />
        )}
      </div>
      <Footer onNew={() => navigate('/jobs')} onOpen={() => navigate('/jobs')} />
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300">
        <Briefcase className="h-4 w-4" />
      </div>
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Jobs</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-sm text-slate-500 dark:text-slate-400">
      Track applications, rounds, and outcomes.
    </div>
  );
}

function ActiveBody({ jobs }: { jobs: JobApplication[] }) {
  const highlight = pickHighlight(jobs);
  const counts = countByStatus(jobs);
  return (
    <div>
      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
        {highlight.company} · {highlight.role}
      </div>
      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
        {captionFor(highlight.status)}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STATUS_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => (
          <span
            key={s}
            className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300"
          >
            {STATUS_LABEL[s]} {counts.get(s)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Footer({ onNew, onOpen }: { onNew: () => void; onOpen: () => void }) {
  return (
    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <button
        type="button"
        onClick={onNew}
        className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
      >
        + New
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
      >
        Open Jobs →
      </button>
    </div>
  );
}

function pickHighlight(jobs: JobApplication[]): JobApplication {
  const priority: JobApplicationStatus[] = ['offer', 'interviewing', 'applied'];
  for (const status of priority) {
    const match = jobs
      .filter((j) => j.status === status)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    if (match) return match;
  }
  // Fallback: most-recent any-status.
  return [...jobs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0]!;
}

function countByStatus(jobs: JobApplication[]): Map<JobApplicationStatus, number> {
  const counts = new Map<JobApplicationStatus, number>();
  for (const j of jobs) {
    counts.set(j.status, (counts.get(j.status) ?? 0) + 1);
  }
  return counts;
}

function captionFor(status: JobApplicationStatus): string {
  if (status === 'offer') return 'Offer · awaiting decision';
  return STATUS_LABEL[status];
}
