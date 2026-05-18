import { useMemo, useState } from 'react';
import type { Roadmap } from '@pathforge/shared';
import { useRoadmaps } from '@/hooks/useRoadmaps';
import { ListPageHeader } from '@/components/roadmaps/ListPageHeader';
import { RoadmapsToolbar } from '@/components/roadmaps/RoadmapsToolbar';
import { RoadmapCardGrid } from '@/components/roadmaps/RoadmapCardGrid';
import { EmptyRoadmapsState } from '@/components/roadmaps/EmptyRoadmapsState';
import { NoResultsState } from '@/components/roadmaps/NoResultsState';
import { NewRoadmapDialog } from '@/components/roadmaps/NewRoadmapDialog';
import { ImportRoadmapDialog } from '@/components/roadmaps/ImportRoadmapDialog';

interface Props {
  archived?: boolean;
}

export default function RoadmapsListPage({ archived = false }: Props) {
  const { data, isPending } = useRoadmaps({ archived });
  const [query, setQuery] = useState('');
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const filtered = useMemo<Roadmap[]>(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (q.length === 0) return data;
    return data.filter((r) => {
      if (r.title.toLowerCase().includes(q)) return true;
      if (r.description && r.description.toLowerCase().includes(q)) return true;
      if (r.milestones.some((m) => m.title.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [data, query]);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container max-w-6xl py-10 px-6">
        <ListPageHeader
          archived={archived}
          onNewClick={() => setNewDialogOpen(true)}
          onImportClick={() => setImportDialogOpen(true)}
        />
        <RoadmapsToolbar query={query} onQueryChange={setQuery} archived={archived} />

        {isPending && <p className="mt-12 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
        {!isPending && data && data.length === 0 && (
          <EmptyRoadmapsState archived={archived} onNewClick={() => setNewDialogOpen(true)} />
        )}
        {!isPending && data && data.length > 0 && filtered.length === 0 && (
          <NoResultsState query={query} />
        )}
        {!isPending && filtered.length > 0 && <RoadmapCardGrid roadmaps={filtered} />}
      </div>

      <NewRoadmapDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} />
      <ImportRoadmapDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </main>
  );
}
