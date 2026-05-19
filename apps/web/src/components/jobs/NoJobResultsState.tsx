interface NoJobResultsStateProps {
  query: string;
  statusFilterLabel?: string;
}

export function NoJobResultsState({
  query,
  statusFilterLabel,
}: NoJobResultsStateProps) {
  const hasQuery = query.trim().length > 0;
  const hasFilter = !!statusFilterLabel && statusFilterLabel !== 'All';
  return (
    <div className="mt-16 max-w-md">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        No matches
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {hasQuery && hasFilter
          ? `No application matches "${query}" with status "${statusFilterLabel}". Try a shorter query or a different status.`
          : hasQuery
            ? `No application matches "${query}". Try a shorter query.`
            : hasFilter
              ? `No applications with status "${statusFilterLabel}".`
              : 'Try a different filter.'}
      </p>
    </div>
  );
}
