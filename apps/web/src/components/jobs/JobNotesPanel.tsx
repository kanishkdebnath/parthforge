import { useEffect, useRef, useState } from 'react';
import { Pencil, StickyNote } from 'lucide-react';
import type { JobApplication } from '@pathforge/shared';
import { useUpdateJob } from '@/hooks/useJobs';
import { Textarea } from '@/components/ui/textarea';

interface JobNotesPanelProps {
  job: JobApplication;
}

export function JobNotesPanel({ job }: JobNotesPanelProps) {
  const update = useUpdateJob(job._id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(job.notes ?? '');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      // focus + place caret at end
      const ta = ref.current;
      if (ta) {
        ta.focus();
        const len = ta.value.length;
        ta.setSelectionRange(len, len);
      }
    }
  }, [editing]);

  // If the source job changes while we're editing, only update the draft
  // when there's no in-progress edit (avoid clobbering the user's input).
  useEffect(() => {
    if (!editing) setDraft(job.notes ?? '');
  }, [job.notes, editing]);

  const save = () => {
    const next = draft.trim();
    const prev = (job.notes ?? '').trim();
    if (next !== prev) {
      update.mutate({ notes: next || null });
    }
    setEditing(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <StickyNote className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          Application notes
        </h3>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {!editing && (
        <>
          {job.notes ? (
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {job.notes}
            </p>
          ) : (
            <p
              onClick={() => setEditing(true)}
              className="text-sm text-slate-400 dark:text-slate-500 italic cursor-text"
            >
              Add notes — referral context, comp signals, watchouts…
            </p>
          )}
        </>
      )}

      {editing && (
        <Textarea
          ref={ref}
          rows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(job.notes ?? '');
              setEditing(false);
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder="Notes — markdown not rendered; line breaks preserved."
        />
      )}
    </div>
  );
}
