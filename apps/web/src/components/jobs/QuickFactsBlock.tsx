import { Calendar, DollarSign, FileText, Globe, Link as LinkIcon, MapPin } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { resumeLabel } from '@/lib/jobs-formatting';

interface QuickFactsBlockProps {
  job: JobApplication;
}

export function QuickFactsBlock({ job }: QuickFactsBlockProps) {
  const items: Array<{
    icon: typeof Calendar;
    label: string;
    value: React.ReactNode;
  }> = [];

  if (job.appliedAt) {
    items.push({
      icon: Calendar,
      label: 'Applied',
      value: new Date(job.appliedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    });
  }

  if (job.workMode || job.location) {
    items.push({
      icon: job.workMode === 'onsite' ? MapPin : Globe,
      label: 'Mode',
      value: [
        job.workMode === 'remote'
          ? 'Remote'
          : job.workMode === 'hybrid'
            ? 'Hybrid'
            : job.workMode === 'onsite'
              ? 'Onsite'
              : null,
        job.location,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }

  if (job.salaryRange) {
    items.push({
      icon: DollarSign,
      label: 'Salary',
      value: (
        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
          {job.salaryRange}
        </span>
      ),
    });
  }
  if (job.offerAmount && job.status === 'offer') {
    items.push({
      icon: DollarSign,
      label: 'Offer',
      value: (
        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
          {job.offerAmount}
        </span>
      ),
    });
  }

  if (job.jobUrl) {
    items.push({
      icon: LinkIcon,
      label: 'Job posting',
      value: (
        <a
          href={job.jobUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-700 dark:text-sky-400 hover:underline truncate inline-block max-w-[180px]"
        >
          {new URL(job.jobUrl).host} ↗
        </a>
      ),
    });
  }

  if (job.resumeUrl) {
    items.push({
      icon: FileText,
      label: 'Resume',
      value: (
        <a
          href={job.resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          {resumeLabel(job.resumeUrl) ?? job.resumeUrl} ↗
        </a>
      ),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
      <div className="space-y-2.5">
        {items.map(({ icon: Icon, label, value }, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Icon className="h-3 w-3 opacity-70" />
              {label}
            </span>
            <span className="text-slate-900 dark:text-slate-100 text-right truncate">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
