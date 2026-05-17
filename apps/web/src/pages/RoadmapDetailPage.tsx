import { useParams } from 'react-router-dom';
import { useRoadmap } from '@/hooks/useRoadmaps';
import { NotFoundPanel } from '@/components/NotFoundPanel';
import { RoadmapDetailHeader } from '@/components/roadmaps/RoadmapDetailHeader';
import { MilestoneList } from '@/components/roadmaps/MilestoneList';
import { AddMilestoneInline } from '@/components/roadmaps/AddMilestoneInline';

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
      <section className="mt-12">
        <h2 className="smcp text-xs text-slate-500 mb-4">Milestones</h2>
        <MilestoneList roadmap={data} />
        <AddMilestoneInline roadmapId={data._id} />
      </section>
    </main>
  );
}
