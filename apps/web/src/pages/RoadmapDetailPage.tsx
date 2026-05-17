import { useParams } from 'react-router-dom';
import { useRoadmap } from '@/hooks/useRoadmaps';
import { NotFoundPanel } from '@/components/NotFoundPanel';

export default function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  // Defensive: React Router guarantees id on /roadmaps/:id, but if this page
  // is ever mounted programmatically without one, useRoadmap(undefined) would
  // disable the query and hang on Loading… forever. Treat missing id as 404.
  if (!id) {
    return <NotFoundPanel title="Roadmap not found." detail="It may have been deleted or you do not have access." />;
  }
  const { data, isPending } = useRoadmap(id);

  if (isPending) {
    return <main className="container py-12 text-slate-500">Loading…</main>;
  }
  if (!data) {
    return <NotFoundPanel title="Roadmap not found." detail="It may have been deleted or you do not have access." />;
  }
  return (
    <main className="container py-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-slate-900">
        {data.title}
      </h1>
      <p className="mt-2 text-slate-600">(Detail page skeleton — header in Task 6, lists in Tasks 7 and 8.)</p>
    </main>
  );
}
