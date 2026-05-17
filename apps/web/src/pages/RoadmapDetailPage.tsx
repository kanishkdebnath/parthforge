import { useParams } from 'react-router-dom';
import { useRoadmap } from '@/hooks/useRoadmaps';
import { NotFoundPanel } from '@/components/NotFoundPanel';
import { RoadmapDetailHeader } from '@/components/roadmaps/RoadmapDetailHeader';

export default function RoadmapDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return (
      <NotFoundPanel
        title="Roadmap not found."
        detail="It may have been deleted or you do not have access."
      />
    );
  }
  const { data, isPending } = useRoadmap(id);

  if (isPending) {
    return <main className="container py-12 text-slate-500">Loading…</main>;
  }
  if (!data) {
    return (
      <NotFoundPanel
        title="Roadmap not found."
        detail="It may have been deleted or you do not have access."
      />
    );
  }

  return (
    <main className="container py-12 max-w-4xl">
      <RoadmapDetailHeader roadmap={data} />
      <div className="mt-12 text-slate-400 text-sm italic">
        (Milestone list arrives in Task 7.)
      </div>
    </main>
  );
}
