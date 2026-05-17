import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRoadmaps } from '@/hooks/useRoadmaps';
import { RoadmapsToolbar } from '@/components/roadmaps/RoadmapsToolbar';
import { RoadmapCardGrid } from '@/components/roadmaps/RoadmapCardGrid';
import { EmptyRoadmapsState } from '@/components/roadmaps/EmptyRoadmapsState';
import { NoResultsState } from '@/components/roadmaps/NoResultsState';
import { NewRoadmapDialog } from '@/components/roadmaps/NewRoadmapDialog';
import type { Roadmap } from '@pathforge/shared';

interface Props {
  archived?: boolean;
}

export default function RoadmapsListPage({ archived = false }: Props) {
  const { data, isPending } = useRoadmaps({ archived });
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [] as Array<{ roadmap: Roadmap; absoluteIndex: number }>;
    const q = query.trim().toLowerCase();
    const indexed = data.map((roadmap, idx) => ({ roadmap, absoluteIndex: idx }));
    if (q.length === 0) return indexed;
    return indexed.filter(({ roadmap: r }) => {
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.description && r.description.toLowerCase().includes(q)) return true;
      if (r.milestones.some((m) => m.title.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [data, query]);

  return (
    <main className="min-h-screen paper-grain">
      <div className="container py-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="smcp text-xs text-slate-500">
              {archived ? 'Archive' : 'Pursuits'}
            </p>
            <h1 className="mt-1 font-display text-5xl font-semibold tracking-tight text-slate-900">
              {archived ? 'Archive' : 'Roadmaps'}
            </h1>
          </div>
          {!archived && (
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-active text-active-foreground hover:bg-active/90"
            >
              + New roadmap
            </Button>
          )}
        </div>

        <RoadmapsToolbar query={query} onQueryChange={setQuery} archived={archived} />

        {isPending && <p className="mt-12 text-slate-500">Loading…</p>}
        {!isPending && data && data.length === 0 && <EmptyRoadmapsState archived={archived} />}
        {!isPending && data && data.length > 0 && filtered.length === 0 && (
          <NoResultsState query={query} />
        )}
        {!isPending && filtered.length > 0 && <RoadmapCardGrid items={filtered} />}
      </div>

      <NewRoadmapDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </main>
  );
}
