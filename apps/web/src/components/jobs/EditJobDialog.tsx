import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import type {
  JobApplication,
  JobApplicationStatus,
  WorkMode,
} from '@pathforge/shared';
import { useUpdateJob } from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LinkedRoadmapPicker } from './LinkedRoadmapPicker';

interface EditJobDialogProps {
  job: JobApplication;
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

export function EditJobDialog({ job, open, onOpenChange }: EditJobDialogProps) {
  const update = useUpdateJob(job._id);

  const [company, setCompany] = useState(job.company);
  const [role, setRole] = useState(job.role);
  const [status, setStatus] = useState<JobApplicationStatus>(job.status);
  const [appliedAt, setAppliedAt] = useState<Date | undefined>(
    job.appliedAt ? new Date(job.appliedAt) : undefined
  );
  const [appliedAtOpen, setAppliedAtOpen] = useState(false);
  const [jobUrl, setJobUrl] = useState(job.jobUrl ?? '');
  const [resumeUrl, setResumeUrl] = useState(job.resumeUrl ?? '');
  const [workMode, setWorkMode] = useState<WorkMode | ''>(job.workMode ?? '');
  const [location, setLocation] = useState(job.location ?? '');
  const [salaryRange, setSalaryRange] = useState(job.salaryRange ?? '');
  const [offerAmount, setOfferAmount] = useState(job.offerAmount ?? '');
  const [tags, setTags] = useState(job.tags.join(', '));
  const [roadmapId, setRoadmapId] = useState<string | undefined>(
    job.links.roadmapId
  );

  // Reset from prop whenever the dialog opens
  useEffect(() => {
    if (open) {
      setCompany(job.company);
      setRole(job.role);
      setStatus(job.status);
      setAppliedAt(job.appliedAt ? new Date(job.appliedAt) : undefined);
      setJobUrl(job.jobUrl ?? '');
      setResumeUrl(job.resumeUrl ?? '');
      setWorkMode(job.workMode ?? '');
      setLocation(job.location ?? '');
      setSalaryRange(job.salaryRange ?? '');
      setOfferAmount(job.offerAmount ?? '');
      setTags(job.tags.join(', '));
      setRoadmapId(job.links.roadmapId);
    }
  }, [open, job]);

  const submit = () => {
    if (!company.trim() || !role.trim()) return;
    update.mutate(
      {
        company: company.trim(),
        role: role.trim(),
        status,
        appliedAt: appliedAt ?? null,
        jobUrl: jobUrl.trim() || null,
        resumeUrl: resumeUrl.trim() || null,
        workMode: workMode || null,
        location: location.trim() || null,
        salaryRange: salaryRange.trim() || null,
        offerAmount: offerAmount.trim() || null,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        links: { roadmapId: roadmapId ?? null },
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Edit application
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Field label="Company">
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </Field>
          <Field label="Role">
            <Input value={role} onChange={(e) => setRole(e.target.value)} />
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

            <Field label="Applied on">
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
                  {appliedAt && (
                    <div className="border-t p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedAt(undefined);
                          setAppliedAtOpen(false);
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
          </div>

          <Field label="Job posting URL" optional>
            <Input
              type="url"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
            />
          </Field>

          <Field label="Resume URL" optional>
            <Input
              type="url"
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Work mode" optional>
              <Select
                value={workMode}
                onValueChange={(v) =>
                  setWorkMode(v === 'none' ? '' : (v as WorkMode))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
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
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Salary range" optional>
              <Input
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                placeholder="$180k – $220k"
              />
            </Field>
            <Field label="Offer amount" optional>
              <Input
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                placeholder="$240k base + 25%"
              />
            </Field>
          </div>

          <Field label="Tags" optional hint="Comma-separated.">
            <Input value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>

          <Field label="Linked roadmap" optional>
            <LinkedRoadmapPicker
              value={roadmapId}
              onChange={(id) => setRoadmapId(id)}
            />
          </Field>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!company.trim() || !role.trim() || update.isPending}
            className="bg-brand text-white hover:bg-brand-hover"
          >
            {update.isPending ? 'Saving…' : 'Save'}
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
