import type { JobApplication } from '@pathforge/shared';
import { cn } from '@/lib/utils';
import { companyInitial, paletteFor } from '@/lib/jobs-formatting';

interface JobIdentityHeroProps {
  job: JobApplication;
}

export function JobIdentityHero({ job }: JobIdentityHeroProps) {
  const palette = paletteFor(job._id);
  return (
    <div>
      <div
        className={cn(
          'h-14 w-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold bg-gradient-to-br',
          palette
        )}
      >
        {companyInitial(job.company)}
      </div>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 break-words">
        {job.company}
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {job.role}
      </p>
    </div>
  );
}
