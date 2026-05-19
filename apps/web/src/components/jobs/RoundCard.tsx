import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, MessageCircleQuestion, NotebookPen, Pencil, Sparkles } from 'lucide-react';
import type { InterviewRound, RoundOutcome } from '@pathforge/shared';
import { cn } from '@/lib/utils';
import { useUpdateRound } from '@/hooks/useJobs';
import { Textarea } from '@/components/ui/textarea';
import { RoundFormDialog } from './RoundFormDialog';

interface RoundCardProps {
  jobId: string;
  index: number;
  round: InterviewRound;
}

const OUTCOME_CLASS: Record<RoundOutcome, string> = {
  pending:
    'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  passed:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
};

const OUTCOME_ORDER: RoundOutcome[] = ['pending', 'passed', 'failed'];
function nextOutcome(o: RoundOutcome): RoundOutcome {
  const i = OUTCOME_ORDER.indexOf(o);
  return OUTCOME_ORDER[(i + 1) % OUTCOME_ORDER.length]!;
  // Non-null assertion because (i + 1) % 3 is always a valid index.
}

function isUpcoming(round: InterviewRound): boolean {
  if (round.outcome !== 'pending') return false;
  if (!round.scheduledAt) return false;
  return new Date(round.scheduledAt).getTime() > Date.now();
}

function outcomeLabel(round: InterviewRound): string {
  if (round.outcome === 'pending' && isUpcoming(round)) return 'Upcoming';
  if (round.outcome === 'pending') return 'Pending';
  return round.outcome === 'passed' ? 'Passed' : 'Failed';
}

export function RoundCard({ jobId, index, round }: RoundCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const update = useUpdateRound(jobId, round._id);
  const outcome = outcomeLabel(round);
  const outcomeClass =
    round.outcome === 'pending' && isUpcoming(round)
      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
      : OUTCOME_CLASS[round.outcome];

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: round._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 transition-colors',
        !expanded && 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40',
        isDragging && 'shadow-md ring-1 ring-slate-300 dark:ring-slate-700 z-10'
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span
          {...attributes}
          {...listeners}
          role="button"
          tabIndex={0}
          aria-label="Drag round"
          onClick={(e) => e.stopPropagation()}
          className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <span className="h-6 w-6 rounded-md bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 inline-flex items-center justify-center text-[11px] font-bold">
          {index}
        </span>
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {round.name}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {round.scheduledAt &&
            `· ${new Date(round.scheduledAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}`}
          {round.durationMinutes && ` · ${round.durationMinutes} min`}
          {round.interviewer && ` · ${round.interviewer}`}
        </span>
        {/* Edit affordance: span role="button" inside toggle button avoids nested <button>.
            stopPropagation prevents bubbling to the expand toggle. */}
        <span
          role="button"
          tabIndex={0}
          aria-label="Edit round"
          onClick={(e) => {
            e.stopPropagation();
            setEditOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              setEditOpen(true);
            }
          }}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-opacity"
        >
          <Pencil className="h-3.5 w-3.5" />
        </span>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Outcome ${outcome}; click to cycle`}
          onClick={(e) => {
            e.stopPropagation();
            update.mutate({ outcome: nextOutcome(round.outcome) });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              update.mutate({ outcome: nextOutcome(round.outcome) });
            }
          }}
          className={cn(
            'ml-auto inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer hover:opacity-90 transition-opacity',
            outcomeClass
          )}
        >
          {outcome}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-dashed border-slate-200 dark:border-slate-800 px-4 py-4 space-y-4">
          <EditableTextSection
            jobId={jobId}
            roundId={round._id}
            field="prepNotes"
            initial={round.prepNotes}
            label="Pre-prep"
            placeholder="What to study, who to research, questions to ask."
            icon={NotebookPen}
          />

          <Section icon={MessageCircleQuestion} label="Questions asked">
            {round.questions.length > 0 ? (
              <ul className="list-disc pl-6 text-sm text-slate-700 dark:text-slate-300 space-y-1.5 marker:text-slate-400">
                {round.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                Log questions they asked you, one per line.
              </p>
            )}
          </Section>

          <EditableTextSection
            jobId={jobId}
            roundId={round._id}
            field="experience"
            initial={round.experience}
            label="Experience / reflection"
            placeholder="How it went · lessons · follow-ups."
            icon={Sparkles}
          />
        </div>
      )}

      <RoundFormDialog
        jobId={jobId}
        round={round}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof NotebookPen;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
        <Icon className="h-3 w-3 opacity-70" />
        {label}
      </div>
      {children}
    </div>
  );
}

function EditableTextSection({
  jobId,
  roundId,
  field,
  initial,
  label,
  placeholder,
  icon: Icon,
}: {
  jobId: string;
  roundId: string;
  field: 'prepNotes' | 'experience';
  initial: string | undefined;
  label: string;
  placeholder: string;
  icon: typeof NotebookPen;
}) {
  const update = useUpdateRound(jobId, roundId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial ?? '');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const len = ref.current.value.length;
      ref.current.setSelectionRange(len, len);
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(initial ?? '');
  }, [initial, editing]);

  const save = () => {
    const next = draft.trim();
    if (next !== (initial ?? '').trim()) {
      // Both fields are nullable in UpdateRoundBody — null clears, string updates.
      update.mutate(
        field === 'prepNotes'
          ? { prepNotes: next || null }
          : { experience: next || null }
      );
    }
    setEditing(false);
  };

  return (
    <div>
      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
        <Icon className="h-3 w-3 opacity-70" />
        {label}
      </div>
      {!editing && initial && (
        <p
          onClick={() => setEditing(true)}
          className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed cursor-text"
        >
          {initial}
        </p>
      )}
      {!editing && !initial && (
        <p
          onClick={() => setEditing(true)}
          className="text-sm text-slate-400 dark:text-slate-500 italic cursor-text"
        >
          {placeholder}
        </p>
      )}
      {editing && (
        <Textarea
          ref={ref}
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(initial ?? '');
              setEditing(false);
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
