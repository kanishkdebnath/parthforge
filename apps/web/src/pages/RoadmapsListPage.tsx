interface Props {
  archived?: boolean;
}

export default function RoadmapsListPage({ archived = false }: Props) {
  return (
    <main className="container py-12">
      <h1 className="font-display text-5xl font-semibold tracking-tight text-slate-900">
        {archived ? 'Archive' : 'Roadmaps'}
      </h1>
      <p className="mt-2 text-slate-600">
        (List page placeholder — implemented in Task 5.)
      </p>
    </main>
  );
}
