import { useMe } from '@/hooks/useAuth';
import { JournalTodayCard } from '@/components/journal/JournalTodayCard';

export default function Dashboard() {
  const { data: me } = useMe();
  return (
    <main className="container py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {me?.name}.</h1>
        <p className="text-muted-foreground mt-2">
          A quick pulse on today, plus your roadmaps and applications a click away.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <JournalTodayCard />
      </div>
    </main>
  );
}
