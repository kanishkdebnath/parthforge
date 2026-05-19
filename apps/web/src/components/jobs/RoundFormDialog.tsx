import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Check, Plus, Trash2 } from 'lucide-react';
import type { InterviewRound, RoundOutcome } from '@pathforge/shared';
import {
  useAddRound,
  useDeleteRound,
  useUpdateRound,
} from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RoundFormDialogProps {
  jobId: string;
  round?: InterviewRound;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const OUTCOMES: RoundOutcome[] = ['pending', 'passed', 'failed'];
const OUTCOME_LABEL: Record<RoundOutcome, string> = {
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Failed',
};

export function RoundFormDialog({
  jobId,
  round,
  open,
  onOpenChange,
}: RoundFormDialogProps) {
  const add = useAddRound(jobId);
  const update = useUpdateRound(jobId, round?._id ?? '');
  const del = useDeleteRound(jobId, round?._id ?? '');

  const [name, setName] = useState('');
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);
  const [dateOpen, setDateOpen] = useState(false);
  const [duration, setDuration] = useState('');
  const [interviewer, setInterviewer] = useState('');
  const [outcome, setOutcome] = useState<RoundOutcome>('pending');
  const [questions, setQuestions] = useState('');

  useEffect(() => {
    if (open) {
      setName(round?.name ?? '');
      setScheduledAt(
        round?.scheduledAt ? new Date(round.scheduledAt) : undefined
      );
      setDuration(
        round?.durationMinutes ? String(round.durationMinutes) : ''
      );
      setInterviewer(round?.interviewer ?? '');
      setOutcome(round?.outcome ?? 'pending');
      setQuestions(round?.questions.join('\n') ?? '');
    }
  }, [open, round]);

  const submit = () => {
    if (!name.trim()) return;

    if (round) {
      // Edit path: send nulls to clear optional fields
      const body: {
        name: string;
        scheduledAt?: Date | null;
        durationMinutes?: number | null;
        interviewer?: string | null;
        outcome?: RoundOutcome;
        questions?: string[];
      } = {
        name: name.trim(),
        scheduledAt: scheduledAt ?? null,
        durationMinutes: duration.trim() ? Number(duration) : null,
        interviewer: interviewer.trim() || null,
        outcome,
        questions: questions
          .split('\n')
          .map((q) => q.trim())
          .filter(Boolean),
      };
      update.mutate(body, { onSuccess: () => onOpenChange(false) });
    } else {
      // Create path: omit null fields entirely
      const createBody: {
        name: string;
        scheduledAt?: Date;
        durationMinutes?: number;
        interviewer?: string;
        outcome?: RoundOutcome;
        questions?: string[];
      } = {
        name: name.trim(),
        outcome,
        questions: questions
          .split('\n')
          .map((q) => q.trim())
          .filter(Boolean),
      };
      if (scheduledAt) createBody.scheduledAt = scheduledAt;
      if (duration.trim()) createBody.durationMinutes = Number(duration);
      if (interviewer.trim()) createBody.interviewer = interviewer.trim();
      add.mutate(createBody, { onSuccess: () => onOpenChange(false) });
    }
  };

  const pending = round ? update.isPending : add.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {round ? 'Edit round' : 'Add round'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Field label="Name">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Phone Screen, Technical, Onsite"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Scheduled" optional>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    {scheduledAt ? (
                      format(scheduledAt, 'MMM d, yyyy')
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">
                        Pick a date
                      </span>
                    )}
                    <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledAt}
                    onSelect={(d) => {
                      setScheduledAt(d);
                      setDateOpen(false);
                    }}
                    autoFocus
                  />
                  {scheduledAt && (
                    <div className="border-t p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setScheduledAt(undefined);
                          setDateOpen(false);
                        }}
                        className="text-xs text-slate-600 dark:text-slate-400 hover:text-red-600 px-2 py-1"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </Field>

            <Field label="Duration (min)" optional>
              <Input
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
              />
            </Field>
          </div>

          <Field label="Interviewer" optional>
            <Input
              value={interviewer}
              onChange={(e) => setInterviewer(e.target.value)}
              placeholder="e.g. Daniel Kim (Hiring Manager)"
            />
          </Field>

          <Field label="Outcome">
            <Select
              value={outcome}
              onValueChange={(v) => setOutcome(v as RoundOutcome)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Questions asked"
            optional
            hint="One question per line."
          >
            <Textarea
              rows={5}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="Design a presence system…\nDebug a memory leak…"
            />
          </Field>
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between">
          {round ? (
            <Button
              variant="ghost"
              onClick={() =>
                del.mutate(undefined, { onSuccess: () => onOpenChange(false) })
              }
              className="text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete round
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!name.trim() || pending}
              className="bg-brand text-white hover:bg-brand-hover"
            >
              {round ? (
                <Check className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1.5" />
              )}
              {pending ? 'Saving…' : round ? 'Save' : 'Add round'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  optional,
  hint,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {optional && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            {' '}
            (optional)
          </span>
        )}
        {hint && (
          <span className="text-slate-400 dark:text-slate-500 font-normal">
            {' '}
            — {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
