interface Props {
  query: string;
}

export function NoResultsState({ query }: Props) {
  return (
    <div className="mt-16 max-w-md">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">No matches</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        No roadmap matches "{query}". Try a shorter query or check the archive.
      </p>
    </div>
  );
}
