import { useMe } from '@/hooks/useAuth';
import { JournalTodayCard } from '@/components/journal/JournalTodayCard';
import { RoadmapsWidget } from '@/components/dashboard/RoadmapsWidget';
import { JobsWidget } from '@/components/dashboard/JobsWidget';

export default function Dashboard() {
  const { data: me } = useMe();
  return (
    <main className="container py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {me?.name}.</h1>
        <p className="text-muted-foreground mt-2">
          Today's pulse, plus your roadmaps and applications a click away.
        </p>
      </div>

      <JournalTodayCard />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RoadmapsWidget />
        <JobsWidget />
      </div>
    </main>
  );
}
