import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyJobsStateProps {
  archived: boolean;
  onNewClick?: () => void;
}

export function EmptyJobsState({ archived, onNewClick }: EmptyJobsStateProps) {
  return (
    <div className="mt-16 max-w-md">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {archived ? 'Nothing archived yet' : 'No applications yet'}
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {archived
          ? 'Applications you archive will appear here. They stay searchable without cluttering your active pipeline.'
          : 'Track your first application — company, role, status, and the prep + reflection that goes around each interview round.'}
      </p>
      {!archived && onNewClick && (
        <Button
          onClick={onNewClick}
          className="mt-6 bg-brand text-white hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Track your first application
        </Button>
      )}
    </div>
  );
}
