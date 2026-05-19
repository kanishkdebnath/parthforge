import { useParams } from 'react-router-dom';
import { useJob } from '@/hooks/useJobs';
import { JobDetailSidebar } from '@/components/jobs/JobDetailSidebar';
import { NotFoundPanel } from '@/components/NotFoundPanel';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending } = useJob(id);

  if (isPending) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="container max-w-6xl py-10 px-6">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading…
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <NotFoundPanel
        title="Application not found."
        detail="It may have been deleted or you do not have access."
        backHref="/jobs"
        backLabel="Back to applications"
      />
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      <div className="container max-w-6xl py-10 px-6">
        <div className="flex flex-col lg:flex-row gap-10">
          <JobDetailSidebar job={data} />
          <section className="flex-1 min-w-0 space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Application notes
              </h3>
              <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 italic">
                Notes panel will land in Task 13.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Interview rounds
              </h3>
              <p className="mt-2 text-sm text-slate-400 dark:text-slate-500 italic">
                Rounds panel will land in Tasks 14–17.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
