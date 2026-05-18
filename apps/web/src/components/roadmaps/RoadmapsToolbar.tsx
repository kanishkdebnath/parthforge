import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  archived: boolean;
}

export function RoadmapsToolbar({ query, onQueryChange, archived }: Props) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-4">
      {/* Segmented control */}
      <div className="relative inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
        <Link
          to="/roadmaps"
          className={cn(
            'relative z-10 px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors',
            !archived ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          )}
        >
          Active
        </Link>
        <Link
          to="/roadmaps/archived"
          className={cn(
            'relative z-10 px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors',
            archived ? 'text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          )}
        >
          Archive
        </Link>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search…"
          className="pl-9 bg-white dark:bg-slate-900"
        />
      </div>
    </div>
  );
}
