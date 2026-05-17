import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  archived: boolean;
}

export function RoadmapsToolbar({ query, onQueryChange, archived }: Props) {
  return (
    <div className="mt-8 flex items-center gap-6">
      <div className="flex items-center gap-1 text-sm">
        <Link
          to="/roadmaps"
          className={cn(
            'px-2 py-1 rounded-sm transition-colors',
            !archived ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:text-slate-900'
          )}
        >
          Active
        </Link>
        <span className="text-slate-300">/</span>
        <Link
          to="/roadmaps/archived"
          className={cn(
            'px-2 py-1 rounded-sm transition-colors',
            archived ? 'text-slate-900 bg-slate-100' : 'text-slate-500 hover:text-slate-900'
          )}
        >
          Archive
        </Link>
      </div>
      <Input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search roadmaps…"
        className="max-w-xs"
      />
    </div>
  );
}
