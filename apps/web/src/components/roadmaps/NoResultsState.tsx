interface Props {
  query: string;
}

export function NoResultsState({ query }: Props) {
  return (
    <div className="mt-16 max-w-md text-slate-600">
      <p className="font-display italic text-2xl text-slate-700">No matches.</p>
      <p className="mt-4 text-sm">
        No roadmap matches "{query}". Try a shorter query or check the archive.
      </p>
    </div>
  );
}
