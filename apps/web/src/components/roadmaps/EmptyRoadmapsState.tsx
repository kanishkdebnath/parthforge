interface Props {
  archived: boolean;
}

export function EmptyRoadmapsState({ archived }: Props) {
  return (
    <div className="mt-16 max-w-md text-slate-600">
      <p className="font-display italic text-2xl text-slate-700">
        {archived ? 'No archived roadmaps.' : 'An empty manuscript.'}
      </p>
      <p className="mt-4 text-sm">
        {archived
          ? 'Roadmaps you archive will appear here. Nothing has been archived yet.'
          : 'Press "+ New roadmap" to write the first chapter of a pursuit.'}
      </p>
    </div>
  );
}
