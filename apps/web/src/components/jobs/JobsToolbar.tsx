import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import type { JobApplicationStatus } from '@pathforge/shared';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export type StatusFilter = JobApplicationStatus | 'all';

const STATUS_ORDER: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

interface JobsToolbarProps {
  activeCount?: number;
  archived: boolean;
  archivedCount?: number;
  query: string;
  onQueryChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (v: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}

export function JobsToolbar({
  activeCount,
  archived,
  archivedCount,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  counts,
}: JobsToolbarProps) {
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Active / Archive toggle */}
        <div className="relative inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <Link
            to="/jobs"
            className={cn(
              'inline-flex items-center px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors',
              !archived
                ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            Active
            {activeCount !== undefined && (
              <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                {activeCount}
              </span>
            )}
          </Link>
          <Link
            to="/jobs/archived"
            className={cn(
              'inline-flex items-center px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors',
              archived
                ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            Archive
            {archivedCount !== undefined && (
              <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                {archivedCount}
              </span>
            )}
          </Link>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          <Input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search company, role, tags…"
            className="pl-9 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      {/* Status filter pills (active list only) */}
      {!archived && (
        <div className="flex flex-wrap gap-2">
          {STATUS_ORDER.map(({ value, label }) => {
            const active = statusFilter === value;
            const count = counts[value] ?? 0;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onStatusFilterChange(value)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors border',
                  active
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:border-slate-700'
                )}
              >
                {label}
                <span
                  className={cn(
                    'text-xs font-normal',
                    active
                      ? 'text-slate-300 dark:text-slate-500'
                      : 'text-slate-400 dark:text-slate-500'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
