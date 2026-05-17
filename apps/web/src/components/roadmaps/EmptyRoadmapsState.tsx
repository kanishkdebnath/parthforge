import { Button } from '@/components/ui/button';

interface Props {
  archived: boolean;
  onNewClick?: () => void;
}

export function EmptyRoadmapsState({ archived, onNewClick }: Props) {
  return (
    <div className="mt-16 max-w-md">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900">
        {archived ? 'Nothing archived yet' : 'No roadmaps yet'}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {archived
          ? 'Roadmaps you archive will show up here. They stay accessible without cluttering your active list.'
          : 'Start a roadmap to break a goal into milestones and steps. You can always edit or delete later.'}
      </p>
      {!archived && onNewClick && (
        <Button
          onClick={onNewClick}
          className="mt-6 bg-brand text-white hover:bg-brand-hover"
        >
          + New roadmap
        </Button>
      )}
    </div>
  );
}
