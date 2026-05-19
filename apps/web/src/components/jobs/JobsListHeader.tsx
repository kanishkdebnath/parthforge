import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface JobsListHeaderProps {
  archived: boolean;
  onNewClick: () => void;
}

export function JobsListHeader({ archived, onNewClick }: JobsListHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {archived ? 'Archived applications' : 'Job applications'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {archived
            ? 'Closed pursuits. Restore one any time.'
            : 'Track each application with its status, prep notes, questions asked, and post-interview reflection.'}
        </p>
      </div>
      {!archived && (
        <Button
          onClick={onNewClick}
          className="bg-brand text-white hover:bg-brand-hover shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New application
        </Button>
      )}
    </div>
  );
}
