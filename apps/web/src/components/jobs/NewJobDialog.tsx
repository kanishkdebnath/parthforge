import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import type { JobApplicationStatus, WorkMode } from '@pathforge/shared';
import { useCreateJob } from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface NewJobDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const STATUSES: JobApplicationStatus[] = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
];

const STATUS_LABEL: Record<JobApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function NewJobDialog({ open, onOpenChange }: NewJobDialogProps) {
  const navigate = useNavigate();
  const create = useCreateJob();

  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<JobApplicationStatus>('saved');
  const [appliedAt, setAppliedAt] = useState<Date | undefined>(undefined);
  const [appliedAtOpen, setAppliedAtOpen] = useState(false);
  const [jobUrl, setJobUrl] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode | ''>('');
  const [location, setLocation] = useState('');
  const [salaryRange, setSalaryRange] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  // Reset whenever the dialog opens
  useEffect(() => {
    if (open) {
      setCompany('');
      setRole('');
      setStatus('saved');
      setAppliedAt(undefined);
      setJobUrl('');
      setResumeUrl('');
      setWorkMode('');
      setLocation('');
      setSalaryRange('');
      setTags('');
      setNotes('');
    }
  }, [open]);

  const submit = () => {
    if (!company.trim() || !role.trim()) return;
    create.mutate(
      {
        company: company.trim(),
        role: role.trim(),
        status,
        appliedAt,
        jobUrl: jobUrl.trim() || undefined,
        resumeUrl: resumeUrl.trim() || undefined,
        workMode: workMode || undefined,
        location: location.trim() || undefined,
        salaryRange: salaryRange.trim() || undefined,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (fresh) => {
          onOpenChange(false);
          navigate(`/jobs/${fresh._id}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            New application
          </DialogTitle>
          <DialogDescription>
            Company and role are required. Everything else is optional and can
            be filled in later from the detail page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Field label="Company">
            <Input
              autoFocus
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Linear"
            />
          </Field>

          <Field label="Role">
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as JobApplicationStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Applied on" optional>
              <Popover open={appliedAtOpen} onOpenChange={setAppliedAtOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="w-full inline-flex items-center justify-between px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    {appliedAt ? (
                      format(appliedAt, 'MMM d, yyyy')
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
                    selected={appliedAt}
                    onSelect={(d) => {
                      setAppliedAt(d);
                      setAppliedAtOpen(false);
                    }}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </Field>
          </div>

          <Field label="Job posting URL" optional>
            <Input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://"
            />
          </Field>

          <Field label="Resume URL" optional>
            <Input
              type="url"
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Work mode" optional>
              <Select
                value={workMode}
                onValueChange={(v) => setWorkMode(v as WorkMode)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="onsite">Onsite</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Location" optional>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. NYC"
              />
            </Field>
          </div>

          <Field label="Salary range" optional>
            <Input
              value={salaryRange}
              onChange={(e) => setSalaryRange(e.target.value)}
              placeholder="e.g. $180k – $220k"
            />
          </Field>

          <Field label="Tags" optional hint="Comma-separated.">
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="react, remote, referral"
            />
          </Field>

          <Field label="Notes" optional>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you want to remember about the role."
            />
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!company.trim() || !role.trim() || create.isPending}
            className="bg-brand text-white hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {create.isPending ? 'Creating…' : 'Create application'}
          </Button>
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
