import { useMe } from '@/hooks/useAuth';

export default function Dashboard() {
  const { data: me } = useMe();
  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold">Welcome, {me?.name}.</h1>
      <p className="text-muted-foreground mt-2">
        This is the v0 walking skeleton. Roadmaps, resources, and job applications come next.
      </p>
    </main>
  );
}
