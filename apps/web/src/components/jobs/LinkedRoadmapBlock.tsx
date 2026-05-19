import { Link } from 'react-router-dom';
import { ArrowRight, Compass } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { useRoadmap } from '@/hooks/useRoadmaps';

interface LinkedRoadmapBlockProps {
  job: JobApplication;
}

export function LinkedRoadmapBlock({ job }: LinkedRoadmapBlockProps) {
  const roadmapId = job.links.roadmapId;
  const { data: roadmap } = useRoadmap(roadmapId);

  if (!roadmapId) return null;

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        Linked roadmap
      </h3>
      <Link
        to={`/roadmaps/${roadmapId}`}
        className="group inline-flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
      >
        <Compass className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
        <span className="flex-1 text-sm text-slate-900 dark:text-slate-100 truncate">
          {roadmap?.title ?? 'Loading…'}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
}
