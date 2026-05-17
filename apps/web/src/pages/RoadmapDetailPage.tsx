import { useParams } from 'react-router-dom';
import { useRoadmap } from '@/hooks/useRoadmaps';
import { NotFoundPanel } from '@/components/NotFoundPanel';
import { RoadmapSidebar } from '@/components/roadmaps/RoadmapSidebar';
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
    return (
      <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-50">
        <div className="container max-w-6xl py-10 px-6 text-sm text-slate-500">Loading…</div>
      </main>
    );
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
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-50">
      <div className="container max-w-6xl py-10 px-6">
        <div className="flex flex-col lg:flex-row gap-10">
          <RoadmapSidebar roadmap={data} />
          <section className="flex-1 min-w-0">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Milestones
            </h2>
            <MilestoneList roadmap={data} />
            <AddMilestoneInline roadmapId={data._id} />
          </section>
        </div>
      </div>
    </main>
  );
}
