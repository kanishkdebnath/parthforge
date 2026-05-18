import { Button } from '@/components/ui/button';
import { ImportRoadmapButton } from './ImportRoadmapButton';

interface Props {
  archived: boolean;
  onNewClick: () => void;
  onImportClick: () => void;
}

export function ListPageHeader({ archived, onNewClick, onImportClick }: Props) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {archived ? 'Archive' : 'Roadmaps'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {archived ? 'Roadmaps you have set aside.' : 'Pursuits in motion.'}
        </p>
      </div>
      {!archived && (
        <div className="flex items-center gap-2">
          <ImportRoadmapButton onClick={onImportClick} />
          <Button
            onClick={onNewClick}
            className="bg-brand text-white hover:bg-brand-hover"
          >
            + New roadmap
          </Button>
        </div>
      )}
    </div>
  );
}
