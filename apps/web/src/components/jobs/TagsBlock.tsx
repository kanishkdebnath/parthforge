import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { useUpdateJob } from '@/hooks/useJobs';

interface TagsBlockProps {
  job: JobApplication;
}

export function TagsBlock({ job }: TagsBlockProps) {
  const update = useUpdateJob(job._id);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');

  const addTag = () => {
    const t = value.trim().toLowerCase();
    if (!t) {
      setAdding(false);
      setValue('');
      return;
    }
    if (job.tags.includes(t)) {
      setValue('');
      setAdding(false);
      return;
    }
    update.mutate({ tags: [...job.tags, t] });
    setValue('');
    setAdding(false);
  };

  const removeTag = (tag: string) => {
    update.mutate({ tags: job.tags.filter((t) => t !== tag) });
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Tags
        </h3>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {job.tags.map((t) => (
          <span
            key={t}
            className="group inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium px-2 py-0.5 rounded-full"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="opacity-50 hover:opacity-100 transition-opacity"
              aria-label={`Remove ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {job.tags.length === 0 && !adding && (
          <span className="text-xs text-slate-400 dark:text-slate-500 italic">
            No tags yet
          </span>
        )}
        {adding && (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={addTag}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              } else if (e.key === 'Escape') {
                setValue('');
                setAdding(false);
              }
            }}
            placeholder="tag…"
            className="bg-transparent border-b border-slate-300 dark:border-slate-700 text-xs px-1 py-0.5 outline-none focus:border-slate-500 dark:focus:border-slate-400 min-w-[60px] max-w-[120px]"
          />
        )}
      </div>
    </div>
  );
}
