import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { JobIdentityHero } from './JobIdentityHero';
import { StatusBlock } from './StatusBlock';
import { QuickFactsBlock } from './QuickFactsBlock';
import { TagsBlock } from './TagsBlock';
import { LinkedRoadmapBlock } from './LinkedRoadmapBlock';

interface JobDetailSidebarProps {
  job: JobApplication;
}

export function JobDetailSidebar({ job }: JobDetailSidebarProps) {
  return (
    <aside className="w-full lg:w-[320px] lg:shrink-0 lg:sticky lg:top-20 lg:self-start space-y-6">
      <Link
        to={job.archived ? '/jobs/archived' : '/jobs'}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {job.archived ? 'Archive' : 'Applications'}
      </Link>

      <JobIdentityHero job={job} />

      <StatusBlock job={job} />

      <QuickFactsBlock job={job} />

      <TagsBlock job={job} />

      <LinkedRoadmapBlock job={job} />

      {/* ContactsBlock, JobActions are added in tasks 11-12 */}
    </aside>
  );
}
