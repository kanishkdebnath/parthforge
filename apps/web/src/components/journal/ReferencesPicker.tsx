import { useState } from 'react';
import type { JournalReference, Roadmap, JobApplication } from '@pathforge/shared';
import { useRoadmaps } from '@/hooks/useRoadmaps';
import { useJobs } from '@/hooks/useJobs';

interface ReferencesPickerProps {
  references: JournalReference[];
  onChange: (next: JournalReference[]) => void;
}

interface RefOption {
  key: string;
  label: string;
  ref: JournalReference;
}

function buildOptions(roadmaps: Roadmap[], jobs: JobApplication[]): RefOption[] {
  const opts: RefOption[] = [];
  for (const r of roadmaps) {
    opts.push({
      key: `roadmap:${r._id}`,
      label: `roadmap · ${r.title}`,
      ref: { type: 'roadmap', roadmapId: r._id },
    });
    for (const m of r.milestones) {
      opts.push({
        key: `milestone:${r._id}:${m._id}`,
        label: `milestone · ${r.title} → ${m.title}`,
        ref: { type: 'milestone', roadmapId: r._id, milestoneId: m._id },
      });
    }
  }
  for (const j of jobs) {
    opts.push({
      key: `job:${j._id}`,
      label: `job · ${j.company} — ${j.role}`,
      ref: { type: 'job', jobId: j._id },
    });
  }
  return opts;
}

function refKey(ref: JournalReference): string {
  if (ref.type === 'roadmap') return `roadmap:${ref.roadmapId}`;
  if (ref.type === 'milestone') return `milestone:${ref.roadmapId}:${ref.milestoneId}`;
  return `job:${ref.jobId}`;
}

function labelFor(
  ref: JournalReference,
  options: RefOption[]
): string {
  const match = options.find((o) => o.key === refKey(ref));
  return match ? match.label : '(deleted)';
}

export function ReferencesPicker({ references, onChange }: ReferencesPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: roadmaps = [] } = useRoadmaps({ archived: false });
  const { data: jobs = [] } = useJobs({ archived: false });

  const options = buildOptions(roadmaps, jobs);
  const taken = new Set(references.map(refKey));
  const filtered = options.filter(
    (o) =>
      !taken.has(o.key) &&
      (!query || o.label.toLowerCase().includes(query.toLowerCase()))
  );

  const add = (opt: RefOption) => {
    if (references.length >= 10) return;
    onChange([...references, opt.ref]);
    setQuery('');
    setOpen(false);
  };
  const remove = (i: number) => onChange(references.filter((_, idx) => idx !== i));

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        References
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {references.map((ref, i) => (
          <span
            key={`${refKey(ref)}:${i}`}
            className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-800 dark:text-slate-200"
          >
            {labelFor(ref, options)}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-slate-400 hover:text-red-500"
              aria-label="Remove reference"
            >
              ✕
            </button>
          </span>
        ))}
        {references.length < 10 && (
          <button
            type="button"
            data-tour="add-reference"
            onClick={() => setOpen((o) => !o)}
            className="px-3 py-1 text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            + add reference
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 shadow-sm">
          <input
            type="text"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roadmaps, milestones, jobs…"
            className="w-full px-3 py-2 text-sm border-b border-slate-100 dark:border-slate-800 bg-transparent outline-none"
          />
          <div className="max-h-56 overflow-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">No matches</div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => add(opt)}
                className="block w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
