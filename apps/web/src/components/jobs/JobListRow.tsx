import { Link } from 'react-router-dom';
import { Calendar, Globe, MapPin } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { cn } from '@/lib/utils';
import {
  companyInitial,
  formatMonthDay,
  paletteFor,
  relativeTime,
  resumeLabel,
  roundProgress,
  statusClass,
  statusDateChip,
  statusLabel,
} from '@/lib/jobs-formatting';

interface JobListRowProps {
  job: JobApplication;
}

export function JobListRow({ job }: JobListRowProps) {
  const progress = roundProgress(job);
  const resume = resumeLabel(job.resumeUrl);
  const { prefix, date } = statusDateChip(job);
  const palette = paletteFor(job._id);
  const modeIcon =
    job.workMode === 'onsite' ? MapPin : Globe;
  const ModeIcon = modeIcon;

  return (
    <Link
      to={`/jobs/${job._id}`}
      className="group block hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
    >
      <div className="grid grid-cols-[56px_1fr_220px] gap-4 px-5 py-4 items-center">
        {/* Logo */}
        <div
          className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center text-white text-lg font-bold bg-gradient-to-br shrink-0',
            palette
          )}
        >
          {companyInitial(job.company)}
        </div>

        {/* Main */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-[15px] text-slate-900 dark:text-slate-100 truncate">
              {job.company}
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-sm truncate">
              · {job.role}
            </span>
          </div>

          {job.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {job.tags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium px-2 py-0.5 rounded-full"
                >
                  {t}
                </span>
              ))}
              {job.tags.length > 6 && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  +{job.tags.length - 6}
                </span>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-slate-500 dark:text-slate-400">
            {job.workMode && (
              <span className="inline-flex items-center gap-1">
                <ModeIcon className="h-3 w-3 opacity-70" />
                {job.workMode === 'onsite' && job.location
                  ? `Onsite · ${job.location}`
                  : job.workMode === 'hybrid' && job.location
                    ? `Hybrid · ${job.location}`
                    : job.workMode === 'remote'
                      ? 'Remote'
                      : job.workMode}
              </span>
            )}
            {!job.workMode && job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3 opacity-70" />
                {job.location}
              </span>
            )}
            {job.salaryRange && (
              <>
                <Dot />
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {job.salaryRange}
                </span>
              </>
            )}
            {job.offerAmount && job.status === 'offer' && (
              <>
                <Dot />
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  Offer · {job.offerAmount}
                </span>
              </>
            )}
            {resume && (
              <>
                <Dot />
                <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
                  {resume}
                </span>
              </>
            )}
            {job.contacts.length > 0 && (
              <>
                <Dot />
                <span>
                  {job.contacts.length}{' '}
                  {job.contacts.length === 1 ? 'contact' : 'contacts'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[13px] font-semibold',
              statusClass(job.status)
            )}
          >
            {statusLabel(job.status)}
            {progress && job.status === 'interviewing' && (
              <span className="text-[11px] font-medium opacity-70 border-l border-current/40 pl-1.5">
                Round {progress.n} of {progress.m}
              </span>
            )}
          </span>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 text-[12px] font-semibold">
            <Calendar className="h-3 w-3" />
            {prefix} {formatMonthDay(date)}
          </span>

          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Updated {relativeTime(job.updatedAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      className="inline-block h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600"
    />
  );
}
