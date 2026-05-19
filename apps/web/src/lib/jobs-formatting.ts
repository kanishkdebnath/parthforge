import type { JobApplication, JobApplicationStatus } from '@pathforge/shared';

const STATUS_CLASS: Record<JobApplicationStatus, string> = {
  saved:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  applied:
    'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  interviewing:
    'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  offer:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  rejected:
    'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  withdrawn:
    'bg-slate-200 text-slate-600 dark:bg-slate-900 dark:text-slate-500',
};

const STATUS_LABEL: Record<JobApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function statusClass(s: JobApplicationStatus) {
  return STATUS_CLASS[s];
}

export function statusLabel(s: JobApplicationStatus) {
  return STATUS_LABEL[s];
}

/**
 * Compute "Round N of M" for the status block.
 * M = rounds.length.
 * N = index of the first round whose outcome is not 'passed' (1-indexed).
 * Returns null when there are no rounds, or every round is passed.
 */
export function roundProgress(job: JobApplication): { n: number; m: number } | null {
  const m = job.rounds.length;
  if (m === 0) return null;
  const idx = job.rounds.findIndex((r) => r.outcome !== 'passed');
  if (idx === -1) return null;
  return { n: idx + 1, m };
}

/**
 * Derive a display-friendly filename from a resume URL.
 * E.g. https://docs.google.com/.../resume-swe-v3.pdf  →  "resume-swe-v3.pdf"
 * Falls back to the host when the URL has no path segment.
 */
export function resumeLabel(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : u.host;
  } catch {
    return null;
  }
}

/**
 * Short relative time: "2d ago", "5h ago", "just now", "Mar 14, 2026" for >30 days.
 */
export function relativeTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * "Applied Mar 14" — contextual date label keyed by status.
 * For `saved` apps, prefers `createdAt` over `appliedAt` (the latter is usually undefined).
 */
export function statusDateChip(job: JobApplication): { prefix: string; date: Date } {
  switch (job.status) {
    case 'saved':
      return { prefix: 'Saved', date: new Date(job.createdAt) };
    case 'rejected':
    case 'withdrawn':
      return {
        prefix: 'Closed',
        date: new Date(job.updatedAt),
      };
    default:
      return {
        prefix: 'Applied',
        date: new Date(job.appliedAt ?? job.createdAt),
      };
  }
}

export function formatMonthDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Initials for the logo box: first character of the company name, uppercased.
 * Falls back to `?` for an empty company (should not happen).
 */
export function companyInitial(company: string): string {
  const cleaned = company.trim();
  if (cleaned.length === 0) return '?';
  return cleaned.charAt(0).toUpperCase();
}

/**
 * Pick a stable gradient palette for the logo box based on the app id.
 * Mirrors the palette idea from RoadmapCard, narrowed to a set that pairs
 * well with the row's highlight colors.
 */
const PALETTE = [
  'from-indigo-500 to-violet-600',
  'from-sky-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-slate-700 to-slate-900',
];

export function paletteFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % PALETTE.length;
  return PALETTE[idx] ?? PALETTE[0]!;
}
