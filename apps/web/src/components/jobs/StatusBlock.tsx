import { ChevronDown } from 'lucide-react';
import type {
  JobApplication,
  JobApplicationStatus,
} from '@pathforge/shared';
import { cn } from '@/lib/utils';
import { useUpdateJob } from '@/hooks/useJobs';
import {
  roundProgress,
  statusClass,
  statusLabel,
} from '@/lib/jobs-formatting';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface StatusBlockProps {
  job: JobApplication;
}

const STATUSES: JobApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
];

export function StatusBlock({ job }: StatusBlockProps) {
  const update = useUpdateJob(job._id);
  const progress = roundProgress(job);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90',
            statusClass(job.status)
          )}
        >
          <span className="flex items-center gap-2">
            {statusLabel(job.status)}
            {progress && job.status === 'interviewing' && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-white/40 dark:bg-black/20">
                Round {progress.n} of {progress.m}
              </span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => {
              if (s !== job.status) update.mutate({ status: s });
            }}
            className={cn(s === job.status && 'font-semibold')}
          >
            {statusLabel(s)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
