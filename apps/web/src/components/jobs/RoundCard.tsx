import { useState } from 'react';
import { ChevronDown, ChevronRight, MessageCircleQuestion, NotebookPen, Pencil, Sparkles } from 'lucide-react';
import type { InterviewRound, RoundOutcome } from '@pathforge/shared';
import { cn } from '@/lib/utils';
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
  const outcome = outcomeLabel(round);
  const outcomeClass =
    round.outcome === 'pending' && isUpcoming(round)
      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
      : OUTCOME_CLASS[round.outcome];

  return (
    <div
      className={cn(
        'group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 transition-colors',
        !expanded && 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
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
          className={cn(
            'ml-auto inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold',
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
          <Section icon={NotebookPen} label="Pre-prep">
            {round.prepNotes ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {round.prepNotes}
              </p>
            ) : (
              <Empty>What to study, who to research, questions to ask.</Empty>
            )}
          </Section>

          <Section icon={MessageCircleQuestion} label="Questions asked">
            {round.questions.length > 0 ? (
              <ul className="list-disc pl-6 text-sm text-slate-700 dark:text-slate-300 space-y-1.5 marker:text-slate-400">
                {round.questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            ) : (
              <Empty>Log questions they asked you, one per line.</Empty>
            )}
          </Section>

          <Section icon={Sparkles} label="Experience / reflection">
            {round.experience ? (
              <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {round.experience}
              </p>
            ) : (
              <Empty>How it went · lessons · follow-ups.</Empty>
            )}
          </Section>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-400 dark:text-slate-500 italic">
      {children}
    </p>
  );
}
