import { useMemo, useState } from 'react';
import { useJobs } from '@/hooks/useJobs';
import { JobsListHeader } from '@/components/jobs/JobsListHeader';
import { JobsToolbar, type StatusFilter } from '@/components/jobs/JobsToolbar';
import { EmptyJobsState } from '@/components/jobs/EmptyJobsState';
import { NoJobResultsState } from '@/components/jobs/NoJobResultsState';
import { JobListRow } from '@/components/jobs/JobListRow';
import { NewJobDialog } from '@/components/jobs/NewJobDialog';
import { statusLabel } from '@/lib/jobs-formatting';

export default function JobsListPage({ archived = false }: { archived?: boolean } = {}) {
  const { data, isPending } = useJobs({ archived });
  const { data: counterpart } = useJobs({ archived: !archived });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  // Counts always reflect the unfiltered active set so the user can see
  // pipeline shape at a glance — they don't decrease as the user types.
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: 0,
      saved: 0,
      applied: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
    };
    if (!data) return c;
    c.all = data.length;
    for (const j of data) {
      c[j.status] = (c[j.status] ?? 0) + 1;
    }
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.filter((j) => {
      if (statusFilter !== 'all' && j.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [j.company, j.role, ...j.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, query, statusFilter]);

  const showEmpty = !isPending && (data?.length ?? 0) === 0;
  const showNoResults =
    !isPending && (data?.length ?? 0) > 0 && filtered.length === 0;
  const showList = !isPending && filtered.length > 0;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container max-w-6xl py-10 px-6">
        <JobsListHeader
          archived={archived}
          onNewClick={() => setNewDialogOpen(true)}
        />

        <JobsToolbar
          archived={archived}
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          counts={counts}
          activeCount={archived ? counterpart?.length : data?.length}
          archivedCount={archived ? data?.length : counterpart?.length}
        />

        {isPending && (
          <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">
            Loading…
          </p>
        )}

        {showEmpty && (
          <EmptyJobsState
            archived={archived}
            onNewClick={() => setNewDialogOpen(true)}
          />
        )}

        {showNoResults && (
          <NoJobResultsState
            query={query}
            statusFilterLabel={
              statusFilter === 'all' ? undefined : statusLabel(statusFilter)
            }
          />
        )}

        {showList && (
          <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((j) => (
              <JobListRow key={j._id} job={j} />
            ))}
          </div>
        )}
      </div>

      <NewJobDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} />
    </main>
  );
}
